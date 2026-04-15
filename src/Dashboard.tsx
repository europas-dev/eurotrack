// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, exportToCSV, printDocument, calcHotelTotalCost, calcHotelFreeBedsToday } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Undo2, Redo2, Star, Calendar, RefreshCw, MapPin, Building, Building2, CloudOff, Globe } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow, ModernDropdown, getCountryOptions } from './components/HotelRow';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  
  // MENU VISIBILITY
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // OPERATIONAL STATE
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStart, setTlStart] = useState(new Date().toISOString().split('T')[0]);
  const [tlEnd, setTlEnd] = useState(new Date().toISOString().split('T')[0]);
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
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

  useEffect(() => {
    const hO = () => setIsOnline(true); const hOff = () => setIsOnline(false);
    window.addEventListener('online', hO); window.addEventListener('offline', hOff);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hOff); }
  }, []);

  useEffect(() => { 
    let isM = true; setLoading(true);
    async function fetchHotels() {
      try {
        const { data, error: sErr } = await supabase.from('hotels').select('*, durations(*, room_cards(*, employees(*)), employees(*))').eq('year', selectedYear).order('created_at', { ascending: false });
        if (sErr) throw sErr;
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
        if (isM) { setHotels(normalized); setHistory([normalized]); setHistoryIndex(0); setLoading(false); }
      } catch (err: any) { if (isM) { setError(err.message); setLoading(false); } }
    }
    fetchHotels(); return () => { isM = false; };
  }, [selectedYear]);

  // CRITICAL FIX: Define constants before they are used in JSX
  const uniqueCompanies = useMemo(() => Array.from(new Set(hotels.flatMap(h => h.companyTag || []).filter(Boolean))), [hotels]);
  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);

  function pushToHistory(next: any[]) { const nH = history.slice(0, historyIndex + 1); nH.push(next); setHistory(nH); setHistoryIndex(nH.length - 1); }
  const handleUndo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setHotels(history[historyIndex - 1]); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setHotels(history[historyIndex + 1]); } };

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return; setNewHotelSaving(true);
    try {
      const h = await createHotel({ name: newHotelName.trim(), city: newHotelCity.trim()||null, companyTag: newHotelCompany ? [newHotelCompany.trim()] : [], country: newHotelCountry, year: selectedYear });
      const next = [{ ...h, durations: [] }, ...hotels]; setHotels(next); pushToHistory(next); setAddingHotel(false); setNewHotelName(''); setNewHotelCity(''); setNewHotelCompany('');
    } catch (e: any) { alert(e.message); } finally { setNewHotelSaving(false); }
  }

  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery && !hotelMatchesSearch(h, searchQuery)) return false;
      if (tlType !== 'all') {
         const hasOverlap = (h.durations || []).some((d: any) => d.startDate <= tlEnd && d.endDate >= tlStart);
         if (!hasOverlap) return false;
      }
      if (fbType !== 'all') { if (calcHotelFreeBedsToday(h) === 0) return false; }
      return true;
    }).sort((a, b) => {
      let va: any = a.name?.toLowerCase(); let vb: any = b.name?.toLowerCase();
      if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, showBookmarks, bookmarks, sortBy, sortDir, tlType, tlStart, tlEnd, fbType]);

  const groupData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, any[]> = {};
    finalFiltered.forEach(h => {
      const key = groupBy === 'company' ? (h.companyTag?.[0] || 'Unassigned') : groupBy === 'city' ? (h.city || 'Other') : groupBy === 'country' ? (h.country || 'Other') : h.name;
      if (!groups[key]) groups[key] = []; groups[key].push(h);
    });
    return groups;
  }, [finalFiltered, groupBy]);

  const totalSpend = finalFiltered.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  const btnCls = (active: boolean) => cn('px-4 py-2 rounded-xl border text-sm font-black flex items-center gap-2 transition-all shadow-sm z-50', active ? 'bg-blue-500 text-white border-transparent' : dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50');
  const menuCardCls = cn('fixed z-[1000] p-6 rounded-3xl border shadow-2xl animate-in fade-in zoom-in duration-200 w-96', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900');

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang} selectedYear={selectedYear} setSelectedYear={setSelectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} hotels={hotels} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchScope={searchScope} setSearchScope={setSearchScope} onSignOut={onSignOut} onExportCsv={() => exportToCSV(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} onPrint={() => printDocument(finalFiltered, calcHotelTotalCost, totalSpend, "Report", lang)} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} />
        
        {(!isOnline || offlineMode) && (
          <div className="bg-amber-500 border-b border-amber-600 text-white px-6 py-2.5 text-xs font-black flex items-center justify-center gap-2 z-[60] relative">
            <CloudOff size={14} strokeWidth={3} /> {lang === 'de' ? 'OFFLINE MODUS AKTIV' : 'OFFLINE MODE ACTIVE'}
          </div>
        )}

        <div className={cn('px-8 py-5 border-b shrink-0 z-40 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-12">
              <div><p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'Freie Betten Heute' : 'Free Beds Today'}</p><p className={cn('text-3xl font-black', freeBedsTotal > 0 ? 'text-emerald-500' : 'text-slate-400')}>{freeBedsTotal}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'Gesamtkosten' : 'Total Spent'}</p><p className="text-3xl font-black text-blue-500">{formatCurrency(totalSpend)}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Hotels</p><p className="text-3xl font-black">{finalFiltered.length}</p></div>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-8 relative no-scrollbar">
          <div className="flex items-center justify-between mb-8 gap-3 flex-wrap relative z-[100]">
            <h2 className="text-3xl font-black tracking-tighter">{lang === 'de' ? 'DASHBOARD' : 'DASHBOARD'} {selectedYear}</h2>
            
            <div className="flex items-center gap-2">
              <div className={cn("flex items-center mr-2 rounded-xl p-1 border", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2.5 rounded-lg hover:bg-blue-500/10 text-blue-500 disabled:opacity-20 transition-all"><Undo2 size={20}/></button>
                <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2.5 rounded-lg hover:bg-blue-500/10 text-blue-500 disabled:opacity-20 transition-all"><Redo2 size={20}/></button>
              </div>

              {/* TIMELINE OVERLAY */}
              <div className="relative">
                <button onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); setShowTimelineMenu(!showTimelineMenu); }} className={btnCls(tlType !== 'all')}><Calendar size={18} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
                {showTimelineMenu && (
                  <div className={cn(menuCardCls, 'right-0 top-14')}>
                    <div className="flex items-center justify-between mb-6"><span className="text-xs font-black uppercase tracking-widest opacity-50">{lang === 'de' ? 'Zeitraum Wählen' : 'Timeline Range'}</span><button onClick={() => setShowTimelineMenu(false)} className="hover:rotate-90 transition-all"><X size={20}/></button></div>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {['today', 'tomorrow', '3days', '7days'].map(t => <button key={t} onClick={() => { const d = new Date(); if(t==='tomorrow') d.setDate(d.getDate()+1); setTlStart(d.toISOString().split('T')[0]); setTlEnd(d.toISOString().split('T')[0]); setTlType(t as any); }} className={cn("px-4 py-2.5 rounded-xl text-[10px] font-black border transition-all", tlType === t ? "bg-blue-500 text-white border-transparent" : "border-white/10 hover:bg-white/5")}>{t.toUpperCase()}</button>)}
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1"><label className="text-[9px] font-bold uppercase opacity-40 ml-1">Start</label><input type="date" value={tlStart} onChange={e => { setTlStart(e.target.value); setTlType('range'); }} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500" /></div>
                      <div className="flex flex-col gap-1"><label className="text-[9px] font-bold uppercase opacity-40 ml-1">End</label><input type="date" value={tlEnd} onChange={e => { setTlEnd(e.target.value); setTlType('range'); }} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500" /></div>
                    </div>
                    <button onClick={() => { setTlType('all'); setShowTimelineMenu(false); }} className="w-full mt-8 text-xs font-black text-red-500 py-3 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all uppercase tracking-widest">{lang === 'de' ? 'Zurücksetzen' : 'Reset'}</button>
                  </div>
                )}
              </div>

              {/* FILTER OVERLAY */}
              <div className="relative">
                <button onClick={() => { setShowTimelineMenu(false); setShowSortMenu(false); setShowFilterMenu(!showFilterMenu); }} className={btnCls(showFilterMenu)}><Filter size={18} /> Filter</button>
                {showFilterMenu && (
                  <div className={cn(menuCardCls, 'right-0 top-14 w-[420px]')}>
                    <div className="flex items-center justify-between mb-6"><span className="text-xs font-black uppercase tracking-widest opacity-50">{lang === 'de' ? 'Filter & Gruppen' : 'Filter Options'}</span><button onClick={() => setShowFilterMenu(false)}><X size={20}/></button></div>
                    <div className="space-y-8">
                       <div><p className="text-[10px] font-black mb-3 opacity-40 uppercase tracking-widest">{lang === 'de' ? 'Freie Betten (Smart)' : 'Smart Availability'}</p>
                         <div className="flex flex-wrap gap-2">{['all', 'today', 'tomorrow', '7days'].map(f => <button key={f} onClick={() => setFbType(f as any)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black border transition-all", fbType === f ? "bg-blue-500 text-white" : "border-white/10 hover:bg-white/5")}>{f.toUpperCase()}</button>)}</div>
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                         <div><p className="text-[10px] font-black mb-3 opacity-40 uppercase tracking-widest">{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
                           <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5">{['all', 'paid', 'unpaid'].map(p => <button key={p} onClick={() => setFilterPaid(p as any)} className={cn("flex-1 py-2 text-[9px] font-black rounded-lg transition-all", filterPaid === p ? "bg-blue-500 text-white shadow-md" : "opacity-30 hover:opacity-100")}>{p.toUpperCase()}</button>)}</div>
                         </div>
                         <div><p className="text-[10px] font-black mb-3 opacity-40 uppercase tracking-widest">{lang === 'de' ? 'Gruppieren nach' : 'Group By'}</p>
                           <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-xs font-black outline-none focus:border-blue-500"><option value="none">None</option><option value="hotel">Hotel</option><option value="company">Company</option><option value="city">City</option><option value="country">Country</option></select>
                         </div>
                       </div>
                    </div>
                    <button onClick={() => { setFilterPaid('all'); setGroupBy('none'); setFbType('all'); setShowFilterMenu(false); }} className="w-full mt-10 text-xs font-black text-red-500 py-3 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all tracking-widest uppercase">{lang === 'de' ? 'Filter Löschen' : 'Clear Filters'}</button>
                  </div>
                )}
              </div>

              {/* SORT OVERLAY */}
              <div className="relative">
                <button onClick={() => { setShowTimelineMenu(false); setShowFilterMenu(false); setShowSortMenu(!showSortMenu); }} className={btnCls(showSortMenu)}><ArrowUpDown size={18} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
                {showSortMenu && (
                  <div className={cn(menuCardCls, 'right-0 top-14')}>
                    <div className="flex items-center justify-between mb-6"><span className="text-xs font-black uppercase tracking-widest opacity-50">{lang === 'de' ? 'Sortierung' : 'Sort Priority'}</span><button onClick={() => setShowSortMenu(false)}><X size={20}/></button></div>
                    <div className="space-y-2">{['name', 'cost', 'bed_price', 'free_beds', 'created_at'].map(s => <button key={s} onClick={() => { setSortBy(s as any); setShowSortMenu(false); }} className={cn("w-full px-5 py-3 rounded-2xl text-left text-xs font-black border transition-all", sortBy === s ? "bg-blue-500 text-white border-transparent shadow-lg" : "border-white/5 hover:bg-white/5")}>{s.replace('_',' ').toUpperCase()}</button>)}</div>
                    <button onClick={() => { setSortBy('name'); setSortDir('asc'); setShowSortMenu(false); }} className="w-full mt-8 text-xs font-black text-slate-400 py-3 border border-white/10 rounded-xl hover:text-white transition-all uppercase tracking-widest">{lang === 'de' ? 'Zurücksetzen' : 'Reset'}</button>
                  </div>
                )}
              </div>

              <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn(btnCls(showBookmarks), showBookmarks && 'bg-yellow-500 text-white border-transparent')}><Star size={18} className={showBookmarks ? 'fill-white' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}</button>
              
              {!isStrictViewer && (
                <button onClick={() => setAddingHotel(true)} className="ml-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl flex items-center gap-2 text-sm shadow-xl transition-all active:scale-95">
                  <Plus size={20} strokeWidth={4} /> {lang === 'de' ? 'HOTEL HINZUFÜGEN' : 'ADD HOTEL'}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 pb-40">
              {addingHotel && !isStrictViewer && (
                <div className={cn('rounded-3xl border-2 p-6 shadow-2xl mb-4 animate-in slide-in-from-top duration-300', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
                  <div className="flex flex-wrap lg:flex-nowrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-black uppercase opacity-50 mb-1">{lang === 'de' ? 'Hotelname' : 'Hotel Name'}</label><input autoFocus className={cn('w-full px-4 py-3 rounded-xl border-2 outline-none text-sm font-bold transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/5 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder="Riveria..." /></div>
                    <div className="w-48"><label className="text-[10px] font-black uppercase opacity-50 mb-1"><MapPin size={10}/> {lang === 'de' ? 'Stadt' : 'City'}</label><input className={cn('w-full px-4 py-3 rounded-xl border-2 outline-none text-sm font-bold transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/5 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelCity} onChange={e => setNewHotelCity(e.target.value)} placeholder="Essen..." /></div>
                    <div className="w-64"><label className="text-[10px] font-black uppercase opacity-50 mb-1"><Building2 size={10}/> {lang === 'de' ? 'Firma' : 'Company'}</label><ModernDropdown value={newHotelCompany} options={uniqueCompanies} onChange={v => setNewHotelCompany(v)} isDarkMode={dk} lang={lang} /></div>
                    <div className="w-48"><label className="text-[10px] font-black uppercase opacity-50 mb-1"><Globe size={10}/> {lang === 'de' ? 'Land' : 'Country'}</label><ModernDropdown value={newHotelCountry} options={getCountryOptions()} onChange={v => setNewHotelCountry(v)} isDarkMode={dk} lang={lang} /></div>
                    <div className="flex gap-2 shrink-0"><button onClick={handleSaveNewHotel} disabled={newHotelSaving || !newHotelName.trim()} className="px-6 h-[50px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg disabled:opacity-50 font-black">{newHotelSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}</button><button onClick={() => setAddingHotel(false)} className={cn("px-4 h-[50px] rounded-xl flex items-center justify-center transition-all border-2", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}><X size={20} /></button></div>
                  </div>
                </div>
              )}

              {/* GROUPING VIEW OR LIST VIEW */}
              {groupBy !== 'none' && groupData ? (
                Object.entries(groupData).map(([gName, hList]) => (
                  <div key={gName} className="space-y-4">
                     <div className={cn("px-6 py-4 rounded-2xl border-2 flex items-center justify-between", dk ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                        <div className="flex items-center gap-4"><span className="text-xs font-black uppercase tracking-widest opacity-40">{groupBy.toUpperCase()}</span><h3 className="text-xl font-black">{gName}</h3><span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-black">{hList.length} Hotels</span></div>
                        <div className="text-right"><p className="text-[9px] font-black opacity-40 uppercase">{lang === 'de' ? 'Gesamtwert Gruppe' : 'Group Total Value'}</p><p className="text-lg font-black text-blue-500">{formatCurrency(hList.reduce((s,h)=>s+calcHotelTotalCost(h),0))}</p></div>
                     </div>
                     <div className="flex flex-col gap-4 pl-4 border-l-4 border-blue-500/20">{hList.map((h, i) => <HotelRow key={h.id} entry={h} index={i} isDarkMode={dk} lang={lang} searchQuery={searchQuery} companyOptions={uniqueCompanies} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(ho=>ho.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(ho=>ho.id===hId?{...ho,...up}:ho))} />)}</div>
                  </div>
                ))
              ) : (
                finalFiltered.map((hotel, index) => (
                  <HotelRow key={hotel.id} entry={hotel} index={index} isDarkMode={dk} lang={lang} searchQuery={searchQuery} companyOptions={uniqueCompanies} cityOptions={uniqueCities} onDelete={hId => setHotels(hotels.filter(h=>h.id!==hId))} onUpdate={(hId, up) => setHotels(hotels.map(h=>h.id===hId?{...h,...up}:h))} />
                ))
              )}
          </div>
        </main>
      </div>
    </div>
  );
}
