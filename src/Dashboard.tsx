// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { getHotels, signOut } from './lib/supabase';
import { cn } from './lib/utils';
import type { Theme, Language } from './lib/types';
import { Plus, Building2 } from 'lucide-react';
// ADD THESE IMPORTS:
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

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
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ADD THIS:
  const monthNames = lang === 'de'
    ? ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ... rest of your code
export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleDeleteHotel = (id: string) => {
    console.log('Delete hotel:', id);
  };

  const filteredHotels = hotels.filter(hotel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      hotel.name?.toLowerCase().includes(query) ||
      hotel.city?.toLowerCase().includes(query) ||
      hotel.companyTag?.toLowerCase().includes(query)
    );
  });

  const stats = {
    totalSpend: 0,
    freeBeds: 0
  };

  return (
    <div className={cn("min-h-screen flex", theme === 'dark' ? "bg-[#020617]" : "bg-slate-50")}>
      {/* Sidebar */}
      <Sidebar
        theme={theme}
        lang={lang}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          theme={theme}
          lang={lang}
          toggleTheme={toggleTheme}
          setLang={setLang}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSignOut={handleSignOut}
        />

        {/* Stats Bar */}
        <div className={cn(
          "px-8 py-4 border-b",
          theme === 'dark' ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center gap-8">
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-widest mb-1", 
                theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                {lang === 'de' ? 'Freie Betten' : 'Free Beds'}
              </p>
              <p className="text-2xl font-black text-green-400">{stats.freeBeds}</p>
            </div>
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                {lang === 'de' ? 'Gesamtausgaben' : 'Total Spent'}
              </p>
              <p className="text-2xl font-black text-blue-400">€{stats.totalSpend.toLocaleString('de-DE')}</p>
            </div>
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                Hotels
              </p>
              <p className="text-2xl font-black text-white">{hotels.length}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-2xl font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>
              {selectedMonth === null ? (lang === 'de' ? 'Dashboard' : 'Dashboard') : `${monthNames[selectedMonth]} ${selectedYear}`}
            </h2>
            <button
              onClick={() => alert('Add hotel coming soon!')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2"
            >
              <Plus size={20} />
              {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className={theme === 'dark' ? "text-slate-400" : "text-slate-600"}>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold">Error: {error}</p>
            </div>
          ) : filteredHotels.length === 0 ? (
            <div className={cn("text-center py-20 rounded-2xl border-2 border-dashed",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
              <div className={cn("w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
                theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100")}>
                <Building2 size={40} className="text-blue-600" />
              </div>
              <h3 className={cn("text-2xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
                No Hotels Yet
              </h3>
              <p className="text-slate-400 mb-8">Start by adding your first hotel</p>
              <button
                onClick={() => alert('Add hotel feature coming soon!')}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl inline-flex items-center gap-2"
              >
                <Plus size={20} />
                Add First Hotel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHotels.map(hotel => (
                <HotelRow key={hotel.id} entry={hotel} isDarkMode={theme === 'dark'} onDelete={handleDeleteHotel} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
