// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { 
  cn, formatCurrency, calcDurationFreeBeds, hotelMatchesSearch, 
  exportToCSV, printDocument 
} from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { 
  Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, Star, Calendar, RefreshCw
} from 'lucide-react';
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
  
  // ── Sidebar & Basic States ──
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // ── Search States ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  
  // ── Auto-Close Menu States ──
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── Filter States (Modern Pill UI) ──
  // 1. Free Beds Capacity
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [fbStartDate, setFbStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [fbEndDate, setFbEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 2. Payment & Deposit
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'with' | 'without'>('all');
  
  // 3. Group By
  const [groupBy, setGroupBy] = useState<'none' | 'company' | 'city'>('none');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // ── Timeline Overlap States ──
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStartDate, setTlStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [tlEndDate, setTlEndDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Sort States ──
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'free_beds' | 'last_added' | 'last_updated'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Bookmarks & Undo/Redo State ──
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'));
  
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ── Hotel Adding ──
  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  const newHotelNameRef = useRef<HTMLInputElement>(null);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Menu Toggles (Ensures only one is open) ──
  const toggleMenu = (menu: 'filter' | 'timeline' | 'sort') => {
    setShowFilterMenu(menu === 'filter' ? !showFilterMenu : false);
    setShowTimelineMenu(menu === 'timeline' ? !showTimelineMenu : false);
    setShowSortMenu(menu === 'sort' ? !showSortMenu : false);
  };

  // ── Data Fetching ──
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
      setHistory([data || []]);
      setHistoryIndex(0);
    } catch (err: any) { setError(err.message || 'Failed to load'); } 
    finally { setLoading(false); }
  }

  // ── Undo / Redo Keyboard Shortcuts ──
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
  function handleUndo() { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setHotels(history[historyIndex - 1]); } }
  function handleRedo() { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setHotels(history[historyIndex + 1]); } }

  const toggleBookmark = (id: string) => {
    const next = bookmarks.includes(id) ? bookmarks.filter(b => b !== id) : [...bookmarks, id];
    setBookmarks(next);
    localStorage.setItem('eurotrack_bookmarks', JSON.stringify(next));
  };

  // ── Math Utils ──
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

  const getFreeBedsForDate = (h: any, dateIso: string) => {
    return (h.durations || []).reduce((s: number, d: any) => s + calcDurationFreeBeds(d, dateIso), 0);
  };
  const calcFreeBedsToday = (h: any) => getFreeBedsForDate(h, new Date().toISOString().split('T')[0]);

  // ── THE ENGINE: Deep Filter & Search Logic ──
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

        if (searchScope === 'all') matches = h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q) || tags.toLowerCase().includes(q) || emps.toLowerCase().includes(q) || invs.toLowerCase().includes(q);
        else if (searchScope === 'hotel') matches = h.name?.toLowerCase().includes(q);
        else if (searchScope === 'city') matches = h.city?.toLowerCase().includes(q);
        else if (searchScope === 'company') matches = tags.toLowerCase().includes(q);
        else if (searchScope === 'employee') matches = emps.toLowerCase().includes(q);
        else if (searchScope === 'invoice') matches = invs.toLowerCase().includes(q);

        if (!matches) return false;
      }
      
      // 3. Month Overlap (Sidebar constraint)
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

      // 4. Timeline (Booking Overlap)
      if (tlType !== 'all') {
        const today = new Date();
        let tStart = new Date(today); let tEnd = new Date(today);
        if (tlType === 'tomorrow') { tStart.setDate(today.getDate() + 1); tEnd.setDate(today.getDate() + 1); }
        else if (tlType === '3days') tEnd.setDate(today.getDate() + 3);
        else if (tlType === '7days') tEnd.setDate(today.getDate() + 7);
        else if (tlType === 'range') { tStart = new Date(tlStartDate); tEnd = new Date(tlEndDate); }
        
        const hasTimeOverlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          return new Date(d.startDate) <= tEnd && new Date(d.endDate) >= tStart;
        });
        if (!hasTimeOverlap) return false;
      }

      // 5. Free Beds Capacity Filter
      if (fbType !== 'all') {
        let targetDate = new Date();
        if (fbType === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
        else if (fbType === '3days') targetDate.setDate(targetDate.getDate() + 3);
        else if (fbType === '7days') targetDate.setDate(targetDate.getDate() + 7);
        else if (fbType === 'range') targetDate = new Date(fbStartDate); // MVP logic: Checks start date of range
        
        const targetIso = targetDate.toISOString().split('T')[0];
        if (getFreeBedsForDate(h, targetIso) <= 0) return false;
      }

      // 6. Payment & Deposit
      if (filterPaid === 'paid' && !(h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && (h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterDeposit === 'with' && !(h.durations || []).some((d: any) => d.depositEnabled)) return false;
      if (filterDeposit === 'without' && (h.durations || []).some((d: any) => d.depositEnabled)) return false;

      return true;
    });
  }, [visibleHotels, searchQuery, searchScope, showBookmarks, bookmarks, selectedMonth, selectedYear, tlType, tlStartDate, tlEndDate, fbType, fbStartDate, filterPaid, filterDeposit]);

  // ── Group By Logic ──
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, { count: number, cost: number }>();
    filteredPreGroup.forEach(h => {
      const keys = groupBy === 'city' ? [h.city || 'Unknown'] : (Array.isArray(h.companyTag) && h.companyTag.length > 0 ? h.companyTag : [h.companyTag || 'Unknown']);
      keys.forEach(k => {
        const curr = map.get(k) || { count: 0, cost: 0 };
        map.set(k, { count: curr.count + 1, cost: curr.cost + calcCost(h) });
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.cost - a.cost);
  }, [filteredPreGroup, groupBy]);

  // ── Final Filtered & Sorted Array ──
  const finalFiltered = useMemo(() => {
    let list = filteredPreGroup;
    if (groupBy !== 'none' && activeGroup) {
      list = list.filter(h => groupBy === 'city' ? h.city === activeGroup : (Array.isArray(h.companyTag) ? h.companyTag.includes(activeGroup) : h.companyTag === activeGroup));
    }

    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcCost(a); vb = calcCost(b); }
      else if (sortBy === 'free_beds') { va = calcFreeBedsToday(a); vb = calcFreeBedsToday(b); }
      else if (sortBy === 'last_updated') { va = new Date(a.updated_at || 0).getTime(); vb = new Date(b.updated_at || 0).getTime(); }
      else { va = new Date(a.created_at || 0).getTime(); vb = new Date(b.created_at || 0).getTime(); } // last_added
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [filteredPreGroup, groupBy, activeGroup, sortBy, sortDir]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcFreeBedsToday(h), 0);

  // ── Export / Print Helpers ──
  const generateReportTitle = () => {
    let parts = [];
    if (selectedMonth !== null) parts.push(`${monthNames[selectedMonth]} ${selectedYear}`);
    else parts.push(`Year ${selectedYear}`);
    
    if (filterPaid === 'paid') parts.push('Paid Only');
    if (filterPaid === 'unpaid') parts.push('Unpaid Only');
    if (filterDeposit === 'with') parts.push('With Deposit');
    if (activeGroup) parts.push(`Group: ${activeGroup}`);
    
    return `Dashboard Report: ${parts.join(' | ')}`;
  };

  const handleExportCsv = () => exportToCSV(finalFiltered, calcCost, totalSpend, generateReportTitle(), lang);
  const handlePrint = () => printDocument(finalFiltered, calcCost, totalSpend, generateReportTitle(), lang);

  // ── Handlers ──
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

  async function handleRowDelete(id: string) {
    const next = hotels.filter(h => h.id !== id);
    setHotels(next); pushToHistory(next);
    await deleteHotel(id);
  }

  function handleRowUpdate(id: string, updates: any) {
    const next = hotels.map(h => h.id === id ? { ...h, ...updates } : h);
    setHotels(next); pushToHistory(next);
  }

  // ── UI Components ──
  const btnCls = cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100');
  const Pill = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
    <button onClick={onClick} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap', 
      active ? 'bg-blue-600 text-white shadow-md' : dk ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    )}>
      {children}
    </button>
  );

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} hotels={visibleHotels} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Pass export/print to Header */}
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={handleExportCsv} onPrint={handlePrint} viewOnly={viewOnly} userRole={accessLevel?.role ?? 'viewer'} />

        <div className={cn('px-8 py-4 border-b shrink-0', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-12 flex-wrap">
            {[
              { label: lang === 'de' ? 'Freie Betten Heute' : 'Free Beds Today', value: String(freeBedsTotal), cls: freeBedsTotal > 0 ? 'text-red-500' : 'text-emerald-500' },
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
          
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}
            </h2>

            <div className="flex items-center gap-2 relative">
              <div className="flex items-center mr-2 border rounded-lg overflow-hidden border-slate-200 dark:border-white/10">
                 <button onClick={handleUndo} disabled={historyIndex <= 0} className={cn("p-2 transition-all disabled:opacity-30", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-700")} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
                 <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
                 <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={cn("p-2 transition-all disabled:opacity-30", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-700")} title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
              </div>

              {/* ACTION BUTTONS */}
              <button onClick={() => toggleMenu('timeline')} className={cn(btnCls, tlType !== 'all' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : '')}>
                <Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}
              </button>
              
              <button onClick={() => toggleMenu('filter')} className={cn(btnCls, (fbType !== 'all' || filterPaid !== 'all' || filterDeposit !== 'all' || groupBy !== 'none') ? 'border-blue-500 text-blue-500 bg-blue-500/10' : '')}>
                <Filter size={16} /> {lang === 'de' ? 'Filter' : 'Filter'}
              </button>

              <button onClick={() => toggleMenu('sort')} className={btnCls}>
                <ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}
              </button>

              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls, 'ml-2', showBookmarks && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500')}>
                <Star size={16} className={showBookmarks ? 'fill-yellow-500 text-yellow-500' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}
              </button>

              {!viewOnly && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg transition-all">
                  <Plus size={18} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                </button>
              )}
            </div>

            {/* POPUP: TIMELINE OVERLAP */}
            {showTimelineMenu && (
               <div className={cn("absolute right-[400px] top-16 z-50 p-5 rounded-xl border shadow-xl w-[340px]", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-white/10">
                     <p className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>Booking Timeline</p>
                     <button onClick={() => setShowTimelineMenu(false)} className={cn("p-1 rounded-md", dk ? "hover:bg-white/10" : "hover:bg-slate-100")}><X size={14}/></button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                     <Pill active={tlType === 'all'} onClick={() => setTlType('all')}>All Time</Pill>
                     <Pill active={tlType === 'today'} onClick={() => setTlType('today')}>Today</Pill>
                     <Pill active={tlType === 'tomorrow'} onClick={() => setTlType('tomorrow')}>Tomorrow</Pill>
                     <Pill active={tlType === '3days'} onClick={() => setTlType('3days')}>In 3 Days</Pill>
                     <Pill active={tlType === '7days'} onClick={() => setTlType('7days')}>In 7 Days</Pill>
                     <Pill active={tlType === 'range'} onClick={() => setTlType('range')}>Custom Range</Pill>
                  </div>

                  {tlType === 'range' && (
                     <div className="flex items-center gap-2 mb-4">
                        <input type="date" value={tlStartDate} onChange={e => setTlStartDate(e.target.value)} className={cn("flex-1 px-3 py-2 rounded-lg border text-xs outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                        <span className="text-slate-400">➔</span>
                        <input type="date" value={tlEndDate} onChange={e => setTlEndDate(e.target.value)} className={cn("flex-1 px-3 py-2 rounded-lg border text-xs outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                     </div>
                  )}

                  <button onClick={() => { setTlType('all'); setShowTimelineMenu(false); }} className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all">
                     <RefreshCw size={12} /> Clear Dates
                  </button>
               </div>
            )}

            {/* POPUP: FILTERS & GROUPING */}
            {showFilterMenu && (
               <div className={cn("absolute right-72 top-16 z-50 p-5 rounded-xl border shadow-xl w-[360px] space-y-5", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/10">
                     <p className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>Filters & Grouping</p>
                     <button onClick={() => setShowFilterMenu(false)} className={cn("p-1 rounded-md", dk ? "hover:bg-white/10" : "hover:bg-slate-100")}><X size={14}/></button>
                  </div>

                  <div>
                     <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Free Beds Capacity</p>
                     <div className="flex flex-wrap gap-2">
                        <Pill active={fbType === 'all'} onClick={() => setFbType('all')}>All</Pill>
                        <Pill active={fbType === 'today'} onClick={() => setFbType('today')}>Today</Pill>
                        <Pill active={fbType === 'tomorrow'} onClick={() => setFbType('tomorrow')}>Tomorrow</Pill>
                        <Pill active={fbType === '3days'} onClick={() => setFbType('3days')}>In 3 Days</Pill>
                        <Pill active={fbType === '7days'} onClick={() => setFbType('7days')}>In 7 Days</Pill>
                        <Pill active={fbType === 'range'} onClick={() => setFbType('range')}>Custom Range</Pill>
                     </div>
                     {fbType === 'range' && (
                        <div className="flex items-center gap-2 mt-3">
                           <input type="date" value={fbStartDate} onChange={e => setFbStartDate(e.target.value)} className={cn("flex-1 px-3 py-2 rounded-lg border text-xs outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                           <span className="text-slate-400">➔</span>
                           <input type="date" value={fbEndDate} onChange={e => setFbEndDate(e.target.value)} className={cn("flex-1 px-3 py-2 rounded-lg border text-xs outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                        </div>
                     )}
                  </div>

                  <div className="flex gap-4">
                     <div className="flex-1">
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Payment</p>
                        <div className="flex flex-wrap gap-2">
                           <Pill active={filterPaid === 'all'} onClick={() => setFilterPaid('all')}>All</Pill>
                           <Pill active={filterPaid === 'paid'} onClick={() => setFilterPaid('paid')}>Paid</Pill>
                           <Pill active={filterPaid === 'unpaid'} onClick={() => setFilterPaid('unpaid')}>Unpaid</Pill>
                        </div>
                     </div>
                     <div className="flex-1">
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Deposit</p>
                        <div className="flex flex-wrap gap-2">
                           <Pill active={filterDeposit === 'all'} onClick={() => setFilterDeposit('all')}>All</Pill>
                           <Pill active={filterDeposit === 'with'} onClick={() => setFilterDeposit('with')}>Yes</Pill>
                           <Pill active={filterDeposit === 'without'} onClick={() => setFilterDeposit('without')}>No</Pill>
                        </div>
                     </div>
                  </div>

                  <div>
                     <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>Group By (Tabs)</p>
                     <div className="flex gap-2">
                        <Pill active={groupBy === 'none'} onClick={() => { setGroupBy('none'); setActiveGroup(null); }}>None</Pill>
                        <Pill active={groupBy === 'company'} onClick={() => { setGroupBy('company'); setActiveGroup(null); }}>Company</Pill>
                        <Pill active={groupBy === 'city'} onClick={() => { setGroupBy('city'); setActiveGroup(null); }}>City</Pill>
                     </div>
                  </div>

                  <button onClick={() => { setFbType('all'); setFilterPaid('all'); setFilterDeposit('all'); setGroupBy('none'); setShowFilterMenu(false); }} className="w-full pt-3 mt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all">
                     <RefreshCw size={12} /> Clear Filters
                  </button>
               </div>
            )}

            {/* POPUP: SORTING */}
            {showSortMenu && (
               <div className={cn("absolute right-48 top-16 z-50 p-5 rounded-xl border shadow-xl w-[260px]", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-white/10">
                     <p className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>Sort Dashboard</p>
                     <button onClick={() => setShowSortMenu(false)} className={cn("p-1 rounded-md", dk ? "hover:bg-white/10" : "hover:bg-slate-100")}><X size={14}/></button>
                  </div>
                  
                  <div className="flex gap-2 mb-4">
                     <button onClick={() => setSortDir('asc')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all", sortDir==='asc' ? "bg-blue-600 text-white border-blue-600 shadow-md" : dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900")}>↑ Ascending</button>
                     <button onClick={() => setSortDir('desc')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all", sortDir==='desc' ? "bg-blue-600 text-white border-blue-600 shadow-md" : dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900")}>↓ Descending</button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <Pill active={sortBy === 'last_added'} onClick={() => setSortBy('last_added')}>Last Added</Pill>
                     <Pill active={sortBy === 'last_updated'} onClick={() => setSortBy('last_updated')}>Last Updated</Pill>
                     <Pill active={sortBy === 'name'} onClick={() => setSortBy('name')}>Hotel Name (A-Z)</Pill>
                     <Pill active={sortBy === 'cost'} onClick={() => setSortBy('cost')}>Total Cost</Pill>
                     <Pill active={sortBy === 'free_beds'} onClick={() => setSortBy('free_beds')}>Free Beds</Pill>
                  </div>
               </div>
            )}
          </div>

          {/* GROUP TABS */}
          {groupBy !== 'none' && groupedData.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar border-b border-slate-200 dark:border-white/10">
               <button onClick={() => setActiveGroup(null)} className={cn("px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap", !activeGroup ? "bg-blue-600 text-white shadow-md border-blue-600" : dk ? "border-white/10 text-slate-400 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>
                  All {groupBy === 'city' ? 'Cities' : 'Companies'}
               </button>
               {groupedData.map(g => (
                 <button key={g.name} onClick={() => setActiveGroup(g.name)} className={cn("px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap", activeGroup === g.name ? "bg-blue-600 text-white shadow-md border-blue-600" : dk ? "border-white/10 text-slate-300 hover:bg-white/10" : "border-slate-200 text-slate-700 hover:bg-slate-100")}>
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
                  <button onClick={handleSaveNewHotel} disabled={newHotelSaving} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">{newHotelSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}</button>
                  <button onClick={() => setAddingHotel(false)} className="p-2.5 text-slate-500"><X size={20} /></button>
                </div>
              )}
              {finalFiltered.map((hotel, index) => (
                <HotelRow
                  key={hotel.id} entry={hotel} index={index}
                  isDarkMode={dk} lang={lang}
                  isPinned={bookmarks.includes(hotel.id)} // Used to render the Star correctly
                  onTogglePin={() => toggleBookmark(hotel.id)} // Used to toggle the Star
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
