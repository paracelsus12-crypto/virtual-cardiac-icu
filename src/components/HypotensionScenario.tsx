// HypotensionScenario.tsx — диференційна діагностика гіпотензії
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import {
  ShockType, SHOCK_PROFILES, DIAGNOSTIC_TESTS, TREATMENT_ACTIONS,
  evaluateTreatment, getHypotensionDebrief,
} from '../utils/hypotensionEngine';
import { generateECGBuffer, generateABPBuffer, RhythmType } from '../utils/ecgGenerator';
import WaveformCanvas from './WaveformCanvas';
import { startAlarm, stopAlarm, playBeep, resumeAudioContext } from '../utils/audioEngine';

interface HypotensionScenarioProps {
  patientName: string;
  surgeryType: string;
  onClose: () => void;
}

interface LogEntry {
  time: number;
  message: string;
  hint?: string;
  penalty?: string;
  type: 'info' | 'good' | 'warn' | 'bad';
}

// Випадковий або детермінований вибір типу шоку
const pickShockType = (surgeryType: string): ShockType => {
  const lower = surgeryType.toLowerCase();
  const hasCPB = ['акш', 'аортокорон', 'клапан', 'аорт', 'протез', 'штучний кровообіг', 'шк'].some(k => lower.includes(k));
  const pool: ShockType[] = hasCPB
    ? ['hypovolemic', 'cardiogenic', 'distributive_vasoplegia', 'obstructive', 'distributive_sepsis']
    : ['hypovolemic', 'cardiogenic', 'distributive_sepsis', 'obstructive'];
  return pool[Math.floor(Math.random() * pool.length)];
};

