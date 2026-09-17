// AFibScenario.tsx — Пароксизм ФП після АКШ
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import {
  AFibVariant, AFIB_PROFILES, AFIB_TESTS, AFIB_ACTIONS,
  evaluateAFibAction, getAFibDebrief, pickAFibVariant,
} from '../utils/afibEngine';
import { generateECGBuffer, generateABPBuffer } from '../utils/ecgGenerator';
import WaveformCanvas from './WaveformCanvas';
import { startAlarm, stopAlarm, playBeep, playDefibrillatorShock, resumeAudioContext } from '../utils/audioEngine';
import { Lang } from '../utils/i18n';

interface AFibScenarioProps {
  patientName?: string;
  surgeryType?: string;
  speed?: number;
  lang?: Lang;
  mode?: 'teacher' | 'intern' | null;
  isPaused?: boolean;
  onPause?: () => void;
  onClose: () => void;
}

interface LogEntry {
  time: number;
  message: string;
  hint?: string;
  penalty?: string;
  type: 'info' | 'good' | 'warn' | 'bad';
}

const AFibScenario: React.FC<AFibScenarioProps> = ({
  patientName = '', surgeryType = '', speed = 1.0, lang = 'ua', mode = 'intern', isPaused = false, onPause, onClose,
}) => {
  const isTeacher = mode === 'teacher';
  const ua = lang === 'ua';
  const [variant] = useState<AFibVariant>(() => pickAFibVariant(surgeryType));
  const profile = AFIB_PROFILES[variant];

  const [isStarted, setIsStarted]             = useState(false);
  const [timeMin, setTimeMin]                 = useState(0);
  const [currentHR, setCurrentHR]             = useState(profile.initialHR);
  const [currentSystolic, setCurrentSystolic] = useState(profile.initialSystolic);
  const [currentDiastolic, setCurrentDiastolic] = useState(profile.initialDiastolic);
  const [rhythmRestored, setRhythmRestored]   = useState(false);
  const [isStabilized, setIsStabilized]       = useState(false);
  const [isArrested, setIsArrested]           = useState(false);
  const [showDebrief, setShowDebrief]         = useState(false);
  const [testsPerformed, setTestsPerformed]   = useState<string[]>([]);
  const [revealedTests, setRevealedTests]     = useState<Set<string>>(new Set());
  const [actionHistory, setActionHistory]     = useState<string[]>([]);
  const [kCorrected, setKCorrected]           = useState(false);
  const [mgCorrected, setMgCorrected]         = useState(false);
  const [log, setLog]                         = useState<LogEntry[]>([]);
  const [cooldowns, setCooldowns]             = useState<Record<string, number>>({});
  const [ecgBuffer, setEcgBuffer]             = useState<number[]>([]);
  const [abpBuffer, setAbpBuffer]             = useState<number[]>([]);
  const waveTimeRef = useRef(0);

  // Прогресія без лікування
  useEffect(() => {
    if (!isStarted || rhythmRestored || isStabilized || isArrested || isPaused) return;
    const id = window.setInterval(() => {
      setTimeMin(t => +(t + 0.1).toFixed(2));
      setCurrentSystolic(s => {
        const next = s - profile.bpDeclinePerMin * 0.1 * speed;
        if (next <= 45) { setIsArrested(true); return 45; }
        return Math.round(next);
      });
      setCurrentHR(h => Math.min(200, Math.round(h + profile.hrIncreasePerMin * 0.1 * speed)));
    }, 600);
    return () => clearInterval(id);
  }, [isStarted, rhythmRestored, isStabilized, isArrested, profile, speed]);

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
    if (currentSystolic < 70 || currentHR > 160) startAlarm('critical');
    else if (currentSystolic < 90 || currentHR > 130) startAlarm('warning');
    else stopAlarm();
    return () => stopAlarm();
  }, [currentSystolic, currentHR, isStarted]);

  // Waveforms — ФП крива (afib rhythm)
  useEffect(() => {
    const id = window.setInterval(() => {
      const dur = 0.06;
      const t0  = waveTimeRef.current;
      waveTimeRef.current += dur;
      const hr  = Math.max(1, currentHR);
      const sys = Math.max(40, currentSystolic);
      const dia = Math.max(30, currentDiastolic);
      const ecgRhythm = rhythmRestored ? 'sinus' : 'afib';
      const ecg = generateECGBuffer(ecgRhythm, hr, dur, 250, 1.0, t0);
      const abp = generateABPBuffer(hr, sys, dia, dur, 250, ecgRhythm, t0);
      setEcgBuffer(prev => [...prev, ...ecg].slice(-1000));
      setAbpBuffer(prev => [...prev, ...abp].slice(-1000));
    }, 60);
    return () => clearInterval(id);
  }, [currentHR, currentSystolic, currentDiastolic, rhythmRestored]);

  const fmt = (min: number) => {
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const handleTest = (testId: string) => {
    if ((cooldowns[testId] || 0) > 0 || revealedTests.has(testId)) return;
    resumeAudioContext();
    const test = AFIB_TESTS.find(t => t.id === testId)!;
    setCooldowns(prev => ({ ...prev, [testId]: test.cooldown }));
    setRevealedTests(prev => new Set([...prev, testId]));
    setTestsPerformed(prev => [...prev, testId]);

    let resultText = '';
    switch (testId) {
      case 'ecg12':
        resultText = ua
          ? `ФП підтверджена. Нерегулярний ритм, відсутність P-хвиль. Ознак ГКС немає. ЧСС ${currentHR}/хв.`
          : `AF confirmed. Irregular rhythm, absent P-waves. No signs of ACS. HR ${currentHR}/min.`;
        break;
      case 'electrolytes':
        resultText = ua
          ? `K⁺ = ${profile.k} ммоль/л ↓↓ (норма 3.5-5.0) | Mg²⁺ = ${profile.mg} ммоль/л ↓↓ (норма 0.7-1.0)`
          : `K⁺ = ${profile.k} mmol/L ↓↓ (normal 3.5-5.0) | Mg²⁺ = ${profile.mg} mmol/L ↓↓ (normal 0.7-1.0)`;
        break;
      case 'echo':
        resultText = ua
          ? `ЕхоКС: ФВ 48%. ЛП розширене (46 мм). Тромбу у вушці ЛП не виявлено. Перикард чистий.`
          : `Echo: EF 48%. LA enlarged (46 mm). No thrombus in LAA. Pericardium clear.`;
        break;
      case 'coag':
        resultText = ua
          ? `МНО 1.4 | АЧТЧ 38 сек | Тромбоцити 142×10⁹/л | Фібриноген 2.8 г/л. Прийнятний профіль для антикоагуляції.`
          : `INR 1.4 | aPTT 38 sec | Platelets 142×10⁹/L | Fibrinogen 2.8 g/L. Acceptable profile for anticoagulation.`;
        break;
      case 'tsh':
        resultText = ua
          ? `ТТГ = 2.1 мОд/л (норма 0.4-4.0). Тиреотоксикоз виключений.`
          : `TSH = 2.1 mIU/L (normal 0.4-4.0). Thyrotoxicosis excluded.`;
        break;
    }
    setLog(prev => [{
      time: timeMin,
      message: `${test.icon} ${ua ? test.label.ua : test.label.en}: ${resultText}`,
      type: 'info',
    }, ...prev]);
    playBeep(770, 0.1, 0.2);
  };

  const handleAction = (actionId: string) => {
    if ((cooldowns[actionId] || 0) > 0) return;
    resumeAudioContext();
    const action = AFIB_ACTIONS.find(a => a.id === actionId)!;
    setCooldowns(prev => ({ ...prev, [actionId]: action.cooldown }));

    if (actionId === 'cardioversion') {
      playDefibrillatorShock(() => {
        finishAction(actionId, action);
      });
      return;
    }
    finishAction(actionId, action);
  };

  const finishAction = (actionId: string, action: any) => {
    const result = evaluateAFibAction(
      actionId, variant, profile, currentHR, currentSystolic,
      testsPerformed, actionHistory, kCorrected, mgCorrected,
    );
    setActionHistory(prev => [...prev, actionId]);

    if (actionId === 'potassium_iv' && !result.penaltyNote) setKCorrected(true);
    if (actionId === 'magnesium_iv') setMgCorrected(true);

    const msg  = result.message[lang];
    const hint = result.hint?.[lang];
    const pen  = result.penaltyNote?.[lang];

    setLog(prev => [{
      time: timeMin,
      message: msg,
      hint,
      penalty: pen,
      type: result.rhythmRestored ? 'good' : result.hrChange < -15 ? 'good' : result.bpChange < -8 ? 'bad' : 'warn',
    }, ...prev]);

    if (result.hrChange) setCurrentHR(h => Math.max(50, Math.round(h + result.hrChange)));
    if (result.bpChange) {
      setCurrentSystolic(s => Math.max(40, Math.round(s + result.bpChange)));
      setCurrentDiastolic(d => Math.max(25, Math.round(d + result.bpChange * 0.6)));
    }

    if (result.rhythmRestored) {
      setRhythmRestored(true);
      stopAlarm();
      setTimeout(() => {
        setIsStabilized(true);
        setShowDebrief(true);
      }, 3000);
    }

    // Check stabilization
    if (!result.rhythmRestored && currentSystolic + (result.bpChange || 0) >= 90 &&
        currentHR + (result.hrChange || 0) <= 100) {
      setIsStabilized(true);
      setTimeout(() => setShowDebrief(true), 2000);
    }

    playBeep(result.rhythmRestored ? 880 : result.bpChange < -8 ? 330 : 660, 0.12, 0.25);
  };

  // Debrief
  if (showDebrief) {
    const debrief = getAFibDebrief(
      variant, profile, testsPerformed, actionHistory,
      rhythmRestored, isStabilized, timeMin, lang as Lang,
    );
    return (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/92">
        <div className="w-full max-w-lg bg-[#0d0f14] border border-green-800/50 rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="text-green-400 shrink-0" size={24}/>
            <div>
              <h2 className="text-white font-bold">
                {ua ? 'Дебрифінг: Пароксизм ФП після АКШ' : 'Debrief: Post-CABG AF'}
              </h2>
              <p className="text-gray-500 text-xs">
                {patientName} · {fmt(timeMin)} ·{' '}
                {rhythmRestored
                  ? (ua ? '✅ Синусовий ритм відновлено' : '✅ Sinus rhythm restored')
                  : (ua ? '⚠️ Гемодинаміка стабілізована' : '⚠️ Hemodynamics stabilized')}
              </p>
            </div>
          </div>

          <div className="mb-3 p-3 rounded border bg-gray-900 border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              {ua ? 'Варіант' : 'Variant'}
            </p>
            <p className="font-bold text-yellow-400">{profile.label[lang]}</p>
            <p className="text-[11px] text-gray-400 mt-1">{profile.description[lang]}</p>
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

  const hrColor  = currentHR > 150 ? '#ef4444' : currentHR > 120 ? '#f97316' : '#22c55e';
  const bpColor  = currentSystolic < 70 ? '#ef4444' : currentSystolic < 90 ? '#f97316' : '#ef4444';

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200] bg-black/96 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-yellow-900/40 bg-yellow-950/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap size={16} className={`${currentHR > 130 ? 'text-red-400 animate-pulse' : 'text-yellow-400'} shrink-0`}/>
          <div>
            <span className="font-bold text-white text-sm">
              {ua ? 'ПАРОКСИЗМ ФП ПІСЛЯ АКШ' : 'POST-CABG ATRIAL FIBRILLATION'}
            </span>
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border font-bold"
              style={{ color: hrColor, borderColor: hrColor + '50', background: hrColor + '15' }}>
              {rhythmRestored
                ? (ua ? '✅ Синусовий ритм' : '✅ Sinus Rhythm')
                : (ua ? `ФП · ЧСС ${currentHR}/хв` : `AF · HR ${currentHR}/min`)}
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
            {isStarted && onPause && isTeacher && (
              <button onClick={onPause}
                className="px-2 py-1 rounded text-xs font-bold border"
                style={{ background: isPaused ? '#005500' : '#2a1a00', color: isPaused ? '#44ff88' : '#ffaa44', border: '1px solid ' + (isPaused ? '#008800' : '#553300') }}>
                {isPaused ? (lang === 'ua' ? '▶ ПРОДОВЖИТИ' : '▶ RESUME') : (lang === 'ua' ? '⏸ ПАУЗА' : '⏸ PAUSE')}
              </button>
            )}
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded text-gray-500">
            <X size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT */}
        <div className="flex-1 flex flex-col p-3 gap-2 overflow-y-auto min-w-0">

          <WaveformCanvas buffer={ecgBuffer}
            color={rhythmRestored ? '#22c55e' : '#f59e0b'}
            label={rhythmRestored ? 'ECG — SINUS RHYTHM' : (ua ? 'ЕКГ — ФІБРИЛЯЦІЯ ПЕРЕДСЕРДЬ' : 'ECG — ATRIAL FIBRILLATION')}
            height={110} critical={currentHR > 150}/>

          <WaveformCanvas buffer={abpBuffer} color="#ef4444" fillColor="rgba(239,68,68,0.07)"
            label="ABP"
            currentValue={`${currentSystolic}/${currentDiastolic}`}
            unit="mmHg" height={90} critical={currentSystolic < 80}/>

          {/* Vital cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NumCard label={ua ? 'ЧСС' : 'HR'} value={String(currentHR)} unit="bpm" color={hrColor} warn={currentHR > 120}/>
            <NumCard label={ua ? 'АТ сист.' : 'SBP'} value={String(currentSystolic)} unit="mmHg" color={bpColor} warn={currentSystolic < 90}/>
            <NumCard label="K⁺" value={kCorrected ? '4.2' : String(profile.k)} unit="ммоль/л" color={kCorrected ? '#22c55e' : (profile.k < 3.5 ? '#ef4444' : '#cccccc')} warn={!kCorrected && profile.k < 3.5}/>
            <NumCard label="Mg²⁺" value={mgCorrected ? '0.95' : String(profile.mg)} unit="ммоль/л" color={mgCorrected ? '#22c55e' : (profile.mg < 0.7 ? '#ef4444' : '#cccccc')} warn={!mgCorrected && profile.mg < 0.7}/>
          </div>

          {/* Rhythm status */}
          <div className={`rounded border p-3 ${rhythmRestored ? 'bg-green-950/20 border-green-700/40' : 'bg-yellow-950/15 border-yellow-800/40'}`}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1"
              style={{ color: rhythmRestored ? '#22c55e' : '#f59e0b' }}>
              {ua ? 'Статус ритму' : 'Rhythm Status'}
            </div>
            <div className="font-bold text-sm" style={{ color: rhythmRestored ? '#22c55e' : '#f59e0b' }}>
              {rhythmRestored
                ? (ua ? '✅ Синусовий ритм відновлено' : '✅ Sinus Rhythm Restored')
                : (ua ? `⚡ Фібриляція передсердь · ${profile.label[lang]}` : `⚡ Atrial Fibrillation · ${profile.label[lang]}`)}
            </div>
            {!rhythmRestored && variant === 'unstable' && (
              <p className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">
                {ua ? '⚡ КАРДІОВЕРСІЯ ПОКАЗАНА НЕГАЙНО' : '⚡ CARDIOVERSION INDICATED IMMEDIATELY'}
              </p>
            )}
            {!rhythmRestored && variant === 'hypotensive_tachy' && (
              <p className="text-[10px] text-orange-400 mt-1">
                {ua ? '⚠️ Гіпотензія — метопролол в/в протипоказаний' : '⚠️ Hypotension — IV metoprolol contraindicated'}
              </p>
            )}
          </div>

          {/* Revealed tests */}
          {revealedTests.size > 0 && (
            <div className="bg-[#0f1520] rounded border border-blue-900/40 p-3">
              <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                {ua ? 'Результати обстежень' : 'Test Results'}
              </div>
              <div className="space-y-1 text-[11px]">
                {revealedTests.has('electrolytes') && (<>
                  <LabRow label="K⁺" value={`${profile.k} ммоль/л`} abnormal={profile.k < 3.5}/>
                  <LabRow label="Mg²⁺" value={`${profile.mg} ммоль/л`} abnormal={profile.mg < 0.7}/>
                </>)}
                {revealedTests.has('coag') && (
                  <LabRow label="INR" value="1.4" abnormal={false}/>
                )}
                {revealedTests.has('echo') && (
                  <LabRow label="EF" value="48%" abnormal={false}/>
                )}
                {revealedTests.has('tsh') && (
                  <LabRow label="TSH" value="2.1 mIU/L" abnormal={false}/>
                )}
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
              {AFIB_TESTS.map(test => {
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
                      {done && <span className="ml-auto text-green-400">✓</span>}
                      {cd > 0 && <span className="ml-auto font-mono text-[10px]">{cd}s</span>}
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5 pl-5">
                      {ua ? test.description.ua : test.description.en}
                    </p>
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
            {/* Group by category */}
            {['prophylaxis', 'rate_control', 'rhythm_control', 'anticoag', 'support'].map(cat => {
              const catActions = AFIB_ACTIONS.filter(a => a.category === cat);
              const catLabels: Record<string, { ua: string; en: string }> = {
                prophylaxis:    { ua: 'Профілактика', en: 'Prophylaxis' },
                rate_control:   { ua: 'Контроль ЧСС', en: 'Rate Control' },
                rhythm_control: { ua: 'Відновлення ритму', en: 'Rhythm Control' },
                anticoag:       { ua: 'Антикоагуляція', en: 'Anticoagulation' },
                support:        { ua: 'Підтримка АТ', en: 'BP Support' },
              };
              return (
                <div key={cat} className="mb-2">
                  <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mb-1">
                    {ua ? catLabels[cat].ua : catLabels[cat].en}
                  </div>
                  {catActions.map(action => {
                    const cd = cooldowns[action.id] || 0;
                    return (
                      <button key={action.id} onClick={() => handleAction(action.id)}
                        disabled={cd > 0}
                        className={`w-full text-left p-2 mb-1 rounded border text-white transition-all
                          ${cd > 0 ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-700' : action.color}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{action.icon}</span>
                          <span className="font-bold text-xs">{ua ? action.label.ua : action.label.en}</span>
                          {action.isPrimary && (
                            <span className="ml-auto text-[8px] font-bold text-white/70 uppercase bg-white/10 px-1 rounded">
                              {ua ? 'ОСНОВНА' : 'PRIMARY'}
                            </span>
                          )}
                          {cd > 0 && <span className="ml-auto font-mono text-[10px] opacity-60">{cd}s</span>}
                        </div>
                        <p className="text-[9px] opacity-55 mt-0.5 pl-5">
                          {ua ? action.description.ua : action.description.en}
                        </p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
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

      {/* Pause overlay */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="text-center">
            <p className="text-white font-bold text-2xl mb-2">⏸ {lang === 'ua' ? 'ПАУЗА' : 'PAUSED'}</p>
            {onPause && (
              <button onClick={onPause}
                className="px-6 py-2 rounded font-bold text-sm mt-2"
                style={{ background: '#005500', color: '#44ff88', border: '1px solid #008800' }}>
                {lang === 'ua' ? '▶ Продовжити' : '▶ Resume'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Arrest overlay */}
      <AnimatePresence>
        {isArrested && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="absolute inset-0 bg-black/85 flex items-center justify-center z-50">
            <div className="text-center px-6">
              <p className="text-red-500 font-bold text-2xl animate-pulse mb-2">
                {ua ? 'ЗУПИНКА СЕРЦЯ' : 'CARDIAC ARREST'}
              </p>
              <p className="text-gray-400 text-sm mb-5">
                {ua ? 'ФП з гіпотензією прогресувала до зупинки серця.' : 'AF with hypotension progressed to cardiac arrest.'}
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

export default AFibScenario;
