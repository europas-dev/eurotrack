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
  
  // Menu Visibility
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // States
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'created_at'>('name');
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

        // RESTORED FULL MAPPING: Fixes the missing Price/Bed/Employee bug
        const normalizedData = (data || []).map((h: any) => ({
          ...h,
          companyTag: h.company_tag ?? [],
          durations: (h.durations || []).map((d: any) => ({
            ...d,
            hotelId: d.hotel_id, startDate: d.start_date, endDate: d.end_date, roomType: d.room_type,
            numberOfRooms: d.number_of_rooms, pricePerNightPerRoom: d.price_per_night_per_room,
            useManualPrices: d.use_manual_prices, nightlyPrices: d.nightly_prices,
            useBruttoNetto: d.use_brutto_netto, hasDiscount: d.has_discount,
            discountType: d.discount_type, discountValue: d.discount_value,
            isPaid: d.is_paid, rechnungNr: d.rechnung_nr, bookingId: d.booking_id,
            depositEnabled: d.deposit_enabled, depositAmount: d.deposit_amount,
            roomCards: (d.room_cards || []).map((rc: any) => ({
              ...rc,
              durationId: rc.duration_id, roomNo: rc.room_no, roomType: rc.room_type, bedCount: rc.bed_count,
              pricingTab: rc.pricing_tab ?? 'per_room',
              roomNetto: rc.room_netto, roomMwst: rc.room_mwst, roomBrutto: rc.room_brutto,
              bedNetto: rc.bed_netto, bedMwst: rc.bed_mwst, bedBrutto: rc.bed_brutto,
              totalNetto: rc.total_netto, totalMwst: rc.total_mwst, totalBrutto: rc.total_brutto,
              roomEnergyNetto: rc.room_energy_netto, roomEnergyMwst: rc.room_energy_mwst, roomEnergyBrutto: rc.room_energy_brutto,
              bedEnergyNetto: rc.bed_energy_netto, bedEnergyMwst: rc.bed_energy_mwst, bedEnergyBrutto: rc.bed_energy_brutto,
              totalEnergyNetto: rc.total_energy_netto, totalEnergyMwst: rc.total_energy_mwst, totalEnergyBrutto: rc.total_energy_brutto,
              hasDiscount: rc.has_discount, discountType: rc.discount_type, discountValue: rc.discount_value,
              employees: (rc.employees || []).map((e: any) => ({
                ...e, slotIndex: e.slot_index ?? 0, checkIn: e.checkin, checkOut: e.checkout
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

  // STYLING
  const btnCls = (active: boolean) => cn(
    'px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all shadow-sm relative z-[100]',
    active ? 'bg-blue-500 text-white border-transparent' : dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
  );

  const menuCardCls = cn(
    'fixed z-[999] mt-2 p-4 rounded-2xl border shadow-2xl animate-in fade-in zoom-in duration-200',
    dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
  );

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} hotels={visibleHotels} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={() => exportToCSV(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} onPrint={() => printDocument(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} />
        
        {/* BANNER RESTORED */}
        {(!isOnline || offlineMode) && (
           <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 px-6 py-2.5 text-xs font-black flex items-center justify-center gap-2 z-[60] relative">
             <CloudOff size={14} strokeWidth={3} /> {lang === 'de' ? 'OFFLINE MODUS AKTIV' : 'OFFLINE MODE ACTIVE'}
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

        <main className="flex-1 overflow-y-auto p-6 relative no-scrollbar">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap relative z-[100]">
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>{selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : `Dashboard ${selectedYear}`}</h2>
            
            <div className="flex items-center gap-2 relative">
              {/* TIMELINE MENU */}
              <div className="relative">
                <button onClick={() => toggleMenu('timeline')} className={btnCls(showTimelineMenu || tlType !== 'all')}><Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
                {showTimelineMenu && (
                  <div className={cn(menuCardCls, 'right-0 w-64')}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-50">Select Range</p>
                    <div className="grid grid-cols-1 gap-2">
                       {['all', 'today', 'tomorrow', '7days'].map(t => (
                         <button key={t} onClick={() => {setTlType(t as any); setShowTimelineMenu(false);}} className={cn("px-4 py-2 rounded-lg text-left text-sm font-bold", tlType === t ? "bg-blue-500 text-white" : "hover:bg-white/10")}>{t.toUpperCase()}</button>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              {/* FILTER MENU */}
              <div className="relative">
                <button onClick={() => toggleMenu('filter')} className={btnCls(showFilterMenu)}><Filter size={16} /> Filter</button>
                {showFilterMenu && (
                  <div className={cn(menuCardCls, 'right-0 w-64')}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-50">Filter Options</p>
                    <div className="space-y-4">
                       <div>
                         <p className="text-xs font-bold mb-2">Payment Status</p>
                         <div className="flex gap-2">
                           <button onClick={() => setSortBy('name')} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold">All</button>
                           <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold opacity-50">Paid</button>
                         </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SORT MENU */}
              <div className="relative">
                <button onClick={() => toggleMenu('sort')} className={btnCls(showSortMenu)}><ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
                {showSortMenu && (
                  <div className={cn(menuCardCls, 'right-0 w-64')}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-50">Sort By</p>
                    <div className="space-y-2">
                       {['name', 'cost', 'created_at'].map(s => (
                         <button key={s} onClick={() => {setSortBy(s as any); setShowSortMenu(false);}} className={cn("w-full px-4 py-2 rounded-lg text-left text-sm font-bold", sortBy === s ? "bg-blue-500 text-white" : "hover:bg-white/10")}>{s.replace('_',' ').toUpperCase()}</button>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls(showBookmarks), showBookmarks && 'bg-yellow-500 text-white')}><Star size={16} className={showBookmarks ? 'fill-white' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}</button>
              
              {!isStrictViewer && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg transition-all">
                  <Plus size={18} strokeWidth={3} /> {lang === 'de' ? 'HOTEL HINZÜFUGEN' : 'ADD HOTEL'}
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
