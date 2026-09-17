import { Lang } from './i18n';
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
  label: string; labelEn: string;
  labelShort: string; labelShortEn: string;
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
    label: 'Гіповолемічна гіпотензія', labelEn: 'Hypovolemic Hypotension',
    labelShort: 'Гіповолемія', labelShortEn: 'Hypovolemia',
    mechanism: 'Дефіцит об\'єму циркулюючої крові',
    color: '#f59e0b',
    initialSystolic: 82, initialHR: 118, initialUO: 12,
    cvp: 3, skinTemp: 'cold', lactate: 3.2,
    bpDeclinePerMin: 3.0, hrIncreasePerMin: 2.5,
    ddxClue: 'Низький АТ + НИЗЬКИЙ ЦВТ + позитивний PLR-тест',
    trapClue: 'На початку схожий на вазоплегію — обидва мають низький ЦВТ',
  },
  cardiogenic: {
    type: 'cardiogenic',
    label: 'Кардіогенна гіпотензія', labelEn: 'Cardiogenic Hypotension',
    labelShort: 'Кардіогенний шок', labelShortEn: 'Cardiogenic Shock',
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
    label: 'Дистрибутивна (сепсис)', labelEn: 'Distributive (Sepsis)',
    labelShort: 'Септичний шок', labelShortEn: 'Septic Shock',
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
    label: 'Вазоплегія після ШК', labelEn: 'Vasoplegia (post-CPB)',
    labelShort: 'Вазоплегія (post-CPB)', labelShortEn: 'Vasoplegia (post-CPB)',
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
    label: 'Обструктивна гіпотензія', labelEn: 'Obstructive Hypotension',
    labelShort: 'Обструкція (тампонада/ТЕЛА)', labelShortEn: 'Obstruction (tamponade/PE)',
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
  labelEn: string;
  description: string;
  descEn: string;
  icon: string;
  revealsFor: Partial<Record<ShockType, string>>;
  revealsForEn?: Partial<Record<ShockType, string>>;
  cooldown: number;
}

