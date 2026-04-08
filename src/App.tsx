// src/App.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { offlineSync } from './lib/offlineSync';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';

type View = 'landing' | 'auth' | 'dashboard';
type Theme = 'dark' | 'light';
type Language = 'de' | 'en';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string}> {
  state = { error: '' };
  componentDidCatch(e: Error) { this.setState({ error: e.message }); }
  render() {
    if (this.state.error) return (
      <div style={{color:'red',padding:20,fontFamily:'monospace',whiteSpace:'pre-wrap'}}>
        CRASH: {this.state.error}
      </div>
    );
    return this.props.children;
  }
}

import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { offlineSync } from './lib/offlineSync';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';

// ← ADD THIS BLOCK HERE
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string}> {
  state = { error: '' };
  componentDidCatch(e: Error) { this.setState({ error: e.message }); }
  render() {
    if (this.state.error) return (
      <div style={{color:'red',padding:20,fontFamily:'monospace',whiteSpace:'pre-wrap'}}>
        CRASH: {this.state.error}
      </div>
    );
    return this.props.children;
  }
}

export default function App() {

export default function App() {
  const [view, setView]                       = useState<View>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [theme, setTheme]                     = useState<Theme>('dark');
  const [lang, setLang]                       = useState<Language>('en');
  const [offlineBanner, setOfflineBanner]     = useState(!navigator.onLine);
  const [syncMsg, setSyncMsg]                 = useState('');

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setView(session ? 'dashboard' : 'landing');
    });

    // Subscribe to offlineSync status updates
    const unsub = offlineSync.subscribe((status) => {
      if (status === 'offline') {
        setOfflineBanner(true);
        setSyncMsg('');
      } else if (status === 'saving') {
        setOfflineBanner(false);
        setSyncMsg('Syncing offline changes...');
      } else if (status === 'saved') {
        setOfflineBanner(false);
        setSyncMsg(prev => prev === 'Syncing offline changes...' ? '✓ Changes synced' : '');
        setTimeout(() => setSyncMsg(''), 4000);
      } else if (status === 'failed') {
        setSyncMsg('⚠ Some changes failed to sync');
        setTimeout(() => setSyncMsg(''), 4000);
      } else if (status === 'pending') {
        setOfflineBanner(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      unsub();
    };
  }, []);

  async function checkAuth() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setView(user ? 'dashboard' : 'landing');
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-black italic mb-4">
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Offline banner */}
      {offlineBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black text-xs font-bold text-center py-1.5 px-4">
          📡 {lang === 'de'
            ? 'Offline — Änderungen werden lokal gespeichert und synchronisiert sobald online'
            : 'Offline — changes are saved locally and will sync when back online'}
        </div>
      )}

      {/* Sync message */}
      {syncMsg && (
        <div className={`fixed top-0 left-0 right-0 z-[100] text-white text-xs font-bold text-center py-1.5 px-4 ${
          syncMsg.startsWith('⚠') ? 'bg-amber-600' : 'bg-green-600'
        }`}>
          {syncMsg}
        </div>
      )}

      {view === 'landing' && (
        <Landing onLogin={() => setView('auth')} onRegister={() => setView('auth')}
          lang={lang} setLang={setLang} isDarkMode={theme === 'dark'}
          toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} />
      )}
      {view === 'auth' && (
        <Auth onBack={() => setView('landing')} lang={lang} theme={theme} />
      )}
      {view === 'dashboard' && (
        <Dashboard theme={theme} lang={lang}
          toggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
          setLang={setLang} />
      )}
    </>
  );
}
