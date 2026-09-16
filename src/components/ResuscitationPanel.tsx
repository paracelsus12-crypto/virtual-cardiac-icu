// ResuscitationPanel — інтерактивна панель реанімації при ФШ/ШТ
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Heart, Activity, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { playDefibrillatorShock, playCPRBeep } from '../utils/audioEngine';
import { Lang } from '../utils/i18n';
import { RhythmType } from '../utils/ecgGenerator';

interface ResuscitationAction {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  descEn: string;
  icon: React.ReactNode;
  color: string;
  key: string;
  cooldown: number; // секунди
}

interface ResuscitationEvent {
  time: number;
  action: string;
  result: string;
  correct: boolean;
}

interface ResuscitationPanelProps {
  rhythm: RhythmType;
  onRhythmChange: (rhythm: RhythmType) => void;
  onClose: () => void;
  patientName: string;
  lang?: Lang;
}

const ACTIONS: ResuscitationAction[] = [
  {
    id: 'defib',
    label: 'Дефібриляція 200 Дж', labelEn: 'Defibrillation 200 J',
    description: 'Несинхронізований розряд', descEn: 'Unsynchronized shock',
    icon: <Zap size={20} />,
    color: 'bg-yellow-500 hover:bg-yellow-400 border-yellow-400',
    key: 'D',
    cooldown: 3,
  },
  {
    id: 'cpr',
    label: 'СЛР (2 хв)', labelEn: 'CPR (2 min)',
    description: '30:2, частота 100-120/хв', descEn: '30:2, rate 100-120/min',
    icon: <Heart size={20} />,
    color: 'bg-red-600 hover:bg-red-500 border-red-500',
    key: 'C',
    cooldown: 5,
  },
  {
    id: 'epinephrine',
    label: 'Адреналін 1 мг в/в', labelEn: 'Epinephrine 1 mg IV',
    description: 'Кожні 3-5 хв', descEn: 'Every 3-5 min',
    icon: <Activity size={20} />,
    color: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    key: 'A',
    cooldown: 10,
  },
  {
    id: 'amiodarone',
    label: 'Аміодарон 300 мг', labelEn: 'Amiodarone 300 mg',
    description: 'Після 3-го розряду', descEn: 'After 3rd shock',
    icon: <Activity size={20} />,
    color: 'bg-purple-600 hover:bg-purple-500 border-purple-500',
    key: 'M',
    cooldown: 15,
  },
  {
    id: 'atropine',
    label: 'Атропін 1 мг в/в', labelEn: 'Atropine 1 mg IV',
    description: 'При брадикардії / АВ-блокаді I-II ст.', descEn: 'For bradycardia / AV Block I-II°',
    icon: <Activity size={20} />,
    color: 'bg-teal-600 hover:bg-teal-500 border-teal-500',
    key: 'T',
    cooldown: 8,
  },
  {
    id: 'pacing_transcutaneous',
    label: 'Черезшкірна стимуляція', labelEn: 'Transcutaneous Pacing',
    description: 'Частота 60/хв, струм 50-100 мА — при АВ-бл. II-III', descEn: 'Rate 60/min, current 50-100 mA — AV Block II-III°',
    icon: <Zap size={20} />,
    color: 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500',
    key: 'P',
    cooldown: 5,
  },
  {
    id: 'pacing_transvenous',
    label: 'Трансвенозна стимуляція', labelEn: 'Transvenous Pacing',
    description: 'Метод вибору при АВ-бл. III ст. — виклик кардіолога', descEn: 'Method of choice for AV Block III° — call cardiologist',
    icon: <Zap size={20} />,
    color: 'bg-indigo-500 hover:bg-indigo-400 border-indigo-400',
    key: 'V',
    cooldown: 10,
  },
];

