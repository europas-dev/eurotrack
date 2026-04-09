// src/App.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { offlineSync } from './lib/offlineSync';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';
import { cn } from './lib/utils';

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

export default function App() {
  const [view, setView]                   = useState<View>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [theme, setTheme]                 = useState<Theme>('dark');
  const [lang, setLang]                   = useState<Language>('en');
  const [offlineBanner, setOfflineBanner] = useState(!navigator.onLine);
  const [offlineMode, setOfflineMode]     = useState(false); // manual offline toggle
  const [syncMsg, setSyncMsg]             = useState('');

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
    const handleOnline  = () => { setOfflineBanner(false); };
    const handleOffline = () => { setOfflineBanner(true); };
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      subscription.unsubscribe();
      unsub();
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function checkAuth() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setView(user ? 'dashboard' : 'landing');
    } catch { }
    finally { setLoading(false); }
  }

  function toggleTheme() {
    setTheme(p => p === 'dark' ? 'light' : 'dark');
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
      toggleTheme={toggleTheme} />
  );

  if (view === 'auth') return (
    <Auth onBack={() => setView('landing')} lang={lang} theme={theme} />
  );

  const isOffline = offlineMode || offlineBanner;

  return (
    <div className={cn('flex flex-col h-screen overflow-hidden', dk ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900')}>

      {/* ── OFFLINE / SYNC BANNERS ─────────────────────────────────── */}
      {isOffline && (
        <div className="bg-amber-500 text-black text-xs font-bold text-center py-1.5 px-4 shrink-0 flex items-center justify-center gap-3">
          <span>📡 {lang === 'de' ? 'Offline — Änderungen werden lokal gespeichert' : 'Offline — changes saved locally'}</span>
          {offlineMode && (
            <button
              onClick={() => setOfflineMode(false)}
              className="underline text-black/70 hover:text-black"
            >
              {lang === 'de' ? 'Wieder verbinden' : 'Go online'}
            </button>
          )}
        </div>
      )}
      {syncMsg && (
        <div className={cn('text-white text-xs font-bold text-center py-1.5 px-4 shrink-0',
          syncMsg.startsWith('⚠') ? 'bg-amber-600' : 'bg-green-600')}>
          {syncMsg}
        </div>
      )}

      {/* ── MAIN CONTENT: Dashboard handles its own Sidebar + Header ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary>
          <Dashboard
            theme={theme}
            lang={lang}
            toggleTheme={toggleTheme}
            setLang={setLang}
            offlineMode={isOffline}
            onToggleOfflineMode={() => setOfflineMode(v => !v)}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
