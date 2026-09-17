// aclfEngine.ts — Гостра лівошлуночкова недостатність / набряк легень
import { Lang } from './i18n';

export type ACLFVariant = 'hypertensive' | 'normotensive' | 'cardiogenic_shock';

export interface ACLFProfile {
  variant: ACLFVariant;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  surgeryContext: { ua: string; en: string };
  // Початкові показники
  initialHR: number;
  initialSystolic: number;
  initialDiastolic: number;
  initialSpO2: number;
  initialCVP: number;
  hasAorticInsufficiency: boolean; // важливо для ІАБП
  // Прогресія без лікування
  spo2DeclinePerMin: number;
  bpChangePerMin: number;
  hrIncreasePerMin: number;
}

export const ACLF_PROFILES: Record<ACLFVariant, ACLFProfile> = {
  hypertensive: {
    variant: 'hypertensive',
    label: { ua: 'Гіпертензивний набряк легень', en: 'Hypertensive Pulmonary Edema' },
    description: { ua: 'АТ 172/105, SpO₂ 88%, ЧСС 118/хв', en: 'BP 172/105, SpO₂ 88%, HR 118/min' },
    surgeryContext: { ua: 'Після протезування АК (ШК), 8 год тому. АГ в анамнезі.', en: 'After AV replacement (CPB), 8h ago. Hx of hypertension.' },
    initialHR: 118,
    initialSystolic: 172,
    initialDiastolic: 105,
    initialSpO2: 88,
    initialCVP: 18,
    hasAorticInsufficiency: false,
    spo2DeclinePerMin: 0.5,
    bpChangePerMin: 1.5,
    hrIncreasePerMin: 1.0,
  },
  normotensive: {
    variant: 'normotensive',
    label: { ua: 'Нормотензивна ГЛШ-Н', en: 'Normotensive ACLF' },
    description: { ua: 'АТ 105/70, SpO₂ 90%, ЧСС 125/хв', en: 'BP 105/70, SpO₂ 90%, HR 125/min' },
    surgeryContext: { ua: 'Після АКШ ×3 (ШК), 12 год тому. Периопераційна дисфункція ЛШ.', en: 'After CABG ×3 (CPB), 12h ago. Perioperative LV dysfunction.' },
    initialHR: 125,
    initialSystolic: 105,
    initialDiastolic: 70,
    initialSpO2: 90,
    initialCVP: 22,
    hasAorticInsufficiency: false,
    spo2DeclinePerMin: 0.8,
    bpChangePerMin: -0.8,
    hrIncreasePerMin: 1.5,
  },
  cardiogenic_shock: {
    variant: 'cardiogenic_shock',
    label: { ua: 'Кардіогенний шок + набряк легень', en: 'Cardiogenic Shock + Pulmonary Edema' },
    description: { ua: 'АТ 78/50, SpO₂ 86%, ЧСС 138/хв', en: 'BP 78/50, SpO₂ 86%, HR 138/min' },
    surgeryContext: { ua: 'Після протезування МК (ШК), 6 год тому. ФВ 28% на доопераційному ехо.', en: 'After MV replacement (CPB), 6h ago. Pre-op EF 28%.' },
    initialHR: 138,
    initialSystolic: 78,
    initialDiastolic: 50,
    initialSpO2: 86,
    initialCVP: 28,
    hasAorticInsufficiency: false,
    spo2DeclinePerMin: 1.2,
    bpChangePerMin: -1.5,
    hrIncreasePerMin: 2.0,
  },
};

export const pickACLFVariant = (surgeryType: string): ACLFVariant => {
  const lower = surgeryType.toLowerCase();
  if (lower.includes('ак') || lower.includes('аортальн') || lower.includes('aortic valve')) return 'hypertensive';
  if (lower.includes('мк') || lower.includes('мітральн') || lower.includes('mitral')) return 'cardiogenic_shock';
  if (lower.includes('акш') || lower.includes('cabg')) return 'normotensive';
  const variants: ACLFVariant[] = ['hypertensive', 'normotensive', 'cardiogenic_shock'];
  return variants[Math.floor(Math.random() * variants.length)];
};

// ============================================================
// ДІАГНОСТИЧНІ ТЕСТИ
// ============================================================
export interface ACLFTest {
  id: string;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  icon: string;
  cooldown: number;
}

