// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, exportToCSV, printDocument, calcHotelTotalCost, calcHotelFreeBedsToday } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, Star, Calendar, RefreshCw, MapPin, Building, Building2, CloudOff } from 'lucide-react';
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
  
  // Menu States
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Logic States
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'free_beds' | 'last_added' | 'last_updated'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'));
  
  // History / Undo
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Add Hotel
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
          durations: (h.durations || []).map((d: any) => ({
            ...d,
            hotelId: d.hotel_id,
            startDate: d.start_date,
            endDate: d.end_date,
            roomType: d.room_type,
            roomCards: (d.room_cards || []).map((rc: any) => ({
              ...rc,
              durationId: rc.duration_id,
              roomNo: rc.room_no,
              roomType: rc.room_type,
              bedCount: rc.bed_count,
              pricingTab: rc.pricing_tab ?? 'per_room',
              employees: (rc.employees || []).map((e: any) => ({
                ...e,
                slotIndex: e.slot_index ?? 0,
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

  const visibleHotels = useMemo(() => (!accessLevel || accessLevel.role === 'pending') ? [] : hotels, [hotels, accessLevel]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(hotels.flatMap(h => h.companyTag || []).filter(Boolean))), [hotels]);
  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);

  const finalFiltered = useMemo(() => {
    return visibleHotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery && !hotelMatchesSearch(h, searchQuery)) return false;
      return true;
    }).sort((a, b) => {
      let va = a.name?.toLowerCase(); let vb = b.name?.toLowerCase();
      if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [visibleHotels, searchQuery, showBookmarks, bookmarks, sortBy, sortDir]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  // STYLING VARIABLES
  const btnCls = (active: boolean) => cn(
    'px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all shadow-sm z-[100] relative',
    active ? 'bg-blue-500 text-white border-transparent' : dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
  );
  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500');

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} hotels={visibleHotels} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={() => exportToCSV(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} onPrint={() => printDocument(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} />
        
        {/* RESTORED: THE OFFLINE BANNER */}
        {(!isOnline || offlineMode) && (
           <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 px-6 py-2.5 text-xs font-black flex items-center justify-center gap-2 z-[60] relative animate-in slide-in-from-top duration-300">
             <CloudOff size={14} strokeWidth={3} /> {lang === 'de' ? 'OFFLINE MODUS AKTIV - ÄNDERUNGEN WERDEN LOKAL GESPEICHERT' : 'OFFLINE MODE ACTIVE - CHANGES SAVED LOCALLY'}
           </div>
        )}

        <div className={cn('px-8 py-4 border-b shrink-0 z-40 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
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
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6 relative scroll-smooth no-scrollbar">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap relative z-[100]">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>{selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}</h2>
            
            <div className="flex items-center gap-2">
              <button onClick={() => toggleMenu('timeline')} className={btnCls(tlType !== 'all')}><Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
              <button onClick={() => toggleMenu('filter')} className={btnCls(showFilterMenu)}><Filter size={16} /> Filter</button>
              <button onClick={() => toggleMenu('sort')} className={btnCls(showSortMenu)}><ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls(showBookmarks), showBookmarks && 'bg-yellow-500')}><Star size={16} className={showBookmarks ? 'fill-white' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}</button>
              {!isStrictViewer && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg transition-all transform active:scale-95">
                  <Plus size={18} strokeWidth={3} /> {lang === 'de' ? 'HOTEL HINZUFÜGEN' : 'ADD HOTEL'}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 pb-24 relative z-0">
              {finalFiltered.map((hotel, index) => (
                <HotelRow key={hotel.id} entry={hotel} index={index} isDarkMode={dk} lang={lang} searchQuery={searchQuery} companyOptions={uniqueCompanies} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(h=>h.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(h=>h.id===hId?{...h,...up}:h))} />
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
