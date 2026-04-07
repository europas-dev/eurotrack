// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { getHotels, signOut } from './lib/supabase';
import { cn } from './lib/utils';
import type { Theme, Language } from './lib/types';
import { Plus, Building2, LogOut } from 'lucide-react';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHotels();
  }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      setError('');
      const data = await getHotels();
      console.log('✅ Loaded hotels:', data);
      setHotels(data || []);
    } catch (err: any) {
      console.error('❌ Load hotels error:', err);
      setError(err.message || 'Failed to load hotels');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      window.location.reload();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? "bg-[#020617] text-white" : "bg-slate-50 text-slate-900")}>
      {/* Simple Header */}
      <header className={cn(
        "border-b p-6",
        theme === 'dark' ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200"
      )}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-black">
            Euro<span className="text-[#EAB308]">Track.</span>
          </h1>
          <button
            onClick={handleSignOut}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center gap-2"
          >
            <LogOut size={18} />
            {lang === 'de' ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={cn(
            "p-6 rounded-xl border",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          )}>
            <p className="text-xs text-slate-400 uppercase mb-2">Hotels</p>
            <p className="text-3xl font-black">{hotels.length}</p>
          </div>
          
          <div className={cn(
            "p-6 rounded-xl border",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          )}>
            <p className="text-xs text-slate-400 uppercase mb-2">Free Beds</p>
            <p className="text-3xl font-black text-green-400">0</p>
          </div>
          
          <div className={cn(
            "p-6 rounded-xl border",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          )}>
            <p className="text-xs text-slate-400 uppercase mb-2">Total Cost</p>
            <p className="text-3xl font-black text-blue-400">€0</p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-6 bg-red-600/10 border border-red-600/20 rounded-xl">
            <p className="text-red-400 font-bold">Error: {error}</p>
            <button 
              onClick={loadHotels}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-400">Loading hotels...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && hotels.length === 0 && (
          <div className={cn(
            "text-center py-20 rounded-2xl border-2 border-dashed",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          )}>
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
              theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100"
            )}>
              <Building2 size={40} className="text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No Hotels Yet</h3>
            <p className="text-slate-400 mb-8">Start by adding your first hotel</p>
            <button
              onClick={() => alert('Add hotel feature coming soon!')}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Add First Hotel
            </button>
          </div>
        )}

        {/* Hotels List */}
        {!loading && hotels.length > 0 && (
          <div className="space-y-4">
            {hotels.map((hotel: any) => (
              <div
                key={hotel.id}
                className={cn(
                  "p-6 rounded-xl border",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}
              >
                <h3 className="text-xl font-bold mb-2">{hotel.name}</h3>
                <p className="text-sm text-slate-400">{hotel.city} • {hotel.companyTag}</p>
              </div>
            ))}
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
          <p className="text-xs text-yellow-400 font-mono">
            ✅ Dashboard loaded | Theme: {theme} | Lang: {lang} | Hotels: {hotels.length}
          </p>
        </div>
      </main>
    </div>
  );
}