export const ACLF_TESTS: ACLFTest[] = [
  {
    id: 'clinical',
    label: { ua: 'Клінічна оцінка (аускультація)', en: 'Clinical assessment (auscultation)' },
    description: { ua: 'Хрипи в легенях, тони серця, периферичний набряк', en: 'Lung crackles, heart sounds, peripheral edema' },
    icon: '🩺',
    cooldown: 1,
  },
  {
    id: 'echo',
    label: { ua: 'ЕхоКС (ФВ, клапани)', en: 'Echo (EF, valves)' },
    description: { ua: 'ФВ ЛШ, функція протезу, тиск у ЛА', en: 'LV EF, prosthesis function, PA pressure' },
    icon: '🔵',
    cooldown: 5,
  },
  {
    id: 'xray',
    label: { ua: 'Рентген грудної клітки', en: 'Chest X-ray' },
    description: { ua: 'Набряк легень, кардіомегалія, плевральний випіт', en: 'Pulmonary edema, cardiomegaly, pleural effusion' },
    icon: '🩻',
    cooldown: 4,
  },
  {
    id: 'bnp',
    label: { ua: 'NT-proBNP / BNP', en: 'NT-proBNP / BNP' },
    description: { ua: 'Маркер серцевої недостатності. >900 пг/мл — значуще', en: 'Heart failure marker. >900 pg/ml — significant' },
    icon: '🧪',
    cooldown: 5,
  },
  {
    id: 'abg',
    label: { ua: 'Газовий склад крові (АГК)', en: 'Arterial Blood Gas (ABG)' },
    description: { ua: 'PaO₂, PaCO₂, pH — оцінка тяжкості гіпоксемії', en: 'PaO₂, PaCO₂, pH — assess hypoxemia severity' },
    icon: '💨',
    cooldown: 3,
  },
  {
    id: 'aortic_insufficiency',
    label: { ua: 'Перевірити наявність АН (ЕхоКС)', en: 'Check for Aortic Insufficiency (Echo)' },
    description: { ua: 'Важливо перед призначенням ІАБП!', en: 'Critical before IABP placement!' },
    icon: '⚠️',
    cooldown: 3,
  },
];

// ============================================================
// ЛІКУВАЛЬНІ ДІЇ
// ============================================================
export interface ACLFAction {
  id: string;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  icon: string;
  color: string;
  cooldown: number;
  isPrimary?: boolean;
  category: 'ventilation' | 'diuretics' | 'vasodilators' | 'inotropes' | 'mechanical' | 'support';
  contraindicatedIn?: ACLFVariant[];
  preferredIn?: ACLFVariant[];
}

