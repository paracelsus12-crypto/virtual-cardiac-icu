// PatientMonitor v4 — Philips IntelliVue style
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Patient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Settings, Zap, Droplets, TrendingDown } from 'lucide-react';
import WaveformCanvas from './WaveformCanvas';
import ResuscitationPanel from './ResuscitationPanel';
import TamponadeScenario from './TamponadeScenario';
import HypotensionScenario from './HypotensionScenario';
import {
  generateECGBuffer, generateABPBuffer, generateSpO2Buffer,
  getDisplayHR, RhythmType, RHYTHM_LABELS, RHYTHM_SEVERITY,
} from '../utils/ecgGenerator';
import {
  playNormalBeep, playAfibBeep, startAlarm, stopAlarm,
  setMuted, getMuted, resumeAudioContext,
} from '../utils/audioEngine';
import { PATIENT_MEDS } from '../services/icuService';

interface PatientMonitorProps {
  patient: Patient;
  onEdit: () => void;
}

const RHYTHM_OPTIONS: { value: RhythmType; label: string; color: string }[] = [
  { value: 'sinus',              label: 'Синусовий ритм',        color: 'text-green-400' },
  { value: 'afib',               label: 'ФП',                    color: 'text-yellow-400' },
  { value: 'av_block_1',         label: 'АВ-бл. I ст.',          color: 'text-blue-300' },
  { value: 'av_block_2_mobitz1', label: 'АВ-бл. II (Мобітц I)',  color: 'text-yellow-500' },
  { value: 'av_block_2_mobitz2', label: 'АВ-бл. II (Мобітц II)', color: 'text-orange-400' },
  { value: 'av_block_3',         label: 'АВ-бл. III (повна)',    color: 'text-orange-500' },
  { value: 'vtach',              label: 'ШТ 160/хв',             color: 'text-red-400' },
  { value: 'vfib',               label: 'ФШ',                    color: 'text-red-600' },
  { value: 'asystole',           label: 'Асистолія',             color: 'text-gray-400' },
];

// Speed control
export const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 1.0, label: '1×'   },
  { value: 2.0, label: '2×'   },
  { value: 3.0, label: '3×'   },
];

const BUFFER_SIZE = 1000;
const SAMPLE_RATE = 250;
const UPDATE_MS   = 60;

