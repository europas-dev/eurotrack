// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, exportToCSV, printDocument, calcHotelTotalCost, calcHotelFreeBedsToday } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, Star, Calendar, MapPin, Building, Building2, CloudOff, Globe, Trash2 } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow, ModernDropdown, CompanyMultiSelect, getCountryOptions } from './components/HotelRow';

// --- SYSTEM COMPANIES API ---
async function getSystemCompanies(): Promise<string[]> {
  const { data, error } = await supabase.from('global_companies').select('name').order('name');
  if (error) { console.error("Global Companies Fetch Error:", error); return []; }
  return (data || []).map(c => c.name);
}

async function addSystemCompany(name: string): Promise<void> {
  const { error } = await supabase.from('global_companies').insert({ name });
  if (error) console.error("Global Companies Insert Error:", error);
}

async function deleteSystemCompany(name: string): Promise<void> {
  await supabase.from('global_companies').delete().eq('name', name);
}

interface DashboardProps {
  theme: 'dark' | 'light'; lang: 'de' | 'en';
  toggleTheme: () => void; setLang: (l: 'de' | 'en') => void;
  offlineMode?: boolean; onToggleOfflineMode?: () => void;
  viewOnly?: boolean; accessLevel?: AccessLevel | null; onSignOut?: () => void;
}

