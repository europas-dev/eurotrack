// src/App.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getMyAccessLevel, AccessLevel } from './lib/supabase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';
import UserManagement from './components/UserManagement';
import SuperAdminHome from './components/SuperAdminHome';
import { cn } from './lib/utils';
import { LogOut, Clock, RefreshCw } from 'lucide-react';

type View = 'landing' | 'login' | 'signup' | 'admin-login' | 'dashboard' | 'superadmin-home' | 'user-management' | 'pending';
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
  const [view,          setView]         = useState<View>('landing');
  const [loading,       setLoading]      = useState(true);
  const [accessLevel,   setAccessLevel]  = useState<AccessLevel | null>(null);
  const [theme,         setTheme]        = useState<Theme>('dark');
  const [lang,          setLang]         = useState<Language>('en');
  const [offlineBanner, setOfflineBanner] = useState(!navigator.onLine);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track whether superadmin is navigating back to home (not signing out)
  const superadminBackRef = useRef(false);

  const dk = theme === 'dark';

  const resolveAccess = useCallback(async () => {
    try {
      const access = await getMyAccessLevel();
      setAccessLevel(access);
      if (access.role === 'superadmin') {
        setView('superadmin-home');
      } else if (access.role === 'pending') {
        setView('pending');
      } else {
        setView('dashboard');
      }
      return access.role;
    } catch {
      return null;
    }
  }, []);

  const startPendingPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const role = await resolveAccess();
      if (role && role !== 'pending') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 8000);
  }, [resolveAccess]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveAccess();
      } else {
        setView('landing');
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) await resolveAccess();
      } else if (event === 'SIGNED_OUT') {
        // If superadmin is navigating back to home (not actually signing out), ignore this event
        if (superadminBackRef.current) {
          superadminBackRef.current = false;
          return;
        }
        stopPoll();
        setAccessLevel(null);
        setView('landing');
      }
    });

    const handleOnline  = () => setOfflineBanner(false);
    const handleOffline = () => setOfflineBanner(true);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      subscription.unsubscribe();
      stopPoll();
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [resolveAccess, stopPoll]);

  useEffect(() => {
    if (view === 'pending') {
      startPendingPoll();
    } else {
      stopPoll();
    }
  }, [view, startPendingPoll, stopPoll]);

  // Full sign out — goes to landing
  async function handleSignOut() {
    stopPoll();
    await supabase.auth.signOut();
    setAccessLevel(null);
    setView('landing');
  }

  // Superadmin leaving dashboard/user-management — goes back to two-card home, stays logged in
  function handleSuperadminBack() {
    setView('superadmin-home');
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-black italic mb-4">Euro<span className="text-yellow-400">Track.</span></div>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    </div>
  );

  // ── Landing ──────────────────────────────────────────────────────────────────
  if (view === 'landing') return (
    <Landing
      onLogin={()       => setView('login')}
      onRegister={()    => setView('signup')}
      onAdminLogin={()  => setView('admin-login')}
      lang={lang} setLang={setLang}
      isDarkMode={dk} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
    />
  );

  // ── Auth ─────────────────────────────────────────────────────────────────────
  if (view === 'login' || view === 'signup' || view === 'admin-login') return (
    <Auth
      initialMode='login'
      onBack={() => setView('landing')}
      lang={lang} theme={theme}
    />
  );

  // ── Pending ──────────────────────────────────────────────────────────────────
  if (view === 'pending' || accessLevel?.role === 'pending') return (
    <div className={cn('min-h-screen flex flex-col items-center justify-center p-8',
      dk ? 'bg-[#020617] text-white' : 'bg-slate-100 text-slate-900')}>
      <div className={cn('w-full max-w-md p-10 rounded-[2.5rem] border shadow-2xl text-center',
        dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="text-amber-400" size={32} />
        </div>
        <h2 className="text-2xl font-black mb-3">
          {lang === 'de' ? 'Zugang ausstehend' : 'Access Pending'}
        </h2>
        <p className={cn('text-sm mb-6 leading-relaxed', dk ? 'text-slate-400' : 'text-slate-500')}>
          {lang === 'de'
            ? 'Ihr Konto wurde erstellt, wartet aber noch auf die Freigabe durch einen Administrator.'
            : 'Your account has been created but is awaiting approval by an administrator.'}
        </p>
        <div className={cn('flex items-center justify-center gap-2 text-xs mb-8', dk ? 'text-slate-500' : 'text-slate-400')}>
          <RefreshCw size={12} className="animate-spin" />
          {lang === 'de' ? 'Wird automatisch geprüft…' : 'Checking automatically…'}
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => resolveAccess()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all">
            <RefreshCw size={14} />
            {lang === 'de' ? 'Jetzt prüfen' : 'Check Now'}
          </button>
          <button onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all">
            <LogOut size={14} />
            {lang === 'de' ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Superadmin home ────────────────────────────────────────────────────────
  if (view === 'superadmin-home' && accessLevel?.role === 'superadmin') return (
    <SuperAdminHome
      onDashboard={()      => setView('dashboard')}
      onUserManagement={() => setView('user-management')}
      onSignOut={handleSignOut}
      lang={lang}
      theme={theme}
    />
  );

  // ── User Management ───────────────────────────────────────────────────────
  if (view === 'user-management' && accessLevel?.role === 'superadmin') return (
    <div className={cn('flex flex-col h-screen overflow-hidden',
      dk ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900')}>
      <ErrorBoundary>
        <UserManagement
          theme={theme} lang={lang}
          toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
          setLang={setLang}
          onSignOut={handleSignOut}
          onBack={handleSuperadminBack}
        />
      </ErrorBoundary>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────────
  const isViewOnly = accessLevel?.role === 'viewer';

  return (
    <div className={cn('flex flex-col h-screen overflow-hidden',
      dk ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900')}>
      {isViewOnly && (
        <div className="bg-blue-600 text-white text-xs font-bold text-center py-1.5 px-4 shrink-0">
          👁 {lang === 'de' ? 'Nur-Lesen-Modus' : 'View-only mode'}
        </div>
      )}
      {offlineBanner && (
        <div className="bg-amber-500 text-black text-xs font-bold text-center py-1.5 px-4 shrink-0">
          📡 {lang === 'de' ? 'Offline' : 'Offline'}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary>
          <Dashboard
            theme={theme} lang={lang}
            toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
            setLang={setLang}
            offlineMode={offlineBanner}
            viewOnly={isViewOnly}
            accessLevel={accessLevel}
            onSignOut={
              // Superadmin clicking sign out from dashboard goes back to two-card home
              accessLevel?.role === 'superadmin'
                ? handleSuperadminBack
                : handleSignOut
            }
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