export const ACLF_ACTIONS: ACLFAction[] = [
  // Вентиляція
  {
    id: 'oxygen_high',
    label: { ua: 'Кисень 10-15 л/хв маска', en: 'Oxygen 10-15 L/min mask' },
    description: { ua: 'Перший крок — максимальна оксигенація', en: 'First step — maximum oxygenation' },
    icon: '💨',
    color: 'bg-blue-700 hover:bg-blue-600 border-blue-600',
    cooldown: 2,
    category: 'ventilation',
  },
  {
    id: 'cpap_niv',
    label: { ua: 'CPAP/НВЛ (PEEP 5-10 смН₂О)', en: 'CPAP/NIV (PEEP 5-10 cmH₂O)' },
    description: { ua: 'Неінвазивна вентиляція — зменшує роботу дихання, покращує оксигенацію', en: 'Non-invasive ventilation — reduces work of breathing, improves oxygenation' },
    icon: '😷',
    color: 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500',
    cooldown: 4,
    isPrimary: true,
    category: 'ventilation',
    preferredIn: ['hypertensive', 'normotensive'],
  },
  {
    id: 'intubation',
    label: { ua: 'Інтубація + ШВЛ', en: 'Intubation + MV' },
    description: { ua: 'При SpO₂ <85% або виснаженні, неефективності НВЛ', en: 'SpO₂ <85% or exhaustion, NIV failure' },
    icon: '🔧',
    color: 'bg-red-700 hover:bg-red-600 border-red-600',
    cooldown: 5,
    isPrimary: true,
    category: 'ventilation',
    preferredIn: ['cardiogenic_shock'],
  },
  // Діуретики
  {
    id: 'furosemide_iv',
    label: { ua: 'Фуросемід 40-80 мг в/в', en: 'Furosemide 40-80 mg IV' },
    description: { ua: 'Зменшення переднавантаження, дегідратація легень', en: 'Reduce preload, pulmonary dehydration' },
    icon: '💧',
    color: 'bg-teal-600 hover:bg-teal-500 border-teal-500',
    cooldown: 4,
    isPrimary: true,
    category: 'diuretics',
    contraindicatedIn: ['cardiogenic_shock'],
  },
  // Вазодилататори
  {
    id: 'nitroglycerine_iv',
    label: { ua: 'Нітрогліцерин в/в 10-200 мкг/хв', en: 'Nitroglycerin IV 10-200 mcg/min' },
    description: { ua: 'Венодилатація — зменшення переднавантаження. При АТ >100', en: 'Venodilation — reduce preload. When BP >100' },
    icon: '💊',
    color: 'bg-green-600 hover:bg-green-500 border-green-500',
    cooldown: 4,
    isPrimary: true,
    category: 'vasodilators',
    contraindicatedIn: ['cardiogenic_shock'],
    preferredIn: ['hypertensive'],
  },
  {
    id: 'isosorbide_sl',
    label: { ua: 'Ізосорбід динітрат 5 мг сублінгв.', en: 'Isosorbide dinitrate 5 mg sublingual' },
    description: { ua: 'Швидка венодилатація, зменшення задухи', en: 'Rapid venodilation, dyspnea relief' },
    icon: '💊',
    color: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
    cooldown: 3,
    category: 'vasodilators',
    contraindicatedIn: ['cardiogenic_shock'],
    preferredIn: ['hypertensive'],
  },
  // Інотропи
  {
    id: 'dobutamine',
    label: { ua: 'Добутамін 2-10 мкг/кг/хв', en: 'Dobutamine 2-10 mcg/kg/min' },
    description: { ua: 'Інотроп — підвищення серцевого викиду при низькому АТ', en: 'Inotrope — increase cardiac output when BP low' },
    icon: '❤️',
    color: 'bg-rose-600 hover:bg-rose-500 border-rose-500',
    cooldown: 4,
    isPrimary: true,
    category: 'inotropes',
    preferredIn: ['normotensive', 'cardiogenic_shock'],
  },
  {
    id: 'norepinephrine',
    label: { ua: 'Норадреналін ↑ дозу', en: 'Norepinephrine ↑ dose' },
    description: { ua: 'Підтримка АТ при кардіогенному шоку', en: 'BP support in cardiogenic shock' },
    icon: '📈',
    color: 'bg-orange-600 hover:bg-orange-500 border-orange-500',
    cooldown: 3,
    category: 'support',
    preferredIn: ['cardiogenic_shock'],
  },
  // Механічна підтримка
  {
    id: 'iabp',
    label: { ua: 'ІАБП (внутрішньоаортальна балонна помпа)', en: 'IABP (Intra-Aortic Balloon Pump)' },
    description: { ua: 'Механічна підтримка ЛШ. ПРОТИПОКАЗАНА при аортальній недостатності!', en: 'Mechanical LV support. CONTRAINDICATED in aortic insufficiency!' },
    icon: '🔴',
    color: 'bg-purple-600 hover:bg-purple-500 border-purple-500',
    cooldown: 8,
    isPrimary: true,
    category: 'mechanical',
    preferredIn: ['cardiogenic_shock'],
  },
  // Позиція
  {
    id: 'position',
    label: { ua: 'Положення сидячи (30-45°)', en: 'Upright position (30-45°)' },
    description: { ua: 'Зменшення венозного повернення, полегшення дихання', en: 'Reduce venous return, ease breathing' },
    icon: '🛏️',
    color: 'bg-slate-600 hover:bg-slate-500 border-slate-500',
    cooldown: 1,
    category: 'support',
  },
];

// ============================================================
// ОЦІНКА ДІЇ
// ============================================================
export interface ACLFActionResult {
  message: { ua: string; en: string };
  hint?: { ua: string; en: string };
  spo2Change: number;
  bpChange: number;
  hrChange: number;
  isStabilizing?: boolean;
  penaltyNote?: { ua: string; en: string };
}

