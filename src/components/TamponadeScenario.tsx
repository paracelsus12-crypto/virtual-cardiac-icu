// TamponadeScenario.tsx v2 — адаптивний сценарій (відкрита операція vs катетерне втручання)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  getTamponadeState, evaluateTamponadeAction, getActionsForCategory,
  getDebriefScore, getSurgeryCategory,
  TamponadeState, PHASE_LABELS, PHASE_COLORS, SurgeryCategory,
} from '../utils/tamponadeEngine';
import { generateECGBuffer, generateABPBuffer } from '../utils/ecgGenerator';
import WaveformCanvas from './WaveformCanvas';
import { startAlarm, stopAlarm, playBeep, resumeAudioContext } from '../utils/audioEngine';

interface TamponadeScenarioProps {
  patientName: string;
  surgeryType: string;
  speed?: number;
  onClose: () => void;
}

interface LogEntry {
  time: number;
  message: string;
  hint?: string;
  correct: boolean;
}

const TamponadeScenario: React.FC<TamponadeScenarioProps> = ({
  patientName, surgeryType, speed = 1.0, onClose,
}) => {
  const category: SurgeryCategory = getSurgeryCategory(surgeryType);
  const isOpen = category === 'open';
  const actions = getActionsForCategory(category);

  const [isStarted, setIsStarted]               = useState(false);
  const [timeMin, setTimeMin]                   = useState(0);
  const [echoConfirmed, setEchoConfirmed]       = useState(false);
  const [consultantCalled, setConsultantCalled] = useState(false);
  const [fluidBoosts, setFluidBoosts]           = useState(0);
  const [actionHistory, setActionHistory]       = useState<string[]>([]);
  const [log, setLog]                           = useState<LogEntry[]>([]);
  const [cooldowns, setCooldowns]               = useState<Record<string, number>>({});
  const [isCured, setIsCured]                   = useState(false);
  const [isArrested, setIsArrested]             = useState(false);
  const [showDebrief, setShowDebrief]           = useState(false);
  const [progressionStopped, setProgressionStopped] = useState(false);
  const [ecgBuffer, setEcgBuffer]               = useState<number[]>([]);
  const [abpBuffer, setAbpBuffer]               = useState<number[]>([]);
  const waveTimeRef = useRef(0);

  const state = getTamponadeState(timeMin, fluidBoosts, consultantCalled);

  // Таймер прогресії (0.1 хв / 600мс = 1 хв за 6 сек реального часу)
  useEffect(() => {
    if (!isStarted || isCured || isArrested || progressionStopped) return;
    const id = window.setInterval(() => {
      setTimeMin(t => {
        const next = +(t + 0.1).toFixed(2);
        if (next >= 20) { setIsArrested(true); return 20; }
        return next;
      });
    }, 600);
    return () => clearInterval(id);
  }, [isStarted, isCured, isArrested, progressionStopped]);

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

  // Звук
  useEffect(() => {
    if (state.phase === 'arrest') startAlarm('critical');
    else if (state.phase === 'critical' || state.phase === 'preterminal') startAlarm('warning');
    else stopAlarm();
    return () => stopAlarm();
  }, [state.phase]);

  // Криві
  useEffect(() => {
    const id = window.setInterval(() => {
      const dur = 0.06;
      const t0  = waveTimeRef.current;
      waveTimeRef.current += dur;
      const hr  = Math.max(1, state.hr);

      const ecg = generateECGBuffer('sinus', hr, dur, 250, 1.0, t0).map(v => {
        const alt = state.electricalAlternans &&
          Math.floor(t0 * hr / 60) % 2 === 0 ? 0.50 : 1.0;
        return v * state.ecgVoltage * alt;
      });

      const abp = generateABPBuffer(
        hr, state.systolicBP, state.diastolicBP, dur, 250, 'sinus', t0,
      ).map(v => {
        // Парадоксальний пульс — на вдиху АТ падає
        const onInspiration = Math.sin(t0 * 0.25 * Math.PI * 2) > 0;
        return onInspiration ? v - state.paradoxicalPulse * 0.6 : v;
      });

      setEcgBuffer(prev => [...prev, ...ecg].slice(-1000));
      setAbpBuffer(prev => [...prev, ...abp].slice(-1000));
    }, 60);
    return () => clearInterval(id);
  }, [state]);

  const handleAction = (actionId: string) => {
    if ((cooldowns[actionId] || 0) > 0) return;
    resumeAudioContext();

    const action = actions.find(a => a.id === actionId)!;

    // Перевірка requiresConsultant
    if (action.requiresConsultant && !consultantCalled) {
      const msg = isOpen
        ? '❌ Реексплорація потребує хірурга. Спочатку викличте старшого колегу.'
        : '❌ Потрібен хірург. Спочатку повідомте старшого колегу.';
      setLog(prev => [{ time: timeMin, message: msg, correct: false }, ...prev]);
      playBeep(330, 0.15, 0.3);
      return;
    }

    // Перевірка requiresEcho для catheter
    if (action.requiresEcho && !echoConfirmed && category === 'catheter') {
      setLog(prev => [{
        time: timeMin,
        message: '❌ Спочатку виконайте ехокардіографію для підтвердження діагнозу.',
        correct: false,
      }, ...prev]);
      playBeep(330, 0.15, 0.3);
      return;
    }

    setCooldowns(prev => ({ ...prev, [actionId]: action.cooldown }));

    const result = evaluateTamponadeAction(
      actionId, state, category, echoConfirmed, consultantCalled, actionHistory,
    );

    setLog(prev => [{
      time: timeMin,
      message: result.message,
      hint: result.hint,
      correct: result.success,
    }, ...prev]);
    setActionHistory(prev => [...prev, actionId]);

    if (actionId === 'echo' && result.success)       setEchoConfirmed(true);
    if (actionId === 'consultant' && result.success) setConsultantCalled(true);
    if (actionId === 'fluids' && result.success)     setFluidBoosts(f => f + 1);
    if (result.progressionStop) setProgressionStopped(true);
    if (result.cure) {
      setIsCured(true);
      stopAlarm();
      setTimeout(() => setShowDebrief(true), 2500);
    }

    playBeep(result.success ? 660 : 330, 0.15, 0.3);
  };

  const fmt = (min: number) => {
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const phaseColor = PHASE_COLORS[state.phase];

  // ---- ДЕБРИФІНГ ----
  if (showDebrief) {
    const debrief = getDebriefScore(
      actionHistory, category, echoConfirmed, consultantCalled, isCured, timeMin,
    );

    return (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/92">
        <div className="w-full max-w-lg bg-[#0d0f14] border border-green-800/50 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-1">
            <CheckCircle className="text-green-400 shrink-0" size={26} />
            <div>
              <h2 className="text-white font-bold text-base">Дебрифінг: Тампонада серця</h2>
              <p className="text-gray-500 text-xs">
                {patientName} · {surgeryType} ·{' '}
                <span className={isOpen ? 'text-orange-400' : 'text-blue-400'}>
                  {isOpen ? 'Після відкритої операції' : 'Після катетерного втручання'}
                </span>
                {' '}· Час: {fmt(timeMin)}
              </p>
            </div>
          </div>

          {/* Тактичний алгоритм */}
          <div className={`mt-3 mb-3 p-3 rounded border text-xs leading-relaxed ${isOpen ? 'bg-orange-950/20 border-orange-800/40' : 'bg-blue-950/20 border-blue-800/40'}`}>
            <p className={`font-bold mb-1 ${isOpen ? 'text-orange-400' : 'text-blue-400'}`}>
              {isOpen ? '🏥 Після відкритої операції — алгоритм' : '🔵 Після катетерного втручання — алгоритм'}
            </p>
            {isOpen ? (
              <p className="text-gray-300">Ехо (орієнтовно) → Виклик хірурга → Рідина (міст) → <strong className="text-orange-300">Реексплорація</strong> — метод вибору. Перикардіоцентез не вирішує проблему згустків.</p>
            ) : (
              <p className="text-gray-300">Ехо (підтвердження) → Виклик колеги → Рідина (міст) → <strong className="text-blue-300">Перикардіоцентез</strong> — метод вибору. Реексплорація — лише при невдачі.</p>
            )}
          </div>

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

          <div className="bg-gray-900 rounded p-3 mb-4 text-[11px] text-gray-300 leading-relaxed space-y-1">
            <p className="font-bold text-white text-xs">Ключові точки:</p>
            <p>• Тріада Бека: гіпотензія + ↑ЦВТ + глухі тони / ↓ вольтаж ЕКГ</p>
            <p>• Electrical alternans — патогномонічна ознака тампонади</p>
            <p>• Раптове припинення виділень по дренажах після відкритої операції — перший сигнал</p>
            {isOpen
              ? <p>• Ехо після відкритої операції може бути <strong>хибнонегативним</strong> (локальні згустки)</p>
              : <p>• Парадоксальний пульс &gt;10 мм рт.ст. — важлива клінічна ознака</p>
            }
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">
              Оцінка: <span className="text-white font-bold">{debrief.score}/{debrief.total}</span>
            </span>
            <button onClick={onClose}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded">
              Завершити
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---- ОСНОВНИЙ ЕКРАН ----
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200] bg-black/96 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b flex items-center justify-between"
        style={{ borderColor: phaseColor+'40', background: phaseColor+'0d' }}>
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={16} style={{ color: phaseColor }}
            className={state.phase !== 'stable' ? 'animate-pulse shrink-0' : 'shrink-0'} />
          <div className="min-w-0">
            <span className="font-bold text-white text-sm">ТАМПОНАДА СЕРЦЯ</span>
            <span className="ml-2 text-xs font-bold" style={{ color: phaseColor }}>
              {PHASE_LABELS[state.phase]}
            </span>
            <span className={`ml-3 text-[10px] px-1.5 py-0.5 rounded border font-bold ${isOpen ? 'text-orange-400 border-orange-700/50 bg-orange-950/20' : 'text-blue-400 border-blue-700/50 bg-blue-950/20'}`}>
              {isOpen ? '🏥 Після відкритої операції' : '🔵 Після катетерного втручання'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {!isStarted ? (
              <button onClick={() => setIsStarted(true)}
                className="px-4 py-1 rounded font-bold text-xs animate-pulse"
                style={{ background:'#005500', color:'#44ff88', border:'1px solid #008800' }}>
                ▶ СТАРТ
              </button>
            ) : (
              <div className="flex items-center gap-1 font-mono text-sm">
                <Clock size={13} className="text-gray-500" />
                <span className={timeMin > 10 ? 'text-red-400 font-bold' : 'text-white'}>{fmt(timeMin)}</span>
                <span className="text-[9px] ml-1 opacity-50">{speed !== 1 ? `${speed}×` : ''}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-gray-500">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT — криві + показники */}
        <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto min-w-0">

          {/* ЕКГ */}
          <WaveformCanvas buffer={ecgBuffer} color="#22c55e"
            label={`ЕКГ — вольтаж ${Math.round(state.ecgVoltage*100)}%${state.electricalAlternans ? '  ⚡ ELECTRICAL ALTERNANS' : ''}`}
            height={105} critical={state.phase === 'critical' || state.phase === 'preterminal'} />

          {/* АТ */}
          <WaveformCanvas buffer={abpBuffer} color="#ef4444" fillColor="rgba(239,68,68,0.07)"
            label={`АТ — Парадоксальний пульс: ${state.paradoxicalPulse} мм рт.ст.${state.paradoxicalPulse >= 10 ? ' ⚠️' : ''}`}
            currentValue={state.systolicBP > 0 ? `${state.systolicBP}/${state.diastolicBP}` : '---'}
            unit="mmHg" height={95} critical={state.systolicBP < 70} />

          {/* Показники */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NumCard label="ЧСС" value={state.hr > 0 ? String(state.hr) : '---'} unit="bpm"
              color={state.hr > 120 ? '#ef4444' : '#22c55e'} warn={state.hr > 120} />
            <NumCard label="АТ сист." value={state.systolicBP > 0 ? String(state.systolicBP) : '---'} unit="mmHg"
              color={state.systolicBP < 70 ? '#ef4444' : state.systolicBP < 90 ? '#f59e0b' : '#ef4444'} warn={state.systolicBP < 90} />
            <NumCard label="ЦВТ" value={String(state.cvp)} unit="mmHg"
              color={state.cvp > 20 ? '#ef4444' : state.cvp > 12 ? '#f59e0b' : '#22c55e'} warn={state.cvp > 12} />
            <NumCard label="Рідина" value={String(state.volumeMl)} unit="мл"
              color={state.volumeMl > 300 ? '#ef4444' : state.volumeMl > 150 ? '#f59e0b' : '#6b7280'} warn={state.volumeMl > 150} />
          </div>

          {/* Тріада Бека */}
          <div className="bg-[#11141D] rounded border border-gray-800 p-3">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">Тріада Бека</div>
            <div className="grid grid-cols-3 gap-2">
              <BeckSign active={state.systolicBP < 90} label="Гіпотензія" value={`${state.systolicBP} мм`} />
              <BeckSign active={state.cvp > 12}        label="↑ ЦВТ"      value={`${state.cvp} мм`} />
              <BeckSign active={state.ecgVoltage < 0.6} label="↓ Вольтаж ЕКГ" value={`${Math.round(state.ecgVoltage*100)}%`} />
            </div>
          </div>

          {/* Дренаж — тільки для open */}
          {isOpen && (
            <div className={`rounded border p-3 ${state.drainBlocked ? 'bg-red-950/20 border-red-800/40' : 'bg-[#11141D] border-gray-800'}`}>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Дренаж перикарда</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-sm font-bold font-mono ${state.drainBlocked ? 'text-red-400' : 'text-green-400'}`}>
                    {state.drainBlocked ? '⛔ ЗАБЛОКОВАНИЙ' : `${state.drainOutput} мл/год`}
                  </span>
                  {state.drainBlocked && (
                    <p className="text-[10px] text-red-400 mt-0.5">
                      Згустки блокують дренаж — ознака активної кровотечі в перикард
                    </p>
                  )}
                </div>
                {!state.drainBlocked && (
                  <span className="text-[10px] text-gray-500">норма &lt;100 мл/год</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — дії + лог */}
        <div className="w-72 shrink-0 flex flex-col border-l border-gray-800 overflow-hidden">

          {/* Дії */}
          <div className="p-3 space-y-1.5 border-b border-gray-800 overflow-y-auto">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Дії інтерна
            </div>
            {actions.map(action => {
              const cd   = cooldowns[action.id] || 0;
              const done = (action.id === 'echo' && echoConfirmed) ||
                           (action.id === 'consultant' && consultantCalled);
              const needsConsult = action.requiresConsultant && !consultantCalled;
              const needsEcho    = action.requiresEcho && !echoConfirmed && category === 'catheter';
              const locked       = needsConsult || needsEcho;

              return (
                <button key={action.id}
                  onClick={() => handleAction(action.id)}
                  disabled={cd > 0 || done}
                  className={`w-full text-left p-2.5 rounded border text-white transition-all relative
                    ${done    ? 'opacity-35 bg-gray-900 border-gray-700 cursor-default' :
                      cd > 0  ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-700' :
                      locked  ? 'opacity-50 cursor-not-allowed bg-gray-900 border-gray-700' :
                      action.color}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{action.icon}</span>
                    <span className="font-bold text-xs leading-tight">{action.label}</span>
                    {done   && <span className="ml-auto text-green-400 text-[10px]">✓</span>}
                    {cd > 0 && <span className="ml-auto font-mono text-[10px] opacity-60">{cd}s</span>}
                    {action.isPrimary && !done && (
                      <span className="ml-auto text-[8px] font-bold text-white/70 uppercase bg-white/10 px-1 rounded">ОСНОВНА</span>
                    )}
                  </div>
                  <p className="text-[9px] opacity-55 mt-0.5 pl-5 leading-snug">{action.description}</p>
                  {locked && (
                    <p className="text-[9px] text-yellow-400 mt-0.5 pl-5">
                      {needsEcho ? '🔒 Потрібне ехо' : '🔒 Потрібен хірург'}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Лог */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-widest border-b border-gray-800 sticky top-0 bg-[#0d0f14]">
              Журнал
            </div>
            {log.length === 0 && (
              <p className="text-[10px] text-gray-600 text-center p-4">Дій ще не виконувалось</p>
            )}
            {log.map((e, i) => (
              <div key={i} className={`px-3 py-2 border-b border-gray-900/60 ${!e.correct ? 'bg-red-950/10' : ''}`}>
                <div className="flex gap-2 text-[10px]">
                  <span className="font-mono text-gray-600 shrink-0">{fmt(e.time)}</span>
                  <span className="text-gray-300 leading-snug">{e.message}</span>
                </div>
                {e.hint && <p className="text-[9px] text-blue-400 mt-1 pl-8 italic leading-snug">{e.hint}</p>}
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
              <p className="text-gray-400 text-sm mb-1">Пацієнт не вижив.</p>
              <p className="text-gray-500 text-xs mb-5">
                {isOpen
                  ? 'Реексплорація не була виконана вчасно.'
                  : 'Перикардіоцентез не був виконаний вчасно.'}
              </p>
              <button onClick={() => setShowDebrief(true)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded">
                Переглянути дебрифінг
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

const BeckSign = ({ active, label, value }: { active: boolean; label: string; value: string }) => (
  <div className={`p-2 rounded border text-center transition-colors ${active ? 'bg-red-950/30 border-red-600/50' : 'bg-gray-900/50 border-gray-800'}`}>
    <div className={`text-[10px] font-bold mb-0.5 ${active ? 'text-red-400' : 'text-gray-600'}`}>{label}</div>
    <div className={`font-mono text-xs ${active ? 'text-red-300' : 'text-gray-500'}`}>{value}</div>
    {active && <div className="text-[8px] text-red-500 mt-0.5">⚠ ПАТОЛОГІЯ</div>}
  </div>
);

export default TamponadeScenario;
