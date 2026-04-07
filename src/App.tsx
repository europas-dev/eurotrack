// src/App.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import Dashboard from './Dashboard';

type View = 'landing' | 'auth' | 'dashboard';
type Theme = 'dark' | 'light';
type Language = 'de' | 'en';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>('en');

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
      const { data: { user } } = await supabase.auth.getUser();
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
        <div className="text-center">
          <div className="text-3xl font-black italic mb-4">
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
