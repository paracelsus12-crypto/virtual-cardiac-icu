import { Lang } from './i18n';
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
  labelUa: string; labelEn: string;
  descUa: string; descEn: string;
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
    labelUa: 'Ехокардіографія', labelEn: 'Echocardiography',
    descUa: 'Візуалізація рідини/згустків у перикарді', descEn: 'Visualize fluid/clots in pericardium',
    icon: '🔵',
    color: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    availableFor: 'both',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 3,
  },
  {
    id: 'consultant',
    labelUa: 'Викликати хірурга / старшого', labelEn: 'Call surgeon / senior',
    descUa: 'Обов\'язково при підозрі на тампонаду після відкритої операції', descEn: 'Mandatory when tamponade suspected after open surgery',
    icon: '📞',
    color: 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500',
    availableFor: 'both',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 2,
  },
  {
    id: 'fluids',
    labelUa: 'Рідинна ресусцитація 500 мл', labelEn: 'Fluid resuscitation 500 ml',
    descUa: 'Тимчасово підтримує серцевий викид. Не усуває причину', descEn: 'Temporarily supports cardiac output. Does not treat cause',
    icon: '💉',
    color: 'bg-cyan-700 hover:bg-cyan-600 border-cyan-600',
    availableFor: 'both',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 4,
  },
  {
    id: 'check_drain',
    labelUa: 'Перевірити / промити дренаж', labelEn: 'Check / flush drain',
    descUa: 'Спроба відновити прохідність при блокуванні згустками', descEn: 'Attempt to restore patency blocked by clots',
    icon: '🔧',
    color: 'bg-slate-600 hover:bg-slate-500 border-slate-500',
    availableFor: 'open',
    requiresEcho: false,
    requiresConsultant: false,
    cooldown: 3,
  },
  {
    id: 'pericardiocentesis',
    labelUa: 'Перикардіоцентез', labelEn: 'Pericardiocentesis',
    descUa: 'Аспірація рідини голкою під ехо-контролем', descEn: 'Needle aspiration under echo guidance',
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
    labelUa: 'Перикардіоцентез (міст)', labelEn: 'Pericardiocentesis (bridge)',
    descUa: '⚠️ Після відкритої операції — згустки, ймовірно неефективний. Лише як міст до реексплорації', descEn: '⚠️ After open surgery — clots, likely ineffective. Bridge to re-exploration only',
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
    labelUa: 'Реексплорація', labelEn: 'Re-exploration',
    descUa: 'Ревізія операційного поля, евакуація згустків, гемостаз', descEn: 'Surgical field revision, clot evacuation, hemostasis',
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
    labelUa: 'Реексплорація (крайній захід)', labelEn: 'Re-exploration (last resort)',
    descUa: 'При невдачі перикардіоцентезу або перфорації коронарної артерії', descEn: 'When pericardiocentesis fails or coronary perforation',
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
  lang: Lang = 'ua',
): ActionResult => {
  const ua = lang === 'ua';
  const fluidCount  = actionHistory.filter(a => a === 'fluids').length;
  const pericCount  = actionHistory.filter(a => a === 'pericardiocentesis').length;
  const drainCount  = actionHistory.filter(a => a === 'check_drain').length;

  switch (actionId) {

    case 'echo': {
      if (echoConfirmed) return { success: false, message: ua ? 'Ехо вже виконано.' : 'Echo already performed.' };
      if (category === 'open') {
        return {
          success: true,
          message: ua ? `⚠️ Ехо: ознаки рідини/згустків у перикарді. Але після відкритої операції ехо може бути хибнонегативним (локальна компресія згустками). Клінічна картина важливіша.` : `⚠️ Echo: signs of fluid/clots in pericardium. After open surgery echo may be false-negative (local clot compression). Clinical picture is more important.`,
          hint: ua ? 'При погіршенні гемодинаміки після відкритої операції — реексплорація без зволікань.' : 'Worsening hemodynamics after open surgery — re-exploration without delay.',
        };
      }
      return {
        success: true,
        message: ua ? `✅ Ехо: ${state.volumeMl} мл рідини в перикарді. Колапс правого шлуночка. Тампонада підтверджена. Перикардіоцентез показаний.` : `✅ Echo: ${state.volumeMl} ml of fluid in pericardium. Right ventricular collapse. Tamponade confirmed. Pericardiocentesis indicated.`,
        hint: ua ? 'Виконайте перикардіоцентез під ехо-контролем.' : 'Perform pericardiocentesis under echo guidance.',
      };
    }

    case 'consultant': {
      if (consultantCalled) return { success: false, message: ua ? 'Хірург вже викликаний і прямує.' : 'Surgeon already called and on the way.' };
      if (category === 'open') {
        return {
          success: true,
          message: ua ? '✅ Хірург викликаний. Прогресія сповільнена. Реексплорація тепер доступна. Готуйте операційну.' : '✅ Surgeon called. Progression slowed. Re-exploration now available. Prepare the OR.',
        };
      }
      return {
        success: true,
        message: ua ? '✅ Старший колега повідомлений. При невдачі перикардіоцентезу — реексплорація доступна.' : '✅ Senior colleague notified. If pericardiocentesis fails — re-exploration available.',
      };
    }

    case 'fluids': {
      if (fluidCount >= 2) return {
        success: false,
        message: ua ? '⚠️ Повторна інфузія малоефективна при тампонаді. Потрібне втручання для усунення причини.' : '⚠️ Repeat infusion ineffective in tamponade. Intervention needed to address the cause.',
      };
      return {
        success: true,
        message: fluidCount === 0
          ? (ua ? '✅ Болюс 500 мл. Тимчасово підвищує переднавантаження. АТ трохи зріс. Це не лікує тампонаду.' : '✅ Bolus 500 ml. Temporarily increases preload. BP slightly improved. This does not treat tamponade.')
          : (ua ? '⚠️ Другий болюс. Мінімальний ефект. Діяти потрібно зараз.' : '⚠️ Second bolus. Minimal effect. Action needed now.'),
        hint: ua ? 'Рідина — лише міст до основного втручання.' : 'Fluid is only a bridge to definitive intervention.',
      };
    }

    case 'check_drain': {
      if (!state.drainBlocked) return {
        success: false,
        message: ua ? 'Дренаж прохідний, виділення є. Причина погіршення — не блокада дренажу.' : 'Drain patent, output present. Deterioration not caused by drain blockage.',
      };
      if (drainCount >= 2) return {
        success: false,
        message: '⚠️ Дренаж не відновлює прохідність — щільні згустки. Реексплорація необхідна.',
        hint: ua ? 'Промивання дренажу при щільних згустках неефективне.' : 'Flushing drain with dense clots is ineffective.',
      };
      return {
        success: true,
        message: drainCount === 0
          ? (ua ? '⚠️ Часткова прохідність відновлена, виділилось ~30 мл. Але тиск не нормалізується — згустки в порожнині перикарда.' : '⚠️ Partial patency restored, ~30 ml drained. But BP not normalizing — clots in pericardial cavity.')
          : (ua ? '⚠️ Дренаж знову заблокований. Реексплорація — єдиний вихід.' : '⚠️ Drain blocked again. Re-exploration is the only option.'),
        hint: 'Після відкритої операції дренаж не вирішує проблему згустків у перикарді.',
      };
    }

    case 'pericardiocentesis': {
      // Тільки для catheter
      if (pericCount > 0) {
        const extra = Math.round(state.volumeMl * 0.4);
        return {
          success: true,
          message: ua ? `✅ Повторна аспірація: евакуйовано ще ${extra} мл. Гемодинаміка покращується.` : `✅ Repeat aspiration: ${extra} ml more evacuated. Hemodynamics improving.`,
          volumeReduction: extra,
          progressionStop: true,
        };
      }
      const evacuated = Math.round(state.volumeMl * 0.70);
      return {
        success: true,
        message: ua ? `✅ Перикардіоцентез успішний. Евакуйовано ${evacuated} мл. АТ зростає, ЧСС знижується.` : `✅ Pericardiocentesis successful. ${evacuated} ml evacuated. BP rising, HR decreasing.`,
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
        message: ua ? `⚠️ Аспіровано лише ${evacuated} мл — решта згустки. Гемодинаміка суттєво не покращилась. РЕЕКСПЛОРАЦІЯ НЕОБХІДНА.` : `⚠️ Only ${evacuated} ml aspirated — rest are clots. Hemodynamics not significantly improved. RE-EXPLORATION REQUIRED.`,
        volumeReduction: evacuated,
        progressionStop: false,
        hint: ua ? 'Перикардіоцентез після відкритої операції — неповноцінний захід. Продовжується кровотеча.' : 'Pericardiocentesis after open surgery is inadequate. Bleeding continues.',
      };
    }

    case 'reexploration': {
      if (!consultantCalled) return {
        success: false,
        message: ua ? '❌ Реексплорація потребує хірурга. Спочатку викличте старшого колегу.' : '❌ Re-exploration requires a surgeon. Call senior colleague first.',
      };
      return {
        success: true,
        message: ua ? '✅ Реексплорація виконана. Евакуйовано згустки, джерело кровотечі ліквідовано. Гемостаз досягнутий. Пацієнт стабілізований.' : '✅ Re-exploration performed. Clots evacuated, bleeding source eliminated. Hemostasis achieved. Patient stabilized.',
        volumeReduction: state.volumeMl,
        progressionStop: true,
        cure: true,
      };
    }

    case 'reexploration_catheter': {
      if (!consultantCalled) return {
        success: false,
        message: ua ? '❌ Потрібен хірург для реексплорації.' : '❌ Surgeon required for re-exploration.',
      };
      if (!echoConfirmed) return {
        success: false,
        message: ua ? '❌ Підтвердіть діагноз ехо перед реексплорацією.' : '❌ Confirm diagnosis with echo before re-exploration.',
      };
      return {
        success: true,
        message: ua ? '✅ Хірургічне втручання виконане. Перфорація ліквідована. Пацієнт стабільний.' : '✅ Surgical intervention completed. Perforation repaired. Patient stable.',
        cure: true,
        progressionStop: true,
        volumeReduction: state.volumeMl,
      };
    }

    default:
      return { success: false, message: ua ? 'Невідома дія.' : 'Unknown action.' };
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
  lang: Lang = 'ua',
): { score: number; total: number; items: { ok: boolean; text: string }[] } => {
  const ua = lang === 'ua';

  const items =
    category === 'open'
      ? [
          { ok: actionHistory.includes('echo'),         text: ua ? 'Виконано ехо (навіть якщо хибнонегативне — правильний крок)' : 'Echo performed (even if false-negative — correct step)' },
          { ok: consultantCalled,                        text: ua ? 'Хірург викликаний своєчасно' : 'Surgeon called in time' },
          { ok: actionHistory.includes('check_drain'),  text: ua ? 'Перевірено прохідність дренажу' : 'Drain patency checked' },
          { ok: actionHistory.includes('fluids'),        text: ua ? 'Рідинна ресусцитація як тимчасовий захід' : 'Fluid resuscitation as temporary measure' },
          { ok: actionHistory.includes('reexploration'), text: ua ? 'Виконана реексплорація — метод вибору' : 'Re-exploration performed — method of choice' },
          { ok: !actionHistory.includes('pericardiocentesis_open') || consultantCalled,
            text: ua ? 'Не покладався лише на перикардіоцентез при відкритій операції' : 'Did not rely solely on pericardiocentesis after open surgery' },
          { ok: isCured && timeMin < 15,                text: ua ? 'Рішення прийнято вчасно (до 15 хв)' : 'Decision made in time (within 15 min)' },
        ]
      : [
          { ok: actionHistory.includes('echo'),                   text: ua ? 'Ехо виконано для підтвердження діагнозу' : 'Echo performed to confirm diagnosis' },
          { ok: consultantCalled,                                  text: ua ? 'Старший колега повідомлений' : 'Senior colleague notified' },
          { ok: actionHistory.includes('fluids'),                  text: ua ? 'Рідинна ресусцитація як тимчасовий захід' : 'Fluid resuscitation as temporary measure' },
          { ok: actionHistory.includes('pericardiocentesis'),      text: 'Перикардіоцентез — основний метод лікування' },
          { ok: actionHistory.indexOf('echo') < actionHistory.indexOf('pericardiocentesis'),
            text: ua ? 'Правильна послідовність: Ехо → Перикардіоцентез' : 'Correct sequence: Echo → Pericardiocentesis' },
          { ok: isCured && timeMin < 15,                          text: ua ? 'Рішення прийнято вчасно (до 15 хв)' : 'Decision made in time (within 15 min)' },
        ];

  const score = items.filter(i => i.ok).length;
  return { score, total: items.length, items };
};

export const PHASE_LABELS: Record<TamponadeState['phase'], { ua: string; en: string }> = {
  stable:      { ua: 'Стабільний',            en: 'Stable' },
  moderate:    { ua: 'Помірна декомпенсація', en: 'Moderate Decompensation' },
  critical:    { ua: 'Критичний стан (шок)',  en: 'Critical (Shock)' },
  preterminal: { ua: 'Передагональний стан',  en: 'Preterminal' },
  arrest:      { ua: 'Зупинка серця',         en: 'Cardiac Arrest' },
};

export const PHASE_COLORS: Record<TamponadeState['phase'], string> = {
  stable:      '#22c55e',
  moderate:    '#f59e0b',
  critical:    '#f97316',
  preterminal: '#ef4444',
  arrest:      '#7f1d1d',
};
