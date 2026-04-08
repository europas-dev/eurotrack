// src/App.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { offlineSync } from './lib/offlineSync';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';
import { cn } from './lib/utils';
import {
  LogOut, Sun, Moon, Globe, ChevronLeft, ChevronRight,
  BarChart2, Settings,
} from 'lucide-react';

type View     = 'landing' | 'auth' | 'dashboard';
type Theme    = 'dark' | 'light';
type Language = 'de' | 'en';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  componentDidCatch(e: Error) { this.setState({ error: e.message }); }
  render() {
    if (this.state.error) return (
      <div style={{ color: 'red', padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        CRASH: {this.state.error}
      </div>
    );
    return this.props.children;
  }
}

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function App() {
  const [view, setView]                   = useState<View>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [theme, setTheme]                 = useState<Theme>('dark');
  const [lang, setLang]                   = useState<Language>('en');
  const [offlineBanner, setOfflineBanner] = useState(!navigator.onLine);
  const [syncMsg, setSyncMsg]             = useState('');
  const [sidebarOpen, setSidebarOpen]     = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());

  const dk = theme === 'dark';

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setView(session ? 'dashboard' : 'landing');
    });
    const unsub = offlineSync.subscribe((status) => {
      if (status === 'offline') { setOfflineBanner(true); setSyncMsg(''); }
      else if (status === 'saving') { setOfflineBanner(false); setSyncMsg('Syncing...'); }
      else if (status === 'saved')  { setOfflineBanner(false); setSyncMsg(''); }
      else if (status === 'failed') { setSyncMsg('⚠ Sync failed'); setTimeout(() => setSyncMsg(''), 4000); }
    });
    return () => { subscription.unsubscribe(); unsub(); };
  }, []);

  async function checkAuth() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setView(user ? 'dashboard' : 'landing');
    } catch { }
    finally { setLoading(false); }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setView('landing');
  }

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-black italic mb-4">
          Euro<span className="text-yellow-400">Track.</span>
        </div>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    </div>
  );

  if (view === 'landing') return (
    <Landing onLogin={() => setView('auth')} onRegister={() => setView('auth')}
      lang={lang} setLang={setLang} isDarkMode={dk}
      toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} />
  );

  if (view === 'auth') return (
    <Auth onBack={() => setView('landing')} lang={lang} theme={theme} />
  );

  const months = lang === 'de' ? MONTHS_DE : MONTHS_EN;

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900')}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className={cn(
        'flex flex-col shrink-0 border-r transition-all duration-200',
        dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200',
        sidebarOpen ? 'w-56' : 'w-14'
      )}>
        {/* Logo */}
        <div className={cn('flex items-center gap-2 px-3 py-4 border-b', dk ? 'border-white/10' : 'border-slate-200')}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <BarChart2 size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <span className="text-sm font-black italic">
              Euro<span className="text-yellow-400">Track.</span>
            </span>
          )}
        </div>

        {/* Month navigator */}
        {sidebarOpen && (
          <div className="px-3 py-4 border-b border-white/10 space-y-2">
            <p className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Monat' : 'Month'}
            </p>
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className={cn('p-1 rounded', dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-center">
                {months[selectedMonth - 1]}<br />
                <span className={cn('font-normal text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>{selectedYear}</span>
              </span>
              <button onClick={nextMonth} className={cn('p-1 rounded', dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Bottom controls */}
        <div className={cn('border-t p-2 space-y-1', dk ? 'border-white/10' : 'border-slate-200')}>

          {/* Language */}
          <button onClick={() => setLang(l => l === 'de' ? 'en' : 'de')}
            className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold transition-all',
              dk ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100')}>
            <Globe size={15} className="shrink-0" />
            {sidebarOpen && <span>{lang === 'de' ? 'Deutsch → English' : 'English → Deutsch'}</span>}
          </button>

          {/* Theme */}
          <button onClick={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
            className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold transition-all',
              dk ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100')}>
            {dk ? <Sun size={15} className="shrink-0" /> : <Moon size={15} className="shrink-0" />}
            {sidebarOpen && <span>{dk ? (lang === 'de' ? 'Hell' : 'Light mode') : (lang === 'de' ? 'Dunkel' : 'Dark mode')}</span>}
          </button>

          {/* Sign out */}
          <button onClick={handleSignOut}
            className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold transition-all',
              dk ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50')}>
            <LogOut size={15} className="shrink-0" />
            {sidebarOpen && <span>{lang === 'de' ? 'Abmelden' : 'Sign out'}</span>}
          </button>

          {/* Collapse toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all',
              dk ? 'text-slate-600 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100')}>
            {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            {sidebarOpen && <span className="text-[10px]">{lang === 'de' ? 'Einklappen' : 'Collapse'}</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {offlineBanner && (
          <div className="bg-amber-500 text-black text-xs font-bold text-center py-1.5 px-4 shrink-0">
            📡 {lang === 'de' ? 'Offline — Änderungen werden lokal gespeichert' : 'Offline — changes saved locally'}
          </div>
        )}
        {syncMsg && (
          <div className={cn('text-white text-xs font-bold text-center py-1.5 px-4 shrink-0',
            syncMsg.startsWith('⚠') ? 'bg-amber-600' : 'bg-green-600')}>
            {syncMsg}
          </div>
        )}
        <ErrorBoundary>
          <Dashboard
            isDarkMode={dk}
            lang={lang}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
