// src/components/SuperAdminHome.tsx
import React from 'react';
import { LayoutDashboard, Users, LogOut, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

interface SuperAdminHomeProps {
  onDashboard:      () => void;
  onUserManagement: () => void;
  onSignOut:        () => void;
  lang:             'de' | 'en';
  setLang:          (l: 'de' | 'en') => void;
  theme:            'dark' | 'light';
  toggleTheme:      () => void;
}

// SVG flag sprites – inline so no external deps needed
function FlagDE({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 4, display: 'block' }}>
      <rect width="24" height="8" fill="#000" />
      <rect y="8" width="24" height="8" fill="#D00" />
      <rect y="16" width="24" height="8" fill="#FFCE00" />
    </svg>
  );
}
function FlagUK({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 4, display: 'block' }}>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export default function SuperAdminHome({
  onDashboard, onUserManagement, onSignOut,
  lang, setLang, theme, toggleTheme,
}: SuperAdminHomeProps) {
  const dk = theme === 'dark';

  const t = {
    de: {
      greeting:      'Willkommen, Administrator',
      subtitle:      'Was möchten Sie heute tun?',
      dashboard:     'Dashboard',
      dashboardDesc: 'Vollständiger Zugriff auf Hotels, Kosten und Buchungsverwaltung.',
      users:         'Benutzerverwaltung',
      usersDesc:     'Benutzer verwalten, Rollen zuweisen, Zugriff erteilen oder entziehen.',
      signOut:       'Abmelden',
    },
    en: {
      greeting:      'Welcome, Administrator',
      subtitle:      'What would you like to do today?',
      dashboard:     'Dashboard',
      dashboardDesc: 'Full access to hotels, expenses, and booking management.',
      users:         'User Management',
      usersDesc:     'Manage users, assign roles, grant or revoke system access.',
      signOut:       'Sign Out',
    },
  };
  const txt = t[lang];

  return (
    <div className={cn(
      'min-h-screen flex flex-col items-center justify-center p-8 gap-10 relative',
      dk ? 'bg-[#020617] text-white' : 'bg-slate-100 text-slate-900'
    )}>
      {/* Top-right controls */}
      <div className="absolute top-5 right-6 flex items-center gap-2">
        <button
          onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
          title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
        >
          {lang === 'de' ? <FlagUK size={22} /> : <FlagDE size={22} />}
        </button>
        <button
          onClick={toggleTheme}
          className={cn('p-2 rounded-lg transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}
        >
          {dk ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Logo */}
      <div className="text-3xl font-black italic">
        Euro<span className="text-yellow-400">Track.</span>
      </div>

      {/* Greeting */}
      <div className="text-center">
        <h1 className="text-2xl font-black mb-1">{txt.greeting}</h1>
        <p className={cn('text-sm', dk ? 'text-slate-400' : 'text-slate-500')}>{txt.subtitle}</p>
      </div>

      {/* Two big cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Dashboard card */}
        <button
          onClick={onDashboard}
          className={cn(
            'group flex flex-col items-center gap-4 p-10 rounded-[2rem] border transition-all duration-200 text-center hover:scale-[1.02] hover:shadow-2xl',
            dk
              ? 'bg-[#0F172A] border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5'
              : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-blue-100'
          )}
        >
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
            dk ? 'bg-blue-500/10 group-hover:bg-blue-500/20' : 'bg-blue-50 group-hover:bg-blue-100'
          )}>
            <LayoutDashboard size={28} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-black mb-1">{txt.dashboard}</h2>
            <p className={cn('text-xs leading-relaxed', dk ? 'text-slate-400' : 'text-slate-500')}>
              {txt.dashboardDesc}
            </p>
          </div>
        </button>

        {/* User Management card */}
        <button
          onClick={onUserManagement}
          className={cn(
            'group flex flex-col items-center gap-4 p-10 rounded-[2rem] border transition-all duration-200 text-center hover:scale-[1.02] hover:shadow-2xl',
            dk
              ? 'bg-[#0F172A] border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/5'
              : 'bg-white border-slate-200 hover:border-yellow-400 hover:shadow-yellow-100'
          )}
        >
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
            dk ? 'bg-yellow-500/10 group-hover:bg-yellow-500/20' : 'bg-yellow-50 group-hover:bg-yellow-100'
          )}>
            <Users size={28} className="text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-black mb-1">{txt.users}</h2>
            <p className={cn('text-xs leading-relaxed', dk ? 'text-slate-400' : 'text-slate-500')}>
              {txt.usersDesc}
            </p>
          </div>
        </button>
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className={cn(
          'flex items-center gap-2 text-xs font-bold opacity-40 hover:opacity-80 transition-opacity mt-4',
          dk ? 'text-slate-300' : 'text-slate-600'
        )}
      >
        <LogOut size={13} />
        {txt.signOut}
      </button>
    </div>
  );
}
