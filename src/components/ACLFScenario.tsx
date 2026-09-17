// ACLFScenario.tsx — Гостра лівошлуночкова недостатність / набряк легень
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, X, CheckCircle, Wind } from 'lucide-react';
import {
  ACLFVariant, ACLF_PROFILES, ACLF_TESTS, ACLF_ACTIONS,
  evaluateACLFAction, getACLFDebrief, pickACLFVariant,
} from '../utils/aclfEngine';
import { generateECGBuffer, generateABPBuffer, generateSpO2Buffer } from '../utils/ecgGenerator';
import WaveformCanvas from './WaveformCanvas';
import { startAlarm, stopAlarm, playBeep, resumeAudioContext } from '../utils/audioEngine';
import { Lang } from '../utils/i18n';

interface ACLFScenarioProps {
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

const ACLFScenario: React.FC<ACLFScenarioProps> = ({
  patientName = '', surgeryType = '', speed = 1.0, lang = 'ua', mode = 'intern', isPaused = false, onPause, onClose,
}) => {
  const isTeacher = mode === 'teacher';
  const ua = lang === 'ua';
  const [variant] = useState<ACLFVariant>(() => pickACLFVariant(surgeryType));
  const profile = ACLF_PROFILES[variant];

  const [isStarted, setIsStarted]               = useState(false);
  const [timeMin, setTimeMin]                   = useState(0);
  const [currentHR, setCurrentHR]               = useState(profile.initialHR);
  const [currentSystolic, setCurrentSystolic]   = useState(profile.initialSystolic);
  const [currentDiastolic, setCurrentDiastolic] = useState(profile.initialDiastolic);
  const [currentSpO2, setCurrentSpO2]           = useState(profile.initialSpO2);
  const [isStabilized, setIsStabilized]         = useState(false);
  const [isArrested, setIsArrested]             = useState(false);
  const [showDebrief, setShowDebrief]           = useState(false);
  const [testsPerformed, setTestsPerformed]     = useState<string[]>([]);
  const [revealedTests, setRevealedTests]       = useState<Set<string>>(new Set());
  const [actionHistory, setActionHistory]       = useState<string[]>([]);
  const [aiChecked, setAiChecked]               = useState(false); // aortic insufficiency checked
  const [log, setLog]                           = useState<LogEntry[]>([]);
  const [cooldowns, setCooldowns]               = useState<Record<string, number>>({});
  const [ecgBuffer, setEcgBuffer]               = useState<number[]>([]);
  const [abpBuffer, setAbpBuffer]               = useState<number[]>([]);
  const [spo2Buffer, setSpo2Buffer]             = useState<number[]>([]);
  const waveTimeRef = useRef(0);

  // Прогресія
  useEffect(() => {
    if (!isStarted || isStabilized || isArrested || isPaused) return;
    const id = window.setInterval(() => {
      setTimeMin(t => +(t + 0.1).toFixed(2));
      setCurrentSpO2(s => {
        const next = s - profile.spo2DeclinePerMin * 0.1 * speed;
        if (next <= 72) { setIsArrested(true); return 72; }
        return Math.round(next * 10) / 10;
      });
      setCurrentSystolic(s => {
        const next = s + profile.bpChangePerMin * 0.1 * speed;
        return Math.round(Math.max(40, Math.min(220, next)));
      });
      setCurrentHR(h => Math.min(200, Math.round(h + profile.hrIncreasePerMin * 0.1 * speed)));
    }, 600);
    return () => clearInterval(id);
  }, [isStarted, isStabilized, isArrested, profile, speed]);

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
    if (currentSpO2 < 82 || currentSystolic < 70) startAlarm('critical');
    else if (currentSpO2 < 90 || currentSystolic < 90) startAlarm('warning');
    else stopAlarm();
    return () => stopAlarm();
  }, [currentSpO2, currentSystolic, isStarted]);

  // Waveforms
  useEffect(() => {
    const id = window.setInterval(() => {
      const dur = 0.06;
      const t0  = waveTimeRef.current;
      waveTimeRef.current += dur;
      const hr  = Math.max(1, currentHR);
      const sys = Math.max(40, currentSystolic);
      const dia = Math.max(30, currentDiastolic);
      const ecg  = generateECGBuffer('sinus', hr, dur, 250, 1.0, t0);
      const abp  = generateABPBuffer(hr, sys, dia, dur, 250, 'sinus', t0);
      const spo2 = generateSpO2Buffer(hr, currentSpO2, dur, 250, 'sinus', t0);
      setEcgBuffer(prev  => [...prev,  ...ecg].slice(-1000));
      setAbpBuffer(prev  => [...prev,  ...abp].slice(-1000));
      setSpo2Buffer(prev => [...prev, ...spo2].slice(-1000));
    }, 60);
    return () => clearInterval(id);
  }, [currentHR, currentSystolic, currentDiastolic, currentSpO2]);

  const fmt = (min: number) => {
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const handleTest = (testId: string) => {
    if ((cooldowns[testId] || 0) > 0 || revealedTests.has(testId)) return;
    resumeAudioContext();
    const test = ACLF_TESTS.find(t => t.id === testId)!;
    setCooldowns(prev => ({ ...prev, [testId]: test.cooldown }));
    setRevealedTests(prev => new Set([...prev, testId]));
    setTestsPerformed(prev => [...prev, testId]);

    if (testId === 'aortic_insufficiency') setAiChecked(true);

    let resultText = '';
    switch (testId) {
      case 'clinical':
        resultText = ua
          ? `Двобічна крепітація в нижніх відділах легень. Тахікардія. ${profile.initialCVP > 20 ? 'Набряки гомілок.' : ''} ЧД 28/хв. ${variant === 'cardiogenic_shock' ? 'Холодна вання шкіра.' : 'Задишка виражена.'}`
          : `Bilateral crackles in lower lung zones. Tachycardia. ${profile.initialCVP > 20 ? 'Leg edema.' : ''} RR 28/min. ${variant === 'cardiogenic_shock' ? 'Cold, clammy skin.' : 'Dyspnea pronounced.'}`;
        break;
      case 'echo':
        resultText = ua
          ? `ФВ ЛШ ${variant === 'cardiogenic_shock' ? '22%' : variant === 'normotensive' ? '38%' : '45%'} ↓. Дилатація ЛШ. Протез ${variant === 'cardiogenic_shock' ? 'МК' : 'АК'} без ознак дисфункції. СТЛА 55 мм рт.ст. ↑`
          : `LV EF ${variant === 'cardiogenic_shock' ? '22%' : variant === 'normotensive' ? '38%' : '45%'} ↓. LV dilation. ${variant === 'cardiogenic_shock' ? 'MV' : 'AV'} prosthesis without dysfunction. SPPA 55 mmHg ↑`;
        break;
      case 'xray':
        resultText = ua
          ? 'Двобічне посилення легеневого малюнку. Лінії Керлі B. Кардіомегалія. Малий плевральний випіт з обох боків.'
          : 'Bilateral increased pulmonary vascular markings. Kerley B lines. Cardiomegaly. Small bilateral pleural effusions.';
        break;
      case 'bnp':
        resultText = ua
          ? `NT-proBNP = ${variant === 'cardiogenic_shock' ? '12400' : variant === 'normotensive' ? '4800' : '3200'} пг/мл ↑↑↑ (норма <300). Значуще підвищення — серцева недостатність підтверджена.`
          : `NT-proBNP = ${variant === 'cardiogenic_shock' ? '12400' : variant === 'normotensive' ? '4800' : '3200'} pg/mL ↑↑↑ (normal <300). Significant elevation — heart failure confirmed.`;
        break;
      case 'abg':
        resultText = ua
          ? `pH ${currentSpO2 < 85 ? '7.28 ↓' : '7.35'} | PaO₂ ${Math.round(currentSpO2 * 0.85)} мм рт.ст. ↓ | PaCO₂ ${currentSpO2 < 85 ? '52 ↑' : '38'} | Лактат ${variant === 'cardiogenic_shock' ? '4.2 ↑↑' : '1.8'} ммоль/л`
          : `pH ${currentSpO2 < 85 ? '7.28 ↓' : '7.35'} | PaO₂ ${Math.round(currentSpO2 * 0.85)} mmHg ↓ | PaCO₂ ${currentSpO2 < 85 ? '52 ↑' : '38'} | Lactate ${variant === 'cardiogenic_shock' ? '4.2 ↑↑' : '1.8'} mmol/L`;
        break;
      case 'aortic_insufficiency':
        resultText = ua
          ? `ЕхоКС: ${profile.hasAorticInsufficiency ? '⚠️ АОРТАЛЬНА НЕДОСТАТНІСТЬ II СТ. ВИЯВЛЕНА! ІАБП АБСОЛЮТНО ПРОТИПОКАЗАНА!' : '✅ Аортальна недостатність відсутня. ІАБП може бути використана при показаннях.'}`
          : `Echo: ${profile.hasAorticInsufficiency ? '⚠️ AORTIC INSUFFICIENCY GRADE II DETECTED! IABP ABSOLUTELY CONTRAINDICATED!' : '✅ No aortic insufficiency. IABP may be used when indicated.'}`;
        break;
    }
    setLog(prev => [{
      time: timeMin,
      message: `${test.icon} ${ua ? test.label.ua : test.label.en}: ${resultText}`,
      type: testId === 'aortic_insufficiency' && profile.hasAorticInsufficiency ? 'bad' : 'info',
    }, ...prev]);
    playBeep(770, 0.1, 0.2);
  };

  const handleAction = (actionId: string) => {
    if ((cooldowns[actionId] || 0) > 0) return;
    resumeAudioContext();
    const action = ACLF_ACTIONS.find(a => a.id === actionId)!;
    setCooldowns(prev => ({ ...prev, [actionId]: action.cooldown }));

    const result = evaluateACLFAction(
      actionId, variant, profile, currentSystolic, currentSpO2,
      testsPerformed, actionHistory, aiChecked,
    );
    setActionHistory(prev => [...prev, actionId]);

    const msg  = result.message[lang];
    const hint = result.hint?.[lang];
    const pen  = result.penaltyNote?.[lang];

    setLog(prev => [{
      time: timeMin,
      message: msg,
      hint,
      penalty: pen,
      type: pen ? 'bad' : result.isStabilizing ? 'good' : result.spo2Change > 3 ? 'good' : 'warn',
    }, ...prev]);

    if (result.spo2Change) setCurrentSpO2(s => Math.min(100, Math.max(70, s + result.spo2Change)));
    if (result.bpChange)   setCurrentSystolic(s => Math.max(40, Math.min(220, s + result.bpChange)));
    if (result.hrChange)   setCurrentHR(h => Math.max(40, Math.min(200, h + result.hrChange)));
    if (result.bpChange && result.bpChange !== 0)
      setCurrentDiastolic(d => Math.max(25, d + Math.round(result.bpChange * 0.6)));

    // Check stabilization
    const newSpo2 = Math.min(100, currentSpO2 + (result.spo2Change || 0));
    const newSys  = Math.max(40, currentSystolic + (result.bpChange || 0));
    if (result.isStabilizing && newSpo2 >= 92 && newSys >= 85) {
      setIsStabilized(true);
      stopAlarm();
      setTimeout(() => setShowDebrief(true), 2500);
    }

    playBeep(pen ? 330 : result.isStabilizing ? 880 : 550, 0.12, 0.25);
  };

  // Debrief
  if (showDebrief) {
    const debrief = getACLFDebrief(
      variant, profile, testsPerformed, actionHistory,
      isStabilized, timeMin, aiChecked, lang as Lang,
    );
    return (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/92">
        <div className="w-full max-w-lg bg-[#0d0f14] border border-green-800/50 rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="text-green-400 shrink-0" size={24}/>
            <div>
              <h2 className="text-white font-bold">
                {ua ? 'Дебрифінг: Гостра ЛШН / Набряк легень' : 'Debrief: Acute LHF / Pulmonary Edema'}
              </h2>
              <p className="text-gray-500 text-xs">{patientName} · {fmt(timeMin)}</p>
            </div>
          </div>

          <div className="mb-3 p-3 rounded border bg-gray-900 border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              {ua ? 'Варіант' : 'Variant'}
            </p>
            <p className="font-bold text-blue-400">{profile.label[lang]}</p>
            <p className="text-[11px] text-gray-400 mt-1">{profile.surgeryContext[lang]}</p>
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

  const spo2Color  = currentSpO2 < 82 ? '#ef4444' : currentSpO2 < 90 ? '#f97316' : '#00aaff';
  const bpColor    = currentSystolic < 70 ? '#ef4444' : currentSystolic < 90 ? '#f97316' : '#ef4444';

  const variantColor = variant === 'hypertensive' ? '#f97316' : variant === 'cardiogenic_shock' ? '#ef4444' : '#22c55e';

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200] bg-black/96 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b flex items-center justify-between"
        style={{ borderColor: variantColor + '40', background: variantColor + '08' }}>
        <div className="flex items-center gap-3">
          <Wind size={16} className="animate-pulse shrink-0" style={{ color: variantColor }}/>
          <div>
            <span className="font-bold text-white text-sm">
              {ua ? 'ГОСТРА ЛШН / НАБРЯК ЛЕГЕНЬ' : 'ACUTE LHF / PULMONARY EDEMA'}
            </span>
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border font-bold"
              style={{ color: spo2Color, borderColor: spo2Color + '50', background: spo2Color + '15' }}>
              SpO₂ {currentSpO2}%
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

          <WaveformCanvas buffer={ecgBuffer} color="#22c55e" label="ECG" height={90}/>

          <WaveformCanvas buffer={abpBuffer} color="#ef4444" fillColor="rgba(239,68,68,0.07)"
            label="ABP" currentValue={`${currentSystolic}/${currentDiastolic}`}
            unit="mmHg" height={80} critical={currentSystolic < 80}/>

          <WaveformCanvas buffer={spo2Buffer} color={spo2Color} fillColor={spo2Color + '15'}
            label="SpO₂" currentValue={String(currentSpO2)} unit="%" height={75}
            critical={currentSpO2 < 88}/>

          {/* Vital cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NumCard label="SpO₂" value={String(currentSpO2)} unit="%" color={spo2Color} warn={currentSpO2 < 90}/>
            <NumCard label={ua ? 'АТ сист.' : 'SBP'} value={String(currentSystolic)} unit="mmHg" color={bpColor} warn={currentSystolic < 90 || currentSystolic > 160}/>
            <NumCard label={ua ? 'ЧСС' : 'HR'} value={String(currentHR)} unit="bpm" color={currentHR > 130 ? '#f97316' : '#22c55e'} warn={currentHR > 120}/>
            <NumCard label="CVP" value={String(profile.initialCVP)} unit={ua ? 'мм рт.ст.' : 'mmHg'} color={profile.initialCVP > 20 ? '#f97316' : '#cccccc'} warn={profile.initialCVP > 20}/>
          </div>

          {/* Variant alert */}
          <div className="rounded border p-3" style={{ borderColor: variantColor + '40', background: variantColor + '0d' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: variantColor }}>
              {ua ? 'Клінічний варіант' : 'Clinical Variant'}
            </div>
            <div className="font-bold text-sm text-white">{profile.label[lang]}</div>
            <div className="text-[10px] text-gray-400 mt-1">{profile.surgeryContext[lang]}</div>
            {variant === 'cardiogenic_shock' && (
              <p className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">
                {ua ? '⚠️ ФУРОСЕМІД ПРОТИПОКАЗАНИЙ | НІТРАТИ ПРОТИПОКАЗАНІ' : '⚠️ FUROSEMIDE CONTRAINDICATED | NITRATES CONTRAINDICATED'}
              </p>
            )}
            {aiChecked && !profile.hasAorticInsufficiency && (
              <p className="text-[10px] text-green-400 mt-1">
                {ua ? '✅ АН виключена — ІАБП дозволена' : '✅ AI excluded — IABP permitted'}
              </p>
            )}
            {aiChecked && profile.hasAorticInsufficiency && (
              <p className="text-[10px] text-red-400 mt-1 font-bold">
                {ua ? '⛔ АН ВИЯВЛЕНА — ІАБП АБСОЛЮТНО ПРОТИПОКАЗАНА' : '⛔ AI DETECTED — IABP ABSOLUTELY CONTRAINDICATED'}
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
                {revealedTests.has('echo') && (
                  <LabRow label="EF" value={`${variant === 'cardiogenic_shock' ? '22%' : variant === 'normotensive' ? '38%' : '45%'}`} abnormal={true}/>
                )}
                {revealedTests.has('bnp') && (
                  <LabRow label="NT-proBNP" value={`${variant === 'cardiogenic_shock' ? '12400' : variant === 'normotensive' ? '4800' : '3200'} pg/mL`} abnormal={true}/>
                )}
                {revealedTests.has('abg') && (
                  <LabRow label="PaO₂" value={`${Math.round(currentSpO2 * 0.85)} mmHg`} abnormal={currentSpO2 < 90}/>
                )}
                {revealedTests.has('aortic_insufficiency') && (
                  <LabRow label={ua ? 'Аортальна нед.' : 'Aortic Insuff.'} value={profile.hasAorticInsufficiency ? '⚠️ YES' : '✅ NO'} abnormal={profile.hasAorticInsufficiency}/>
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
              {ACLF_TESTS.map(test => {
                const done = revealedTests.has(test.id);
                const cd   = cooldowns[test.id] || 0;
                const isAItest = test.id === 'aortic_insufficiency';
                return (
                  <button key={test.id} onClick={() => handleTest(test.id)}
                    disabled={done || cd > 0}
                    className={`w-full text-left p-2 rounded border text-xs transition-all
                      ${isAItest && !done ? 'border-orange-500/60 bg-orange-950/20 text-white' :
                        done ? 'opacity-35 bg-gray-900 border-gray-700 cursor-default' :
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
            {(['ventilation', 'diuretics', 'vasodilators', 'inotropes', 'mechanical', 'support'] as const).map(cat => {
              const catActions = ACLF_ACTIONS.filter(a => a.category === cat);
              const catLabels: Record<string, { ua: string; en: string }> = {
                ventilation:  { ua: 'Вентиляція', en: 'Ventilation' },
                diuretics:    { ua: 'Діуретики', en: 'Diuretics' },
                vasodilators: { ua: 'Вазодилататори', en: 'Vasodilators' },
                inotropes:    { ua: 'Інотропи', en: 'Inotropes' },
                mechanical:   { ua: 'Механічна підтримка', en: 'Mechanical Support' },
                support:      { ua: 'Підтримка / Позиція', en: 'Support / Position' },
              };
              return (
                <div key={cat} className="mb-2">
                  <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mb-1">
                    {ua ? catLabels[cat].ua : catLabels[cat].en}
                  </div>
                  {catActions.map(action => {
                    const cd = cooldowns[action.id] || 0;
                    const isContraindicated = action.contraindicatedIn?.includes(variant) && variant === 'cardiogenic_shock';
                    return (
                      <button key={action.id} onClick={() => handleAction(action.id)}
                        disabled={cd > 0}
                        className={`w-full text-left p-2 mb-1 rounded border text-white transition-all
                          ${cd > 0 ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-700' :
                            isContraindicated ? action.color + ' ring-1 ring-red-500/50' :
                            action.color}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{action.icon}</span>
                          <span className="font-bold text-xs">{ua ? action.label.ua : action.label.en}</span>
                          {action.isPrimary && (
                            <span className="ml-auto text-[8px] font-bold text-white/70 uppercase bg-white/10 px-1 rounded">
                              {ua ? 'ОСНОВНА' : 'PRIMARY'}
                            </span>
                          )}
                          {isContraindicated && (
                            <span className="ml-auto text-[8px] font-bold text-red-400 uppercase">⚠</span>
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
                {ua ? 'ГІПОКСИЧНА ЗУПИНКА СЕРЦЯ' : 'HYPOXIC CARDIAC ARREST'}
              </p>
              <p className="text-gray-400 text-sm mb-5">
                {ua ? 'SpO₂ впала до критичного рівня. Набряк легень не був усунутий вчасно.' : 'SpO₂ dropped to critical level. Pulmonary edema was not treated in time.'}
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

export default ACLFScenario;
