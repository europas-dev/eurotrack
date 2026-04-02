import React from 'react';

export default function Landing({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen w-full bg-[#020617] flex flex-col items-center justify-center p-10 text-center">
      <div className="text-6xl font-black italic text-white mb-6">
        Euro<span className="text-[#EAB308]">Track.</span>
      </div>
      <p className="text-slate-400 max-w-xl mb-10 text-lg">Professional Asset & Bed Management for Europas GmbH.</p>
      <button onClick={onLogin} className="px-12 py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all uppercase tracking-widest">
        Open Dashboard
      </button>
    </div>
  );
}
