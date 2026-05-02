// tamponadeEngine.ts v2 — постопераційна тампонада серця
// Тактика адаптується під тип втручання

export type SurgeryCategory = 'open' | 'catheter';

// Визначаємо категорію за рядком surgeryType
export const getSurgeryCategory = (surgeryType: string): SurgeryCategory => {
  const lower = surgeryType.toLowerCase();
  const catheterKeywords = [
    'стентування', 'коронарографія', 'коронарограф', 'tavi', 'абляція',
    'катетер', 'ангіопластика', 'балонна', 'транскатетер', 'пункція',
    'stent', 'cath', 'pci', 'ptca', 'ablation',
  ];
  return catheterKeywords.some(k => lower.includes(k)) ? 'catheter' : 'open';
};

export interface TamponadeState {
  timeMin: number;
  volumeMl: number;
  systolicBP: number;
  diastolicBP: number;
  cvp: number;
  hr: number;
  ecgVoltage: number;
  electricalAlternans: boolean;
  paradoxicalPulse: number;
  drainOutput: number;      // мл/год — дренажне виділення (тільки open)
  drainBlocked: boolean;    // дренаж заблокований згустками
  phase: 'stable' | 'moderate' | 'critical' | 'preterminal' | 'arrest';
}

// Часова таблиця прогресії
const TIMELINE: TamponadeState[] = [
  { timeMin: 0,  volumeMl: 50,  systolicBP: 110, diastolicBP: 75, cvp: 8,  hr: 85,  ecgVoltage: 1.00, electricalAlternans: false, paradoxicalPulse: 6,  drainOutput: 80,  drainBlocked: false, phase: 'stable' },
  { timeMin: 5,  volumeMl: 150, systolicBP: 90,  diastolicBP: 65, cvp: 14, hr: 105, ecgVoltage: 0.75, electricalAlternans: false, paradoxicalPulse: 12, drainOutput: 15,  drainBlocked: false, phase: 'moderate' },
  { timeMin: 8,  volumeMl: 220, systolicBP: 78,  diastolicBP: 55, cvp: 18, hr: 118, ecgVoltage: 0.60, electricalAlternans: false, paradoxicalPulse: 15, drainOutput: 0,   drainBlocked: true,  phase: 'moderate' },
  { timeMin: 10, volumeMl: 300, systolicBP: 70,  diastolicBP: 50, cvp: 22, hr: 130, ecgVoltage: 0.50, electricalAlternans: true,  paradoxicalPulse: 18, drainOutput: 0,   drainBlocked: true,  phase: 'critical' },
  { timeMin: 13, volumeMl: 400, systolicBP: 55,  diastolicBP: 40, cvp: 28, hr: 150, ecgVoltage: 0.35, electricalAlternans: true,  paradoxicalPulse: 22, drainOutput: 0,   drainBlocked: true,  phase: 'preterminal' },
  { timeMin: 16, volumeMl: 480, systolicBP: 40,  diastolicBP: 30, cvp: 34, hr: 160, ecgVoltage: 0.25, electricalAlternans: true,  paradoxicalPulse: 25, drainOutput: 0,   drainBlocked: true,  phase: 'preterminal' },
  { timeMin: 20, volumeMl: 520, systolicBP: 0,   diastolicBP: 0,  cvp: 38, hr: 0,   ecgVoltage: 0.15, electricalAlternans: false, paradoxicalPulse: 0,  drainOutput: 0,   drainBlocked: true,  phase: 'arrest' },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

export const getTamponadeState = (
  timeMin: number,
  fluidBoosts: number,
  consultantCalled: boolean,
): TamponadeState => {
  const fluidEffect     = Math.min(fluidBoosts * 1.5, 4);
  const consultantSlows = consultantCalled ? 0.80 : 1.0;
  const effectiveTime   = Math.max(0, (timeMin - fluidEffect) * consultantSlows);

  let i = TIMELINE.length - 2;
  for (let j = 0; j < TIMELINE.length - 1; j++) {
    if (effectiveTime <= TIMELINE[j + 1].timeMin) { i = j; break; }
  }
  const a  = TIMELINE[i];
  const b  = TIMELINE[Math.min(i + 1, TIMELINE.length - 1)];
  const tc = b.timeMin === a.timeMin ? 1 : (effectiveTime - a.timeMin) / (b.timeMin - a.timeMin);

  return {
    timeMin:             effectiveTime,
    volumeMl:            Math.round(lerp(a.volumeMl, b.volumeMl, tc)),
    systolicBP:          Math.round(lerp(a.systolicBP, b.systolicBP, tc)),
    diastolicBP:         Math.round(lerp(a.diastolicBP, b.diastolicBP, tc)),
    cvp:                 Math.round(lerp(a.cvp, b.cvp, tc)),
    hr:                  Math.round(lerp(a.hr, b.hr, tc)),
    ecgVoltage:          lerp(a.ecgVoltage, b.ecgVoltage, tc),
    electricalAlternans: effectiveTime >= 10,
    paradoxicalPulse:    Math.round(lerp(a.paradoxicalPulse, b.paradoxicalPulse, tc)),
    drainOutput:         Math.round(lerp(a.drainOutput, b.drainOutput, tc)),
    drainBlocked:        effectiveTime >= 8,
    phase:
      effectiveTime >= 20 ? 'arrest' :
      effectiveTime >= 13 ? 'preterminal' :
      effectiveTime >= 10 ? 'critical' :
      effectiveTime >= 5  ? 'moderate' : 'stable',
  };
};

// ============================================================
// ДІЇ — різні набори для open vs catheter
// ============================================================
export interface TamponadeAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  availableFor: SurgeryCategory | 'both';
  requiresEcho: boolean;
  requiresConsultant: boolean;
  cooldown: number;
  isPrimary?: boolean;   // основна дія для даної категорії
  isWarning?: boolean;   // доступна але з застереженням
}

