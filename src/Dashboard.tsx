// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';
import { getHotels, signOut } from './lib/supabase';
import { cn } from './lib/utils';
import type { Theme, Language } from './lib/types';
import { Plus, Building2 } from 'lucide-react';

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

  useEffect(() => {
    loadHotels();
  }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      setError('');
      const data = await getHotels();
      console.log('Loaded hotels:', data);
      setHotels(data || []);
    } catch (err: any) {
      console.error('Load hotels error:', err);
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
    alert('Delete functionality coming soon!');
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

  if (error) {
    return (
      <div className={cn("min-h-screen p-6", theme === 'dark' ? "bg-[#020617]" : "bg-slate-50")}>
        <div className="max-w-md mx-auto mt-20 p-8 border rounded-2xl text-center">
          <p className="text-red-500 font-bold mb-4">Error: {error}</p>
          <button 
            onClick={loadHotels}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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

      {/* Main Content */}
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
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>
                {lang === 'de' ? 'Freie Betten' : 'Free Beds'}
              </p>
              <p className="text-2xl font-black text-green-400">{stats.freeBeds}</p>
            </div>

            <div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>
                {lang === 'de' ? 'Gesamtausgaben' : 'Total Spent'}
              </p>
              <p className="text-2xl font-black text-blue-400">
                €{stats.totalSpend.toLocaleString('de-DE')}
              </p>
            </div>

            <div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>
                {lang === 'de' ? 'Hotels' : 'Hotels'}
              </p>
              <p className="text-2xl font-black text-white">{hotels.length}</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Header with Add Button */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn(
              "text-2xl font-black",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>
              {selectedMonth === null 
                ? (lang === 'de' ? 'Dashboard' : 'Dashboard')
                : `${lang === 'de' ? 'Monat' : 'Month'} ${selectedYear}`
              }
            </h2>

            <button
              onClick={() => alert('Add hotel coming soon!')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
              <Plus size={20} />
              {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
            </button>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className={cn(
                "mt-4 text-sm font-bold",
                theme === 'dark' ? "text-slate-400" : "text-slate-600"
              )}>
                {lang === 'de' ? 'Lade Hotels...' : 'Loading hotels...'}
              </p>
            </div>
          ) : filteredHotels.length === 0 ? (
            /* Empty State */
            <div className={cn(
              "text-center py-20 px-6 rounded-2xl border-2 border-dashed",
              theme === 'dark' ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
            )}>
              <div className={cn(
                "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
                theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100"
              )}>
                <Building2 size={40} className="text-blue-600" />
              </div>
              <h3 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>
                {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
              </h3>
              <p className={cn(
                "text-sm mb-6",
                theme === 'dark' ? "text-slate-400" : "text-slate-600"
              )}>
                {lang === 'de' 
                  ? 'Beginnen Sie mit dem Hinzufügen Ihres ersten Hotels' 
                  : 'Start by adding your first hotel'}
              </p>
              <button
                onClick={() => alert('Add hotel coming soon!')}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl inline-flex items-center gap-2 transition-all shadow-lg"
              >
                <Plus size={20} />
                {lang === 'de' ? 'Erstes Hotel hinzufügen' : 'Add First Hotel'}
              </button>
            </div>
          ) : (
            /* Hotel List */
            <div className="space-y-3">
              {filteredHotels.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  entry={hotel}
                  isDarkMode={theme === 'dark'}
                  onDelete={handleDeleteHotel}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
