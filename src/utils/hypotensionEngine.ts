// hypotensionEngine.ts — диференційна діагностика гіпотензії
// 5 типів шоку для кардіохірургічної реанімації

export type ShockType =
  | 'hypovolemic'
  | 'cardiogenic'
  | 'distributive_sepsis'
  | 'distributive_vasoplegia'
  | 'obstructive';

export type ShockPhase = 'masked' | 'unmasking' | 'decompensating' | 'arrest';

// ============================================================
// ПРОФІЛІ ШОКУ — початкові маркери та динаміка
// ============================================================
export interface ShockProfile {
  type: ShockType;
  label: string;
  labelShort: string;
  mechanism: string;
  color: string;

  // Початкові видимі маркери (маска)
  initialSystolic: number;
  initialHR: number;
  initialUO: number;           // діурез мл/год (видно одразу)

  // Приховані маркери (відкриваються після перевірки)
  cvp: number;                 // мм рт.ст.
  skinTemp: 'cold' | 'warm';
  lactate: number;             // ммоль/л
  ef?: number;                 // фракція викиду % (тільки кардіогенний)
  ecgChanges?: string;         // опис змін ЕКГ

  // Прогресія без лікування (за хвилину)
  bpDeclinePerMin: number;
  hrIncreasePerMin: number;

  // Підказки диференційної діагностики
  ddxClue: string;
  trapClue: string;            // "пастка" — чим схожий на інший тип
}

export const SHOCK_PROFILES: Record<ShockType, ShockProfile> = {
  hypovolemic: {
    type: 'hypovolemic',
    label: 'Гіповолемічна гіпотензія',
    labelShort: 'Гіповолемія',
    mechanism: 'Дефіцит об\'\u0454му циркулюючої крові',
    color: '#f59e0b',
    initialSystolic: 82, initialHR: 118, initialUO: 12,
    cvp: 3, skinTemp: 'cold', lactate: 3.2,
    bpDeclinePerMin: 3.0, hrIncreasePerMin: 2.5,
    ddxClue: 'Низький АТ + НИЗЬКИЙ ЦВТ + позитивний PLR-тест',
    trapClue: 'На початку схожий на вазоплегію — обидва мають низький ЦВТ',
  },
  cardiogenic: {
    type: 'cardiogenic',
    label: 'Кардіогенна гіпотензія',
    labelShort: 'Кардіогенний шок',
    mechanism: 'Серцева недостатність — міокард не забезпечує серцевий викид',
    color: '#ef4444',
    initialSystolic: 78, initialHR: 125, initialUO: 8,
    cvp: 22, skinTemp: 'cold', lactate: 4.8,
    ef: 25, ecgChanges: 'ST-депресія у V4-V6, інверсія T',
    bpDeclinePerMin: 4.0, hrIncreasePerMin: 2.0,
    ddxClue: 'Низький АТ + ВИСОКИЙ ЦВТ + низька ФВ на ехо + ST-зміни',
    trapClue: 'Схожий на тампонаду — обидва мають високий ЦВТ. Різниця: ехо покаже ФВ',
  },
  distributive_sepsis: {
    type: 'distributive_sepsis',
    label: 'Дистрибутивна (сепсис)',
    labelShort: 'Септичний шок',
    mechanism: 'Вазодилатація через системну запальну відповідь',
    color: '#a78bfa',
    initialSystolic: 80, initialHR: 128, initialUO: 18,
    cvp: 6, skinTemp: 'warm', lactate: 6.1,
    bpDeclinePerMin: 2.5, hrIncreasePerMin: 3.0,
    ddxClue: 'Низький АТ + низький/норм ЦВТ + ТЕПЛА шкіра + лактат > 4 + гарячка',
    trapClue: 'Схожий на гіповолемію — обидва мають низький ЦВТ. Але шкіра тепла!',
  },
  distributive_vasoplegia: {
    type: 'distributive_vasoplegia',
    label: 'Вазоплегія після ШК',
    labelShort: 'Вазоплегія (post-CPB)',
    mechanism: 'Системна вазодилатація після штучного кровообігу',
    color: '#06b6d4',
    initialSystolic: 75, initialHR: 105, initialUO: 22,
    cvp: 5, skinTemp: 'warm', lactate: 2.1,
    bpDeclinePerMin: 3.5, hrIncreasePerMin: 1.5,
    ddxClue: 'Низький АТ + низький ЦВТ + ТЕПЛА шкіра + анамнез ШК + нормальний лактат',
    trapClue: 'Схожий на гіповолемію, але рідина не допомагає — потрібен норадреналін',
  },
  obstructive: {
    type: 'obstructive',
    label: 'Обструктивна гіпотензія',
    labelShort: 'Обструкція (тампонада/ТЕЛА)',
    mechanism: 'Механічна перешкода кровотоку',
    color: '#f97316',
    initialSystolic: 76, initialHR: 122, initialUO: 10,
    cvp: 24, skinTemp: 'cold', lactate: 5.2,
    bpDeclinePerMin: 4.5, hrIncreasePerMin: 2.5,
    ddxClue: 'Низький АТ + ДУЖЕ ВИСОКИЙ ЦВТ + ехо покаже причину',
    trapClue: 'Схожий на кардіогенний — обидва мають високий ЦВТ. Ехо — ключ до діагнозу',
  },
};