const HypotensionScenario: React.FC<HypotensionScenarioProps> = ({
  patientName, surgeryType, onClose,
}) => {
  const [shockType] = useState<ShockType>(() => pickShockType(surgeryType));
  const profile = SHOCK_PROFILES[shockType];

  const [timeMin, setTimeMin]               = useState(0);
  const [currentSystolic, setCurrentSystolic] = useState(profile.initialSystolic);
  const [currentHR, setCurrentHR]           = useState(profile.initialHR);
  const [currentUO, setCurrentUO]           = useState(profile.initialUO);
  const [revealedTests, setRevealedTests]   = useState<Set<string>>(new Set());
  const [diagnosisGuess, setDiagnosisGuess] = useState<ShockType | null>(null);
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(false);
  const [treatmentHistory, setTreatmentHistory]     = useState<string[]>([]);
  const [testsPerformed, setTestsPerformed]          = useState<string[]>([]);
  const [penaltyActions, setPenaltyActions]          = useState<string[]>([]);
  const [log, setLog]                       = useState<LogEntry[]>([]);
  const [cooldowns, setCooldowns]           = useState<Record<string, number>>({});
  const [isCured, setIsCured]               = useState(false);
  const [isArrested, setIsArrested]         = useState(false);
  const [showDebrief, setShowDebrief]       = useState(false);
  const [showDiagnosisPanel, setShowDiagnosisPanel] = useState(false);
  const [ecgBuffer, setEcgBuffer]           = useState<number[]>([]);
  const [abpBuffer, setAbpBuffer]           = useState<number[]>([]);
  const waveTimeRef = useRef(0);
  const systolicRef = useRef(currentSystolic);
  systolicRef.current = currentSystolic;

  // Прогресія без лікування
  useEffect(() => {
    if (isCured || isArrested) return;
    const id = window.setInterval(() => {
      setTimeMin(t => +(t + 0.1).toFixed(2));
      setCurrentSystolic(s => {
        const next = s - profile.bpDeclinePerMin * 0.1;
        if (next <= 40) { setIsArrested(true); return 40; }
        return Math.round(next);
      });
      setCurrentHR(h => Math.min(160, Math.round(h + profile.hrIncreasePerMin * 0.1)));
      setCurrentUO(u => Math.max(0, Math.round(u - 0.3)));
    }, 600);
    return () => clearInterval(id);
  }, [isCured, isArrested, profile]);

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

  // Тривога
  useEffect(() => {
    if (currentSystolic < 60) startAlarm('critical');
    else if (currentSystolic < 80) startAlarm('warning');
    else stopAlarm();
    return () => stopAlarm();
  }, [currentSystolic]);

  // Криві
  useEffect(() => {
    const id = window.setInterval(() => {
      const dur = 0.06;
      const t0  = waveTimeRef.current;
      waveTimeRef.current += dur;
      const hr  = Math.max(1, currentHR);
      const sys = Math.max(30, currentSystolic);
      const dia = Math.round(sys * 0.65);

      // ЕКГ — ST-депресія при кардіогенному
      const ecgRhythm: RhythmType = shockType === 'cardiogenic' ? 'sinus' : 'sinus';
      const ecg = generateECGBuffer(ecgRhythm, hr, dur, 250, 1.0, t0).map(v => {
        if (shockType === 'cardiogenic') return v - 0.08; // ST-депресія
        return v;
      });
      const abp = generateABPBuffer(hr, sys, dia, dur, 250, 'sinus', t0);

      setEcgBuffer(prev => [...prev, ...ecg].slice(-1000));
      setAbpBuffer(prev => [...prev, ...abp].slice(-1000));
    }, 60);
    return () => clearInterval(id);
  }, [currentHR, currentSystolic, shockType]);

  const fmt = (min: number) => {
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // Діагностичний тест
  const handleTest = (testId: string) => {
    if ((cooldowns[testId] || 0) > 0 || revealedTests.has(testId)) return;
    resumeAudioContext();
    const test = DIAGNOSTIC_TESTS.find(t => t.id === testId)!;
    const result = test.revealsFor[shockType] ?? 'Без відхилень';
    setCooldowns(prev => ({ ...prev, [testId]: test.cooldown }));
    setRevealedTests(prev => new Set([...prev, testId]));
    setTestsPerformed(prev => [...prev, testId]);
    setLog(prev => [{ time: timeMin, message: `${test.icon} ${test.label}: ${result}`, type: 'info' }, ...prev]);
    playBeep(770, 0.1, 0.2);
  };

  // Встановлення діагнозу
  const handleDiagnosis = (guess: ShockType) => {
    setDiagnosisGuess(guess);
    setShowDiagnosisPanel(false);
    if (guess === shockType) {
      setDiagnosisConfirmed(true);
      setLog(prev => [{
        time: timeMin,
        message: `✅ Діагноз підтверджено: ${SHOCK_PROFILES[guess].label}`,
        hint: SHOCK_PROFILES[guess].ddxClue,
        type: 'good',
      }, ...prev]);
      playBeep(880, 0.15, 0.3);
    } else {
      setLog(prev => [{
        time: timeMin,
        message: `❌ Невірний діагноз: ${SHOCK_PROFILES[guess].label}. Подивіться на ${revealedTests.has('cvp') ? 'ЦВТ та ' : ''}інші маркери уважніше.`,
        hint: SHOCK_PROFILES[guess].trapClue,
        type: 'bad',
      }, ...prev]);
      playBeep(330, 0.15, 0.3);
    }
  };

  // Лікування
  const handleTreatment = (actionId: string) => {
    if ((cooldowns[actionId] || 0) > 0) return;
    resumeAudioContext();
    const action = TREATMENT_ACTIONS.find(a => a.id === actionId)!;
    setCooldowns(prev => ({ ...prev, [actionId]: action.cooldown }));
    setTreatmentHistory(prev => [...prev, actionId]);

    const result = evaluateTreatment(actionId, shockType, diagnosisConfirmed, treatmentHistory);

    if (result.penaltyNote) setPenaltyActions(prev => [...prev, result.penaltyNote!]);

    setCurrentSystolic(s => Math.min(130, Math.max(30, s + result.bpChange)));
    setLog(prev => [{
      time: timeMin,
      message: result.message,
      hint: result.hint,
      penalty: result.penaltyNote,
      type: result.bpChange > 10 ? 'good' : result.bpChange > 0 ? 'warn' : 'bad',
    }, ...prev]);

    if (result.isCausal && result.bpChange > 10 && currentSystolic + result.bpChange >= 95) {
      setIsCured(true);
      stopAlarm();
      setTimeout(() => setShowDebrief(true), 2000);
    }

    playBeep(result.bpChange > 0 ? 660 : 330, 0.12, 0.25);
  };

  // ---- ДЕБРИФІНГ ----
  if (showDebrief) {
    const debrief = getHypotensionDebrief(
      shockType, diagnosisConfirmed, testsPerformed,
      treatmentHistory, isCured, timeMin, penaltyActions,
    );
    return (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/92">
        <div className="w-full max-w-lg bg-[#0d0f14] border border-green-800/50 rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="text-green-400 shrink-0" size={24} />
            <div>
              <h2 className="text-white font-bold">Дебрифінг: Диференційна діагностика гіпотензії</h2>
              <p className="text-gray-500 text-xs">{patientName} · {fmt(timeMin)}</p>
            </div>
          </div>

          {/* Відповідь */}
          <div className="mb-3 p-3 rounded border bg-gray-900 border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Правильний діагноз</p>
            <p className="font-bold text-sm" style={{ color: profile.color }}>{profile.label}</p>
            <p className="text-[11px] text-gray-400 mt-1">{profile.mechanism}</p>
          </div>

          {/* Чек-ліст */}
          <div className="space-y-1.5 mb-4">
            {debrief.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={item.ok ? 'text-green-400 shrink-0' : 'text-red-400 shrink-0'}>{item.ok ? '✅' : '❌'}</span>
                <span className={item.ok ? 'text-gray-300' : 'text-gray-500'}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Ключові точки */}
          <div className="bg-gray-900 rounded p-3 mb-4 space-y-1 text-[11px]">
            <p className="font-bold text-white text-xs mb-1">Ключові точки:</p>
            {debrief.keyPoints.map((p, i) => <p key={i} className="text-gray-300">• {p}</p>)}
            {penaltyActions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <p className="text-red-400 font-bold text-[10px]">Штрафні дії:</p>
                {penaltyActions.map((p, i) => <p key={i} className="text-red-300 text-[10px]">— {p}</p>)}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Оцінка: <span className="text-white font-bold">{debrief.score}/{debrief.total}</span></span>
            <button onClick={onClose} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded">
              Завершити
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const bpColor = currentSystolic < 60 ? '#ef4444' : currentSystolic < 80 ? '#f97316' : '#f59e0b';

  // ---- ОСНОВНИЙ ЕКРАН ----
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200] bg-black/96 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-orange-900/40 bg-orange-950/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange-400 animate-pulse shrink-0" />
          <div>
            <span className="font-bold text-white text-sm">ГІПОТЕНЗІЯ — ДИФЕРЕНЦІЙНА ДІАГНОСТИКА</span>
            <span className="ml-2 text-[10px] bg-orange-900/30 text-orange-300 border border-orange-800/40 px-1.5 py-0.5 rounded">
              АТ {currentSystolic} мм рт.ст.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-sm">
            <Clock size={13} className="text-gray-500" />
            <span className={timeMin > 10 ? 'text-red-400 font-bold' : 'text-white'}>{fmt(timeMin)}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-gray-500"><X size={16}/></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT — монітор */}
        <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto min-w-0">

          {/* Криві */}
          <WaveformCanvas buffer={ecgBuffer} color="#22c55e"
            label={shockType === 'cardiogenic' ? 'ЕКГ — ST-депресія V4-V6 ⚠️' : 'ЕКГ II'}
            height={100} critical={shockType === 'cardiogenic'} />
          <WaveformCanvas buffer={abpBuffer} color="#ef4444" fillColor="rgba(239,68,68,0.07)"
            label="АТ" currentValue={`${currentSystolic}/${Math.round(currentSystolic*0.65)}`}
            unit="mmHg" height={90} critical={currentSystolic < 70} />

          {/* Видимі показники (маска — завжди видно) */}
          <div className="bg-[#11141D] rounded border border-gray-800 p-3">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Монітор — видимі показники
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumCard label="АТ сист." value={String(currentSystolic)} unit="mmHg" color={bpColor} warn={currentSystolic < 90} />
              <NumCard label="ЧСС" value={String(currentHR)} unit="bpm" color={currentHR > 120 ? '#f59e0b' : '#22c55e'} warn={currentHR > 120} />
              <NumCard label="Діурез" value={String(currentUO)} unit="мл/год" color={currentUO < 20 ? '#ef4444' : '#22c55e'} warn={currentUO < 20} />
            </div>
          </div>

          {/* Розкриті дані */}
          {revealedTests.size > 0 && (
            <div className="bg-[#0f1520] rounded border border-blue-900/40 p-3">
              <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                Результати обстежень
              </div>
              <div className="space-y-1">
                {revealedTests.has('cvp') && (
                  <RevealedRow icon="📊" label="ЦВТ" value={`${profile.cvp} мм рт.ст.`}
                    status={profile.cvp < 6 ? 'low' : profile.cvp > 15 ? 'high' : 'normal'} />
                )}
                {revealedTests.has('skin_temp') && (
                  <RevealedRow icon="🌡️" label="Температура шкіри"
                    value={profile.skinTemp === 'warm' ? 'Тепла, рожева' : 'Холодна, бліда'}
                    status={profile.skinTemp === 'warm' ? 'warm' : 'cold'} />
                )}
                {revealedTests.has('lactate') && (
                  <RevealedRow icon="🧪" label="Лактат"
                    value={`${profile.lactate} ммоль/л`}
                    status={profile.lactate > 4 ? 'high' : profile.lactate > 2 ? 'mid' : 'normal'} />
                )}
                {revealedTests.has('echo') && (
                  <RevealedRow icon="🔵" label="ЕхоКС"
                    value={profile.ef ? `ФВ ${profile.ef}%` : 'ФВ норм.'}
                    status={profile.ef && profile.ef < 35 ? 'high' : 'normal'} />
                )}
                {revealedTests.has('plr') && (
                  <RevealedRow icon="🦵" label="PLR-тест"
                    value={['hypovolemic'].includes(shockType) ? '✅ ПОЗИТИВНИЙ' : '❌ НЕГАТИВНИЙ'}
                    status={['hypovolemic'].includes(shockType) ? 'normal' : 'high'} />
                )}
              </div>
            </div>
          )}

          {/* Встановлений діагноз */}
          {diagnosisGuess && (
            <div className={`rounded border p-3 ${diagnosisConfirmed ? 'bg-green-950/20 border-green-700/40' : 'bg-red-950/20 border-red-700/40'}`}>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-1 text-gray-500">Діагноз інтерна</div>
              <p className={`text-sm font-bold ${diagnosisConfirmed ? 'text-green-400' : 'text-red-400'}`}>
                {diagnosisConfirmed ? '✅ ' : '❌ '}{SHOCK_PROFILES[diagnosisGuess].label}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — дії */}
        <div className="w-72 shrink-0 flex flex-col border-l border-gray-800 overflow-hidden">

          {/* Діагностика */}
          <div className="p-3 border-b border-gray-800">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              1. Діагностика
            </div>
            <div className="space-y-1.5">
              {DIAGNOSTIC_TESTS.map(test => {
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
                      <span className="font-medium">{test.label}</span>
                      {done && <span className="ml-auto text-green-400 text-[10px]">✓</span>}
                      {cd > 0 && <span className="ml-auto font-mono text-[10px]">{cd}s</span>}
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5 pl-5">{test.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Встановити діагноз */}
          <div className="p-3 border-b border-gray-800">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              2. Встановити діагноз
            </div>
            <button onClick={() => setShowDiagnosisPanel(s => !s)}
              className={`w-full p-2 rounded border text-xs font-bold transition-all flex items-center gap-2
                ${diagnosisConfirmed ? 'bg-green-900/30 border-green-700/50 text-green-400' :
                  diagnosisGuess ? 'bg-red-900/20 border-red-700/40 text-red-400' :
                  'bg-indigo-700 hover:bg-indigo-600 border-indigo-500 text-white'}`}>
              <HelpCircle size={13}/>
              {diagnosisConfirmed ? `✅ ${SHOCK_PROFILES[shockType].labelShort}` :
               diagnosisGuess ? '❌ Спробуйте ще' : 'Встановити діагноз'}
            </button>

            <AnimatePresence>
              {showDiagnosisPanel && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="mt-1.5 space-y-1 overflow-hidden">
                  {(Object.keys(SHOCK_PROFILES) as ShockType[]).map(type => (
                    <button key={type} onClick={() => handleDiagnosis(type)}
                      className="w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition-colors">
                      {SHOCK_PROFILES[type].label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Лікування */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              3. Лікування
            </div>
            <div className="space-y-1.5">
              {TREATMENT_ACTIONS.map(action => {
                const cd = cooldowns[action.id] || 0;
                return (
                  <button key={action.id} onClick={() => handleTreatment(action.id)}
                    disabled={cd > 0}
                    className={`w-full text-left p-2.5 rounded border text-white transition-all
                      ${cd > 0 ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-700' : action.color}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{action.icon}</span>
                      <span className="font-bold text-xs">{action.label}</span>
                      {cd > 0 && <span className="ml-auto font-mono text-[10px] opacity-60">{cd}s</span>}
                    </div>
                    <p className="text-[9px] opacity-55 mt-0.5 pl-5">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Лог */}
          <div className="border-t border-gray-800 max-h-40 overflow-y-auto">
            <div className="px-3 py-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-widest bg-[#0d0f14] sticky top-0">
              Журнал
            </div>
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
              <p className="text-red-500 font-bold text-2xl animate-pulse mb-2">ЗУПИНКА СЕРЦЯ</p>
              <p className="text-gray-400 text-sm mb-5">Гіпотензія не була усунена вчасно.</p>
              <button onClick={() => setShowDebrief(true)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded">
                Дебрифінг
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

const RevealedRow = ({ icon, label, value, status }: { icon: string; label: string; value: string; status: string }) => {
  const color = status === 'high' ? 'text-red-400' : status === 'low' ? 'text-yellow-400' :
                status === 'warm' ? 'text-orange-400' : status === 'cold' ? 'text-blue-300' :
                status === 'mid' ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-gray-500">{icon} {label}:</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
};

export default HypotensionScenario;
