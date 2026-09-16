
export enum PatientStatus {
  STABLE = 'STABLE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface VitalThresholds {
  hrMin: number;
  hrMax: number;
  spo2Min: number;
  tempMax: number;
}

export interface Vitals {
  heartRate: number;
  bloodPressure: string;
  spo2: number;
  temperature: number;
  respiratoryRate: number;
  timestamp: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  bedNumber: string;
  surgeryType: string;
  preExistingConditions: string[];
  status: PatientStatus;
  currentVitals: Vitals;
  history: Vitals[];
  thresholds: VitalThresholds;
}

export interface ICUAlert {
  id: string;
  patientId: string;
  patientName: string;
  type: 'HR' | 'BP' | 'SPO2' | 'TEMP';
  message: string;
  severity: PatientStatus;
  timestamp: string;
  isRead: boolean;
}
