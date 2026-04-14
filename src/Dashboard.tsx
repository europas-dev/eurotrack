// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, calcDurationFreeBeds, hotelMatchesSearch, exportToCSV, printDocument } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, Star, Calendar, RefreshCw, MapPin, Building, Building2 } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow, ModernDropdown, getCountryOptions } from './components/HotelRow';

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

  // Strict enforcement: viewers and pending users cannot edit.
  const isStrictViewer = viewOnly || accessLevel?.role === 'viewer' || accessLevel?.role === 'pending';

  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [fbStartDate, setFbStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [fbEndDate, setFbEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'with' | 'without'>('all');
  
  const [groupBy, setGroupBy] = useState<'none' | 'hotel' | 'company' | 'city'>('none');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStartDate, setTlStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [tlEndDate, setTlEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'free_beds' | 'last_added' | 'last_updated'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'));
  
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelCompany, setNewHotelCompany] = useState('');
  const [newHotelCountry, setNewHotelCountry] = useState(lang === 'de' ? 'Deutschland' : 'Germany');
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  const newHotelNameRef = useRef<HTMLInputElement>(null);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const toggleMenu = (menu: 'filter' | 'timeline' | 'sort') => {
    setShowFilterMenu(menu === 'filter' ? !showFilterMenu : false);
    setShowTimelineMenu(menu === 'timeline' ? !showTimelineMenu : false);
    setShowSortMenu(menu === 'sort' ? !showSortMenu : false);
  };

  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    
    async function fetchHotels() {
      try {
        setError('');
        const { data, error: supabaseError } = await supabase
          .from('hotels')
          .select('*, durations(*, roomCards(*, employees(*)), extraCosts(*), employees(*))')
          .eq('year', selectedYear)
          .order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;
        if (isMounted) {
          setHotels(data || []);
          setHistory([data || []]);
          setHistoryIndex(0);
          setLoading(false);
        }
      } catch (err: any) { 
        console.error("Database Fetch Error:", err);
        if (isMounted) {
          setError(err.message || 'Failed to load data');
          setLoading(false);
        }
      }
    }
    
    fetchHotels();
    return () => { isMounted = false; };
  }, [selectedYear]);

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

  const handleEnterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

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

  // Global Access: removed the flawed `hotelIds` filter. Everyone active sees all hotels.
  const visibleHotels = useMemo(() => {
    if (!accessLevel || accessLevel.role === 'pending') return [];
    return hotels; 
  }, [hotels, accessLevel]);

  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(hotels.flatMap(h => Array.isArray(h.companyTag) ? h.companyTag : [h.companyTag]).filter(Boolean))), [hotels]);

  const filteredPreGroup = useMemo(() => {
    return visibleHotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;

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

      if (fbType !== 'all') {
        let targetDate = new Date();
        if (fbType === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
        else if (fbType === '3days') targetDate.setDate(targetDate.getDate() + 3);
        else if (fbType === '7days') targetDate.setDate(targetDate.getDate() + 7);
        else if (fbType === 'range') targetDate = new Date(fbStartDate); 
        
        const targetIso = targetDate.toISOString().split('T')[0];
        if (getFreeBedsForDate(h, targetIso) <= 0) return false;
      }

      if (filterPaid === 'paid' && !(h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && (h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterDeposit === 'with' && !(h.durations || []).some((d: any) => d.depositEnabled)) return false;
      if (filterDeposit === 'without' && (h.durations || []).some((d: any) => d.depositEnabled)) return false;

      return true;
    });
  }, [visibleHotels, searchQuery, searchScope, showBookmarks, bookmarks, selectedMonth, selectedYear, tlType, tlStartDate, tlEndDate, fbType, fbStartDate, filterPaid, filterDeposit]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, { count: number, cost: number }>();
    filteredPreGroup.forEach(h => {
      let keys: string[] = [];
      if (groupBy === 'city') keys = [h.city || 'Unknown'];
      else if (groupBy === 'hotel') keys = [h.name || 'Unknown'];
      else keys = Array.isArray(h.companyTag) && h.companyTag.length > 0 ? h.companyTag : [h.companyTag || 'Unknown'];
      
      keys.forEach(k => {
        const curr = map.get(k) || { count: 0, cost: 0 };
        map.set(k, { count: curr.count + 1, cost: curr.cost + calcCost(h) });
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.cost - a.cost);
  }, [filteredPreGroup, groupBy]);

  const finalFiltered = useMemo(() => {
    let list = filteredPreGroup;
    if (groupBy !== 'none' && activeGroup) {
      if (groupBy === 'city') list = list.filter(h => h.city === activeGroup);
      else if (groupBy === 'hotel') list = list.filter(h => h.name === activeGroup);
      else list = list.filter(h => Array.isArray(h.companyTag) ? h.companyTag.includes(activeGroup) : h.companyTag === activeGroup);
    }

    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcCost(a); vb = calcCost(b); }
      else if (sortBy === 'free_beds') { va = calcFreeBedsToday(a); vb = calcFreeBedsToday(b); }
      else if (sortBy === 'last_updated') { va = new Date(a.updated_at || 0).getTime(); vb = new Date(b.updated_at || 0).getTime(); }
      else { va = new Date(a.created_at || 0).getTime(); vb = new Date(b.created_at || 0).getTime(); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [filteredPreGroup, groupBy, activeGroup, sortBy, sortDir]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcFreeBedsToday(h), 0);

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

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return;
    setNewHotelSaving(true);
    try {
      const hotel = await createHotel({ 
        name: newHotelName.trim(), 
        city: newHotelCity.trim() || null, 
        companyTag: newHotelCompany ? [newHotelCompany.trim()] : null,
        country: newHotelCountry,
        year: selectedYear 
      });
      const next = [{ ...hotel, durations: [] }, ...hotels];
      setHotels(next); 
      pushToHistory(next);
      setAddingHotel(false); 
      setNewHotelName(''); setNewHotelCity(''); setNewHotelCompany(''); setNewHotelCountry(lang === 'de' ? 'Deutschland' : 'Germany');
    } catch (e: any) { 
      console.error("Database Create Failed:", e); 
      alert(lang === 'de' ? `Fehler beim Speichern: ${e.message}` : `Error saving: ${e.message}`); 
    } 
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

  const btnCls = cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all shadow-sm', dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50');
  const Pill = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
    <button onClick={onClick} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap', 
      active ? 'bg-blue-600 text-white shadow-md' : dk ? 'bg-[#1E293B] border border-white/10 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-200'
    )}>
      {children}
    </button>
  );

  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500');

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} hotels={visibleHotels} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={handleExportCsv} onPrint={handlePrint} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} />

        <div className={cn('px-8 py-4 border-b shrink-0 z-10 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
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
          
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap relative z-50">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}
            </h2>

            <div className="flex items-center gap-2 relative">
              {!isStrictViewer && (
                <div className={cn("flex items-center mr-2 rounded-full p-1 border shadow-sm", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                   <button onClick={handleUndo} disabled={historyIndex <= 0} className={cn("p-1.5 rounded-full transition-all disabled:opacity-30", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600")} title={lang === 'de' ? "Rückgängig (Ctrl+Z)" : "Undo (Ctrl+Z)"}><Undo2 size={16} /></button>
                   <div className={cn("w-px h-4 mx-0.5", dk ? "bg-white/10" : "bg-slate-200")} />
                   <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={cn("p-1.5 rounded-full transition-all disabled:opacity-30", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600")} title={lang === 'de' ? "Wiederholen (Ctrl+Y)" : "Redo (Ctrl+Y)"}><Redo2 size={16} /></button>
                </div>
              )}

              <button onClick={() => toggleMenu('timeline')} className={cn(btnCls, tlType !== 'all' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : '')}>
                <Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}
              </button>
              
              <button onClick={() => toggleMenu('filter')} className={cn(btnCls, (fbType !== 'all' || filterPaid !== 'all' || filterDeposit !== 'all' || groupBy !== 'none') ? 'border-blue-500 text-blue-500 bg-blue-500/10' : '')}>
                <Filter size={16} /> {lang === 'de' ? 'Filter & Gruppen' : 'Filters'}
              </button>

              <button onClick={() => toggleMenu('sort')} className={btnCls}>
                <ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}
              </button>

              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls, 'ml-2', showBookmarks && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500')}>
                <Star size={16} className={showBookmarks ? 'fill-yellow-500 text-yellow-500' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}
              </button>

              {!isStrictViewer && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg transition-all">
                  <Plus size={18} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                </button>
              )}
            </div>

            {showTimelineMenu && (
               <div className={cn("absolute right-[400px] top-12 z-[200] p-5 rounded-xl border shadow-2xl w-[340px]", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-white/10">
                     <p className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Buchungszeitraum' : 'Booking Timeline'}</p>
                     <button onClick={() => setShowTimelineMenu(false)} className={cn("p-1 rounded-md", dk ? "hover:bg-white/10" : "hover:bg-slate-100")}><X size={14}/></button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                     <Pill active={tlType === 'all'} onClick={() => setTlType('all')}>{lang === 'de' ? 'Gesamte Zeit' : 'All Time'}</Pill>
                     <Pill active={tlType === 'today'} onClick={() => setTlType('today')}>{lang === 'de' ? 'Heute' : 'Today'}</Pill>
                     <Pill active={tlType === 'tomorrow'} onClick={() => setTlType('tomorrow')}>{lang === 'de' ? 'Morgen' : 'Tomorrow'}</Pill>
                     <Pill active={tlType === '3days'} onClick={() => setTlType('3days')}>{lang === 'de' ? 'In 3 Tagen' : 'In 3 Days'}</Pill>
                     <Pill active={tlType === '7days'} onClick={() => setTlType('7days')}>{lang === 'de' ? 'In 7 Tagen' : 'In 7 Days'}</Pill>
                     <Pill active={tlType === 'range'} onClick={() => setTlType('range')}>{lang === 'de' ? 'Eigener Zeitraum' : 'Custom Range'}</Pill>
                  </div>

                  {tlType === 'range' && (
                     <div className="flex items-center gap-2 mb-4">
                        <input type="date" value={tlStartDate} onChange={e => setTlStartDate(e.target.value)} className={cn("flex-1 px-3 py-2 rounded-lg border text-xs outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                        <span className="text-slate-400">➔</span>
                        <input type="date" value={tlEndDate} onChange={e => setTlEndDate(e.target.value)} className={cn("flex-1 px-3 py-2 rounded-lg border text-xs outline-none", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")} />
                     </div>
                  )}

                  <button onClick={() => { setTlType('all'); setShowTimelineMenu(false); }} className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all">
                     <RefreshCw size={12} /> {lang === 'de' ? 'Datum zurücksetzen' : 'Clear Dates'}
                  </button>
               </div>
            )}

            {showFilterMenu && (
               <div className={cn("absolute right-72 top-12 z-[200] p-5 rounded-xl border shadow-2xl w-[380px] space-y-5", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/10">
                     <p className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Filter & Gruppierung' : 'Filters & Grouping'}</p>
                     <button onClick={() => setShowFilterMenu(false)} className={cn("p-1 rounded-md", dk ? "hover:bg-white/10" : "hover:bg-slate-100")}><X size={14}/></button>
                  </div>

                  <div>
                     <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Freie Betten Kapazität' : 'Free Beds Capacity'}</p>
                     <div className="flex flex-wrap gap-2">
                        <Pill active={fbType === 'all'} onClick={() => setFbType('all')}>{lang === 'de' ? 'Alle' : 'All'}</Pill>
                        <Pill active={fbType === 'today'} onClick={() => setFbType('today')}>{lang === 'de' ? 'Heute' : 'Today'}</Pill>
                        <Pill active={fbType === 'tomorrow'} onClick={() => setFbType('tomorrow')}>{lang === 'de' ? 'Morgen' : 'Tomorrow'}</Pill>
                        <Pill active={fbType === '3days'} onClick={() => setFbType('3days')}>{lang === 'de' ? 'In 3 Tagen' : 'In 3 Days'}</Pill>
                        <Pill active={fbType === '7days'} onClick={() => setFbType('7days')}>{lang === 'de' ? 'In 7 Tagen' : 'In 7 Days'}</Pill>
                        <Pill active={fbType === 'range'} onClick={() => setFbType('range')}>{lang === 'de' ? 'Eigener Zeitraum' : 'Custom Range'}</Pill>
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
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
                        <div className="flex flex-wrap gap-2">
                           <Pill active={filterPaid === 'all'} onClick={() => setFilterPaid('all')}>{lang === 'de' ? 'Alle' : 'All'}</Pill>
                           <Pill active={filterPaid === 'paid'} onClick={() => setFilterPaid('paid')}>{lang === 'de' ? 'Bezahlt' : 'Paid'}</Pill>
                           <Pill active={filterPaid === 'unpaid'} onClick={() => setFilterPaid('unpaid')}>{lang === 'de' ? 'Offen' : 'Unpaid'}</Pill>
                        </div>
                     </div>
                     <div className="flex-1">
                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Kaution' : 'Deposit'}</p>
                        <div className="flex flex-wrap gap-2">
                           <Pill active={filterDeposit === 'all'} onClick={() => setFilterDeposit('all')}>{lang === 'de' ? 'Alle' : 'All'}</Pill>
                           <Pill active={filterDeposit === 'with'} onClick={() => setFilterDeposit('with')}>{lang === 'de' ? 'Ja' : 'Yes'}</Pill>
                           <Pill active={filterDeposit === 'without'} onClick={() => setFilterDeposit('without')}>{lang === 'de' ? 'Nein' : 'No'}</Pill>
                        </div>
                     </div>
                  </div>

                  <div>
                     <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Gruppieren (Tabs)' : 'Group By (Tabs)'}</p>
                     <div className="flex flex-wrap gap-2">
                        <Pill active={groupBy === 'none'} onClick={() => { setGroupBy('none'); setActiveGroup(null); }}>{lang === 'de' ? 'Keine' : 'None'}</Pill>
                        <Pill active={groupBy === 'hotel'} onClick={() => { setGroupBy('hotel'); setActiveGroup(null); }}>Hotel</Pill>
                        <Pill active={groupBy === 'company'} onClick={() => { setGroupBy('company'); setActiveGroup(null); }}>{lang === 'de' ? 'Firma' : 'Company'}</Pill>
                        <Pill active={groupBy === 'city'} onClick={() => { setGroupBy('city'); setActiveGroup(null); }}>{lang === 'de' ? 'Stadt' : 'City'}</Pill>
                     </div>
                  </div>

                  <button onClick={() => { setFbType('all'); setFilterPaid('all'); setFilterDeposit('all'); setGroupBy('none'); setShowFilterMenu(false); }} className="w-full pt-3 mt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all">
                     <RefreshCw size={12} /> {lang === 'de' ? 'Filter zurücksetzen' : 'Clear Filters'}
                  </button>
               </div>
            )}

            {showSortMenu && (
               <div className={cn("absolute right-48 top-12 z-[200] p-5 rounded-xl border shadow-2xl w-[280px]", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-white/10">
                     <p className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Dashboard Sortieren' : 'Sort Dashboard'}</p>
                     <button onClick={() => setShowSortMenu(false)} className={cn("p-1 rounded-md", dk ? "hover:bg-white/10" : "hover:bg-slate-100")}><X size={14}/></button>
                  </div>
                  
                  <div className="flex gap-2 mb-4">
                     <button onClick={() => setSortDir('asc')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all", sortDir==='asc' ? "bg-blue-600 text-white border-blue-600 shadow-md" : dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900")}>↑ {lang === 'de' ? 'Aufsteigend' : 'Ascending'}</button>
                     <button onClick={() => setSortDir('desc')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all", sortDir==='desc' ? "bg-blue-600 text-white border-blue-600 shadow-md" : dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900")}>↓ {lang === 'de' ? 'Absteigend' : 'Descending'}</button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <Pill active={sortBy === 'last_added'} onClick={() => setSortBy('last_added')}>{lang === 'de' ? 'Zuletzt hinzugefügt' : 'Last Added'}</Pill>
                     <Pill active={sortBy === 'last_updated'} onClick={() => setSortBy('last_updated')}>{lang === 'de' ? 'Zuletzt aktualisiert' : 'Last Updated'}</Pill>
                     <Pill active={sortBy === 'name'} onClick={() => setSortBy('name')}>{lang === 'de' ? 'Hotelname (A-Z)' : 'Hotel Name (A-Z)'}</Pill>
                     <Pill active={sortBy === 'cost'} onClick={() => setSortBy('cost')}>{lang === 'de' ? 'Gesamtkosten' : 'Total Cost'}</Pill>
                     <Pill active={sortBy === 'free_beds'} onClick={() => setSortBy('free_beds')}>{lang === 'de' ? 'Freie Betten' : 'Free Beds'}</Pill>
                  </div>
               </div>
            )}
          </div>

          {groupBy !== 'none' && groupedData.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar border-b border-slate-200 dark:border-white/10">
               <button onClick={() => setActiveGroup(null)} className={cn("px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap", !activeGroup ? "bg-blue-600 text-white shadow-md border-blue-600" : dk ? "border-white/10 text-slate-400 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>
                  {lang === 'de' ? 'Alle' : 'All'} {groupBy === 'city' ? (lang === 'de' ? 'Städte' : 'Cities') : groupBy === 'hotel' ? 'Hotels' : (lang === 'de' ? 'Firmen' : 'Companies')}
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
            <div className="space-y-3 pb-24 relative z-0">
              
              {addingHotel && !isStrictViewer && (
                <div className={cn('rounded-2xl border p-4 shadow-md mb-4 relative z-50', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
                  <datalist id="city-list">
                    {uniqueCities.map(c => <option key={c} value={c} />)}
                  </datalist>
                  
                  <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end">
                    <div className="flex-[2.5_2.5_0%] min-w-[200px]">
                       <label className={labelCls}>{lang === 'de' ? 'Hotelname *' : 'Hotel Name *'}</label>
                       <input ref={newHotelNameRef} autoFocus onKeyDown={handleEnterBlur} className={cn('w-full px-3 py-2 rounded-lg border outline-none text-xs font-bold transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder={lang === 'de' ? "Name eingeben..." : "Enter name..."} />
                    </div>
                    
                    <div className="flex-[1.5_1.5_0%] min-w-[150px]">
                       <label className={labelCls}><MapPin size={10}/> {lang === 'de' ? 'Stadt' : 'City'}</label>
                       <input list="city-list" onKeyDown={handleEnterBlur} className={cn('w-full px-3 py-2 rounded-lg border outline-none text-xs font-bold transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelCity} onChange={e => setNewHotelCity(e.target.value)} placeholder={lang === 'de' ? "Stadt eingeben..." : "Enter city..."} />
                    </div>
                    
                    <div className="flex-[1.5_1.5_0%] min-w-[150px]">
                       <label className={labelCls}><Building2 size={10}/> {lang === 'de' ? 'Firma' : 'Company'}</label>
                       <ModernDropdown 
                          value={newHotelCompany} 
                          options={uniqueCompanies} 
                          onChange={v => setNewHotelCompany(v)} 
                          isDarkMode={dk} lang={lang} 
                          placeholder={lang === 'de' ? 'Firma...' : 'Company...'} 
                       />
                    </div>
                    
                    <div className="flex-[1_1_0%] min-w-[150px]">
                       <label className={labelCls}><Building size={10}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                       <ModernDropdown 
                          value={newHotelCountry} 
                          options={getCountryOptions(lang)} 
                          onChange={v => setNewHotelCountry(v)} 
                          isDarkMode={dk} lang={lang} 
                       />
                    </div>
                    
                    <div className="flex shrink-0 gap-2 w-[100px]">
                       <button onClick={handleSaveNewHotel} disabled={newHotelSaving || !newHotelName.trim()} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md disabled:opacity-50 transition-all flex items-center justify-center">
                          {newHotelSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                       </button>
                       <button onClick={() => setAddingHotel(false)} className={cn("flex-1 py-2 rounded-lg flex items-center justify-center transition-all border", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}>
                          <X size={14} />
                       </button>
                    </div>
                  </div>
                </div>
              )}

              {finalFiltered.map((hotel, index) => (
                <HotelRow
                  key={hotel.id} entry={hotel} index={index}
                  isDarkMode={dk} lang={lang}
                  searchQuery={searchQuery} 
                  isPinned={bookmarks.includes(hotel.id)} 
                  onTogglePin={() => toggleBookmark(hotel.id)} 
                  companyOptions={uniqueCompanies}
                  cityOptions={uniqueCities}
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
