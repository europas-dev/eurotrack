// src/Dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getHotels, signOut, deleteHotel, createHotel } from './lib/supabase';
import { cn } from './lib/utils';
import type { Theme, Language } from './lib/types';
import { Plus, Building2, Check, X, Loader2 } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

// Inline new-hotel row — Notion style
function NewHotelRow({ isDarkMode, lang, onSave, onCancel }: {
  isDarkMode: boolean;
  lang: Language;
  onSave: (hotel: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [companyTag, setCompanyTag] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dk = isDarkMode;

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !city.trim() || !companyTag.trim()) return;
    try {
      setSaving(true);
      const newHotel = await createHotel({ name: name.trim(), city: city.trim(), companyTag: companyTag.trim() });
      onSave({ ...newHotel, durations: [] });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const fieldCls = cn(
    "px-3 py-2 rounded-lg text-sm outline-none border transition-all",
    dk
      ? "bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600"
      : "bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400"
  );

  return (
    <div className={cn(
      "mb-2 rounded-xl border px-6 py-4 flex items-center gap-3",
      dk ? "bg-[#0B1224] border-blue-500/40" : "bg-white border-blue-400"
    )}>
      <div className="w-9 h-9 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
        <Building2 size={18} className="text-blue-400" />
      </div>
      <input
        ref={nameRef}
        type="text"
        placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && city && companyTag && handleSave()}
        className={cn(fieldCls, "flex-1 min-w-0")}
      />
      <input
        type="text"
        placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
        value={city}
        onChange={e => setCity(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name && companyTag && handleSave()}
        className={cn(fieldCls, "w-36")}
      />
      <input
        type="text"
        placeholder="Company tag..."
        value={companyTag}
        onChange={e => setCompanyTag(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name && city && handleSave()}
        className={cn(fieldCls, "w-32")}
      />
      <button
        onClick={handleSave}
        disabled={saving || !name.trim() || !city.trim() || !companyTag.trim()}
        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-40 flex-shrink-0"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      </button>
      <button
        onClick={onCancel}
        className={cn("p-2 rounded-lg transition-all flex-shrink-0",
          dk ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingHotel, setAddingHotel] = useState(false);

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
    setAddingHotel(false);
  };

  const filteredHotels = hotels.filter(hotel => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      hotel.name?.toLowerCase().includes(q) ||
      hotel.city?.toLowerCase().includes(q) ||
      hotel.companyTag?.toLowerCase().includes(q)
    );
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
      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSignOut={handleSignOut}
        />

        {/* Stats Bar */}
        <div className={cn("px-8 py-4 border-b", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
          <div className="flex items-center gap-10">
            {[
              { label: lang === 'de' ? 'Freie Betten' : 'Free Beds', value: freeBeds, cls: freeBeds > 0 ? 'text-amber-400' : 'text-green-400' },
              { label: lang === 'de' ? 'Gesamtausgaben' : 'Total Spent', value: '€' + totalSpend.toLocaleString('de-DE', { minimumFractionDigits: 0 }), cls: 'text-blue-400' },
              { label: 'Hotels', value: hotels.length, cls: dk ? 'text-white' : 'text-slate-900' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", dk ? "text-slate-500" : "text-slate-400")}>{label}</p>
                <p className={cn("text-2xl font-black", cls)}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className={cn("text-xl font-black", dk ? "text-white" : "text-slate-900")}>
              {selectedMonth === null ? 'Dashboard' : monthNames[selectedMonth] + ' ' + selectedYear}
            </h2>
            <button
              onClick={() => setAddingHotel(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all text-sm"
            >
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
          ) : (
            <div className="space-y-2">
              {/* Inline new hotel row appears at top */}
              {addingHotel && (
                <NewHotelRow
                  isDarkMode={dk}
                  lang={lang}
                  onSave={handleHotelAdded}
                  onCancel={() => setAddingHotel(false)}
                />
              )}

              {filteredHotels.length === 0 && !addingHotel ? (
                <div className={cn("text-center py-20 rounded-2xl border-2 border-dashed",
                  dk ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
                  <div className={cn("w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center",
                    dk ? "bg-blue-600/20" : "bg-blue-100")}>
                    <Building2 size={32} classNam