export const evaluateACLFAction = (
  actionId: string,
  variant: ACLFVariant,
  profile: ACLFProfile,
  currentSystolic: number,
  currentSpO2: number,
  testsPerformed: string[],
  actionHistory: string[],
  aorticInsufficiencyChecked: boolean,
): ACLFActionResult => {
  const ua_hint = true;
  const prevCount = actionHistory.filter(a => a === actionId).length;
  const hasEcho = testsPerformed.includes('echo');
  const hasABG  = testsPerformed.includes('abg');

  switch (actionId) {
    case 'oxygen_high':
      return {
        message: {
          ua: `✅ Кисень 15 л/хв маска. SpO₂: ${currentSpO2}% → ${Math.min(94, currentSpO2 + 3)}%. Перший і обов'язковий крок.`,
          en: `✅ Oxygen 15 L/min mask. SpO₂: ${currentSpO2}% → ${Math.min(94, currentSpO2 + 3)}%. First and mandatory step.`,
        },
        spo2Change: 3,
        bpChange: 0,
        hrChange: -3,
      };

    case 'cpap_niv':
      if (variant === 'cardiogenic_shock' && currentSystolic < 80) {
        return {
          message: {
            ua: `⚠️ НВЛ при АТ ${currentSystolic} мм рт.ст. — може погіршити серцевий викид. При кардіогенному шоку — інтубація та ШВЛ з PEEP пріоритетніша.`,
            en: `⚠️ NIV with BP ${currentSystolic} mmHg — may worsen cardiac output. In cardiogenic shock — intubation and MV with PEEP is preferred.`,
          },
          spo2Change: 4,
          bpChange: -5,
          hrChange: -5,
        };
      }
      return {
        message: {
          ua: `✅ CPAP/НВЛ PEEP 8 смН₂О розпочато. SpO₂: ${currentSpO2}% → ${Math.min(97, currentSpO2 + 6)}%. Зменшення роботи дихання. Стандарт при набряку легень.`,
          en: `✅ CPAP/NIV PEEP 8 cmH₂O initiated. SpO₂: ${currentSpO2}% → ${Math.min(97, currentSpO2 + 6)}%. Work of breathing reduced. Standard for pulmonary edema.`,
        },
        spo2Change: 6,
        bpChange: -4,
        hrChange: -8,
        isStabilizing: true,
      };

    case 'intubation':
      if (currentSpO2 > 88 && variant !== 'cardiogenic_shock') {
        return {
          message: {
            ua: `⚠️ Інтубація при SpO₂ ${currentSpO2}% — передчасна. Спочатку спробуйте НВЛ/CPAP. Інтубація — при невдачі НВЛ або SpO₂ <85%.`,
            en: `⚠️ Intubation with SpO₂ ${currentSpO2}% — premature. Try NIV/CPAP first. Intubation for NIV failure or SpO₂ <85%.`,
          },
          spo2Change: 8,
          bpChange: -5,
          hrChange: -10,
          penaltyNote: {
            ua: 'Передчасна інтубація без спроби НВЛ',
            en: 'Premature intubation without NIV trial',
          },
        };
      }
      return {
        message: {
          ua: `✅ Інтубація + ШВЛ з PEEP 8. SpO₂: ${currentSpO2}% → ${Math.min(98, currentSpO2 + 10)}%. Правильне рішення при тяжкій гіпоксемії / кардіогенному шоку.`,
          en: `✅ Intubation + MV with PEEP 8. SpO₂: ${currentSpO2}% → ${Math.min(98, currentSpO2 + 10)}%. Correct decision for severe hypoxemia / cardiogenic shock.`,
        },
        spo2Change: 10,
        bpChange: -3,
        hrChange: -12,
        isStabilizing: true,
      };

    case 'furosemide_iv':
      if (variant === 'cardiogenic_shock' && currentSystolic < 85) {
        return {
          message: {
            ua: `❌ Фуросемід при АТ ${currentSystolic} мм рт.ст. — небезпечний! Зменшить переднавантаження → погіршить серцевий викид і без того низький.`,
            en: `❌ Furosemide with BP ${currentSystolic} mmHg — dangerous! Will reduce preload → worsen already low cardiac output.`,
          },
          spo2Change: -1,
          bpChange: -8,
          hrChange: 5,
          penaltyNote: {
            ua: 'Діуретики при кардіогенному шоку — протипоказано',
            en: 'Diuretics in cardiogenic shock — contraindicated',
          },
        };
      }
      return {
        message: {
          ua: `✅ Фуросемід 80 мг в/в. Діурез розпочався. Зменшення об'єму циркулюючої крові → розвантаження малого кола.`,
          en: `✅ Furosemide 80 mg IV. Diuresis initiated. Reduction in circulating volume → pulmonary circuit unloading.`,
        },
        spo2Change: 3,
        bpChange: -6,
        hrChange: -5,
        isStabilizing: variant !== 'cardiogenic_shock',
      };

    case 'nitroglycerine_iv':
      if (currentSystolic < 100) {
        return {
          message: {
            ua: `❌ Нітрогліцерин при АТ ${currentSystolic} мм рт.ст. — протипоказаний (АТ <100). Різке падіння АТ.`,
            en: `❌ Nitroglycerin with BP ${currentSystolic} mmHg — contraindicated (BP <100). Severe BP drop.`,
          },
          spo2Change: 0,
          bpChange: -15,
          hrChange: 8,
          penaltyNote: {
            ua: 'Нітрати при гіпотензії — протипоказано',
            en: 'Nitrates during hypotension — contraindicated',
          },
        };
      }
      return {
        message: {
          ua: `✅ Нітрогліцерин в/в 50 мкг/хв. АТ: ${currentSystolic} → ${currentSystolic - 25} мм рт.ст. Венодилатація, зменшення переднавантаження.`,
          en: `✅ Nitroglycerin IV 50 mcg/min. BP: ${currentSystolic} → ${currentSystolic - 25} mmHg. Venodilation, preload reduction.`,
        },
        spo2Change: 4,
        bpChange: -25,
        hrChange: -6,
        isStabilizing: variant === 'hypertensive',
      };

    case 'isosorbide_sl':
      if (currentSystolic < 100) {
        return {
          message: {
            ua: `❌ Ізосорбід при АТ ${currentSystolic} мм рт.ст. — протипоказаний.`,
            en: `❌ Isosorbide with BP ${currentSystolic} mmHg — contraindicated.`,
          },
          spo2Change: 0,
          bpChange: -10,
          hrChange: 5,
          penaltyNote: {
            ua: 'Нітрати при гіпотензії — протипоказано',
            en: 'Nitrates during hypotension — contraindicated',
          },
        };
      }
      return {
        message: {
          ua: `✅ Ізосорбід 5 мг сублінгвально. Швидка венодилатація. АТ: ${currentSystolic} → ${currentSystolic - 15} мм рт.ст.`,
          en: `✅ Isosorbide 5 mg sublingual. Rapid venodilation. BP: ${currentSystolic} → ${currentSystolic - 15} mmHg.`,
        },
        spo2Change: 3,
        bpChange: -15,
        hrChange: -4,
        isStabilizing: variant === 'hypertensive',
      };

    case 'dobutamine':
      if (variant === 'hypertensive' && currentSystolic > 130) {
        return {
          message: {
            ua: `⚠️ Добутамін при АТ ${currentSystolic} мм рт.ст. — ризик погіршення гіпертензії та аритмій. При гіпертензивному набряку — нітрати пріоритетніші.`,
            en: `⚠️ Dobutamine with BP ${currentSystolic} mmHg — risk of worsening hypertension and arrhythmias. For hypertensive edema — nitrates are preferred.`,
          },
          spo2Change: 2,
          bpChange: 8,
          hrChange: 12,
          penaltyNote: {
            ua: 'Добутамін при гіпертензивному набряку — не показаний',
            en: 'Dobutamine for hypertensive edema — not indicated',
          },
        };
      }
      return {
        message: {
          ua: `✅ Добутамін 5 мкг/кг/хв. Серцевий викид підвищився. АТ стабілізувався. Правильне рішення при систолічній дисфункції.`,
          en: `✅ Dobutamine 5 mcg/kg/min. Cardiac output increased. BP stabilized. Correct for systolic dysfunction.`,
        },
        spo2Change: 4,
        bpChange: variant === 'cardiogenic_shock' ? 12 : 5,
        hrChange: 8,
        isStabilizing: variant !== 'hypertensive',
      };

    case 'norepinephrine':
      if (variant === 'hypertensive') {
        return {
          message: {
            ua: `❌ Норадреналін при гіпертензивному набряку — протипоказаний! Підвищить і без того високий АТ.`,
            en: `❌ Norepinephrine for hypertensive edema — contraindicated! Will further increase already high BP.`,
          },
          spo2Change: -1,
          bpChange: 20,
          hrChange: 5,
          penaltyNote: {
            ua: 'Вазопресори при гіпертензивному набряку легень',
            en: 'Vasopressors for hypertensive pulmonary edema',
          },
        };
      }
      return {
        message: {
          ua: `✅ Норадреналін збільшено. АТ: ${currentSystolic} → ${currentSystolic + 15} мм рт.ст. Підтримка перфузійного тиску.`,
          en: `✅ Norepinephrine increased. BP: ${currentSystolic} → ${currentSystolic + 15} mmHg. Perfusion pressure support.`,
        },
        spo2Change: 1,
        bpChange: 15,
        hrChange: 3,
      };

    case 'iabp':
      if (!aorticInsufficiencyChecked) {
        return {
          message: {
            ua: `⚠️ ІАБП без перевірки на аортальну недостатність — небезпечно! При АН ІАБП абсолютно протипоказана. Спочатку ЕхоКС для оцінки АН!`,
            en: `⚠️ IABP without checking for aortic insufficiency — dangerous! In AI, IABP is absolutely contraindicated. Echo first to assess AI!`,
          },
          hint: {
            ua: 'ІАБП посилює аортальну регургітацію і може спричинити катастрофічне погіршення.',
            en: 'IABP worsens aortic regurgitation and can cause catastrophic deterioration.',
          },
          spo2Change: 2,
          bpChange: 5,
          hrChange: -5,
          penaltyNote: {
            ua: 'ІАБП без виключення аортальної недостатності',
            en: 'IABP without excluding aortic insufficiency',
          },
        };
      }
      if (profile.hasAorticInsufficiency) {
        return {
          message: {
            ua: `❌ ІАБП при аортальній недостатності — АБСОЛЮТНО ПРОТИПОКАЗАНА! Контрпульсація посилить регургітацію і призведе до катастрофи.`,
            en: `❌ IABP in aortic insufficiency — ABSOLUTELY CONTRAINDICATED! Counterpulsation will worsen regurgitation and cause catastrophe.`,
          },
          spo2Change: -2,
          bpChange: -15,
          hrChange: 15,
          penaltyNote: {
            ua: 'ІАБП при аортальній недостатності — катастрофічна помилка',
            en: 'IABP in aortic insufficiency — catastrophic error',
          },
        };
      }
      if (variant !== 'cardiogenic_shock') {
        return {
          message: {
            ua: `⚠️ ІАБП при ${variant === 'hypertensive' ? 'гіпертензивному набряку' : 'нормотензивній ГЛШ-Н'} — зазвичай не потрібна. Показана при кардіогенному шоку або рефрактерній ГЛШ-Н.`,
            en: `⚠️ IABP for ${variant === 'hypertensive' ? 'hypertensive edema' : 'normotensive ACLF'} — usually not needed. Indicated for cardiogenic shock or refractory ACLF.`,
          },
          spo2Change: 3,
          bpChange: 10,
          hrChange: -8,
        };
      }
      return {
        message: {
          ua: `✅ ІАБП встановлена. Аортальна недостатність виключена — немає протипоказань. Серцевий викид зріс, АТ покращився. Правильне рішення при кардіогенному шоку.`,
          en: `✅ IABP placed. Aortic insufficiency excluded — no contraindications. Cardiac output increased, BP improved. Correct for cardiogenic shock.`,
        },
        spo2Change: 5,
        bpChange: 20,
        hrChange: -15,
        isStabilizing: true,
      };

    case 'position':
      return {
        message: {
          ua: `✅ Положення сидячи 45°. Зменшення венозного повернення. Полегшення дихання. Простий але важливий захід.`,
          en: `✅ Upright position 45°. Reduced venous return. Breathing relief. Simple but important measure.`,
        },
        spo2Change: 2,
        bpChange: -3,
        hrChange: -3,
      };

    default:
      return {
        message: { ua: 'Дія зареєстрована.', en: 'Action recorded.' },
        spo2Change: 0, bpChange: 0, hrChange: 0,
      };
  }
};

