// afibEngine.ts — Пароксизм ФП після АКШ
import { Lang } from './i18n';

export type AFibVariant = 'stable_tachy' | 'hypotensive_tachy' | 'unstable';

export interface AFibProfile {
  variant: AFibVariant;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  initialHR: number;
  initialSystolic: number;
  initialDiastolic: number;
  k: number;           // K⁺ ммоль/л
  mg: number;          // Mg²⁺ ммоль/л
  hrDeclinePerMin: number;   // при правильному лікуванні
  bpDeclinePerMin: number;   // без лікування
  hrIncreasePerMin: number;  // без лікування
}

export const AFIB_PROFILES: Record<AFibVariant, AFibProfile> = {
  stable_tachy: {
    variant: 'stable_tachy',
    label: { ua: 'Тахісистолія, гемодинаміка стабільна', en: 'Tachysystole, hemodynamics stable' },
    description: { ua: 'ФП з ЧСС 138/хв, АТ 105/70', en: 'AF with HR 138/min, BP 105/70' },
    initialHR: 138, initialSystolic: 105, initialDiastolic: 70,
    k: 3.2, mg: 0.65,
    hrDeclinePerMin: 0, bpDeclinePerMin: 0.5, hrIncreasePerMin: 0.8,
  },
  hypotensive_tachy: {
    variant: 'hypotensive_tachy',
    label: { ua: 'Тахісистолія з гіпотензією', en: 'Tachysystole with hypotension' },
    description: { ua: 'ФП з ЧСС 152/хв, АТ 88/60', en: 'AF with HR 152/min, BP 88/60' },
    initialHR: 152, initialSystolic: 88, initialDiastolic: 60,
    k: 3.0, mg: 0.58,
    hrDeclinePerMin: 0, bpDeclinePerMin: 1.5, hrIncreasePerMin: 1.2,
  },
  unstable: {
    variant: 'unstable',
    label: { ua: 'Нестабільна ФП', en: 'Unstable AF' },
    description: { ua: 'ФП з ЧСС 168/хв, АТ 72/48 — кардіоверсія негайно', en: 'AF with HR 168/min, BP 72/48 — cardioversion immediately' },
    initialHR: 168, initialSystolic: 72, initialDiastolic: 48,
    k: 2.8, mg: 0.52,
    hrDeclinePerMin: 0, bpDeclinePerMin: 2.5, hrIncreasePerMin: 1.5,
  },
};

export const pickAFibVariant = (surgeryType: string): AFibVariant => {
  const lower = surgeryType.toLowerCase();
  if (lower.includes('акш') || lower.includes('cabg')) {
    const r = Math.random();
    if (r < 0.5) return 'stable_tachy';
    if (r < 0.8) return 'hypotensive_tachy';
    return 'unstable';
  }
  const variants: AFibVariant[] = ['stable_tachy', 'hypotensive_tachy', 'unstable'];
  return variants[Math.floor(Math.random() * variants.length)];
};

// ============================================================
// ДІАГНОСТИЧНІ ТЕСТИ
// ============================================================
export interface AFibTest {
  id: string;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  icon: string;
  cooldown: number;
}

export const AFIB_TESTS: AFibTest[] = [
  {
    id: 'ecg12',
    label: { ua: 'ЕКГ 12 відведень', en: '12-lead ECG' },
    description: { ua: 'Підтвердження ФП, виключити ГКС/ішемію', en: 'Confirm AF, exclude ACS/ischemia' },
    icon: '📋',
    cooldown: 2,
  },
  {
    id: 'electrolytes',
    label: { ua: 'Електроліти (K⁺, Mg²⁺)', en: 'Electrolytes (K⁺, Mg²⁺)' },
    description: { ua: 'Найчастіша причина ФП після АКШ — гіпокаліємія/гіпомагніємія', en: 'Most common cause of post-CABG AF — hypokalemia/hypomagnesemia' },
    icon: '🧪',
    cooldown: 3,
  },
  {
    id: 'echo',
    label: { ua: 'ЕхоКС', en: 'Echocardiography' },
    description: { ua: 'ФВ, тромб у вушці ЛП, розмір ЛП', en: 'EF, LAA thrombus, LA size' },
    icon: '🔵',
    cooldown: 4,
  },
  {
    id: 'coag',
    label: { ua: 'Коагулограма / МНО', en: 'Coagulation / INR' },
    description: { ua: 'Перед прийняттям рішення про антикоагуляцію', en: 'Before anticoagulation decision' },
    icon: '📊',
    cooldown: 3,
  },
  {
    id: 'tsh',
    label: { ua: 'ТТГ (тиреотропний гормон)', en: 'TSH (thyroid-stimulating hormone)' },
    description: { ua: 'Виключити тиреотоксикоз як причину ФП', en: 'Exclude thyrotoxicosis as AF cause' },
    icon: '🦋',
    cooldown: 5,
  },
];

