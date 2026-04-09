// src/components/Auth.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, Lock, UserPlus, LogIn, AtSign } from 'lucide-react';
import { cn } from '../lib/utils';

interface AuthProps {
  onBack: () => void;
  lang: 'de' | 'en';
  theme: 'dark' | 'light';
}

function isEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

export default function Auth({ onBack, lang, theme }: AuthProps) {
  const [isLogin, setIsLogin]   = useState(true);
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess]   = useState('');

  // Login fields
  const [loginId, setLoginId]     = useState('');  // username OR email
  const [loginPass, setLoginPass] = useState('');

  // Signup fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail]       = useState('');
  const [regPass, setRegPass]         = useState('');

  const isDark = theme === 'dark';

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErrorMsg(''); setSuccess('');
    try {
      let emailToUse = loginId.trim();

      // If the user typed a username (not an email), look up their email first
      if (!isEmail(emailToUse)) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', emailToUse)
          .maybeSingle();
        if (profileErr) throw new Error(lang === 'de' ? 'Benutzername nicht gefunden.' : 'Username not found.');
        if (!profile?.email) throw new Error(lang === 'de' ? 'Benutzername nicht gefunden.' : 'Username not found.');
        emailToUse = profile.email;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password: loginPass });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── SIGNUP ───────────────────────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErrorMsg(''); setSuccess('');
    try {
      const username = regUsername.trim();
      const email    = regEmail.trim();
      const password = regPass;

      if (!username) throw new Error(lang === 'de' ? 'Benutzername erforderlich.' : 'Username is required.');
      if (username.length < 3) throw new Error(lang === 'de' ? 'Benutzername muss mindestens 3 Zeichen haben.' : 'Username must be at least 3 characters.');
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) throw new Error(lang === 'de' ? 'Benutzername darf nur Buchstaben, Zahlen, _ . - enthalten.' : 'Username may only contain letters, numbers, _ . -');
      if (!email || !isEmail(email)) throw new Error(lang === 'de' ? 'Gültige E-Mail erforderlich.' : 'A valid email is required.');
      if (password.length < 6) throw new Error(lang === 'de' ? 'Passwort muss mindestens 6 Zeichen haben.' : 'Password must be at least 6 characters.');

      // Check username not already taken
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (existing) throw new Error(lang === 'de' ? 'Dieser Benutzername ist bereits vergeben.' : 'This username is already taken.');

      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, full_name: username } },
      });
      if (error) throw error;
      if (!data.user) throw new Error(lang === 'de' ? 'Registrierung fehlgeschlagen.' : 'Signup failed.');

      // Upsert profile — wrapped in try/catch so a RLS hiccup doesn't kill the whole flow
      try {
        await supabase.from('profiles').upsert(
          { id: data.user.id, email, username, full_name: username, role: 'admin' },
          { onConflict: 'id' }
        );
      } catch (profileErr) {
        // Profile will be created by trigger if it exists; not fatal
        console.warn('Profile upsert skipped:', profileErr);
      }

      // Supabase may require email confirmation depending on project settings
      if (data.session) {
        // Already logged in — auth state change will redirect to dashboard
      } else {
        setSuccess(lang === 'de'
          ? 'Konto erstellt! Bitte bestätigen Sie Ihre E-Mail und melden Sie sich dann an.'
          : 'Account created! Please confirm your email then log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = cn(
    'w-full p-4 pl-12 rounded-xl outline-none border transition-all',
    isDark
      ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
      : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  );

  return (
    <div className={cn('min-h-screen w-full flex flex-col items-center justify-center p-6', isDark ? 'bg-[#020617]' : 'bg-slate-100')}>
      <button onClick={onBack} className="mb-10 flex items-center gap-2 text-2xl font-black italic text-[#EAB308] hover:scale-105 transition-all">
        <span className={isDark ? 'text-white' : 'text-slate-900'}>Euro</span>Track.
      </button>

      <div className={cn('w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl border',
        isDark ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>

        <h2 className="text-3xl font-black mb-2">
          {isLogin
            ? (lang === 'de' ? 'Willkommen zurück' : 'Welcome Back')
            : (lang === 'de' ? 'Konto erstellen'   : 'Create Account')}
        </h2>
        <p className="text-sm opacity-50 mb-8">
          {isLogin
            ? (lang === 'de' ? 'Benutzername oder E-Mail eingeben' : 'Enter your username or email')
            : (lang === 'de' ? 'Wählen Sie einen Benutzernamen'   : 'Choose a username to get started')}
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm font-bold">{errorMsg}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-600/10 border border-green-500/20 rounded-xl">
            <p className="text-green-400 text-sm font-bold">{success}</p>
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        {isLogin && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <AtSign className="absolute left-4 top-4 opacity-30" size={20} />
              <input
                type="text"
                placeholder={lang === 'de' ? 'Benutzername oder E-Mail' : 'Username or Email'}
                required
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                autoComplete="username"
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-4 opacity-30" size={20} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder={lang === 'de' ? 'Passwort' : 'Password'}
                required
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                autoComplete="current-password"
                className={cn(inputClass, 'pr-12')}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-4 opacity-50 hover:opacity-100">
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              {lang === 'de' ? 'Anmelden' : 'Log In'}
            </button>
          </form>
        )}

        {/* ── SIGNUP FORM ── */}
        {!isLogin && (
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <AtSign className="absolute left-4 top-4 opacity-30" size={20} />
              <input
                type="text"
                placeholder={lang === 'de' ? 'Benutzername' : 'Username'}
                required
                value={regUsername}
                onChange={e => setRegUsername(e.target.value)}
                autoComplete="username"
                className={inputClass}
              />
            </div>
            <p className={cn('text-[11px] -mt-2 px-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Nur Buchstaben, Zahlen, _ . — wird zum Anmelden verwendet' : 'Letters, numbers, _ . only — used to log in'}
            </p>
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-4 opacity-30" size={20} />
              <input
                type="email"
                placeholder="Email"
                required
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                autoComplete="email"
                className={inputClass}
              />
            </div>
            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-4 opacity-30" size={20} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder={lang === 'de' ? 'Passwort (min. 6 Zeichen)' : 'Password (min. 6 chars)'}
                required
                value={regPass}
                onChange={e => setRegPass(e.target.value)}
                autoComplete="new-password"
                className={cn(inputClass, 'pr-12')}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-4 opacity-50 hover:opacity-100">
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
              {lang === 'de' ? 'Registrieren' : 'Sign Up'}
            </button>
          </form>
        )}

        <div className={cn('mt-8 pt-8 border-t text-center text-sm', isDark ? 'border-white/10' : 'border-slate-200')}>
          <span className="opacity-50">
            {isLogin
              ? (lang === 'de' ? 'Neu hier?' : 'New here?')
              : (lang === 'de' ? 'Haben Sie ein Konto?' : 'Already have an account?')}
          </span>
          <button onClick={() => { setIsLogin(v => !v); setErrorMsg(''); setSuccess(''); }} className="ml-2 font-black text-blue-500 hover:underline">
            {isLogin
              ? (lang === 'de' ? 'Konto erstellen' : 'Create Account')
              : (lang === 'de' ? 'Anmelden' : 'Log In')}
          </button>
        </div>
      </div>

      <button onClick={onBack} className="mt-8 flex items-center gap-2 text-xs font-bold opacity-50 hover:opacity-100 transition-all">
        <ArrowLeft size={14} /> {lang === 'de' ? 'Zurück zur Startseite' : 'Back to Landing'}
      </button>
    </div>
  );
}