// ============================================================
// ДЕБРИФІНГ
// ============================================================
export const getACLFDebrief = (
  variant: ACLFVariant,
  profile: ACLFProfile,
  testsPerformed: string[],
  actionHistory: string[],
  isStabilized: boolean,
  timeMin: number,
  aorticInsufficiencyChecked: boolean,
  lang: Lang = 'ua',
) => {
  const ua = lang === 'ua';
  const isShock = variant === 'cardiogenic_shock';
  const isHyper = variant === 'hypertensive';

  const items = [
    {
      ok: testsPerformed.includes('clinical'),
      text: ua ? 'Виконана клінічна оцінка (аускультація)' : 'Clinical assessment performed (auscultation)',
    },
    {
      ok: actionHistory.includes('oxygen_high'),
      text: ua ? 'Кисень призначено як перший крок' : 'Oxygen prescribed as first step',
    },
    {
      ok: actionHistory.includes('position'),
      text: ua ? 'Піднято узголів\'я (положення сидячи)' : 'Head of bed elevated (upright position)',
    },
    {
      ok: testsPerformed.includes('echo'),
      text: ua ? 'ЕхоКС виконано (ФВ, клапани)' : 'Echo performed (EF, valves)',
    },
    {
      ok: testsPerformed.includes('aortic_insufficiency'),
      text: ua ? 'Перевірено наявність аортальної недостатності перед ІАБП' : 'Aortic insufficiency checked before IABP',
    },
    {
      ok: isHyper
        ? (actionHistory.includes('nitroglycerine_iv') || actionHistory.includes('isosorbide_sl')) && actionHistory.includes('furosemide_iv')
        : isShock
        ? actionHistory.includes('dobutamine')
        : actionHistory.includes('furosemide_iv'),
      text: isHyper
        ? (ua ? 'Нітрати + діуретики при гіпертензивному набряку' : 'Nitrates + diuretics for hypertensive edema')
        : isShock
        ? (ua ? 'Добутамін при кардіогенному шоку' : 'Dobutamine for cardiogenic shock')
        : (ua ? 'Діуретики при нормотензивній ГЛШ-Н' : 'Diuretics for normotensive ACLF'),
    },
    {
      ok: actionHistory.includes('cpap_niv') || actionHistory.includes('intubation'),
      text: ua ? 'Вентиляційна підтримка (НВЛ або ШВЛ)' : 'Ventilatory support (NIV or MV)',
    },
    {
      ok: !actionHistory.includes('furosemide_iv') || variant !== 'cardiogenic_shock',
      text: ua ? 'Діуретики не застосовувались при кардіогенному шоку' : 'Diuretics not used in cardiogenic shock',
    },
    {
      ok: !actionHistory.includes('nitroglycerine_iv') || (actionHistory.includes('nitroglycerine_iv') && variant !== 'cardiogenic_shock'),
      text: ua ? 'Нітрати не застосовувались при гіпотензії' : 'Nitrates not used during hypotension',
    },
    {
      ok: isStabilized && timeMin < 15,
      text: ua ? 'Стабілізація досягнута вчасно (до 15 хв)' : 'Stabilization achieved in time (within 15 min)',
    },
  ];

  const keyPoints: { ua: string; en: string }[] = [
    { ua: `Варіант: ${profile.label.ua}`, en: `Variant: ${profile.label.en}` },
    { ua: 'Перший крок завжди: кисень + положення сидячи + ЕхоКС', en: 'First steps always: oxygen + upright position + echo' },
    {
      ua: 'ІАБП: абсолютно протипоказана при аортальній недостатності — завжди перевіряти ЕхоКС!',
      en: 'IABP: absolutely contraindicated in aortic insufficiency — always check echo first!',
    },
    {
      ua: 'Гіпертензивний набряк: нітрати (АТ >100) + діуретики + НВЛ',
      en: 'Hypertensive edema: nitrates (BP >100) + diuretics + NIV',
    },
    {
      ua: 'Кардіогенний шок: добутамін + ІАБП (без АН) + ШВЛ. Діуретики — протипоказані!',
      en: 'Cardiogenic shock: dobutamine + IABP (no AI) + MV. Diuretics — contraindicated!',
    },
    {
      ua: 'НВЛ/CPAP: стандарт при SpO₂ <92% без шоку. Інтубація — при невдачі НВЛ або SpO₂ <85%',
      en: 'NIV/CPAP: standard for SpO₂ <92% without shock. Intubation for NIV failure or SpO₂ <85%',
    },
  ];

  return {
    items,
    score: items.filter(i => i.ok).length,
    total: items.length,
    keyPoints: keyPoints.map(k => ua ? k.ua : k.en),
  };
};
