// src/Dashboard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownAZ, ArrowUpAZ, ChevronDown, Download,
  Filter, Loader2, LogOut, Plus, RefreshCw, Search, SlidersHorizontal, X
} from 'lucide-react';
import {
  calcHotelFreeBeds, calcHotelTotalCost, cn,
  durationTouchesMonth, exportToCSV, formatCurrency,
  getDurationCostForMonth, hotelHasFreeOnDate,
  getFreeBedFilterDate, sumGroupCost
} from './lib/utils';
import {
  createHotel, deleteHotel, getHotels,
  signOut, syncOfflineQueue
} from './lib/supabase';
import { hasQueuedOps } from './lib/offlineQueue';
import { HotelRow } from './components/HotelRow';
import Sidebar from './components/Sidebar';

interface DashboardProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (lang: 'de' | 'en') => void;
}

type SortKey = 'name' | 'city' | 'company' | 'cost' | 'nights' | 'freeBeds';
type SortDir = 'asc' | 'desc';

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const dk = theme === 'dark';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [hotels, setHotels]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Month / year ──────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth());

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [sortKey,       setSortKey]       = useState<SortKey>('name');
  const [sortDir,       setSortDir]       = useState<SortDir>('asc');
  const [filterPaid,    setFilterPaid]    = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterFreeBed, setFilterFreeBed] = useState<'all' | 'now' | 'in3' | 'in7'>('all');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterCity,    setFilterCity]    = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await getHotels();
      setHotels(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  // ── Derived options ───────────────────────────────────────────────────────
  const companyOptions = useMemo(() =>
    [...new Set(hotels.map(h => h.company).filter(Boolean))].sort() as string[],
    [hotels]);

  const cityOptions = useMemo(() =>
    [...new Set(hotels.map(h => h.city).filter(Boolean))].sort() as string[],
    [hotels]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...hotels];

    // Month filter
    if (selectedMonth !== null) {
      list = list.filter(h =>
        (h.durations || []).some((d: any) => durationTouchesMonth(d, selectedYear, selectedMonth))
      );
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h =>
        h.name?.toLowerCase().includes(q) ||
        h.city?.toLowerCase().includes(q) ||
        h.company?.toLowerCase().includes(q) ||
        (h.durations || []).some((d: any) =>
          d.bookingId?.toLowerCase().includes(q) ||
          (d.employees || []).some((e: any) => e?.name?.toLowerCase().includes(q))
        )
      );
    }

    // Company filter
    if (filterCompany) {
      list = list.filter(h => h.company === filterCompany);
    }

    // City filter
    if (filterCity) {
      list = list.filter(h => h.city === filterCity);
    }

    // Paid filter
    if (filterPaid !== 'all') {
      list = list.filter(h =>
        (h.durations || []).some((d: any) =>
          filterPaid === 'paid' ? d.isPaid : !d.isPaid
        )
      );
    }

    // Free bed filter
    if (filterFreeBed !== 'all') {
      const targetDate = getFreeBedFilterDate(filterFreeBed as any);
      list = list.filter(h => hotelHasFreeOnDate(h, targetDate));
    }

    // Sort
    list.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'name':     av = a.name?.toLowerCase();   bv = b.name?.toLowerCase();   break;
        case 'city':     av = a.city?.toLowerCase();   bv = b.city?.toLowerCase();   break;
        case 'company':  av = a.company?.toLowerCase(); bv = b.company?.toLowerCase(); break;
        case 'cost':     av = calcHotelTotalCost(a);   bv = calcHotelTotalCost(b);   break;
        case 'nights':   av = a.durations?.reduce((s: number, d: any) => s + (d.numberOfRooms || 1), 0); bv = b.durations?.reduce((s: number, d: any) => s + (d.numberOfRooms || 1), 0); break;
        case 'freeBeds': av = calcHotelFreeBeds(a);    bv = calcHotelFreeBeds(b);    break;
        default:         av = ''; bv = '';
      }
      if (av === undefined || av === null) av = '';
      if (bv === undefined || bv === null) bv = '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [hotels, search, selectedYear, selectedMonth, filterCompany, filterCity, filterPaid, filterFreeBed, sortKey, sortDir]);

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalHotels = filtered.length;

  const totalFreeBeds = useMemo(() =>
    filtered.reduce((s, h) => s + calcHotelFreeBeds(h), 0),
    [filtered]);

  const totalCost = useMemo(() =>
    sumGroupCost(filtered, selectedYear, selectedMonth),
    [filtered, selectedYear, selectedMonth]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleAddHotel() {
    try {
      setCreating(true);
      const created = await createHotel({
        name: lang === 'de' ? 'Neues Hotel' : 'New Hotel',
        city: '', company: '',
      });
      setHotels(prev => [created, ...prev]);
    } catch (e) {
      console.error(e);
      alert(lang === 'de' ? 'Hotel konnte nicht erstellt werden' : 'Could not create hotel');
    } finally { setCreating(false); }
  }

  function handleUpdateHotel(id: string, updated: any) {
    setHotels(prev => prev.map(h => h.id === id ? { ...h, ...updated } : h));
  }

  async function handleDeleteHotel(id: string) {
    try {
      await deleteHotel(id);
      setHotels(prev => prev.filter(h => h.id !== id));
    } catch (e) { console.error(e); }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function clearFilters() {
    setSearch(''); setFilterCompany(''); setFilterCity('');
    setFilterPaid('all'); setFilterFreeBed('all');
    setSortKey('name'); setSortDir('asc');
  }

  const hasActiveFilters = search || filterCompany || filterCity ||
    filterPaid !== 'all' || filterFreeBed !== 'all';

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400'
  );

  const btnSecondary = cn(
    'px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap transition-all',
    dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
  );

  const pillCls = cn(
    'px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap',
    dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-700'
  );

  const activePillCls = 'bg-blue-600 text-white';

  const monthLabel = selectedMonth !== null
    ? (lang === 'de'
      ? ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][selectedMonth]
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][selectedMonth])
    + ` ${selectedYear}`
    : (lang === 'de' ? 'Alle Monate' : 'All months');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn('flex min-h-screen', dk ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900')}>

      {/* Sidebar */}
      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* ── SINGLE TOOLBAR ROW ───────────────────────────────────────────── */}
        <div className={cn(
          'sticky top-0 z-40 border-b px-4 py-2.5 flex items-center gap-2 flex-wrap',
          dk ? 'bg-[#020617]/95 border-white/10 backdrop-blur' : 'bg-white/95 border-slate-200 backdrop-blur'
        )}>

          {/* Summary pills */}
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border flex-shrink-0', dk ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
            <span className={cn('text-[10px] uppercase font-bold tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Hotels' : 'Hotels'}
            </span>
            <span className="text-sm font-black text-blue-400">{totalHotels}</span>
          </div>

          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border flex-shrink-0', dk ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
            <span className={cn('text-[10px] uppercase font-bold tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Frei' : 'Free'}
            </span>
            <span className={cn('text-sm font-black', totalFreeBeds > 0 ? 'text-amber-400' : 'text-green-400')}>{totalFreeBeds}</span>
          </div>

          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border flex-shrink-0', dk ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
            <span className={cn('text-[10px] uppercase font-bold tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Kosten' : 'Cost'}
            </span>
            <span className="text-sm font-black text-green-400">{formatCurrency(totalCost)}</span>
          </div>

          {/* Divider */}
          <div className={cn('w-px h-6 flex-shrink-0', dk ? 'bg-white/10' : 'bg-slate-200')} />

          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search size={13} className={cn('absolute left-2.5 top-1/2 -translate-y-1/2', dk ? 'text-slate-500' : 'text-slate-400')} />
            <input
              className={cn(inputCls, 'pl-8 w-48')}
              placeholder={lang === 'de' ? 'Suchen...' : 'Search...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter dropdown */}
          <div className="relative flex-shrink-0" ref={filterRef}>
            <button onClick={() => setFilterOpen(!filterOpen)}
              className={cn(btnSecondary, hasActiveFilters && 'border-blue-500 text-blue-400')}>
              <Filter size={13} />
              {lang === 'de' ? 'Filter' : 'Filter'}
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">!</span>
              )}
              <ChevronDown size={11} className={cn('transition-transform', filterOpen && 'rotate-180')} />
            </button>

            {filterOpen && (
              <div className={cn(
                'absolute top-full left-0 mt-1 w-72 rounded-xl border shadow-xl p-3 space-y-3 z-50',
                dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
              )}>
                {/* Company */}
                <div>
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest mb-1 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                    {lang === 'de' ? 'Firma' : 'Company'}
                  </label>
                  <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
                    className={cn(inputCls, 'w-full')}>
                    <option value="">{lang === 'de' ? 'Alle' : 'All'}</option>
                    {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest mb-1 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                    {lang === 'de' ? 'Stadt' : 'City'}
                  </label>
                  <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                    className={cn(inputCls, 'w-full')}>
                    <option value="">{lang === 'de' ? 'Alle' : 'All'}</option>
                    {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Paid status */}
                <div>
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest mb-1 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                    {lang === 'de' ? 'Zahlungsstatus' : 'Payment'}
                  </label>
                  <div className="flex gap-1">
                    {(['all', 'paid', 'unpaid'] as const).map(v => (
                      <button key={v} onClick={() => setFilterPaid(v)}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                          filterPaid === v ? activePillCls : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                        {v === 'all' ? (lang === 'de' ? 'Alle' : 'All') : v === 'paid' ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Ausstehend' : 'Unpaid')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Free beds */}
                <div>
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest mb-1 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                    {lang === 'de' ? 'Freie Betten' : 'Free beds'}
                  </label>
                  <div className="flex gap-1">
                    {(['all', 'now', 'in3', 'in7'] as const).map(v => (
                      <button key={v} onClick={() => setFilterFreeBed(v)}
                        className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                          filterFreeBed === v ? activePillCls : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                        {v === 'all' ? (lang === 'de' ? 'Alle' : 'All') : v === 'now' ? (lang === 'de' ? 'Jetzt' : 'Now') : v === 'in3' ? '+3d' : '+7d'}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button onClick={clearFilters}
                    className="w-full py-2 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 text-xs font-bold">
                    {lang === 'de' ? 'Filter zurücksetzen' : 'Clear all filters'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={sortKey}
              onChange={e => { setSortKey(e.target.value as SortKey); setSortDir('asc'); }}
              className={cn(inputCls, 'appearance-none pr-8 cursor-pointer')}>
              <option value="name">{lang === 'de' ? 'Name' : 'Name'}</option>
              <option value="city">{lang === 'de' ? 'Stadt' : 'City'}</option>
              <option value="company">{lang === 'de' ? 'Firma' : 'Company'}</option>
              <option value="cost">{lang === 'de' ? 'Kosten' : 'Cost'}</option>
              <option value="freeBeds">{lang === 'de' ? 'Freie Betten' : 'Free beds'}</option>
            </select>
            <button
              onClick={() => setSortDir(p => p === 'asc' ? 'desc' : 'asc')}
              className={cn('absolute right-2 top-1/2 -translate-y-1/2', dk ? 'text-slate-400' : 'text-slate-500')}>
              {sortDir === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpAZ size={13} />}
            </button>
          </div>

          {/* Divider */}
          <div className={cn('w-px h-6 flex-shrink-0', dk ? 'bg-white/10' : 'bg-slate-200')} />

          {/* Month selector pill */}
          <div className={cn('flex items-center gap-1 flex-shrink-0')}>
            <button onClick={() => {
              if (selectedMonth === null) { setSelectedMonth(11); }
              else if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
              else setSelectedMonth(m => m! - 1);
            }} className={cn('p-1.5 rounded-lg', dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
              ‹
            </button>
            <button onClick={() => setSelectedMonth(null)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border',
                selectedMonth === null
                  ? 'bg-blue-600 text-white border-blue-600'
                  : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
              {monthLabel}
            </button>
            <button onClick={() => {
              if (selectedMonth === null) { setSelectedMonth(0); }
              else if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
              else setSelectedMonth(m => m! + 1);
            }} className={cn('p-1.5 rounded-lg', dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
              ›
            </button>
          </div>

          {/* Divider */}
          <div className={cn('w-px h-6 flex-shrink-0', dk ? 'bg-white/10' : 'bg-slate-200')} />

          {/* Export */}
          <button onClick={() => exportToCSV(filtered)}
            className={cn(btnSecondary, 'flex-shrink-0')}>
            <Download size={13} />
            {lang === 'de' ? 'Export' : 'Export'}
          </button>

          {/* Sync */}
          {hasQueuedOps() && (
            <button onClick={() => syncOfflineQueue().then(() => load(true))}
              className={cn(btnSecondary, 'flex-shrink-0 border-amber-500 text-amber-400 hover:bg-amber-500/10')}>
              <RefreshCw size={13} />
              {lang === 'de' ? 'Sync' : 'Sync'}
            </button>
          )}

          {/* Add hotel — rightmost */}
          <button onClick={handleAddHotel} disabled={creating}
            className="ml-auto flex-shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all">
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {lang === 'de' ? 'Hotel' : 'Hotel'}
          </button>

          {/* Theme + lang + logout in header far right */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={toggleTheme}
              className={cn('p-2 rounded-lg text-xs font-bold', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-600')}>
              {dk ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border', dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
              {lang === 'de' ? 'EN' : 'DE'}
            </button>
            <button onClick={() => signOut().catch(console.error)}
              className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400 hover:text-red-400' : 'hover:bg-slate-100 text-slate-500 hover:text-red-500')}>
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* ── Hotel list ─────────────────────────────────────────────────── */}
        <div className="flex-1 p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className={cn('text-2xl font-black mb-2', dk ? 'text-slate-600' : 'text-slate-300')}>
                {hasActiveFilters
                  ? (lang === 'de' ? 'Keine Treffer' : 'No matches')
                  : (lang === 'de' ? 'Noch kein Hotel' : 'No hotels yet')}
              </p>
              <p className={cn('text-sm mb-4', dk ? 'text-slate-600' : 'text-slate-400')}>
                {hasActiveFilters
                  ? (lang === 'de' ? 'Filter anpassen oder zurücksetzen' : 'Adjust or clear your filters')
                  : (lang === 'de' ? 'Klicke "+ Hotel" um zu starten' : 'Click "+ Hotel" to get started')}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">
                  {lang === 'de' ? 'Filter zurücksetzen' : 'Clear filters'}
                </button>
              )}
            </div>
          ) : (
            filtered.map(hotel => (
              <HotelRow
                key={hotel.id}
                entry={hotel}
                isDarkMode={dk}
                lang={lang}
                companyOptions={companyOptions}
                cityOptions={cityOptions}
                onDelete={handleDeleteHotel}
                onUpdate={handleUpdateHotel}
                onAddBelow={async (afterId) => {
                  try {
                    const created = await createHotel({
                      name: lang === 'de' ? 'Neues Hotel' : 'New Hotel',
                      city: '', company: '',
                    });
                    setHotels(prev => {
                      const idx = prev.findIndex(h => h.id === afterId);
                      const next = [...prev];
                      next.splice(idx + 1, 0, created);
                      return next;
                    });
                  } catch (e) { console.error(e); }
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
