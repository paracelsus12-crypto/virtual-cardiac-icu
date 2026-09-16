
import React from 'react';
import { t } from '../utils/i18n';
import { Activity, Bell, Users, Heart, ShieldAlert, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface ICULayoutProps {
  lang?: 'ua' | 'en';
  onLangToggle?: () => void;
  children: React.ReactNode;
  alertCount: number;
  bedCount: number;
  onShowAlerts: () => void;
}

export const ICULayout: React.FC<ICULayoutProps> = ({ children, alertCount, bedCount, lang = 'ua', onLangToggle, onShowAlerts }) => {
  return (
    <div className="flex h-screen w-full bg-[#0B0E14] text-gray-300 overflow-hidden font-sans flex-col">
      {/* Header Navigation */}
      <header className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#11141D] z-30">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-1.5 rounded flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-sm font-bold tracking-wider text-white uppercase hidden sm:block">
            V-ICU | Cardiac Recovery - Wing 4C
          </h1>
          <h1 className="text-sm font-bold tracking-wider text-white uppercase sm:hidden">
            V-ICU
          </h1>
        </div>
        <div className="flex items-center gap-6 text-[11px]">
          <div className="hidden sm:flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="uppercase tracking-tight text-gray-400">{bedCount} {lang === 'ua' ? 'Активних ліжок' : 'Active Beds'}</span>
          </div>
          <div className="flex gap-2 items-center cursor-pointer hover:opacity-80" onClick={onShowAlerts}>
            <span className={`w-2 h-2 rounded-full ${alertCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></span>
            <span className="uppercase tracking-tight text-gray-400 font-bold">{alertCount} {lang === 'ua' ? 'Активних тривог' : 'Active Alerts'}</span>
          </div>
          {onLangToggle && (
            <button
              onClick={onLangToggle}
              className="px-2.5 py-1 rounded text-xs font-bold border transition-colors"
              style={{ background: '#001828', color: '#4499cc', border: '1px solid #0d4060' }}
            >
              {lang === 'ua' ? 'EN' : 'UA'}
            </button>
          )}
          <div className="px-3 py-1 border border-gray-700 rounded bg-gray-800/50 text-gray-200 font-medium hidden md:block">
            Dr. Kostroma (Cardiology)
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Bed Overview -> This is handled by the parent grid in App.tsx now to match theme better */}
        {children}
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-gray-800 bg-[#0B0E14] px-4 flex items-center justify-between text-[10px] text-gray-500 z-30">
        <div className="flex gap-4">
          <span>{lang === 'ua' ? 'СТАТУС' : 'SYSTEM STATUS'}: <span className="text-green-500 font-bold">{lang === 'ua' ? 'ОНЛАЙН' : 'ONLINE'}</span></span>
          <span>{lang === 'ua' ? "ЗВ'ЯЗОК" : 'HL7 LINK'}: <span className="text-green-500 font-bold">{lang === 'ua' ? 'АКТИВНИЙ' : 'ACTIVE'}</span></span>
        </div>
        <div className="font-mono uppercase hidden sm:block">
          Current Time: {new Date().toLocaleTimeString()} EET | Secure Connection Established
        </div>
      </footer>
    </div>
  );
};

const NavItem = ({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) => (
  <button className={`
    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group
    ${active ? 'bg-blue-600/10 text-blue-500 shadow-sm' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}
  `}>
    <span className={`${active ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 20 })}
    </span>
    <span className="hidden md:block font-medium text-sm">{label}</span>
    {active && <motion.div layoutId="nav-glow" className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full" />}
  </button>
);
