// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import {
  getMyProfile, searchProfiles, grantUserAccess, updateCollaboratorPermission, removeCollaborator, getCollaborators
} from '../lib/supabase';
import {
  Moon, Sun, Settings, X, Loader2, Users, Search, Shield, Download, FileText, Printer, FileSpreadsheet
} from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchScope: string;
  setSearchScope: (scope: string) => void;
  onSignOut: () => void;
  onExportCsv?: () => void;
  onPrint?: () => void;
  viewOnly?: boolean;
  userRole?: string;
}

export default function Header({
  theme, lang, toggleTheme, setLang,
  searchQuery, setSearchQuery, searchScope, setSearchScope,
  onSignOut, onExportCsv, onPrint,
  viewOnly = false, userRole = 'viewer',
}: HeaderProps) {
  const dk = theme === 'dark';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  const [showShare, setShowShare] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const surface  = dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-[#1E293B] border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');
  const iconBtn  = cn('p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900');

  return (
    <>
      <header className={cn('shrink-0 flex items-center gap-3 px-6 py-3 border-b', surface)}>
        <div className="flex-1 relative flex items-center max-w-2xl">
          <div className={cn('flex items-center rounded-lg border transition-all focus-within:ring-2 focus-within:ring-blue-500/50 w-full',
            dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200'
          )}>
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value)}
              className={cn('h-9 pl-3 pr-8 rounded-l-lg text-xs font-bold outline-none border-r appearance-none cursor-pointer',
                dk ? 'bg-[#0F172A] border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              )}
            >
              <option value="all">{lang === 'de' ? 'Überall' : 'All Fields'}</option>
              <option value="hotel">{lang === 'de' ? 'Hotelname' : 'Hotel Name'}</option>
              <option value="city">{lang === 'de' ? 'Stadt' : 'City'}</option>
              <option value="company">{lang === 'de' ? 'Firma' : 'Company'}</option>
              <option value="employee">{lang === 'de' ? 'Mitarbeiter' : 'Employee'}</option>
              <option value="invoice">{lang === 'de' ? 'Rechnung' : 'Invoice No.'}</option>
            </select>
            <div className="relative flex-1 flex items-center">
              <Search size={15} className={cn('absolute left-3 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'de' ? 'Suchen...' : 'Search...'}
                className={cn('w-full h-9 pl-9 pr-9 text-sm outline-none bg-transparent', dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')} 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3">
                  <X size={14} className={dk ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto relative">
          
          {/* EXPORT / PRINT MENU */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className={iconBtn} title="Export & Print">
              <Download size={18} />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className={cn("absolute right-0 top-full mt-2 z-50 p-2 rounded-xl border shadow-xl w-48", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <p className={cn("px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest", dk ? "text-slate-500" : "text-slate-400")}>
                    {lang === 'de' ? 'Bericht erstellen' : 'Generate Report'}
                  </p>
                  <button onClick={() => { onPrint?.(); setShowExportMenu(false); }} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-all", dk ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-700")}>
                    <Printer size={14} className="text-blue-500" /> Print / Save as PDF
                  </button>
                  <button onClick={() => { onExportCsv?.(); setShowExportMenu(false); }} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-all", dk ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-700")}>
                    <FileSpreadsheet size={14} className="text-green-500" /> Export as CSV / Excel
                  </button>
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <button onClick={() => setShowShare(true)} className={iconBtn} title={lang === 'de' ? 'Zugang teilen' : 'Share Access'}>
              <Users size={18} />
            </button>
          )}
          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className={cn(iconBtn, 'text-xs font-black px-3')}>
            {lang === 'de' ? 'EN' : 'DE'}
          </button>
          <button onClick={toggleTheme} className={iconBtn}>
            {dk ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className={iconBtn}>
            <Settings size={18} />
          </button>
          <button onClick={onSignOut} className="ml-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-sm transition-all shadow-md">
            {lang === 'de' ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </header>
    </>
  );
}