// ============================================================
// ДІАГНОСТИЧНІ КРОКИ (що інтерн може "замовити")
// ============================================================
export interface DiagnosticTest {
  id: string;
  label: string;
  description: string;
  icon: string;
  revealsFor: Partial<Record<ShockType, string>>;  // що показує для кожного типу
  cooldown: number;
}

export const DIAGNOSTIC_TESTS: DiagnosticTest[] = [
  {
    id: 'cvp',
    label: 'Перевірити ЦВТ',
    description: 'Оцінити переднавантаження',
    icon: '📊',
    revealsFor: {
      hypovolemic:            'ЦВТ = 3 мм рт.ст. ↓↓ (норма 8-12)',
      cardiogenic:            'ЦВТ = 22 мм рт.ст. ↑↑ — венозний застій',
      distributive_sepsis:    'ЦВТ = 6 мм рт.ст. — низький/норм',
      distributive_vasoplegia:'ЦВТ = 5 мм рт.ст. — низький',
      obstructive:            'ЦВТ = 24 мм рт.ст. ↑↑ — виражений застій',
    },
    cooldown: 1,
  },
  {
    id: 'plr',
    label: 'Тест підняття ніг (PLR)',
    description: 'Пасивне підняття ніг — тест на волемію',
    icon: '🦵',
    revealsFor: {
      hypovolemic:            '✅ ПОЗИТИВНИЙ: АТ підвищився на 14 мм рт.ст. Пацієнт волемо-чутливий',
      cardiogenic:            '❌ НЕГАТИВНИЙ: АТ не змінився. Проблема не в об\'ємі',
      distributive_sepsis:    '⚠️ ЧАСТКОВО ПОЗИТИВНИЙ: АТ +6 мм. Компонент гіповолемії є, але не основна причина',
      distributive_vasoplegia:'⚠️ ЧАСТКОВО ПОЗИТИВНИЙ: АТ +5 мм. Рідина дасть короткий ефект',
      obstructive:            '❌ НЕГАТИВНИЙ: АТ не змінився або погіршився. Перешкода кровотоку',
    },
    cooldown: 2,
  },
  {
    id: 'echo',
    label: 'Ехокардіографія',
    description: 'Оцінка ФВ, порожнин, перикарда',
    icon: '🔵',
    revealsFor: {
      hypovolemic:            'ЕхоКС: ЛШ гіпердинамічний, порожнини малі, ФВ 65%. Перикард чистий',
      cardiogenic:            'ЕхоКС: ФВ 25% ↓↓. Гіпокінез передньої стінки. Перикард чистий',
      distributive_sepsis:    'ЕхоКС: ФВ 55%, гіпердинамічний ЛШ. Перикард чистий',
      distributive_vasoplegia:'ЕхоКС: ФВ 58%, гіпердинамічний ЛШ, малі порожнини. Перикард чистий',
      obstructive:            'ЕхоКС: Рідина в перикарді, колапс ПШ. ТАМПОНАДА підтверджена',
    },
    cooldown: 3,
  },
  {
    id: 'lactate',
    label: 'Лактат (аналіз крові)',
    description: 'Маркер тканинної гіпоперфузії',
    icon: '🧪',
    revealsFor: {
      hypovolemic:            'Лактат = 3.2 ммоль/л ↑ (норма < 2.0). Помірна гіпоперфузія',
      cardiogenic:            'Лактат = 4.8 ммоль/л ↑↑. Виражена тканинна гіпоперфузія',
      distributive_sepsis:    'Лактат = 6.1 ммоль/л ↑↑↑. Критична гіпоперфузія. Септичний шок підтверджено',
      distributive_vasoplegia:'Лактат = 2.1 ммоль/л — норм/незначно підвищений. Перфузія відносно збережена',
      obstructive:            'Лактат = 5.2 ммоль/л ↑↑. Виражена гіпоперфузія через обструкцію',
    },
    cooldown: 4,
  },
  {
    id: 'skin_temp',
    label: 'Оцінити температуру шкіри',
    description: 'Холодна/тепла шкіра — вазоконстрикція vs вазодилатація',
    icon: '🌡️',
    revealsFor: {
      hypovolemic:            'Шкіра ХОЛОДНА, волога, бліда. Вазоконстрикція — компенсаторна реакція',
      cardiogenic:            'Шкіра ХОЛОДНА, мармурова. Низький серцевий викид → вазоконстрикція',
      distributive_sepsis:    'Шкіра ТЕПЛА, рожева (рання стадія). Вазодилатація. Симптом "теплого шоку"',
      distributive_vasoplegia:'Шкіра ТЕПЛА, рожева. Масивна вазодилатація після ШК',
      obstructive:            'Шкіра ХОЛОДНА, ціанотична. Критичне зниження серцевого викиду',
    },
    cooldown: 1,
  },
];