export const ALL_ACTIONS: TamponadeAction[] = [
  {
    id: 'echo',
    label: 'Ехокардіографія',
    description: 'Візуалізація рідини/згустків у перикарді',
    icon: '🔵',
    color: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    availableFor: 'both',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 3,
  },
  {
    id: 'consultant',
    label: 'Викликати хірурга / старшого',
    description: 'Обов\'язково при підозрі на тампонаду після відкритої операції',
    icon: '📞',
    color: 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500',
    availableFor: 'both',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 2,
  },
  {
    id: 'fluids',
    label: 'Рідинна ресусцитація 500 мл',
    description: 'Тимчасово підтримує серцевий викид. Не усуває причину',
    icon: '💉',
    color: 'bg-cyan-700 hover:bg-cyan-600 border-cyan-600',
    availableFor: 'both',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 4,
  },
  {
    id: 'check_drain',
    label: 'Перевірити / промити дренаж',
    description: 'Спроба відновити прохідність при блокуванні згустками',
    icon: '🔧',
    color: 'bg-slate-600 hover:bg-slate-500 border-slate-500',
    availableFor: 'open',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 3,
  },
  {
    id: 'pericardiocentesis',
    label: 'Перикардіоцентез',
    description: 'Аспірація рідини голкою під ехо-контролем',
    icon: '🟡',
    color: 'bg-yellow-600 hover:bg-yellow-500 border-yellow-500',
    availableFor: 'catheter',
    requiresEcho: true,
    requiresConsultant: false,
    cooldown: 5,
    isPrimary: true,
  },
  {
    id: 'pericardiocentesis_open',
    label: 'Перикардіоцентез (міст)',
    description: '⚠️ Після відкритої операції — згустки, ймовірно неефективний. Лише як міст до реексплорації',
    icon: '⚠️',
    color: 'bg-orange-700 hover:bg-orange-600 border-orange-600',
    availableFor: 'open',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 5,
    isWarning: true,
  },
  {
    id: 'reexploration',
    label: 'Реексплорація',
    description: 'Ревізія операційного поля, евакуація згустків, гемостаз',
    icon: '🔴',
    color: 'bg-red-600 hover:bg-red-500 border-red-500',
    availableFor: 'open',
    requiresEcho: false,
    requiresConsultant: true,
    cooldown: 8,
    isPrimary: true,
  },
  {
    id: 'reexploration_catheter',
    label: 'Реексплорація (крайній захід)',
    description: 'При невдачі перикардіоцентезу або перфорації коронарної артерії',
    icon: '🔴',
    color: 'bg-red-700 hover:bg-red-600 border-red-600',
    availableFor: 'catheter',
    requiresEcho: true,
    requiresConsultant: true,
    cooldown: 8,
  },
];

