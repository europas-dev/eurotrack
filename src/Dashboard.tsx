import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getHotels, signOut, deleteHotel, createHotel } from './lib/supabase';
import { cn } from './lib/utils';
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
}

export default function Dashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel }: DashboardProps) {
  const dk = theme === 'dark';

  const [hotels,         setHotels]         = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [selectedYear,   setSelectedYear]   = useState(new Date().getFullYear());
  const [selectedMonth,  setSelectedMonth]  = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [addingHotel,    setAddingHotel]    = useState(false);
  const [newHotelName,   setNewHotelName]   = useState('');
  const [newHotelCity,   setNewHotelCity]   = useState('');
  const [newHotelTag,    setNewHotelTag]    = useState('');
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  const [newHotelErr,    setNewHotelErr]    = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu,   setShowSortMenu]   = useState(false);
  const [filterPaid,     setFilterPaid]     = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterFreeBeds, setFilterFreeBeds] = useState(false);
  const [sortBy,         setSortBy]         = useState<'name' | 'cost' | 'nights' | 'city'>('name');
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('asc');
  const newHotelNameRef = useRef<HTMLInputElement>(null);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  useEffect(() => { loadHotels(); }, []);

  useEffect(() => {
    if (addingHotel) setTimeout(() => newHotelNameRef.current?.focus(), 50);
  }, [addingHotel]);

  async function loadHotels() {
    try {
      setLoading(true); setError('');
      const data = await getHotels();
      setHotels(data || []);
    } catch (err: any) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const calcCost = (h: any) => (h.durations || []).reduce((s: number, d: any) => {
    if (selectedMonth !== null) {
      // cost for selected month only
      const start = new Date(d.startDate || 0);
      const end   = new Date(d.endDate   || 0);
      const ms    = new Date(selectedYear, selectedMonth, 1);
      const me    = new Date(selectedYear, selectedMonth + 1, 0);
      if (end < ms || start > me) return s;
      const from = start < ms ? ms : start;
      const to   = end   > me ? me : end;
      const nights = Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86400000));
      return s + nights * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1);
    }
    // All months in selected year
    const start = new Date(d.startDate || 0);
    const end   = new Date(d.endDate   || 0);
    const ys    = new Date(selectedYear, 0, 1);
    const ye    = new Date(selectedYear, 11, 31);
    if (end < ys || start > ye) return s;
    const from = start < ys ? ys : start;
    const to   = end   > ye ? ye : end;
    const nights = Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    return s + nights * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1);
  }, 0);

  const calcNights = (h: any) => (h.durations || []).reduce((s: number, d: any) => {
    if (selectedMonth !== null) {
      const start = new Date(d.startDate || 0);
      const end   = new Date(d.endDate   || 0);
      const ms    = new Date(selectedYear, selectedMonth, 1);
      const me    = new Date(selectedYear, selectedMonth + 1, 0);
      if (end < ms || start > me) return s;
      const from = start < ms ? ms : start;
      const to   = end   > me ? me : end;
      return s + Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    }
    const start = new Date(d.startDate || 0);
    const end   = new Date(d.endDate   || 0);
    const ys    = new Date(selectedYear, 0, 1);
    const ye    = new Date(selectedYear, 11, 31);
    if (end < ys || start > ye) return s;
    const from = start < ys ? ys : start;
    const to   = end   > ye ? ye : end;
    return s + Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  }, 0);

  const calcFreeBeds = (h: any) => (h.durations || []).reduce((s: number, d: any) =>
    s + (d.employees || []).filter((e: any) => e === null).length, 0);

  // ── Role-based hotel visibility ──────────────────────────────────────────
  const visibleHotels = useMemo(() => {
    if (!accessLevel || accessLevel.role === 'admin' || accessLevel.role === 'superadmin') return hotels;
    if (accessLevel.role === 'editor' || accessLevel.role === 'viewer') {
      return hotels.filter(h => (accessLevel as any).hotelIds?.includes(h.id));
    }
    return hotels;
  }, [hotels, accessLevel]);

  // ── Filter + Sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = visibleHotels.filter(h => {
      // search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const tags = Array.isArray(h.companyTag) ? h.companyTag.join(' ') : (h.companyTag || '');
        if (!h.name?.toLowerCase().includes(q) && !h.city?.toLowerCase().includes(q) && !tags.toLowerCase().includes(q)) return false;
      }
      // year/month filter — only show hotels that have durations in the selected period
      if (selectedMonth !== null) {
        const ms = new Date(selectedYear, selectedMonth, 1);
        const me = new Date(selectedYear, selectedMonth + 1, 0);
        const hasInMonth = (h.durations || []).some((d: any) => {
          const s = new Date(d.startDate || 0);
          const e = new Date(d.endDate   || 0);
          return e >= ms && s <= me;
        });
        if (!hasInMonth) return false;
      } else {
        // year filter
        const ys = new Date(selectedYear, 0, 1);
        const ye = new Date(selectedYear, 11, 31);
        const hasInYear = (h.durations || []).some((d: any) => {
          const s = new Date(d.startDate || 0);
          const e = new Date(d.endDate   || 0);
          return e >= ys && s <= ye;
        });
        if (!hasInYear && (h.durations || []).length > 0) return false;
      }
      // paid filter
      if (filterFreeBeds && calcFreeBeds(h) === 0) return false;
      if (filterPaid === 'paid'   && !(h.durations || []).every((d: any) => d.isPaid))    return false;
      if (filterPaid === 'unpaid' &&  (h.durations || []).every((d: any) => d.isPaid))    return false;
      return true;
    });
    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if      (sortBy === 'name')   { va = a.name?.toLowerCase();  vb = b.name?.toLowerCase(); }
      else if (sortBy === 'city')   { va = a.city?.toLowerCase();  vb = b.city?.toLowerCase(); }
      else if (sortBy === 'cost')   { va = calcCost(a);            vb = calcCost(b); }
      else                          { va = calcNights(a);          vb = calcNights(b); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [visibleHotels, searchQuery, filterFreeBeds, filterPaid, sortBy, sortDir, selectedYear, selectedMonth]);

  const totalSpend = filtered.reduce((s, h) => s + calcCost(h), 0);
  const freeBeds   = filtered.reduce((s, h) => s + calcFreeBeds(h), 0);

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Hotel', 'City', 'Company', 'Bookings', 'Total Nights', 'Free Beds', 'Total Cost (EUR)'],
      ...filtered.map(h => [h.name, h.city, Array.isArray(h.companyTag) ? h.companyTag.join(', ') : (h.companyTag || ''),
        (h.durations || []).length, calcNights(h), calcFreeBeds(h), calcCost(h).toFixed(2)])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eurotrack-${selectedYear}${selectedMonth !== null ? '-' + String(selectedMonth + 1).padStart(2, '0') : ''}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Inline add hotel ─────────────────────────────────────────────────────
  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return;
    setNewHotelErr('');
    setNewHotelSaving(true);
    try {
      const hotel = await createHotel({ name: newHotelName.trim(), city: newHotelCity.trim() || null, companyTag: newHotelTag.trim() || null });
      setHotels(p => [{ ...hotel, durations: [] }, ...p]);
      setAddingHotel(false);
      setNewHotelName(''); setNewHotelCity(''); setNewHotelTag('');
    } catch (e: any) {
      setNewHotelErr(e?.message || 'Failed to save');
    } finally { setNewHotelSaving(false); }
  }

  function cancelAddHotel() {
    setAddingHotel(false);
    setNewHotelName(''); setNewHotelCity(''); setNewHotelTag(''); setNewHotelErr('');
  }

  // ── UI helpers ───────────────────────────────────────────────────────────
  const menuCls = cn('absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[200px] space-y-1',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200');
  const menuLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2 block px-1',
    dk ? 'text-slate-500' : 'text-slate-400');
  const menuBtn = (active: boolean) => cn('w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700');
  const ic = cn('px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      {/* Sidebar */}
      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        hotels={visibleHotels}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          theme={theme} lang={lang}
          toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onExport={handleExport}
          onSignOut={async () => { try { await signOut(); window.location.reload(); } catch(e) {} }}
        />

        {/* Stats bar */}
        <div className={cn('px-8 py-3 border-b shrink-0', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-10">
            {[
              { label: lang === 'de' ? 'Freie Betten' : 'Free Beds', value: String(freeBeds), cls: freeBeds > 0 ? 'text-amber-400' : 'text-green-400' },
              { label: lang === 'de' ? 'Gesamt' : 'Total Spent', value: '\u20ac' + totalSpend.toLocaleString('de-DE', { minimumFractionDigits: 0 }), cls: 'text-blue-400' },
              { label: 'Hotels', value: String(filtered.length), cls: dk ? 'text-white' : 'text-slate-900' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
                <p className={cn('text-xl font-black', cls)}>{value}</p>
              </div>
            ))}
            {viewOnly && (
              <span className="ml-4 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/20">
                {lang === 'de' ? 'Nur Ansicht' : 'View only'}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable main */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <h2 className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth === null
                ? `${lang === 'de' ? 'Dashboard' : 'Dashboard'} ${selectedYear}`
                : `${monthNames[selectedMonth]} ${selectedYear}`}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">

              {/* Filter */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(v => !v); setShowSortMenu(false); }}
                  className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    (filterPaid !== 'all' || filterFreeBeds)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                  <Filter size={15} />
                  {lang === 'de' ? 'Filter' : 'Filter'}
                  {(filterPaid !== 'all' || filterFreeBeds) && (
                    <span className="bg-white/30 rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                      {(filterPaid !== 'all' ? 1 : 0) + (filterFreeBeds ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilterMenu && (
                  <div className={menuCls}>
                    <label className={menuLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</label>
                    {(['all', 'paid', 'unpaid'] as const).map(v => (
                      <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                        {v === 'all'    ? (lang === 'de' ? 'Alle Hotels'            : 'All hotels')
                          : v === 'paid' ? (lang === 'de' ? '\u2713 Vollst\u00e4ndig bezahlt' : '\u2713 Fully paid')
                          :               (lang === 'de' ? '\u26a0 Unbezahlt'      : '\u26a0 Has unpaid')}
                      </button>
                    ))}
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <button onClick={() => setFilterFreeBeds(v => !v)} className={menuBtn(filterFreeBeds)}>
                      \uD83D\uDECF {lang === 'de' ? 'Freie Betten' : 'Has free beds'}
                    </button>
                    <button
                      onClick={() => { setFilterPaid('all'); setFilterFreeBeds(false); setShowFilterMenu(false); }}
                      className={cn('w-full text-left px-3 py-1.5 rounded text-xs mt-1 transition-all',
                        dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}>
                      {lang === 'de' ? 'Filter zur\u00fccksetzen' : 'Clear filters'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false); }}
                  className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                  <ArrowUpDown size={15} />
                  {lang === 'de' ? 'Sortieren' : 'Sort'}
                  <span className={cn('text-[10px] font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {sortBy} {sortDir === 'asc' ? '\u2191' : '\u2193'}
                  </span>
                </button>
                {showSortMenu && (
                  <div className={menuCls}>
                    <label className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</label>
                    {([['name','Name'],['city','City'],['cost','Total Cost'],['nights','Total Nights']] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setSortBy(v as any)} className={menuBtn(sortBy === v)}>{label}</button>
                    ))}
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <label className={menuLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</label>
                    <div className="flex gap-2">
                      <button onClick={() => setSortDir('asc')}  className={cn(menuBtn(sortDir === 'asc'),  'flex-1 text-center')}>\u2191 Asc</button>
                      <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>\u2193 Desc</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export */}
              <button
                onClick={handleExport}
                className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                <Download size={15} />
                {lang === 'de' ? 'Export' : 'Export CSV'}
              </button>

              {/* Add Hotel */}
              {!viewOnly && (
                <button
                  onClick={() => setAddingHotel(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm transition-all">
                  <Plus size={16} />
                  {lang === 'de' ? 'Hotel hinzuf\u00fcgen' : 'Add Hotel'}
                </button>
              )}
            </div>
          </div>

          {/* Close menus on outside click */}
          {(showFilterMenu || showSortMenu) && (
            <div className="fixed inset-0 z-40" onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); }} />
          )}

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm mb-1">Error: {error}</p>
              <button onClick={loadHotels} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Retry</button>
            </div>
          ) : (
            <div className="space-y-2">

              {/* Inline add-hotel row — shown when addingHotel=true */}
              {addingHotel && !viewOnly && (
                <div className={cn('rounded-xl border px-4 py-3 space-y-2',
                  dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-blue-400" />
                    </div>
                    <input
                      ref={newHotelNameRef}
                      type="text" value={newHotelName}
                      onChange={e => setNewHotelName(e.target.value)}
                      placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
                      onKeyDown={e => e.key === 'Enter' && handleSaveNewHotel()}
                      className={cn(ic, 'w-52')} />
                    <input
                      type="text" value={newHotelCity}
                      onChange={e => setNewHotelCity(e.target.value)}
                      placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
                      onKeyDown={e => e.key === 'Enter' && handleSaveNewHotel()}
                      className={cn(ic, 'w-36')} />
                    <input
                      type="text" value={newHotelTag}
                      onChange={e => setNewHotelTag(e.target.value)}
                      placeholder="Company tag..."
                      onKeyDown={e => e.key === 'Enter' && handleSaveNewHotel()}
                      className={cn(ic, 'w-36')} />
                    <button
                      onClick={handleSaveNewHotel}
                      disabled={newHotelSaving || !newHotelName.trim()}
                      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0">
                      {newHotelSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button
                      onClick={cancelAddHotel}
                      className={cn('p-2 rounded-lg transition-all flex-shrink-0',
                        dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                      <X size={16} />
                    </button>
                  </div>
                  {newHotelErr && <p className="text-red-400 text-xs font-bold px-1">{newHotelErr}</p>}
                </div>
              )}

              {filtered.length === 0 && !addingHotel ? (
                <div className={cn('text-center py-20 rounded-2xl border-2 border-dashed',
                  dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}>
                  <div className={cn('w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center',
                    dk ? 'bg-blue-600/20' : 'bg-blue-100')}>
                    <Building2 size={32} className="text-blue-500" />
                  </div>
                  <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                    {selectedMonth !== null
                      ? (lang === 'de' ? 'Keine Hotels in diesem Monat' : 'No hotels in this month')
                      : (lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet')}
                  </h3>
                  <p className={cn('text-sm mb-6', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {selectedMonth !== null
                      ? (lang === 'de' ? 'Keine Buchungen f\u00fcr diesen Zeitraum' : 'No bookings for this period')
                      : (lang === 'de' ? 'Klicken Sie auf Hotel hinzuf\u00fcgen' : 'Click Add Hotel to get started')}
                  </p>
                  {!viewOnly && selectedMonth === null && (
                    <button
                      onClick={() => setAddingHotel(true)}
                      className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm">
                      <Plus size={18} />
                      {lang === 'de' ? 'Hotel hinzuf\u00fcgen' : 'Add Hotel'}
                    </button>
                  )}
                </div>
              ) : (
                filtered.map(hotel => (
                  <HotelRow
                    key={hotel.id}
                    entry={hotel}
                    isDarkMode={dk}
                    viewOnly={viewOnly}
                    onDelete={(id: string) => {
                      if (!viewOnly) { deleteHotel(id); setHotels(p => p.filter(h => h.id !== id)); }
                    }}
                    onUpdate={(id: string, u: any) => {
                      if (!viewOnly) setHotels(p => p.map(h => h.id === id ? { ...h, ...u } : h));
                    }}
                  />
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
