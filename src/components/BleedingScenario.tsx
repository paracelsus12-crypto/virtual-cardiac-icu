// BleedingScenario.tsx — Кровотеча після кардіохірургічної операції
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, CheckCircle, AlertTriangle, Droplets } from 'lucide-react';
import {
  BleedingType, BLEEDING_PROFILES, BLEEDING_TESTS, BLEEDING_ACTIONS,
  evaluateBleedingAction, getBleedingDebrief, BleedingProfile,
} from '../utils/bleedingEngine';
import { generateECGBuffer, generateABPBuffer } from '../utils/ecgGenerator';
import WaveformCanvas from './WaveformCanvas';
import { startAlarm, stopAlarm, playBeep, resumeAudioContext } from '../utils/audioEngine';
import { Lang } from '../utils/i18n';

interface BleedingScenarioProps {
  patientName?: string;
  surgeryType?: string;
  speed?: number;
  lang?: Lang;
  onClose: () => void;
}

interface LogEntry {
  time: number;
  message: string;
  hint?: string;
  penalty?: string;
  type: 'info' | 'good' | 'warn' | 'bad';
}

// Вибір типу кровотечі на основі хірургії або випадково
const pickBleedingType = (surgeryType: string): BleedingType => {
  const lower = surgeryType.toLowerCase();
  if (lower.includes('акш') || lower.includes('cabg') || lower.includes('аортокорон')) return 'heparin';
  if (lower.includes('клапан') || lower.includes('valve') || lower.includes('мк') || lower.includes('ак')) return 'coagulopathy';
  if (lower.includes('аневризм') || lower.includes('аорт') || lower.includes('aneurysm')) return 'surgical';
  const types: BleedingType[] = ['heparin', 'coagulopathy', 'surgical'];
  return types[Math.floor(Math.random() * types.length)];
};

