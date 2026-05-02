
import { Patient, PatientStatus, Vitals, ICUAlert, VitalThresholds } from '../types';

// ============================================================
// ІНДИВІДУАЛЬНІ ПРОФІЛІ МЕДИКАМЕНТІВ
// ============================================================
export interface MedProfile {
  ventilation: string;
  fio2: string;
  mode: string;
  analgesia: string[];
  vasoactive: string[];
  other: string[];
}

export const PATIENT_MEDS: Record<string, MedProfile> = {
  p1: {
    ventilation: 'Екстубований',
    fio2: '40%',
    mode: 'HFNC',
    analgesia: [
      'Парацетамол 1 г × 4/добу в/в',
      'Кеторолак 30 мг × 3/добу в/в',
    ],
    vasoactive: [
      'Норадреналін 0.03 мкг/кг/хв ↓',
    ],
    other: [
      'Інсулін 2 Од/год (ЦД 2 типу)',
      'Гепарин 500 Од/год п/ш',
      'Аторвастатин 40 мг на ніч',
    ],
  },
  p2: {
    ventilation: 'ШВЛ',
    fio2: '50%',
    mode: 'SIMV + PS',
    analgesia: [
      'Пропофол 1 мг/кг/год',
      'Фентаніл 25 мкг/год',
    ],
    vasoactive: [
      'Норадреналін 0.05 мкг/кг/хв',
      'Добутамін 3 мкг/кг/хв',
    ],
    other: [
      'Аміодарон 600 мг/добу (ФП)',
      'Варфарин 2.5 мг (МНО контроль)',
      'Інсулін 1.5 Од/год (ЦД 2 типу)',
    ],
  },
  p3: {
    ventilation: 'Самостійне дихання',
    fio2: '—',
    mode: 'Носова канюля 3 л/хв',
    analgesia: [
      'Кеторолак 30 мг × 3/добу в/в',
      'Морфін 2 мг в/в за потребою',
    ],
    vasoactive: [],
    other: [
      'Клопідогрель 75 мг + АСА 100 мг',
      'Гепарин 1000 Од/год в/в',
      'Розувастатин 20 мг на ніч',
      'Еноксапарин 0.4 мл п/ш × 2/добу',
    ],
  },
  p4: {
    ventilation: 'ШВЛ',
    fio2: '60%',
    mode: 'PC-AC',
    analgesia: [
      'Фентаніл 50 мкг/год',
      'Мідазолам 2 мг/год',
    ],
    vasoactive: [
      'Норадреналін 0.08 мкг/кг/хв',
      'Вазопресин 0.03 Од/хв',
    ],
    other: [
      'Транексамова к-та 1 г × 3/добу',
      'СЗП 2 дози (МНО > 1.8)',
      'Пантопразол 40 мг/добу',
      'Діурез: Фуросемід 20 мг за потребою',
    ],
  },
  p5: {
    ventilation: 'Екстубована',
    fio2: '35%',
    mode: 'Маска Вентурі',
    analgesia: [
      'Парацетамол 1 г × 4/добу в/в',
      'Кеторолак 15 мг × 3/добу в/в',
    ],
    vasoactive: [],
    other: [
      'Іпратропій інг. × 4/добу (ХОЗЛ)',
      'Сальбутамол інг. за потребою',
      'Гепарин 500 Од/год п/ш',
      'Аторвастатин 40 мг на ніч',
      'АСА 100 мг/добу',
    ],
  },
};

// ============================================================
// ПАЦІЄНТИ
// ============================================================
const DEFAULT_THRESHOLDS: VitalThresholds = {
  hrMin: 50, hrMax: 100, spo2Min: 94, tempMax: 37.8,
};

