
import React, { useState, useEffect, useRef } from 'react';
import { ICULayout } from './components/ICULayout';
import { PatientList } from './components/PatientList';
import { PatientMonitor } from './components/PatientMonitor';
import { AlertPanel } from './components/AlertPanel';
import { PatientModal } from './components/PatientModal';
import { Patient, ICUAlert, PatientStatus } from './types';
import { getInitialPatients, generateVitalUpdate, checkAlerts, computeStatus } from './services/icuService';
import { AnimatePresence, motion } from 'motion/react';
import { UserPlus } from 'lucide-react';

export default function App() {
  const [agreed, setAgreed] = useState(() => sessionStorage.getItem('icu_agreed') === '1');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [alerts, setAlerts] = useState<ICUAlert[]>([]);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | undefined>();
  
  // Initialize patients
  useEffect(() => {
    const initial = getInitialPatients();
    setPatients(initial);
    setSelectedPatientId(initial[0]?.id || '');
  }, []);

  // Simulation Loop
  useEffect(() => {
    if (patients.length === 0) return;

    const interval = setInterval(() => {
      setPatients(prevPatients => {
        return prevPatients.map(patient => {
          const newVitals = generateVitalUpdate(patient);
          const newAlerts = checkAlerts(patient, newVitals);
          
          if (newAlerts.length > 0) {
            setAlerts(prev => {
              const updated = [...prev];
              newAlerts.forEach(alert => {
                const exists = updated.some(a => a.patientId === alert.patientId && a.type === alert.type);
                if (!exists) updated.unshift(alert);
              });
              return updated.slice(0, 50); // Keep last 50
            });
          }

          const newHistory = [...patient.history, newVitals].slice(-50);
          
          const status = computeStatus({ ...patient, currentVitals: newVitals });

          return {
            ...patient,
            currentVitals: newVitals,
            history: newHistory,
            status: status
          };
        });
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [patients.length]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handleClearAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleSavePatient = (data: Partial<Patient>) => {
    if (editingPatient) {
      setPatients(prev => prev.map(p => p.id === editingPatient.id ? { ...p, ...data } as Patient : p));
    } else {
      const newPatient: Patient = {
        ...data,
        id: `p_${Date.now()}`,
        status: PatientStatus.STABLE,
        currentVitals: {
          heartRate: 70,
          bloodPressure: '120/80',
          spo2: 98,
          temperature: 36.6,
          respiratoryRate: 16,
          timestamp: new Date().toISOString(),
        },
        history: []
      } as Patient;
      setPatients(prev => [...prev, newPatient]);
      setSelectedPatientId(newPatient.id);
    }
    setShowPatientModal(false);
    setEditingPatient(undefined);
  };


  // ---- Disclaimer screen ----
  if (!agreed) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: '#000810' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
          style={{ background: '#000f1e', border: '1px solid #0d2035' }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center gap-3"
            style={{ borderColor: '#0d2035', background: '#00060f' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: '#551100', border: '1px solid #882200' }}>
              <span className="text-red-400 font-bold text-sm">!</span>
            </div>
            <div>
              <h1 className="font-bold text-white text-sm uppercase tracking-widest">
                Тільки для освітніх цілей
              </h1>
              <p className="text-[10px]" style={{ color: '#446688' }}>
                V-ICU · Virtual Cardiac ICU Simulator
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 text-sm leading-relaxed" style={{ color: '#aaccdd' }}>
            <p>
              Дана програма є <strong className="text-white">симулятором для навчання</strong>.
              Дані, отримані за допомогою програми, <strong className="text-red-400">не можуть бути підставою
              для встановлення діагнозу або призначення лікування реальним пацієнтам</strong>.
            </p>
            <p>
              Використання будь-якої інформації з цього додатка у реальній медичній практиці
              здійснюється на власний розсуд та під особисту відповідальність лікаря.
            </p>
            <p style={{ color: '#446688' }} className="text-xs">
              Автор не несе відповідальності за клінічні наслідки використання матеріалів симулятора
              поза навчальним контекстом.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: '#0d2035', background: '#00060f' }}>
            <button
              onClick={() => { sessionStorage.setItem('icu_agreed', '1'); setAgreed(true); }}
              className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all"
              style={{ background: '#004422', color: '#44ff88', border: '1px solid #006633' }}
            >
              Зрозуміло, продовжити
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ICULayout 
      alertCount={alerts.length}
      bedCount={patients.length}
      onShowAlerts={() => setShowAlertPanel(true)}
    >
      <div className="flex h-full w-full overflow-hidden">
        {/* Sidebar: Bed Overview */}
        <aside className="w-48 lg:w-60 border-r border-gray-800 flex flex-col bg-[#0F1219] shrink-0">
          <div className="p-2 text-[10px] font-bold text-gray-500 border-b border-gray-800 uppercase tracking-widest bg-[#11141D] flex justify-between items-center">
            Ward Overview
            <button 
              onClick={() => { setEditingPatient(undefined); setShowPatientModal(true); }}
              className="p-1 hover:bg-white/5 text-blue-500 rounded transition-colors"
            >
              <UserPlus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            <PatientList 
              patients={patients} 
              selectedId={selectedPatientId} 
              onSelect={setSelectedPatientId} 
            />
          </div>
          <div className="p-2 border-t border-gray-800 bg-[#11141D] text-[9px] text-gray-600 font-mono flex justify-between">
            <span>ACTIVE MONITORS: {patients.length}</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </aside>

        {/* Main Content: Selected Patient Monitor */}
        <div className="flex-1 overflow-hidden bg-[#0B0E14]">
          {selectedPatient ? (
            <PatientMonitor 
              patient={selectedPatient} 
              onEdit={() => { setEditingPatient(selectedPatient); setShowPatientModal(true); }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-700 font-mono text-sm uppercase tracking-widest">
               No Patient Selected
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAlertPanel && (
          <AlertPanel 
            alerts={alerts} 
            onClose={() => setShowAlertPanel(false)} 
            onClear={handleClearAlert}
          />
        )}
        {showPatientModal && (
          <PatientModal 
            patient={editingPatient}
            onClose={() => { setShowPatientModal(false); setEditingPatient(undefined); }}
            onSave={handleSavePatient}
          />
        )}
      </AnimatePresence>
    </ICULayout>
  );
}

