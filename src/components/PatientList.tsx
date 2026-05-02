
import React from 'react';
import { Patient, PatientStatus } from '../types';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';

interface PatientListProps {
  patients: Patient[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const PatientList: React.FC<PatientListProps> = ({ patients, selectedId, onSelect }) => {
  return (
    <div className="w-full flex md:flex-col p-1 gap-1">
      {patients.map((patient) => (
        <motion.button
          key={patient.id}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(patient.id)}
          className={`
            relative flex flex-col p-2.5 rounded transition-all text-left min-w-[200px] md:min-w-0 border-l-2
            ${selectedId === patient.id 
              ? 'bg-gray-800/60 border-blue-500 shadow-lg' 
              : 'bg-transparent border-transparent hover:bg-gray-800/30'}
            ${patient.status === PatientStatus.CRITICAL && selectedId !== patient.id ? 'bg-red-900/10 border-red-500' : ''}
            ${patient.status === PatientStatus.WARNING && selectedId !== patient.id ? 'bg-amber-900/10 border-amber-500' : ''}
            ${patient.status === PatientStatus.STABLE && selectedId !== patient.id ? 'border-green-500/50' : ''}
          `}
        >
          <div className="flex justify-between items-center mb-1">
            <span className={`text-[10px] font-bold ${selectedId === patient.id ? 'text-white' : 'text-gray-400'}`}>
              Bed {patient.bedNumber}
            </span>
            <span className={`text-[9px] px-1 rounded font-bold tracking-tight
              ${patient.status === PatientStatus.CRITICAL ? 'bg-red-600 text-white' : 
                patient.status === PatientStatus.WARNING ? 'bg-amber-500/20 text-amber-500' : 
                'bg-green-900/50 text-green-400'}
            `}>
              {patient.status}
            </span>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className={`text-[11px] font-medium truncate ${selectedId === patient.id ? 'text-white' : 'text-gray-300'}`}>
              {patient.name}
            </h3>
            <p className="text-[9px] text-gray-500 truncate mt-0.5 uppercase tracking-wide">
              {patient.surgeryType.split('(')[0]}
            </p>
            
            <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px]">
               <div className="flex items-center gap-1">
                 <Activity size={10} className="text-red-500" />
                 <span className={patient.currentVitals.heartRate > 100 ? 'text-red-400' : 'text-gray-400'}>
                   {patient.currentVitals.heartRate}
                 </span>
               </div>
               <div className="flex items-center gap-1 border-l border-gray-800 pl-2">
                 <span className="text-[8px] text-gray-600 uppercase">SpO2</span>
                 <span className={patient.currentVitals.spo2 < 94 ? 'text-amber-500' : 'text-green-500'}>
                    {patient.currentVitals.spo2}%
                 </span>
               </div>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
};
