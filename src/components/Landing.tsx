import React from 'react';
import { LayoutDashboard, Bed, BarChart3, ShieldCheck, ChevronRight } from 'lucide-react';

interface LandingProps {
  onLogin: () => void;
  lang: 'de' | 'en';
}

export default function Landing({ onLogin, lang }: LandingProps) {
  const content = {
    de: {
      tag: "Asset-Management-Lösung",
      title: "Präzises Bettenmanagement für Profis",
      desc: "Optimieren Sie Ihre Hotelbelegungen, verwalten Sie Firmenbudgets und tracken Sie Mitarbeiter-Substitutionen in Echtzeit.",
      btn: "Dashboard öffnen",
      features: [
        { icon: <LayoutDashboard className="text-blue-500" />, title: "Firmen-Übersicht", desc: "Zentralisierte Verwaltung aller Kunden und Standorte." },
        { icon: <Bed className="text-emerald-500" />, title: "Betten-Logik", desc: "Automatisierte EZ/DZ/TZ Belegung und Freibetten-Check." },
        { icon: <BarChart3 className="text-yellow-500" />, title: "Budget-Tracking", desc: "Echtzeit-Berechnung der Monats- und Jahressummen." },
        { icon: <ShieldCheck className="text-purple-500" />, title: "Sichere Daten", desc: "Verschlüsselte Speicherung via Supabase Cloud." }
      ]
    },
    en: {
      tag: "Asset Management Solution",
      title: "Precision Bed Management for Professionals",
      desc: "Optimize hotel occupancies, manage company budgets, and track employee substitutions in real-time.",
      btn: "Open Dashboard",
      features: [
        { icon: <LayoutDashboard className="text-blue-500" />, title: "Company Overview", desc: "Centralized management of all clients and locations." },
        { icon: <Bed className="text-emerald-500" />, title: "Bed Logic", desc: "Automated SR/DR/TR occupancy and free bed tracking." },
        { icon: <BarChart3 className="text-yellow-500" />, title: "Budget Tracking", desc: "Real-time calculation of monthly and yearly totals." },
        { icon: <ShieldCheck className="text-purple-500" />, title: "Secure Data", desc: "Encrypted storage via Supabase Cloud." }
      ]
    }
  };

  const t = content[lang] || content.de;

  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-hidden relative">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto px-6 pt-20 pb-32 relative z-10">
        {/* Header */}
        <nav className="flex justify-between items-center mb-32">
          <div className="text-2xl font-black italic">
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>
          <button 
            onClick={onLogin}
            className="px-6 py-2 border border-white/10 rounded-full text-sm font-bold hover:bg-white/5 transition-all"
          >
            Log In
          </button>
        </nav>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-32">
          <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-black uppercase tracking-widest mb-6 inline-block">
            {t.tag}
          </span>
          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter leading-tight">
            {t.title}
          </h1>
          <p className="text-slate-400 text-lg md:text-xl mb-12 leading-relaxed">
            {t.desc}
          </p>
          <button 
            onClick={onLogin}
            className="group px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all flex items-center gap-3 mx-auto"
          >
            {t.btn}
            <ChevronRight className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.features.map((f, i) => (
            <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:border-white/20 transition-all group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-lg font-black mb-3">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <footer className="py-10 text-center text-slate-600 text-xs font-bold uppercase tracking-widest">
        © 2026 EuroTrack Asset Management — Europas GmbH
      </footer>
    </div>
  );
}