const BleedingScenario: React.FC<BleedingScenarioProps> = ({
  patientName = '', surgeryType = '', speed = 1.0, lang = 'ua', onClose,
}) => {
  const ua = lang === 'ua';
  const [bleedingType] = useState<BleedingType>(() => pickBleedingType(surgeryType));
  const profile = BLEEDING_PROFILES[bleedingType];

  const [isStarted, setIsStarted]             = useState(false);
  const [timeMin, setTimeMin]                 = useState(0);
  const [currentDrain, setCurrentDrain]       = useState(profile.drainOutput);
  const [currentSystolic, setCurrentSystolic] = useState(108);
  const [currentHR, setCurrentHR]             = useState(92);
  const [testsPerformed, setTestsPerformed]   = useState<string[]>([]);
  const [revealedTests, setRevealedTests]     = useState<Set<string>>(new Set());
  const [actionHistory, setActionHistory]     = useState<string[]>([]);
  const [surgeonCalled, setSurgeonCalled]     = useState(false);
  const [log, setLog]                         = useState<LogEntry[]>([]);
  const [cooldowns, setCooldowns]             = useState<Record<string, number>>({});
  const [isCured, setIsCured]                 = useState(false);
  const [isArrested, setIsArrested]           = useState(false);
  const [showDebrief, setShowDebrief]         = useState(false);
  const [ecgBuffer, setEcgBuffer]             = useState<number[]>([]);
  const [abpBuffer, setAbpBuffer]             = useState<number[]>([]);
  const waveTimeRef = useRef(0);
  const drainRef = useRef(currentDrain);
  drainRef.current = currentDrain;

  // Прогресія
  useEffect(() => {
    if (!isStarted || isCured || isArrested) return;
    const id = window.setInterval(() => {
      setTimeMin(t => +(t + 0.1).toFixed(2));
      setCurrentDrain(d => {
        const next = d + profile.drainIncreasePerMin * 0.1 * speed;
        return Math.round(Math.min(600, next));
      });
      setCurrentSystolic(s => {
        const next = s - profile.bpDeclinePerMin * 0.1 * speed;
        if (next <= 50) { setIsArrested(true); return 50; }
        return Math.round(next);
      });
      setCurrentHR(h => Math.min(160, Math.round(h + profile.hrIncreasePerMin * 0.1 * speed)));
    }, 600);
    return () => clearInterval(id);
  }, [isStarted, isCured, isArrested, profile, speed]);

  // Cooldowns
  useEffect(() => {
    const id = window.setInterval(() => {
      setCooldowns(prev => {
        const u = { ...prev };
        Object.keys(u).forEach(k => { if (u[k] > 0) u[k]--; });
        return u;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Alarm
  useEffect(() => {
    if (!isStarted) return;
    if (currentDrain > 400 || currentSystolic < 70) startAlarm('critical');
    else if (currentDrain > 250 || currentSystolic < 90) startAlarm('warning');
    else stopAlarm();
    return () => stopAlarm();
  }, [currentDrain, currentSystolic, isStarted]);

  // Waveforms
  useEffect(() => {
    const id = window.setInterval(() => {
      const dur = 0.06;
      const t0  = waveTimeRef.current;
      waveTimeRef.current += dur;
      const hr  = Math.max(1, currentHR);
      const sys = Math.max(40, currentSystolic);
      const dia = Math.round(sys * 0.62);
      const ecg = generateECGBuffer('sinus', hr, dur, 250, 1.0, t0);
      const abp = generateABPBuffer(hr, sys, dia, dur, 250, 'sinus', t0);
      setEcgBuffer(prev => [...prev, ...ecg].slice(-1000));
      setAbpBuffer(prev => [...prev, ...abp].slice(-1000));
    }, 60);
    return () => clearInterval(id);
  }, [currentHR, currentSystolic]);

  const fmt = (min: number) => {
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const handleTest = (testId: string) => {
    if ((cooldowns[testId] || 0) > 0 || revealedTests.has(testId)) return;
    resumeAudioContext();
    const test = BLEEDING_TESTS.find(t => t.id === testId)!;
    setCooldowns(prev => ({ ...prev, [testId]: test.cooldown }));
    setRevealedTests(prev => new Set([...prev, testId]));
    setTestsPerformed(prev => [...prev, testId]);

    // Generate result text based on profile
    let resultText = '';
    switch (testId) {
      case 'drain':
        resultText = ua
          ? `Дренаж: ${profile.drainOutput} мл/год ⚠️ (критично >200 мл/год)`
          : `Drain: ${profile.drainOutput} ml/hr ⚠️ (critical >200 ml/hr)`;
        break;
      case 'act':
        resultText = ua
          ? `АЧЗ = ${profile.act} сек ${profile.act > 140 ? '↑↑ (норма <140) — ГЕПАРИН!' : '(норма)'}`
          : `ACT = ${profile.act} sec ${profile.act > 140 ? '↑↑ (normal <140) — HEPARIN!' : '(normal)'}`;
        break;
      case 'aptt':
        resultText = ua
          ? `АЧТЧ = ${profile.aptt} сек ${profile.aptt > 45 ? '↑↑ (норма 25-35) — коагулопатія/гепарин' : '(норма)'}`
          : `aPTT = ${profile.aptt} sec ${profile.aptt > 45 ? '↑↑ (normal 25-35) — coagulopathy/heparin' : '(normal)'}`;
        break;
      case 'coag':
        resultText = ua
          ? `МНО ${profile.inr} ${profile.inr > 1.5 ? '↑' : ''} | Фібриноген ${profile.fibrinogen} г/л ${profile.fibrinogen < 1.5 ? '↓↓' : ''} | Тромбоцити ${profile.platelets}×10⁹/л ${profile.platelets < 80 ? '↓↓' : ''}`
          : `INR ${profile.inr} ${profile.inr > 1.5 ? '↑' : ''} | Fibrinogen ${profile.fibrinogen} g/L ${profile.fibrinogen < 1.5 ? '↓↓' : ''} | Platelets ${profile.platelets}×10⁹/L ${profile.platelets < 80 ? '↓↓' : ''}`;
        break;
      case 'hb':
        resultText = ua
          ? `Hb = ${profile.hb} г/л ↓ | Ht = ${Math.round(profile.hb * 0.3)}%`
          : `Hb = ${profile.hb} g/L ↓ | Ht = ${Math.round(profile.hb * 0.3)}%`;
        break;
      case 'echo':
        resultText = ua
          ? `ЕхоКС: тампонади немає. ФВ ${bleedingType === 'coagulopathy' ? '42%' : '55%'}. Невелика кількість рідини в перикарді.`
          : `Echo: no tamponade. EF ${bleedingType === 'coagulopathy' ? '42%' : '55%'}. Small amount of pericardial fluid.`;
        break;
      case 'teg':
        resultText = ua
          ? `ТЕГ: MA=${profile.tegMA}мм ${profile.tegMA < 45 ? '↓↓' : ''} | K=${profile.tegK}хв ${profile.tegK > 4 ? '↑↑' : ''} | α=${profile.tegAlpha}° ${profile.tegAlpha < 35 ? '↓↓' : ''}`
          : `TEG: MA=${profile.tegMA}mm ${profile.tegMA < 45 ? '↓↓' : ''} | K=${profile.tegK}min ${profile.tegK > 4 ? '↑↑' : ''} | α=${profile.tegAlpha}° ${profile.tegAlpha < 35 ? '↓↓' : ''}`;
        break;
    }
    setLog(prev => [{ time: timeMin, message: `${test.icon} ${ua ? test.label.ua : test.label.en}: ${resultText}`, type: 'info' }, ...prev]);
    playBeep(770, 0.1, 0.2);
  };

  const handleAction = (actionId: string) => {
    if ((cooldowns[actionId] || 0) > 0) return;
    resumeAudioContext();
    const action = BLEEDING_ACTIONS.find(a => a.id === actionId)!;

    if (actionId === 'reexploration' && !surgeonCalled) {
      setLog(prev => [{
        time: timeMin,
        message: ua ? '❌ Реексплорація потребує хірурга. Спочатку викличте хірурга.' : '❌ Re-exploration requires surgeon. Call surgeon first.',
        type: 'bad',
      }, ...prev]);
      playBeep(330, 0.15, 0.3);
      return;
    }

    setCooldowns(prev => ({ ...prev, [actionId]: action.cooldown }));

    if (actionId === 'surgeon') setSurgeonCalled(true);

    const result = evaluateBleedingAction(
      actionId, bleedingType, profile, testsPerformed, actionHistory, surgeonCalled,
    );
    setActionHistory(prev => [...prev, actionId]);

    const msg = ua ? result.message.ua : result.message.en;
    const hint = result.hint ? (ua ? result.hint.ua : result.hint.en) : undefined;
    const penalty = result.penaltyNote ? (ua ? result.penaltyNote.ua : result.penaltyNote.en) : undefined;

    setLog(prev => [{
      time: timeMin,
      message: msg,
      hint,
      penalty,
      type: result.isCausal ? 'good' : result.drainReduction > 0 ? 'warn' : 'bad',
    }, ...prev]);

    if (result.drainReduction > 0) {
      setCurrentDrain(d => Math.max(0, d - result.drainReduction));
    }

    if (result.isCure) {
      setIsCured(true);
      stopAlarm();
      setTimeout(() => setShowDebrief(true), 2500);
    }

    playBeep(result.isCausal ? 660 : result.drainReduction > 0 ? 550 : 330, 0.12, 0.25);
  };

  // Debrief
  if (showDebrief) {
    const debrief = getBleedingDebrief(
      bleedingType, profile, testsPerformed, actionHistory,
      isCured, timeMin, surgeonCalled, lang as Lang,
    );
    return (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/92">
        <div className="w-full max-w-lg bg-[#0d0f14] border border-green-800/50 rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="text-green-400 shrink-0" size={24}/>
            <div>
              <h2 className="text-white font-bold">
                {ua ? 'Дебрифінг: Кровотеча після операції' : 'Debrief: Post-operative Bleeding'}
              </h2>
              <p className="text-gray-500 text-xs">{profile.patient[lang]} · {fmt(timeMin)}</p>
            </div>
          </div>

          {/* Тип кровотечі */}
          <div className="mb-3 p-3 rounded border bg-gray-900 border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              {ua ? 'Правильний діагноз' : 'Correct Diagnosis'}
            </p>
            <p className="font-bold text-red-400">{profile.label[lang]}</p>
            <p className="text-[11px] text-gray-400 mt-1">{profile.mechanism[lang]}</p>
          </div>

          {/* Чек-ліст */}
          <div className="space-y-1.5 mb-4">
            {debrief.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={item.ok ? 'text-green-400 shrink-0' : 'text-red-400 shrink-0'}>
                  {item.ok ? '✅' : '❌'}
                </span>
                <span className={item.ok ? 'text-gray-300' : 'text-gray-500'}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Key Points */}
          <div className="bg-gray-900 rounded p-3 mb-4 space-y-1 text-[11px]">
            <p className="font-bold text-white text-xs mb-1">
              {ua ? 'Ключові точки:' : 'Key Points:'}
            </p>
            {debrief.keyPoints.map((p, i) => <p key={i} className="text-gray-300">• {p}</p>)}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">
              {ua ? 'Оцінка' : 'Score'}: <span className="text-white font-bold">{debrief.score}/{debrief.total}</span>
            </span>
            <button onClick={onClose}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded">
              {ua ? 'Завершити' : 'Finish'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const drainColor = currentDrain > 400 ? '#ef4444' : currentDrain > 200 ? '#f97316' : '#22c55e';
  const bpColor    = currentSystolic < 70 ? '#ef4444' : currentSystolic < 90 ? '#f97316' : '#ef4444';

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200] bg-black/96 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-red-900/40 bg-red-950/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Droplets size={16} className="text-red-400 animate-pulse shrink-0"/>
          <div>
            <span className="font-bold text-white text-sm">
              {ua ? 'КРОВОТЕЧА ПІСЛЯ ОПЕРАЦІЇ' : 'POST-OPERATIVE BLEEDING'}
            </span>
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border font-bold text-red-400 border-red-700/50 bg-red-950/20">
              {ua ? `Дренаж: ${currentDrain} мл/год` : `Drain: ${currentDrain} ml/hr`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isStarted ? (
            <button onClick={() => { resumeAudioContext(); setIsStarted(true); }}
              className="px-4 py-1 rounded font-bold text-xs animate-pulse"
              style={{ background:'#005500', color:'#44ff88', border:'1px solid #008800' }}>
              ▶ {ua ? 'СТАРТ' : 'START'}
            </button>
          ) : (
            <div className="flex items-center gap-1 font-mono text-sm">
              <Clock size={13} className="text-gray-500"/>
              <span className={timeMin > 10 ? 'text-red-400 font-bold' : 'text-white'}>{fmt(timeMin)}</span>
            </div>
          )}
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-gray-500">
            <X size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT */}
        <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto min-w-0">

          <WaveformCanvas buffer={ecgBuffer} color="#22c55e" label="ECG II" height={95}/>
          <WaveformCanvas buffer={abpBuffer} color="#ef4444" fillColor="rgba(239,68,68,0.07)"
            label="ABP" currentValue={`${currentSystolic}/${Math.round(currentSystolic*0.62)}`}
            unit="mmHg" height={85} critical={currentSystolic < 80}/>

          {/* Vital cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NumCard label={ua ? 'Дренаж' : 'Drain'} value={String(currentDrain)} unit={ua ? 'мл/год' : 'ml/hr'} color={drainColor} warn={currentDrain > 200}/>
            <NumCard label={ua ? 'АТ сист.' : 'SBP'} value={String(currentSystolic)} unit="mmHg" color={bpColor} warn={currentSystolic < 90}/>
            <NumCard label={ua ? 'ЧСС' : 'HR'} value={String(currentHR)} unit="bpm" color={currentHR > 110 ? '#f59e0b' : '#22c55e'} warn={currentHR > 110}/>
            <NumCard label="Hb" value={String(profile.hb)} unit="г/л" color={profile.hb < 80 ? '#ef4444' : '#cccccc'} warn={profile.hb < 80}/>
          </div>

          {/* Revealed tests */}
          {revealedTests.size > 0 && (
            <div className="bg-[#0f1520] rounded border border-blue-900/40 p-3">
              <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                {ua ? 'Результати обстежень' : 'Test Results'}
              </div>
              <div className="space-y-1 text-[11px]">
                {revealedTests.has('act') && (
                  <LabRow label="ACT" value={`${profile.act} сек`} abnormal={profile.act > 140}/>
                )}
                {revealedTests.has('aptt') && (
                  <LabRow label="aPTT" value={`${profile.aptt} сек`} abnormal={profile.aptt > 45}/>
                )}
                {revealedTests.has('coag') && (<>
                  <LabRow label="INR" value={String(profile.inr)} abnormal={profile.inr > 1.5}/>
                  <LabRow label={ua ? 'Фібриноген' : 'Fibrinogen'} value={`${profile.fibrinogen} г/л`} abnormal={profile.fibrinogen < 1.5}/>
                  <LabRow label={ua ? 'Тромбоцити' : 'Platelets'} value={`${profile.platelets}×10⁹/л`} abnormal={profile.platelets < 80}/>
                </>)}
                {revealedTests.has('teg') && (<>
                  <LabRow label="TEG MA" value={`${profile.tegMA} мм`} abnormal={profile.tegMA < 45}/>
                  <LabRow label="TEG K" value={`${profile.tegK} хв`} abnormal={profile.tegK > 4}/>
                  <LabRow label="TEG α" value={`${profile.tegAlpha}°`} abnormal={profile.tegAlpha < 35}/>
                </>)}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="w-72 shrink-0 flex flex-col border-l border-gray-800 overflow-hidden">

          {/* Tests */}
          <div className="p-3 border-b border-gray-800">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              {ua ? '1. Діагностика' : '1. Diagnostics'}
            </div>
            <div className="space-y-1.5">
              {BLEEDING_TESTS.map(test => {
                const done = revealedTests.has(test.id);
                const cd   = cooldowns[test.id] || 0;
                return (
                  <button key={test.id} onClick={() => handleTest(test.id)}
                    disabled={done || cd > 0}
                    className={`w-full text-left p-2 rounded border text-xs transition-all
                      ${done ? 'opacity-35 bg-gray-900 border-gray-700 cursor-default' :
                        cd > 0 ? 'opacity-50 bg-gray-900 border-gray-700' :
                        'bg-gray-800 hover:bg-gray-700 border-gray-600 text-white'}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{test.icon}</span>
                      <span className="font-medium">{ua ? test.label.ua : test.label.en}</span>
                      {test.isOptional && <span className="ml-auto text-[8px] text-gray-500 uppercase">opt</span>}
                      {done && <span className="ml-auto text-green-400">✓</span>}
                      {cd > 0 && <span className="ml-auto font-mono text-[10px]">{cd}s</span>}
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5 pl-5">{ua ? test.description.ua : test.description.en}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              {ua ? '2. Лікування' : '2. Treatment'}
            </div>
            <div className="space-y-1.5">
              {BLEEDING_ACTIONS.map(action => {
                const cd   = cooldowns[action.id] || 0;
                const done = action.id === 'surgeon' && surgeonCalled;
                return (
                  <button key={action.id} onClick={() => handleAction(action.id)}
                    disabled={cd > 0 || done}
                    className={`w-full text-left p-2.5 rounded border text-white transition-all
                      ${done ? 'opacity-35 bg-gray-900 border-gray-700 cursor-default' :
                        cd > 0 ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-700' :
                        action.color}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{action.icon}</span>
                      <span className="font-bold text-xs">{ua ? action.label.ua : action.label.en}</span>
                      {action.isPrimary && !done && (
                        <span className="ml-auto text-[8px] font-bold text-white/70 uppercase bg-white/10 px-1 rounded">
                          {ua ? 'ОСНОВНА' : 'PRIMARY'}
                        </span>
                      )}
                      {done && <span className="ml-auto text-green-400 text-[10px]">✓</span>}
                      {cd > 0 && <span className="ml-auto font-mono text-[10px] opacity-60">{cd}s</span>}
                    </div>
                    <p className="text-[9px] opacity-55 mt-0.5 pl-5">{ua ? action.description.ua : action.description.en}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Log */}
          <div className="border-t border-gray-800 max-h-44 overflow-y-auto">
            <div className="px-3 py-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-widest bg-[#0d0f14] sticky top-0">
              {ua ? 'Журнал' : 'Log'}
            </div>
            {log.length === 0 && (
              <p className="text-[10px] text-gray-600 text-center p-3">
                {ua ? 'Дій ще не виконувалось' : 'No actions yet'}
              </p>
            )}
            {log.map((e, i) => (
              <div key={i} className={`px-3 py-1.5 border-b border-gray-900/60 text-[10px]
                ${e.type === 'bad' ? 'bg-red-950/15' : e.type === 'good' ? 'bg-green-950/10' : ''}`}>
                <div className="flex gap-2">
                  <span className="font-mono text-gray-600 shrink-0">{fmt(e.time)}</span>
                  <span className="text-gray-300 leading-snug">{e.message}</span>
                </div>
                {e.hint && <p className="text-[9px] text-blue-400 mt-0.5 pl-8 italic">{e.hint}</p>}
                {e.penalty && <p className="text-[9px] text-red-400 mt-0.5 pl-8">⚠ {e.penalty}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Arrest overlay */}
      <AnimatePresence>
        {isArrested && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="absolute inset-0 bg-black/85 flex items-center justify-center z-50">
            <div className="text-center px-6">
              <p className="text-red-500 font-bold text-2xl animate-pulse mb-2">
                {ua ? 'ГЕМОРАГІЧНИЙ ШОК' : 'HEMORRHAGIC SHOCK'}
              </p>
              <p className="text-gray-400 text-sm mb-5">
                {ua ? 'Кровотеча не була зупинена вчасно.' : 'Bleeding was not stopped in time.'}
              </p>
              <button onClick={() => setShowDebrief(true)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded">
                {ua ? 'Дебрифінг' : 'Debrief'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const NumCard = ({ label, value, unit, color, warn }: any) => (
  <div className={`p-2 rounded border bg-[#11141D] ${warn ? 'border-red-500/40' : 'border-gray-800'}`}>
    <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">{label}</div>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-mono font-bold" style={{ color }}>{value}</span>
      <span className="text-[9px] text-gray-600">{unit}</span>
    </div>
  </div>
);

const LabRow = ({ label, value, abnormal }: { label: string; value: string; abnormal: boolean }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-500">{label}:</span>
    <span className={`font-mono font-bold ${abnormal ? 'text-red-400' : 'text-green-400'}`}>
      {value} {abnormal ? '⚠' : '✓'}
    </span>
  </div>
);

export default BleedingScenario;
