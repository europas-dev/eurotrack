// src/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Building2, Loader2 } from 'lucide-react';
import {
  getHotels, signOut, deleteHotel, createHotel, syncOfflineQueue
} from './lib/supabase';
import { hasQueuedOps } from './lib/offlineQueue';
import { cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights,
  durationTouchesMonth, exportToCSV, formatCurrency,
  getDurationCostForMonth, hotelHasFreeOnDate, getFreeBedFilterDate,
  sumGroupCost } from './lib/utils';
import type { Theme, Language } from './lib/types';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

// ── Inline new hotel form (preserved from your original) ──────────────────────
function NewHotelRow({ isDarkMode, lang, onSave, onCancel }: {
  isDarkMode: boolean; lang: Language;
  onSave: (hotel: any) => void; onCancel: () => void;
}) {
  const dk = isDarkMode;
  const [name, setName]   = useState('');
  const [city, setCity]   = useState('');
  const [tag,  setTag]    = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const canSave = name.trim().length > 0 && city.trim().length > 0 && tag.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setErr('');
    try {
      setSaving(true);
      const newHotel = await createHotel({ name: name.trim(), city: city.trim(), company: tag.trim() });
      onSave({ ...newHotel, durations: [] });
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
      setSaving(false);
    }
  };

  const ic = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  );

  return (
    <div className={cn('mb-2 rounded-xl border px-4 py-3 space-y-2', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-blue-400" />
        </div>
        <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-52')} />
        <input type="text" value={city} onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')} />
        <input type="text" value={tag} onChange={e => setTag(e.target.value)}
          placeholder="Company..."
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')} />
        <button onClick={handleSave} disabled={saving || !canSave}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0">
          {saving ? <Loader2 size={16} className="animate-spin" /> : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </button>
        <button onClick={onCancel}
          className={cn('p-2 rounded-lg transition-all flex-shrink-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {err && <p className="text-red-400 text-xs font-bold px-1">{err}</p>}
      {!canSave && (name || city || tag) && (
        <p className={cn('text-xs px-1', dk ? 'text-slate-500' : 'text-slate-400')}>
          {lang === 'de' ? 'Alle 3 Felder ausfüllen, dann ↵ drücken' : 'Fill all 3 fields then press ↵'}
        </p>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const dk = theme === 'dark';

  const [hotels,          setHotels]          = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [selectedYear,    setSelectedYear]    = useState(2026);
  const [selectedMonth,   setSelectedMonth]   = useState<number | null>(null);
  const [sidebarCollapsed,setSidebarCollapsed]= useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [addingHotel,     setAddingHotel]     = useState(false);
  const [showFilterMenu,  setShowFilterMenu]  = useState(false);
  const [showSortMenu,    setShowSortMenu]    = useState(false);
  const [filterPaid,      setFilterPaid]      = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterFreeBeds,  setFilterFreeBeds]  = useState(false);
  const [sortBy,          setSortBy]          = useState<'name' | 'cost' | 'nights' | 'city'>('name');
  const [sortDir,         setSortDir]         = useState<'asc' | 'desc'>('asc');
  const [offlinePending,  setOfflinePending]  = useState(hasQueuedOps());

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  useEffect(() => { loadHotels(); }, []);

  // Recheck offline queue every 5s
  useEffect(() => {
    const t = setInterval(() => setOfflinePending(hasQueuedOps()), 5000);
    return () => clearInterval(t);
  }, []);

  async function loadHotels() {
    try {
      setLoading(true); setError('');
      const data = await getHotels();
      setHotels(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  // ── Calc helpers (preserved from your original) ───────────────────────────
  const calcCost    = (h: any) => h.durations?.reduce((s: number, d: any) => {
    const n = Math.max(0, Math.ceil((new Date(d.endDate||0).getTime() - new Date(d.startDate||0).getTime()) / 86400000));
    return s + n * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1);
  }, 0) || 0;
  const calcNights  = (h: any) => h.durations?.reduce((s: number, d: any) =>
    s + Math.max(0, Math.ceil((new Date(d.endDate||0).getTime() - new Date(d.startDate||0).getTime()) / 86400000)), 0) || 0;
  const calcFree    = (h: any) => h.durations?.reduce((s: number, d: any) =>
    s + (d.employees || []).filter((e: any) => e === null).length, 0) || 0;

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Hotel', 'City', 'Company', 'Bookings', 'Total Nights', 'Free Beds', 'Total Cost EUR'],
      ...filtered.map(h => [
        h.name, h.city, h.companyTag || h.company,
        h.durations?.length,
        calcNights(h), calcFree(h),
        calcCost(h).toFixed(2)
      ])
    ];
    const csv = rows.map(r => r.map((v: any) => v).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `eurotrack-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtering + sorting ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = hotels.filter(h => {
      if (selectedMonth !== null) {
        const touches = (h.durations || []).some((d: any) =>
          durationTouchesMonth(d, selectedYear, selectedMonth));
        if (!touches) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!h.name?.toLowerCase().includes(q) &&
            !h.city?.toLowerCase().includes(q) &&
            !(h.companyTag || h.company)?.toLowerCase().includes(q)) return false;
      }
      if (filterFreeBeds && calcFree(h) === 0) return false;
      if (filterPaid === 'paid'   && !h.durations?.every((d: any) => d.isPaid))  return false;
      if (filterPaid === 'unpaid' &&  h.durations?.every((d: any) => d.isPaid))  return false;
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
  }, [hotels, searchQuery, selectedYear, selectedMonth, filterFreeBeds, filterPaid, sortBy, sortDir]);

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalSpend = useMemo(() =>
    sumGroupCost(filtered, selectedYear, selectedMonth), [filtered, selectedYear, selectedMonth]);
  const freeBeds   = useMemo(() => filtered.reduce((s, h) => s + calcFree(h), 0), [filtered]);

  // ── Derived options ───────────────────────────────────────────────────────
  const companyOptions = useMemo(() =>
    [...new Set(hotels.map(h => h.companyTag || h.company).filter(Boolean))].sort() as string[], [hotels]);
  const cityOptions = useMemo(() =>
    [...new Set(hotels.map(h => h.city).filter(Boolean))].sort() as string[], [hotels]);

  // ── Menu styles ───────────────────────────────────────────────────────────
  const menuCls = cn(
    'absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[200px] space-y-1',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  );
  const menuLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2 block px-1', dk ? 'text-slate-500' : 'text-slate-400');
  const menuBtn   = (active: boolean) => cn(
    'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn('min-h-screen flex', dk ? 'bg-[#020617]' : 'bg-slate-50')}>

      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear}   setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed}  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header — your original with Share, Notifications, Settings */}
        <Header
          theme={theme} lang={lang}
          toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery}  setSearchQuery={setSearchQuery}
          onExport={handleExport}
          onSignOut={async () => { try { await signOut(); window.location.reload(); } catch(e) {} }}
        />

        {/* ── BIG STATS BAR ─────────────────────────────────────────────── */}
        <div className={cn('px-8 py-4 border-b', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-10">
            {[
              {
                label: lang === 'de' ? 'Freie Betten' : 'Free Beds',
                value: String(freeBeds),
                cls: freeBeds > 0 ? 'text-red-400' : 'text-green-400',
              },
              {
                label: lang === 'de' ? 'Gesamt' : 'Total Spent',
                value: totalSpend.toLocaleString('de-DE', { minimumFractionDigits: 0 }),
                cls: 'text-blue-400',
                prefix: '€',
              },
              {
                label: 'Hotels',
                value: String(filtered.length),
                cls: dk ? 'text-white' : 'text-slate-900',
              },
            ].map(({ label, value, cls, prefix }) => (
              <div key={label}>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {label}
                </p>
                <p className={cn('text-2xl font-black', cls)}>
                  {prefix}{value}
                </p>
              </div>
            ))}

            {/* Offline sync pill */}
            {offlinePending && (
              <button
                onClick={async () => {
                  await syncOfflineQueue();
                  await loadHotels();
                  setOfflinePending(hasQueuedOps());
                }}
                className="ml-4 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                ⚡ {lang === 'de' ? 'Offline-Änderungen synchronisieren' : 'Sync offline changes'}
              </button>
            )}
          </div>
        </div>

        {/* ── TOOLBAR ───────────────────────────────────────────────────── */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <h2 className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth === null ? 'Dashboard' : `${monthNames[selectedMonth]} ${selectedYear}`}
            </h2>

            <div className="flex items-center gap-2">

              {/* Filter */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    filterPaid !== 'all' || filterFreeBeds
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
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
                        {v === 'all'    ? (lang === 'de' ? 'Alle Hotels'        : 'All hotels') :
                         v === 'paid'   ? (lang === 'de' ? 'Vollständig bezahlt': 'Fully paid') :
                                          (lang === 'de' ? 'Unbezahlt'          : 'Has unpaid')}
                      </button>
                    ))}
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <button onClick={() => setFilterFreeBeds(!filterFreeBeds)} className={menuBtn(filterFreeBeds)}>
                      {lang === 'de' ? 'Freie Betten' : 'Has free beds'}
                    </button>
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <button
                      onClick={() => { setFilterPaid('all'); setFilterFreeBeds(false); setShowFilterMenu(false); }}
                      className={cn('w-full text-left px-3 py-1.5 rounded text-xs mt-1 transition-all', dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}>
                      {lang === 'de' ? 'Filter zurücksetzen' : 'Clear filters'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                  className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  {lang === 'de' ? 'Sortieren' : 'Sort'}
                  <span className={cn('text-[10px] font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {sortBy} {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                </button>
                {showSortMenu && (
                  <div className={menuCls}>
                    <label className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</label>
                    {(['name', 'Name'], ['city', 'City'], ['cost', 'Total Cost'], ['nights', 'Total Nights']).map(([v, label]) => (
                      <button key={v} onClick={() => setSortBy(v as any)} className={menuBtn(sortBy === v)}>
                        {label}
                      </button>
                    ))}
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <label className={menuLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</label>
                    <div className="flex gap-2">
                      <button onClick={() => setSortDir('asc')}  className={cn(menuBtn(sortDir === 'asc'),  'flex-1 text-center')}>Asc</button>
                      <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>Desc</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export */}
              <button onClick={handleExport}
                className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {lang === 'de' ? 'Export' : 'Export CSV'}
              </button>

              {/* Add Hotel */}
              <button onClick={() => setAddingHotel(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm">
                <Plus size={16} />
                {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
              </button>
            </div>
          </div>

          {/* Close dropdowns overlay */}
          {(showFilterMenu || showSortMenu) && (
            <div className="fixed inset-0 z-40"
              onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); }} />
          )}

          {/* Loading */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm mb-1">Error</p>
              <p className={cn('text-sm', dk ? 'text-slate-400' : 'text-slate-600')}>{error}</p>
              <button onClick={loadHotels} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Retry</button>
            </div>
          ) : (
            <div className="space-y-2">

              {/* Inline add hotel form */}
              {addingHotel && (
                <NewHotelRow
                  isDarkMode={dk} lang={lang}
                  onSave={h => { setHotels(p => [h, ...p]); setAddingHotel(false); }}
                  onCancel={() => setAddingHotel(false)}
                />
              )}

              {/* Empty state */}
              {filtered.length === 0 && !addingHotel && (
                <div className={cn('text-center py-20 rounded-2xl border-2 border-dashed', dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}>
                  <div className={cn('w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center', dk ? 'bg-blue-600/20' : 'bg-blue-100')}>
                    <Building2 size={32} className="text-blue-500" />
                  </div>
                  <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                    {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
                  </h3>
                  <p className={cn('text-sm mb-6', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Klicken Sie auf „Hotel hinzufügen"' : 'Click "Add Hotel" to get started'}
                  </p>
                  <button onClick={() => setAddingHotel(true)}
                    className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm">
                    <Plus size={18} />
                    {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                  </button>
                </div>
              )}

              {/* Hotel list */}
              {filtered.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  entry={hotel}
                  isDarkMode={dk}
                  lang={lang}
                  companyOptions={companyOptions}
                  cityOptions={cityOptions}
                  onDelete={async id => {
                    try { await deleteHotel(id); setHotels(p => p.filter(h => h.id !== id)); }
                    catch(e) { console.error(e); }
                  }}
                  onUpdate={(id, u) => setHotels(p => p.map(h => h.id === id ? { ...h, ...u } : h))}
                  onAddBelow={async afterId => {
                    try {
                      const created = await createHotel({
                        name: lang === 'de' ? 'Neues Hotel' : 'New Hotel',
                        city: '', company: '',
                      });
                      setHotels(prev => {
                        const idx = prev.findIndex(h => h.id === afterId);
                        const next = [...prev];
                        next.splice(idx + 1, 0, { ...created, durations: [] });
                        return next;
                      });
                    } catch(e) { console.error(e); }
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