// ============================================================
// ЛІКУВАЛЬНІ ДІЇ
// ============================================================
export interface AFibAction {
  id: string;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  icon: string;
  color: string;
  cooldown: number;
  isPrimary?: boolean;
  category: 'prophylaxis' | 'rate_control' | 'rhythm_control' | 'anticoag' | 'support';
}

export const AFIB_ACTIONS: AFibAction[] = [
  // Профілактика
  {
    id: 'metoprolol_po',
    label: { ua: 'Метопролол per os (відновлення)', en: 'Metoprolol oral (resume)' },
    description: { ua: 'Відновити бета-блокатор після операції — профілактика ФП', en: 'Resume beta-blocker post-op — AF prophylaxis' },
    icon: '💊',
    color: 'bg-blue-700 hover:bg-blue-600 border-blue-600',
    cooldown: 3,
    category: 'prophylaxis',
  },
  {
    id: 'magnesium_iv',
    label: { ua: 'Магній 2г в/в за 20 хв', en: 'Magnesium 2g IV over 20 min' },
    description: { ua: 'Профілактика та лікування ФП після АКШ', en: 'AF prophylaxis and treatment after CABG' },
    icon: '💉',
    color: 'bg-teal-600 hover:bg-teal-500 border-teal-500',
    cooldown: 4,
    category: 'prophylaxis',
  },
  {
    id: 'potassium_iv',
    label: { ua: 'Корекція K⁺ в/в', en: 'Potassium correction IV' },
    description: { ua: 'Цільовий K⁺ >4.0 ммоль/л при ФП', en: 'Target K⁺ >4.0 mmol/L in AF' },
    icon: '⚡',
    color: 'bg-yellow-600 hover:bg-yellow-500 border-yellow-500',
    cooldown: 4,
    category: 'prophylaxis',
  },
  // Контроль ЧСС
  {
    id: 'metoprolol_iv',
    label: { ua: 'Метопролол 2.5-5 мг в/в', en: 'Metoprolol 2.5-5 mg IV' },
    description: { ua: 'Контроль ЧСС при стабільній гемодинаміці', en: 'Rate control with stable hemodynamics' },
    icon: '💊',
    color: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    cooldown: 5,
    isPrimary: true,
    category: 'rate_control',
  },
  {
    id: 'digoxin',
    label: { ua: 'Дигоксин 0.25 мг в/в', en: 'Digoxin 0.25 mg IV' },
    description: { ua: 'Контроль ЧСС при ХСН або протипоказаннях до ББ', en: 'Rate control in HF or beta-blocker contraindications' },
    icon: '💊',
    color: 'bg-slate-600 hover:bg-slate-500 border-slate-500',
    cooldown: 5,
    category: 'rate_control',
  },
  // Відновлення ритму
  {
    id: 'amiodarone_iv',
    label: { ua: 'Аміодарон 300 мг в/в → 900 мг/24год', en: 'Amiodarone 300 mg IV → 900 mg/24hr' },
    description: { ua: 'Відновлення синусового ритму або контроль ЧСС', en: 'Sinus rhythm restoration or rate control' },
    icon: '🔴',
    color: 'bg-orange-600 hover:bg-orange-500 border-orange-500',
    cooldown: 6,
    isPrimary: true,
    category: 'rhythm_control',
  },
  {
    id: 'cardioversion',
    label: { ua: 'Кардіоверсія 100-200 Дж (синхр.)', en: 'Cardioversion 100-200 J (sync.)' },
    description: { ua: 'При нестабільній гемодинаміці — негайно', en: 'Unstable hemodynamics — immediately' },
    icon: '⚡',
    color: 'bg-red-600 hover:bg-red-500 border-red-500',
    cooldown: 8,
    isPrimary: true,
    category: 'rhythm_control',
  },
  // Антикоагуляція
  {
    id: 'enoxaparin_therapeutic',
    label: { ua: 'Еноксапарин терапевтична доза', en: 'Enoxaparin therapeutic dose' },
    description: { ua: '1 мг/кг × 2/добу. При ФП >48 год або нестаб. гемодинаміці', en: '1 mg/kg × 2/day. For AF >48h or unstable hemodynamics' },
    icon: '💉',
    color: 'bg-purple-600 hover:bg-purple-500 border-purple-500',
    cooldown: 3,
    category: 'anticoag',
  },
  // Підтримка
  {
    id: 'norepinephrine',
    label: { ua: 'Норадреналін ↑ дозу', en: 'Norepinephrine ↑ dose' },
    description: { ua: 'Підтримка АТ при гіпотензії до відновлення ритму', en: 'BP support during hypotension until rhythm restored' },
    icon: '📈',
    color: 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500',
    cooldown: 3,
    category: 'support',
  },
];

