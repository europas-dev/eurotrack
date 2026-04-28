// src/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { 
  cn, 
  formatCurrency, 
  hotelMatchesSearch, 
  calcHotelTotalCost, 
  calcHotelFreeBedsToday,
  calculateNights 
} from './lib/utils';
import { calcRoomCardNettoSum } from './lib/roomCardUtils';
import type { AccessLevel } from './lib/supabase';
import { 
  Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, 
  Star, Calendar, MapPin, Building, Building2, CloudOff, Globe, Trash2, Search 
} from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow, ModernDropdown, CompanyMultiSelect, getCountryOptions } from './components/HotelRow';
import ExportStudio from './components/ExportStudio';

// --- SYSTEM COMPANIES API ---
async function getSystemCompanies(): Promise<string[]> {
  const { data, error } = await supabase.from('global_companies').select('name').order('name');
  if (error) { 
    console.error("Global Companies Fetch Error:", error); 
    return []; 
  }
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

export default function Dashboard({ 
  theme, lang, toggleTheme, setLang, viewOnly = false, 
  accessLevel, onSignOut, offlineMode, onToggleOfflineMode 
}: DashboardProps) {
  const dk = theme === 'dark';
  const isStrictViewer = viewOnly || accessLevel?.role === 'viewer' || accessLevel?.role === 'pending';

  // --- UI CONSTANTS ---
  const btnActive = dk 
    ? 'bg-teal-600 text-white border-transparent' 
    : 'bg-white border-teal-600 text-teal-700 shadow-sm';
    
  const btnInactive = dk 
    ? 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10' 
    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';
    
  const popupCls = cn(
    'absolute z-[1000] mt-3 p-5 rounded-2xl border shadow-2xl w-[420px] text-sm animate-in fade-in slide-in-from-top-2 duration-200 right-0 lg:-right-10', 
    dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
  );
  
  const actionPrimary = cn(
    "px-5 py-2 rounded-lg font-bold transition-all", 
    dk ? "bg-teal-600 text-white hover:bg-teal-500" : "bg-teal-700 text-white hover:bg-teal-800"
  );
  
  const actionSecondary = "text-teal-600 dark:text-teal-400 text-sm font-medium hover:underline";
  
  const segmentContainer = cn(
    "flex p-1 rounded-xl", 
    dk ? "bg-black/20" : "bg-slate-100"
  );
  
  const segmentBtn = (active: boolean) => cn(
    "flex-1 py-1.5 text-sm font-medium rounded-lg transition-all", 
    active 
      ? (dk ? "bg-teal-600 text-white shadow-sm" : "bg-white text-teal-700 shadow-sm") 
      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
  );

  const [hotels, setHotels] = useState<any[]>([]);
  const [systemCompanies, setSystemCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [showStudio, setShowStudio] = useState(false);

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStart, setTlStart] = useState('');
  const [tlEnd, setTlEnd] = useState('');
  
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'yes' | 'no'>('all');
  
  // GROUPING STATE
  const [groupBy, setGroupBy] = useState<'none' | 'hotel' | 'company' | 'city' | 'country'>('none');
  const [activeGroupTab, setActiveGroupTab] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { 
      return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'); 
    } catch { 
      return []; 
    }
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

  // Dynamic Title Logic
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
    return () => { 
      window.removeEventListener('online', hO); 
      window.removeEventListener('offline', hOff); 
    };
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      try { 
        setBookmarks(JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]')); 
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 1000); 
    return () => { 
      window.removeEventListener('storage', handleStorage); 
      clearInterval(interval); 
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const channel = supabase.channel('dashboard_presence', { 
      config: { presence: { key: 'user' } } 
    });
    
    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      const state = channel.presenceState();
      const users = Object.values(state).flat().map((p: any) => p.user);
      const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
      
      const filteredUsers = uniqueUsers.filter((u: any) => {
        if (u.id === accessLevel?.id && accessLevel?.role === 'superadmin' && accessLevel?.invisible) {
          return false;
        }
        return true;
      });
      setActiveUsers(filteredUsers);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isMounted) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          await channel.track({ 
            user: { id: user.id, name, email: user.email } 
          });
        }
      }
    });

    return () => { 
      isMounted = false; 
      channel.unsubscribe(); 
      supabase.removeChannel(channel); 
    };
  }, [accessLevel]);

  // --- DATA FETCHING LOGIC ---
  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    setError(''); 
    
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 5000);

    async function fetchAllData() {
      try {
        const companies = await getSystemCompanies();
        const { data, error } = await supabase
          .from('hotels')
          .select('*, durations(*, room_cards(*, employees(*)), employees(*))')
          .eq('year', selectedYear)
          .order('created_at', { ascending: false });

        if (error) throw error; 

        const normalized = (data || []).map((h: any) => ({
          ...h, 
          companyTag: h.company_tag ?? [],
          isPaid: h.is_paid ?? false,
          rechnungNr: h.rechnung_nr ?? '',
          bookingId: h.booking_id ?? '',
          depositEnabled: h.deposit_enabled ?? false,
          depositAmount: h.deposit_amount ?? 0,
          useBruttoNetto: h.use_brutto_netto ?? true,
          hasDiscount: h.has_discount ?? false,
          discountType: h.discount_type ?? 'percentage',
          discountValue: h.discount_value ?? 0,

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
        console.error("Dashboard Load Error:", err);
        if (isMounted) setError(err.message || "Failed to load dashboard data."); 
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) setLoading(false);
      }
    }
    
    fetchAllData(); 
    return () => { 
        isMounted = false; 
        clearTimeout(safetyTimer);
    };
  }, [selectedYear]);

  const allCompanyOptions = useMemo(() => {
    const localTags = hotels.flatMap(h => h.companyTag || []).filter(Boolean);
    return Array.from(new Set([...systemCompanies, ...localTags]));
  }, [hotels, systemCompanies]);

  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);

  // DB HANDLERS
  const handleAddGlobalCompany = async (name: string) => {
    try {
      await addSystemCompany(name);
      setSystemCompanies(prev => Array.from(new Set([...prev, name])));
    } catch (err) { 
      console.error("Failed to add company globally", err); 
    }
  };

  const handleDeleteGlobalCompany = async (name: string) => {
    try {
      await deleteSystemCompany(name);
      setSystemCompanies(prev => prev.filter(c => c !== name));
    } catch (err) { 
      console.error("Failed to delete company from system", err); 
    }
  };

  const handleUndo = () => { 
    if (historyIndex > 0) { 
      setHistoryIndex(historyIndex - 1); 
      setHotels(history[historyIndex - 1]); 
    } 
  };

  const handleRedo = () => { 
    if (historyIndex < history.length - 1) { 
      setHistoryIndex(historyIndex + 1); 
      setHotels(history[historyIndex + 1]); 
    } 
  };

  function pushToHistory(next: any[]) { 
    const nH = history.slice(0, historyIndex + 1); 
    nH.push(next); 
    setHistory(nH); 
    setHistoryIndex(nH.length - 1); 
  }

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
      const next = [{ 
        ...h, companyTag: newHotelCompanyTags, durations: [], isPaid: false, rechnungNr: '', bookingId: '', depositEnabled: false, depositAmount: 0, useBruttoNetto: true, hasDiscount: false, discountType: 'percentage', discountValue: 0
      }, ...hotels]; 
      setHotels(next); pushToHistory(next); setAddingHotel(false); setNewHotelName(''); setNewHotelCity(''); setNewHotelCompanyTags([]); setNewHotelCountry('Germany');
    } catch (e: any) { alert(e.message); } finally { setNewHotelSaving(false); }
  }

  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (searchScope === 'hotel') { 
              if (!h.name?.toLowerCase().includes(q)) return false; 
          } else if (searchScope === 'city') { 
              if (!h.city?.toLowerCase().includes(q)) return false; 
          } else if (searchScope === 'company') { 
              if (!h.companyTag?.some((t:any) => t.toLowerCase().includes(q))) return false; 
          } else if (searchScope === 'invoice') { 
              const hotelInvMatch = h.rechnungNr?.toLowerCase().includes(q);
              const durationInvMatch = (h.durations || []).some((d:any) => d.rechnungNr?.toLowerCase().includes(q));
              if (!hotelInvMatch && !durationInvMatch) return false;
          } else if (searchScope === 'employee') {
              const hasEmp = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
              if (!hasEmp) return false;
          } else { 
              if (!hotelMatchesSearch(h, searchQuery, 'all')) return false;
          }
      }
      
      if (filterPaid === 'paid' && !h.isPaid) return false;
      if (filterPaid === 'unpaid' && h.isPaid) return false;
      
      return true;
    }).sort((a, b) => {
      let va: any; let vb: any;
      if (sortBy === 'bed_price') {
          const getMinPrice = (hotel: any) => {
              if (hotel.override_price_per_bed != null && hotel.override_price_per_bed > 0) return parseFloat(hotel.override_price_per_bed);
              let min = Infinity;
              hotel.durations?.forEach((d:any) => {
                  const nights = calculateNights(d.startDate, d.endDate);
                  d.roomCards?.forEach((c:any) => {
                      const beds = c.bedCount || 2;
                      const netto = calcRoomCardNettoSum(c, d.startDate, d.endDate);
                      if (beds > 0 && nights > 0 && netto > 0) {
                          const p = netto / (beds * nights);
                          if (p < min) min = p;
                      }
                  });
              });
              return min === Infinity ? 0 : min;
          };
          va = getMinPrice(a); vb = getMinPrice(b);
      } else {
          va = a.name?.toLowerCase(); vb = b.name?.toLowerCase();
      }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, searchScope, showBookmarks, bookmarks, sortBy, sortDir, filterPaid]);

  const groupData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, any[]> = {};
    finalFiltered.forEach(h => {
      const key = groupBy === 'company' 
        ? (h.companyTag?.[0] || (lang === 'de' ? 'Nicht zugeordnet' : 'Unassigned')) 
        : groupBy === 'city' ? (h.city || 'Other') : h.name;
      if (!groups[key]) groups[key] = []; 
      groups[key].push(h);
    });
    return groups;
  }, [finalFiltered, groupBy, lang]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  const closeMenu = () => { 
    setShowFilterMenu(false); 
    setShowTimelineMenu(false); 
    setShowSortMenu(false); 
  };

  const activeFilters = useMemo(() => {
    const badges = [];
    const fmt = (iso:string) => { if(!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}.${m}.${y}`; };
    
    if (tlType !== 'all') {
      badges.push({ id: 'tl', label: lang === 'de' ? 'Zeitraum' : 'Timeline', val: tlType === 'range' ? `${fmt(tlStart)} ➔ ${fmt(tlEnd)}` : tlType, clear: () => setTlType('all') });
    }
    if (filterPaid !== 'all') {
      badges.push({ id: 'paid', label: lang === 'de' ? 'Zahlung' : 'Payment', val: lang === 'de' ? (filterPaid === 'paid' ? 'Bezahlt' : 'Offen') : filterPaid, clear: () => setFilterPaid('all') });
    }
    if (groupBy !== 'none') {
      badges.push({ id: 'grp', label: lang === 'de' ? 'Gruppe' : 'Group', val: lang === 'de' && groupBy === 'company' ? 'Firma' : groupBy, clear: () => setGroupBy('none') });
    }
    if (sortBy !== 'created_at' || sortDir !== 'desc') {
        let label = sortBy.replace('_', ' ').toUpperCase();
        if (lang === 'de') {
          if (sortBy === 'bed_price') label = 'BETTPREIS';
          else if (sortBy === 'cost') label = 'GESAMTKOSTEN';
          else if (sortBy === 'name') label = 'HOTELNAME';
        }
        badges.push({ id: 'srt', label: lang === 'de' ? 'Sortierung' : 'Sort', val: `${label} (${sortDir === 'asc' ? (lang === 'de' ? 'AUF' : 'ASC') : (lang === 'de' ? 'AB' : 'DESC')})`, clear: () => setSortBy('created_at') });
    }
    return badges;
  }, [tlType, tlStart, tlEnd, filterPaid, groupBy, sortBy, sortDir, lang]);

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#0F172A]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} hotels={hotels} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={() => {}} onPrint={() => setShowStudio(true)} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} isOnline={true} />

        <div className={cn('px-8 py-5 border-b shrink-0 z-40 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center justify-between flex-wrap gap-4 w-full">
            <div className="flex items-center gap-12">
              <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'Freie Betten Heute' : 'Free Beds Today'}</p><p className={cn('text-3xl font-black', freeBedsTotal > 0 ? 'text-red-500' : 'text-slate-400')}>{freeBedsTotal}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'GESAMTKOSTEN' : 'TOTAL SPENT'}</p><p className="text-3xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(totalSpend)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Hotels</p><p className="text-3xl font-black">{finalFiltered.length}</p></div>
            </div>
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">{lang === 'de' ? 'Live dabei:' : 'Live now:'}</span>
                <div className="flex -space-x-3">
                  {activeUsers.map((u: any) => (
                    <div key={u.id} className="relative group cursor-pointer">
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-teal-600 flex items-center justify-center text-white text-sm font-bold shadow-md">{u.name.substring(0, 2).toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-8 relative no-scrollbar pb-64">
            <div className="flex items-center justify-between mb-4 flex-wrap z-[100] relative">
              <h2 className="text-2xl font-bold tracking-tight">{displayTitle}</h2>
              <div className="flex items-center gap-2">
                <div className={cn("flex items-center mr-2 rounded-xl p-1 border", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                  <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 disabled:opacity-30 transition-all"><Undo2 size={18}/></button>
                  <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 disabled:opacity-30 transition-all"><Redo2 size={18}/></button>
                </div>

                <div className="relative">
                  <button onClick={() => { closeMenu(); setShowTimelineMenu(!showTimelineMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", tlType !== 'all' ? btnActive : btnInactive)}><Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
                  {showTimelineMenu && (
                    <div className={popupCls}>
                      <div className="flex justify-between mb-5"><h3 className="text-lg font-bold">{lang === 'de' ? 'Zeitraum' : 'Timeline'}</h3><button onClick={closeMenu} className="text-slate-400"><X size={20}/></button></div>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {['today', 'tomorrow', '3days', '7days'].map(t => (
                          <button key={t} onClick={() => setTlType(t as any)} className={cn("py-2 rounded-lg text-xs font-medium border", tlType === t ? btnActive : btnInactive)}>
                            {lang === 'de' ? (t==='today'?'Heute':t==='tomorrow'?'Morgen':t==='3days'?'3 Tage':'7 Tage') : t}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 p-4 rounded-xl border bg-slate-50 dark:bg-black/20">
                         <input type="date" value={tlStart} onChange={e => setTlStart(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
                         <span>➔</span>
                         <input type="date" min={tlStart} value={tlEnd} onChange={e => {if(tlStart && e.target.value < tlStart) return; setTlEnd(e.target.value);}} className="flex-1 bg-transparent text-sm outline-none" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button onClick={() => { closeMenu(); setShowSortMenu(!showSortMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", sortBy !== 'created_at' ? btnActive : btnInactive)}><ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
                  {showSortMenu && (
                    <div className={popupCls}>
                      <div className="flex justify-between mb-5"><h3 className="text-lg font-bold">{lang === 'de' ? 'Sortieren' : 'Sort'}</h3><button onClick={closeMenu} className="text-slate-400"><X size={20}/></button></div>
                      <p className="text-xs text-slate-400 mb-2">{lang === 'de' ? 'Sortieren nach' : 'Sort By'}</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {[{id:'name', lEn:'Hotel Name', lDe:'Hotelname'}, {id:'cost', lEn:'Total Cost', lDe:'Gesamtkosten'}, {id:'bed_price', lEn:'Price/Bed', lDe:'Preis/Bett'}, {id:'free_beds', lEn:'Free Beds', lDe:'Freie Betten'}].map(s => (
                          <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-3 rounded-lg text-sm font-medium border", sortBy === s.id ? btnActive : btnInactive)}>
                            {lang === 'de' ? s.lDe : s.lEn}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{lang === 'de' ? 'Sortierreihenfolge' : 'Sort Direction'}</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <button onClick={() => setSortDir('asc')} className={cn("py-3 px-4 rounded-lg border text-left", sortDir === 'asc' ? btnActive : btnInactive)}>
                          <span className="block font-bold">{lang === 'de' ? 'Aufsteigend' : 'Ascending'}</span>
                          <span className="text-[10px] opacity-60">{lang === 'de' ? 'Low to High, A-Z, Günstigste' : 'Low to High, A-Z, Oldest'}</span>
                        </button>
                        <button onClick={() => setSortDir('desc')} className={cn("py-3 px-4 rounded-lg border text-left", sortDir === 'desc' ? btnActive : btnInactive)}>
                          <span className="block font-bold">{lang === 'de' ? 'Absteigend' : 'Descending'}</span>
                          <span className="text-[10px] opacity-60">{lang === 'de' ? 'High to Low, Z-A, Neueste' : 'High to Low, Z-A, Newest'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md active:scale-95">
                  <Plus size={18} strokeWidth={2.5} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                </button>
              </div>
            </div>

            {/* HORIZONTAL GROUP TABS */}
            {groupBy !== 'none' && groupData && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-white/10">
                {Object.keys(groupData).map(g => (
                  <button 
                    key={g} 
                    onClick={() => setActiveGroupTab(g === activeGroupTab ? null : g)} 
                    className={cn(
                      "px-5 py-2.5 rounded-t-xl text-sm font-bold border transition-all whitespace-nowrap", 
                      activeGroupTab === g ? "bg-teal-600 text-white border-teal-600" : "bg-white dark:bg-white/5 text-slate-500 border-transparent hover:bg-slate-100"
                    )}
                  >
                    {g} ({groupData[g].length})
                  </button>
                ))}
              </div>
            )}

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-xs font-bold text-slate-500 mr-2">{lang === 'de' ? 'Aktive Filter:' : 'Active Filters:'}</span>
                {activeFilters.map(af => (
                  <span key={af.id} className={cn("px-3 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-bold border", dk ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : "bg-teal-50 border-teal-200 text-teal-700")}>
                    {af.label}: <span className="opacity-70 uppercase">{af.val}</span>
                    <button onClick={af.clear} className="hover:text-red-500 ml-1 transition-colors"><X size={12} strokeWidth={3} /></button>
                  </span>
                ))}
                <button onClick={() => { setFilterPaid('all'); setGroupBy('none'); setSortBy('created_at'); setSortDir('desc'); }} className="text-xs font-bold text-slate-400 hover:underline ml-2">
                  {lang === 'de' ? 'Alle löschen' : 'Clear All'}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-6">
                {addingHotel && (
                  <div className="rounded-2xl border p-5 bg-white dark:bg-[#1E293B] shadow-xl">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">{lang === 'de' ? 'Hotelname' : 'Hotel Name'}</label>
                        <input autoFocus value={newHotelName} onChange={e => setNewHotelName(e.target.value)} className="w-full h-10 px-3 rounded-lg border dark:bg-black/20" />
                      </div>
                      <button onClick={handleSaveNewHotel} className="h-10 px-6 bg-teal-600 text-white font-bold rounded-lg">Save</button>
                      <button onClick={() => setAddingHotel(false)}><X/></button>
                    </div>
                  </div>
                )}
                
                {groupBy !== 'none' && groupData ? (
                  activeGroupTab ? (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                      {groupData[activeGroupTab].map((h, i) => (
                        <HotelRow key={h.id} entry={h} index={i} isDarkMode={dk} lang={lang} searchQuery={searchQuery} searchScope={searchScope} companyOptions={allCompanyOptions} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(ho=>ho.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(ho=>ho.id===hId?{...ho,...up}:ho))} onDeleteCompanyOption={handleDeleteGlobalCompany} onAddOption={handleAddGlobalCompany} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-400 font-medium">{lang === 'de' ? 'Wählen Sie einen Tab oben aus' : 'Select a tab above to view entries'}</div>
                  )
                ) : (
                  finalFiltered.map((hotel, index) => (
                    <HotelRow key={hotel.id} entry={hotel} viewOnly={isStrictViewer} index={index} isDarkMode={dk} lang={lang} searchQuery={searchQuery} searchScope={searchScope} companyOptions={allCompanyOptions} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(h=>h.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(h=>h.id===hId?{...h,...up}:h))} onDeleteCompanyOption={handleDeleteGlobalCompany} onAddOption={handleAddGlobalCompany} />
                  ))
                )}
            </div>
          </main>
      </div>
    </div>
  );
}
