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

interface PatientMonitorProps {
  patient: Patient;
  onEdit: () => void;
}

const RHYTHM_OPTIONS: { value: RhythmType; label: string; color: string }[] = [
  { value: 'sinus',              label: 'Синусовий ритм',       color: 'text-green-400' },
  { value: 'afib',               label: 'ФП',                   color: 'text-yellow-400' },
  { value: 'av_block_1',         label: 'АВ-бл. I ст.',         color: 'text-blue-300' },
  { value: 'av_block_2_mobitz1', label: 'АВ-бл. II (Мобітц I)', color: 'text-yellow-500' },
  { value: 'av_block_2_mobitz2', label: 'АВ-бл. II (Мобітц II)',color: 'text-orange-400' },
  { value: 'av_block_3',         label: 'АВ-бл. III (повна)',   color: 'text-orange-500' },
  { value: 'vtach',              label: 'ШТ 160/хв',            color: 'text-red-400' },
  { value: 'vfib',               label: 'ФШ',                   color: 'text-red-600' },
  { value: 'asystole',           label: 'Асистолія',            color: 'text-gray-400' },
];

const BUFFER_SIZE = 1000;
const SAMPLE_RATE = 250;
const UPDATE_MS = 60;

export const PatientMonitor: React.FC<PatientMonitorProps> = ({ patient, onEdit }) => {
  const [rhythm, setRhythm] = useState<RhythmType>('sinus');
  const [ecgBuffer,  setEcgBuffer]  = useState<number[]>([]);
  const [abpBuffer,  setAbpBuffer]  = useState<number[]>([]);
  const [spo2Buffer, setSpo2Buffer] = useState<number[]>([]);
  const [isMutedState, setIsMutedState] = useState(false);
  const [showResuscitation, setShowResuscitation] = useState(false);
  const [showTamponade, setShowTamponade] = useState(false);
  const [showHypotension, setShowHypotension] = useState(false);
  const [vfibAmplitude, setVfibAmplitude] = useState(1.0);
  const [showRhythmSelector, setShowRhythmSelector] = useState(false);
  const [currentBP, setCurrentBP] = useState(patient.currentVitals.bloodPressure);

  const beepTimerRef = useRef<number>(0);
  const timeRef      = useRef(0);
  const rhythmRef    = useRef(rhythm);
  rhythmRef.current  = rhythm;
  const vfibAmpRef   = useRef(vfibAmplitude);
  vfibAmpRef.current = vfibAmplitude;

  const { currentVitals } = patient;
  const displayHR       = getDisplayHR(rhythm, currentVitals.heartRate);
  const severity        = RHYTHM_SEVERITY[rhythm];
  const isCritical      = severity === 'critical';
  const isNoOutput      = rhythm === 'vfib' || rhythm === 'asystole';

  const generateChunk = useCallback(() => {
    const dur = UPDATE_MS / 1000;
    const t0  = timeRef.current;
    timeRef.current += dur;

    const [sys, dia] = currentBP.split('/').map(Number);

    const ecg  = generateECGBuffer(rhythmRef.current, currentVitals.heartRate, dur, SAMPLE_RATE, vfibAmpRef.current, t0);
    const abp  = generateABPBuffer(currentVitals.heartRate, sys || 120, dia || 80, dur, SAMPLE_RATE, rhythmRef.current, t0);
    const spo2 = generateSpO2Buffer(currentVitals.heartRate, currentVitals.spo2, dur, SAMPLE_RATE, rhythmRef.current, t0);

    setEcgBuffer(prev  => [...prev,  ...ecg].slice(-BUFFER_SIZE));
    setAbpBuffer(prev  => [...prev,  ...abp].slice(-BUFFER_SIZE));
    setSpo2Buffer(prev => [...prev, ...spo2].slice(-BUFFER_SIZE));

    if (!isNoOutput) {
      setCurrentBP(`${Math.round(Math.max(70,  Math.min(200, sys + (Math.random()-0.5)*1.5)))}/${Math.round(Math.max(40, Math.min(120, dia + (Math.random()-0.5)*1)))}`);
    }
  }, [currentVitals, currentBP, isNoOutput]);

  useEffect(() => {
    const id = window.setInterval(generateChunk, UPDATE_MS);
    return () => clearInterval(id);
  }, [generateChunk]);

  // Звук
  useEffect(() => {
    clearInterval(beepTimerRef.current);
    stopAlarm();
    if (rhythm === 'vfib' || rhythm === 'asystole') {
      startAlarm('critical');
      setShowResuscitation(true);
    } else if (rhythm === 'vtach' || rhythm === 'av_block_3') {
      startAlarm('warning');
    } else {
      const interval = (60 / (displayHR || 75)) * 1000;
      beepTimerRef.current = window.setInterval(() => {
        if (!getMuted()) rhythm === 'afib' ? playAfibBeep() : playNormalBeep();
      }, interval);
    }
    return () => { clearInterval(beepTimerRef.current); stopAlarm(); };
  }, [rhythm, displayHR]);

  // VFib decay
  useEffect(() => {
    if (rhythm !== 'vfib') { setVfibAmplitude(1.0); return; }
    const id = window.setInterval(() => setVfibAmplitude(p => Math.max(0.08, p - 0.004)), 500);
    return () => clearInterval(id);
  }, [rhythm]);

  const handleRhythmChange = (r: RhythmType) => {
    resumeAudioContext();
    setRhythm(r);
    setShowRhythmSelector(false);
    if (r === 'sinus') setShowResuscitation(false);
    if (r === 'vfib' || r === 'asystole') setShowResuscitation(true);
  };

  const handleMute = () => {
    resumeAudioContext();
    const m = !isMutedState;
    setIsMutedState(m); setMuted(m);
  };

  const rhythmColor =
    severity === 'critical' ? '#ef4444' :
    severity === 'warning'  ? '#f59e0b' : '#22c55e';

  const hrDisplay =
    rhythm === 'vfib'     ? '---' :
    rhythm === 'asystole' ? '000' :
    String(displayHR ?? '--');

  // Кольори кривих (відповідно до атласу)
  const ECG_COLOR  = '#22c55e';   // зелений
  const ABP_COLOR  = '#ef4444';   // червоний ← виправлено
  const SPO2_COLOR = '#3b82f6';   // синій

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-[#0B0E14] shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white">
            {patient.name}
            <span className="text-gray-500 font-normal ml-2 font-mono text-sm">Ліжко {patient.bedNumber}</span>
          </h2>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-[11px] text-gray-400 uppercase tracking-tight">{patient.surgeryType}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border"
              style={{ color: rhythmColor, borderColor: rhythmColor+'50', background: rhythmColor+'12' }}>
              {RHYTHM_LABELS[rhythm]}
            </span>
            {patient.preExistingConditions.slice(0,2).map((c,i) => (
              <span key={i} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 rounded border border-gray-700">{c}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {isCritical && (
            <button onClick={() => setShowResuscitation(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded flex items-center gap-1 animate-pulse">
              <Zap size={12}/> РЕАНІМАЦІЯ
            </button>
          )}
          <button onClick={() => setShowTamponade(true)}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold rounded border border-amber-600 flex items-center gap-1">
            <Droplets size={12}/> ТАМПОНАДА
          </button>
          <button onClick={() => setShowHypotension(true)}
            className="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-[10px] font-bold rounded border border-orange-600 flex items-center gap-1">
            <TrendingDown size={12}/> ГІПОТЕНЗІЯ
          </button>
          <button onClick={() => { resumeAudioContext(); setShowRhythmSelector(s => !s); }}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold rounded border border-gray-700 flex items-center gap-1">
            <Settings size={12}/> РИТМ
          </button>
          <button onClick={handleMute}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700">
            {isMutedState ? <VolumeX size={14} className="text-gray-400"/> : <Volume2 size={14} className="text-green-400"/>}
          </button>
          <button onClick={onEdit}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold rounded border border-gray-700 uppercase">
            Пороги
          </button>
        </div>
      </div>

      {/* Rhythm dropdown */}
      <AnimatePresence>
        {showRhythmSelector && (
          <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            className="absolute top-[68px] right-2 z-50 bg-[#11141D] border border-gray-700 rounded-lg shadow-2xl p-2 w-80">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1 pb-1.5 border-b border-gray-800 mb-1.5">
              Навчальний сценарій — вибір ритму
            </div>
            <div className="grid grid-cols-2 gap-1">
              {RHYTHM_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => handleRhythmChange(opt.value)}
                  className={`text-left px-2.5 py-2 rounded text-[11px] font-medium transition-colors
                    ${rhythm===opt.value ? 'bg-gray-700 ring-1 ring-gray-500' : 'hover:bg-gray-800'}
                    ${opt.color}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main grid */}
      <div className="flex-1 p-3 grid grid-cols-12 gap-3 overflow-hidden min-h-0">

        {/* Waveforms col */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-2 overflow-y-auto min-h-0">

          {/* ЕКГ — зелена */}
          <WaveformCanvas
            buffer={ecgBuffer}
            color={ECG_COLOR}
            label="ЕКГ II ВІДВЕДЕННЯ"
            height={125}
            critical={isCritical}
          />

          {/* АТ — червона (як в атласі) */}
          <WaveformCanvas
            buffer={abpBuffer}
            color={ABP_COLOR}
            fillColor="rgba(239,68,68,0.07)"
            label="АРТЕРІАЛЬНИЙ ТИСК (АТ)"
            currentValue={isNoOutput ? '---' : currentBP}
            unit="mmHg"
            height={110}
            critical={isNoOutput}
          />

          {/* SpO2 — синя */}
          <WaveformCanvas
            buffer={spo2Buffer}
            color={SPO2_COLOR}
            fillColor="rgba(59,130,246,0.07)"
            label="SpO₂ ПЛЕТИЗМОГРАМА"
            currentValue={isNoOutput ? '--' : String(currentVitals.spo2)}
            unit="%"
            height={95}
            critical={currentVitals.spo2 < 90}
          />

          {/* Vital cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            <VitalCard label="ЧСС" value={hrDisplay} unit="bpm"
              color={rhythm==='vfib'?'#ef4444':rhythm==='asystole'?'#6b7280':ECG_COLOR}
              critical={isCritical} blink={isNoOutput} />
            <VitalCard label="АТ" value={isNoOutput?'---':currentBP} unit="mmHg"
              color={isNoOutput?'#6b7280':ABP_COLOR} critical={isNoOutput} />
            <VitalCard label="SpO₂" value={isNoOutput?'--':String(currentVitals.spo2)} unit="%"
              color={currentVitals.spo2<90?'#ef4444':SPO2_COLOR}
              critical={currentVitals.spo2<90} />
            <VitalCard label="Темп." value={String(currentVitals.temperature)} unit="°C"
              color={currentVitals.temperature>37.5?'#f59e0b':'#e5e7eb'} />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 overflow-y-auto min-h-0">

          {/* Rhythm info */}
          <div className={`rounded border p-3 ${isCritical?'bg-red-950/20 border-red-800/40':'bg-[#11141D] border-gray-800'}`}>
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">Діагноз ритму</div>
            <div className="font-bold text-sm leading-snug" style={{ color: rhythmColor }}>{RHYTHM_LABELS[rhythm]}</div>
            <RhythmHint rhythm={rhythm} />
          </div>

          {/* Meds */}
          <div className="bg-[#11141D] rounded border border-gray-800">
            <div className="p-2 border-b border-gray-800 bg-[#151923] text-[9px] font-bold text-gray-500 uppercase tracking-widest">
              Інфузії
            </div>
            <div className="p-3 space-y-2 text-[11px]">
              <FlowRow label="Норадреналін" value="0.05 мкг/кг/хв" />
              <FlowRow label="Фентаніл"     value="50 мкг/год" />
              <FlowRow label="Інсулін"      value="2.5 Од/год" />
              <div className="pt-2 border-t border-gray-800">
                <FlowRow label="Діурез" value="45 мл/год" subValue="(остання год.)" />
              </div>
            </div>
          </div>

          {/* O2 */}
          <div className="bg-[#11141D] rounded border border-gray-800">
            <div className="p-2 border-b border-gray-800 bg-[#151923] text-[9px] font-bold text-gray-500 uppercase tracking-widest">
              Кисень / Вентиляція
            </div>
            <div className="p-3 space-y-1.5 text-[11px]">
              <FlowRow label="FiO₂"  value="40%" />
              <FlowRow label="Режим" value="HFNC" />
              <FlowRow label="ЧД"    value={`${currentVitals.respiratoryRate} /хв`} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResuscitation && (
          <ResuscitationPanel rhythm={rhythm} onRhythmChange={handleRhythmChange}
            onClose={() => setShowResuscitation(false)} patientName={patient.name} />
        )}
        {showTamponade && (
          <TamponadeScenario
            patientName={patient.name}
            surgeryType={patient.surgeryType}
            onClose={() => setShowTamponade(false)}
          />
        )}
        {showHypotension && (
          <HypotensionScenario
            patientName={patient.name}
            surgeryType={patient.surgeryType}
            onClose={() => setShowHypotension(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ---- Підказка по ритму ----
const RhythmHint = ({ rhythm }: { rhythm: RhythmType }) => {
  const hints: Partial<Record<RhythmType, { text: string; color: string }>> = {
    vfib:               { text: '⚡ Дефібриляція показана негайно',         color: 'text-red-400' },
    asystole:           { text: '⚠️ СЛР + Адреналін 1 мг в/в',             color: 'text-gray-400' },
    vtach:              { text: '⚡ Кардіоверсія або Аміодарон 300 мг',     color: 'text-red-400' },
    av_block_3:         { text: '⚠️ Тимчасова кардіостимуляція',            color: 'text-orange-400' },
    av_block_2_mobitz2: { text: '⚠️ Ризик повної блокади — моніторинг',     color: 'text-orange-400' },
    av_block_2_mobitz1: { text: 'ℹ️ Венкебах — зазвичай оборотній',        color: 'text-yellow-400' },
    afib:               { text: 'ℹ️ Контроль ЧШС, антикоагуляція',         color: 'text-yellow-400' },
  };
  const hint = hints[rhythm];
  if (!hint) return null;
  return (
    <p className={`text-[10px] mt-1.5 font-medium ${hint.color}`}>{hint.text}</p>
  );
};

// ---- Sub-components ----
const VitalCard = ({ label, value, unit, color, critical=false, blink=false }: any) => (
  <div className={`p-2.5 rounded border bg-[#11141D] ${critical?'border-red-500/40 bg-red-950/15':'border-gray-800'}`}>
    <div className="text-[9px] font-bold uppercase text-gray-500 mb-1">{label}</div>
    <div className="flex items-baseline justify-between">
      <span className={`text-2xl font-mono font-bold ${blink?'animate-pulse':''}`} style={{ color }}>{value}</span>
      <span className="text-[9px] text-gray-600 uppercase">{unit}</span>
    </div>
  </div>
);

const FlowRow = ({ label, value, subValue }: any) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-500">{label}:</span>
    <div className="text-right">
      <span className="font-mono text-white">{value}</span>
      {subValue && <span className="block text-[8px] text-gray-600">{subValue}</span>}
    </div>
  </div>
);
