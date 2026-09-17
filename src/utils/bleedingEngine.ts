// bleedingEngine.ts — Кровотеча після кардіохірургічної операції
import { Lang } from './i18n';

export type BleedingType = 'heparin' | 'coagulopathy' | 'surgical';

export interface BleedingProfile {
  type: BleedingType;
  label: { ua: string; en: string };
  patient: { ua: string; en: string };
  surgery: { ua: string; en: string };
  mechanism: { ua: string; en: string };

  // Лабораторні показники
  drainOutput: number;        // мл/год (початковий)
  act: number;                // АЧЗ сек (норма <140)
  aptt: number;               // АЧТЧ сек (норма 25-35)
  inr: number;                // МНО (норма <1.5)
  fibrinogen: number;         // г/л (норма 2-4)
  platelets: number;          // ×10⁹/л (норма >100)
  hb: number;                 // г/л
  tegMA: number;              // ТЕГ MA мм (норма 54-72)
  tegK: number;               // ТЕГ K хв (норма 1-3)
  tegAlpha: number;           // ТЕГ α° (норма 47-74)

  // Прогресія без лікування
  drainIncreasePerMin: number;
  bpDeclinePerMin: number;
  hrIncreasePerMin: number;
}

export const BLEEDING_PROFILES: Record<BleedingType, BleedingProfile> = {
  heparin: {
    type: 'heparin',
    label: { ua: 'Гепаринова кровотеча', en: 'Heparin-related Bleeding' },
    patient: { ua: 'Коваленко М.І., 67 р.', en: 'Kovalenko M.I., 67 y.o.' },
    surgery: { ua: 'АКШ ×3 (ШК), 4 год тому', en: 'CABG ×3 (CPB), 4h ago' },
    mechanism: {
      ua: 'Залишковий гепарин після ШК. Недостатня нейтралізація протаміном.',
      en: 'Residual heparin after CPB. Insufficient protamine neutralization.',
    },
    drainOutput: 240,
    act: 195,
    aptt: 72,
    inr: 1.4,
    fibrinogen: 2.8,
    platelets: 95,
    hb: 88,
    tegMA: 62,
    tegK: 2.1,
    tegAlpha: 58,
    drainIncreasePerMin: 2.5,
    bpDeclinePerMin: 1.8,
    hrIncreasePerMin: 1.5,
  },
  coagulopathy: {
    type: 'coagulopathy',
    label: { ua: 'Коагулопатія після ШК', en: 'Post-CPB Coagulopathy' },
    patient: { ua: 'Петренко В.О., 71 р.', en: 'Petrenko V.O., 71 y.o.' },
    surgery: { ua: 'Протезування МК (ШК), 6 год тому', en: 'MV replacement (CPB), 6h ago' },
    mechanism: {
      ua: 'Дилюційна коагулопатія + тромбоцитопенія після тривалого ШК.',
      en: 'Dilutional coagulopathy + thrombocytopenia after prolonged CPB.',
    },
    drainOutput: 210,
    act: 138,
    aptt: 42,
    inr: 2.1,
    fibrinogen: 1.2,
    platelets: 58,
    hb: 78,
    tegMA: 38,
    tegK: 5.2,
    tegAlpha: 28,
    drainIncreasePerMin: 2.0,
    bpDeclinePerMin: 2.2,
    hrIncreasePerMin: 2.0,
  },
  surgical: {
    type: 'surgical',
    label: { ua: 'Хірургічна кровотеча', en: 'Surgical Bleeding' },
    patient: { ua: 'Мороз О.В., 63 р.', en: 'Moroz O.V., 63 y.o.' },
    surgery: { ua: 'Резекція аневризми аорти (ШК), 3 год тому', en: 'Aortic aneurysm resection (CPB), 3h ago' },
    mechanism: {
      ua: 'Технічний дефект гемостазу. Судинна кровотеча з анастомозу.',
      en: 'Technical hemostasis defect. Vascular bleeding from anastomosis.',
    },
    drainOutput: 280,
    act: 132,
    aptt: 34,
    inr: 1.3,
    fibrinogen: 2.6,
    platelets: 102,
    hb: 82,
    tegMA: 56,
    tegK: 2.4,
    tegAlpha: 52,
    drainIncreasePerMin: 3.5,
    bpDeclinePerMin: 3.0,
    hrIncreasePerMin: 2.5,
  },
};

