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
  
  // Menu Visibility States
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Operational States
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStart, setTlStart] = useState(new Date().toISOString().split('T')[0]);
  const [tlEnd, setTlEnd] = useState(new Date().toISOString().split('T')[0]);
  
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'with' | 'without'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'hotel' | 'company' | 'city' | 'country'>('none');

  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'created_at'>('name');
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

  // Undo/Redo Logic
  const handleUndo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setHotels(history[historyIndex - 1]); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setHotels(history[historyIndex + 1]); } };

  const visibleHotels = useMemo(() => (!accessLevel || accessLevel.role === 'pending') ? [] : hotels, [hotels, accessLevel]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(hotels.flatMap(h => h.companyTag || []).filter(Boolean))), [hotels]);
  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);

  const finalFiltered = useMemo(() => {
    return visibleHotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery && !hotelMatchesSearch(h, searchQuery)) return false;
      // Timeline filter logic
      if (tlType !== 'all') {
         const hasOverlap = (h.durations || []).some((d: any) => {
           if (!d.startDate || !d.endDate) return false;
           return d.startDate <= tlEnd && d.endDate >= tlStart;
         });
         if (!hasOverlap) return false;
      }
      return true;
    }).sort((a, b) => {
      let va: any = a.name?.toLowerCase(); let vb: any = b.name?.toLowerCase();
      if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      if (sortBy === 'created_at') { va = a.created_at; vb = b.created_at; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [visibleHotels, searchQuery, showBookmarks, bookmarks, sortBy, sortDir, tlType, tlStart, tlEnd]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  // STYLING HELPERS
  const btnCls = (active: boolean) => cn(
    'px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all shadow-sm relative',
    active ? 'bg-blue-500 text-white border-transparent' : dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
  );

  const menuCardCls = cn(
    'fixed z-[999] p-5 rounded-3xl border shadow-2xl animate-in fade-in zoom-in duration-200 w-80',
    dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
  );

  const closeMenu = () => { setShowFilterMenu(false); setShowTimelineMenu(false); setShowSortMenu(false); };

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} hotels={visibleHotels} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={() => exportToCSV(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} onPrint={() => printDocument(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} />
        
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
            <h2 className={cn('text-2xl font-black tracking-tight', dk ? 'text-white' : 'text-slate-900')}>{lang === 'de' ? 'Dashboard' : 'Dashboard'} {selectedYear}</h2>
            
            <div className="flex items-center gap-2">
              {/* UNDO / REDO PILL */}
              <div className={cn("flex items-center mr-2 rounded-xl p-1 border", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 disabled:opacity-20"><Undo2 size={18}/></button>
                <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 disabled:opacity-20"><Redo2 size={18}/></button>
              </div>

              {/* TIMELINE */}
              <div className="relative">
                <button onClick={() => { closeMenu(); setShowTimelineMenu(!showTimelineMenu); }} className={btnCls(tlType !== 'all')}><Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
                {showTimelineMenu && (
                  <div className={cn(menuCardCls, 'right-0 top-12')}>
                    <div className="flex items-center justify-between mb-4"><span className="text-xs font-black uppercase tracking-widest opacity-50">{lang === 'de' ? 'Zeitraum wählen' : 'Timeline Range'}</span><button onClick={closeMenu}><X size={16}/></button></div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {['today', 'tomorrow', '3days', '7days'].map(t => <button key={t} onClick={() => setTlType(t as any)} className={cn("px-3 py-2 rounded-lg text-xs font-bold border", tlType === t ? "bg-blue-500 text-white" : "border-white/10")}>{t.toUpperCase()}</button>)}
                    </div>
                    <div className="space-y-2">
                      <input type="date" value={tlStart} onChange={e => {setTlStart(e.target.value); setTlType('range');}} className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-sm" />
                      <input type="date" value={tlEnd} onChange={e => {setTlEnd(e.target.value); setTlType('range');}} className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-sm" />
                    </div>
                    <button onClick={() => {setTlType('all'); closeMenu();}} className="w-full mt-4 text-xs font-bold text-red-400 py-2 border border-red-400/20 rounded-lg">{lang === 'de' ? 'Zurücksetzen' : 'Reset'}</button>
                  </div>
                )}
              </div>

              {/* FILTER */}
              <div className="relative">
                <button onClick={() => { closeMenu(); setShowFilterMenu(!showFilterMenu); }} className={btnCls(filterPaid !== 'all' || groupBy !== 'none' || fbType !== 'all')}><Filter size={16} /> Filter</button>
                {showFilterMenu && (
                  <div className={cn(menuCardCls, 'right-0 top-12 w-96')}>
                    <div className="flex items-center justify-between mb-4"><span className="text-xs font-black uppercase tracking-widest opacity-50">{lang === 'de' ? 'Filter & Gruppen' : 'Filter Options'}</span><button onClick={closeMenu}><X size={16}/></button></div>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold mb-2 opacity-50 uppercase">{lang === 'de' ? 'Freie Betten (Vorschau)' : 'Smart Availability'}</p>
                        <div className="flex flex-wrap gap-2">{['all', 'today', 'tomorrow', '7days'].map(f => <button key={f} onClick={() => setFbType(f as any)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black border", fbType === f ? "bg-blue-500 text-white" : "border-white/10")}>{f.toUpperCase()}</button>)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-[10px] font-bold mb-2 opacity-50 uppercase">{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
                          <div className="flex bg-black/20 p-1 rounded-lg">
                            {['all', 'paid', 'unpaid'].map(p => <button key={p} onClick={() => setFilterPaid(p as any)} className={cn("flex-1 py-1 text-[10px] font-black rounded-md", filterPaid === p ? "bg-blue-500 text-white" : "opacity-40")}>{p.toUpperCase()}</button>)}
                          </div>
                        </div>
                        <div><p className="text-[10px] font-bold mb-2 opacity-50 uppercase">{lang === 'de' ? 'Gruppieren' : 'Group By'}</p>
                          <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-xs font-bold outline-none">
                            <option value="none">None</option><option value="hotel">Hotel</option><option value="company">Company</option><option value="city">City</option><option value="country">Country</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => {setFilterPaid('all'); setGroupBy('none'); setFbType('all'); closeMenu();}} className="w-full mt-6 text-xs font-bold text-red-400 py-2 border border-red-400/20 rounded-lg">{lang === 'de' ? 'Filter löschen' : 'Clear Filters'}</button>
                  </div>
                )}
              </div>

              {/* SORT */}
              <div className="relative">
                <button onClick={() => { closeMenu(); setShowSortMenu(!showSortMenu); }} className={btnCls(showSortMenu)}><ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
                {showSortMenu && (
                  <div className={cn(menuCardCls, 'right-0 top-12')}>
                    <div className="flex items-center justify-between mb-4"><span className="text-xs font-black uppercase tracking-widest opacity-50">{lang === 'de' ? 'Sortierung' : 'Sort Options'}</span><button onClick={closeMenu}><X size={16}/></button></div>
                    <div className="space-y-2">
                       {['name', 'cost', 'bed_price', 'free_beds', 'created_at'].map(s => (
                         <button key={s} onClick={() => {setSortBy(s as any); closeMenu();}} className={cn("w-full px-4 py-2.5 rounded-xl text-left text-xs font-black border transition-all", sortBy === s ? "bg-blue-500 text-white border-transparent" : "border-white/5 hover:bg-white/5")}>{s.replace('_',' ').toUpperCase()}</button>
                       ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls(showBookmarks), showBookmarks && 'bg-yellow-500 text-white border-transparent')}><Star size={16} className={showBookmarks ? 'fill-white' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}</button>
              
              {!isStrictViewer && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center gap-2 text-sm shadow-lg transition-all active:scale-95">
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
