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

// Inline SVG flag components
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
  const w = size;
  const h = Math.round(size * 0.6);
  return (
    <svg width={w} height={h} viewBox="0 0 60 36"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: 3, display: 'block', boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }}
    >
      <rect width="60" height="36" fill="#012169" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="8" />
      <path d="M0,0 L60,36" stroke="#C8102E" strokeWidth="4.8" />
      <path d="M60,0 L0,36" stroke="#C8102E" strokeWidth="4.8" />
      <path d="M30,0 V36 M0,18 H60" stroke="#fff" strokeWidth="12" />
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
    <div 
      className={cn('min-h-screen flex flex-col transition-colors duration-300 relative overflow-hidden text-base',
        isDarkMode ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900')}
      style={{ fontFamily: '"Poppins", sans-serif' }}
    >
      {/* Dynamic Background Mesh Gradient */}
      {isDarkMode && (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-blue-900/30 blur-[150px]"/>
          <div className="absolute bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-blue-600/30 blur-[150px]"/>
        </div>
      )}

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 w-full z-10">
        
        {/* MOBILE LAYOUT */}
        <div className="md:hidden flex flex-col gap-4 py-4 border-b dark:border-white/10 border-slate-200">
          <div className="flex justify-between items-center w-full">
            <div className="text-2xl font-black italic">
              <span className="text-white">Euro</span><span className="text-[#EAB308]">Track.</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent transition-all">
                {lang === 'de' ? <FlagUK size={24} /> : <FlagDE size={24} />}
              </button>
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent transition-all">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 border-t dark:border-white/10 border-slate-200 pt-4">
            <button onClick={onLogin} className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">{t.login}</button>
            <button onClick={onRegister} className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg hover:bg-blue-700 transition-all whitespace-nowrap">
              {t.signup}
            </button>
          </div>
        </div>

        {/* DESKTOP LAYOUT */}
        <div className="hidden md:flex justify-between items-center w-full py-6">
          <div className="text-2xl font-black italic">
            <span className="text-white">Euro</span><span className="text-[#EAB308]">Track.</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
              {lang === 'de' ? <FlagUK size={24} /> : <FlagDE size={24} />}
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={onLogin} className="text-sm font-bold px-4 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">{t.login}</button>
            <button onClick={onRegister} className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg hover:bg-blue-700 transition-all whitespace-nowrap">
              {t.signup}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      {/* Reduced pt-12 to pt-8, giving it a better connection to the header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-12 sm:pb-20 text-center flex-grow-0 flex flex-col items-center z-10 relative">
        <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-500 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-6 inline-block shadow-sm">
          {t.tag}
        </span>
        
        {/* FIX: Changed leading-[0.9] to leading-[1.1] so the 'g' is never cut off */}
        <h1 className={cn('text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tighter leading-[1.1] pb-2 bg-clip-text text-transparent',
          isDarkMode ? 'bg-gradient-to-br from-white via-white/90 to-blue-300/40' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700')}>
          {t.title}
        </h1>
        
        <p className={cn('text-base sm:text-lg md:text-xl mb-10 max-w-2xl mx-auto px-2 leading-relaxed',
          isDarkMode ? 'text-slate-400' : 'text-slate-600')}>
          {t.desc}
        </p>
        
        {/* FIX: Sleeker, better proportioned button */}
        <button onClick={onRegister}
          className="px-8 py-4 bg-blue-600 text-white text-sm sm:text-base font-black rounded-2xl shadow-xl hover:scale-105 hover:bg-blue-500 transition-all flex items-center gap-3 mx-auto whitespace-nowrap">
          {t.getStarted} <ChevronRight size={18} strokeWidth={3} />
        </button>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pb-16 sm:pb-20 w-full z-10">
        {t.features.map((f, i) => (
          <div key={i} className={cn('p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border transition-all hover:border-blue-500/30 hover:-translate-y-1 shadow-sm flex flex-col',
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}>
            {/* NEW: Added a soft background behind the icons for a premium SaaS look */}
            <div className="mb-4 sm:mb-6 text-blue-500 bg-blue-500/10 w-max p-3 rounded-xl">
              {f.icon}
            </div>
            <h3 className="font-black text-sm sm:text-base mb-1.5 sm:mb-2">{f.title}</h3>
            <p className="text-[11px] sm:text-xs opacity-60 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="w-full py-8 flex justify-center z-10 mt-auto">
        <button
          onClick={onAdminLogin}
          className={cn(
            'flex items-center gap-1.5 text-[10px] sm:text-xs font-medium opacity-30 hover:opacity-100 transition-opacity',
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          <Settings size={12} />
          {t.adminLink}
        </button>
      </footer>
    </div>
  );
}