// Логіка результатів дій
const evaluateAction = (
  actionId: string,
  rhythm: RhythmType,
  history: ResuscitationEvent[],
  timeElapsed: number,
): { newRhythm: RhythmType | null; message: string; correct: boolean } => {
  const defibCount = history.filter(e => e.action === 'defib').length;
  const cprCount = history.filter(e => e.action === 'cpr').length;
  const epiCount = history.filter(e => e.action === 'epinephrine').length;
  const amioCount = history.filter(e => e.action === 'amiodarone').length;

  if (rhythm === 'vfib') {
    if (actionId === 'defib') {
      // Після 1-го розряду без СЛР — шанс 30%
      // Після СЛР + розряд — шанс 60%
      // Після аміодарону + розряд — шанс 75%
      const hasCPR = cprCount > 0;
      const hasAmio = amioCount > 0;
      const chance = hasAmio ? 0.75 : hasCPR ? 0.6 : 0.3;

      if (Math.random() < chance) {
        return {
          newRhythm: 'sinus',
          message: '✅ Відновлення синусового ритму після дефібриляції!',
          correct: true,
        };
      } else {
        return {
          newRhythm: null,
          message: defibCount === 0
            ? '⚠️ Розряд без ефекту. Проведіть СЛР перед наступним розрядом.'
            : '⚠️ Без ефекту. Продовжуйте СЛР + адреналін.',
          correct: defibCount <= 3,
        };
      }
    }

    if (actionId === 'cpr') {
      return {
        newRhythm: null,
        message: '✅ СЛР розпочато. Забезпечує перфузію міокарда.',
        correct: true,
      };
    }

    if (actionId === 'epinephrine') {
      if (epiCount === 0 && cprCount === 0) {
        return {
          newRhythm: null,
          message: '⚠️ Адреналін введено, але спочатку потрібна дефібриляція + СЛР.',
          correct: false,
        };
      }
      return {
        newRhythm: null,
        message: '✅ Адреналін 1 мг введено. Підвищує шанс відновлення ритму.',
        correct: true,
      };
    }

    if (actionId === 'amiodarone') {
      if (defibCount < 3) {
        return {
          newRhythm: null,
          message: `⚠️ Аміодарон показаний після 3-го розряду. Зараз проведено ${defibCount}.`,
          correct: false,
        };
      }
      return {
        newRhythm: null,
        message: '✅ Аміодарон 300 мг введено. Антиаритмічний ефект.',
        correct: true,
      };
    }
  }

  if (rhythm === 'vtach') {
    if (actionId === 'defib') {
      return {
        newRhythm: Math.random() < 0.7 ? 'sinus' : 'vfib',
        message: Math.random() < 0.7
          ? '✅ Кардіоверсія успішна. Синусовий ритм відновлено.'
          : '⚠️ Шлуночкова тахікардія перейшла у фібриляцію!',
        correct: true,
      };
    }
    if (actionId === 'amiodarone') {
      return {
        newRhythm: Math.random() < 0.5 ? 'sinus' : null,
        message: Math.random() < 0.5
          ? '✅ Аміодарон ефективний. Ритм відновлено.'
          : '⚠️ Без ефекту. Розгляньте кардіоверсію.',
        correct: true,
      };
    }
  }

  // ── АВ-блокада III ст. (повна) ──────────────────────────
  if (rhythm === 'av_block_3') {
    if (actionId === 'defib') {
      return {
        newRhythm: null,
        message: '❌ Дефібриляція не показана при АВ-блокаді. Це не фібриляція шлуночків.',
        correct: false,
      };
    }
    if (actionId === 'atropine') {
      // Атропін малоефективний при повній блокаді
      return {
        newRhythm: Math.random() < 0.2 ? 'av_block_2_mobitz2' : null,
        message: Math.random() < 0.2
          ? '⚠️ Незначне покращення після атропіну. Але трансвенозна стимуляція — метод вибору.'
          : '⚠️ Атропін без ефекту. При АВ-бл. III ст. атропін зазвичай неефективний. Потрібна стимуляція.',
        correct: false,
      };
    }
    if (actionId === 'pacing_transcutaneous') {
      return {
        newRhythm: 'paced',
        message: '✅ Черезшкірна стимуляція розпочата. ЧСС 60/хв. Тимчасовий захід — організуйте трансвенозну стимуляцію.',
        correct: true,
      };
    }
    if (actionId === 'pacing_transvenous') {
      return {
        newRhythm: 'paced',
        message: '✅ Трансвенозна стимуляція встановлена. Стабільний водій ритму 60/хв. Метод вибору виконано.',
        correct: true,
      };
    }
    if (actionId === 'epinephrine') {
      return {
        newRhythm: null,
        message: '⚠️ Адреналін не є лікуванням АВ-блокади. Не замінює стимуляцію.',
        correct: false,
      };
    }
  }

  // ── АВ-блокада II ст. Мобітц II ──────────────────────────
  if (rhythm === 'av_block_2_mobitz2') {
    if (actionId === 'atropine') {
      return {
        newRhythm: Math.random() < 0.3 ? 'av_block_1' : null,
        message: Math.random() < 0.3
          ? '⚠️ Атропін частково покращив провідність. Але ризик прогресування зберігається — розгляньте стимуляцію.'
          : '⚠️ Атропін без ефекту. При Мобітц II атропін часто неефективний. Потрібна стимуляція.',
        correct: false,
      };
    }
    if (actionId === 'pacing_transcutaneous') {
      return {
        newRhythm: 'paced',
        message: '✅ Черезшкірна стимуляція. Профілактика повної блокади. Правильне рішення при Мобітц II.',
        correct: true,
      };
    }
    if (actionId === 'pacing_transvenous') {
      return {
        newRhythm: 'paced',
        message: '✅ Трансвенозна стимуляція — оптимальний вибір при Мобітц II з нестабільною гемодинамікою.',
        correct: true,
      };
    }
    if (actionId === 'defib') {
      return {
        newRhythm: null,
        message: '❌ Дефібриляція не показана при АВ-блокаді II ст.',
        correct: false,
      };
    }
  }

  // ── АВ-блокада II ст. Мобітц I (Венкебах) ────────────────
  if (rhythm === 'av_block_2_mobitz1') {
    if (actionId === 'atropine') {
      return {
        newRhythm: Math.random() < 0.6 ? 'av_block_1' : null,
        message: Math.random() < 0.6
          ? '✅ Атропін ефективний. Венкебах зазвичай добре відповідає на атропін.'
          : '⚠️ Часткова відповідь. Повторіть або спостерігайте.',
        correct: true,
      };
    }
    if (actionId === 'pacing_transcutaneous') {
      return {
        newRhythm: 'paced',
        message: '✅ Стимуляція при симптомній Мобітц I. Допустимо, але атропін — перший крок.',
        correct: true,
      };
    }
    if (actionId === 'defib') {
      return {
        newRhythm: null,
        message: '❌ Дефібриляція не показана при АВ-блокаді.',
        correct: false,
      };
    }
  }

  // ── АВ-блокада I ст. ─────────────────────────────────────
  if (rhythm === 'av_block_1') {
    if (actionId === 'pacing_transcutaneous' || actionId === 'pacing_transvenous') {
      return {
        newRhythm: null,
        message: '⚠️ Стимуляція при АВ-бл. I ст. не показана. Спостереження достатнє.',
        correct: false,
      };
    }
    if (actionId === 'atropine') {
      return {
        newRhythm: 'sinus',
        message: '⚠️ Атропін при АВ-бл. I ст. зазвичай не потрібен. Але PR інтервал нормалізувався.',
        correct: false,
      };
    }
  }

  return {
    newRhythm: null,
    message: 'Дія зареєстрована.',
    correct: true,
  };
};