// ============================================================
// ДІАГНОСТИЧНІ ТЕСТИ
// ============================================================
export interface BleedingTest {
  id: string;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  icon: string;
  cooldown: number;
  isOptional?: boolean;
}

export const BLEEDING_TESTS: BleedingTest[] = [
  {
    id: 'drain',
    label: { ua: 'Оцінити дренажне виділення', en: 'Assess drain output' },
    description: { ua: 'Темп кровотечі мл/год — перший маркер', en: 'Bleeding rate ml/hr — first marker' },
    icon: '🩸',
    cooldown: 1,
  },
  {
    id: 'act',
    label: { ua: 'АЧЗ (Активований час згортання)', en: 'ACT (Activated Clotting Time)' },
    description: { ua: 'Норма <140 сек. Скринінг на залишковий гепарин', en: 'Normal <140 sec. Screen for residual heparin' },
    icon: '⏱',
    cooldown: 2,
  },
  {
    id: 'aptt',
    label: { ua: 'АЧТЧ', en: 'aPTT' },
    description: { ua: 'Норма 25-35 сек. Чутливий до гепарину', en: 'Normal 25-35 sec. Sensitive to heparin' },
    icon: '🧪',
    cooldown: 3,
  },
  {
    id: 'coag',
    label: { ua: 'Коагулограма (МНО, фібриноген, тромбоцити)', en: 'Coagulation panel (INR, fibrinogen, platelets)' },
    description: { ua: 'Комплексна оцінка гемостазу', en: 'Comprehensive hemostasis assessment' },
    icon: '📊',
    cooldown: 5,
  },
  {
    id: 'hb',
    label: { ua: 'Гемоглобін / Гематокрит', en: 'Hemoglobin / Hematocrit' },
    description: { ua: 'Ступінь крововтрати', en: 'Degree of blood loss' },
    icon: '💉',
    cooldown: 3,
  },
  {
    id: 'echo',
    label: { ua: 'ЕхоКС — виключити тампонаду', en: 'Echo — exclude tamponade' },
    description: { ua: 'Рідина в перикарді? Функція шлуночків?', en: 'Pericardial fluid? Ventricular function?' },
    icon: '🔵',
    cooldown: 4,
  },
  {
    id: 'teg',
    label: { ua: 'Тромбоеластографія (ТЕГ/РОТЕМ)', en: 'Thromboelastography (TEG/ROTEM)' },
    description: { ua: 'Функціональна оцінка всіх ланок гемостазу', en: 'Functional assessment of all hemostasis components' },
    icon: '📈',
    cooldown: 8,
    isOptional: true,
  },
];

// ============================================================
// ЛІКУВАЛЬНІ ДІЇ
// ============================================================
export interface BleedingAction {
  id: string;
  label: { ua: string; en: string };
  description: { ua: string; en: string };
  icon: string;
  color: string;
  cooldown: number;
  isPrimary?: boolean;
  requiresDiagnosis?: boolean;
}

