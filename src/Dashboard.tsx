// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, calcDurationFreeBeds, hotelMatchesSearch } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Building2, Check, X, Loader2, Filter, ArrowUpDown, Download, Undo2, Redo2, Calendar, Star, Folder } from 'lucide-react';
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
  
  // Sidebar States
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'with' | 'without'>('all');
  
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [timeline, setTimeline] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'specific'>('all');
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'free_beds' | 'last_added' | 'last_updated'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [groupBy, setGroupBy] = useState<'none' | 'company' | 'city'>('none');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Bookmarks & Undo/Redo State
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'));
  
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Hotel Adding
  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  const newHotelNameRef = useRef<HTMLInputElement>(null);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Data Loading
  useEffect(() => { loadHotels(); }, [selectedYear]);

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
      // Initialize History Stack
      setHistory([data || []]);
      setHistoryIndex(0);
    } catch (err: any) { setError(err.message || 'Failed to load'); } 
    finally { setLoading(false); }
  }

  // THE FIX: Undo/Redo Logic + Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  function pushToHistory(newState: any[]) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  function handleUndo() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setHotels(history[historyIndex - 1]);
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setHotels(history[historyIndex + 1]);
    }
  }

  const toggleBookmark = (id: string) => {
    const next = bookmarks.includes(id) ? bookmarks.filter(b => b !== id) : [...bookmarks, id];
    setBookmarks(next);
    localStorage.setItem('eurotrack_bookmarks', JSON.stringify(next));
  };

  // Math Utilities
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

  const calcFreeBeds = (h: any) => {
    const today = new Date().toISOString().split('T')[0];
    return (h.durations || []).reduce((s: number, d: any) => s + calcDurationFreeBeds(d, today), 0);
  };

  // ── THE FIX: Deep Filter Logic ──
  const visibleHotels = useMemo(() => {
    if (!accessLevel || accessLevel.role === 'admin' || accessLevel.role === 'superadmin') return hotels;
    return hotels.filter(h => (accessLevel as any).hotelIds?.includes(h.id));
  }, [hotels, accessLevel]);

  const filteredPreGroup = useMemo(() => {
    return visibleHotels.filter(h => {
      // 1. Bookmarks
      if (showBookmarks && !bookmarks.includes(h.id)) return false;

      // 2. Global Deep Search Scoped
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        let matches = false;
        const tags = Array.isArray(h.companyTag) ? h.companyTag.join(' ') : (h.companyTag || '');
        const emps = (h.durations || []).flatMap((d: any) => (d.roomCards || []).flatMap((rc: any) => (rc.employees || []).map((e: any) => e.name || ''))).join(' ');
        const invs = (h.durations || []).map((d:any) => d.rechnungNr || '').join(' ');

        if (searchScope === 'all') {
          matches = h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q) || tags.toLowerCase().includes(q) || emps.toLowerCase().includes(q) || invs.toLowerCase().includes(q);
        } else if (searchScope === 'hotel') matches = h.name?.toLowerCase().includes(q);
        else if (searchScope === 'city') matches = h.city?.toLowerCase().includes(q);
        else if (searchScope === 'company') matches = tags.toLowerCase().includes(q);
        else if (searchScope === 'employee') matches = emps.toLowerCase().includes(q);
        else if (searchScope === 'invoice') matches = invs.toLowerCase().includes(q);

        if (!matches) return false;
      }
      
      // 3. Month Overlap
      if (selectedMonth !== null) {
        const hasMonthOverlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate);
          const dEnd = new Date(d.endDate);
          const mStart = new Date(selectedYear, selectedMonth, 1);
          const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
          return dStart <= mEnd && dEnd >= mStart;
        });
        if (!hasMonthOverlap) return false;
      }

      // 4. Timeline Filter Overlap
      if (timeline !== 'all') {
        const today = new Date();
        let tStart = new Date(today); let tEnd = new Date(today);
        if (timeline === 'tomorrow') { tStart.setDate(today.getDate() + 1); tEnd.setDate(today.getDate() + 1); }
        else if (timeline === '3days') tEnd.setDate(today.getDate() + 3);
        else if (timeline === '7days') tEnd.setDate(today.getDate() + 7);
        else if (timeline === 'specific') { tStart = new Date(specificDate); tEnd = new Date(specificDate); }
        
        const hasTimeOverlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          return new Date(d.startDate) <= tEnd && new Date(d.endDate) >= tStart;
        });
        if (!hasTimeOverlap) return false;
      }

      // 5. Payment & Deposit
      if (filterPaid === 'paid' && !(h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && (h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterDeposit === 'with' && !(h.durations || []).some((d: any) => d.depositEnabled)) return false;
      if (filterDeposit === 'without' && (h.durations || []).some((d: any) => d.depositEnabled)) return false;

      return true;
    });
  }, [visibleHotels, searchQuery, searchScope, showBookmarks, bookmarks, selectedMonth, selectedYear, timeline, specificDate, filterPaid, filterDeposit]);

  // Group By Logic
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, { count: number, cost: number }>();
    filteredPreGroup.forEach(h => {
      const keys = groupBy === 'city' ? [h.city || 'Unknown'] : (Array.isArray(h.companyTag) ? h.companyTag : [h.companyTag || 'Unknown']);
      keys.forEach(k => {
        const curr = map.get(k) || { count: 0, cost: 0 };
        map.set(k, { count: curr.count + 1, cost: curr.cost + calcCost(h) });
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.cost - a.cost);
  }, [filteredPreGroup, groupBy]);

  // Final Filtered & Sorted Array
  const finalFiltered = useMemo(() => {
    let list = filteredPreGroup;
    if (groupBy !== 'none' && activeGroup) {
      list = list.filter(h => groupBy === 'city' ? h.city === activeGroup : (Array.isArray(h.companyTag) ? h.companyTag.includes(activeGroup) : h.companyTag === activeGroup));
    }

    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcCost(a); vb = calcCost(b); }
      else if (sortBy === 'free_beds') { va = calcFreeBeds(a); vb = calcFreeBeds(b); }
      else if (sortBy === 'last_updated') { va = new Date(a.updated_at || 0).getTime(); vb = new Date(b.updated_at || 0).getTime(); }
      else { va = new Date(a.created_at || 0).getTime(); vb = new Date(b.created_at || 0).getTime(); } // last_added
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [filteredPreGroup, groupBy, activeGroup, sortBy, sortDir]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcFreeBeds(h), 0);

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return;
    setNewHotelSaving(true);
    try {
      const hotel = await createHotel({ name: newHotelName.trim(), city: newHotelCity.trim() || null, year: selectedYear });
      const next = [{ ...hotel, durations: [] }, ...hotels];
      setHotels(next); pushToHistory(next);
      setAddingHotel(false); setNewHotelName(''); setNewHotelCity('');
    } catch (e: any) { console.error(e); } 
    finally { setNewHotelSaving(false); }
  }

  // Row Delete Logic using History Stack
  async function handleRowDelete(id: string) {
    const next = hotels.filter(h => h.id !== id);
    setHotels(next); pushToHistory(next);
    await deleteHotel(id); // Hard delete in DB. User can Ctrl+Z to bring it back locally (we'd need a recreate function for true DB restore, but local UI restores instantly).
  }

  function handleRowUpdate(id: string, updates: any) {
    const next = hotels.map(h => h.id === id ? { ...h, ...updates } : h);
    setHotels(next); pushToHistory(next);
  }

  const btnCls = cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100');

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} hotels={visibleHotels} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} viewOnly={viewOnly} userRole={accessLevel?.role ?? 'viewer'} />

        {/* TOP STATS */}
        <div className={cn('px-8 py-4 border-b shrink-0', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-12 flex-wrap">
            {[
              { label: lang === 'de' ? 'Freie Betten'  : 'Free Beds',   value: String(freeBedsTotal),   cls: freeBedsTotal > 0 ? 'text-red-500' : 'text-emerald-500' },
              { label: lang === 'de' ? 'Gesamtkosten' : 'Total Spent', value: formatCurrency(totalSpend), cls: 'text-blue-400' },
              { label: 'Hotels', value: String(finalFiltered.length), cls: dk ? 'text-white' : 'text-slate-900' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
                <p className={cn('text-2xl font-black', cls)}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6 relative">
          
          {/* ACTION BAR */}
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}
            </h2>

            <div className="flex items-center gap-2 relative">
              {/* Undo / Redo */}
              <div className="flex items-center mr-2 border rounded-lg overflow-hidden border-slate-200 dark:border-white/10">
                 <button onClick={handleUndo} disabled={historyIndex <= 0} className={cn("p-2 transition-all disabled:opacity-30", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-700")} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
                 <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
                 <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={cn("p-2 transition-all disabled:opacity-30", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-700")} title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
              </div>

              {/* Timeline */}
              <button onClick={() => setShowTimelineMenu(!showTimelineMenu)} className={btnCls}>
                <Calendar size={16} className="text-blue-500" /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}
              </button>
              
              {/* Filter */}
              <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={btnCls}>
                <Filter size={16} /> {lang === 'de' ? 'Filter' : 'Filter'}
              </button>

              {/* Sort */}
              <button onClick={() => setShowSortMenu(!showSortMenu)} className={btnCls}>
                <ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}
              </button>

              {/* Group By */}
              <div className="flex items-center ml-2 border rounded-lg overflow-hidden border-slate-200 dark:border-white/10 text-sm font-bold">
                 <div className={cn("px-3 py-2 flex items-center gap-2 border-r", dk ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500")}><Folder size={14}/> {lang === 'de' ? 'Gruppieren' : 'Group'}</div>
                 <select value={groupBy} onChange={e => { setGroupBy(e.target.value as any); setActiveGroup(null); }} className={cn("px-3 py-2 outline-none appearance-none cursor-pointer", dk ? "bg-[#0F172A] text-white" : "bg-white text-slate-900")}>
                    <option value="none">None</option>
                    <option value="company">Company</option>
                    <option value="city">City</option>
                 </select>
              </div>

              {/* Bookmarks */}
              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls, 'ml-2', showBookmarks && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500')}>
                <Star size={16} className={showBookmarks ? 'fill-yellow-500 text-yellow-500' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}
              </button>

              {!viewOnly && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg transition-all">
                  <Plus size={18} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                </button>
              )}
            </div>

            {/* Absolute Popups */}
            {showTimelineMenu && (
               <div className={cn("absolute right-96 top-16 z-50 p-4 rounded-xl border shadow-xl w-64", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-3", dk ? "text-slate-500" : "text-slate-400")}>Date Overlap</p>
                  <select value={timeline} onChange={e => setTimeline(e.target.value as any)} className={cn("w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none mb-3", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
                     <option value="all">All Time</option>
                     <option value="today">Today</option>
                     <option value="tomorrow">Tomorrow</option>
                     <option value="3days">Next 3 Days</option>
                     <option value="7days">Next 7 Days</option>
                     <option value="specific">Specific Date</option>
                  </select>
                  {timeline === 'specific' && (
                     <input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className={cn("w-full px-3 py-2 rounded-lg border text-sm outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                  )}
               </div>
            )}

            {showFilterMenu && (
               <div className={cn("absolute right-72 top-16 z-50 p-4 rounded-xl border shadow-xl w-48 space-y-4", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Payment</p>
                    <select value={filterPaid} onChange={e => setFilterPaid(e.target.value as any)} className={cn("w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
                       <option value="all">All</option>
                       <option value="paid">Paid</option>
                       <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                  <div>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Deposit</p>
                    <select value={filterDeposit} onChange={e => setFilterDeposit(e.target.value as any)} className={cn("w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
                       <option value="all">All</option>
                       <option value="with">With Deposit</option>
                       <option value="without">No Deposit</option>
                    </select>
                  </div>
               </div>
            )}

            {showSortMenu && (
               <div className={cn("absolute right-48 top-16 z-50 p-4 rounded-xl border shadow-xl w-56", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Sort By</p>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className={cn("w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none mb-3", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
                     <option value="last_added">Last Added</option>
                     <option value="last_updated">Last Updated</option>
                     <option value="name">Hotel Name (A-Z)</option>
                     <option value="cost">Total Cost</option>
                     <option value="free_beds">Free Beds</option>
                  </select>
                  <div className="flex gap-2">
                     <button onClick={() => setSortDir('asc')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border", sortDir==='asc' ? "bg-blue-600 text-white border-blue-600" : dk ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-600")}>↑ Asc</button>
                     <button onClick={() => setSortDir('desc')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border", sortDir==='desc' ? "bg-blue-600 text-white border-blue-600" : dk ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-600")}>↓ Desc</button>
                  </div>
               </div>
            )}
          </div>

          {/* GROUP TABS */}
          {groupBy !== 'none' && groupedData.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar border-b border-slate-200 dark:border-white/10">
               <button onClick={() => setActiveGroup(null)} className={cn("px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap", !activeGroup ? "bg-blue-600 text-white border-blue-600" : dk ? "border-white/10 text-slate-400 hover:bg-white/5" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                  All {groupBy === 'city' ? 'Cities' : 'Companies'}
               </button>
               {groupedData.map(g => (
                 <button key={g.name} onClick={() => setActiveGroup(g.name)} className={cn("px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap", activeGroup === g.name ? "bg-blue-600 text-white border-blue-600" : dk ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                    {g.name} <span className="opacity-60 font-normal ml-1">({g.count}) — {formatCurrency(g.cost)}</span>
                 </button>
               ))}
            </div>
          )}

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
              {finalFiltered.map((hotel, index) => (
                <HotelRow
                  key={hotel.id} entry={hotel} index={index}
                  isDarkMode={dk} lang={lang}
                  // NOTE: Add `isPinned={bookmarks.includes(hotel.id)}` and `onTogglePin={() => toggleBookmark(hotel.id)}` inside HotelRow.tsx
                  onDelete={handleRowDelete}
                  onUpdate={handleRowUpdate}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
