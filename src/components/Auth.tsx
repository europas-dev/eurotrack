import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowRight } from 'lucide-react';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) onAuthSuccess();
    else alert(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] p-4">
      <div className="w-full max-w-md bg-[#0F172A] border border-white/10 p-10 rounded-[2.5rem] shadow-2xl">
        <div className="text-3xl font-black italic text-white mb-10 text-center">
          Euro<span className="text-[#EAB308]">Track.</span>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500" />
          <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700">
            {loading ? <Loader2 className="animate-spin" /> : 'Login'} <ArrowRight size={20}/>
          </button>
        </form>
      </div>
    </div>
  );
}