export const BLEEDING_ACTIONS: BleedingAction[] = [
  {
    id: 'protamine',
    label: { ua: 'Протамін 25-50 мг в/в', en: 'Protamine 25-50 mg IV' },
    description: { ua: 'Нейтралізація залишкового гепарину', en: 'Neutralize residual heparin' },
    icon: '💊',
    color: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    cooldown: 5,
    requiresDiagnosis: true,
  },
  {
    id: 'ffp',
    label: { ua: 'СЗП 2-4 дози в/в', en: 'FFP 2-4 units IV' },
    description: { ua: 'Корекція дефіциту факторів згортання', en: 'Correct clotting factor deficiency' },
    icon: '🩸',
    color: 'bg-yellow-600 hover:bg-yellow-500 border-yellow-500',
    cooldown: 6,
    requiresDiagnosis: true,
  },
  {
    id: 'platelets',
    label: { ua: 'Тромбоцитарна маса 1-2 дози', en: 'Platelet concentrate 1-2 units' },
    description: { ua: 'При тромбоцитах <80×10⁹/л або дисфункції', en: 'When platelets <80×10⁹/L or dysfunction' },
    icon: '🔴',
    color: 'bg-orange-600 hover:bg-orange-500 border-orange-500',
    cooldown: 6,
    requiresDiagnosis: true,
  },
  {
    id: 'cryoprecipitate',
    label: { ua: 'Кріопреципітат 10 доз', en: 'Cryoprecipitate 10 units' },
    description: { ua: 'При фібриногені <1.5 г/л', en: 'When fibrinogen <1.5 g/L' },
    icon: '❄️',
    color: 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500',
    cooldown: 6,
    requiresDiagnosis: true,
  },
  {
    id: 'tranexamic',
    label: { ua: 'Транексамова к-та 1г в/в', en: 'Tranexamic acid 1g IV' },
    description: { ua: 'Антифібринолітик — зменшує крововтрату', en: 'Antifibrinolytic — reduces blood loss' },
    icon: '💉',
    color: 'bg-teal-600 hover:bg-teal-500 border-teal-500',
    cooldown: 4,
  },
  {
    id: 'fluids',
    label: { ua: 'Інфузійна терапія 500 мл', en: 'IV fluids 500 ml' },
    description: { ua: 'Підтримка ОЦК. Не зупиняє кровотечу', en: 'Maintain circulating volume. Does not stop bleeding' },
    icon: '💧',
    color: 'bg-slate-600 hover:bg-slate-500 border-slate-500',
    cooldown: 3,
  },
  {
    id: 'surgeon',
    label: { ua: 'Викликати хірурга', en: 'Call surgeon' },
    description: { ua: "Обов'язково при темпі >200 мл/год або підозрі на хірургічну кровотечу", en: 'Mandatory when rate >200 ml/hr or surgical bleeding suspected' },
    icon: '📞',
    color: 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500',
    cooldown: 2,
  },
  {
    id: 'reexploration',
    label: { ua: 'Реексплорація', en: 'Re-exploration' },
    description: { ua: 'Ревізія операційного поля. Метод вибору при хірургічній кровотечі', en: 'Surgical field revision. Method of choice for surgical bleeding' },
    icon: '🔴',
    color: 'bg-red-600 hover:bg-red-500 border-red-500',
    cooldown: 10,
    isPrimary: true,
    requiresDiagnosis: false,
  },
];

// ============================================================
// ОЦІНКА ДІЇ
// ============================================================
export interface BleedingActionResult {
  message: { ua: string; en: string };
  hint?: { ua: string; en: string };
  drainReduction: number;    // мл/год зменшення дренажу
  isCausal: boolean;
  isCure: boolean;
  penaltyNote?: { ua: string; en: string };
}