const ResuscitationPanel: React.FC<ResuscitationPanelProps> = ({
  rhythm,
  onRhythmChange,
  onClose,
  patientName,
  lang = 'ua',
}) => {
  const [events, setEvents] = useState<ResuscitationEvent[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [lastMessage, setLastMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isCPRActive, setIsCPRActive] = useState(false);
  const cprIntervalRef = useRef<number>(0);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    timerRef.current = window.setInterval(() => setTimeElapsed(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Tick cooldowns
  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (updated[k] > 0) updated[k]--;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (action: ResuscitationAction) => {
    if ((cooldowns[action.id] || 0) > 0) return;

    // Встановлюємо cooldown
    setCooldowns(prev => ({ ...prev, [action.id]: action.cooldown }));

    // СЛР — активуємо анімацію та звук
    if (action.id === 'cpr') {
      setIsCPRActive(true);
      let count = 0;
      cprIntervalRef.current = window.setInterval(() => {
        playCPRBeep();
        count++;
        if (count >= 30) {
          clearInterval(cprIntervalRef.current);
          setIsCPRActive(false);
        }
      }, 500);
    }

    // Дефібриляція — звук
    if (action.id === 'defib') {
      playDefibrillatorShock(() => {
        const result = evaluateAction(action.id, rhythm, events, timeElapsed);
        const event: ResuscitationEvent = {
          time: timeElapsed,
          action: action.id,
          result: result.message,
          correct: result.correct,
        };
        setEvents(prev => [event, ...prev]);
        setLastMessage(result.message);

        if (result.newRhythm) {
          onRhythmChange(result.newRhythm);
          if (result.newRhythm === 'sinus') setIsSuccess(true);
        }
      });
      return;
    }

    const result = evaluateAction(action.id, rhythm, events, timeElapsed);
    const event: ResuscitationEvent = {
      time: timeElapsed,
      action: action.id,
      result: result.message,
      correct: result.correct,
    };
    setEvents(prev => [event, ...prev]);
    setLastMessage(result.message);

    if (result.newRhythm) {
      onRhythmChange(result.newRhythm);
      if (result.newRhythm === 'sinus') setIsSuccess(true);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const isAvBlock = ['av_block_1','av_block_2_mobitz1','av_block_2_mobitz2','av_block_3'].includes(rhythm);

  // Show relevant actions based on rhythm
  const visibleActions = ACTIONS.filter(a => {
    if (isAvBlock) {
      // Hide amiodarone for AV blocks, show pacing + atropine
      if (a.id === 'amiodarone') return false;
      if (a.id === 'cpr') return false;
    } else {
      // Hide pacing for VFib/VTach/asystole
      if (a.id === 'pacing_transcutaneous' || a.id === 'pacing_transvenous') return false;
      if (a.id === 'atropine') return false;
    }
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-[#0d0f14] border border-red-900/50 rounded-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className={`p-4 flex items-center justify-between ${isSuccess ? 'bg-green-900/30 border-b border-green-700/50' : 'bg-red-900/20 border-b border-red-800/50'}`}>
          <div className="flex items-center gap-3">
            {isSuccess
              ? <CheckCircle className="text-green-400" size={24} />
              : <AlertTriangle className="text-red-400 animate-pulse" size={24} />
            }
            <div>
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                {isSuccess ? (lang === 'ua' ? 'РИТМ ВІДНОВЛЕНО' : 'RHYTHM RESTORED') :
                  isAvBlock ? (lang === 'ua' ? 'АВ-БЛОКАДА — ПОРУШЕННЯ ПРОВІДНОСТІ' : 'AV BLOCK — CONDUCTION DISORDER') :
                  (lang === 'ua' ? 'ЗУПИНКА СЕРЦЯ — РЕАНІМАЦІЯ' : 'CARDIAC ARREST — RESUSCITATION')}
              </h2>
              <p className="text-[11px] text-gray-400">{patientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <Clock size={14} className="text-gray-500" />
              <span className={timeElapsed > 120 ? 'text-red-400' : 'text-white'}>{formatTime(timeElapsed)}</span>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white">
              <X size={16}/>
            </button>
            {isSuccess && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded"
              >
                ЗАВЕРШИТИ
              </button>
            )}
          </div>
        </div>

        {!isSuccess && (
          <>
            {/* CPR Animation */}
            <AnimatePresence>
              {isCPRActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-900/30 border-b border-red-800/30 p-2 text-center"
                >
                  <span className="text-red-400 font-bold text-sm animate-pulse uppercase tracking-widest">
                    ⚡ СЛР АКТИВНА — 100/хв ⚡
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Last message */}
            {lastMessage && (
              <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 text-[11px] text-gray-300">
                {lastMessage}
              </div>
            )}

            {/* Action buttons */}
            <div className="p-4 grid grid-cols-2 gap-3">
              {visibleActions.map(action => {
                const cd = cooldowns[action.id] || 0;
                const isDisabled = cd > 0;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    disabled={isDisabled}
                    className={`
                      relative p-3 rounded border text-left transition-all overflow-hidden
                      ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-900 border-gray-700' : action.color}
                      text-white
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {action.icon}
                      <span className="font-bold text-sm">{lang === 'ua' ? action.label : action.labelEn}</span>
                      <span className="ml-auto text-[10px] font-mono border border-white/20 px-1 rounded">
                        [{action.key}]
                      </span>
                    </div>
                    <p className="text-[10px] opacity-70">{lang === 'ua' ? action.description : action.descEn}</p>
                    {isDisabled && (
                      <div className="absolute bottom-1 right-2 text-[10px] font-mono opacity-70">
                        {cd}s
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Event log */}
        <div className="border-t border-gray-800 max-h-40 overflow-y-auto">
          <div className="p-2 text-[9px] font-bold text-gray-600 uppercase tracking-widest border-b border-gray-800 bg-[#11141D]">
            Журнал реанімації
          </div>
          {events.length === 0 ? (
            <div className="p-3 text-[10px] text-gray-600 text-center">Дії ще не виконувались</div>
          ) : (
            events.map((e, i) => (
              <div key={i} className={`px-3 py-1.5 border-b border-gray-900 flex gap-3 items-start text-[11px] ${e.correct ? '' : 'bg-red-900/10'}`}>
                <span className="font-mono text-gray-600 flex-shrink-0">{formatTime(e.time)}</span>
                <span className="text-gray-300">{e.result}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ResuscitationPanel;
