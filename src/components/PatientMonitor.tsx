
import React from 'react';
import { Patient, PatientStatus, Vitals } from '../types';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Thermometer, Wind, Droplets, Info } from 'lucide-react';

interface PatientMonitorProps {
  patient: Patient;
  onEdit: () => void;
}

export const PatientMonitor: React.FC<PatientMonitorProps> = ({ patient, onEdit }) => {
  const { currentVitals, history } = patient;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Patient Info Header */}
      <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-[#0B0E14]">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {patient.name} <span className="text-gray-500 font-normal ml-2 font-mono text-sm">#440219</span>
          </h2>
          <div className="flex items-center gap-4 mt-0.5">
            <p className="text-[11px] text-gray-400 flex items-center gap-2 uppercase tracking-tight">
              Procedure: <span className="text-gray-200">{patient.surgeryType}</span> • 
              Status: <span className={patient.status === PatientStatus.CRITICAL ? 'text-red-500' : 'text-green-500'}>{patient.status}</span> • 
              Age: <span className="text-gray-200">{patient.age}</span>
            </p>
            {patient.preExistingConditions.length > 0 && (
              <div className="flex gap-1.5 border-l border-gray-800 pl-4">
                {patient.preExistingConditions.slice(0, 2).map((c, i) => (
                  <span key={i} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 rounded font-medium border border-gray-700">
                    {c}
                  </span>
                ))}
                {patient.preExistingConditions.length > 2 && <span className="text-[9px] text-gray-600">+{patient.preExistingConditions.length - 2} more</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded transition tracking-widest uppercase shadow-lg shadow-red-900/20">
            EMERGENCY PAGE
          </button>
          <button 
            onClick={onEdit}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold rounded tracking-widest uppercase border border-gray-700"
          >
            ADJUST THRESHOLDS
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden">
        {/* Waveforms Section */}
        <div className="col-span-12 lg:col-span-8 space-y-4 overflow-y-auto pr-1">
          <div className="bg-black rounded border border-gray-800 h-[140px] relative overflow-hidden group">
            <div className="absolute top-2 left-2 text-[9px] font-bold text-green-500 uppercase tracking-widest">ECG II (LIVE)</div>
            <div className="w-full h-full flex items-end">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={history.slice(-40)}>
                   <Line 
                    type="monotone" 
                    dataKey="heartRate" 
                    stroke="#22c55e" 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                   />
                 </LineChart>
               </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-black rounded border border-gray-800 h-[140px] relative overflow-hidden group">
            <div className="absolute top-2 left-2 text-[9px] font-bold text-blue-400 uppercase tracking-widest">Arterial Pressure (ABP)</div>
            <div className="w-full h-full flex items-end opacity-60">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={history.slice(-40)}>
                   <Area 
                    type="step" 
                    dataKey="spo2" 
                    stroke="#3b82f6" 
                    fill="#3b82f633"
                    strokeWidth={1.5} 
                    isAnimationActive={false}
                   />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
            <div className="absolute top-2 right-2 text-blue-400 font-mono text-xl font-bold">120/80</div>
          </div>

          {/* Vitals Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <VitalCard 
              label="Heart Rate" 
              value={currentVitals.heartRate} 
              unit="bpm" 
              status={currentVitals.heartRate > 100 || currentVitals.heartRate < 50 ? 'warning' : 'stable'}
              colorClass="text-green-400"
            />
            <VitalCard 
              label="SpO2" 
              value={currentVitals.spo2} 
              unit="%" 
              status={currentVitals.spo2 < 93 ? 'critical' : 'stable'}
              colorClass="text-blue-400"
            />
            <VitalCard 
              label="Temp" 
              value={currentVitals.temperature} 
              unit="°C" 
              status={currentVitals.temperature > 37.5 ? 'warning' : 'stable'}
              colorClass="text-white"
            />
            <VitalCard 
              label="Resp Rate" 
              value={18} 
              unit="/min" 
              status="stable"
              colorClass="text-white"
            />
          </div>
        </div>

        {/* Right Sidebar: Side Metrics */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-[#11141D] rounded border border-gray-800 flex flex-col flex-1 min-h-[200px]">
             <div className="p-2 border-b border-gray-800 bg-[#151923] text-[9px] font-bold text-gray-500 uppercase tracking-widest">
               Medications / Flow
             </div>
             <div className="p-3 space-y-2.5 text-[11px]">
               <FlowRow label="Norepinephrine" value="0.05 mcg/kg/min" />
               <FlowRow label="Fentanyl" value="50 mcg/hr" />
               <FlowRow label="Insulin Perf." value="2.5 U/hr" />
               <div className="pt-2 border-t border-gray-800 mt-2">
                 <FlowRow label="Urine Output" value="45 mL/hr" subValue="(last 1h)" />
               </div>
             </div>
          </div>

          <div className="bg-[#11141D] rounded border border-gray-800 overflow-hidden">
             <div className="p-2 border-b border-gray-800 bg-[#151923] text-[9px] font-bold text-gray-500 uppercase tracking-widest">
               Oxygen Delivery
             </div>
             <div className="p-3 flex flex-col gap-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-gray-500 uppercase">FiO2</span>
                  <span className="text-sm font-mono font-bold text-white">40%</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-gray-500 uppercase">Mode</span>
                  <span className="text-[10px] font-bold text-blue-400">HFNC</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const VitalCard = ({ label, value, unit, status, colorClass }: any) => {
  const isCritical = status === 'critical';
  const isWarning = status === 'warning';

  return (
    <div className={`
      p-3 rounded border bg-[#11141D] transition-colors
      ${isCritical ? 'bg-red-500/5 border-red-500/50' : isWarning ? 'border-amber-500/30' : 'border-gray-800'}
    `}>
      <div className={`text-[10px] font-bold uppercase mb-1 tracking-tight ${isCritical ? 'text-red-400' : 'text-gray-500'}`}>
        {label}
      </div>
      <div className="flex items-baseline justify-between">
        <span className={`text-3xl font-mono font-bold tracking-tighter ${isCritical ? 'text-red-500' : colorClass}`}>
          {value}
        </span>
        <span className="text-[10px] text-gray-600 font-medium uppercase">{unit}</span>
      </div>
    </div>
  );
};

const FlowRow = ({ label, value, subValue }: any) => (
  <div className="flex justify-between items-center group">
    <span className="text-gray-500 group-hover:text-gray-400 transition-colors">{label}:</span>
    <div className="text-right">
      <span className="font-mono text-white font-medium">{value}</span>
      {subValue && <span className="block text-[8px] text-gray-600 italic -mt-0.5">{subValue}</span>}
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: PatientStatus }) => {
  const config = {
    [PatientStatus.STABLE]: { color: 'bg-emerald-500', text: 'Стабільно' },
    [PatientStatus.WARNING]: { color: 'bg-amber-500', text: 'Увага' },
    [PatientStatus.CRITICAL]: { color: 'bg-red-500', text: 'Критично' },
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
      <div className={`w-2 h-2 rounded-full ${config[status].color} shadow-[0_0_8px] shadow-${config[status].color}`} />
      <span className="text-xs font-semibold">{config[status].text}</span>
    </div>
  );
};
