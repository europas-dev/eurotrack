// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, exportToCSV, printDocument, calcHotelTotalCost, calcHotelFreeBedsToday } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, Star, Calendar, RefreshCw, MapPin, Building, Building2, CloudOff } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow, ModernDropdown, getCountryOptions, DEFAULT_COUNTRIES } from './components/HotelRow';

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

export default function Dashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel, onSignOut, offlineMode, onToggleOfflineMode }: DashboardProps) {
  const dk = theme === 'dark';
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
  const [newHotelCountry, setNewHotelCountry] = useState('Germany');
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  const newHotelNameRef = useRef<HTMLInputElement>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const toggleMenu = (menu: 'filter' | 'timeline' | 'sort') => {
    setShowFilterMenu(menu === 'filter' ? !showFilterMenu : false);
    setShowTimelineMenu(menu === 'timeline' ? !showTimelineMenu : false);
    setShowSortMenu(menu === 'sort' ? !showSortMenu : false);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const channel = supabase.channel('dashboard_presence', { config: { presence: { key: 'user' } } });
    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      const state = channel.presenceState();
      const users = Object.values(state).flat().map((p: any) => p.user);
      const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
      setActiveUsers(uniqueUsers);
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          await channel.track({ user: { id: user.id, name, email: user.email } });
        }
      }
    });
    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    async function fetchHotels() {
      try {
        setError('');
        const { data, error: supabaseError } = await supabase
          .from('hotels')
          .select('*, durations(*, room_cards(*, employees(*)), employees(*))')
          .eq('year', selectedYear)
          .order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;

        const normalizedData = (data || []).map((h: any) => ({
          ...h,
          companyTag: h.company_tag ?? [],
          lastUpdatedBy: h.last_updated_by,
          lastUpdatedAt: h.last_updated_at,
          durations: (h.durations || []).map((d: any) => ({
            ...d,
            hotelId: d.hotel_id,
            startDate: d.start_date,
            endDate: d.end_date,
            roomType: d.room_type,
            numberOfRooms: d.number_of_rooms,
            pricePerNightPerRoom: d.price_per_night_per_room,
            useManualPrices: d.use_manual_prices,
            nightlyPrices: d.nightly_prices,
            autoDistribute: d.auto_distribute,
            useBruttoNetto: d.use_brutto_netto,
            hasDiscount: d.has_discount,
            discountType: d.discount_type,
            discountValue: d.discount_value,
            isPaid: d.is_paid,
            rechnungNr: d.rechnung_nr,
            bookingId: d.booking_id,
            depositEnabled: d.deposit_enabled,
            depositAmount: d.deposit_amount,
            extensionNote: d.extension_note,
            roomCards: (d.room_cards || []).map((rc: any) => ({
              ...rc,
              durationId: rc.duration_id,
              roomNo: rc.room_no,
              roomType: rc.room_type,
              bedCount: rc.bed_count,
              pricingTab: rc.pricing_tab ?? 'per_room',
              roomNetto: rc.room_netto, roomMwst: rc.room_mwst, roomBrutto: rc.room_brutto,
              bedNetto: rc.bed_netto, bedMwst: rc.bed_mwst, bedBrutto: rc.bed_brutto,
              totalNetto: rc.total_netto, totalMwst: rc.total_mwst, totalBrutto: rc.total_brutto,
              roomEnergyNetto: rc.room_energy_netto, roomEnergyMwst: rc.room_energy_mwst, roomEnergyBrutto: rc.room_energy_brutto,
              bedEnergyNetto: rc.bed_energy_netto, bedEnergyMwst: rc.bed_energy_mwst, bedEnergyBrutto: rc.bed_energy_brutto,
              totalEnergyNetto: rc.total_energy_netto, totalEnergyMwst: rc.total_energy_mwst, totalEnergyBrutto: rc.total_energy_brutto,
              hasDiscount: rc.has_discount, discountType: rc.discount_type, discountValue: rc.discount_value,
              employees: (rc.employees || []).map((e: any) => ({
                ...e,
                slotIndex: e.slot_index ?? e.slotindex ?? 0,
                checkIn: e.checkin,
                checkOut: e.checkout
              }))
            }))
          }))
        }));

        if (isMounted) {
          setHotels(normalizedData);
          setHistory([normalizedData]);
          setHistoryIndex(0);
          setLoading(false);
        }
      } catch (err: any) { 
        console.error("Database Fetch Error:", err);
        if (isMounted) { setError(err.message || 'Failed to load data'); setLoading(false); }
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

  const handleEnterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur(); };
  const visibleHotels = useMemo(() => (!accessLevel || accessLevel.role === 'pending') ? [] : hotels, [hotels, accessLevel]);
  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(hotels.flatMap(h => h.companyTag || []).filter(Boolean))), [hotels]);

  const filteredPreGroup = useMemo(() => {
    return visibleHotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery && !hotelMatchesSearch(h, searchQuery)) return false;
      if (selectedMonth !== null) {
        const overlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate); const dEnd = new Date(d.endDate);
          const mStart = new Date(selectedYear, selectedMonth, 1); const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
          return dStart <= mEnd && dEnd >= mStart;
        });
        if (!overlap) return false;
      }
      return true;
    });
  }, [visibleHotels, searchQuery, showBookmarks, bookmarks, selectedMonth, selectedYear]);

  const finalFiltered = useMemo(() => {
    return [...filteredPreGroup].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      else { va = new Date(a.created_at || 0).getTime(); vb = new Date(b.created_at || 0).getTime(); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [filteredPreGroup, sortBy, sortDir]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  const handleExportCsv = () => exportToCSV(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang);
  const handlePrint = () => printDocument(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang);

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return;
    setNewHotelSaving(true);
    try {
      const hotel = await createHotel({ 
        name: newHotelName.trim(), 
        city: newHotelCity.trim() || null, 
        companyTag: newHotelCompany ? [newHotelCompany.trim()] : [],
        country: newHotelCountry,
        year: selectedYear 
      });
      const next = [{ ...hotel, durations: [] }, ...hotels];
      setHotels(next); pushToHistory(next); setAddingHotel(false); 
      setNewHotelName(''); setNewHotelCity(''); setNewHotelCompany(''); setNewHotelCountry('Germany');
    } catch (e: any) { alert(`Error: ${e.message}`); } 
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

  // RESTORED: Standard styling variables for the toolbar
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={handleExportCsv} onPrint={handlePrint} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} />
        {(!isOnline || offlineMode) && (
           <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 px-6 py-2 text-xs font-bold flex items-center justify-center gap-2 z-[60] relative">
             <CloudOff size={14} /> {lang === 'de' ? 'Offline Modus aktiv.' : 'Offline mode active.'}
           </div>
        )}
        <div className={cn('px-8 py-4 border-b shrink-0 z-10 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center justify-between flex-wrap gap-4 w-full">
            <div className="flex items-center gap-12 flex-wrap">
              {[
                { label: lang === 'de' ? 'Freie Betten Heute' : 'Free Beds Today', value: String(freeBedsTotal), cls: freeBedsTotal > 0 ? 'text-red-500' : 'text-emerald-500' },
                { label: lang === 'de' ? 'Gesamtkosten' : 'Total Spent', value: formatCurrency(totalSpend), cls: 'text-blue-400' },
                { label: 'Hotels', value: String(finalFiltered.length), cls: dk ? 'text-white' : 'text-slate-900' },
              ].map(({ label, value, cls }) => (
                <div key={label}><p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p><p className={cn('text-2xl font-black', cls)}>{value}</p></div>
              ))}
            </div>
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-bold uppercase tracking-widest mr-2", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Live dabei:' : 'Live now:'}</span>
                <div className="flex -space-x-2">
                  {activeUsers.map((u: any, i: number) => (
                    <div key={i} className="relative group cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white dark:border-[#020617] flex items-center justify-center text-white text-xs font-bold shadow-sm z-10 relative">{u.name.substring(0, 2).toUpperCase()}</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none">{u.name} <br/> <span className="text-slate-400">{u.email}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-6 relative">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap relative z-50">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>{selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}</h2>
            
            {/* RESTORED: The original flawless toolbar with proper translations, bookmarks, and layout */}
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
          </div>
          {loading ? (<div className="text-center py-20"><Loader2 size={40} className="animate-spin text-blue-600 mx-auto" /></div>) : (
            <div className="space-y-3 pb-24 relative z-0">
              
              {addingHotel && !isStrictViewer && (
                <div className={cn('rounded-2xl border p-4 shadow-md mb-4 relative z-50', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
                  <datalist id="city-list">
                    {uniqueCities.map(c => <option key={c} value={c} />)}
                  </datalist>
                  <div className="flex flex-wrap lg:flex-nowrap gap-3 items-start">
                    <div className="flex-[2.5_2.5_0%] min-w-[200px]">
                       <label className={labelCls}>{lang === 'de' ? 'Hotelname *' : 'Hotel Name *'}</label>
                       <input autoComplete="off" spellCheck="false" ref={newHotelNameRef} autoFocus onKeyDown={handleEnterBlur} className={cn('w-full px-3 py-2 rounded-lg border outline-none text-xs font-bold transition-all focus:border-blue-500 h-[38px]', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder={lang === 'de' ? "Name eingeben..." : "Enter name..."} />
                    </div>
                    <div className="flex-[1.5_1.5_0%] min-w-[150px]">
                       <label className={labelCls}><MapPin size={10}/> {lang === 'de' ? 'Stadt' : 'City'}</label>
                       <input autoComplete="off" spellCheck="false" list="city-list" onKeyDown={handleEnterBlur} className={cn('w-full px-3 py-2 rounded-lg border outline-none text-xs font-bold transition-all focus:border-blue-500 h-[38px]', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelCity} onChange={e => setNewHotelCity(e.target.value)} placeholder={lang === 'de' ? "Stadt eingeben..." : "Enter city..."} />
                    </div>
                    <div className="flex-[1.5_1.5_0%] min-w-[150px]">
                       <label className={labelCls}><Building2 size={10}/> {lang === 'de' ? 'Firma' : 'Company'}</label>
                       <ModernDropdown 
                          value={newHotelCompany} 
                          options={uniqueCompanies} 
                          onChange={(v:any) => setNewHotelCompany(v)} 
                          isDarkMode={dk} lang={lang} 
                          placeholder={lang === 'de' ? 'Firma...' : 'Company...'} 
                       />
                    </div>
                    <div className="flex-[1_1_0%] min-w-[150px]">
                       <label className={labelCls}><Building size={10}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                       <ModernDropdown 
                          value={newHotelCountry} 
                          options={getCountryOptions()} 
                          onChange={(v:any) => setNewHotelCountry(v)} 
                          isDarkMode={dk} lang={lang} 
                       />
                    </div>
                    <div className="flex shrink-0 gap-2 w-[100px] mt-[26px]">
                       <button onClick={handleSaveNewHotel} disabled={newHotelSaving || !newHotelName.trim()} className="flex-1 h-[38px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md disabled:opacity-50 transition-all flex items-center justify-center">
                          {newHotelSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                       </button>
                       <button onClick={() => setAddingHotel(false)} className={cn("flex-1 h-[38px] rounded-lg flex items-center justify-center transition-all border", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}>
                          <X size={14} />
                       </button>
                    </div>
                  </div>
                </div>
              )}
              {finalFiltered.map((hotel, index) => (
                <HotelRow key={hotel.id} entry={hotel} index={index} isDarkMode={dk} lang={lang} searchQuery={searchQuery} companyOptions={uniqueCompanies} cityOptions={uniqueCities} onDelete={handleRowDelete} onUpdate={handleRowUpdate} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