const PATIENTS_MOCK: Patient[] = [
  {
    id: 'p1',
    name: 'Коваленко М.І.',
    age: 67, gender: 'M',
    bedNumber: '1',
    surgeryType: 'АКШ ×3 (ШК)',
    preExistingConditions: ['ЦД 2 типу', 'ГХ ІІІ ст.', 'ІХС'],
    status: PatientStatus.STABLE,
    thresholds: { ...DEFAULT_THRESHOLDS },
    currentVitals: {
      heartRate: 68, bloodPressure: '118/72',
      spo2: 97, temperature: 36.4, respiratoryRate: 14,
      timestamp: new Date().toISOString(),
    },
    history: [],
  },
  {
    id: 'p2',
    name: 'Петренко В.О.',
    age: 71, gender: 'F',
    bedNumber: '2',
    surgeryType: 'Протезування АК (ШК)',
    preExistingConditions: ['ФП (постійна)', 'ХСН ІІІ ФК', 'ЦД 2 типу'],
    status: PatientStatus.WARNING,
    thresholds: { ...DEFAULT_THRESHOLDS, hrMax: 110, spo2Min: 92 },
    currentVitals: {
      heartRate: 98, bloodPressure: '108/68',
      spo2: 93, temperature: 37.1, respiratoryRate: 18,
      timestamp: new Date().toISOString(),
    },
    history: [],
  },
  {
    id: 'p3',
    name: 'Іваненко С.П.',
    age: 58, gender: 'M',
    bedNumber: '3',
    surgeryType: 'Стентування ПКА (post-PCI)',
    preExistingConditions: ['ГКС (НСТЕМП)', 'ГХ ІІ ст.'],
    status: PatientStatus.WARNING,
    thresholds: { ...DEFAULT_THRESHOLDS, hrMax: 95 },
    currentVitals: {
      heartRate: 88, bloodPressure: '125/80',
      spo2: 96, temperature: 36.8, respiratoryRate: 16,
      timestamp: new Date().toISOString(),
    },
    history: [],
  },
  {
    id: 'p4',
    name: 'Мороз О.В.',
    age: 63, gender: 'M',
    bedNumber: '4',
    surgeryType: 'Резекція аневризми аорти (ШК)',
    preExistingConditions: ['АГ 3 ст.', 'ХНН 3 ст.', 'АСА 2'],
    status: PatientStatus.CRITICAL,
    thresholds: { ...DEFAULT_THRESHOLDS, hrMax: 90, spo2Min: 95 },
    currentVitals: {
      heartRate: 92, bloodPressure: '88/58',
      spo2: 95, temperature: 36.2, respiratoryRate: 20,
      timestamp: new Date().toISOString(),
    },
    history: [],
  },
  {
    id: 'p5',
    name: 'Бондаренко Т.І.',
    age: 55, gender: 'F',
    bedNumber: '5',
    surgeryType: 'АКШ ×2 (ШК)',
    preExistingConditions: ['Ожиріння 2 ст.', 'ХОЗЛ', 'ГХ ІІ ст.'],
    status: PatientStatus.STABLE,
    thresholds: { ...DEFAULT_THRESHOLDS, spo2Min: 93 },
    currentVitals: {
      heartRate: 74, bloodPressure: '122/78',
      spo2: 95, temperature: 36.9, respiratoryRate: 17,
      timestamp: new Date().toISOString(),
    },
    history: [],
  },
];

export const getInitialPatients = (): Patient[] => {
  return PATIENTS_MOCK.map(p => ({
    ...p,
    history: Array.from({ length: 40 }).map((_, i) => ({
      ...p.currentVitals,
      heartRate: p.currentVitals.heartRate + (Math.random() - 0.5) * 8,
      timestamp: new Date(Date.now() - (40 - i) * 2000).toISOString(),
    }))
  }));
};

