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
        { icon: <LayoutDashboard size={18} />, title: 'Übersicht',    desc: 'Zentralisierte Verwaltung.' },
        { icon: <Bed            size={18} />, title: 'Betten-Logik', desc: 'EZ/DZ/TZ/WG Belegung.' },
        { icon: <BarChart3      size={18} />, title: 'Budget',        desc: 'Echtzeit-Summen.' },
        { icon: <ShieldCheck    size={18} />, title: 'Sicher',        desc: 'Cloud Speicherung.' },
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
        { icon: <LayoutDashboard size={18} />, title: 'Overview',  desc: 'Centralized management.' },
        { icon: <Bed            size={18} />, title: 'Bed Logic', desc: 'SR/DR/TR/WR tracking.' },
        { icon: <BarChart3      size={18} />, title: 'Budget',    desc: 'Real-time totals.' },
        { icon: <ShieldCheck    size={18} />, title: 'Secure',    desc: 'Cloud storage.' },
      ],
    },
  };

  const t = content[lang];

  return (
    <div 
      className={cn('min-h-screen flex flex-col transition-colors duration-500 relative overflow-hidden text-base',
        isDarkMode ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900')}
      style={{ fontFamily: '"Poppins", sans-serif' }}
    >
      {/* NEW: Dynamic Background Mesh Gradient for BOTH Light and Dark mode */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {isDarkMode ? (
          <>
            <div className="absolute top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-blue-900/30 blur-[150px] transition-all duration-1000"/>
            <div className="absolute bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-blue-600/30 blur-[150px] transition-all duration-1000"/>
          </>
        ) : (
          <>
            {/* Soft, modern airy vibe for light mode */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-blue-200/50 blur-[120px] mix-blend-multiply transition-all duration-1000"/>
            <div className="absolute bottom-0 left-[-200px] w-[600px] h-[600px] rounded-full bg-indigo-200/50 blur-[120px] mix-blend-multiply transition-all duration-1000"/>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 w-full z-10 relative">
        
        {/* MOBILE LAYOUT */}
        <div className="md:hidden flex flex-col gap-4 py-4 border-b dark:border-white/10 border-slate-200/50">
          <div className="flex justify-between items-center w-full">
            <div className="text-2xl font-black italic">
              {/* FIXED: Dynamic color for Euro based on theme */}
              <span className={isDarkMode ? "text-white" : "text-slate-900"}>Euro</span><span className="text-[#EAB308]">Track.</span>
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
          <div className="flex items-center justify-center gap-4 border-t dark:border-white/10 border-slate-200/50 pt-4">
            <button onClick={onLogin} className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">{t.login}</button>
            <button onClick={onRegister} className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg hover:bg-blue-700 transition-all whitespace-nowrap">
              {t.signup}
            </button>
          </div>
        </div>

        {/* DESKTOP LAYOUT */}
        <div className="hidden md:flex justify-between items-center w-full py-6">
          <div className="text-2xl font-black italic">
            {/* FIXED: Dynamic color for Euro based on theme */}
            <span className={isDarkMode ? "text-white" : "text-slate-900"}>Euro</span><span className="text-[#EAB308]">Track.</span>
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-12 sm:pb-20 text-center flex-grow-0 flex flex-col items-center z-10 relative">
        <span className={cn("px-4 py-1.5 border rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest mb-6 inline-block shadow-sm",
          isDarkMode ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-blue-100 border-blue-200 text-blue-600")}>
          {t.tag}
        </span>
        
        {/* FIXED: Removed the super-tight line-height and added py-2 so the 'g' cannot physically be clipped by bg-clip-text */}
        <h1 className={cn('text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tight leading-tight pt-2 pb-6 bg-clip-text text-transparent',
          isDarkMode ? 'bg-gradient-to-br from-white via-white/90 to-blue-300/40' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-500')}>
          {t.title}
        </h1>
        
        <p className={cn('text-base sm:text-lg md:text-xl mb-10 max-w-2xl mx-auto px-2 leading-relaxed',
          isDarkMode ? 'text-slate-400' : 'text-slate-600')}>
          {t.desc}
        </p>
        
        <button onClick={onRegister}
          className="px-8 py-4 bg-blue-600 text-white text-sm sm:text-base font-black rounded-2xl shadow-lg hover:scale-105 hover:bg-blue-500 transition-all flex items-center gap-3 mx-auto whitespace-nowrap">
          {t.getStarted} <ChevronRight size={18} strokeWidth={3} />
        </button>
      </div>

      {/* Features */}
      {/* We keep grid-cols-2 for mobile to save space, but changed the internal layout! */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 pb-16 sm:pb-20 w-full z-10 relative">
        {t.features.map((f, i) => (
          <div key={i} className={cn('p-4 sm:p-6 rounded-[1.2rem] sm:rounded-[1.5rem] border transition-all hover:border-blue-500/30 hover:-translate-y-1 shadow-sm flex flex-col justify-center',
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/80 backdrop-blur-xl border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/5')}>
            
            {/* FIXED: Inline layout! Icon and Title sit side-by-side */}
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="text-blue-500 bg-blue-500/10 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0">
                {f.icon}
              </div>
              <h3 className="font-black text-xs sm:text-base leading-tight text-balance">{f.title}</h3>
            </div>
            
            <p className={cn("text-[10px] sm:text-xs leading-relaxed mt-1", isDarkMode ? "text-slate-400" : "text-slate-600")}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="w-full py-8 flex justify-center z-10 mt-auto relative">
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
