// src/App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { getMyAccessLevel, AccessLevel } from './lib/supabase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';
import UserManagement from './components/UserManagement';
import { cn } from './lib/utils';
import { LogOut, Clock, LayoutDashboard, Users } from 'lucide-react';

type View     = 'landing' | 'login' | 'signup' | 'dashboard';
type AdminTab = 'dashboard' | 'users';
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
  const [adminTab,      setAdminTab]     = useState<AdminTab>('dashboard');
  const [loading,       setLoading]      = useState(true);
  const [accessLevel,   setAccessLevel]  = useState<AccessLevel | null>(null);
  const [theme,         setTheme]        = useState<Theme>('dark');
  const [lang,          setLang]         = useState<Language>('en');
  const [offlineBanner, setOfflineBanner] = useState(!navigator.onLine);

  const dk = theme === 'dark';

  // Resolve access level — never triggers a loading flash mid-session
  const resolveAccess = useCallback(async () => {
    try {
      const access = await getMyAccessLevel();
      setAccessLevel(access);
      setView('dashboard');
    } catch {
      // network blip — keep current session, do not blank the screen
    }
  }, []);

  useEffect(() => {
    // One-time initial auth check on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveAccess();
      } else {
        setView('landing');
      }
      setLoading(false);
    });

    // Only react to genuine login / logout events.
    // TOKEN_REFRESHED is intentionally excluded — it fires silently every ~55 min
    // and used to cause the entire dashboard to blank + reload. Supabase keeps the
    // session alive automatically; we do not need to re-fetch access on each refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) await resolveAccess();
      } else if (event === 'SIGNED_OUT') {
        setAccessLevel(null);
        setView('landing');
      }
      // INITIAL_SESSION — already handled by getSession() above, ignore.
      // TOKEN_REFRESHED — intentionally ignored (no screen blank).
    });

    const handleOnline  = () => setOfflineBanner(false);
    const handleOffline = () => setOfflineBanner(true);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [resolveAccess]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAccessLevel(null);
    setView('landing');
  }

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-black italic mb-4">Euro<span className="text-yellow-400">Track.</span></div>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    </div>
  );

  if (view === 'landing') return (
    <Landing
      onLogin={()    => setView('login')}
      onRegister={() => setView('signup')}
      lang={lang} setLang={setLang}
      isDarkMode={dk} toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
    />
  );

  if (view === 'login' || view === 'signup') return (
    <Auth
      initialMode={view === 'signup' ? 'signup' : 'login'}
      onBack={() => setView('landing')}
      lang={lang} theme={theme}
    />
  );

  // Pending approval
  if (accessLevel?.role === 'pending') return (
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
        <p className={cn('text-sm mb-8 leading-relaxed', dk ? 'text-slate-400' : 'text-slate-500')}>
          {lang === 'de'
            ? 'Ihr Konto wurde erstellt, wartet aber noch auf die Freigabe.'
            : 'Your account has been created but is waiting for approval.'}
        </p>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition-all">
          <LogOut size={16} />
          {lang === 'de' ? 'Abmelden' : 'Sign Out'}
        </button>
      </div>
    </div>
  );

  const isViewOnly = accessLevel?.role === 'viewer';

  // Superadmin: tab layout with Dashboard + User Management
  if (accessLevel?.role === 'superadmin') return (
    <div className={cn('flex flex-col h-screen overflow-hidden',
      dk ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900')}>
      {/* Offline banner */}
      {offlineBanner && (
        <div className="bg-amber-500 text-black text-xs font-bold text-center py-1.5 px-4 shrink-0">📡 Offline</div>
      )}
      {/* Admin tab bar */}
      <div className={cn('shrink-0 flex items-center gap-1 px-4 py-2 border-b',
        dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <button
          onClick={() => setAdminTab('dashboard')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
            adminTab === 'dashboard'
              ? 'bg-blue-600 text-white'
              : dk ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100')}>
          <LayoutDashboard size={14} />
          Dashboard
        </button>
        <button
          onClick={() => setAdminTab('users')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
            adminTab === 'users'
              ? 'bg-yellow-500 text-black'
              : dk ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100')}>
          <Users size={14} />
          {lang === 'de' ? 'Benutzerverwaltung' : 'User Management'}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary>
          {adminTab === 'users' ? (
            <UserManagement
              theme={theme} lang={lang}
              toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
              setLang={setLang}
              onSignOut={handleSignOut}
            />
          ) : (
            <Dashboard
              theme={theme} lang={lang}
              toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
              setLang={setLang}
              offlineMode={offlineBanner}
              viewOnly={false}
              accessLevel={accessLevel}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );

  // Admin / Editor / Viewer
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
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