// ============================================================
// ЛІКУВАЛЬНІ ДІЇ
// ============================================================
export interface TreatmentAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  cooldown: number;
  isCausal: boolean;           // усуває причину (true) чи симптоматична (false)
  effectiveFor: ShockType[];
  symptomaticFor: ShockType[]; // допомагає але не лікує
  harmfulFor: ShockType[];     // шкодить
}

export const TREATMENT_ACTIONS: TreatmentAction[] = [
  {
    id: 'fluids_500',
    label: 'Рідинний болюс 500 мл',
    description: 'Кристалоїди в/в швидко',
    icon: '💧',
    color: 'bg-cyan-700 hover:bg-cyan-600 border-cyan-600',
    cooldown: 4,
    isCausal: true,
    effectiveFor: ['hypovolemic'],
    symptomaticFor: ['distributive_sepsis', 'distributive_vasoplegia'],
    harmfulFor: ['cardiogenic', 'obstructive'],
  },
  {
    id: 'norepinephrine',
    label: 'Норадреналін ↑ дозу',
    description: 'Вазоконстриктор — підвищення ЗПСО',
    icon: '💊',
    color: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    cooldown: 3,
    isCausal: true,
    effectiveFor: ['distributive_sepsis', 'distributive_vasoplegia'],
    symptomaticFor: ['hypovolemic', 'cardiogenic', 'obstructive'],
    harmfulFor: [],
  },
  {
    id: 'vasopressin',
    label: 'Вазопресин 0.03 Од/хв',
    description: 'При рефрактерній вазоплегії до норадреналіну',
    icon: '💉',
    color: 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500',
    cooldown: 4,
    isCausal: true,
    effectiveFor: ['distributive_vasoplegia'],
    symptomaticFor: ['distributive_sepsis'],
    harmfulFor: ['hypovolemic', 'cardiogenic'],
  },
  {
    id: 'dobutamine',
    label: 'Добутамін 5 мкг/кг/хв',
    description: 'Інотроп — підсилення скоротливості міокарда',
    icon: '❤️',
    color: 'bg-rose-600 hover:bg-rose-500 border-rose-500',
    cooldown: 4,
    isCausal: true,
    effectiveFor: ['cardiogenic'],
    symptomaticFor: [],
    harmfulFor: ['hypovolemic', 'distributive_sepsis', 'distributive_vasoplegia', 'obstructive'],
  },
  {
    id: 'pericardiocentesis',
    label: 'Перикардіоцентез / Реексплорація',
    description: 'Усунення механічної обструкції',
    icon: '🔴',
    color: 'bg-red-600 hover:bg-red-500 border-red-500',
    cooldown: 6,
    isCausal: true,
    effectiveFor: ['obstructive'],
    symptomaticFor: [],
    harmfulFor: [],
  },
  {
    id: 'antibiotics',
    label: 'АБ-терапія + посіви',
    description: 'Етіотропне лікування сепсису',
    icon: '🦠',
    color: 'bg-purple-600 hover:bg-purple-500 border-purple-500',
    cooldown: 5,
    isCausal: true,
    effectiveFor: ['distributive_sepsis'],
    symptomaticFor: [],
    harmfulFor: [],
  },
];

// ============================================================
// ОЦІНКА ЛІКУВАЛЬНОЇ ДІЇ
// ============================================================
export interface TreatmentResult {
  bpChange: number;
  message: string;
  hint?: string;
  isCausal: boolean;
  penaltyNote?: string;
}