export const getActionsForCategory = (category: SurgeryCategory): TamponadeAction[] =>
  ALL_ACTIONS.filter(a => a.availableFor === 'both' || a.availableFor === category);

// ============================================================
// ОЦІНКА ДІЇ
// ============================================================
export interface ActionResult {
  success: boolean;
  message: string;
  hint?: string;
  volumeReduction?: number;
  progressionStop?: boolean;
  cure?: boolean;
}

export const evaluateTamponadeAction = (
  actionId: string,
  state: TamponadeState,
  category: SurgeryCategory,
  echoConfirmed: boolean,
  consultantCalled: boolean,
  actionHistory: string[],
): ActionResult => {
  const fluidCount  = actionHistory.filter(a => a === 'fluids').length;
  const pericCount  = actionHistory.filter(a => a === 'pericardiocentesis').length;
  const drainCount  = actionHistory.filter(a => a === 'check_drain').length;

  switch (actionId) {

    case 'echo': {
      if (echoConfirmed) return { success: false, message: 'Ехо вже виконано.' };
      if (category === 'open') {
        return {
          success: true,
          message: `⚠️ Ехо: ознаки рідини/згустків у перикарді. Але після відкритої операції ехо може бути хибнонегативним (локальна компресія згустками). Клінічна картина важливіша.`,
          hint: 'При погіршенні гемодинаміки після відкритої операції — реексплорація без зволікань.',
        };
      }
      return {
        success: true,
        message: `✅ Ехо: ${state.volumeMl} мл рідини в перикарді. Колапс правого шлуночка. Тампонада підтверджена. Перикардіоцентез показаний.`,
        hint: 'Виконайте перикардіоцентез під ехо-контролем.',
      };
    }

    case 'consultant': {
      if (consultantCalled) return { success: false, message: 'Хірург вже викликаний і прямує.' };
      if (category === 'open') {
        return {
          success: true,
          message: '✅ Хірург викликаний. Прогресія сповільнена. Реексплорація тепер доступна. Готуйте операційну.',
        };
      }
      return {
        success: true,
        message: '✅ Старший колега повідомлений. При невдачі перикардіоцентезу — реексплорація доступна.',
      };
    }

    case 'fluids': {
      if (fluidCount >= 2) return {
        success: false,
        message: '⚠️ Повторна інфузія малоефективна при тампонаді. Потрібне втручання для усунення причини.',
      };
      return {
        success: true,
        message: fluidCount === 0
          ? '✅ Болюс 500 мл. Тимчасово підвищує переднавантаження. АТ трохи зріс. Це не лікує тампонаду.'
          : '⚠️ Другий болюс. Мінімальний ефект. Діяти потрібно зараз.',
        hint: 'Рідина — лише міст до основного втручання.',
      };
    }

    case 'check_drain': {
      if (!state.drainBlocked) return {
        success: false,
        message: 'Дренаж прохідний, виділення є. Причина погіршення — не блокада дренажу.',
      };
      if (drainCount >= 2) return {
        success: false,
        message: '⚠️ Дренаж не відновлює прохідність — щільні згустки. Реексплорація необхідна.',
        hint: 'Промивання дренажу при щільних згустках неефективне.',
      };
      return {
        success: true,
        message: drainCount === 0
          ? '⚠️ Часткова прохідність відновлена, виділилось ~30 мл. Але тиск не нормалізується — згустки в порожнині перикарда.'
          : '⚠️ Дренаж знову заблокований. Реексплорація — єдиний вихід.',
        hint: 'Після відкритої операції дренаж не вирішує проблему згустків у перикарді.',
      };
    }

    case 'pericardiocentesis': {
      // Тільки для catheter
      if (pericCount > 0) {
        const extra = Math.round(state.volumeMl * 0.4);
        return {
          success: true,
          message: `✅ Повторна аспірація: евакуйовано ще ${extra} мл. Гемодинаміка покращується.`,
          volumeReduction: extra,
          progressionStop: true,
        };
      }
      const evacuated = Math.round(state.volumeMl * 0.70);
      return {
        success: true,
        message: `✅ Перикардіоцентез успішний. Евакуйовано ${evacuated} мл. АТ зростає, ЧСС знижується.`,
        volumeReduction: evacuated,
        progressionStop: true,
        cure: state.volumeMl < 200,
      };
    }

    case 'pericardiocentesis_open': {
      // Після відкритої операції — застереження
      const evacuated = Math.round(state.volumeMl * 0.25); // мало ефективний
      return {
        success: true,
        message: `⚠️ Аспіровано лише ${evacuated} мл — решта згустки. Гемодинаміка суттєво не покращилась. РЕЕКСПЛОРАЦІЯ НЕОБХІДНА.`,
        volumeReduction: evacuated,
        progressionStop: false,
        hint: 'Перикардіоцентез після відкритої операції — неповноцінний захід. Продовжується кровотеча.',
      };
    }

    case 'reexploration': {
      if (!consultantCalled) return {
        success: false,
        message: '❌ Реексплорація потребує хірурга. Спочатку викличте старшого колегу.',
      };
      return {
        success: true,
        message: '✅ Реексплорація виконана. Евакуйовано згустки, джерело кровотечі ліквідовано. Гемостаз досягнутий. Пацієнт стабілізований.',
        volumeReduction: state.volumeMl,
        progressionStop: true,
        cure: true,
      };
    }

    case 'reexploration_catheter': {
      if (!consultantCalled) return {
        success: false,
        message: '❌ Потрібен хірург для реексплорації.',
      };
      if (!echoConfirmed) return {
        success: false,
        message: '❌ Підтвердіть діагноз ехо перед реексплорацією.',
      };
      return {
        success: true,
        message: '✅ Хірургічне втручання виконане. Перфорація ліквідована. Пацієнт стабільний.',
        cure: true,
        progressionStop: true,
        volumeReduction: state.volumeMl,
      };
    }

    default:
      return { success: false, message: 'Невідома дія.' };
  }
};

