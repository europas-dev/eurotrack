// src/MobileDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, calcHotelTotalCost, calcHotelFreeBedsToday } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Home, Search, Star, Plus, X, Filter, SortAsc, Calendar, Loader2 } from 'lucide-react';
import { HotelRow } from './components/HotelRow';
import Header from './components/Header'; // Required to safely mount the Settings Portal!

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
  const [loading, setLoading] = useState(true);
  
  // --- MOBILE UI STATE ---
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'bookmarks'>('home');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<'filter' | 'sort' | 'time'>('filter');

  // --- FILTERS EXACTLY LIKE WEB ---
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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
        if (isMounted) setHotels(normalized); 
      } catch (err: any) { console.error("Mobile Load Error:", err); } 
      finally { if (isMounted) setLoading(false); }
    }
    fetchAllData(); 
    return () => { isMounted = false; };
  }, [selectedYear]);

  // --- EXACT MATH FILTERS FROM WEB ---
  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      const durationInYear = (h.durations || []).some((d: any) => d.startDate && new Date(d.startDate).getFullYear() <= selectedYear && new Date(d.endDate).getFullYear() >= selectedYear);
      const invoiceInYear = (h.invoices || []).some((inv: any) => { const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString()); return dateStr && new Date(dateStr).getFullYear() === selectedYear; });
      if (!durationInYear && !invoiceInYear && h.year !== selectedYear) return false;

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
    <div className={cn("flex flex-col h-full", dk ? "bg-[#0F172A]" : "bg-slate-50")}>
      
      {/* HIDDEN HEADER TO INJECT THE SETTINGS PORTAL EXACTLY AS THE WEB DOES */}
      <div className="hidden">
         <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} searchQuery="" setSearchQuery={()=>{}} searchScope="all" setSearchScope={()=>{}} onSignOut={onSignOut || (()=>{})} viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={true} />
      </div>

      {/* MOBILE TOP BAR */}
      <div className={cn("px-4 py-3 flex items-center justify-between z-50 shrink-0 border-b", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
        <div className="text-xl font-black italic tracking-tight flex items-center gap-1">
           <span className={dk ? "text-white" : "text-slate-900"}>Euro</span><span className="text-yellow-500">Track.</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={cn("text-xs font-bold px-2 py-1.5 rounded-lg outline-none", dk ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800")}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedMonth ?? 'all'} onChange={e => setSelectedMonth(e.target.value === 'all' ? null : Number(e.target.value))} className={cn("text-xs font-bold px-2 py-1.5 rounded-lg outline-none", dk ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800")}>
            <option value="all">{lang === 'de' ? 'Alle Monate' : 'All Months'}</option>
            {(lang === 'de' ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']).map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* SCROLLING CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-24 relative no-scrollbar">
         {loading ? (
           <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-teal-500 opacity-50" /></div>
         ) : (
            <div className="p-4 space-y-4">
              
              {/* HOME TAB */}
              {activeTab === 'home' && (
                <>
                  {/* HOME PAGE STATS (Copied from Desktop Top Bar) */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className={cn("col-span-2 p-4 rounded-xl border flex items-center justify-between", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                       <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{lang === 'de' ? 'Gesamtkosten' : 'Total Spend'}</p>
                         <h2 className="text-2xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(totalSpend)}</h2>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-emerald-500">{lang === 'de' ? 'Bezahlt' : 'Paid'}: {formatCurrency(totalPaidGlobal)}</p>
                          <p className="text-[10px] font-bold text-red-500">{lang === 'de' ? 'Offen' : 'Unpaid'}: {formatCurrency(totalUnpaidGlobal)}</p>
                       </div>
                    </div>
                    <div className={cn("p-4 rounded-xl border text-center", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{lang === 'de' ? 'Freie Betten' : 'Free Beds'}</p>
                       <h2 className={cn("text-2xl font-black", freeBedsTotal > 0 ? "text-red-500" : (dk ? "text-teal-500" : "text-teal-600"))}>{freeBedsTotal}</h2>
                    </div>
                    <div className={cn("p-4 rounded-xl border text-center", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hotels</p>
                       <h2 className={cn("text-2xl font-black", dk ? "text-slate-300" : "text-slate-700")}>{finalFiltered.length}</h2>
                    </div>
                  </div>

                  {finalFiltered.length > 0 ? finalFiltered.map((hotel, idx) => (
                    <HotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} />
                  )) : <div className="text-center py-10 opacity-50 font-bold">{lang === 'de' ? 'Keine Hotels gefunden' : 'No Hotels found'}</div>}
                </>
              )}

              {/* SEARCH TAB */}
              {activeTab === 'search' && (
                <div className="space-y-4 animate-in fade-in">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("w-full py-3 pl-10 pr-4 rounded-xl font-bold border outline-none", dk ? "bg-[#1E293B] border-white/10 text-white focus:border-teal-500" : "bg-white border-slate-200 focus:border-teal-500")} />
                   </div>
                   <button onClick={() => setShowBottomSheet(true)} className={cn("w-full py-3 rounded-xl border flex items-center justify-center gap-2 font-bold", dk ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}>
                      <Filter size={16} /> {lang === 'de' ? 'Filter, Sortierung & Zeitraum' : 'Filter, Sort & Timeline'}
                   </button>
                   <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
                      <p className="text-xs font-bold text-slate-400 mb-3">{finalFiltered.length} {lang === 'de' ? 'Ergebnisse' : 'Results'}</p>
                      {finalFiltered.map((hotel, idx) => (
                        <HotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} searchQuery={searchQuery} />
                      ))}
                   </div>
                </div>
              )}

              {/* BOOKMARKS TAB */}
              {activeTab === 'bookmarks' && (
                <div className="space-y-4 animate-in fade-in">
                   {finalFiltered.length > 0 ? finalFiltered.map((hotel, idx) => (
                      <HotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} />
                   )) : (
                      <div className="text-center py-10 opacity-50 font-bold flex flex-col items-center">
                         <Star size={32} className="mb-2 text-slate-400" />
                         {lang === 'de' ? 'Keine markierten Hotels' : 'No bookmarked hotels'}
                      </div>
                   )}
                </div>
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
         
         {/* THE SETTINGS BUTTON: Dispatches the event to the hidden Header.tsx */}
         <button onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))} className={cn("flex flex-col items-center justify-center w-16 gap-1 transition-all text-slate-400 hover:text-slate-500")}>
             <SettingsIcon size={20} strokeWidth={2} />
             <span className="text-[9px] font-bold">{lang === 'de' ? 'Profil' : 'Settings'}</span>
         </button>
      </div>

      {/* TABBED BOTTOM SHEET FOR FILTERS (Exact Match to Web) */}
      {showBottomSheet && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setShowBottomSheet(false)}>
           <div className={cn("w-full h-[70vh] rounded-t-3xl flex flex-col border-t shadow-2xl", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")} onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease-out' }}>
              
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 shrink-0">
                 <h3 className="text-lg font-black">{lang === 'de' ? 'Ansicht anpassen' : 'View Options'}</h3>
                 <button onClick={() => setShowBottomSheet(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full"><X size={18}/></button>
              </div>
              
              <div className="flex p-2 bg-slate-50 dark:bg-[#0F172A] shrink-0 border-b border-slate-200 dark:border-white/10">
                 {[ { id: 'filter', icon: Filter, l: 'Filter' }, { id: 'sort', icon: SortAsc, l: 'Sort' }, { id: 'time', icon: Calendar, l: 'Zeit' } ].map(t => (
                    <button key={t.id} onClick={() => setSheetTab(t.id as any)} className={cn("flex-1 py-2 flex items-center justify-center gap-2 text-xs font-bold rounded-lg transition-all", sheetTab === t.id ? (dk ? "bg-teal-500/20 text-teal-400" : "bg-white shadow text-teal-700") : "text-slate-500")}>
                       <t.icon size={14}/> {t.l}
                    </button>
                 ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                 {sheetTab === 'filter' && (
                    <div className="space-y-5">
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">Zahlungsstatus</p>
                         <div className="grid grid-cols-3 gap-2">
                           {[{id:'all', l:'Alle'}, {id:'paid', l:'Bezahlt'}, {id:'unpaid', l:'Offen'}].map(p => (
                             <button key={p.id} onClick={() => setFilterPaid(p.id as any)} className={cn("py-2.5 rounded-xl border text-sm font-bold transition-all", filterPaid === p.id ? btnActive : btnInactive)}>{p.l}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">Fälligkeit</p>
                         <div className="grid grid-cols-2 gap-2">
                           {[{id:'all', l:'Alle'}, {id:'today', l:'Heute'}, {id:'3days', l:'In 3 Tagen'}, {id:'5days', l:'In 5 Tagen'}].map(p => (
                             <button key={p.id} onClick={() => setFilterDue(p.id as any)} className={cn("py-2.5 rounded-xl border text-sm font-bold transition-all", filterDue === p.id ? btnActive : btnInactive)}>{p.l}</button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">Kaution</p>
                         <div className="grid grid-cols-3 gap-2">
                           {[{id:'all', l:'Alle'}, {id:'yes', l:'Ja'}, {id:'no', l:'Nein'}].map(p => (
                             <button key={p.id} onClick={() => setFilterDeposit(p.id as any)} className={cn("py-2.5 rounded-xl border text-sm font-bold transition-all", filterDeposit === p.id ? btnActive : btnInactive)}>{p.l}</button>
                           ))}
                         </div>
                       </div>
                    </div>
                 )}

                 {sheetTab === 'sort' && (
                    <>
                       <div className="grid grid-cols-2 gap-2">
                         {[ { id: 'name', l: 'Name' }, { id: 'cost', l: 'Kosten' }, { id: 'bed_price', l: 'Preis/Bett' }, { id: 'free_beds', l: 'Freie Betten' }, { id: 'payment_due', l: 'Fälligkeit' }, { id: 'total_paid', l: 'Total Bezahlt' }, { id: 'created_at', l: 'Neueste' }, { id: 'updated_at', l: 'Zuletzt Aktualisiert' } ].map(s => (
                           <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-3 rounded-xl border text-sm font-bold transition-all", sortBy === s.id ? btnActive : btnInactive)}>{s.l}</button>
                         ))}
                       </div>
                       <div className="flex rounded-xl border overflow-hidden mt-4">
                         <button onClick={() => setSortDir('asc')} className={cn("flex-1 py-3 font-bold text-sm transition-all", sortDir === 'asc' ? (dk ? "bg-white/10" : "bg-slate-200") : dk ? "bg-transparent text-slate-400" : "bg-white text-slate-500")}>Aufsteigend</button>
                         <button onClick={() => setSortDir('desc')} className={cn("flex-1 py-3 font-bold text-sm transition-all border-l", sortDir === 'desc' ? (dk ? "bg-white/10 border-transparent" : "bg-slate-200 border-transparent") : dk ? "bg-transparent text-slate-400 border-white/10" : "bg-white text-slate-500 border-slate-200")}>Absteigend</button>
                       </div>
                    </>
                 )}

                 {sheetTab === 'time' && (
                    <div className="space-y-5">
                       <div className="grid grid-cols-2 gap-2">
                          {[ { id: 'today', lEn: 'Today', lDe: 'Heute', off: 0 }, { id: 'tomorrow', lEn: 'Tomorrow', lDe: 'Morgen', off: 1 }, { id: '3days', lEn: '3 Days', lDe: '3 Tage', off: 3 }, { id: '7days', lEn: '7 Days', lDe: '7 Tage', off: 7 } ].map(t => (
                            <button key={t.id} onClick={() => { const s = new Date(); if (t.off > 0 && t.id !== '3days' && t.id !== '7days') s.setDate(s.getDate() + t.off); const e = new Date(); e.setDate(e.getDate() + t.off); setTlStart(s.toISOString().split('T')[0]); setTlEnd(e.toISOString().split('T')[0]); setTlType(t.id as any); }} className={cn("py-2.5 rounded-xl border text-sm font-bold transition-all", tlType === t.id ? btnActive : btnInactive)}>
                              {lang === 'de' ? t.lDe : t.lEn}
                            </button>
                          ))}
                       </div>
                       <div className="flex items-center gap-3">
                           <input type="date" value={tlStart} onChange={e => {setTlStart(e.target.value); setTlType('range');}} className={cn("flex-1 px-3 py-2 rounded-lg border text-sm font-bold outline-none", dk ? "bg-black/40 border-white/10 text-white" : "bg-white border-slate-200")} />
                           <span className="text-slate-400">➔</span>
                           <input type="date" min={tlStart} value={tlEnd} onChange={e => {if(tlStart && e.target.value < tlStart) return; setTlEnd(e.target.value); setTlType('range');}} className={cn("flex-1 px-3 py-2 rounded-lg border text-sm font-bold outline-none", dk ? "bg-black/40 border-white/10 text-white" : "bg-white border-slate-200")} />
                       </div>
                       <button onClick={() => {setTlType('all'); setTlStart(''); setTlEnd('');}} className={cn("w-full py-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-bold", dk ? "border-red-500/30 text-red-400 bg-red-500/10" : "border-red-200 text-red-600 bg-red-50")}>
                          Zeitraum zurücksetzen
                       </button>
                    </div>
                 )}
              </div>
              
              <div className="p-4 border-t shrink-0 dark:border-white/10 border-slate-200 bg-slate-50 dark:bg-[#0F172A]">
                 <button onClick={() => setShowBottomSheet(false)} className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-lg shadow-lg">
                    {lang === 'de' ? 'Ergebnisse Anzeigen' : 'Show Results'}
                 </button>
              </div>
           </div>
        </div>
      )}
      
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
