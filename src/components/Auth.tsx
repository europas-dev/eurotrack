// src/components/Auth.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, Lock, UserPlus, LogIn, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface AuthProps {
  onBack: () => void;
  lang: 'de' | 'en';
  theme: 'dark' | 'light';
}

export default function Auth({ onBack, lang, theme }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isDark = theme === 'dark';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!fullName.trim()) throw new Error(lang === 'de' ? 'Bitte geben Sie Ihren Namen ein.' : 'Please enter your full name.');
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            role: 'admin'
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    "w-full p-4 pl-12 rounded-xl outline-none border transition-all",
    isDark
      ? "bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500"
      : "bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400"
  );

  return (
    <div className={cn("min-h-screen w-full flex flex-col items-center justify-center p-6", isDark ? "bg-[#020617]" : "bg-slate-100")}>
      <button onClick={onBack} className="mb-10 flex items-center gap-2 text-2xl font-black italic text-[#EAB308] hover:scale-105 transition-all">
        <span className={isDark ? "text-white" : "text-slate-900"}>Euro</span>Track.
      </button>

      <div className={cn("w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl border",
        isDark ? "bg-[#0F172A] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>

        <h2 className="text-3xl font-black mb-2">
          {isLogin ? (lang === 'de' ? 'Willkommen zurück' : 'Welcome Back') : (lang === 'de' ? 'Konto erstellen' : 'Create Account')}
        </h2>
        <p className="text-sm opacity-50 mb-8">
          {isLogin ? (lang === 'de' ? 'Geben Sie Ihre Daten ein' : 'Enter your credentials') : (lang === 'de' ? 'Starten Sie jetzt' : 'Get started now')}
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm font-bold">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-4 opacity-30" size={20} />
              <input type="text" placeholder={lang === 'de' ? 'Vollständiger Name' : 'Full Name'}
                required value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-4 opacity-30" size={20} />
            <input type="email" placeholder="Email" required value={email}
              onChange={e => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-4 opacity-30" size={20} />
            <input type={showPass ? "text" : "password"} placeholder="Password" required
              value={password} onChange={e => setPassword(e.target.value)} className={cn(inputClass, "pr-12")} />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-4 opacity-50 hover:opacity-100">
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-4 bg-blue-600 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
            {isLogin ? (lang === 'de' ? 'Anmelden' : 'Log In') : (lang === 'de' ? 'Registrieren' : 'Sign Up')}
          </button>
        </form>

        <div className={cn("mt-8 pt-8 border-t text-center text-sm", isDark ? "border-white/10" : "border-slate-200")}>
          <span className="opacity-50">
            {isLogin ? (lang === 'de' ? 'Neu hier?' : 'New here?') : (lang === 'de' ? 'Haben Sie ein Konto?' : 'Already have an account?')}
          </span>
          <button onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }} className="ml-2 font-black text-blue-500 hover:underline">
            {isLogin ? (lang === 'de' ? 'Konto erstellen' : 'Create Account') : (lang === 'de' ? 'Anmelden' : 'Log In')}
          </button>
        </div>
      </div>

      <button onClick={onBack} className="mt-8 flex items-center gap-2 text-xs font-bold opacity-50 hover:opacity-100 transition-all">
        <ArrowLeft size={14} /> {lang === 'de' ? 'Zurück zur Startseite' : 'Back to Landing'}
      </button>
    </div>
  );
}
