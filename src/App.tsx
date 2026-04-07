// src/App.tsx
import React, { useEffect, useState } from 'react';
import { supabase, getCurrentUser } from './lib/supabase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';
import type { Theme, Language } from './lib/types';

type View = 'landing' | 'auth' | 'dashboard';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>('en');

  // Check authentication on mount
  useEffect(() => {
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        setView('dashboard');
      } else {
        setView('landing');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAuth() {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(!!user);
      if (user) {
        setView('dashboard');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-white text-2xl font-bold">
          Euro<span className="text-[#EAB308]">Track.</span>
        </div>
      </div>
    );
  }

  // Landing Page
  if (view === 'landing') {
    return (
      <Landing
        onLogin={() => setView('auth')}
        onRegister={() => setView('auth')}
        lang={lang}
        setLang={setLang}
        isDarkMode={theme === 'dark'}
        toggleTheme={toggleTheme}
      />
    );
  }

  // Auth Page
  if (view === 'auth') {
    return (
      <Auth
        onBack={() => setView('landing')}
        lang={lang}
        theme={theme}
      />
    );
  }

  // Dashboard (authenticated)
  return (
    <Dashboard
      theme={theme}
      lang={lang}
      toggleTheme={toggleTheme}
      setLang={setLang}
    />
  );
}
