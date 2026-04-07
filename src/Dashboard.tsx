// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { getHotels, signOut, deleteHotel } from './lib/supabase';
import { cn } from './lib/utils';
import type { Theme, Language } from './lib/types';
import { Plus, Building2 } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';
import AddHotelModal from './components/AddHotelModal';

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
  const [showAddHotel, setShowAddHotel] = useState(false);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  useEffect(() => { loadHotels(); }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      setError('');
      const data = await getHotels();
      setHotels(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load hotels');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try { await signOut(); window.location.reload(); }
    catch (err) { console.error(err); }
  }

  const handleDeleteHotel = async (id: string) => {
    try {
      await deleteHotel(id);
      setHotels(prev => prev.filter(h => h.id !== id));
    } catch (err: any) { setError(err.message); }
  };

  const handleUpdateHotel = (id: string, updated: any) => {
    setHotels(prev => prev.map(h => h.id === id ? { ...h, ...updated } : h));
  };

  const handleHotelAdded = (newHotel: any) => {
    setHotels(prev => [newHotel, ...prev]);
    setShowAddHotel(false);
  };

  const filteredHotels = hotels.filter(hotel => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return hotel.name?.toLowerCase().includes(q) || hotel.city?.toLowerCase().includes(q) || hotel.companyTag?.toLowerCase().includes(q);
  });

  const totalSpend = hotels.reduce((sum, hotel) =>
    sum + (hotel.durations || []).reduce((s: number, d: any) => {
      const nights = Math.max(0, Math.ceil(
        (new Date(d.endDate || d.end_date || 0).getTime() - new Date(d.startDate || d.start_date || 0).getTime()) / 86400000
      ));
      return s + nights * (d.pricePerNightPerRoom || d.price_per_night_per_room || 0) * (d.numberOfRooms || d.number_of_rooms || 1);
    }, 0), 0);

  const freeBeds = hotels.reduce((sum, hotel) =>
    sum + (hotel.durations || []).reduce((s: number, d: any) =>
      s + (d.employees || []).filter((e: any) => e === null).length, 0), 0);

  const dk = theme === 'dark';

  return (
    <div className={cn("min-h-screen flex", dk ? "bg-[#020617]" : "bg-slate-50")}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSignOut={handleSignOut} />

        {/* Stats */}
        <div className={cn("px-8 py-4 border-b", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
          <div className="flex items-center gap-10">
            {[
              { label: lang === 'de' ? 'Freie Betten' : 'Free Beds', value: freeBeds, cls: freeBeds > 0 ? 'text-amber-400' : 'text-green-400' },
              { label: lang === 'de' ? 'Gesamtausgaben' : 'Total Spent', value: `€${totalSpend.toLocaleString('de-DE', {minimumFractionDigits:0})}`, cls: 'text-blue-400' },
              { label: 'Hotels', value: hotels.length, cls: dk ? 'text-white' : 'text-slate-900' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", dk ? "text-slate-500" : "text-slate-400")}>{label}</p>
                <p className={cn("text-2xl font-black", cls)}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className={cn("text-xl font-black", dk ? "text-white" : "text-slate-900")}>
              {selectedMonth === null ? 'Dashboard' : `${monthNames[selectedMonth]} ${selectedYear}`}
            </h2>
            <button onClick={() => setShowAddHotel(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all text-sm">
              <Plus size={18} />
              {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? "text-slate-400" : "text-slate-600"}>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm">Error: {error}</p>
              <button onClick={loadHotels} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Retry</button>
            </div>
          ) : filteredHotels.length === 0 ? (
            <div className={cn("text-center py-20 rounded-2xl border-2 border-dashed",
              dk ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
              <div className={cn("w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center",
                dk ? "bg-blue-600/20" : "bg-blue-100")}>
                <Building2 size={32} className="text-blue-600" />
              </div>
              <h3 className={cn("text-xl font-bold mb-2", dk ? "text-white" : "text-slate-900")}>
                {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
              </h3>
              <p className={cn("text-sm mb-6", dk ? "text-slate-500" : "text-slate-400")}>
                {lang === 'de' ? 'Fügen Sie Ihr erstes Hotel hinzu' : 'Add your first hotel to get started'}
              </p>
              <button onClick={() => setShowAddHotel(true)}
                className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all inline-flex items-center gap-2 text-sm">
                <Plus size={18} />
                {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHotels.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  entry={hotel}
                  isDarkMode={dk}
                  onDelete={handleDeleteHotel}
                  onUpdate={handleUpdateHotel}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {showAddHotel && (
        <AddHotelModal theme={theme} lang={lang} onClose={() => setShowAddHotel(false)} onSave={handleHotelAdded} />
      )}
    </div>
  );
}
