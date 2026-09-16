
import React, { useState } from 'react';
import { Patient, VitalThresholds, PatientStatus } from '../types';
import { motion } from 'motion/react';
import { X, Save, UserPlus, Info } from 'lucide-react';

interface PatientModalProps {
  patient?: Patient;
  onClose: () => void;
  onSave: (patient: Partial<Patient>) => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({ patient, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Patient>>(
    patient || {
      name: '',
      age: 45,
      gender: 'M',
      bedNumber: '',
      surgeryType: '',
      preExistingConditions: [],
      thresholds: {
        hrMin: 50,
        hrMax: 100,
        spo2Min: 94,
        tempMax: 37.5
      }
    }
  );

  const [conditionInput, setConditionInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addCondition = () => {
    if (conditionInput.trim()) {
      setFormData(prev => ({
        ...prev,
        preExistingConditions: [...(prev.preExistingConditions || []), conditionInput.trim()]
      }));
      setConditionInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0d0f14] border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#11141D]">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            {patient ? 'Edit Patient Profile' : 'Register New Patient'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Demographic Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Demographics & Ward</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputGroup label="Full Name">
                <input 
                  required
                  className="w-full bg-black border border-gray-800 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </InputGroup>
              <div className="grid grid-cols-2 gap-2">
                <InputGroup label="Age">
                  <input 
                    type="number"
                    className="w-full bg-black border border-gray-800 rounded px-2 py-2 text-sm"
                    value={formData.age}
                    onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                  />
                </InputGroup>
                <InputGroup label="Bed">
                  <input 
                    required
                    placeholder="e.g. 104"
                    className="w-full bg-black border border-gray-800 rounded px-2 py-2 text-sm"
                    value={formData.bedNumber}
                    onChange={e => setFormData({...formData, bedNumber: e.target.value})}
                  />
                </InputGroup>
              </div>
            </div>
          </section>

          {/* Clinical Section */}
          <section className="space-y-4 pt-4 border-t border-gray-900">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Clinical Context</h3>
            <InputGroup label="Surgery Type">
              <input 
                required
                placeholder="e.g. Mitral Valve Replacement"
                className="w-full bg-black border border-gray-800 rounded px-3 py-2 text-sm"
                value={formData.surgeryType}
                onChange={e => setFormData({...formData, surgeryType: e.target.value})}
              />
            </InputGroup>
            
            <InputGroup label="Pre-existing Conditions">
              <div className="flex gap-2 mb-2">
                <input 
                  className="flex-1 bg-black border border-gray-800 rounded px-3 py-1.5 text-xs"
                  placeholder="Add condition..."
                  value={conditionInput}
                  onChange={e => setConditionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCondition())}
                />
                <button type="button" onClick={addCondition} className="px-3 bg-gray-800 rounded text-[10px] font-bold">ADD</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.preExistingConditions?.map((c, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded text-[10px] flex items-center gap-2">
                    {c}
                    <X size={10} className="cursor-pointer hover:text-white" onClick={() => setFormData(f => ({...f, preExistingConditions: f.preExistingConditions?.filter((_, idx) => idx !== i)}))} />
                  </span>
                ))}
              </div>
            </InputGroup>
          </section>

          {/* Alert Thresholds Section */}
          <section className="space-y-4 pt-4 border-t border-gray-900">
             <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">Monitoring Thresholds (Custom Alerts)</h3>
                <span className="text-[9px] text-gray-600 italic">Overrides global defaults</span>
             </div>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               <ThresholdInput 
                 label="HR Min" 
                 value={formData.thresholds?.hrMin} 
                 onChange={val => setFormData({ ...formData, thresholds: { ...formData.thresholds!, hrMin: val } })} 
               />
               <ThresholdInput 
                 label="HR Max" 
                 value={formData.thresholds?.hrMax} 
                 onChange={val => setFormData({ ...formData, thresholds: { ...formData.thresholds!, hrMax: val } })} 
               />
               <ThresholdInput 
                 label="SpO2 Min" 
                 value={formData.thresholds?.spo2Min} 
                 onChange={val => setFormData({ ...formData, thresholds: { ...formData.thresholds!, spo2Min: val } })} 
               />
               <ThresholdInput 
                 label="Temp Max" 
                 value={formData.thresholds?.tempMax} 
                 onChange={val => setFormData({ ...formData, thresholds: { ...formData.thresholds!, tempMax: val } })} 
               />
             </div>
          </section>
        </form>

        <div className="p-4 border-t border-gray-800 bg-[#11141D] flex justify-end gap-3 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-lg shadow-blue-900/20 flex items-center gap-2"
          >
            <Save size={14} /> SAVE PROFILE
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const InputGroup = ({ label, children }: any) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

const ThresholdInput = ({ label, value, onChange }: any) => (
  <div className="bg-black/40 border border-gray-800 p-2 rounded">
    <label className="text-[8px] font-bold text-gray-600 uppercase block mb-1">{label}</label>
    <input 
      type="number" 
      step="0.1"
      className="w-full bg-transparent font-mono text-sm font-bold text-white outline-none"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    />
  </div>
);