export const evaluateBleedingAction = (
  actionId: string,
  bleedingType: BleedingType,
  profile: BleedingProfile,
  testsPerformed: string[],
  actionHistory: string[],
  surgeonCalled: boolean,
): BleedingActionResult => {
  const prevCount = actionHistory.filter(a => a === actionId).length;
  const hasACT  = testsPerformed.includes('act');
  const hasCoag = testsPerformed.includes('coag');
  const hasTEG  = testsPerformed.includes('teg');
  const hasDrain = testsPerformed.includes('drain');

  switch (actionId) {
    case 'protamine':
      if (bleedingType === 'heparin') {
        return {
          message: {
            ua: `✅ Протамін введено. АЧЗ знизився до 138 сек. Темп кровотечі зменшився на 60%. Правильне рішення при АЧЗ ${profile.act} сек.`,
            en: `✅ Protamine administered. ACT decreased to 138 sec. Bleeding rate reduced by 60%. Correct decision with ACT ${profile.act} sec.`,
          },
          drainReduction: 150,
          isCausal: true,
          isCure: false,
        };
      }
      if (bleedingType === 'coagulopathy') {
        return {
          message: {
            ua: `⚠️ Протамін при нормальному АЧЗ (${profile.act} сек) — не показаний. Надлишок протаміну сам може спричинити кровотечу.`,
            en: `⚠️ Protamine with normal ACT (${profile.act} sec) — not indicated. Excess protamine can itself cause bleeding.`,
          },
          hint: {
            ua: 'При коагулопатії потрібна корекція факторів (СЗП, тромбомаса, кріопреципітат).',
            en: 'Coagulopathy requires factor correction (FFP, platelets, cryoprecipitate).',
          },
          drainReduction: 0,
          isCausal: false,
          isCure: false,
          penaltyNote: {
            ua: 'Невиправдане введення протаміну',
            en: 'Unjustified protamine administration',
          },
        };
      }
      return {
        message: {
          ua: `⚠️ Протамін при хірургічній кровотечі — неефективний. АЧЗ норм (${profile.act} сек). Потрібна реексплорація.`,
          en: `⚠️ Protamine for surgical bleeding — ineffective. ACT normal (${profile.act} sec). Re-exploration required.`,
        },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
        penaltyNote: {
          ua: 'Затримка реексплорації через неправильне лікування',
          en: 'Re-exploration delayed by incorrect treatment',
        },
      };

    case 'ffp':
      if (bleedingType === 'coagulopathy') {
        return {
          message: {
            ua: `✅ СЗП 4 дози введено. МНО знизилось з ${profile.inr} до 1.5. Фібриноген зріс до 1.8 г/л. Темп кровотечі зменшився.`,
            en: `✅ FFP 4 units administered. INR decreased from ${profile.inr} to 1.5. Fibrinogen increased to 1.8 g/L. Bleeding rate reduced.`,
          },
          drainReduction: 80,
          isCausal: true,
          isCure: false,
        };
      }
      return {
        message: {
          ua: `⚠️ СЗП при ${bleedingType === 'heparin' ? 'гепариновій кровотечі' : 'хірургічній кровотечі'} — малоефективна. Усуває причину?`,
          en: `⚠️ FFP for ${bleedingType === 'heparin' ? 'heparin bleeding' : 'surgical bleeding'} — minimally effective. Addresses cause?`,
        },
        hint: {
          ua: bleedingType === 'heparin' ? 'Потрібен протамін для нейтралізації гепарину.' : 'Потрібна реексплорація.',
          en: bleedingType === 'heparin' ? 'Protamine needed to neutralize heparin.' : 'Re-exploration required.',
        },
        drainReduction: 15,
        isCausal: false,
        isCure: false,
      };

    case 'platelets':
      if (bleedingType === 'coagulopathy' && profile.platelets < 80) {
        return {
          message: {
            ua: `✅ Тромбоцити введено. Рівень підвищився до 95×10⁹/л. Функція гемостазу покращилась.`,
            en: `✅ Platelets transfused. Level increased to 95×10⁹/L. Hemostatic function improved.`,
          },
          drainReduction: 60,
          isCausal: true,
          isCure: false,
        };
      }
      return {
        message: {
          ua: `⚠️ Тромбоцити ${profile.platelets}×10⁹/л — достатній рівень. Трансфузія не показана.`,
          en: `⚠️ Platelets ${profile.platelets}×10⁹/L — adequate level. Transfusion not indicated.`,
        },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
      };

    case 'cryoprecipitate':
      if (bleedingType === 'coagulopathy' && profile.fibrinogen < 1.5) {
        return {
          message: {
            ua: `✅ Кріопреципітат введено. Фібриноген підвищився з ${profile.fibrinogen} до 2.4 г/л. ТЕГ MA покращився.`,
            en: `✅ Cryoprecipitate administered. Fibrinogen increased from ${profile.fibrinogen} to 2.4 g/L. TEG MA improved.`,
          },
          drainReduction: 70,
          isCausal: true,
          isCure: false,
        };
      }
      return {
        message: {
          ua: `⚠️ Фібриноген ${profile.fibrinogen} г/л — нижня межа норми. Кріопреципітат можна розглянути.`,
          en: `⚠️ Fibrinogen ${profile.fibrinogen} g/L — lower limit of normal. Cryoprecipitate may be considered.`,
        },
        drainReduction: 20,
        isCausal: false,
        isCure: false,
      };

    case 'tranexamic':
      return {
        message: {
          ua: `✅ Транексамова к-та введена. Антифібринолітичний ефект. Зменшує крововтрату на 20-30%.`,
          en: `✅ Tranexamic acid administered. Antifibrinolytic effect. Reduces blood loss by 20-30%.`,
        },
        hint: {
          ua: 'Не замінює специфічне лікування причини кровотечі.',
          en: 'Does not replace specific treatment of bleeding cause.',
        },
        drainReduction: prevCount === 0 ? 40 : 10,
        isCausal: false,
        isCure: false,
      };

    case 'fluids':
      return {
        message: {
          ua: `✅ Інфузія 500 мл. АТ стабілізований тимчасово. Кровотеча продовжується — потрібне специфічне лікування.`,
          en: `✅ 500 ml infusion. BP temporarily stabilized. Bleeding continues — specific treatment required.`,
        },
        hint: {
          ua: 'Рідина підтримує ОЦК але не зупиняє кровотечу.',
          en: 'Fluids maintain circulating volume but do not stop bleeding.',
        },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
      };

    case 'surgeon':
      if (surgeonCalled) return {
        message: {
          ua: 'Хірург вже викликаний і прямує.',
          en: 'Surgeon already called and on the way.',
        },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
      };
      return {
        message: {
          ua: `✅ Хірург викликаний. При темпі ${profile.drainOutput} мл/год — правильне рішення. Реексплорація тепер доступна.`,
          en: `✅ Surgeon called. At rate ${profile.drainOutput} ml/hr — correct decision. Re-exploration now available.`,
        },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
      };

    case 'reexploration':
      if (!surgeonCalled) return {
        message: {
          ua: '❌ Реексплорація потребує хірурга. Спочатку викличте хірурга.',
          en: '❌ Re-exploration requires surgeon. Call surgeon first.',
        },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
      };
      if (bleedingType === 'surgical') {
        return {
          message: {
            ua: '✅ Реексплорація виконана. Виявлено судинний дефект анастомозу. Гемостаз досягнутий. Пацієнт стабілізований.',
            en: '✅ Re-exploration performed. Vascular defect at anastomosis identified. Hemostasis achieved. Patient stabilized.',
          },
          drainReduction: 280,
          isCausal: true,
          isCure: true,
        };
      }
      if (bleedingType === 'heparin' && actionHistory.includes('protamine')) {
        return {
          message: {
            ua: '⚠️ Реексплорація після протаміну — дренаж зменшився, але хірург не знайшов судинного джерела. Кровотеча була гепариновою.',
            en: '⚠️ Re-exploration after protamine — drain reduced, but no vascular source found. Bleeding was heparin-related.',
          },
          drainReduction: 50,
          isCausal: false,
          isCure: false,
        };
      }
      return {
        message: {
          ua: `✅ Реексплорація виконана. ${bleedingType === 'heparin' ? 'Хірургічного джерела не знайдено — потрібен протамін.' : 'Коагулопатія виявлена — потрібна корекція факторів.'}`,
          en: `✅ Re-exploration performed. ${bleedingType === 'heparin' ? 'No surgical source found — protamine needed.' : 'Coagulopathy identified — factor correction needed.'}`,
        },
        drainReduction: 20,
        isCausal: false,
        isCure: false,
      };

    default:
      return {
        message: { ua: 'Дія зареєстрована.', en: 'Action recorded.' },
        drainReduction: 0,
        isCausal: false,
        isCure: false,
      };
  }
};

