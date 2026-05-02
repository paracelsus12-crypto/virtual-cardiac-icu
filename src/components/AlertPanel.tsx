
import React from 'react';
import { ICUAlert, PatientStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, AlertCircle, Check } from 'lucide-react';

interface AlertPanelProps {
  alerts: ICUAlert[];
  onClose: () => void;
  onClear: (id: string) => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, onClose, onClear }) => {
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
        onClick={onClose} 
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0d0f14] border-l border-gray-800 z-50 flex flex-col shadow-2xl"
      >
        <div className="p-4 border-b border-gray-800 bg-[#151923] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xs uppercase tracking-widest text-gray-400">Monitoring Alerts</h2>
            {alerts.length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">
                {alerts.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded transition-colors text-gray-500">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <AnimatePresence initial={false}>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 opacity-50">
                <Check size={32} className="text-green-500/50" />
                <p className="text-[10px] uppercase tracking-widest font-bold">All Systems Clear</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`
                    p-3 rounded border flex gap-3 relative overflow-hidden transition-colors
                    ${alert.severity === PatientStatus.CRITICAL 
                      ? 'bg-red-500/5 border-red-500/30' 
                      : 'bg-[#151923] border-gray-800'}
                  `}
                >
                  <div className={`
                    w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0
                    ${alert.severity === PatientStatus.CRITICAL ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-amber-500'}
                  `} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-white truncate">{alert.patientName}</p>
                      <button 
                        onClick={() => onClear(alert.id)}
                        className="text-[9px] font-bold text-blue-500 uppercase hover:text-blue-400 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-gray-300 mt-0.5 leading-tight">{alert.message}</p>
                    <p className="text-[9px] text-gray-600 font-mono mt-1.5 uppercase tracking-tighter">
                      {new Date(alert.timestamp).toLocaleTimeString()} • SYSTEM_ALERT_LOG
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};