export default function Dashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel, onSignOut, offlineMode, onToggleOfflineMode }: DashboardProps) {
  const dk = theme === 'dark';
  const isStrictViewer = viewOnly || accessLevel?.role === 'viewer' || accessLevel?.role === 'pending';

  const [hotels, setHotels] = useState<any[]>([]);
  const [systemCompanies, setSystemCompanies] = useState<string[]>([]);
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
  
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStart, setTlStart] = useState('');
  const [tlEnd, setTlEnd] = useState('');
  
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'yes' | 'no'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'hotel' | 'company' | 'city' | 'country'>('none');
  
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'); } catch { return []; }
  });
  
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [addingHotel, setAddingHotel] = useState(false);
  
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelCompanyTags, setNewHotelCompanyTags] = useState<string[]>([]);
  const [newHotelCountry, setNewHotelCountry] = useState('Germany'); 
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  // Fixed Dynamic Title Logic
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const displayTitle = selectedMonth !== null 
    ? `${lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth]} ${selectedYear}`
    : `${lang === 'de' ? 'Dashboard' : 'Dashboard'} ${selectedYear}`;

  useEffect(() => {
    const hO = () => setIsOnline(true);
    const hOff = () => setIsOnline(false);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hOff);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hOff); };
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      try { setBookmarks(JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]')); } catch {}
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 1000); 
    return () => { window.removeEventListener('storage', handleStorage); clearInterval(interval); };
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
      if (status === 'SUBSCRIBED' && isMounted) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          await channel.track({ user: { id: user.id, name, email: user.email } });
        }
      }
    });
    return () => { isMounted = false; channel.unsubscribe(); supabase.removeChannel(channel); };
  }, []);

  // FIXED: Fetch Logic with finally block to stop spinner
  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    setError('');
    
    async function fetchAllData() {
      try {
        const companies = await getSystemCompanies();
        const { data, error: fetchErr } = await supabase
          .from('hotels')
          .select('*, durations(*, room_cards(*, employees(*)), employees(*))')
          .eq('year', selectedYear)
          .order('created_at', { ascending: false });

        if (fetchErr) throw fetchErr;

        const normalized = (data || []).map((h: any) => ({
          ...h, companyTag: h.company_tag ?? [],
          durations: (h.durations || []).map((d: any) => ({
            ...d, hotelId: d.hotel_id, startDate: d.start_date, endDate: d.end_date, roomType: d.room_type, numberOfRooms: d.number_of_rooms,
            pricePerNightPerRoom: d.price_per_night_per_room, useManualPrices: d.use_manual_prices, nightlyPrices: d.nightly_prices, useBruttoNetto: d.use_brutto_netto,
            hasDiscount: d.has_discount, discountType: d.discount_type, discountValue: d.discount_value, isPaid: d.is_paid, rechnungNr: d.rechnung_nr,
            bookingId: d.booking_id, depositEnabled: d.deposit_enabled, depositAmount: d.deposit_amount,
            roomCards: (d.room_cards || []).map((rc: any) => ({
              ...rc, durationId: rc.duration_id, roomNo: rc.room_no, roomType: rc.room_type, bedCount: rc.bed_count, pricingTab: rc.pricing_tab ?? 'per_room',
              roomNetto: rc.room_netto, roomMwst: rc.room_mwst, roomBrutto: rc.room_brutto, bedNetto: rc.bed_netto, bedMwst: rc.bed_mwst, bedBrutto: rc.bed_brutto, totalNetto: rc.total_netto, totalMwst: rc.total_mwst, totalBrutto: rc.total_brutto,
              roomEnergyNetto: rc.room_energy_netto, roomEnergyMwst: rc.room_energy_mwst, roomEnergyBrutto: rc.room_energy_brutto, bedEnergyNetto: rc.bed_energy_netto, bedEnergyMwst: rc.bed_energy_mwst, bedEnergyBrutto: rc.bed_energy_brutto, totalEnergyNetto: rc.total_energy_netto, totalEnergyMwst: rc.total_energy_mwst, totalEnergyBrutto: rc.total_energy_brutto,
              hasDiscount: rc.has_discount, discountType: rc.discount_type, discountValue: rc.discount_value,
              employees: (rc.employees || []).map((e: any) => ({ ...e, slotIndex: e.slot_index ?? 0, checkIn: e.checkin, checkOut: e.checkout }))
            }))
          }))
        }));

        if (isMounted) { 
          setSystemCompanies(companies);
          setHotels(normalized); 
          setHistory([normalized]); 
          setHistoryIndex(0); 
        }
      } catch (err: any) { 
        if (isMounted) setError(err.message || "Failed to load dashboard data."); 
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchAllData(); 
    return () => { isMounted = false; };
  }, [selectedYear]);

  const allCompanyOptions = useMemo(() => {
    const localTags = hotels.flatMap(h => h.companyTag || []).filter(Boolean);
    return Array.from(new Set([...systemCompanies, ...localTags]));
  }, [hotels, systemCompanies]);

  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);

  const handleAddGlobalCompany = async (name: string) => {
    try {
      await addSystemCompany(name);
      setSystemCompanies(prev => Array.from(new Set([...prev, name])));
    } catch (err) { console.error("Failed to add company globally", err); }
  };

  const handleDeleteGlobalCompany = async (name: string) => {
    try {
      await deleteSystemCompany(name);
      setSystemCompanies(prev => prev.filter(c => c !== name));
    } catch (err) { console.error("Failed to delete company from system", err); }
  };

  function pushToHistory(next: any[]) { const nH = history.slice(0, historyIndex + 1); nH.push(next); setHistory(nH); setHistoryIndex(nH.length - 1); }
  const handleUndo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setHotels(history[historyIndex - 1]); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setHotels(history[historyIndex + 1]); } };

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return; 
    setNewHotelSaving(true);
    try {
      const h = await createHotel({ 
        name: newHotelName.trim(), 
        city: newHotelCity.trim() || null, 
        company_tag: newHotelCompanyTags, 
        country: newHotelCountry, 
        year: selectedYear 
      });
      const next = [{ ...h, companyTag: newHotelCompanyTags, durations: [] }, ...hotels]; 
      setHotels(next); 
      pushToHistory(next); 
      setAddingHotel(false); setNewHotelName(''); setNewHotelCity(''); setNewHotelCompanyTags([]); setNewHotelCountry('Germany');
    } catch (e: any) { alert(e.message); } finally { setNewHotelSaving(false); }
  }

  const getBedsCount = (daysOffset: number) => {
     const d = new Date(); d.setDate(d.getDate() + daysOffset);
     const dStr = d.toISOString().split('T')[0];
     let total = 0;
     hotels.forEach(h => {
        (h.durations || []).forEach((dur: any) => {
           if (dur.startDate <= dStr && dur.endDate >= dStr) {
              (dur.roomCards || []).forEach((rc: any) => {
                 const emps = (rc.employees || []).filter((e: any) => e.checkIn <= dStr && e.checkOut > dStr);
                 total += Math.max(0, (rc.bedCount || 0) - emps.length);
              });
           }
        });
     });
     return total;
  };

  const fbCountToday = useMemo(() => getBedsCount(0), [hotels]);
  const fbCountTomorrow = useMemo(() => getBedsCount(1), [hotels]);
  const fbCount3 = useMemo(() => getBedsCount(3), [hotels]);
  const fbCount7 = useMemo(() => getBedsCount(7), [hotels]);

  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery && !hotelMatchesSearch(h, searchQuery, searchScope)) return false;
      if (selectedMonth !== null) {
        const overlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate); const dEnd = new Date(d.endDate);
          const mStart = new Date(selectedYear, selectedMonth, 1);
          const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
          return dStart <= mEnd && dEnd >= mStart;
        });
        if (!overlap) return false;
      }
      if (tlType !== 'all' && tlStart && tlEnd) {
         const hasOverlap = (h.durations || []).some((d: any) => d.startDate <= tlEnd && d.endDate >= tlStart);
         if (!hasOverlap) return false;
      }
      if (filterPaid === 'paid') {
         const isPaid = (h.durations || []).every((d: any) => d.isPaid);
         if (!isPaid || h.durations?.length === 0) return false;
      }
      if (filterPaid === 'unpaid') {
         const hasUnpaid = (h.durations || []).some((d: any) => !d.isPaid);
         if (!hasUnpaid) return false;
      }
      if (fbType !== 'all') {
         let targetDate = new Date().toISOString().split('T')[0];
         if (fbType === 'tomorrow') { const d = new Date(); d.setDate(d.getDate()+1); targetDate = d.toISOString().split('T')[0]; }
         if (fbType === '3days') { const d = new Date(); d.setDate(d.getDate()+3); targetDate = d.toISOString().split('T')[0]; }
         if (fbType === '7days') { const d = new Date(); d.setDate(d.getDate()+7); targetDate = d.toISOString().split('T')[0]; }
         let hasFree = false;
         (h.durations || []).forEach((dur: any) => {
            if (dur.startDate <= targetDate && dur.endDate >= targetDate) {
               (dur.roomCards || []).forEach((rc: any) => {
                  const emps = (rc.employees || []).filter((e: any) => e.checkIn <= targetDate && e.checkOut > targetDate);
                  if ((rc.bedCount || 0) > emps.length) hasFree = true;
               });
            }
         });
         if (!hasFree) return false;
      }
      return true;
    }).sort((a, b) => {
      let va: any = a.name?.toLowerCase(); let vb: any = b.name?.toLowerCase();
      if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      if (sortBy === 'created_at') { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); }
      if (sortBy === 'updated_at') { va = new Date(a.last_updated_at || a.lastUpdatedAt || 0).getTime(); vb = new Date(b.last_updated_at || b.lastUpdatedAt || 0).getTime(); }
      if (sortBy === 'free_beds') { va = calcHotelFreeBedsToday(a); vb = calcHotelFreeBedsToday(b); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, showBookmarks, bookmarks, sortBy, sortDir, tlType, tlStart, tlEnd, fbType, filterPaid, filterDeposit, selectedMonth, selectedYear]);

  const groupData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, any[]> = {};
    finalFiltered.forEach(h => {
      const key = groupBy === 'company' ? (h.companyTag?.[0] || 'Unassigned') : groupBy === 'city' ? (h.city || 'Other') : groupBy === 'country' ? (h.country || 'Other') : h.name;
      if (!groups[key]) groups[key] = []; groups[key].push(h);
    });
    return groups;
  }, [finalFiltered, groupBy]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcHotelTotalCost(h, selectedMonth, selectedYear), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  const closeMenu = () => { setShowFilterMenu(false); setShowTimelineMenu(false); setShowSortMenu(false); };

  const activeFilters = useMemo(() => {
    const badges = [];
    if (tlType !== 'all') badges.push({ id: 'tl', label: lang === 'de' ? 'Zeitraum' : 'Timeline', val: tlType === 'range' ? `${tlStart} ➔ ${tlEnd}` : tlType, clear: () => { setTlType('all'); setTlStart(''); setTlEnd(''); } });
    if (fbType !== 'all') badges.push({ id: 'fb', label: lang === 'de' ? 'Freie Betten' : 'Free Beds', val: fbType, clear: () => setFbType('all') });
    if (filterPaid !== 'all') badges.push({ id: 'paid', label: lang === 'de' ? 'Zahlung' : 'Payment', val: filterPaid, clear: () => setFilterPaid('all') });
    if (filterDeposit !== 'all') badges.push({ id: 'dep', label: lang === 'de' ? 'Kaution' : 'Deposit', val: filterDeposit, clear: () => setFilterDeposit('all') });
    if (groupBy !== 'none') badges.push({ id: 'grp', label: lang === 'de' ? 'Gruppe' : 'Group', val: groupBy, clear: () => setGroupBy('none') });
    if (sortBy !== 'created_at' || sortDir !== 'desc') badges.push({ id: 'srt', label: lang === 'de' ? 'Sortierung' : 'Sort', val: `${sortBy.replace('_', ' ')} (${sortDir})`, clear: () => { setSortBy('created_at'); setSortDir('desc'); } });
    return badges;
  }, [tlType, tlStart, tlEnd, fbType, filterPaid, filterDeposit, groupBy, sortBy, sortDir, lang]);

  const btnActive = dk ? 'bg-teal-600 text-white border-transparent' : 'bg-white border-teal-600 text-teal-700 shadow-sm';
  const btnInactive = dk ? 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';
  const popupCls = cn('absolute z-[1000] mt-3 p-5 rounded-2xl border shadow-2xl w-[380px] text-sm animate-in fade-in slide-in-from-top-2 duration-200', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900');
  const popupHeader = "flex items-center justify-between mb-5";
  const popupTitle = "text-lg font-bold";
  const sectionTitle = "text-sm text-slate-400 mb-2";
  const segmentContainer = cn("flex p-1 rounded-xl", dk ? "bg-black/20" : "bg-slate-100");
  const segmentBtn = (active: boolean) => cn("flex-1 py-1.5 text-sm font-medium rounded-lg transition-all", active ? (dk ? "bg-teal-600 text-white shadow-sm" : "bg-white text-teal-700 shadow-sm") : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300");
  const actionPrimary = cn("px-5 py-2 rounded-lg font-bold transition-all", dk ? "bg-teal-600 text-white hover:bg-teal-500" : "bg-teal-700 text-white hover:bg-teal-800");
  const actionSecondary = "text-teal-600 dark:text-teal-400 text-sm font-medium hover:underline";

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#0F172A]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} hotels={hotels} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={() => exportToCSV(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} onPrint={() => printDocument(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} />
        
        {(!isOnline || offlineMode) && (
          <div className="bg-amber-500 border-b border-amber-600 text-white px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 z-[60] relative">
            <CloudOff size={16} strokeWidth={2.5} /> {lang === 'de' ? 'Offline Modus Aktiv' : 'Offline Mode Active'}
          </div>
        )}

        <div className={cn('px-8 py-5 border-b shrink-0 z-40 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center justify-between flex-wrap gap-4 w-full">
            <div className="flex items-center gap-12 flex-wrap">
              <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'Freie Betten Heute' : 'Free Beds Today'}</p><p className={cn('text-3xl font-black', freeBedsTotal > 0 ? 'text-red-500' : 'text-slate-400')}>{freeBedsTotal}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'Gesamtkosten' : 'Total Spent'}</p><p className="text-3xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(totalSpend)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Hotels</p><p className="text-3xl font-black">{finalFiltered.length}</p></div>
            </div>
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">{lang === 'de' ? 'Live dabei:' : 'Live now:'}</span>
                <div className="flex -space-x-3">
                  {activeUsers.map((u: any, i: number) => (
                    <div key={i} className="relative group cursor-pointer">
                      <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center text-white text-sm font-bold shadow-md z-10 relative", dk ? "bg-teal-600 border-[#0F172A]" : "bg-teal-600 border-white")}>{u.name.substring(0, 2).toUpperCase()}</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-3 py-2 bg-slate-800 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none shadow-xl">{u.name} <br/> <span className="text-slate-400 text-[10px]">{u.email}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
           <div className="bg-red-500 text-white px-6 py-2 text-sm font-bold flex items-center justify-center gap-2 z-[60] relative">
             Error: {error}
             <button onClick={() => setError('')} className="ml-4 underline hover:text-red-200">Dismiss</button>
           </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
             <Loader2 size={48} className="animate-spin text-teal-500 opacity-50" />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto p-8 relative no-scrollbar pb-64">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap relative z-[100]">
              <h2 className="text-2xl font-bold tracking-tight">{displayTitle}</h2>
              <div className="flex items-center gap-2">
                <div className={cn("flex items-center mr-2 rounded-xl p-1 border", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                  <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 disabled:opacity-30 transition-all"><Undo2 size={18}/></button>
                  <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 disabled:opacity-30 transition-all"><Redo2 size={18}/></button>
                </div>
                <div className="relative">
                  <button onClick={() => { closeMenu(); setShowTimelineMenu(!showTimelineMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", tlType !== 'all' ? btnActive : btnInactive)}><Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
                  {showTimelineMenu && (
                    <div className={cn(popupCls, 'right-0 w-[400px]')}>
                      <div className={popupHeader}><h3 className={popupTitle}>{lang === 'de' ? 'Zeitraum' : 'Timeline'}</h3><button onClick={closeMenu} className="text-slate-400 hover:text-white"><X size={20}/></button></div>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[ { id: 'today', lEn: 'Today', lDe: 'Heute', off: 0 }, { id: 'tomorrow', lEn: 'Tomorrow', lDe: 'Morgen', off: 1 }, { id: '3days', lEn: '3 Days', lDe: '3 Tage', off: 3 }, { id: '7days', lEn: '7 Days', lDe: '7 Tage', off: 7 } ].map(t => (
                          <button key={t.id} onClick={() => {
                            const s = new Date(); if (t.off > 0 && t.id !== '3days' && t.id !== '7days') s.setDate(s.getDate() + t.off);
                            const e = new Date(); e.setDate(e.getDate() + t.off);
                            setTlStart(s.toISOString().split('T')[0]); setTlEnd(e.toISOString().split('T')[0]); setTlType(t.id as any);
                          }} className={cn("py-2 rounded-lg text-xs font-medium border transition-all", tlType === t.id ? btnActive : btnInactive)}>{lang === 'de' ? t.lDe : t.lEn}</button>
                        ))}
                      </div>
                      <div className={cn("p-4 rounded-xl border mb-4", dk ? "bg-black/20 border-white/5" : "bg-slate-50 border-slate-200")}>
                        <div className="flex items-center gap-3">
                           <input type="date" value={tlStart} onChange={e => {setTlStart(e.target.value); setTlType('range');}} className={cn("flex-1 p-2 rounded-lg outline-none text-sm font-medium", dk ? "bg-transparent border border-white/10" : "bg-white border border-slate-200")} />
                           <span className="text-slate-400">➔</span>
                           <input type="date" value={tlEnd} onChange={e => {setTlEnd(e.target.value); setTlType('range');}} className={cn("flex-1 p-2 rounded-lg outline-none text-sm font-medium", dk ? "bg-transparent border border-white/10" : "bg-white border border-slate-200")} />
                        </div>
                      </div>
                      <div className="flex justify-center border-t border-slate-200 dark:border-white/10 pt-4">
                        <button onClick={() => {setTlType('all'); setTlStart(''); setTlEnd(''); closeMenu();}} className={cn("w-full py-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium", dk ? "border-teal-600 text-teal-500 hover:bg-teal-600/10" : "border-teal-600 text-teal-700 hover:bg-teal-50")}><Trash2 size={16}/> {lang === 'de' ? 'Zeitraum zurücksetzen' : 'Clear Timeline'}</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => { setShowTimelineMenu(false); setShowSortMenu(false); setShowFilterMenu(!showFilterMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", (fbType !== 'all' || filterPaid !== 'all' || filterDeposit !== 'all' || groupBy !== 'none') ? btnActive : btnInactive)}><Filter size={16} /> Filter</button>
                  {showFilterMenu && (
                    <div className={popupCls}>
                      <div className={popupHeader}><h3 className={popupTitle}>Filter</h3><button onClick={closeMenu} className="text-slate-400"><X size={20}/></button></div>
                      <div className="space-y-5">
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Freie Betten' : 'Free Beds'}</p>
                           <div className="grid grid-cols-2 gap-2 mb-2">
                             {[ { id: 'today', lEn: `Today (${fbCountToday})`, lDe: `Heute (${fbCountToday})` }, { id: 'tomorrow', lEn: `Tomorrow (${fbCountTomorrow})`, lDe: `Morgen (${fbCountTomorrow})` }, { id: '3days', lEn: `in 3 days (${fbCount3})`, lDe: `in 3 Tagen (${fbCount3})` }, { id: '7days', lEn: `in 7 days (${fbCount7})`, lDe: `in 7 Tagen (${fbCount7})` } ].map(f => <button key={f.id} onClick={() => setFbType(f.id as any)} className={cn("py-2 rounded-lg text-sm font-medium transition-all border", fbType === f.id ? btnActive : btnInactive)}>{lang === 'de' ? f.lDe : f.lEn}</button>)}
                           </div>
                         </div>
                         <div><p className={sectionTitle}>{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
                           <div className={segmentContainer}>{[{id:'all', lEn:'All', lDe:'Alle'}, {id:'paid', lEn:'Paid', lDe:'Bezahlt'}, {id:'unpaid', lEn:'Unpaid', lDe:'Unbezahlt'}].map(p => <button key={p.id} onClick={() => setFilterPaid(p.id as any)} className={segmentBtn(filterPaid === p.id)}>{lang === 'de' ? p.lDe : p.lEn}</button>)}</div>
                         </div>
                         <div><p className={sectionTitle}>{lang === 'de' ? 'Gruppieren' : 'Group'}</p>
                           <div className={segmentContainer}>{[{id:'none', lEn:'None', lDe:'Keine'}, {id:'hotel', lEn:'Hotel', lDe:'Hotel'}, {id:'company', lEn:'Company', lDe:'Firma'}, {id:'city', lEn:'City', lDe:'Stadt'}].map(g => <button key={g.id} onClick={() => setGroupBy(g.id as any)} className={segmentBtn(groupBy === g.id)}>{lang === 'de' ? g.lDe : g.lEn}</button>)}</div>
                         </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 mt-6 pt-4">
                        <button onClick={() => { setFilterPaid('all'); setFilterDeposit('all'); setGroupBy('none'); setFbType('all'); }} className={actionSecondary}>{lang === 'de' ? 'Alle löschen' : 'Clear All'}</button>
                        <button onClick={closeMenu} className={actionPrimary}>{lang === 'de' ? 'Anwenden' : 'Apply'}</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => { setShowTimelineMenu(false); setShowFilterMenu(false); setShowSortMenu(!showSortMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", (sortBy !== 'created_at' || sortDir !== 'desc') ? btnActive : btnInactive)}><ArrowUpDown size={16} /> Sort</button>
                  {showSortMenu && (
                    <div className={cn(popupCls, 'w-[420px]')}>
                      <div className={popupHeader}><h3 className={popupTitle}>Sort</h3><button onClick={closeMenu} className="text-slate-400"><X size={20}/></button></div>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {[ { id: 'name', lEn: 'Name' }, { id: 'cost', lEn: 'Cost' }, { id: 'free_beds', lEn: 'Free' }, { id: 'created_at', lEn: 'Newest' } ].map(s => <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-3 rounded-lg text-sm font-medium border transition-all", sortBy === s.id ? btnActive : btnInactive)}>{s.lEn}</button>)}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setSortDir('asc')} className={cn("py-3 rounded-lg border text-sm font-medium", sortDir === 'asc' ? btnActive : btnInactive)}>Asc</button>
                        <button onClick={() => setSortDir('desc')} className={cn("py-3 rounded-lg border text-sm font-medium", sortDir === 'desc' ? btnActive : btnInactive)}>Desc</button>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", showBookmarks ? btnActive : btnInactive)}><Star size={16} className={showBookmarks ? 'fill-white' : ''} /> Bookmarks</button>
                {!isStrictViewer && (
                  <button onClick={() => setAddingHotel(true)} className="ml-4 px-6 py-2.5 bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md active:scale-95"><Plus size={18} strokeWidth={2.5} /> Add Hotel</button>
                )}
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6 animate-in fade-in duration-200">
                <span className="text-xs font-bold text-slate-500 mr-2">Filters:</span>
                {activeFilters.map(af => (
                  <span key={af.id} className={cn("px-3 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-bold border", dk ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : "bg-teal-50 border-teal-200 text-teal-700")}>{af.label}: <span className="opacity-70 uppercase">{af.val}</span><button onClick={af.clear} className="hover:text-red-500 ml-1 transition-colors"><X size={12} strokeWidth={3} /></button></span>
                ))}
                <button onClick={() => { setTlType('all'); setFbType('all'); setFilterPaid('all'); setFilterDeposit('all'); setGroupBy('none'); setSortBy('created_at'); setSortDir('desc'); setShowBookmarks(false); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 ml-2 hover:underline">Clear All</button>
              </div>
            )}

            <div className="flex flex-col gap-6">
                {addingHotel && !isStrictViewer && (
                  <div className={cn('rounded-2xl border p-5 shadow-xl mb-4 animate-in slide-in-from-top duration-300', dk ? 'bg-[#1E293B] border-teal-500/30' : 'bg-white border-teal-500/30')}>
                    <div className="flex flex-wrap lg:flex-nowrap items-end gap-4 w-full">
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Hotel Name</label>
                        <input autoFocus className={cn('w-full h-[38px] px-3 rounded-lg border outline-none text-sm font-bold transition-all focus:border-teal-500', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder="Hotel..." />
                      </div>
                      <div className="flex-[0.8] min-w-[140px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">City</label>
                        <input className={cn('w-full h-[38px] px-3 rounded-lg border outline-none text-sm font-bold transition-all focus:border-teal-500', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelCity} onChange={e => setNewHotelCity(e.target.value)} placeholder="City..." />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Company</label>
                        <div className={cn('w-full min-h-[38px] rounded-lg border px-2 flex items-center transition-all', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200')}>
                          <CompanyMultiSelect selected={newHotelCompanyTags} options={allCompanyOptions} onChange={(v: string[]) => setNewHotelCompanyTags(v)} isDarkMode={dk} lang={lang} onDeleteOption={handleDeleteGlobalCompany} onAddOption={handleAddGlobalCompany} />
                        </div>
                      </div>
                      <div className="flex-[0.8] min-w-[120px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Country</label>
                        <ModernDropdown value={newHotelCountry} options={getCountryOptions()} onChange={(v: string) => setNewHotelCountry(v)} isDarkMode={dk} lang={lang} />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={handleSaveNewHotel} disabled={newHotelSaving || !newHotelName.trim()} className="px-5 h-[38px] bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm disabled:opacity-50 font-bold">{newHotelSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}</button>
                        <button onClick={() => setAddingHotel(false)} className={cn("px-4 h-[38px] rounded-lg flex items-center justify-center transition-all border", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}><X size={18} /></button>
                      </div>
                    </div>
                  </div>
                )}

                {groupBy !== 'none' && groupData ? (
                  Object.entries(groupData).map(([gName, hList]) => (
                    <div key={gName} className="space-y-4">
                       <div className={cn("px-6 py-4 rounded-xl border flex items-center justify-between", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                          <div className="flex items-center gap-4"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Group: {groupBy}</span><h3 className="text-xl font-bold">{gName}</h3></div>
                          <div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase">Value</p><p className="text-lg font-bold text-teal-600">{formatCurrency(hList.reduce((s,h)=>s+calcHotelTotalCost(h),0))}</p></div>
                       </div>
                       <div className="flex flex-col gap-4 pl-4 border-l-2 border-teal-500/30">{hList.map((h, i) => <HotelRow key={h.id} entry={h} index={i} isDarkMode={dk} lang={lang} searchQuery={searchQuery} companyOptions={allCompanyOptions} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(ho=>ho.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(ho=>ho.id===hId?{...ho,...up}:ho))} onDeleteCompanyOption={handleDeleteGlobalCompany} onAddOption={handleAddGlobalCompany} />)}</div>
                    </div>
                  ))
                ) : (
                  finalFiltered.map((hotel, index) => (
                    <HotelRow key={hotel.id} entry={hotel} index={index} isDarkMode={dk} lang={lang} searchQuery={searchQuery} companyOptions={allCompanyOptions} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(h=>h.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(h=>h.id===hId?{...h,...up}:h))} onDeleteCompanyOption={handleDeleteGlobalCompany} onAddOption={handleAddGlobalCompany} />
                  ))
                )}
                {!loading && finalFiltered.length === 0 && (
                  <div className="text-center py-20 opacity-50 flex flex-col items-center">
                     <Building size={48} className="mb-4 text-slate-400" />
                     <p className="text-lg font-bold">No hotels found</p>
                  </div>
                )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
