// src/Dashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, createHotel } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, calcHotelTotalCost, calcHotelFreeBedsToday, calculateNights } from './lib/utils';
import { calcRoomCardNettoSum, calcRoomCardTotal } from './lib/roomCardUtils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Star, Calendar, MapPin, Building, Building2, CloudOff, Globe, Trash2, Copy, Eye, EyeOff, ChevronDown, Download } from 'lucide-react';
import Header from './components/Header';
import { HotelRow, ModernDropdown, CompanyMultiSelect, getCountryOptions } from './components/HotelRow';
import ExportStudio from './components/ExportStudio';

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
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [showStudio, setShowStudio] = useState(false);

  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null);
  const [showGlobalFinancials, setShowGlobalFinancials] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
  const [activeGroupTab, setActiveGroupTab] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'payment_due' | 'total_paid' | 'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'); } catch { return []; } });
  
  const [addingHotel, setAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelCompanyTags, setNewHotelCompanyTags] = useState<string[]>([]);
  const [newHotelCountry, setNewHotelCountry] = useState('Germany'); 
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const displayTitle = selectedMonth !== 'all' 
    ? `${lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth]} ${selectedYear}`
    : `${lang === 'de' ? 'Dashboard' : 'Dashboard'} ${selectedYear}`;

  useEffect(() => {
    const hO = () => setIsOnline(true); const hOff = () => setIsOnline(false);
    window.addEventListener('online', hO); window.addEventListener('offline', hOff);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hOff); };
  }, []);

  useEffect(() => {
    const handleStorage = () => { try { setBookmarks(JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]')); } catch {} };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 1000); 
    return () => { window.removeEventListener('storage', handleStorage); clearInterval(interval); };
  }, []);

  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    setError(''); 
    
    async function fetchAllData() {
      try {
        const companies = await getSystemCompanies();
        const { data, error } = await supabase.from('hotels').select('*, durations(*, room_cards(*, employees(*)), employees(*))').eq('year', selectedYear).order('created_at', { ascending: false });
        if (error) throw error; 

        const normalized = (data || []).map((h: any) => ({
          ...h, companyTag: h.company_tag ?? [], isPaid: h.is_paid ?? false, rechnungNr: h.rechnung_nr ?? '', bookingId: h.booking_id ?? '', depositEnabled: h.deposit_enabled ?? false, depositAmount: h.deposit_amount ?? 0, useBruttoNetto: h.use_brutto_netto ?? true, hasDiscount: h.has_discount ?? false, discountType: h.discount_type ?? 'percentage', discountValue: h.discount_value ?? 0,
          durations: (h.durations || []).map((d: any) => ({
            ...d, hotelId: d.hotel_id, startDate: d.start_date, endDate: d.end_date, roomType: d.room_type, numberOfRooms: d.number_of_rooms, pricePerNightPerRoom: d.price_per_night_per_room, useManualPrices: d.use_manual_prices, nightlyPrices: d.nightly_prices, useBruttoNetto: d.use_brutto_netto, hasDiscount: d.has_discount, discountType: d.discount_type, discountValue: d.discount_value, isPaid: d.is_paid, rechnungNr: d.rechnung_nr, bookingId: d.booking_id, depositEnabled: d.deposit_enabled, depositAmount: d.deposit_amount,
            roomCards: (d.room_cards || []).map((rc: any) => ({
              ...rc, durationId: rc.duration_id, roomNo: rc.room_no, roomType: rc.room_type, bedCount: rc.bed_count, pricingTab: rc.pricing_tab ?? 'per_room', roomNetto: rc.room_netto, roomMwst: rc.room_mwst, roomBrutto: rc.room_brutto, bedNetto: rc.bed_netto, bedMwst: rc.bed_mwst, bedBrutto: rc.bed_brutto, totalNetto: rc.total_netto, totalMwst: rc.total_mwst, totalBrutto: rc.total_brutto, roomEnergyNetto: rc.room_energy_netto, roomEnergyMwst: rc.room_energy_mwst, roomEnergyBrutto: rc.room_energy_brutto, bedEnergyNetto: rc.bed_energy_netto, bedEnergyMwst: rc.bed_energy_mwst, bedEnergyBrutto: rc.bed_energy_brutto, totalEnergyNetto: rc.total_energy_netto, totalEnergyMwst: rc.total_energy_mwst, totalEnergyBrutto: rc.total_energy_brutto, hasDiscount: rc.has_discount, discountType: rc.discount_type, discountValue: rc.discount_value, basePrice: rc.base_price, baseRoomPrice: rc.base_room_price, baseEnergyPrice: rc.base_energy_price, baseNights: rc.base_nights, lastSyncedEndDate: rc.last_synced_end_date,
              employees: (rc.employees || []).map((e: any) => ({ ...e, slotIndex: e.slot_index ?? 0, checkIn: e.checkin, checkOut: e.checkout }))
            }))
          }))
        }));

        if (isMounted) { setSystemCompanies(companies); setHotels(normalized); }
      } catch (err: any) { if (isMounted) setError(err.message || "Failed to load dashboard data."); } finally { if (isMounted) setLoading(false); }
    }
    fetchAllData(); 
    return () => { isMounted = false; };
  }, [selectedYear]);

  const allCompanyOptions = useMemo(() => Array.from(new Set([...systemCompanies, ...hotels.flatMap(h => h.companyTag || []).filter(Boolean)])), [hotels, systemCompanies]);
  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);
  const uniqueHotelNames = useMemo(() => Array.from(new Set(hotels.map(h => h.name).filter(Boolean))), [hotels]);
  const uniqueEmployeeNames = useMemo(() => {
    const names = new Set<string>();
    hotels.forEach(h => h.durations?.forEach((d:any) => d.roomCards?.forEach((rc:any) => rc.employees?.forEach((e:any) => { if (e.name) names.add(e.name); }))));
    return Array.from(names);
  }, [hotels]);

  const handleAddGlobalCompany = async (name: string) => { try { await addSystemCompany(name); setSystemCompanies(prev => Array.from(new Set([...prev, name]))); } catch (err) {} };
  const handleDeleteGlobalCompany = async (name: string) => { try { await deleteSystemCompany(name); setSystemCompanies(prev => prev.filter(c => c !== name)); } catch (err) {} };

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return; 
    setNewHotelSaving(true);
    try {
      const h = await createHotel({ name: newHotelName.trim(), city: newHotelCity.trim() || null, companyTag: newHotelCompanyTags, company_tag: newHotelCompanyTags, country: newHotelCountry, year: selectedYear });
      const next = [{ ...h, companyTag: newHotelCompanyTags, durations: [], isPaid: false, rechnungNr: '', bookingId: '', depositEnabled: false, depositAmount: 0, useBruttoNetto: true, hasDiscount: false, discountType: 'percentage', discountValue: 0 }, ...hotels]; 
      setHotels(next); setAddingHotel(false); setNewHotelName(''); setNewHotelCity(''); setNewHotelCompanyTags([]); setNewHotelCountry('Germany');
    } catch (e: any) { alert(e.message); } finally { setNewHotelSaving(false); }
  }

  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (searchScope === 'hotel') { if (!h.name?.toLowerCase().includes(q)) return false; } 
          else if (searchScope === 'city') { if (!h.city?.toLowerCase().includes(q)) return false; } 
          else if (searchScope === 'company') { if (!h.companyTag?.some((t:any) => t.toLowerCase().includes(q))) return false; } 
          else if (searchScope === 'invoice') { 
              const hotelInvMatch = h.rechnungNr?.toLowerCase().includes(q) || (h.invoices || []).some((inv: any) => inv.number?.toLowerCase().includes(q));
              const durationInvMatch = (h.durations || []).some((d:any) => d.rechnungNr?.toLowerCase().includes(q));
              if (!hotelInvMatch && !durationInvMatch) return false;
          } else if (searchScope === 'employee') {
              const hasEmp = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
              if (!hasEmp) return false;
          } else { 
              const matchAll = hotelMatchesSearch(h, searchQuery, 'all');
              const deepInvoiceMatch = h.rechnungNr?.toLowerCase().includes(q) || (h.invoices || []).some((inv: any) => inv.number?.toLowerCase().includes(q)) || (h.durations || []).some((d:any) => d.rechnungNr?.toLowerCase().includes(q));
              const deepEmployeeMatch = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
              if (!matchAll && !deepInvoiceMatch && !deepEmployeeMatch) return false;
          }
      }
      
      if (selectedMonth !== 'all') {
        const mStart = new Date(selectedYear, selectedMonth, 1);
        const mEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const hasDuration = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate);
          const dEnd = new Date(d.endDate);
          const lastNight = new Date(dEnd.getTime() - 86400000);
          return dStart <= mEnd && lastNight >= mStart;
        });

        const hasInvoice = (h.invoices || []).some((inv: any) => {
          const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });

        if (!hasDuration && !hasInvoice) return false;
      }

      if (tlType !== 'all' && tlStart && tlEnd) {
         const hasOverlap = (h.durations || []).some((d: any) => d.startDate <= tlEnd && d.endDate >= tlStart);
         if (!hasOverlap) return false;
      }

      if (filterPaid === 'paid' && !h.isPaid) return false;
      if (filterPaid === 'unpaid' && h.isPaid) return false;
      if (filterDeposit === 'yes' && !h.depositEnabled) return false;
      if (filterDeposit === 'no' && h.depositEnabled) return false;
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
                      const beds = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
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
      } 
      else if (sortBy === 'cost') { va = calcHotelTotalCost(a, selectedMonth !== 'all' ? selectedMonth : null, selectedYear); vb = calcHotelTotalCost(b, selectedMonth !== 'all' ? selectedMonth : null, selectedYear); }
      else if (sortBy === 'free_beds') { va = calcHotelFreeBedsToday(a); vb = calcHotelFreeBedsToday(b); }
      else if (sortBy === 'created_at') { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); }
      else if (sortBy === 'updated_at') { va = new Date(a.last_updated_at || a.lastUpdatedAt || 0).getTime(); vb = new Date(b.last_updated_at || b.lastUpdatedAt || 0).getTime(); }
      else if (sortBy === 'payment_due') {
          const getNextDue = (hotel: any) => {
             const unpaids = (hotel.invoices || []).filter((i:any) => !i.isPaid && i.dueDate).map((i:any) => new Date(i.dueDate).getTime());
             return unpaids.length > 0 ? Math.min(...unpaids) : Infinity;
          };
          va = getNextDue(a); vb = getNextDue(b);
      }
      else if (sortBy === 'total_paid') {
          const getPaid = (hotel: any) => (hotel.invoices || []).filter((i:any) => i.isPaid).reduce((sum:number, i:any) => sum + (parseFloat(i.totalBrutto) || 0), 0);
          va = getPaid(a); vb = getPaid(b);
      }
      else { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, searchScope, showBookmarks, bookmarks, sortBy, sortDir, tlType, tlStart, tlEnd, fbType, filterPaid, filterDeposit, selectedMonth, selectedYear]);

  const groupData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, any[]> = {};
    finalFiltered.forEach(h => {
      const key = groupBy === 'company' ? (h.companyTag?.[0] || (lang === 'de' ? 'Nicht zugeordnet' : 'Unassigned')) : groupBy === 'city' ? (h.city || 'Other') : groupBy === 'country' ? (h.country || 'Other') : h.name;
      if (!groups[key]) groups[key] = []; groups[key].push(h);
    });
    return groups;
  }, [finalFiltered, groupBy, lang]);

  const isAllSelected = useMemo(() => {
    const visible = groupBy !== 'none' && activeGroupTab && groupData ? groupData[activeGroupTab] : finalFiltered;
    return visible.length > 0 && visible.every(h => selectedIds.has(h.id));
  }, [selectedIds, finalFiltered, groupData, activeGroupTab, groupBy]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const visible = groupBy !== 'none' && activeGroupTab && groupData ? groupData[activeGroupTab] : finalFiltered;
    const next = new Set(selectedIds);
    if (isAllSelected) visible.forEach(h => next.delete(h.id)); else visible.forEach(h => next.add(h.id));
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(lang === 'de' ? `Sind Sie sicher, dass Sie ${selectedIds.size} Hotels löschen möchten?` : `Are you sure you want to delete ${selectedIds.size} hotels?`)) return;
    try {
      setLoading(true);
      const { bulkDeleteHotels } = await import('./lib/supabase');
      await bulkDeleteHotels(Array.from(selectedIds));
      setHotels(hotels.filter(h => !selectedIds.has(h.id))); setSelectedIds(new Set());
    } catch (err: any) { alert("Delete failed: " + err.message); } finally { setLoading(false); }
  };

  const handleBulkDuplicate = async () => {
    try {
      setLoading(true);
      const toClone = hotels.filter(h => selectedIds.has(h.id));
      const { duplicateHotelsMetadata } = await import('./lib/supabase');
      const newEntries = await duplicateHotelsMetadata(toClone);
      setHotels([...newEntries.map((h: any) => ({ ...h, companyTag: h.company_tag ?? [], durations: [] })), ...hotels]);
      setSelectedIds(new Set());
    } catch (err: any) { alert("Duplicate failed: " + err.message); } finally { setLoading(false); }
  };

  // DASHBOARD MATH FOR TOP BAR
  let totalSpend = 0; let totalPaidGlobal = 0; let totalUnpaidGlobal = 0;
  finalFiltered.forEach(h => {
    totalSpend += calcHotelTotalCost(h, selectedMonth !== 'all' ? selectedMonth : null, selectedYear);

    (h.invoices || []).forEach((inv: any) => {
       if (selectedMonth !== 'all') {
          const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
          if (!dateStr) return;
          const d = new Date(dateStr);
          if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return;
       }
       const invBrutto = inv.billingMode === 'total' 
          ? (parseFloat(inv.totalNetto)||0) * (1 + (parseFloat(inv.totalMwst)||0)/100)
          : (inv.items || []).reduce((s:number, it:any) => s + (parseFloat(it.brutto)||0), 0); 
       if (inv.isPaid) totalPaidGlobal += invBrutto; else totalUnpaidGlobal += invBrutto;
    });
  });

  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);
  const closeMenu = () => { setShowFilterMenu(false); setShowTimelineMenu(false); setShowSortMenu(false); };

  const btnActive = dk ? 'bg-teal-600 text-white border-transparent' : 'bg-white border-teal-600 text-teal-700 shadow-sm';
  const btnInactive = dk ? 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';
  const popupCls = cn('absolute z-[1000] mt-3 p-5 rounded-2xl border shadow-2xl w-[420px] text-sm animate-in fade-in slide-in-from-top-2 duration-200 right-0', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900');
  const popupHeader = "flex items-center justify-between mb-5";
  const popupTitle = "text-lg font-bold";
  const sectionTitle = "text-sm text-slate-400 mb-2";

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#0F172A]' : 'bg-slate-50')}>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* LOGO & HEADER INTEGRATION */}
        <div className={cn("flex items-center w-full border-b shrink-0 z-50", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
           <div className={cn("px-6 flex items-center justify-center border-r h-[72px]", dk ? "border-white/5" : "border-slate-200")}>
              <div className="text-2xl font-black italic select-none tracking-tighter opacity-80">
                Euro<span className="text-yellow-500">Track.</span>
              </div>
           </div>
           <div className="flex-1 h-full">
              <Header 
                theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} 
                searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
                searchScope={searchScope} setSearchScope={setSearchScope} 
                onSignOut={onSignOut} onExportCsv={() => {}} onPrint={() => {}} 
                viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} 
                offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} 
              />
           </div>
        </div>

        {(!isOnline || offlineMode) && (
          <div className="bg-amber-500 border-b border-amber-600 text-white px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 z-[60] relative">
            <CloudOff size={16} strokeWidth={2.5} /> {lang === 'de' ? 'Offline Modus Aktiv' : 'Offline Mode Active'}
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className={cn("sticky top-0 z-[60] w-full border-b flex items-center justify-between px-8 py-3 animate-in slide-in-from-top duration-300", dk ? "bg-[#1E293B]/95 border-teal-500/30 text-white backdrop-blur-md" : "bg-teal-600 border-teal-700 text-white shadow-lg")}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="w-5 h-5 rounded border-white/20 accent-white cursor-pointer" />
              <span className="font-black text-sm uppercase tracking-widest">{selectedIds.size} {lang === 'de' ? 'Ausgewählt' : 'Selected'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleBulkDuplicate} className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 font-bold text-sm"><Copy size={18} /> {lang === 'de' ? 'Duplizieren' : 'Duplicate'}</button>
              <button onClick={handleBulkDelete} className="p-2.5 rounded-xl hover:bg-red-500 bg-red-500/20 transition-all flex items-center gap-2 font-bold text-sm"><Trash2 size={18} /> {lang === 'de' ? 'Löschen' : 'Delete'}</button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-4 p-2 hover:bg-white/10 rounded-full transition-all"><X size={20} /></button>
            </div>
          </div>
        )}

        {/* GLOBAL STATS ROW */}
        <div className={cn('px-8 py-5 border-b shrink-0 z-40 relative', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center justify-between flex-wrap gap-4 w-full">
            <div className="flex items-center gap-12 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{lang === 'de' ? 'Freie Betten' : 'Free Beds'}</p>
                <p className={cn('text-3xl font-black', freeBedsTotal > 0 ? 'text-red-500' : 'text-slate-400')}>{freeBedsTotal}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Hotels</p>
                <p className="text-3xl font-black">{finalFiltered.length}</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1.5">
                     {lang === 'de' ? 'GESAMTKOSTEN' : 'TOTAL SPENT'}
                     <button onClick={() => setShowGlobalFinancials(!showGlobalFinancials)} className={cn("p-1 rounded transition-colors", showGlobalFinancials ? "text-teal-500 bg-teal-500/10" : "hover:bg-slate-200 dark:hover:bg-white/10")}><Eye size={14}/></button>
                  </p>
                  <p className="text-3xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(totalSpend)}</p>
                </div>
                {showGlobalFinancials && (
                   <div className="flex flex-col justify-center h-full pt-4 animate-in fade-in slide-in-from-left-2 pl-4 border-l border-slate-200 dark:border-white/10">
                       <span className="text-emerald-500 text-sm font-bold leading-tight">{formatCurrency(totalPaidGlobal)}</span>
                       <span className="text-red-500 text-sm font-bold leading-tight">{formatCurrency(totalUnpaidGlobal)}</span>
                   </div>
                )}
              </div>
            </div>
            
            {/* ACTION BUTTONS (RESTORED FROM SIDEBAR) */}
            <div className="flex items-center gap-3">
               <button onClick={() => setShowStudio(true)} className={cn("px-4 py-2.5 rounded-xl border font-bold flex items-center gap-2 transition-all", dk ? "bg-[#1E293B] border-white/10 text-white hover:bg-white/10" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50")}>
                  <Download size={16} /> Export
               </button>
               {!isStrictViewer && (
                 <button onClick={() => setAddingHotel(true)} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95">
                   <Plus size={18} strokeWidth={2.5} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                 </button>
               )}
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full pb-64">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap relative z-[100]">
              <h2 className="text-2xl font-bold tracking-tight">{displayTitle}</h2>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                   <button onClick={() => { closeMenu(); setShowTimelineMenu(!showTimelineMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", btnInactive)}>
                      <Calendar size={16} /> {selectedMonth === 'all' ? (lang === 'de' ? 'Alle Monate' : 'All Months') : (lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth])} {selectedYear}
                   </button>
                   {showTimelineMenu && (
                      <div className={cn(popupCls, "w-[400px]")}>
                         <div className={popupHeader}><h3 className={popupTitle}>{lang === 'de' ? 'Zeitraum' : 'Time Period'}</h3><button onClick={closeMenu} className="text-slate-400"><X size={20}/></button></div>
                         <div className="grid grid-cols-5 gap-2 mb-4">
                            {[2024, 2025, 2026, 2027, 2028].map(y => <button key={y} onClick={() => setSelectedYear(y)} className={cn("py-2 rounded-lg text-sm font-bold transition-all", y === selectedYear ? btnActive : btnInactive)}>{y}</button>)}
                         </div>
                         <div className="grid grid-cols-4 gap-2">
                            <button onClick={() => setSelectedMonth('all')} className={cn("col-span-4 py-2 rounded-lg text-sm font-bold transition-all", selectedMonth === 'all' ? btnActive : btnInactive)}>{lang === 'de' ? 'Alle Monate' : 'All Months'}</button>
                            {(lang === 'de' ? monthNamesDe : monthNamesEn).map((m, i) => <button key={i} onClick={() => setSelectedMonth(i)} className={cn("py-2 rounded-lg text-sm font-bold transition-all", selectedMonth === i ? btnActive : btnInactive)}>{m.substring(0,3)}</button>)}
                         </div>
                      </div>
                   )}
                </div>

                <div className="relative">
                  <button onClick={() => { setShowTimelineMenu(false); setShowSortMenu(false); setShowFilterMenu(!showFilterMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", (fbType !== 'all' || filterPaid !== 'all' || filterDeposit !== 'all' || groupBy !== 'none') ? btnActive : btnInactive)}><Filter size={16} /> Filter</button>
                  {showFilterMenu && (
                    <div className={popupCls}>
                      <div className={popupHeader}>
                        <h3 className={popupTitle}>Filter</h3>
                        <button onClick={closeMenu} className="text-slate-400"><X size={20}/></button>
                      </div>
                      <div className="space-y-5">
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Gruppieren nach' : 'Group by'}</p>
                           <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-black/20">
                             {[{id:'none', lEn:'None', lDe:'Keine'}, {id:'hotel', lEn:'Hotel', lDe:'Hotel'}, {id:'company', lEn:'Company', lDe:'Firma'}, {id:'city', lEn:'City', lDe:'Stadt'}].map(g => (
                               <button key={g.id} onClick={() => setGroupBy(g.id as any)} className={cn("flex-1 py-1.5 text-sm font-medium rounded-lg transition-all", groupBy === g.id ? (dk ? "bg-teal-600 text-white shadow-sm" : "bg-white text-teal-700 shadow-sm") : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>{lang === 'de' ? g.lDe : g.lEn}</button>
                             ))}
                           </div>
                         </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 mt-6 pt-4">
                        <button onClick={() => { setFilterPaid('all'); setFilterDeposit('all'); setGroupBy('none'); setFbType('all'); }} className="text-teal-600 text-sm font-medium hover:underline">{lang === 'de' ? 'Alle löschen' : 'Clear All'}</button>
                        <button onClick={closeMenu} className="px-5 py-2 bg-teal-600 text-white rounded-lg font-bold">Apply</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button onClick={() => { setShowTimelineMenu(false); setShowFilterMenu(false); setShowSortMenu(!showSortMenu); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", (sortBy !== 'created_at' || sortDir !== 'desc') ? btnActive : btnInactive)}><ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
                  {showSortMenu && (
                    <div className={cn(popupCls, 'w-[420px]')}>
                      <div className={popupHeader}><h3 className={popupTitle}>{lang === 'de' ? 'Sortieren' : 'Sort'}</h3><button onClick={closeMenu} className="text-slate-400"><X size={20}/></button></div>
                      <p className={sectionTitle}>{lang === 'de' ? 'Sortieren nach' : 'Sort By'}</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {[ { id: 'name', lEn: 'Hotel Name', lDe: 'Hotelname' }, { id: 'cost', lEn: 'Total Cost', lDe: 'Gesamtkosten' }, { id: 'payment_due', lEn: 'Payment Due', lDe: 'Fälligkeit' }, { id: 'total_paid', lEn: 'Total Paid', lDe: 'Total Bezahlt' }, { id: 'created_at', lEn: 'Last Added', lDe: 'Zuletzt Hinzugefügt' }, { id: 'updated_at', lEn: 'Last Updated', lDe: 'Zuletzt Aktualisiert' }
                        ].map(s => (
                          <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-3 rounded-lg text-sm font-medium border transition-all", sortBy === s.id ? btnActive : btnInactive)}>{lang === 'de' ? s.lDe : s.lEn}</button>
                        ))}
                      </div>
                      <p className={sectionTitle}>{lang === 'de' ? 'Sortierreihenfolge' : 'Sort Direction'}</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <button onClick={() => setSortDir('asc')} className={cn("py-3 px-4 rounded-lg border text-left", sortDir === 'asc' ? btnActive : btnInactive)}>Ascending</button>
                        <button onClick={() => setSortDir('desc')} className={cn("py-3 px-4 rounded-lg border text-left", sortDir === 'desc' ? btnActive : btnInactive)}>Descending</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STICKY COLUMN HEADERS */}
            <div className={cn("sticky top-0 z-50 flex items-center px-4 py-3 border-b text-[10px] font-bold uppercase tracking-widest mb-2 backdrop-blur-md rounded-t-xl", dk ? "bg-[#0B1224]/90 border-white/10 text-slate-400" : "bg-slate-100/90 border-slate-200 text-slate-500")}>
               <div className="w-10 shrink-0"></div> 
               <div className="w-[200px] shrink-0">Hotel</div>
               <div className="w-[120px] shrink-0 pr-2">{lang === 'de' ? 'Firma' : 'Company'}</div>
               <div className="w-[150px] shrink-0 pr-2">{lang === 'de' ? 'Buchungen' : 'Bookings'}</div>
               <div className="flex-1 min-w-[200px]">{lang === 'de' ? 'Mitarbeiter' : 'Employees'}</div>
               <div className="w-12 shrink-0 text-center">{lang === 'de' ? 'Frei' : 'Free'}</div>
               <div className="w-12 shrink-0 text-center">{lang === 'de' ? 'Betten' : 'Beds'}</div>
               <div className="w-[140px] shrink-0 text-right pr-6">{lang === 'de' ? 'Kosten' : 'Cost'}</div>
            </div>

            <div className="flex flex-col gap-2">
                {finalFiltered.map((hotel, index) => (
                  <HotelRow 
                    key={hotel.id} 
                    selectedMonth={selectedMonth === 'all' ? null : selectedMonth}
                    selectedYear={selectedYear}
                    isOpen={expandedHotelId === hotel.id}
                    onToggle={() => setExpandedHotelId(prev => prev === hotel.id ? null : hotel.id)}
                    showGlobalFinancials={showGlobalFinancials}
                    isSelected={selectedIds.has(hotel.id)}
                    onSelect={() => toggleSelect(hotel.id)}
                    isBulkActive={selectedIds.size > 0}
                    entry={hotel} 
                    viewOnly={accessLevel?.role === 'viewer'} 
                    index={index} 
                    isDarkMode={dk} 
                    lang={lang} 
                    searchQuery={searchQuery} 
                    searchScope={searchScope} 
                    companyOptions={allCompanyOptions} 
                    cityOptions={uniqueCities} 
                    onDelete={hId => setHotels(hotels.filter(h=>h.id!==hId))} 
                    onUpdate={(hId, up) => setHotels(hotels.map(h=>h.id===hId?{...h,...up}:h))} 
                    onDeleteCompanyOption={handleDeleteGlobalCompany} 
                    onAddOption={handleAddGlobalCompany} 
                    hotelOptions={uniqueHotelNames}
                    employeeOptions={uniqueEmployeeNames}
                  />
                ))}
                
                {!loading && finalFiltered.length === 0 && (
                  <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <Building size={48} className="mb-4 text-slate-400" />
                    <p className="text-lg font-bold">{lang === 'de' ? 'Keine Hotels gefunden' : 'No hotels found'}</p>
                  </div>
                )}
            </div>
          </div>
        </main>

        {showStudio && (
          <ExportStudio 
            hotels={finalFiltered} 
            calcCost={calcHotelTotalCost} 
            lang={lang} 
            total={totalSpend}
            selectedMonth={selectedMonth === 'all' ? null : selectedMonth}
            selectedYear={selectedYear}
            title={selectedMonth !== 'all' 
              ? `Period: ${lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth]} ${selectedYear}` 
              : `Period: ${selectedYear}`}
            onClose={() => setShowStudio(false)}
            dk={dk}
          />
        )}
      </div>
    </div>
  );
}