// ============================================================
// ДЕБРИФІНГ
// ============================================================
export const getBleedingDebrief = (
  bleedingType: BleedingType,
  profile: BleedingProfile,
  testsPerformed: string[],
  actionHistory: string[],
  isCured: boolean,
  timeMin: number,
  surgeonCalled: boolean,
  lang: Lang = 'ua',
) => {
  const ua = lang === 'ua';
  const correctTx: Record<BleedingType, string> = {
    heparin: 'protamine',
    coagulopathy: 'ffp',
    surgical: 'reexploration',
  };
  const correctTxLabel: Record<BleedingType, { ua: string; en: string }> = {
    heparin:      { ua: 'Протамін',       en: 'Protamine' },
    coagulopathy: { ua: 'СЗП + компоненти крові', en: 'FFP + blood components' },
    surgical:     { ua: 'Реексплорація',  en: 'Re-exploration' },
  };

  const items = [
    {
      ok: testsPerformed.includes('drain'),
      text: ua
        ? 'Оцінено темп дренажного виділення'
        : 'Drain output rate assessed',
    },
    {
      ok: testsPerformed.includes('act'),
      text: ua
        ? 'Виконано АЧЗ (скринінг на гепарин)'
        : 'ACT performed (heparin screen)',
    },
    {
      ok: testsPerformed.includes('coag'),
      text: ua
        ? 'Замовлено коагулограму (МНО, фібриноген, тромбоцити)'
        : 'Coagulation panel ordered (INR, fibrinogen, platelets)',
    },
    {
      ok: testsPerformed.includes('echo'),
      text: ua
        ? 'ЕхоКС виконано для виключення тампонади'
        : 'Echo performed to exclude tamponade',
    },
    {
      ok: surgeonCalled,
      text: ua
        ? 'Хірург викликаний своєчасно'
        : 'Surgeon called in time',
    },
    {
      ok: actionHistory.includes(correctTx[bleedingType]),
      text: ua
        ? `Застосовано правильне лікування: ${correctTxLabel[bleedingType].ua}`
        : `Correct treatment applied: ${correctTxLabel[bleedingType].en}`,
    },
    {
      ok: !actionHistory.includes('protamine') || bleedingType === 'heparin',
      text: ua
        ? 'Протамін не вводився без показань'
        : 'Protamine not given without indication',
    },
    {
      ok: isCured && timeMin < 15,
      text: ua
        ? 'Гемостаз досягнутий своєчасно (до 15 хв)'
        : 'Hemostasis achieved in time (within 15 min)',
    },
  ];

  const keyPoints: { ua: string; en: string }[] = [
    {
      ua: `Тип кровотечі: ${profile.label.ua}`,
      en: `Bleeding type: ${profile.label.en}`,
    },
    {
      ua: `Механізм: ${profile.mechanism.ua}`,
      en: `Mechanism: ${profile.mechanism.en}`,
    },
    {
      ua: 'АЧЗ >140 сек → залишковий гепарин → протамін',
      en: 'ACT >140 sec → residual heparin → protamine',
    },
    {
      ua: 'МНО >1.5 + фібриноген <1.5 → коагулопатія → СЗП + кріопреципітат',
      en: 'INR >1.5 + fibrinogen <1.5 → coagulopathy → FFP + cryoprecipitate',
    },
    {
      ua: 'Норм АЧЗ + норм коагулограма + дренаж >200 мл/год → хірургічна → реексплорація',
      en: 'Normal ACT + normal coag panel + drain >200 ml/hr → surgical → re-exploration',
    },
    {
      ua: 'ТЕГ/РОТЕМ: MA↓ = тромбоцити/фібрин, K↑ = фактори, LY30↑ = фібриноліз',
      en: 'TEG/ROTEM: MA↓ = platelets/fibrin, K↑ = factors, LY30↑ = fibrinolysis',
    },
  ];

  return {
    items,
    score: items.filter(i => i.ok).length,
    total: items.length,
    keyPoints: keyPoints.map(k => ua ? k.ua : k.en),
  };
};
