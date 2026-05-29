// src/MobileDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, calcHotelTotalCost, calcHotelFreeBedsToday, calculateNights, calcInvoiceItem } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Home, Search, Star, Plus, X, Filter, SortAsc, Calendar, Loader2, Settings as SettingsIcon, ChevronDown, ChevronUp, Bed, Building, Coins } from 'lucide-react';
import MobileHotelRow from './components/MobileHotelRow';
import Header from './components/Header';

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

interface MobileDashboardProps {
  theme: 'dark' | 'light'; lang: 'de' | 'en';
  toggleTheme: () => void; setLang: (l: 'de' | 'en') => void;
  offlineMode?: boolean; onToggleOfflineMode?: () => void;
  viewOnly?: boolean; accessLevel?: AccessLevel | null; onSignOut?: () => void;
}

export default function MobileDashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel, onSignOut, offlineMode, onToggleOfflineMode }: MobileDashboardProps) {
  const dk = theme === 'dark';
  const isStrictViewer = viewOnly || accessLevel?.role === 'viewer' || accessLevel?.role === 'pending';

  // --- DATA STATE ---
  const [hotels, setHotels] = useState<any[]>([]);
  const [systemCompanies, setSystemCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- MOBILE UI STATE ---
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'bookmarks'>('home');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<'filter' | 'sort' | 'time'>('filter');
  const [showYearMenu, setShowYearMenu] = useState(false);
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [showGlobalFinancials, setShowGlobalFinancials] = useState(false);
  const [yearOffset, setYearOffset] = useState(0);

  // --- FILTERS EXACTLY LIKE WEB ---
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStart, setTlStart] = useState('');
  const [tlEnd, setTlEnd] = useState('');
  
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDue, setFilterDue] = useState<'all' | 'today' | '3days' | '5days'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'yes' | 'no'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'hotel' | 'company' | 'city' | 'country'>('none');
  
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'payment_due' | 'total_paid' | 'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]'); } catch { return []; }
  });

  // Keep bookmarks in sync
  useEffect(() => {
    const handleStorage = () => { try { setBookmarks(JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]')); } catch {} };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // --- DATA FETCHING (Exact copy from Desktop) ---
  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    async function fetchAllData() {
      try {
        const companies = await getSystemCompanies();
        const { data, error } = await supabase.from('hotels').select('*, durations(*, room_cards(*, employees(*)), employees(*))').order('created_at', { ascending: false });
        if (error) throw error; 
        const normalized = (data || []).map((h: any) => ({
            ...h, companyTag: h.company_tag ?? [], isPaid: h.is_paid ?? false,
            durations: (h.durations || []).map((d: any) => ({
              ...d, hotelId: d.hotel_id, startDate: d.start_date, endDate: d.end_date, roomType: d.room_type,
              roomCards: (d.room_cards || []).map((rc: any) => ({
                ...rc, roomType: rc.room_type, bedCount: rc.bed_count,
                employees: (rc.employees || []).map((e: any) => ({ ...e, checkIn: e.checkin, checkOut: e.checkout }))
              }))
            }))
        }));
        if (isMounted) {
           setSystemCompanies(companies);
           setHotels(normalized); 
        }
      } catch (err: any) { console.error("Mobile Load Error:", err); } 
      finally { if (isMounted) setLoading(false); }
    }
    fetchAllData(); 
    return () => { isMounted = false; };
  }, [selectedYear]);

  // --- DERIVED OPTIONS FOR AUTOCOMPLETE ---
  const allCompanyOptions = useMemo(() => {
    const localTags = hotels.flatMap(h => h.companyTag || []).filter(Boolean);
    return Array.from(new Set([...systemCompanies, ...localTags]));
  }, [hotels, systemCompanies]);

  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);
  const uniqueHotelNames = useMemo(() => Array.from(new Set(hotels.map(h => h.name).filter(Boolean))), [hotels]);
  const uniqueEmployeeNames = useMemo(() => {
    const names = new Set<string>();
    hotels.forEach(h => h.durations?.forEach((d:any) => d.roomCards?.forEach((rc:any) => rc.employees?.forEach((e:any) => { if (e.name) names.add(e.name); }))));
    return Array.from(names);
  }, [hotels]);

  // --- COMPANY HANDLERS ---
  const handleAddGlobalCompany = async (name: string) => {
    try { await addSystemCompany(name); setSystemCompanies(prev => Array.from(new Set([...prev, name]))); } 
    catch (err) { console.error("Failed to add company globally", err); }
  };

  const handleRenameGlobalCompany = async (oldName: string, newName: string) => {
    try {
      await deleteSystemCompany(oldName);
      await addSystemCompany(newName);
      setSystemCompanies(prev => [...prev.filter(c => c !== oldName), newName].sort());
      setHotels(prevHotels => prevHotels.map(h => {
        if (h.companyTag?.includes(oldName)) {
           const newTags = h.companyTag.map((t: string) => t === oldName ? newName : t);
           return { ...h, companyTag: newTags };
        }
        return h;
      }));
    } catch (err) { console.error("Failed to rename company", err); }
  };

  const handleDeleteGlobalCompany = async (name: string) => {
    try { 
      await deleteSystemCompany(name); 
      setSystemCompanies(prev => prev.filter(c => c !== name)); 
      setHotels(prevHotels => prevHotels.map(h => {
        if (h.companyTag?.includes(name)) {
           const newTags = h.companyTag.filter((t: string) => t !== name);
           return { ...h, companyTag: newTags };
        }
        return h;
      }));
    } catch (err) { console.error("Failed to delete company", err); }
  };

  // --- EXACT MATH FILTERS FROM WEB ---
  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      // 1. EXACT WEB MONTH & YEAR OVERLAP CHECK
      const durationInYear = (h.durations || []).some((d: any) => {
        if (!d.startDate || !d.endDate) return false;
        return new Date(d.startDate).getFullYear() <= selectedYear && new Date(d.endDate).getFullYear() >= selectedYear;
      });
      const invoiceInYear = (h.invoices || []).some((inv: any) => {
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        return dateStr && new Date(dateStr).getFullYear() === selectedYear;
      });
      const isAnchorYear = h.year === selectedYear;
      if (!durationInYear && !invoiceInYear && !isAnchorYear) return false;

      // SPECIFIC MONTH FILTER
      if (selectedMonth !== null) {
        const durationOverlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate); const dEnd = new Date(d.endDate);
          const mStart = new Date(selectedYear, selectedMonth, 1);
          const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
          return dStart <= mEnd && dEnd >= mStart;
        });
        const invoiceOverlap = (h.invoices || []).some((inv: any) => {
          const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
        if (!durationOverlap && !invoiceOverlap) return false;
      }

      // Bookmarks Filter
      if (activeTab === 'bookmarks' && !bookmarks.includes(h.id)) return false;

      // Search Filter
      if (searchQuery && activeTab === 'search') {
          const q = searchQuery.toLowerCase();
          const matchAll = hotelMatchesSearch(h, searchQuery, 'all');
          const deepInvoiceMatch = h.rechnungNr?.toLowerCase().includes(q) || (h.invoices || []).some((inv: any) => inv.number?.toLowerCase().includes(q));
          const deepEmployeeMatch = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
          if (!matchAll && !deepInvoiceMatch && !deepEmployeeMatch) return false;
      }

      // Time & Payment Filters
      if (filterPaid === 'paid' && !h.isPaid) return false;
      if (filterPaid === 'unpaid' && h.isPaid) return false;
      if (filterDeposit === 'yes' && !h.depositEnabled) return false;
      if (filterDeposit === 'no' && h.depositEnabled) return false;
      
      return true;
    }).sort((a, b) => {
      let va: any; let vb: any;
      if (sortBy === 'cost') { va = calcHotelTotalCost(a, selectedMonth, selectedYear); vb = calcHotelTotalCost(b, selectedMonth, selectedYear); }
      else if (sortBy === 'free_beds') { va = calcHotelFreeBedsToday(a); vb = calcHotelFreeBedsToday(b); }
      else if (sortBy === 'created_at') { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); }
      else { va = a.name?.toLowerCase() || ''; vb = b.name?.toLowerCase() || ''; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, activeTab, bookmarks, sortBy, sortDir, filterPaid, filterDeposit, selectedMonth, selectedYear]);

  // --- GLOBAL FINANCES ---
  let totalSpend = 0; let totalPaidGlobal = 0; let totalUnpaidGlobal = 0;
  finalFiltered.forEach(h => {
     let hotelTotal = calcHotelTotalCost(h, selectedMonth !== null ? selectedMonth : null, selectedYear);
     totalSpend += hotelTotal;
     if (h.isPaid) totalPaidGlobal += hotelTotal; else totalUnpaidGlobal += hotelTotal;
  });
  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);

  const btnActive = dk ? 'bg-teal-600 text-white border-transparent' : 'bg-teal-600 text-white shadow-sm';
  const btnInactive = dk ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-white border-slate-200 text-slate-600';
  return (
    <div className={cn("flex flex-col h-screen overflow-hidden", dk ? "bg-[#0F172A]" : "bg-slate-50")}>
      
      {/* HIDDEN HEADER TO INJECT THE SETTINGS PORTAL EXACTLY AS THE WEB DOES */}
      <div className="hidden">
         <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery="" setSearchQuery={()=>{}} searchScope="all" setSearchScope={()=>{}} onSignOut={onSignOut || (()=>{})} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={true} />
      </div>

      {/* MOBILE TOP BAR (Logo + Exact Web Year/Month Selectors) */}
      <div className={cn("px-4 py-3 flex items-center justify-between z-[60] shrink-0 border-b", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
        <div className="text-xl font-black italic tracking-tight flex items-center gap-1">
           <span className={dk ? "text-white" : "text-slate-900"}>Euro</span><span className="text-yellow-500">Track.</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* EXACT WEB YEAR SELECTOR (With 10-Year Pagination) */}
          <div className="relative">
            <button onClick={() => { setShowYearMenu(!showYearMenu); setShowMonthMenu(false); }} className={cn("px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}>
              {selectedYear} <ChevronDown size={12} className={dk ? 'text-slate-500' : 'text-slate-400'} />
            </button>
            {showYearMenu && (
              <div className={cn("absolute right-0 mt-2 p-2 rounded-xl border shadow-xl w-[160px] z-[999999]", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")} onClick={e => e.stopPropagation()}>
                <button onClick={() => setYearOffset(prev => prev - 10)} className="w-full py-1.5 mb-2 rounded border border-dashed text-xs font-bold text-slate-500 hover:text-teal-500 flex items-center justify-center gap-1">
                  <ChevronUp size={12}/> 10 {lang === 'de' ? 'Jahre' : 'Years'}
                </button>
                <div className="grid grid-cols-2 gap-1">
                  {Array.from({ length: 10 }, (_, i) => selectedYear + yearOffset - 4 + i).map(y => (
                    <button key={y} onClick={() => { setSelectedYear(y); setShowYearMenu(false); setYearOffset(0); }} className={cn("py-2 rounded-lg text-sm font-bold transition-all", selectedYear === y ? btnActive : btnInactive)}>{y}</button>
                  ))}
                </div>
                <button onClick={() => setYearOffset(prev => prev + 10)} className="w-full py-1.5 mt-2 rounded border border-dashed text-xs font-bold text-slate-500 hover:text-teal-500 flex items-center justify-center gap-1">
                  10 {lang === 'de' ? 'Jahre' : 'Years'} <ChevronDown size={12}/>
                </button>
              </div>
            )}
          </div>

          {/* EXACT WEB MONTH SELECTOR (Vertical Scroll) */}
          <div className="relative">
            <button onClick={() => { setShowMonthMenu(!showMonthMenu); setShowYearMenu(false); }} className={cn("px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}>
              {selectedMonth === null ? (lang === 'de' ? 'Alle Monate' : 'All Months') : (lang === 'de' ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][selectedMonth] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][selectedMonth])} <ChevronDown size={12} className={dk ? 'text-slate-500' : 'text-slate-400'} />
            </button>
            {showMonthMenu && (
              <div className={cn("absolute right-0 mt-2 p-2 rounded-xl border shadow-xl w-[160px] max-h-[300px] overflow-y-auto z-[999999]", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")} onClick={e => e.stopPropagation()}>
                 <button onClick={() => { setSelectedMonth(null); setShowMonthMenu(false); }} className={cn("w-full text-center px-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest mb-1 transition-all", selectedMonth === null ? (dk ? "bg-teal-500/20 text-teal-400" : "bg-teal-50 text-teal-600") : (dk ? "bg-white/5 text-slate-300" : "bg-slate-100 text-slate-700"))}>
                    {lang === 'de' ? 'Alle Monate' : 'All Months'}
                 </button>
                 <div className="flex flex-col gap-1">
                   {(lang === 'de' ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']).map((m, i) => (
                     <button key={i} onClick={() => { setSelectedMonth(i); setShowMonthMenu(false); }} className={cn("w-full text-center py-2.5 rounded-lg text-[12px] font-bold transition-all border", selectedMonth === i ? (dk ? "bg-teal-500/20 border-teal-500/30 text-teal-400" : "bg-teal-50 border-teal-200 text-teal-600") : (dk ? "border-transparent bg-transparent text-slate-400" : "border-transparent bg-transparent text-slate-500"))}>{m}</button>
                   ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EXACT WEB STATS HEADER (Inline Paid/Unpaid) */}
      <div className={cn("w-full px-4 py-3 border-b shrink-0 flex items-center justify-between z-[50]", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
         <div className="flex items-center gap-5">
           <div className="flex items-center gap-1.5" title={lang === 'de' ? 'Freie Betten' : 'Free Beds'}>
             <Bed size={18} className={dk ? "text-slate-500" : "text-slate-400"} strokeWidth={2.5} />
             <span className={cn('text-[18px] font-black', freeBedsTotal > 0 ? 'text-red-500' : 'text-teal-500')}>{freeBedsTotal}</span>
           </div>
           <div className="flex items-center gap-1.5" title="Hotels">
             <Building size={16} className={dk ? "text-slate-500" : "text-slate-400"} strokeWidth={2.5} />
             <span className={cn('text-[18px] font-black', dk ? 'text-white' : 'text-slate-900')}>{finalFiltered.length}</span>
           </div>
           
           <div className="flex items-center">
             <button onClick={() => setShowGlobalFinancials(!showGlobalFinancials)} className="flex items-center gap-1.5 transition-opacity hover:opacity-80">
                <Coins size={18} className={cn(showGlobalFinancials ? "text-teal-500" : (dk ? "text-slate-500" : "text-slate-400"))} strokeWidth={2.5} />
                <span className="text-[18px] font-black text-teal-600 dark:text-teal-400">{formatCurrency(totalSpend)}</span>
             </button>
             
             {/* Stacking Paid/Unpaid exactly next to it, matching the web */}
             {showGlobalFinancials && (
                <div className={cn("flex flex-col pl-3 ml-3 border-l animate-in fade-in slide-in-from-left-2", dk ? "border-white/10" : "border-slate-200")}>
                   <span className="text-emerald-500 text-[10px] font-bold leading-tight">{lang === 'de' ? 'Bezahlt:' : 'Paid:'} {formatCurrency(totalPaidGlobal)}</span>
                   <span className="text-red-500 text-[10px] font-bold leading-tight">{lang === 'de' ? 'Offen:' : 'Unpaid:'} {formatCurrency(totalUnpaidGlobal)}</span>
                </div>
             )}
           </div>
         </div>
      </div>

      {/* SCROLLING CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-24 relative no-scrollbar">
         {loading ? (
           <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-teal-500 opacity-50" /></div>
         ) : (
            <div className="p-2 space-y-3">
              
              {/* HOME TAB */}
              {activeTab === 'home' && (
                finalFiltered.length > 0 ? finalFiltered.map((hotel, idx) => (
                  <MobileHotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} searchQuery={searchQuery} searchScope={searchScope} companyOptions={allCompanyOptions} cityOptions={uniqueCities} hotelOptions={uniqueHotelNames} employeeOptions={uniqueEmployeeNames} onDelete={hId => setHotels(prev => prev.filter(ho=>ho.id!==hId))} onUpdate={(hId, up) => setHotels(prev => prev.map(ho=>ho.id===hId?{...ho,...up}:ho))} />
                )) : <div className="text-center py-10 opacity-50 font-bold">{lang === 'de' ? 'Keine Hotels' : 'No Hotels'}</div>
              )}

              {/* SEARCH TAB */}
              {activeTab === 'search' && (
                <div className="space-y-3 p-2 animate-in fade-in">
                   
                   {/* EXACT WEB SEARCH BAR WITH SCOPE DROPDOWN */}
                   <div className={cn("flex items-center rounded-xl border overflow-hidden", dk ? "bg-[#1E293B] border-white/10 focus-within:border-teal-500" : "bg-white border-slate-200 focus-within:border-teal-500")}>
                      <select value={searchScope} onChange={e => setSearchScope(e.target.value)} className={cn("h-[46px] pl-3 pr-6 text-xs font-bold bg-transparent border-r outline-none appearance-none", dk ? "border-white/10 text-slate-300" : "border-slate-200 text-slate-700")}>
                        <option value="all">{lang === 'de' ? 'Überall' : 'All Fields'}</option>
                        <option value="hotel">{lang === 'de' ? 'Hotelname' : 'Hotel Name'}</option>
                        <option value="city">{lang === 'de' ? 'Stadt' : 'City'}</option>
                        <option value="company">{lang === 'de' ? 'Firma' : 'Company'}</option>
                        <option value="employee">{lang === 'de' ? 'Mitarbeiter' : 'Employee'}</option>
                        <option value="invoice">{lang === 'de' ? 'Rechnung' : 'Invoice No.'}</option>
                      </select>
                      <div className="relative flex-1">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                         <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("w-full h-[46px] pl-9 pr-4 bg-transparent font-bold outline-none text-sm", dk ? "text-white" : "text-slate-900")} />
                         {searchQuery && (
                           <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={14}/></button>
                         )}
                      </div>
                   </div>

                   <button onClick={() => setShowBottomSheet(true)} className={cn("w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm", dk ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}>
                      <Filter size={14} /> {lang === 'de' ? 'Filter, Sortierung & Zeitraum' : 'Filter, Sort & Timeline'}
                   </button>
                   
                   <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                      {finalFiltered.map((hotel, idx) => (
                        <HotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} searchQuery={searchQuery} searchScope={searchScope} />
                      ))}
                   </div>
                </div>
              )}

              {/* BOOKMARKS TAB */}
              {activeTab === 'bookmarks' && (
                finalFiltered.length > 0 ? finalFiltered.map((hotel, idx) => (
                  <MobileHotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} searchQuery={searchQuery} searchScope={searchScope} companyOptions={allCompanyOptions} cityOptions={uniqueCities} hotelOptions={uniqueHotelNames} employeeOptions={uniqueEmployeeNames} onDelete={hId => setHotels(prev => prev.filter(ho=>ho.id!==hId))} onUpdate={(hId, up) => setHotels(prev => prev.map(ho=>ho.id===hId?{...ho,...up}:ho))} />
                )) : (
                  <div className="text-center py-10 opacity-50 font-bold flex flex-col items-center">
                    <Star size={32} className="mb-2 text-slate-400" />
                    {lang === 'de' ? 'Keine markierten Hotels' : 'No bookmarked hotels'}
                  </div>
                )
              )}
            </div>
         )}
      </div>

      {/* FLOATING ACTION BUTTON (Home Only) */}
      {activeTab === 'home' && !isStrictViewer && (
         <button className="absolute bottom-20 right-4 w-14 h-14 bg-teal-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform z-40">
            <Plus size={24} strokeWidth={3} />
         </button>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <div className={cn("absolute bottom-0 left-0 right-0 h-16 border-t flex justify-around items-center px-2 z-50", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
         {[
            { id: 'home', icon: Home, label: lang === 'de' ? 'Home' : 'Home' },
            { id: 'search', icon: Search, label: lang === 'de' ? 'Suchen' : 'Search' },
            { id: 'bookmarks', icon: Star, label: lang === 'de' ? 'Gespeichert' : 'Saved' }
         ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex flex-col items-center justify-center w-16 gap-1 transition-all", activeTab === tab.id ? "text-teal-500" : "text-slate-400 hover:text-slate-500")}>
               <tab.icon size={20} strokeWidth={activeTab === tab.id ? 3 : 2} className={activeTab === tab.id && tab.id === 'bookmarks' ? "fill-teal-500" : ""} />
               <span className="text-[9px] font-bold">{tab.label}</span>
            </button>
         ))}
         
         <button onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))} className={cn("flex flex-col items-center justify-center w-16 gap-1 transition-all text-slate-400 hover:text-slate-500")}>
             <SettingsIcon size={20} strokeWidth={2} />
             <span className="text-[9px] font-bold">{lang === 'de' ? 'Einstellungen' : 'Settings'}</span>
         </button>
      </div>

      {/* TABBED BOTTOM SHEET FOR FILTERS (Exact Match to Web) */}
      {showBottomSheet && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setShowBottomSheet(false)}>
           <div className={cn("w-full h-[75vh] rounded-t-3xl flex flex-col border-t shadow-2xl", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")} onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.2s ease-out' }}>
              
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10 shrink-0">
                 <h3 className="text-lg font-black">{lang === 'de' ? 'Ansicht anpassen' : 'View Options'}</h3>
                 <button onClick={() => setShowBottomSheet(false)} className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-full"><X size={16}/></button>
              </div>
              
              <div className="flex p-2 bg-slate-50 dark:bg-[#0F172A] shrink-0 border-b border-slate-200 dark:border-white/10">
                 {[ { id: 'filter', icon: Filter, l: 'Filter' }, { id: 'sort', icon: SortAsc, l: lang === 'de' ? 'Sortieren' : 'Sort' }, { id: 'time', icon: Calendar, l: lang === 'de' ? 'Zeitraum' : 'Timeline' } ].map(t => (
                    <button key={t.id} onClick={() => setSheetTab(t.id as any)} className={cn("flex-1 py-1.5 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition-all", sheetTab === t.id ? (dk ? "bg-teal-500/20 text-teal-400" : "bg-white shadow text-teal-700") : "text-slate-500")}>
                       <t.icon size={14}/> {t.l}
                    </button>
                 ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 {sheetTab === 'filter' && (
                    <div className="space-y-4">
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">{lang === 'de' ? 'Verfügbare freie Betten' : 'Free Beds Availability'}</p>
                         <div className="grid grid-cols-2 gap-2">
                           {[ { id: 'today', lEn: 'Today', lDe: 'Heute' }, { id: 'tomorrow', lEn: 'Tomorrow', lDe: 'Morgen' }, { id: '3days', lEn: 'in 3 days', lDe: 'in 3 Tagen' }, { id: '7days', lEn: 'in 7 days', lDe: 'in 7 Tagen' } ].map(f => (
                             <button key={f.id} onClick={() => setFbType(f.id as any)} className={cn("py-2 rounded-lg text-xs font-bold transition-all border", fbType === f.id ? btnActive : btnInactive)}>{lang === 'de' ? f.lDe : f.lEn}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
                         <div className="grid grid-cols-3 gap-2">
                           {[{id:'all', lEn:'All', lDe:'Alle'}, {id:'paid', lEn:'Paid', lDe:'Bezahlt'}, {id:'unpaid', lEn:'Unpaid', lDe:'Unbezahlt'}].map(p => (
                             <button key={p.id} onClick={() => setFilterPaid(p.id as any)} className={cn("py-2 rounded-lg border text-xs font-bold transition-all", filterPaid === p.id ? btnActive : btnInactive)}>{lang === 'de' ? p.lDe : p.lEn}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">{lang === 'de' ? 'Fälligkeit' : 'Payment Due'}</p>
                         <div className="grid grid-cols-2 gap-2">
                           {[{id:'all', lEn:'All', lDe:'Alle'}, {id:'today', lEn:'Today', lDe:'Heute'}, {id:'3days', lEn:'In 3 Days', lDe:'In 3 Tagen'}, {id:'5days', lEn:'In 5 Days', lDe:'In 5 Tagen'}].map(p => (
                             <button key={p.id} onClick={() => setFilterDue(p.id as any)} className={cn("py-2 rounded-lg border text-xs font-bold transition-all", filterDue === p.id ? btnActive : btnInactive)}>{lang === 'de' ? p.lDe : p.lEn}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">{lang === 'de' ? 'Kaution' : 'Deposit'}</p>
                         <div className="grid grid-cols-3 gap-2">
                           {[{id:'all', lEn:'All', lDe:'Alle'}, {id:'yes', lEn:'Yes', lDe:'Ja'}, {id:'no', lEn:'No', lDe:'Nein'}].map(p => (
                             <button key={p.id} onClick={() => setFilterDeposit(p.id as any)} className={cn("py-2 rounded-lg border text-xs font-bold transition-all", filterDeposit === p.id ? btnActive : btnInactive)}>{lang === 'de' ? p.lDe : p.lEn}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">{lang === 'de' ? 'Gruppieren nach' : 'Group By'}</p>
                         <div className="grid grid-cols-2 gap-2">
                           {[{id:'none', lEn:'None', lDe:'Keine'}, {id:'hotel', lEn:'Hotel', lDe:'Hotel'}, {id:'company', lEn:'Company', lDe:'Firma'}, {id:'city', lEn:'City', lDe:'Stadt'}].map(p => (
                             <button key={p.id} onClick={() => setGroupBy(p.id as any)} className={cn("py-2 rounded-lg border text-xs font-bold transition-all", groupBy === p.id ? btnActive : btnInactive)}>{lang === 'de' ? p.lDe : p.lEn}</button>
                           ))}
                         </div>
                       </div>
                    </div>
                 )}

                 {sheetTab === 'sort' && (
                    <div className="space-y-4">
                       <p className="text-xs font-black text-slate-400 uppercase">{lang === 'de' ? 'Sortieren nach' : 'Sort By'}</p>
                       <div className="grid grid-cols-2 gap-2">
                         {[ { id: 'name', lEn: 'Hotel Name', lDe: 'Hotelname' }, { id: 'cost', lEn: 'Total Cost', lDe: 'Gesamtkosten' }, { id: 'bed_price', lEn: 'Price/Bed', lDe: 'Preis/Bett' }, { id: 'free_beds', lEn: 'Free Beds', lDe: 'Freie Betten' }, { id: 'payment_due', lEn: 'Payment Due', lDe: 'Fälligkeit' }, { id: 'total_paid', lEn: 'Total Paid', lDe: 'Total Bezahlt' }, { id: 'created_at', lEn: 'Last Added', lDe: 'Zuletzt Hinzugefügt' }, { id: 'updated_at', lEn: 'Last Updated', lDe: 'Zuletzt Aktualisiert' } ].map(s => (
                           <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-2.5 rounded-lg border text-xs font-bold transition-all", sortBy === s.id ? btnActive : btnInactive)}>{lang === 'de' ? s.lDe : s.lEn}</button>
                         ))}
                       </div>
                       
                       <p className="text-xs font-black text-slate-400 uppercase mt-4">{lang === 'de' ? 'Sortierreihenfolge' : 'Sort Direction'}</p>
                       <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => setSortDir('asc')} className={cn("py-2 px-3 rounded-lg border text-left transition-all", sortDir === 'asc' ? btnActive : btnInactive)}>
                           <span className="block text-xs font-bold">{lang === 'de' ? 'Aufsteigend' : 'Ascending'}</span>
                           <span className="block text-[9px] mt-0.5 opacity-60">{lang === 'de' ? 'Low to High, A-Z' : 'Low to High, A-Z'}</span>
                         </button>
                         <button onClick={() => setSortDir('desc')} className={cn("py-2 px-3 rounded-lg border text-left transition-all", sortDir === 'desc' ? btnActive : btnInactive)}>
                           <span className="block text-xs font-bold">{lang === 'de' ? 'Absteigend' : 'Descending'}</span>
                           <span className="block text-[9px] mt-0.5 opacity-60">{lang === 'de' ? 'High to Low, Z-A' : 'High to Low, Z-A'}</span>
                         </button>
                       </div>
                    </div>
                 )}

                 {sheetTab === 'time' && (
                    <div className="space-y-4">
                       <div className="grid grid-cols-4 gap-2">
                          {[ { id: 'today', lEn: 'Today', lDe: 'Heute', off: 0 }, { id: 'tomorrow', lEn: 'Tomorrow', lDe: 'Morgen', off: 1 }, { id: '3days', lEn: '3 Days', lDe: '3 Tage', off: 3 }, { id: '7days', lEn: '7 Days', lDe: '7 Tage', off: 7 } ].map(t => (
                            <button key={t.id} onClick={() => { const s = new Date(); if (t.off > 0 && t.id !== '3days' && t.id !== '7days') s.setDate(s.getDate() + t.off); const e = new Date(); e.setDate(e.getDate() + t.off); setTlStart(s.toISOString().split('T')[0]); setTlEnd(e.toISOString().split('T')[0]); setTlType(t.id as any); }} className={cn("py-2 rounded-lg border text-[10px] font-bold transition-all", tlType === t.id ? btnActive : btnInactive)}>
                              {lang === 'de' ? t.lDe : t.lEn}
                            </button>
                          ))}
                       </div>
                       <div className="flex items-center gap-2">
                           <input type="date" value={tlStart} onChange={e => {setTlStart(e.target.value); setTlType('range');}} className={cn("flex-1 px-2 py-2 rounded-lg border text-xs font-bold outline-none", dk ? "bg-black/40 border-white/10 text-white" : "bg-white border-slate-200")} />
                           <span className="text-slate-400">➔</span>
                           <input type="date" min={tlStart} value={tlEnd} onChange={e => {if(tlStart && e.target.value < tlStart) return; setTlEnd(e.target.value); setTlType('range');}} className={cn("flex-1 px-2 py-2 rounded-lg border text-xs font-bold outline-none", dk ? "bg-black/40 border-white/10 text-white" : "bg-white border-slate-200")} />
                       </div>
                       <p className="text-[10px] text-slate-500 mb-4">{lang === 'de' ? 'Blendet alle Hotels ohne Buchungen im gewählten Zeitraum aus.' : 'Hides any hotel that has zero bookings/durations overlapping your chosen range.'}</p>
                       <button onClick={() => {setTlType('all'); setTlStart(''); setTlEnd('');}} className={cn("w-full py-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold", dk ? "border-red-500/30 text-red-400 bg-red-500/10" : "border-red-200 text-red-600 bg-red-50")}>
                          {lang === 'de' ? 'Zeitraum zurücksetzen' : 'Clear Timeline'}
                       </button>
                    </div>
                 )}
              </div>
              
              <div className="p-3 border-t flex justify-between items-center dark:border-white/10 border-slate-200 bg-slate-50 dark:bg-[#0F172A] shrink-0">
                 <button onClick={() => { setTlType('all'); setFbType('all'); setFilterPaid('all'); setFilterDue('all'); setFilterDeposit('all'); setGroupBy('none'); setSortBy('created_at'); setSortDir('desc'); setShowBookmarks(false); }} className="text-teal-600 dark:text-teal-400 text-xs font-bold px-3 py-2">
                   {lang === 'de' ? 'Alle Filter löschen' : 'Clear All filters'}
                 </button>
                 <button onClick={() => setShowBottomSheet(false)} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-sm shadow-md">
                    {lang === 'de' ? 'Filter anwenden' : 'Apply Filters'}
                 </button>
              </div>
           </div>
        </div>
      )}
      
    </div>
  );
}