// ============================================================
// ОЦІНКА ДІЇ
// ============================================================
export interface AFibActionResult {
  message: { ua: string; en: string };
  hint?: { ua: string; en: string };
  hrChange: number;
  bpChange: number;
  rhythmRestored?: boolean;
  penaltyNote?: { ua: string; en: string };
}

export const evaluateAFibAction = (
  actionId: string,
  variant: AFibVariant,
  profile: AFibProfile,
  currentHR: number,
  currentSystolic: number,
  testsPerformed: string[],
  actionHistory: string[],
  kCorrected: boolean,
  mgCorrected: boolean,
): AFibActionResult => {
  const isUnstable = currentSystolic < 80 || variant === 'unstable';
  const prevCount = actionHistory.filter(a => a === actionId).length;

  switch (actionId) {
    case 'metoprolol_po':
      return {
        message: {
          ua: '✅ Метопролол per os відновлено. Профілактика ФП після АКШ — бета-блокатори є терапією першої лінії.',
          en: '✅ Metoprolol oral resumed. Post-CABG AF prophylaxis — beta-blockers are first-line therapy.',
        },
        hrChange: -5,
        bpChange: -3,
      };

    case 'magnesium_iv':
      return {
        message: {
          ua: `✅ Магній 2г в/в введено. Mg²⁺ підвищився до 0.95 ммоль/л. Знижує збудливість міокарда, зменшує ризик ФП.`,
          en: `✅ Magnesium 2g IV administered. Mg²⁺ increased to 0.95 mmol/L. Reduces myocardial excitability, decreases AF risk.`,
        },
        hrChange: -8,
        bpChange: 2,
      };

    case 'potassium_iv':
      if (!testsPerformed.includes('electrolytes')) {
        return {
          message: {
            ua: '⚠️ Корекція K⁺ без аналізу електролітів. Спочатку візьміть електроліти щоб знати точну дозу.',
            en: '⚠️ K⁺ correction without electrolyte test. Check electrolytes first to determine exact dose.',
          },
          hint: {
            ua: 'Гіперкаліємія небезпечна. Без аналізу — ризик передозування.',
            en: 'Hyperkalemia is dangerous. Without testing — risk of overdose.',
          },
          hrChange: -3,
          bpChange: 0,
          penaltyNote: {
            ua: 'Корекція електролітів без лабораторного контролю',
            en: 'Electrolyte correction without laboratory monitoring',
          },
        };
      }
      return {
        message: {
          ua: `✅ K⁺ скоригований: ${profile.k} → 4.2 ммоль/л. Гіпокаліємія усунена. Знижує ризик аритмій.`,
          en: `✅ K⁺ corrected: ${profile.k} → 4.2 mmol/L. Hypokalemia resolved. Reduces arrhythmia risk.`,
        },
        hrChange: -10,
        bpChange: 3,
      };

    case 'metoprolol_iv':
      if (isUnstable) {
        return {
          message: {
            ua: `❌ Метопролол в/в при АТ ${currentSystolic} мм рт.ст. — протипоказаний! Негативний інотропний ефект погіршить гіпотензію.`,
            en: `❌ Metoprolol IV with BP ${currentSystolic} mmHg — contraindicated! Negative inotropic effect will worsen hypotension.`,
          },
          hint: {
            ua: 'При нестабільній гемодинаміці — кардіоверсія або аміодарон.',
            en: 'Unstable hemodynamics — cardioversion or amiodarone.',
          },
          hrChange: -15,
          bpChange: -12,
          penaltyNote: {
            ua: 'Метопролол в/в при гіпотензії — погіршення стану',
            en: 'Metoprolol IV during hypotension — condition worsened',
          },
        };
      }
      return {
        message: {
          ua: `✅ Метопролол 5 мг в/в. ЧСС знизилась ${currentHR} → ${Math.max(85, currentHR - 25)}/хв. Гемодинаміка стабільна.`,
          en: `✅ Metoprolol 5 mg IV. HR decreased ${currentHR} → ${Math.max(85, currentHR - 25)}/min. Hemodynamics stable.`,
        },
        hrChange: -25,
        bpChange: -5,
      };

    case 'digoxin':
      return {
        message: {
          ua: '⚠️ Дигоксин — повільний початок дії (4-6 год). Ефективний при ХСН. Після АКШ без ХСН — не перший вибір.',
          en: '⚠️ Digoxin — slow onset (4-6 hr). Effective in HF. After CABG without HF — not first choice.',
        },
        hint: {
          ua: 'Перевага метопрололу в/в або аміодарону при гострій ФП.',
          en: 'Prefer IV metoprolol or amiodarone for acute AF.',
        },
        hrChange: -8,
        bpChange: 0,
      };

    case 'amiodarone_iv':
      if (variant === 'unstable' && currentSystolic < 80) {
        return {
          message: {
            ua: `⚠️ Аміодарон при АТ ${currentSystolic} мм рт.ст. — можливе додаткове зниження АТ. При такій нестабільності — кардіоверсія пріоритетніша.`,
            en: `⚠️ Amiodarone with BP ${currentSystolic} mmHg — may further lower BP. At this instability — cardioversion is preferred.`,
          },
          hint: {
            ua: 'Синхронізована кардіоверсія 100 Дж — метод вибору при нестабільній ФП.',
            en: 'Synchronized cardioversion 100 J — method of choice for unstable AF.',
          },
          hrChange: -20,
          bpChange: -8,
        };
      }
      const rhythmRestored = Math.random() < (kCorrected && mgCorrected ? 0.75 : 0.50);
      return {
        message: rhythmRestored ? {
          ua: `✅ Аміодарон 300 мг в/в. Синусовий ритм відновлено! ЧСС 72/хв, АТ стабілізований.`,
          en: `✅ Amiodarone 300 mg IV. Sinus rhythm restored! HR 72/min, BP stabilized.`,
        } : {
          ua: `✅ Аміодарон 300 мг в/в. ЧСС знизилась до ${Math.max(90, currentHR - 40)}/хв. ФП зберігається, але гемодинаміка покращилась. Продовжити 900 мг/24год.`,
          en: `✅ Amiodarone 300 mg IV. HR decreased to ${Math.max(90, currentHR - 40)}/min. AF persists but hemodynamics improved. Continue 900 mg/24hr.`,
        },
        hrChange: rhythmRestored ? -(currentHR - 72) : -40,
        bpChange: rhythmRestored ? 15 : 8,
        rhythmRestored,
      };

    case 'cardioversion':
      if (variant === 'unstable' || currentSystolic < 80) {
        return {
          message: {
            ua: '✅ Синхронізована кардіоверсія 100 Дж. Синусовий ритм відновлено! АТ 98/65, ЧСС 78/хв.',
            en: '✅ Synchronized cardioversion 100 J. Sinus rhythm restored! BP 98/65, HR 78/min.',
          },
          hrChange: -(currentHR - 78),
          bpChange: 26,
          rhythmRestored: true,
        };
      }
      if (currentSystolic >= 90) {
        return {
          message: {
            ua: `⚠️ Кардіоверсія при стабільному АТ ${currentSystolic} мм рт.ст. — допустима, але медикаментозне лікування (аміодарон) є першим кроком при стабільній гемодинаміці.`,
            en: `⚠️ Cardioversion with stable BP ${currentSystolic} mmHg — acceptable, but medication (amiodarone) is first-line with stable hemodynamics.`,
          },
          hrChange: -(currentHR - 78),
          bpChange: 10,
          rhythmRestored: true,
        };
      }
      return {
        message: {
          ua: '✅ Кардіоверсія 200 Дж. Синусовий ритм відновлено.',
          en: '✅ Cardioversion 200 J. Sinus rhythm restored.',
        },
        hrChange: -(currentHR - 78),
        bpChange: 18,
        rhythmRestored: true,
      };

    case 'enoxaparin_therapeutic':
      if (!testsPerformed.includes('coag')) {
        return {
          message: {
            ua: '⚠️ Антикоагуляція без перевірки МНО/коагулограми. Після серцевої операції — ризик кровотечі! Спочатку коагулограма.',
            en: '⚠️ Anticoagulation without checking INR/coagulation. After cardiac surgery — bleeding risk! Check coagulation first.',
          },
          hint: {
            ua: 'Дилема: тромбоемболічний ризик vs ризик кровотечі після операції. МНО допоможе прийняти рішення.',
            en: 'Dilemma: thromboembolic risk vs post-operative bleeding risk. INR will help the decision.',
          },
          hrChange: 0,
          bpChange: 0,
          penaltyNote: {
            ua: 'Антикоагуляція без лабораторного контролю після операції',
            en: 'Anticoagulation without laboratory monitoring post-surgery',
          },
        };
      }
      return {
        message: {
          ua: '✅ Еноксапарин терапевтична доза призначено. При ФП після АКШ — НМГ є стандартом в ІТ. Кардіологи визначать тривалу терапію після виписки.',
          en: '✅ Enoxaparin therapeutic dose prescribed. Post-CABG AF — LMWH is ICU standard. Cardiologists will determine long-term therapy after discharge.',
        },
        hint: {
          ua: 'Після ІТ: кардіологи призначать НОАК або варфарин залежно від CHA₂DS₂-VASc.',
          en: 'After ICU: cardiologists will prescribe NOAC or warfarin based on CHA₂DS₂-VASc score.',
        },
        hrChange: 0,
        bpChange: 2,
      };

    case 'norepinephrine':
      return {
        message: {
          ua: `✅ Норадреналін збільшено. АТ ${currentSystolic} → ${currentSystolic + 15} мм рт.ст. Гемодинамічна підтримка до відновлення ритму.`,
          en: `✅ Norepinephrine increased. BP ${currentSystolic} → ${currentSystolic + 15} mmHg. Hemodynamic support until rhythm restored.`,
        },
        hint: {
          ua: 'Вазопресори — міст до відновлення ритму, не лікування ФП.',
          en: 'Vasopressors — bridge to rhythm restoration, not AF treatment.',
        },
        hrChange: 5,
        bpChange: 15,
      };

    default:
      return {
        message: { ua: 'Дія зареєстрована.', en: 'Action recorded.' },
        hrChange: 0, bpChange: 0,
      };
  }
};