export const generateVitalUpdate = (patient: Patient): Vitals => {
  const { currentVitals } = patient;
  const [sysCurr, diaCurr] = currentVitals.bloodPressure.split('/').map(Number);
  const newHr  = Math.max(40, Math.min(220, currentVitals.heartRate + (Math.random()-0.5)*4));
  const newSys = Math.max(70, Math.min(200, sysCurr + (Math.random()-0.5)*4));
  const newDia = Math.max(40, Math.min(120, diaCurr + (Math.random()-0.5)*2));
  const newSpo2 = Math.max(80, Math.min(100, currentVitals.spo2 + (Math.random()-0.5)*0.4));
  const newTemp = Math.max(34, Math.min(42, currentVitals.temperature + (Math.random()-0.5)*0.05));
  return {
    ...currentVitals,
    heartRate: Math.round(newHr),
    bloodPressure: `${Math.round(newSys)}/${Math.round(newDia)}`,
    spo2: Number(newSpo2.toFixed(1)),
    temperature: Number(newTemp.toFixed(1)),
    timestamp: new Date().toISOString(),
  };
};

// Статус — автоматично за показниками
export const computeStatus = (patient: Patient): PatientStatus => {
  const v = patient.currentVitals;
  const t = patient.thresholds;
  const [sys] = v.bloodPressure.split('/').map(Number);
  if (
    v.heartRate > t.hrMax + 20 || v.heartRate < t.hrMin - 10 ||
    v.spo2 < t.spo2Min - 4 ||
    sys < 80 || sys > 180 ||
    v.temperature > 38.5
  ) return PatientStatus.CRITICAL;
  if (
    v.heartRate > t.hrMax || v.heartRate < t.hrMin ||
    v.spo2 < t.spo2Min ||
    sys < 90 || sys > 160 ||
    v.temperature > t.tempMax
  ) return PatientStatus.WARNING;
  return PatientStatus.STABLE;
};

export const checkAlerts = (patient: Patient, vitals: Vitals): ICUAlert[] => {
  const alerts: ICUAlert[] = [];
  const { thresholds: t } = patient;
  const [sys] = vitals.bloodPressure.split('/').map(Number);

  if (vitals.heartRate > t.hrMax)
    alerts.push({ id: `HR_HIGH_${patient.id}_${Date.now()}`, patientId: patient.id, patientName: patient.name, type: 'HR', message: `ЧСС висока: ${vitals.heartRate} уд/хв`, severity: PatientStatus.CRITICAL, timestamp: vitals.timestamp, isRead: false });
  if (vitals.heartRate < t.hrMin)
    alerts.push({ id: `HR_LOW_${patient.id}_${Date.now()}`, patientId: patient.id, patientName: patient.name, type: 'HR', message: `ЧСС низька: ${vitals.heartRate} уд/хв`, severity: PatientStatus.CRITICAL, timestamp: vitals.timestamp, isRead: false });
  if (vitals.spo2 < t.spo2Min)
    alerts.push({ id: `SPO2_${patient.id}_${Date.now()}`, patientId: patient.id, patientName: patient.name, type: 'SPO2', message: `SpO₂ низьке: ${vitals.spo2}%`, severity: vitals.spo2 < t.spo2Min - 4 ? PatientStatus.CRITICAL : PatientStatus.WARNING, timestamp: vitals.timestamp, isRead: false });
  if (sys < 90)
    alerts.push({ id: `BP_LOW_${patient.id}_${Date.now()}`, patientId: patient.id, patientName: patient.name, type: 'BP', message: `АТ низький: ${vitals.bloodPressure} мм рт.ст.`, severity: sys < 80 ? PatientStatus.CRITICAL : PatientStatus.WARNING, timestamp: vitals.timestamp, isRead: false });
  if (vitals.temperature > t.tempMax)
    alerts.push({ id: `TEMP_${patient.id}_${Date.now()}`, patientId: patient.id, patientName: patient.name, type: 'TEMP', message: `Гіпертермія: ${vitals.temperature}°C`, severity: PatientStatus.WARNING, timestamp: vitals.timestamp, isRead: false });

  return alerts;
};
