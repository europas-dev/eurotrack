import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, calcDurationFreeBeds, hotelMatchesSearch } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Building2, Check, X, Loader2, Filter, ArrowUpDown, Download } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

interface DashboardProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  offlineMode?: boolean;
  onToggleOfflineMode?: () => void;
  viewOnly?: boolean;
  accessLevel?: AccessLevel | null;
  onSignOut?: () => void;
}

export default function Dashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel, onSignOut }: DashboardProps) {
  const dk = theme === 'dark';

  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  const [newHotelErr, setNewHotelErr] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterFreeBeds, setFilterFreeBeds] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'nights' | 'city'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const newHotelNameRef = useRef<HTMLInputElement>(null);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  useEffect(() => { loadHotels(); }, [selectedYear]);

  useEffect(() => {
    if (addingHotel) setTimeout(() => newHotelNameRef.current?.focus(), 50);
  }, [addingHotel]);

  // THE FIX: Deep fetching ensures everything is stored and visible after refresh
  async function loadHotels() {
    try {
      setLoading(true); setError('');
      const { data, error: supabaseError } = await supabase
        .from('hotels')
        .select('*, durations(*, roomCards(*, employees(*)), extraCosts(*), employees(*))')
        .eq('year', selectedYear)
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setHotels(data || []);
    } catch (err: any) { 
      setError(err.message || 'Failed to load'); 
    } finally { 
      setLoading(false); 
    }
  }

  const calcCost = (h: any) => (h.durations || []).reduce((s: number, d: any) => {
    const rcTotal = (d.roomCards || []).reduce((sum: number, c: any) => sum + (c.roomBrutto || c.totalBrutto || 0), 0);
    const exTotal = (d.extraCosts || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    let total = d.useBruttoNetto ? (d.brutto || 0) : rcTotal;
    total += exTotal;
    if (!d.useBruttoNetto && d.hasDiscount && d.discountValue) {
      total = d.discountType === 'fixed' ? total - d.discountValue : total * (1 - d.discountValue / 100);
    }
    return s + Math.max(0, total);
  }, 0);

  const calcNights = (h: any) => (h.durations || []).reduce((s: number, d: any) => {
    if (!d.startDate || !d.endDate) return s;
    const start = new Date(d.startDate);
    const end = new Date(d.endDate);
    return s + Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  }, 0);

  const calcFreeBeds = (h: any) => {
    const today = new Date().toISOString().split('T')[0];
    return (h.durations || []).reduce((s: number, d: any) => s + calcDurationFreeBeds(d, today), 0);
  };

  const visibleHotels = useMemo(() => {
    if (!accessLevel || accessLevel.role === 'admin' || accessLevel.role === 'superadmin') return hotels;
    return hotels.filter(h => (accessLevel as any).hotelIds?.includes(h.id));
  }, [hotels, accessLevel]);

  const filtered = useMemo(() => {
    let list = visibleHotels.filter(h => {
      // 1. GLOBAL DEEP SEARCH
      if (searchQuery) {
        if (!hotelMatchesSearch(h, searchQuery)) return false;
      }
      
      // 2. STRICT MONTH TIMELINE FILTER
      if (selectedMonth !== null) {
        const hasOverlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate);
          const dEnd = new Date(d.endDate);
          const monthStart = new Date(selectedYear, selectedMonth, 1);
          const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
          return dStart <= monthEnd && dEnd >= monthStart;
        });
        if (!hasOverlap) return false;
      }

      if (filterFreeBeds && calcFreeBeds(h) === 0) return false;
      if (filterPaid === 'paid' && !(h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && (h.durations || []).every((d: any) => d.isPaid)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'city') { va = a.city?.toLowerCase(); vb = b.city?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcCost(a); vb = calcCost(b); }
      else { va = calcNights(a); vb = calcNights(b); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [visibleHotels, searchQuery, filterFreeBeds, filterPaid, sortBy, sortDir, selectedYear, selectedMonth]);

  // THE FIX: Yearly total uses full decimals via formatCurrency
  const totalSpend = filtered.reduce((s, h) => s + calcCost(h), 0);
  const totalNights = filtered.reduce((s, h) => s + calcNights(h), 0);
  const freeBedsTotal = filtered.reduce((s, h) => s + calcFreeBeds(h), 0);

  const handleExport = () => {
    const rows = [
      ['Hotel', 'City', 'Company', 'Bookings', 'Total Nights', 'Free Beds', 'Total Cost (EUR)'],
      ...filtered.map(h => [
        h.name, h.city,
        Array.isArray(h.companyTag) ? h.companyTag.join(', ') : (h.companyTag || ''),
        (h.durations || []).length, calcNights(h), calcFreeBeds(h),
        calcCost(h).toFixed(2),
      ])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eurotrack-export.csv`;
    a.click();
  };

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return;
    setNewHotelErr(''); setNewHotelSaving(true);
    try {
      const hotel = await createHotel({ name: newHotelName.trim(), city: newHotelCity.trim() || null, year: selectedYear });
      setHotels(p => [{ ...hotel, durations: [] }, ...p]);
      setAddingHotel(false);
      setNewHotelName(''); setNewHotelCity('');
    } catch (e: any) {
      setNewHotelErr(e?.message || 'Failed to save');
    } finally { setNewHotelSaving(false); }
  }

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        hotels={visibleHotels}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onExport={handleExport} onSignOut={onSignOut} viewOnly={viewOnly}
          userRole={accessLevel?.role ?? 'viewer'}
        />

        <div className={cn('px-8 py-4 border-b shrink-0', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-12 flex-wrap">
            {[
              { label: lang === 'de' ? 'Freie Betten'  : 'Free Beds',    value: String(freeBedsTotal),   cls: freeBedsTotal > 0 ? 'text-red-500' : 'text-emerald-500' },
              { label: lang === 'de' ? 'Gesamtkosten' : 'Total Spent',  value: formatCurrency(totalSpend), cls: 'text-blue-400' },
              { label: lang === 'de' ? 'Gesamtnächte' : 'Total Nights', value: '🌙 ' + totalNights, cls: dk ? 'text-slate-300' : 'text-slate-700' },
              { label: 'Hotels', value: String(filtered.length), cls: dk ? 'text-white' : 'text-slate-900' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
                <p className={cn('text-2xl font-black', cls)}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}
            </h2>

            <div className="flex items-center gap-3">
              <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={cn('px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>
                <Filter size={16} /> {lang === 'de' ? 'Filter' : 'Filter'}
              </button>
              <button onClick={() => setShowSortMenu(!showSortMenu)} className={cn('px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>
                <ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}
              </button>
              <button onClick={handleExport} className={cn('px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>
                <Download size={16} /> {lang === 'de' ? 'Export' : 'Export CSV'}
              </button>
              {!viewOnly && (
                <button onClick={() => setAddingHotel(true)} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-blue-600/20 transition-all">
                  <Plus size={18} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20"><Loader2 size={40} className="animate-spin text-blue-600 mx-auto" /></div>
          ) : (
            <div className="space-y-3 pb-24">
              {addingHotel && (
                <div className={cn('rounded-2xl border p-4 flex gap-4 items-center', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
                  <input ref={newHotelNameRef} className={cn('px-4 py-2 rounded-xl border outline-none flex-1', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder="Hotel name..." />
                  <input className={cn('px-4 py-2 rounded-xl border outline-none w-48', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelCity} onChange={e => setNewHotelCity(e.target.value)} placeholder="City..." />
                  <button onClick={handleSaveNewHotel} disabled={newHotelSaving} className="p-2.5 bg-blue-600 text-white rounded-xl">{newHotelSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}</button>
                  <button onClick={() => setAddingHotel(false)} className="p-2.5 text-slate-500"><X size={20} /></button>
                </div>
              )}
              {filtered.map((hotel, index) => (
                <HotelRow
                  key={hotel.id} entry={hotel} index={index}
                  isDarkMode={dk} lang={lang}
                  onDelete={(id) => setHotels(p => p.filter(h => h.id !== id))}
                  onUpdate={(id, u) => setHotels(p => p.map(h => h.id === id ? { ...h, ...u } : h))}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