export const evaluateTreatment = (
  actionId: string,
  shockType: ShockType,
  diagnosisConfirmed: boolean,
  actionHistory: string[],
): TreatmentResult => {
  const action = TREATMENT_ACTIONS.find(a => a.id === actionId)!;
  const prevCount = actionHistory.filter(a => a === actionId).length;

  const isEffective   = action.effectiveFor.includes(shockType);
  const isSymptomatic = action.symptomaticFor.includes(shockType);
  const isHarmful     = action.harmfulFor.includes(shockType);

  if (isEffective) {
    const bpBoost = actionId === 'fluids_500'     ? 18 :
                    actionId === 'norepinephrine'  ? 22 :
                    actionId === 'vasopressin'     ? 20 :
                    actionId === 'dobutamine'      ? 15 :
                    actionId === 'pericardiocentesis' ? 35 :
                    actionId === 'antibiotics'     ? 8  : 10;

    return {
      bpChange: prevCount === 0 ? bpBoost : Math.round(bpBoost * 0.4),
      message: prevCount === 0
        ? `✅ ${action.label}: хороший ефект. АТ підвищився. Це правильне етіотропне лікування.`
        : `✅ Повторне введення: менший ефект. Продовжуйте.`,
      isCausal: action.isCausal,
    };
  }

  if (isSymptomatic) {
    const bpBoost = actionId === 'norepinephrine' ? 12 :
                    actionId === 'fluids_500'      ? 8  : 6;
    return {
      bpChange: prevCount === 0 ? bpBoost : Math.round(bpBoost * 0.3),
      message: `⚠️ ${action.label}: АТ трохи підвищився, але це симптоматичний ефект. Причина не усунена.`,
      hint: diagnosisConfirmed ? `Для ${SHOCK_PROFILES[shockType].labelShort} потрібне інше лікування.` : 'Уточніть діагноз перед лікуванням.',
      isCausal: false,
      penaltyNote: 'Симптоматичне лікування без усунення причини',
    };
  }

  if (isHarmful) {
    const bpDrop = actionId === 'fluids_500'   ? -8 :
                   actionId === 'dobutamine'    ? -12 :
                   actionId === 'vasopressin'   ? -6  : -5;
    return {
      bpChange: bpDrop,
      message: `❌ ${action.label}: ПОГІРШЕННЯ! При ${SHOCK_PROFILES[shockType].labelShort} ця дія протипоказана або неефективна.`,
      hint: SHOCK_PROFILES[shockType].ddxClue,
      isCausal: false,
      penaltyNote: 'Неправильне лікування — погіршення стану',
    };
  }

  return {
    bpChange: 0,
    message: `${action.label}: без ефекту.`,
    isCausal: false,
  };
};

// ============================================================
// ДЕБРИФІНГ
// ============================================================
export const getHypotensionDebrief = (
  shockType: ShockType,
  diagnosisConfirmed: boolean,
  testsPerformed: string[],
  treatmentHistory: string[],
  isCured: boolean,
  timeMin: number,
  penaltyActions: string[],
) => {
  const profile = SHOCK_PROFILES[shockType];
  const correctTreatment = TREATMENT_ACTIONS.find(a => a.effectiveFor.includes(shockType));

  const items = [
    {
      ok: testsPerformed.includes('cvp'),
      text: 'Перевірено ЦВТ (перший крок диференційної діагностики)',
    },
    {
      ok: testsPerformed.includes('echo'),
      text: 'Виконано ехокардіографію',
    },
    {
      ok: testsPerformed.includes('lactate'),
      text: 'Замовлено лактат',
    },
    {
      ok: testsPerformed.includes('plr'),
      text: 'Виконано PLR-тест (тест на волемочутливість)',
    },
    {
      ok: diagnosisConfirmed,
      text: `Правильно встановлено діагноз: ${profile.label}`,
    },
    {
      ok: correctTreatment ? treatmentHistory.includes(correctTreatment.id) : false,
      text: `Призначено правильне лікування: ${correctTreatment?.label ?? '—'}`,
    },
    {
      ok: penaltyActions.length === 0,
      text: 'Не застосовувались шкідливі або виключно симптоматичні дії',
    },
    {
      ok: isCured && timeMin < 15,
      text: 'Стабілізація досягнута своєчасно (до 15 хв)',
    },
  ];

  return {
    items,
    score: items.filter(i => i.ok).length,
    total: items.length,
    keyPoints: [
      `Тип шоку: ${profile.label}`,
      `Механізм: ${profile.mechanism}`,
      `Ключ до діагнозу: ${profile.ddxClue}`,
      `Пастка: ${profile.trapClue}`,
    ],
  };
};