export const PatientMonitor: React.FC<PatientMonitorProps> = ({ patient, onEdit }) => {
  const [rhythm, setRhythm]                   = useState<RhythmType>('sinus');
  const [ecgBuffer, setEcgBuffer]             = useState<number[]>([]);
  const [abpBuffer, setAbpBuffer]             = useState<number[]>([]);
  const [spo2Buffer, setSpo2Buffer]           = useState<number[]>([]);
  const [isMutedState, setIsMutedState]       = useState(false);
  const [showResuscitation, setShowResuscitation] = useState(false);
  const [showTamponade, setShowTamponade]     = useState(false);
  const [showHypotension, setShowHypotension] = useState(false);
  const [vfibAmplitude, setVfibAmplitude]     = useState(1.0);
  const [showRhythmSelector, setShowRhythmSelector] = useState(false);
  const [currentBP, setCurrentBP]             = useState(patient.currentVitals.bloodPressure);
  const [speed, setSpeed]                     = useState(1.0);
  const [scenarioKey, setScenarioKey]         = useState(0);
  const [now, setNow]                         = useState(new Date());

  const beepTimerRef = useRef<number>(0);
  const timeRef      = useRef(0);
  const rhythmRef    = useRef(rhythm);
  rhythmRef.current  = rhythm;
  const vfibAmpRef   = useRef(vfibAmplitude);
  vfibAmpRef.current = vfibAmplitude;
  const speedRef     = useRef(speed);
  speedRef.current   = speed;

  // Clock
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { currentVitals } = patient;
  const displayHR  = getDisplayHR(rhythm, currentVitals.heartRate);
  const severity   = RHYTHM_SEVERITY[rhythm];
  const isCritical = severity === 'critical';
  const isNoOutput = rhythm === 'vfib' || rhythm === 'asystole';

  const generateChunk = useCallback(() => {
    const dur = (UPDATE_MS / 1000) * speedRef.current;
    const t0  = timeRef.current;
    timeRef.current += dur;
    const [sys, dia] = currentBP.split('/').map(Number);
    const ecg  = generateECGBuffer(rhythmRef.current, currentVitals.heartRate, dur, SAMPLE_RATE, vfibAmpRef.current, t0);
    const abp  = generateABPBuffer(currentVitals.heartRate, sys||120, dia||80, dur, SAMPLE_RATE, rhythmRef.current, t0);
    const spo2 = generateSpO2Buffer(currentVitals.heartRate, currentVitals.spo2, dur, SAMPLE_RATE, rhythmRef.current, t0);
    setEcgBuffer(prev  => [...prev,  ...ecg].slice(-BUFFER_SIZE));
    setAbpBuffer(prev  => [...prev,  ...abp].slice(-BUFFER_SIZE));
    setSpo2Buffer(prev => [...prev, ...spo2].slice(-BUFFER_SIZE));
    if (!isNoOutput) {
      setCurrentBP(`${Math.round(Math.max(70, Math.min(200, sys+(Math.random()-0.5)*1.5)))}/${Math.round(Math.max(40, Math.min(120, dia+(Math.random()-0.5)*1)))}`);
    }
  }, [currentVitals, currentBP, isNoOutput]);

  useEffect(() => {
    const id = window.setInterval(generateChunk, UPDATE_MS);
    return () => clearInterval(id);
  }, [generateChunk]);

  useEffect(() => {
    clearInterval(beepTimerRef.current); stopAlarm();
    if (rhythm === 'vfib' || rhythm === 'asystole') { startAlarm('critical'); setShowResuscitation(true); }
    else if (rhythm === 'vtach' || rhythm === 'av_block_3') startAlarm('warning');
    else {
      const interval = (60/(displayHR||75))*1000/speedRef.current;
      beepTimerRef.current = window.setInterval(() => {
        if (!getMuted()) rhythm === 'afib' ? playAfibBeep() : playNormalBeep();
      }, interval);
    }
    return () => { clearInterval(beepTimerRef.current); stopAlarm(); };
  }, [rhythm, displayHR, speed]);

  useEffect(() => {
    if (rhythm !== 'vfib') { setVfibAmplitude(1.0); return; }
    const id = window.setInterval(() => setVfibAmplitude(p => Math.max(0.08, p-0.004)), 500);
    return () => clearInterval(id);
  }, [rhythm]);

  const handleRhythmChange = (r: RhythmType) => {
    resumeAudioContext(); setRhythm(r); setShowRhythmSelector(false);
    if (r === 'sinus') setShowResuscitation(false);
    if (r === 'vfib' || r === 'asystole') setShowResuscitation(true);
  };
  const handleMute = () => {
    resumeAudioContext();
    const m = !isMutedState; setIsMutedState(m); setMuted(m);
  };
  const handleReset = () => {
    setScenarioKey(k => k+1);
    setShowResuscitation(false); setShowTamponade(false); setShowHypotension(false);
    setRhythm('sinus'); setVfibAmplitude(1.0);
    stopAlarm();
  };

  const rhythmColor = severity==='critical'?'#ef4444':severity==='warning'?'#f59e0b':'#22c55e';
  const hrDisplay   = rhythm==='vfib'?'---':rhythm==='asystole'?'000':String(displayHR??'--');
  const timeStr     = now.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  // Philips color scheme
  const ECG_COLOR  = '#00ff88';
  const ABP_COLOR  = '#ff4444';
  const SPO2_COLOR = '#00aaff';
  const RR_COLOR   = '#ffee00';

  return (
    <div className="flex flex-col h-full relative" style={{ background:'#000810', color:'white' }}>

      {/* === PHILIPS TOP BAR === */}
      <div className="shrink-0 px-3 py-1.5 flex items-center justify-between border-b"
        style={{ borderColor:'#0d2035', background:'#000f1e' }}>
        {/* Patient info */}
        <div className="flex items-center gap-4">
          <div>
            <span className="font-bold text-white text-sm tracking-wide">{patient.name}</span>
            <span className="ml-2 text-[10px] font-mono" style={{ color:'#4488aa' }}>
              Ліжко {patient.bedNumber}
            </span>
          </div>
          <div className="text-[10px]" style={{ color:'#4488aa' }}>
            {patient.age} р. · {patient.gender==='M'?'чол.':'жін.'}
          </div>
          <div className="text-[10px] max-w-[180px] truncate" style={{ color:'#336677' }}>
            {patient.surgeryType}
          </div>
        </div>

        {/* Clock + controls */}
        <div className="flex items-center gap-2">
          {/* Speed */}
          <div className="flex items-center gap-1 mr-1">
            {SPEED_OPTIONS.map(s => (
              <button key={s.value} onClick={() => setSpeed(s.value)}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors"
                style={{
                  background: speed===s.value ? '#0055aa' : '#001828',
                  color: speed===s.value ? '#ffffff' : '#446688',
                  border: '1px solid ' + (speed===s.value ? '#0077dd' : '#0d2035'),
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Reset */}
          <button onClick={handleReset}
            className="px-2 py-0.5 rounded text-[9px] font-bold"
            style={{ background:'#001828', color:'#446688', border:'1px solid #0d2035' }}
            title="Скинути сценарій">
            ↺ Reset
          </button>

          {/* Scenario buttons */}
          {isCritical && (
            <button onClick={() => setShowResuscitation(true)}
              className="px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 animate-pulse"
              style={{ background:'#550000', color:'#ff6666', border:'1px solid #880000' }}>
              <Zap size={11}/> РЕАНІМАЦІЯ
            </button>
          )}
          <button onClick={() => setShowTamponade(true)}
            className="px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1"
            style={{ background:'#3a2000', color:'#ffaa44', border:'1px solid #553300' }}>
            <Droplets size={11}/> ТАМПОНАДА
          </button>
          <button onClick={() => setShowHypotension(true)}
            className="px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1"
            style={{ background:'#2a1500', color:'#ff8833', border:'1px solid #443300' }}>
            <TrendingDown size={11}/> ГІПОТЕНЗІЯ
          </button>

          {/* Rhythm */}
          <button onClick={() => { resumeAudioContext(); setShowRhythmSelector(s=>!s); }}
            className="px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1"
            style={{ background:'#001828', color:'#4499cc', border:'1px solid #0d2035' }}>
            <Settings size={11}/> РИТМ
          </button>

          {/* Mute */}
          <button onClick={handleMute}
            className="p-1.5 rounded"
            style={{ background:'#001828', border:'1px solid #0d2035' }}>
            {isMutedState
              ? <VolumeX size={13} style={{ color:'#446688' }}/>
              : <Volume2 size={13} style={{ color:'#22c55e' }}/>}
          </button>

          {/* Clock */}
          <div className="font-mono text-xs ml-1" style={{ color:'#aaccee', minWidth:60 }}>
            {timeStr}
          </div>
        </div>
      </div>

      {/* Rhythm dropdown */}
      <AnimatePresence>
        {showRhythmSelector && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
            className="absolute top-[42px] right-2 z-50 rounded shadow-2xl p-2 grid grid-cols-2 gap-1 w-72"
            style={{ background:'#001020', border:'1px solid #0d2035' }}>
            <div className="col-span-2 text-[9px] font-bold uppercase px-1 pb-1.5 mb-1"
              style={{ color:'#4488aa', borderBottom:'1px solid #0d2035' }}>
              Навчальний сценарій — вибір ритму
            </div>
            {RHYTHM_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleRhythmChange(opt.value)}
                className={`text-left px-2.5 py-2 rounded text-[11px] font-medium transition-colors ${opt.color}`}
                style={{ background: rhythm===opt.value ? '#0d2035' : 'transparent' }}>
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* === MAIN MONITOR AREA === */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Waveforms — left 75% */}
        <div className="flex-1 flex flex-col gap-0.5 p-1.5 min-w-0 overflow-hidden">

          {/* Rhythm label bar */}
          <div className="shrink-0 px-2 py-0.5 flex items-center gap-3"
            style={{ background:'#000f1e' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: rhythmColor, textShadow:`0 0 8px ${rhythmColor}80` }}>
              {RHYTHM_LABELS[rhythm]}
            </span>
            {isCritical && (
              <span className="text-[9px] font-bold animate-pulse" style={{ color:'#ff4444' }}>
                ⚠ ТРИВОГА
              </span>
            )}
            <span className="ml-auto text-[9px]" style={{ color:'#224455' }}>
              {patient.preExistingConditions.join(' · ')}
            </span>
          </div>

          {/* ECG — tallest wave */}
          <WaveformCanvas buffer={ecgBuffer}
            color={rhythm==='vfib'?'#ff3333':rhythm==='asystole'?'#446655':ECG_COLOR}
            label="I ECG"
            height={130} critical={isCritical} showGrid />

          {/* ABP */}
          <WaveformCanvas buffer={abpBuffer}
            color={ABP_COLOR} fillColor="rgba(255,60,60,0.06)"
            label="ABP"
            currentValue={isNoOutput?'---':currentBP}
            unit="mmHg" height={105} critical={isNoOutput} showGrid />

          {/* SpO2 pleth */}
          <WaveformCanvas buffer={spo2Buffer}
            color={SPO2_COLOR} fillColor="rgba(0,170,255,0.06)"
            label="SpO₂"
            currentValue={isNoOutput?'--':String(currentVitals.spo2)}
            unit="%" height={90} critical={currentVitals.spo2<90} showGrid />

        </div>

        {/* === RIGHT PANEL — Philips numeric display === */}
        <div className="w-52 shrink-0 flex flex-col border-l"
          style={{ borderColor:'#0d2035', background:'#000f1e' }}>

          {/* HR */}
          <PhilipsParamBlock
            label="HR"
            subLabel={RHYTHM_LABELS[rhythm].substring(0,12)}
            value={hrDisplay}
            unit="bpm"
            color={ECG_COLOR}
            critical={isCritical}
            blink={isNoOutput}
            alarmHigh={currentVitals.heartRate > patient.thresholds.hrMax}
            alarmLow={currentVitals.heartRate < patient.thresholds.hrMin}
          />

          {/* ABP */}
          <PhilipsParamBlock
            label="ABP"
            value={isNoOutput?'---':currentBP}
            unit="mmHg"
            color={ABP_COLOR}
            critical={isNoOutput}
          />

          {/* SpO2 */}
          <PhilipsParamBlock
            label="SpO₂"
            value={isNoOutput?'--':String(currentVitals.spo2)}
            unit="%"
            color={SPO2_COLOR}
            critical={currentVitals.spo2 < 90}
            alarmLow={currentVitals.spo2 < patient.thresholds.spo2Min}
          />

          {/* RR */}
          <PhilipsParamBlock
            label="RR"
            value={String(currentVitals.respiratoryRate)}
            unit="/хв"
            color={RR_COLOR}
          />

          {/* Temp */}
          <PhilipsParamBlock
            label="TEMP"
            value={String(currentVitals.temperature)}
            unit="°C"
            color={currentVitals.temperature > patient.thresholds.tempMax ? '#ff9944' : '#cccccc'}
            alarmHigh={currentVitals.temperature > patient.thresholds.tempMax}
          />

          {/* Meds / info block — індивідуальні */}
          <div className="flex-1 p-2 border-t overflow-y-auto" style={{ borderColor:'#0d2035' }}>
            {(() => {
              const meds = PATIENT_MEDS[patient.id];
              if (!meds) return null;
              return (
                <>
                  {/* Дихання */}
                  <div className="mb-2">
                    <div className="text-[8px] font-bold uppercase mb-1" style={{ color:'#224455', letterSpacing:'0.1em' }}>
                      Дихання
                    </div>
                    <div className="text-[10px]" style={{ color: meds.ventilation.includes('ШВЛ') ? '#ffaa44' : '#22cc66' }}>
                      {meds.ventilation}
                    </div>
                    <div className="text-[9px]" style={{ color:'#4488aa' }}>
                      {meds.mode} · FiO₂ {meds.fio2}
                    </div>
                  </div>
                  {/* Знеболення */}
                  {meds.analgesia.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[8px] font-bold uppercase mb-1" style={{ color:'#224455', letterSpacing:'0.1em' }}>
                        Знеболення
                      </div>
                      {meds.analgesia.map((m, i) => (
                        <div key={i} className="text-[9px]" style={{ color:'#aaccee' }}>{m}</div>
                      ))}
                    </div>
                  )}
                  {/* Вазоактивні */}
                  {meds.vasoactive.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[8px] font-bold uppercase mb-1" style={{ color:'#224455', letterSpacing:'0.1em' }}>
                        Вазоактивні
                      </div>
                      {meds.vasoactive.map((m, i) => (
                        <div key={i} className="text-[9px] font-bold" style={{ color:'#ff8844' }}>{m}</div>
                      ))}
                    </div>
                  )}
                  {/* Інше */}
                  {meds.other.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[8px] font-bold uppercase mb-1" style={{ color:'#224455', letterSpacing:'0.1em' }}>
                        Інше
                      </div>
                      {meds.other.map((m, i) => (
                        <div key={i} className="text-[9px]" style={{ color:'#667788' }}>{m}</div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            <div className="mt-2 pt-2 border-t" style={{ borderColor:'#0d2035' }}>
              <button onClick={onEdit}
                className="w-full py-1 rounded text-[9px] font-bold uppercase tracking-widest"
                style={{ background:'#001828', color:'#4488aa', border:'1px solid #0d2035' }}>
                Пороги
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === BOTTOM ALARM BAR === */}
      <div className="shrink-0 px-3 py-1 flex items-center gap-4 border-t text-[9px]"
        style={{ borderColor:'#0d2035', background:'#000810' }}>
        {isCritical && (
          <span className="font-bold animate-pulse flex items-center gap-1" style={{ color:'#ff4444' }}>
            ⚠ {RHYTHM_LABELS[rhythm].toUpperCase()}
          </span>
        )}
        {currentVitals.spo2 < patient.thresholds.spo2Min && (
          <span className="font-bold animate-pulse" style={{ color:'#ff6644' }}>
            SpO₂ низьке: {currentVitals.spo2}%
          </span>
        )}
        {currentVitals.heartRate > patient.thresholds.hrMax && (
          <span className="font-bold" style={{ color:'#ffaa00' }}>
            Тахікардія: {currentVitals.heartRate} уд/хв
          </span>
        )}
        <span className="ml-auto" style={{ color:'#1a3a4a' }}>
          V-ICU · Кардіореанімація
        </span>
      </div>

      {/* Scenarios */}
      <AnimatePresence>
        {showResuscitation && (
          <ResuscitationPanel key={`resusc-${scenarioKey}`} rhythm={rhythm}
            onRhythmChange={handleRhythmChange}
            onClose={() => setShowResuscitation(false)} patientName={patient.name} />
        )}
        {showTamponade && (
          <TamponadeScenario key={`tamp-${scenarioKey}`}
            patientName={patient.name} surgeryType={patient.surgeryType}
            speed={speed}
            onClose={() => setShowTamponade(false)} />
        )}
        {showHypotension && (
          <HypotensionScenario key={`hypo-${scenarioKey}`}
            patientName={patient.name} surgeryType={patient.surgeryType}
            speed={speed}
            onClose={() => setShowHypotension(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Philips-style numeric parameter block
const PhilipsParamBlock = ({
  label, subLabel, value, unit, color, critical=false, blink=false,
  alarmHigh=false, alarmLow=false,
}: any) => (
  <div className="px-2 py-2 border-b relative"
    style={{ borderColor:'#0d2035', background: critical ? '#1a0000' : 'transparent' }}>
    {/* Alarm indicator */}
    {(alarmHigh || alarmLow) && (
      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: alarmHigh ? '#ffaa00' : '#ff4444' }} />
    )}
    <div className="flex items-baseline justify-between mb-0.5">
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-70" style={{ color }}>
        {label}
      </span>
      {subLabel && (
        <span className="text-[8px] opacity-40 truncate max-w-[80px]" style={{ color }}>
          {subLabel}
        </span>
      )}
    </div>
    <div className="flex items-baseline gap-1">
      <span
        className={`font-mono font-bold leading-none ${blink?'animate-pulse':''}`}
        style={{ color, fontSize:'2rem', textShadow:`0 0 16px ${color}60` }}>
        {value}
      </span>
      <span className="text-[10px] opacity-50" style={{ color }}>{unit}</span>
    </div>
  </div>
);

const InfoRow = ({ label, value, warn=false }: any) => (
  <div className="flex justify-between items-center py-0.5">
    <span style={{ color:'#224455', fontSize:9 }}>{label}:</span>
    <span className="font-mono text-[10px]" style={{ color: warn ? '#ff6644' : '#aaccee' }}>{value}</span>
  </div>
);