// ============================================================
// ПІДКАЗКИ ДЛЯ ДЕБРИФІНГУ
// ============================================================
export const getDebriefScore = (
  actionHistory: string[],
  category: SurgeryCategory,
  echoConfirmed: boolean,
  consultantCalled: boolean,
  isCured: boolean,
  timeMin: number,
): { score: number; total: number; items: { ok: boolean; text: string }[] } => {

  const items =
    category === 'open'
      ? [
          { ok: actionHistory.includes('echo'),         text: 'Виконано ехо (навіть якщо хибнонегативне — правильний крок)' },
          { ok: consultantCalled,                        text: 'Хірург викликаний своєчасно' },
          { ok: actionHistory.includes('check_drain'),  text: 'Перевірено прохідність дренажу' },
          { ok: actionHistory.includes('fluids'),        text: 'Рідинна ресусцитація як тимчасовий захід' },
          { ok: actionHistory.includes('reexploration'), text: 'Виконана реексплорація — метод вибору' },
          { ok: !actionHistory.includes('pericardiocentesis_open') || consultantCalled,
            text: 'Не покладався лише на перикардіоцентез при відкритій операції' },
          { ok: isCured && timeMin < 15,                text: 'Рішення прийнято вчасно (до 15 хв)' },
        ]
      : [
          { ok: actionHistory.includes('echo'),                   text: 'Ехо виконано для підтвердження діагнозу' },
          { ok: consultantCalled,                                  text: 'Старший колега повідомлений' },
          { ok: actionHistory.includes('fluids'),                  text: 'Рідинна ресусцитація як тимчасовий захід' },
          { ok: actionHistory.includes('pericardiocentesis'),      text: 'Перикардіоцентез — основний метод лікування' },
          { ok: actionHistory.indexOf('echo') < actionHistory.indexOf('pericardiocentesis'),
            text: 'Правильна послідовність: Ехо → Перикардіоцентез' },
          { ok: isCured && timeMin < 15,                          text: 'Рішення прийнято вчасно (до 15 хв)' },
        ];

  const score = items.filter(i => i.ok).length;
  return { score, total: items.length, items };
};

export const PHASE_LABELS: Record<TamponadeState['phase'], string> = {
  stable:      'Стабільний',
  moderate:    'Помірна декомпенсація',
  critical:    'Критичний стан (шок)',
  preterminal: 'Передагональний стан',
  arrest:      'Зупинка серця',
};

export const PHASE_COLORS: Record<TamponadeState['phase'], string> = {
  stable:      '#22c55e',
  moderate:    '#f59e0b',
  critical:    '#f97316',
  preterminal: '#ef4444',
  arrest:      '#7f1d1d',
};
