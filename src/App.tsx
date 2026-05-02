
import React, { useState, useEffect, useRef } from 'react';
import { ICULayout } from './components/ICULayout';
import { PatientList } from './components/PatientList';
import { PatientMonitor } from './components/PatientMonitor';
import { AlertPanel } from './components/AlertPanel';
import { PatientModal } from './components/PatientModal';
import { Patient, ICUAlert, PatientStatus } from './types';
import { getInitialPatients, generateVitalUpdate, checkAlerts } from './services/icuService';
import { AnimatePresence } from 'motion/react';
import { UserPlus } from 'lucide-react';

export default function App() {
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
          
          // Determine status based on active alerts
          let status = PatientStatus.STABLE;
          if (newAlerts.some(a => a.severity === PatientStatus.CRITICAL)) {
            status = PatientStatus.CRITICAL;
          } else if (newAlerts.some(a => a.severity === PatientStatus.WARNING)) {
            status = PatientStatus.WARNING;
          }

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

