import React from 'react';
import { LayoutDashboard, Bed, BarChart3, ShieldCheck, ChevronRight, Sun, Moon, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingProps {
  onLogin:      () => void;
  onRegister:   () => void;
  onAdminLogin: () => void;
  lang:         'de' | 'en';
  setLang:      (l: 'de' | 'en') => void;
  isDarkMode:   boolean;
  toggleTheme:  () => void;
}

// Inline SVG flag components — no external deps
function FlagDE({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.6)} viewBox="0 0 30 18"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: 3, display: 'block', boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }}
    >
      <rect width="30" height="6"  fill="#000" />
      <rect y="6"  width="30" height="6" fill="#D00" />
      <rect y="12" width="30" height="6" fill="#FFCE00" />
    </svg>
  );
}

function FlagUK({ size = 24 }: { size?: number }) {
  // Proper Union Jack proportions 2:1
  const w = size;
  const h = Math.round(size * 0.6);
  return (
    <svg width={w} height={h} viewBox="0 0 60 36"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: 3, display: 'block', boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }}
    >
      <rect width="60" height="36" fill="#012169" />
      {/* White diagonals */}
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="8" />
      {/* Red diagonals */}
      <path d="M0,0 L60,36" stroke="#C8102E" strokeWidth="4.8" />
      <path d="M60,0 L0,36" stroke="#C8102E" strokeWidth="4.8" />
      {/* White cross */}
      <path d="M30,0 V36 M0,18 H60" stroke="#fff" strokeWidth="12" />
      {/* Red cross */}
      <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7.2" />
    </svg>
  );
}

export default function Landing({
  onLogin, onRegister, onAdminLogin, lang, setLang, isDarkMode, toggleTheme,
}: LandingProps) {
  const content = {
    de: {
      tag:        'Mitarbeiter- und Kostenmanagement',
      title:      'Präzises Hotel Management',
      desc:       'Optimieren Sie Hotelbelegungen und tracken Sie Mitarbeiter-Substitutionen in Echtzeit für Europas GmbH',
      login:      'Anmelden',
      signup:     'Registrieren',
      getStarted: 'Jetzt Starten',
      adminLink:  'Systemadministration',
      features: [
        { icon: <LayoutDashboard size={20} />, title: 'Übersicht',    desc: 'Zentralisierte Verwaltung.' },
        { icon: <Bed            size={20} />, title: 'Betten-Logik', desc: 'EZ/DZ/TZ/WG Belegung.' },
        { icon: <BarChart3      size={20} />, title: 'Budget',        desc: 'Echtzeit-Summen.' },
        { icon: <ShieldCheck    size={20} />, title: 'Sicher',        desc: 'Cloud Speicherung.' },
      ],
    },
    en: {
      tag:        'Employee & Cost Management',
      title:      'Precision Hotel Management',
      desc:       'Optimize hotel occupancies and track employee substitutions in real-time for Europas GmbH',
      login:      'Log In',
      signup:     'Sign Up',
      getStarted: 'Get Started',
      adminLink:  'System Administration',
      features: [
        { icon: <LayoutDashboard size={20} />, title: 'Overview',  desc: 'Centralized management.' },
        { icon: <Bed            size={20} />, title: 'Bed Logic', desc: 'SR/DR/TR/WR tracking.' },
        { icon: <BarChart3      size={20} />, title: 'Budget',    desc: 'Real-time totals.' },
        { icon: <ShieldCheck    size={20} />, title: 'Secure',    desc: 'Cloud storage.' },
      ],
    },
  };

  const t = content[lang];

  return (
    <div className={cn('min-h-screen flex flex-col transition-colors duration-300',
      isDarkMode ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900')}>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-wrap justify-between items-center w-full gap-4">
        <div className="text-xl sm:text-2xl font-black italic">
          Euro<span className="text-[#EAB308]">Track.</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent transition-all"
          >
            {lang === 'de' ? <FlagUK size={24} /> : <FlagDE size={24} />}
          </button>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent transition-all">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button onClick={onLogin} className="text-xs sm:text-sm font-bold px-2 sm:px-4">{t.login}</button>
          <button onClick={onRegister}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg hover:bg-blue-700 transition-all">
            {t.signup}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32 text-center flex-1 flex flex-col items-center justify-center">
        <span className="px-3 sm:px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-500 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-6 sm:mb-8 inline-block">
          {t.tag}
        </span>
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black mb-6 sm:mb-8 tracking-tighter leading-tight">
          {t.title}
        </h1>
        <p className={cn('text-sm sm:text-lg md:text-xl mb-10 sm:mb-12 max-w-2xl mx-auto px-2',
          isDarkMode ? 'text-slate-400' : 'text-slate-600')}>
          {t.desc}
        </p>
        <button onClick={onRegister}
          className="px-6 py-4 sm:px-10 sm:py-5 bg-blue-600 text-white text-sm sm:text-base font-black rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-2 sm:gap-3 mx-auto">
          {t.getStarted} <ChevronRight size={20} />
        </button>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-12 sm:pb-20 w-full">
        {t.features.map((f, i) => (
          <div key={i} className={cn('p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border transition-all',
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm')}>
            <div className="mb-3 sm:mb-4 text-blue-500">{f.icon}</div>
            <h3 className="font-black text-sm sm:text-base mb-1.5 sm:mb-2">{f.title}</h3>
            <p className="text-xs opacity-60 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="w-full py-6 flex justify-center">
        <button
          onClick={onAdminLogin}
          className={cn(
            'flex items-center gap-1.5 text-[10px] sm:text-xs font-medium opacity-30 hover:opacity-100 transition-opacity',
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          <Settings size={11} />
          {t.adminLink}
        </button>
      </footer>
    </div>
  );
}