export const DIAGNOSTIC_TESTS: DiagnosticTest[] = [
  {
    id: 'cvp',
    label: 'Перевірити ЦВТ', labelEn: 'Check CVP',
    description: 'Оцінити переднавантаження', descEn: 'Assess preload',
    icon: '📊',
    revealsFor: {
      hypovolemic:            'ЦВТ = 3 мм рт.ст. ↓↓ (норма 8-12)',
      cardiogenic:            'ЦВТ = 22 мм рт.ст. ↑↑ — венозний застій',
      distributive_sepsis:    'ЦВТ = 6 мм рт.ст. — низький/норм',
      distributive_vasoplegia:'ЦВТ = 5 мм рт.ст. — низький',
      obstructive:            'ЦВТ = 24 мм рт.ст. ↑↑ — виражений застій',
    },
    revealsForEn: {
      hypovolemic:            'CVP = 3 mmHg ↓↓ (normal 8-12)',
      cardiogenic:            'CVP = 22 mmHg ↑↑ — venous congestion',
      distributive_sepsis:    'CVP = 6 mmHg — low/normal',
      distributive_vasoplegia:'CVP = 5 mmHg — low',
      obstructive:            'CVP = 24 mmHg ↑↑ — severe congestion',
    },
    cooldown: 1,
  },
  {
    id: 'plr',
    label: 'Тест підняття ніг (PLR)', labelEn: 'Passive Leg Raise (PLR)',
    description: 'Пасивне підняття ніг — тест на волемію', descEn: 'Passive leg raise — fluid responsiveness test',
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
    label: 'Ехокардіографія', labelEn: 'Echocardiography',
    description: 'Оцінка ФВ, порожнин, перикарда', descEn: 'Assess EF, chambers, pericardium',
    icon: '🔵',
    revealsFor: {
      hypovolemic:            'ЕхоКС: ЛШ гіпердинамічний, порожнини малі, ФВ 65%. Перикард чистий',
      cardiogenic:            'ЕхоКС: ФВ 25% ↓↓. Гіпокінез передньої стінки. Перикард чистий',
      distributive_sepsis:    'ЕхоКС: ФВ 55%, гіпердинамічний ЛШ. Перикард чистий',
      distributive_vasoplegia:'ЕхоКС: ФВ 58%, гіпердинамічний ЛШ, малі порожнини. Перикард чистий',
      obstructive:            'ЕхоКС: Рідина в перикарді, колапс ПШ. ТАМПОНАДА підтверджена',
    },
    revealsForEn: {
      hypovolemic:            'Echo: LV hyperdynamic, small chambers, EF 65%. Pericardium clear',
      cardiogenic:            'Echo: EF 25% ↓↓. Anterior wall hypokinesis. Pericardium clear',
      distributive_sepsis:    'Echo: EF 55%, hyperdynamic LV. Pericardium clear',
      distributive_vasoplegia:'Echo: EF 58%, hyperdynamic LV, small chambers. Pericardium clear',
      obstructive:            'Echo: Fluid in pericardium, RV collapse. TAMPONADE confirmed',
    },
    cooldown: 3,
  },
  {
    id: 'lactate',
    label: 'Лактат (аналіз крові)', labelEn: 'Lactate (blood test)',
    description: 'Маркер тканинної гіпоперфузії', descEn: 'Marker of tissue hypoperfusion',
    icon: '🧪',
    revealsFor: {
      hypovolemic:            'Лактат = 3.2 ммоль/л ↑ (норма < 2.0). Помірна гіпоперфузія',
      cardiogenic:            'Лактат = 4.8 ммоль/л ↑↑. Виражена тканинна гіпоперфузія',
      distributive_sepsis:    'Лактат = 6.1 ммоль/л ↑↑↑. Критична гіпоперфузія. Септичний шок підтверджено',
      distributive_vasoplegia:'Лактат = 2.1 ммоль/л — норм/незначно підвищений. Перфузія відносно збережена',
      obstructive:            'Лактат = 5.2 ммоль/л ↑↑. Виражена гіпоперфузія через обструкцію',
    },
    revealsForEn: {
      hypovolemic:            'Lactate = 3.2 mmol/L ↑ (normal < 2.0). Moderate hypoperfusion',
      cardiogenic:            'Lactate = 4.8 mmol/L ↑↑. Severe tissue hypoperfusion',
      distributive_sepsis:    'Lactate = 6.1 mmol/L ↑↑↑. Critical hypoperfusion. Septic shock confirmed',
      distributive_vasoplegia:'Lactate = 2.1 mmol/L — normal/slightly elevated. Perfusion relatively preserved',
      obstructive:            'Lactate = 5.2 mmol/L ↑↑. Severe hypoperfusion due to obstruction',
    },
    cooldown: 4,
  },
  {
    id: 'skin_temp',
    label: 'Оцінити температуру шкіри', labelEn: 'Assess skin temperature',
    description: 'Холодна/тепла шкіра — вазоконстрикція vs вазодилатація', descEn: 'Cold/warm skin — vasoconstriction vs vasodilation',
    icon: '🌡️',
    revealsFor: {
      hypovolemic:            'Шкіра ХОЛОДНА, волога, бліда. Вазоконстрикція — компенсаторна реакція',
      cardiogenic:            'Шкіра ХОЛОДНА, мармурова. Низький серцевий викид → вазоконстрикція',
      distributive_sepsis:    'Шкіра ТЕПЛА, рожева (рання стадія). Вазодилатація. Симптом "теплого шоку"',
      distributive_vasoplegia:'Шкіра ТЕПЛА, рожева. Масивна вазодилатація після ШК',
      obstructive:            'Шкіра ХОЛОДНА, ціанотична. Критичне зниження серцевого викиду',
    },
    revealsForEn: {
      hypovolemic:            'Skin COLD, moist, pale. Vasoconstriction — compensatory response',
      cardiogenic:            'Skin COLD, mottled. Low cardiac output → vasoconstriction',
      distributive_sepsis:    'Skin WARM, pink (early stage). Vasodilation. "Warm shock" sign',
      distributive_vasoplegia:'Skin WARM, pink. Massive vasodilation after CPB',
      obstructive:            'Skin COLD, cyanotic. Critical reduction in cardiac output',
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
  labelEn: string;
  description: string;
  descEn: string;
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
    label: 'Рідинний болюс 500 мл', labelEn: 'Fluid bolus 500 ml',
    description: 'Кристалоїди в/в швидко', descEn: 'IV crystalloids rapidly',
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
    label: 'Норадреналін ↑ дозу', labelEn: 'Norepinephrine ↑ dose',
    description: 'Вазоконстриктор — підвищення ЗПСО', descEn: 'Vasopressor — increase SVR',
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
    label: 'Вазопресин 0.03 Од/хв', labelEn: 'Vasopressin 0.03 U/min',
    description: 'При рефрактерній вазоплегії до норадреналіну', descEn: 'For norepinephrine-refractory vasoplegia',
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
    label: 'Добутамін 5 мкг/кг/хв', labelEn: 'Dobutamine 5 mcg/kg/min',
    description: 'Інотроп — підсилення скоротливості міокарда', descEn: 'Inotrope — enhance myocardial contractility',
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
    label: 'Перикардіоцентез / Реексплорація', labelEn: 'Pericardiocentesis / Re-exploration',
    description: 'Усунення механічної обструкції', descEn: 'Relieve mechanical obstruction',
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
    label: 'АБ-терапія + посіви', labelEn: 'Antibiotics + cultures',
    description: 'Етіотропне лікування сепсису', descEn: 'Causal treatment of sepsis',
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
  lang: Lang = 'ua',
): TreatmentResult => {
  const ua = lang === 'ua';
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
        ? (ua ? `✅ ${action.label}: хороший ефект. АТ підвищився. Це правильне етіотропне лікування.` : `✅ ${action.labelEn ?? action.label}: good effect. BP improved. This is the correct causal treatment.`)
        : (ua ? `✅ Повторне введення: менший ефект. Продовжуйте.` : `✅ Repeat dose: diminishing effect. Continue.`),
      isCausal: action.isCausal,
    };
  }

  if (isSymptomatic) {
    const bpBoost = actionId === 'norepinephrine' ? 12 :
                    actionId === 'fluids_500'      ? 8  : 6;
    return {
      bpChange: prevCount === 0 ? bpBoost : Math.round(bpBoost * 0.3),
      message: ua ? `⚠️ ${action.label}: АТ трохи підвищився, але це симптоматичний ефект. Причина не усунена.` : `⚠️ ${action.labelEn ?? action.label}: BP slightly improved, but this is a symptomatic effect. Cause not treated.`,
      hint: diagnosisConfirmed ? (ua ? `Для ${SHOCK_PROFILES[shockType].labelShort} потрібне інше лікування.` : `${SHOCK_PROFILES[shockType].labelShort} requires different treatment.`) : (ua ? 'Уточніть діагноз перед лікуванням.' : 'Clarify diagnosis before treatment.'),
      isCausal: false,
      penaltyNote: ua ? 'Симптоматичне лікування без усунення причини' : 'Symptomatic treatment without addressing cause',
    };
  }

  if (isHarmful) {
    const bpDrop = actionId === 'fluids_500'   ? -8 :
                   actionId === 'dobutamine'    ? -12 :
                   actionId === 'vasopressin'   ? -6  : -5;
    return {
      bpChange: bpDrop,
      message: ua ? `❌ ${action.label}: ПОГІРШЕННЯ! При ${SHOCK_PROFILES[shockType].labelShort} ця дія протипоказана або неефективна.` : `❌ ${action.labelEn ?? action.label}: DETERIORATION! This action is contraindicated or ineffective for ${SHOCK_PROFILES[shockType].labelShort}.`,
      hint: SHOCK_PROFILES[shockType].ddxClue,
      isCausal: false,
      penaltyNote: ua ? 'Неправильне лікування — погіршення стану' : 'Incorrect treatment — condition worsened',
    };
  }

  return {
    bpChange: 0,
    message: ua ? `${action.label}: без ефекту.` : `${action.labelEn ?? action.label}: no effect.`,
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
  lang: Lang = 'ua',
) => {
  const ua = lang === 'ua';
  const profile = SHOCK_PROFILES[shockType];
  const correctTreatment = TREATMENT_ACTIONS.find(a => a.effectiveFor.includes(shockType));

  const items = [
    {
      ok: testsPerformed.includes('cvp'),
      text: ua ? 'Перевірено ЦВТ (перший крок диференційної діагностики)' : 'CVP checked (first step of differential diagnosis)',
    },
    {
      ok: testsPerformed.includes('echo'),
      text: ua ? 'Виконано ехокардіографію' : 'Echocardiography performed',
    },
    {
      ok: testsPerformed.includes('lactate'),
      text: ua ? 'Замовлено лактат' : 'Lactate ordered',
    },
    {
      ok: testsPerformed.includes('plr'),
      text: ua ? 'Виконано PLR-тест (тест на волемочутливість)' : 'PLR test performed (fluid responsiveness test)',
    },
    {
      ok: diagnosisConfirmed,
      text: ua ? `Правильно встановлено діагноз: ${profile.label}` : `Correct diagnosis established: ${profile.label}`,
    },
    {
      ok: correctTreatment ? treatmentHistory.includes(correctTreatment.id) : false,
      text: ua ? `Призначено правильне лікування: ${correctTreatment?.label ?? '—'}` : `Correct treatment prescribed: ${correctTreatment?.labelEn ?? correctTreatment?.label ?? '—'}`,
    },
    {
      ok: penaltyActions.length === 0,
      text: ua ? 'Не застосовувались шкідливі або виключно симптоматичні дії' : 'No harmful or purely symptomatic actions used',
    },
    {
      ok: isCured && timeMin < 15,
      text: ua ? 'Стабілізація досягнута своєчасно (до 15 хв)' : 'Stabilization achieved in time (within 15 min)',
    },
  ];

  return {
    items,
    score: items.filter(i => i.ok).length,
    total: items.length,
    keyPoints: [
      ua ? `Тип шоку: ${profile.label}` : `Shock type: ${profile.label}`,
      ua ? `Механізм: ${profile.mechanism}` : `Mechanism: ${profile.mechanism}`,
      ua ? `Ключ до діагнозу: ${profile.ddxClue}` : `Diagnostic key: ${profile.ddxClue}`,
      ua ? `Пастка: ${profile.trapClue}` : `Pitfall: ${profile.trapClue}`,
    ],
  };
};