// ============================================================
// ДЕБРИФІНГ
// ============================================================
export const getAFibDebrief = (
  variant: AFibVariant,
  profile: AFibProfile,
  testsPerformed: string[],
  actionHistory: string[],
  rhythmRestored: boolean,
  stabilized: boolean,
  timeMin: number,
  lang: Lang = 'ua',
) => {
  const ua = lang === 'ua';

  const isUnstable = variant === 'unstable';
  const isHypotensive = variant === 'hypotensive_tachy';

  const items = [
    {
      ok: testsPerformed.includes('ecg12'),
      text: ua ? 'ЕКГ 12 відведень виконано' : '12-lead ECG performed',
    },
    {
      ok: testsPerformed.includes('electrolytes'),
      text: ua ? 'Електроліти перевірено (K⁺, Mg²⁺)' : 'Electrolytes checked (K⁺, Mg²⁺)',
    },
    {
      ok: actionHistory.includes('potassium_iv') || actionHistory.includes('magnesium_iv'),
      text: ua ? 'Виконана корекція електролітів' : 'Electrolyte correction performed',
    },
    {
      ok: isUnstable
        ? actionHistory.includes('cardioversion')
        : actionHistory.includes('amiodarone_iv') || actionHistory.includes('metoprolol_iv'),
      text: isUnstable
        ? (ua ? 'Кардіоверсія при нестабільній ФП — правильне рішення' : 'Cardioversion for unstable AF — correct decision')
        : (ua ? 'Медикаментозний контроль ЧСС/ритму' : 'Pharmacological rate/rhythm control'),
    },
    {
      ok: !actionHistory.includes('metoprolol_iv') || variant === 'stable_tachy',
      text: ua
        ? 'Метопролол в/в не застосовувався при гіпотензії'
        : 'Metoprolol IV not used during hypotension',
    },
    {
      ok: testsPerformed.includes('coag') && actionHistory.includes('enoxaparin_therapeutic'),
      text: ua
        ? 'Антикоагуляція призначена після перевірки коагулограми'
        : 'Anticoagulation prescribed after coagulation check',
    },
    {
      ok: actionHistory.includes('metoprolol_po'),
      text: ua
        ? 'Бета-блокатор per os відновлено (профілактика рецидиву ФП)'
        : 'Oral beta-blocker resumed (AF recurrence prophylaxis)',
    },
    {
      ok: stabilized && timeMin < 15,
      text: ua
        ? 'Гемодинамічна стабілізація досягнута вчасно'
        : 'Hemodynamic stabilization achieved in time',
    },
  ];

  const keyPoints: { ua: string; en: string }[] = [
    {
      ua: `Варіант: ${profile.label.ua}`,
      en: `Variant: ${profile.label.en}`,
    },
    {
      ua: 'Найчастіша аритмія після АКШ — виникає на 2-3 добу',
      en: 'Most common arrhythmia after CABG — occurs on day 2-3',
    },
    {
      ua: 'Профілактика: бета-блокатори + корекція K⁺ >4.0 і Mg²⁺ >1.0 ммоль/л',
      en: 'Prophylaxis: beta-blockers + correct K⁺ >4.0 and Mg²⁺ >1.0 mmol/L',
    },
    {
      ua: 'Нестабільна гемодинаміка → кардіоверсія негайно (не чекати аміодарон)',
      en: 'Unstable hemodynamics → cardioversion immediately (do not wait for amiodarone)',
    },
    {
      ua: 'Метопролол в/в — протипоказаний при АТ <90 мм рт.ст.',
      en: 'Metoprolol IV — contraindicated when BP <90 mmHg',
    },
    {
      ua: 'Антикоагуляція: НМГ в ІТ → НОАК/варфарин після виписки (CHA₂DS₂-VASc)',
      en: 'Anticoagulation: LMWH in ICU → NOAC/warfarin after discharge (CHA₂DS₂-VASc)',
    },
  ];

  return {
    items,
    score: items.filter(i => i.ok).length,
    total: items.length,
    keyPoints: keyPoints.map(k => ua ? k.ua : k.en),
  };
};
