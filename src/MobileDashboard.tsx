// src/MobileDashboard.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, calcHotelTotalCost, calcHotelFreeBedsToday, calculateNights, calcInvoiceItem } from './lib/utils';
import type { AccessLevel } from './lib/supabase';
import { Home, Search, Settings as SettingsIcon, PieChart, Plus, ChevronDown, Check, X, Filter, SortAsc, Calendar, Lock, LogOut, Sun, Moon, WifiOff, Wifi, Upload } from 'lucide-react';
import { HotelRow } from './components/HotelRow'; // We will replace this with MobileHotelRow in Step 2!

interface MobileDashboardProps {
  theme: 'dark' | 'light'; lang: 'de' | 'en';
  toggleTheme: () => void; setLang: (l: 'de' | 'en') => void;
  offlineMode?: boolean; onToggleOfflineMode?: () => void;
  viewOnly?: boolean; accessLevel?: AccessLevel | null; onSignOut?: () => void;
}

export default function MobileDashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel, onSignOut, offlineMode, onToggleOfflineMode }: MobileDashboardProps) {
  const dk = theme === 'dark';
  const isStrictViewer = viewOnly || accessLevel?.role === 'viewer' || accessLevel?.role === 'pending';

  // --- EXACT SAME DATA STATE AS DESKTOP ---
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'finances' | 'settings'>('home');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<'timeline' | 'filter' | 'sort'>('filter');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // FILTER STATE
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDue, setFilterDue] = useState<'all' | 'today' | '3days' | '5days'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // --- EXACT SAME DATA FETCHING ---
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

  // --- EXACT SAME FILTER MATH ---
  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      // 1. Year logic
      const durationInYear = (h.durations || []).some((d: any) => d.startDate && new Date(d.startDate).getFullYear() <= selectedYear && new Date(d.endDate).getFullYear() >= selectedYear);
      const invoiceInYear = (h.invoices || []).some((inv: any) => { const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString()); return dateStr && new Date(dateStr).getFullYear() === selectedYear; });
      if (!durationInYear && !invoiceInYear && h.year !== selectedYear) return false;

      // 2. Search logic (Applied instantly on Search Tab)
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchAll = hotelMatchesSearch(h, searchQuery, 'all');
          const deepInvoiceMatch = h.rechnungNr?.toLowerCase().includes(q) || (h.invoices || []).some((inv: any) => inv.number?.toLowerCase().includes(q));
          const deepEmployeeMatch = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
          if (!matchAll && !deepInvoiceMatch && !deepEmployeeMatch) return false;
      }

      // 3. Payment logic
      if (filterPaid === 'paid' && !h.isPaid) return false;
      if (filterPaid === 'unpaid' && h.isPaid) return false;

      return true;
    }).sort((a, b) => {
      let va: any; let vb: any;
      if (sortBy === 'cost') { va = calcHotelTotalCost(a, selectedMonth, selectedYear); vb = calcHotelTotalCost(b, selectedMonth, selectedYear); }
      else if (sortBy === 'free_beds') { va = calcHotelFreeBedsToday(a); vb = calcHotelFreeBedsToday(b); }
      else if (sortBy === 'created_at') { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); }
      else { va = a.name?.toLowerCase() || ''; vb = b.name?.toLowerCase() || ''; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, sortBy, sortDir, filterPaid, selectedMonth, selectedYear]);

  // Global Math for Finances Tab
  let totalSpend = 0; let totalPaidGlobal = 0; let totalUnpaidGlobal = 0;
  finalFiltered.forEach(h => {
     let hotelTotal = calcHotelTotalCost(h, selectedMonth, selectedYear);
     totalSpend += hotelTotal;
     if (h.isPaid) totalPaidGlobal += hotelTotal; else totalUnpaidGlobal += hotelTotal;
  });

  const btnActive = dk ? 'bg-teal-600 text-white border-transparent' : 'bg-teal-600 text-white shadow-sm';
  const btnInactive = dk ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-white border-slate-200 text-slate-600';

  return (
    <div className={cn("flex flex-col h-full", dk ? "bg-[#0F172A]" : "bg-slate-50")}>
      
      {/* MOBILE TOP BAR */}
      <div className={cn("px-4 py-3 flex items-center justify-between z-50 shrink-0 border-b", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
        <div className="text-xl font-black italic tracking-tight flex items-center gap-1">
           <span className={dk ? "text-white" : "text-slate-900"}>Euro</span><span className="text-yellow-500">Track.</span>
        </div>
        {activeTab === 'home' && (
          <div className="flex items-center gap-2">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={cn("text-xs font-bold p-1.5 rounded-lg outline-none", dk ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800")}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* SCROLLING CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-24 relative no-scrollbar">
         {loading ? (
           <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-teal-500 opacity-50" /></div>
         ) : (
            <div className="p-4 space-y-4">
              
              {/* HOME TAB: Just the list of cards */}
              {activeTab === 'home' && (
                finalFiltered.length > 0 ? finalFiltered.map((hotel, idx) => (
                  <HotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} />
                )) : <div className="text-center py-10 opacity-50 font-bold">{lang === 'de' ? 'Keine Hotels' : 'No Hotels'}</div>
              )}

              {/* SEARCH & FILTER TAB */}
              {activeTab === 'search' && (
                <div className="space-y-4">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("w-full py-3 pl-10 pr-4 rounded-xl font-bold border outline-none", dk ? "bg-[#1E293B] border-white/10 text-white focus:border-teal-500" : "bg-white border-slate-200 focus:border-teal-500")} />
                   </div>
                   <button onClick={() => setShowBottomSheet(true)} className={cn("w-full py-3 rounded-xl border flex items-center justify-center gap-2 font-bold", dk ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}>
                      <Filter size={16} /> {lang === 'de' ? 'Filter & Sortierung' : 'Filter & Sort'}
                   </button>
                   
                   <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
                      <p className="text-xs font-bold text-slate-400 mb-3">{finalFiltered.length} {lang === 'de' ? 'Ergebnisse' : 'Results'}</p>
                      {finalFiltered.map((hotel, idx) => (
                        <HotelRow key={hotel.id} entry={hotel} index={idx} isDarkMode={dk} lang={lang} viewOnly={viewOnly} searchQuery={searchQuery} />
                      ))}
                   </div>
                </div>
              )}

              {/* FINANCES TAB */}
              {activeTab === 'finances' && (
                <div className="space-y-4">
                   <div className={cn("p-5 rounded-2xl border shadow-sm", dk ? "bg-teal-900/20 border-teal-500/30" : "bg-teal-50 border-teal-200")}>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{lang === 'de' ? 'Gesamtkosten' : 'Total Spend'}</p>
                      <h2 className="text-4xl font-black text-teal-600 dark:text-teal-400 my-2">{formatCurrency(totalSpend)}</h2>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className={cn("p-4 rounded-xl border", dk ? "bg-[#1E293B] border-emerald-500/20" : "bg-white border-emerald-200")}>
                         <p className="text-[10px] font-black uppercase text-emerald-500/70">{lang === 'de' ? 'Bezahlt' : 'Paid'}</p>
                         <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaidGlobal)}</p>
                      </div>
                      <div className={cn("p-4 rounded-xl border", dk ? "bg-[#1E293B] border-red-500/20" : "bg-white border-red-200")}>
                         <p className="text-[10px] font-black uppercase text-red-500/70">{lang === 'de' ? 'Offen' : 'Unpaid'}</p>
                         <p className="text-lg font-black text-red-600 dark:text-red-400">{formatCurrency(totalUnpaidGlobal)}</p>
                      </div>
                   </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                   <div className={cn("rounded-2xl border overflow-hidden", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
                      <button onClick={toggleTheme} className="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5 font-bold">
                         <span className="flex items-center gap-3"><Moon size={18} className="text-slate-400" /> {lang === 'de' ? 'Dark Mode' : 'Dark Mode'}</span>
                         <div className={cn("w-10 h-6 rounded-full transition-colors relative", dk ? "bg-teal-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", dk ? "translate-x-4" : "")} />
                         </div>
                      </button>
                      <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5 font-bold">
                         <span className="flex items-center gap-3"><Globe size={18} className="text-slate-400" /> {lang === 'de' ? 'Sprache' : 'Language'}</span>
                         <span className="text-sm font-black text-teal-500 uppercase">{lang}</span>
                      </button>
                      <button onClick={onToggleOfflineMode} className="w-full flex items-center justify-between p-4 font-bold">
                         <span className="flex items-center gap-3"><WifiOff size={18} className="text-slate-400" /> Offline Mode</span>
                         <div className={cn("w-10 h-6 rounded-full transition-colors relative", (!isOnline || offlineMode) ? "bg-amber-500" : "bg-slate-300")}>
                            <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", (!isOnline || offlineMode) ? "translate-x-4" : "")} />
                         </div>
                      </button>
                   </div>
                   <button onClick={onSignOut} className="w-full p-4 flex items-center justify-center gap-2 font-black text-red-500 bg-red-500/10 rounded-2xl hover:bg-red-500/20 transition-all">
                      <LogOut size={18} /> {lang === 'de' ? 'Abmelden' : 'Sign Out'}
                   </button>
                </div>
              )}
            </div>
         )}
      </div>

      {/* FLOATING ACTION BUTTON (Only on Home) */}
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
            { id: 'finances', icon: PieChart, label: lang === 'de' ? 'Kosten' : 'Stats' },
            { id: 'settings', icon: SettingsIcon, label: lang === 'de' ? 'Profil' : 'Settings' }
         ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex flex-col items-center justify-center w-16 gap-1 transition-all", activeTab === tab.id ? "text-teal-500" : "text-slate-400 hover:text-slate-500")}>
               <tab.icon size={20} strokeWidth={activeTab === tab.id ? 3 : 2} />
               <span className="text-[9px] font-bold">{tab.label}</span>
            </button>
         ))}
      </div>

      {/* TABBED BOTTOM SHEET FOR FILTERS */}
      {showBottomSheet && (
        <div className="absolute inset-0 z-[99999] flex flex-col justify-end bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setShowBottomSheet(false)}>
           <div className={cn("w-full h-[70vh] rounded-t-3xl flex flex-col border-t shadow-2xl", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")} onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease-out' }}>
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 shrink-0">
                 <h3 className="text-lg font-black">{lang === 'de' ? 'Ansicht anpassen' : 'View Options'}</h3>
                 <button onClick={() => setShowBottomSheet(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full"><X size={18}/></button>
              </div>
              
              {/* Sheet Tabs */}
              <div className="flex p-2 bg-slate-50 dark:bg-[#0F172A] shrink-0">
                 {[ { id: 'filter', icon: Filter, l: 'Filter' }, { id: 'sort', icon: SortAsc, l: 'Sort' }, { id: 'time', icon: Calendar, l: 'Zeit' } ].map(t => (
                    <button key={t.id} onClick={() => setSheetTab(t.id as any)} className={cn("flex-1 py-2 flex items-center justify-center gap-2 text-xs font-bold rounded-lg transition-all", sheetTab === t.id ? (dk ? "bg-teal-500/20 text-teal-400" : "bg-white shadow text-teal-700") : "text-slate-500")}>
                       <t.icon size={14}/> {t.l}
                    </button>
                 ))}
              </div>

              {/* Sheet Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                 {sheetTab === 'filter' && (
                    <>
                       <div>
                         <p className="text-xs font-black text-slate-400 uppercase mb-2">Zahlungsstatus</p>
                         <div className="grid grid-cols-3 gap-2">
                           {[{id:'all', l:'Alle'}, {id:'paid', l:'Bezahlt'}, {id:'unpaid', l:'Offen'}].map(p => (
                             <button key={p.id} onClick={() => setFilterPaid(p.id as any)} className={cn("py-2.5 rounded-xl border text-sm font-bold", filterPaid === p.id ? btnActive : btnInactive)}>{p.l}</button>
                           ))}
                         </div>
                       </div>
                    </>
                 )}
                 {sheetTab === 'sort' && (
                    <>
                       <div className="grid grid-cols-2 gap-2">
                         {[ { id: 'name', l: 'Name' }, { id: 'cost', l: 'Kosten' }, { id: 'free_beds', l: 'Freie Betten' }, { id: 'created_at', l: 'Neueste' } ].map(s => (
                           <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-3 rounded-xl border text-sm font-bold", sortBy === s.id ? btnActive : btnInactive)}>{s.l}</button>
                         ))}
                       </div>
                       <div className="flex rounded-xl border overflow-hidden mt-4">
                         <button onClick={() => setSortDir('asc')} className={cn("flex-1 py-3 font-bold text-sm", sortDir === 'asc' ? "bg-slate-200 dark:bg-white/10" : "")}>Aufsteigend</button>
                         <button onClick={() => setSortDir('desc')} className={cn("flex-1 py-3 font-bold text-sm", sortDir === 'desc' ? "bg-slate-200 dark:bg-white/10" : "")}>Absteigend</button>
                       </div>
                    </>
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
