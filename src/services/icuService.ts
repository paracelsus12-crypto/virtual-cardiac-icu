
import { Patient, PatientStatus, Vitals, ICUAlert, VitalThresholds } from '../types';

const DEFAULT_THRESHOLDS: VitalThresholds = {
  hrMin: 50,
  hrMax: 100,
  spo2Min: 94,
  tempMax: 37.5,
};

const PATIENTS_MOCK: Patient[] = [
  {
    id: 'p1',
    name: 'Іваненко Олександр',
    age: 62,
    gender: 'M',
    bedNumber: '101',
    surgeryType: 'АКШ (Коронарне шунтування)',
    preExistingConditions: ['Гіпертонія', 'Цукровий діабет 2 типу'],
    status: PatientStatus.STABLE,
    thresholds: { ...DEFAULT_THRESHOLDS },
    currentVitals: {
      heartRate: 72,
      bloodPressure: '120/80',
      spo2: 98,
      temperature: 36.6,
      respiratoryRate: 16,
      timestamp: new Date().toISOString(),
    },
    history: [],
  },
  {
    id: 'p2',
    name: 'Петренко Олена',
    age: 58,
    gender: 'F',
    bedNumber: '102',
    surgeryType: 'Заміна мітрального клапана',
    preExistingConditions: ['Миготлива аритмія'],
    status: PatientStatus.WARNING,
    thresholds: { ...DEFAULT_THRESHOLDS, hrMax: 110, spo2Min: 92 },
    currentVitals: {
      heartRate: 105,
      bloodPressure: '135/90',
      spo2: 94,
      temperature: 37.2,
      respiratoryRate: 20,
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
      heartRate: p.currentVitals.heartRate + (Math.random() - 0.5) * 10,
      timestamp: new Date(Date.now() - (40 - i) * 2000).toISOString(),
    }))
  }));
};

export const generateVitalUpdate = (patient: Patient): Vitals => {
  const { currentVitals } = patient;
  
  const hrChange = (Math.random() - 0.5) * 4;
  const spo2Change = (Math.random() - 0.5) * 0.4;
  const tempChange = (Math.random() - 0.5) * 0.05;
  
  // Parse current BP
  const [sysCurr, diaCurr] = currentVitals.bloodPressure.split('/').map(Number);
  const sysChange = (Math.random() - 0.5) * 4;
  const diaChange = (Math.random() - 0.5) * 2;
  const newSys = Math.max(70, Math.min(200, sysCurr + sysChange));
  const newDia = Math.max(40, Math.min(120, diaCurr + diaChange));

  const newHr = Math.max(40, Math.min(220, currentVitals.heartRate + hrChange));
  const newSpo2 = Math.max(80, Math.min(100, currentVitals.spo2 + spo2Change));
  const newTemp = Math.max(34, Math.min(42, currentVitals.temperature + tempChange));
  
  return {
    ...currentVitals,
    heartRate: Math.round(newHr),
    bloodPressure: `${Math.round(newSys)}/${Math.round(newDia)}`,
    spo2: Number(newSpo2.toFixed(1)),
    temperature: Number(newTemp.toFixed(1)),
    timestamp: new Date().toISOString(),
  };
};

export const checkAlerts = (patient: Patient, vitals: Vitals): ICUAlert[] => {
  const alerts: ICUAlert[] = [];
  const { thresholds } = patient;

  if (vitals.heartRate > thresholds.hrMax) {
    alerts.push({
      id: `HR_HIGH_${patient.id}_${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'HR',
      message: `HR HIGH: ${vitals.heartRate} bpm (Limit: ${thresholds.hrMax})`,
      severity: PatientStatus.CRITICAL,
      timestamp: vitals.timestamp,
      isRead: false,
    });
  } else if (vitals.heartRate < thresholds.hrMin) {
    alerts.push({
      id: `HR_LOW_${patient.id}_${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'HR',
      message: `HR LOW: ${vitals.heartRate} bpm (Limit: ${thresholds.hrMin})`,
      severity: PatientStatus.CRITICAL,
      timestamp: vitals.timestamp,
      isRead: false,
    });
  }

  if (vitals.spo2 < thresholds.spo2Min) {
    alerts.push({
      id: `SPO2_LOW_${patient.id}_${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'SPO2',
      message: `SPO2 LOW: ${vitals.spo2}% (Limit: ${thresholds.spo2Min})`,
      severity: vitals.spo2 < thresholds.spo2Min - 4 ? PatientStatus.CRITICAL : PatientStatus.WARNING,
      timestamp: vitals.timestamp,
      isRead: false,
    });
  }

  if (vitals.temperature > thresholds.tempMax) {
    alerts.push({
      id: `TEMP_HIGH_${patient.id}_${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      type: 'TEMP',
      message: `Hyperthermia: ${vitals.temperature}°C (Limit: ${thresholds.tempMax})`,
      severity: PatientStatus.WARNING,
      timestamp: vitals.timestamp,
      isRead: false,
    });
  }

  return alerts;
};
