// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock, StickyNote, ExternalLink, Search, CornerDownRight, Receipt, FileText, Tag, Wallet, Calculator, Edit3, PlusCircle } from 'lucide-react';
import {
  cn, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatDateChip, formatLastUpdated, calculateNights, normalizeNumberInput
} from '../lib/utils';
import { createDuration, updateHotel, deleteHotel } from '../lib/supabase';
import { calcRoomCardTotal } from '../lib/roomCardUtils';
import DurationCard from './DurationCard';

export const DEFAULT_COUNTRIES = [
  'Germany', 'Switzerland', 'Austria', 'Netherlands', 'Poland', 'Belgium', 'France', 'Luxembourg'
];

export function getCountryOptions() {
  return DEFAULT_COUNTRIES; 
}

const getCountryCode = (country: string) => {
  const codes: any = { 'Germany': '+49', 'Switzerland': '+41', 'Austria': '+43', 'Netherlands': '+31', 'Poland': '+48', 'Belgium': '+32', 'France': '+33', 'Luxembourg': '+352' };
  return codes[country] || '+49';
};

function formatShortDate(isoString?: string | null, lang: string = 'de'): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });
}

function formatCurrency(amount: number): string {
  return (amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const HighlightText = ({ text, query }: { text: string; query?: string }) => {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-teal-400 text-black px-0.5 rounded font-bold">{part}</mark> : part
      )}
    </>
  );
};

// --- SEAMLESS AUTOCOMPLETE INPUT ---
function SeamlessInput({ value, options, isDarkMode, onChange, placeholder, className, textClass, searchQuery }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [showOptions, setShowOptions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(value || ''); }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) { 
      if (ref.current && !ref.current.contains(e.target as Node)) { 
        setEditing(false);
        setShowOptions(false); 
        if (draft !== value) onChange(draft);
      } 
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [draft, value, onChange]);

  const filtered = (options || []).filter((o: string) => o.toLowerCase().includes(draft.toLowerCase()) && o.toLowerCase() !== draft.toLowerCase()).slice(0, 5);

  if (!editing) {
    return (
      <div className={cn("cursor-text hover:opacity-70 truncate transition-opacity w-full min-h-[20px]", textClass)} onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(value || ''); setShowOptions(true); }}>
        {value ? <HighlightText text={value} query={searchQuery} /> : <span className="opacity-40">{placeholder}</span>}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative w-full", className)} onClick={e => e.stopPropagation()}>
      <input autoFocus value={draft} onChange={e => { setDraft(e.target.value); setShowOptions(true); }} onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); setShowOptions(false); } }} placeholder={placeholder} className={cn("w-full bg-transparent border-none outline-none focus:ring-0 p-0 m-0 truncate placeholder:opacity-40 transition-colors focus:text-teal-500", textClass)} />
      {showOptions && filtered.length > 0 && (
        <div className={cn("absolute top-full left-0 mt-1 w-max min-w-[200px] z-[200] rounded-xl border shadow-xl py-1 overflow-hidden", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {filtered.map((opt: string) => (
            <button key={opt} onClick={() => { setDraft(opt); onChange(opt); setEditing(false); setShowOptions(false); }} className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-all", isDarkMode ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', selectedMonth = null, selectedYear = null, companyOptions = [], cityOptions = [], hotelOptions = [], onDelete, onUpdate, onDeleteCompanyOption, onAddOption }: any) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  // UI Toggles for Master Card
  const [showMasterBase, setShowMasterBase] = useState(entry.base_netto != null || entry.base_brutto != null);
  
  // Override Edit States
  const [editingONetto, setEditingONetto] = useState(false);
  const [editingOBrutto, setEditingOBrutto] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]').includes(entry.id); } catch { return false; }
  });

  const [localHotel, setLocalHotel] = useState({
    ...entry,
    companyTag: Array.isArray(entry?.companyTag) ? entry.companyTag : (entry?.companyTag ? [entry.companyTag] : []),
    durations: entry?.durations ?? [],
    extraCosts: entry?.extra_costs ?? [],
    baseMwst: entry?.base_mwst ?? 19,
  });
  
  const [saving, setSaving] = useState(false);
  const [creatingDuration, setCreatingDuration] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  const hiddenMatchText = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    for (const d of (localHotel.durations || [])) {
      if (localHotel.rechnungNr?.toLowerCase().includes(q) || d.rechnungNr?.toLowerCase().includes(q)) return lang === 'de' ? `Treffer: Rechnung` : `Invoice Match`;
      for (const rc of (d.roomCards || [])) {
        for (const emp of (rc.employees || [])) {
          if (emp.name?.toLowerCase().includes(q)) return lang === 'de' ? `Treffer: Mitarbeiter` : `Employee Match`;
        }
      }
    }
    return null;
  }, [localHotel, searchQuery, lang]);

  // --- THE MASTER ACCOUNTING ENGINE ---
  const masterMath = useMemo(() => {
    let tFree = 0; let tBeds = 0; const allEmps: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    let sumDurationNetto = 0;
    let sumDurationBrutto = 0;
    let totalNightsAllRooms = 0;
    
    // 1. Roll up Durations
    (localHotel.durations || []).forEach((d: any) => {
      const nights = calculateNights(d.startDate, d.endDate);
      let dNetto = 0; let dBrutto = 0;

      // Handle Manual Duration Overrides if they exist
      if (d.useBruttoNetto && (d.netto || d.brutto)) {
         if (d.netto) { dNetto = d.netto; dBrutto = d.netto * (1 + (d.mwst || 19)/100); }
         else if (d.brutto) { dBrutto = d.brutto; dNetto = d.brutto / (1 + (d.mwst || 19)/100); }
      } else {
         (d.roomCards || []).forEach((c: any) => {
            const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
            tBeds += b;
            totalNightsAllRooms += (b * nights);
            allEmps.push(...(c.employees || []));
            
            // Assuming roomCardUtils correctly populated totalNetto/totalBrutto
            dNetto += (c.totalNetto || 0);
            dBrutto += (c.totalBrutto || 0);
         });
      }
      sumDurationNetto += dNetto;
      sumDurationBrutto += dBrutto;
      tFree += calcDurationFreeBeds(d, today);
    });

    // 2. Base Cost Logic (Mutual Exclusivity & Wait to Calculate)
    let bNetto = 0; let bBrutto = 0; 
    let bMwSt = parseFloat(localHotel.baseMwst);
    let isMwstValid = !isNaN(bMwSt);

    if (localHotel.base_netto != null) {
      bNetto = parseFloat(localHotel.base_netto);
      bBrutto = isMwstValid ? bNetto * (1 + bMwSt/100) : 0;
    } else if (localHotel.base_brutto != null) {
      bBrutto = parseFloat(localHotel.base_brutto);
      bNetto = isMwstValid ? bBrutto / (1 + bMwSt/100) : 0;
    } else {
      // Default to Duration Sums if Master is untouched
      bNetto = sumDurationNetto;
      bBrutto = sumDurationBrutto;
    }

    // Base Discount (Before Tax)
    if (localHotel.hasDiscount && localHotel.discountValue) {
       const dVal = parseFloat(localHotel.discountValue);
       if (localHotel.discountType === 'fixed') {
         bNetto = Math.max(0, bNetto - dVal);
       } else {
         bNetto = Math.max(0, bNetto * (1 - dVal/100));
       }
       bBrutto = isMwstValid ? bNetto * (1 + bMwSt/100) : 0;
    }

    let buckets: Record<string, number> = {};
    if (isMwstValid && bNetto > 0) {
       buckets[bMwSt] = bNetto * (bMwSt / 100);
    }

    // 3. Extra Costs
    let extraNettoTotal = 0; let extraBruttoTotal = 0;
    (localHotel.extraCosts || []).forEach((ec: any) => {
       let eNetto = 0; let eBrutto = 0;
       let eMwst = parseFloat(ec.mwst ?? 19);
       let eMwstValid = !isNaN(eMwst);

       if (ec.netto != null) {
         eNetto = parseFloat(ec.netto);
         eBrutto = eMwstValid ? eNetto * (1 + eMwst/100) : 0;
       } else if (ec.brutto != null) {
         eBrutto = parseFloat(ec.brutto);
         eNetto = eMwstValid ? eBrutto / (1 + eMwst/100) : 0;
       }
       extraNettoTotal += eNetto;
       extraBruttoTotal += eBrutto;
       if (eMwstValid && eNetto > 0) {
         buckets[eMwst] = (buckets[eMwst] || 0) + (eNetto * (eMwst / 100));
       }
    });

    // 4. Subtotals & Global Discount
    let preGlobalNetto = bNetto + extraNettoTotal;
    let preGlobalBrutto = bBrutto + extraBruttoTotal;
    
    let finalNetto = preGlobalNetto;
    let finalBrutto = preGlobalBrutto;

    if (localHotel.has_global_discount && localHotel.global_discount_value) {
       const gVal = parseFloat(localHotel.global_discount_value);
       const isFixed = localHotel.global_discount_type === 'fixed';
       const target = localHotel.global_discount_target || 'netto';
       
       if (target === 'netto') {
          let ratio = isFixed ? (gVal / preGlobalNetto) : (gVal / 100);
          if (!isFinite(ratio)) ratio = 0;
          finalNetto = Math.max(0, preGlobalNetto - (isFixed ? gVal : preGlobalNetto * ratio));
          // Recalculate taxes based on the reduced netto proportionally
          finalBrutto = finalNetto;
          Object.keys(buckets).forEach(k => {
             buckets[k] = buckets[k] * (1 - ratio);
             finalBrutto += buckets[k];
          });
       } else {
          // Applies to final Brutto only (does not change tax values natively)
          finalBrutto = Math.max(0, preGlobalBrutto - (isFixed ? gVal : preGlobalBrutto * (gVal/100)));
       }
    }

    // 5. Final Overrides (The 1-Cent Fix)
    const displayNetto = localHotel.override_total_netto != null ? parseFloat(localHotel.override_total_netto) : finalNetto;
    const displayBrutto = localHotel.override_total_brutto != null ? parseFloat(localHotel.override_total_brutto) : finalBrutto;
    
    // Deposit
    let balance = displayBrutto;
    if (localHotel.depositEnabled && localHotel.depositAmount) {
       balance -= parseFloat(localHotel.depositAmount);
    }

    let pricePerBed = 0;
    if (totalNightsAllRooms > 0) pricePerBed = displayNetto / totalNightsAllRooms;

    return { 
      freeBeds: tFree, totalBeds: tBeds, employees: allEmps, 
      displayNetto, displayBrutto, buckets, balance, pricePerBed,
      isOverriddenNetto: localHotel.override_total_netto != null,
      isOverriddenBrutto: localHotel.override_total_brutto != null
    };
  }, [localHotel, selectedMonth, selectedYear]);

  const visibleEmps = masterMath.employees.slice(0, 6);
  const hiddenEmpsCount = masterMath.employees.length > 6 ? masterMath.employees.length - 6 : 0;

  function patchHotel(changes: any) {
    const next = { ...localHotel, ...changes };
    setLocalHotel(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateHotel(localHotel.id, next);
        onUpdate(localHotel.id, next);
      } catch (e: any) { alert(`Error: ${e.message}`); }
      finally { setSaving(false); }
    }, 400);
  }

  // EXTRAS HANDLERS
  const addExtra = () => patchHotel({ extraCosts: [...localHotel.extraCosts, { id: Math.random().toString(), note: '', netto: null, mwst: 19, brutto: null }], extra_costs: [...localHotel.extraCosts, { id: Math.random().toString(), note: '', netto: null, mwst: 19, brutto: null }] });
  const updateExtra = (id: string, updates: any) => {
    const next = localHotel.extraCosts.map((e:any) => e.id === id ? { ...e, ...updates } : e);
    patchHotel({ extraCosts: next, extra_costs: next });
  };
  const removeExtra = (id: string) => {
    const next = localHotel.extraCosts.filter((e:any) => e.id !== id);
    patchHotel({ extraCosts: next, extra_costs: next });
  };

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const current = JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]');
      if (isBookmarked) {
        const next = current.filter((id: string) => id !== localHotel.id);
        localStorage.setItem('eurotrack_bookmarks', JSON.stringify(next));
        setIsBookmarked(false);
      } else {
        current.push(localHotel.id);
        localStorage.setItem('eurotrack_bookmarks', JSON.stringify(current));
        setIsBookmarked(true);
      }
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  const handleEnterBlur = (e: React.KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); };
  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500');
  const inputCls = cn('w-full px-3 py-2 rounded-lg text-sm font-bold outline-none border transition-all focus:border-teal-500 h-[38px]', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900');

  return (
    <div className="space-y-1 relative" style={{ zIndex: 40 - (index % 30) }}>
      <div className={cn('rounded-2xl border transition-all duration-200 shadow-sm relative', dk ? 'bg-[#1E293B] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300')}>
        
        {/* MAIN ROW (Collapsed View) */}
        <div className={cn('flex flex-wrap md:flex-nowrap items-center gap-0 cursor-pointer p-2', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', open && 'border-b', open && (dk ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'))} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          <div className="flex-[2] py-2 min-w-[200px] pr-2">
            <SeamlessInput value={localHotel.name} options={hotelOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ name: val })} placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel Name...'} textClass={cn('text-[15px] font-black leading-tight', dk ? 'text-white' : 'text-slate-900')} searchQuery={searchQuery} />
            <SeamlessInput value={localHotel.city} options={cityOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ city: val })} placeholder={lang === 'de' ? 'Stadt...' : 'City...'} className="mt-0.5" textClass={cn("text-[10px] font-bold uppercase tracking-widest", dk ? "text-slate-500" : "text-slate-400")} searchQuery={searchQuery} />
            {hiddenMatchText && !open && (<span className="inline-block mt-1 px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-[9px] font-bold rounded-full truncate">🔍 {hiddenMatchText}</span>)}
          </div>

          <div className="flex-[0.8] px-2 min-w-[120px]" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={(tags:any) => patchHotel({ companyTag: tags, company_tag: tags })} onDeleteOption={onDeleteCompanyOption} onAddOption={onAddOption} />
          </div>

          <div className="flex-[1.5] px-2 min-w-[120px]">
            <div className="flex flex-wrap gap-1.5">
              {localHotel.durations.map((d: any) => {
                 const totalRooms = d.roomCards?.length || 0;
                 const typeCount = (d.roomCards || []).reduce((acc:any, r:any) => { acc[r.roomType] = (acc[r.roomType]||0)+1; return acc; }, {});
                 const typeStr = Object.entries(typeCount).map(([k,v]) => `${v} ${k}`).join(', ');
                 const nights = calculateNights(d.startDate, d.endDate);
                 const tooltipText = lang === 'de' ? `Gesamt ${totalRooms} Zimmer (${typeStr}), ${nights} Nächte` : `Total ${totalRooms} rooms (${typeStr}), ${nights} Nights`;

                 return (
                  <div key={d.id} className="relative group">
                    <div className={cn('px-2.5 py-1 rounded-md text-xs font-bold border truncate text-center cursor-help transition-all shadow-sm', dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:border-white/20' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300')}>
                      {d.startDate && d.endDate ? `${formatShortDate(d.startDate, lang)} - ${formatShortDate(d.endDate, lang)}` : 'New'}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 z-[100] pointer-events-none shadow-xl border border-white/10 transition-opacity">{tooltipText}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-[2.5] px-2">
            <div className="flex flex-wrap gap-1.5">
              {visibleEmps.map((emp: any, i: number) => {
                const status = getEmployeeStatus(emp.checkIn, emp.checkOut);
                const nights = calculateNights(emp.checkIn, emp.checkOut);
                const isUpcoming = status === 'upcoming';
                const borderCls = status === 'active' ? "border-emerald-500 border-solid" : status === 'upcoming' ? "border-blue-500 border-dashed" : status === 'ending-soon' ? "border-red-500 border-dashed" : "border-slate-300 border-solid dark:border-slate-600";
                
                return (
                  <div key={i} className="relative group flex items-center">
                    <div className={cn("px-2 py-0.5 rounded-md border text-xs font-bold truncate text-center min-w-[70px] cursor-help flex items-center justify-center gap-1 shadow-sm", borderCls, dk ? "bg-black/20 text-white" : "bg-white text-slate-900")}>
                      {isUpcoming && <CornerDownRight size={10} className="shrink-0 opacity-70 text-blue-500" />}
                      <HighlightText text={emp.name || '_ _ _'} query={searchQuery} />
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 z-[100] pointer-events-none shadow-xl border border-white/10 transition-opacity text-center">
                      {formatShortDate(emp.checkIn, lang)} ➔ {formatShortDate(emp.checkOut, lang)}<br/>
                      <span className="text-teal-400">{nights} {lang === 'de' ? 'Nächte' : 'Nights'}</span>
                    </div>
                  </div>
                );
              })}
              {hiddenEmpsCount > 0 && <div className="px-2 py-0.5 rounded-md border border-dashed border-slate-400 text-[11px] font-bold text-center flex items-center justify-center">+{hiddenEmpsCount}</div>}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-6 pr-3 shrink-0 min-w-[280px] justify-end">
            <div className="text-center w-10">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{lang === 'de' ? 'Frei' : 'Free'}</p>
              <p className={cn('text-lg font-black', masterMath.freeBeds > 0 ? 'text-red-500' : dk ? 'text-teal-500' : 'text-teal-600')}>{masterMath.freeBeds}</p>
            </div>
            <div className="text-center w-10">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{lang === 'de' ? 'Betten' : 'Beds'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{masterMath.totalBeds}</p>
            </div>
            <div className="text-right min-w-[100px]">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{lang === 'de' ? 'Kosten' : 'Cost'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(masterMath.displayBrutto)}</p>
            </div>
            
            <div className="flex items-center gap-1 pl-2">
               <button onClick={handleBookmarkToggle} className={cn("p-1.5 rounded-lg transition-all", isBookmarked ? "text-yellow-500 hover:text-yellow-400 bg-yellow-500/10" : "text-slate-400 hover:text-yellow-500 hover:bg-white/5")}><Star size={16} className={isBookmarked ? "fill-yellow-500" : ""} /></button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"><Clock size={16} /></button>
                  <div className="absolute right-0 bottom-full mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 z-[100] whitespace-nowrap pointer-events-none shadow-xl border border-white/10">{formatLastUpdated(localHotel.last_updated_by || localHotel.lastUpdatedBy, localHotel.last_updated_at || localHotel.lastUpdatedAt, lang)}</div>
               </div>
               <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>

        {/* EXPANDED BREAKDOWN */}
        {open && (
          <div className={cn('p-6 space-y-6 rounded-b-2xl border-t', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50 border-slate-200')} onClick={e => e.stopPropagation()}>
            
            {/* Contact Row */}
            <div className="flex flex-wrap xl:flex-nowrap gap-4 items-end">
              <div className="flex-[2.5] min-w-[220px] flex items-end gap-2">
                 <div className="shrink-0"><label className={labelCls}><StickyNote size={12}/> {lang === 'de' ? 'Notiz' : 'Note'}</label><button onClick={() => setShowNotes(!showNotes)} className={cn("w-[38px] h-[38px] rounded-lg border flex items-center justify-center transition-all", localHotel.notes ? "bg-teal-500/10 border-teal-500/30 text-teal-500" : dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-white hover:bg-white/5" : "bg-white border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50")}><StickyNote size={16} /></button></div>
                 <div className="flex-1"><label className={labelCls}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label><input autoComplete="off" value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} className={inputCls} placeholder="..." /></div>
              </div>
              <div className="flex-[1.5] min-w-[140px]"><label className={labelCls}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact'}</label><input autoComplete="off" value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} className={inputCls} placeholder="..." /></div>
              <div className="flex-[1.5] min-w-[140px]"><label className={labelCls}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label><div className={cn('flex items-center rounded-lg border overflow-hidden h-[38px]', dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}><span className={cn("px-2.5 text-xs font-bold border-r h-full flex items-center shrink-0", dk ? "bg-black/40 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500")}>{getCountryCode(localHotel.country || 'Germany')}</span><input autoComplete="off" value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} className={cn('w-full px-2 py-2 text-sm font-bold outline-none bg-transparent h-full', dk ? 'text-white' : 'text-slate-900')} placeholder="..." /></div></div>
              <div className="flex-[1.5] min-w-[160px]"><label className={labelCls}><Mail size={12}/> Email</label><div className="relative flex items-center h-[38px]"><input autoComplete="off" value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} className={cn(inputCls, 'pr-10')} placeholder="..." />{localHotel.email && <a href={`mailto:${localHotel.email}`} className="absolute right-1.5 p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-500"><Mail size={14} /></a>}</div></div>
              <div className="flex-[1] min-w-[120px]"><label className={labelCls}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label><ModernDropdown value={localHotel.country || 'Germany'} options={getCountryOptions()} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} /></div>
            </div>

            {showNotes && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea autoComplete="off" autoFocus value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} className={cn(inputCls, 'min-h-[60px] h-auto resize-y p-3')} placeholder={lang === 'de' ? "Private Notizen hier eintragen..." : "Write private notes here..."} />
              </div>
            )}

            {/* --- NEW MASTER INVOICE CARD --- */}
            <div className={cn("rounded-2xl border flex flex-col xl:flex-row overflow-hidden", dk ? "bg-black/20 border-white/10 shadow-xl" : "bg-white border-slate-200 shadow-md")}>
                
                {/* COL 1 & 2: Action Center */}
                <div className="flex-1 p-5 flex flex-col gap-5">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                       <div className="flex gap-4">
                         <div className="w-[180px]"><label className={labelCls}><Receipt size={12}/> Invoice No.</label><input value={localHotel.rechnungNr || ''} onChange={e => patchHotel({ rechnungNr: e.target.value, rechnung_nr: e.target.value })} className={inputCls} placeholder="RE-2026-..." /></div>
                         <div className="w-[180px]"><label className={labelCls}><FileText size={12}/> Booking Ref</label><input value={localHotel.bookingId || ''} onChange={e => patchHotel({ bookingId: e.target.value, booking_id: e.target.value })} className={inputCls} placeholder="..." /></div>
                       </div>
                       <div className="flex items-center gap-2">
                          <button onClick={() => setShowMasterBase(!showMasterBase)} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5", showMasterBase ? (dk ? "bg-teal-600 text-white border-teal-500" : "bg-teal-600 text-white border-teal-700") : (dk ? "bg-[#1E293B] text-slate-400 border-white/10 hover:text-white" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"))}><Calculator size={12}/> Brutto / Netto</button>
                          <button onClick={() => patchHotel({has_global_discount: !localHotel.has_global_discount})} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5", localHotel.has_global_discount ? (dk ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-indigo-50 text-indigo-600 border-indigo-200") : (dk ? "bg-[#1E293B] text-slate-400 border-white/10" : "bg-slate-50 text-slate-500 border-slate-200"))}><Tag size={12} /> Disc.</button>
                          <button onClick={addExtra} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5", dk ? "bg-[#1E293B] text-slate-400 border-white/10 hover:text-white" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100")}><PlusCircle size={12} /> Extra</button>
                       </div>
                    </div>

                    <div className="flex flex-col gap-3">
                       {/* BASE COST ROW */}
                       {showMasterBase && (
                         <div className={cn("flex items-center gap-3 p-3 rounded-xl border animate-in fade-in slide-in-from-top-2", dk ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
                            <span className="text-xs font-black uppercase tracking-widest text-teal-500 w-24">Base Cost</span>
                            <div className="flex-1 flex gap-2">
                               <div className="flex flex-col"><span className={labelCls}>Netto €</span><input type="number" value={localHotel.base_netto ?? ''} onChange={e => patchHotel({base_netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value), base_brutto: null})} className={cn(inputCls, 'w-28')} placeholder="Auto" /></div>
                               
                               {localHotel.hasDiscount && (
                                 <div className="flex flex-col"><span className={labelCls}>Base Disc.</span>
                                   <div className="flex">
                                     <input type="number" value={localHotel.discountValue || ''} onChange={e => patchHotel({discountValue: parseFloat(e.target.value)||0})} className={cn(inputCls, 'w-20 rounded-r-none border-r-0')} placeholder="0" />
                                     <select value={localHotel.discountType || 'percentage'} onChange={e => patchHotel({discountType: e.target.value})} className={cn(inputCls, "w-12 rounded-l-none px-1 text-center font-black")}>
                                       <option value="percentage">%</option><option value="fixed">€</option>
                                     </select>
                                   </div>
                                 </div>
                               )}
                               
                               <div className="flex flex-col"><span className={labelCls}>MwSt %</span>
                                 <input list="mwst-opts" value={localHotel.baseMwst ?? ''} onChange={e => patchHotel({baseMwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value), base_mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value)})} className={cn(inputCls, 'w-20')} placeholder="19" />
                                 <datalist id="mwst-opts"><option value="19"/><option value="7"/><option value="0"/></datalist>
                               </div>
                               <div className="flex flex-col"><span className={labelCls}>Brutto €</span><input type="number" value={localHotel.base_brutto ?? ''} onChange={e => patchHotel({base_brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value), base_netto: null})} disabled={localHotel.base_netto != null} className={cn(inputCls, 'w-28 disabled:opacity-50 disabled:cursor-not-allowed')} placeholder={localHotel.base_netto != null ? "Auto" : "Auto"} /></div>
                            </div>
                         </div>
                       )}

                       {/* GLOBAL DISCOUNT ROW */}
                       {localHotel.has_global_discount && (
                         <div className={cn("flex items-center gap-3 p-3 rounded-xl border animate-in fade-in slide-in-from-top-2", dk ? "bg-indigo-500/5 border-indigo-500/20" : "bg-indigo-50/50 border-indigo-200")}>
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 w-24">Global Disc</span>
                            <div className="flex-1 flex gap-2">
                               <div className="flex flex-col"><span className={labelCls}>Value</span><input type="number" value={localHotel.global_discount_value || ''} onChange={e => patchHotel({global_discount_value: normalizeNumberInput(e.target.value)})} className={cn(inputCls, 'w-28')} placeholder="0" /></div>
                               <div className="flex flex-col"><span className={labelCls}>Type</span><select value={localHotel.global_discount_type || 'fixed'} onChange={e => patchHotel({global_discount_type: e.target.value})} className={cn(inputCls, 'w-16 font-black')}><option value="fixed">€</option><option value="percentage">%</option></select></div>
                               <div className="flex flex-col"><span className={labelCls}>Target</span><select value={localHotel.global_discount_target || 'netto'} onChange={e => patchHotel({global_discount_target: e.target.value})} className={cn(inputCls, 'w-24')}><option value="netto">Netto</option><option value="brutto">Brutto</option></select></div>
                            </div>
                         </div>
                       )}

                       {/* EXTRA COSTS */}
                       {localHotel.extraCosts?.length > 0 && (
                         <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                            {localHotel.extraCosts.map((ec:any) => (
                               <div key={ec.id} className={cn("flex items-center gap-3 p-2 rounded-xl border", dk ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-12 text-right">Extra</span>
                                  <input value={ec.note} onChange={e => updateExtra(ec.id, {note: e.target.value})} className={cn(inputCls, 'flex-1')} placeholder="Note... (e.g. Parken)" />
                                  <input type="number" value={ec.netto ?? ''} onChange={e => updateExtra(ec.id, {netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value), brutto: null})} className={cn(inputCls, 'w-24')} placeholder="Netto" />
                                  <input list="mwst-opts" value={ec.mwst ?? ''} onChange={e => updateExtra(ec.id, {mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value)})} className={cn(inputCls, 'w-16')} placeholder="19" />
                                  <input type="number" value={ec.brutto ?? ''} onChange={e => updateExtra(ec.id, {brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value), netto: null})} disabled={ec.netto != null} className={cn(inputCls, 'w-24 disabled:opacity-50')} placeholder="Brutto" />
                                  <button onClick={() => removeExtra(ec.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><X size={14}/></button>
                               </div>
                            ))}
                         </div>
                       )}
                    </div>
                </div>

                {/* COL 3: Master Summary */}
                <div className={cn("w-full xl:w-[320px] p-6 flex flex-col justify-between shrink-0 border-t xl:border-t-0 xl:border-l", dk ? "bg-[#0F172A]/80 border-white/10" : "bg-slate-50 border-slate-200")}>
                   <div className="flex items-center justify-between gap-2 mb-6">
                      <button onClick={() => patchHotel({depositEnabled: !localHotel.depositEnabled, deposit_enabled: !localHotel.depositEnabled})} className={cn("px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all", localHotel.depositEnabled ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : dk ? "border-white/10 text-slate-500 hover:text-white" : "border-slate-200 text-slate-400")}>Deposit</button>
                      <button onClick={() => patchHotel({isPaid: !localHotel.isPaid, is_paid: !localHotel.isPaid})} className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border", localHotel.isPaid ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40" : "bg-red-500/10 text-red-500 border-red-500/30")}>
                         {localHotel.isPaid ? 'Paid' : 'Unpaid'}
                      </button>
                   </div>

                   <div className="space-y-2 mb-6 font-medium text-sm">
                      <div className="flex justify-between items-center group">
                         <span className={dk ? "text-slate-400" : "text-slate-500"}>Total Netto</span>
                         {editingONetto ? (
                           <input autoFocus type="number" value={localHotel.override_total_netto || ''} onChange={e => patchHotel({override_total_netto: e.target.value === '' ? null : e.target.value})} onBlur={() => setEditingONetto(false)} onKeyDown={e => e.key==='Enter' && setEditingONetto(false)} className={cn("w-24 text-right px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-bold outline-none")} />
                         ) : (
                           <span onClick={() => setEditingONetto(true)} className={cn("cursor-pointer px-1 rounded transition-colors flex items-center gap-1", masterMath.isOverriddenNetto ? "text-yellow-600 bg-yellow-500/10 font-bold" : dk ? "text-slate-300 group-hover:bg-white/10" : "text-slate-700 group-hover:bg-slate-200")}>{formatCurrency(masterMath.displayNetto)} <Edit3 size={10} className="opacity-0 group-hover:opacity-100"/></span>
                         )}
                      </div>
                      
                      {Object.entries(masterMath.buckets).map(([percent, amount]: any) => (
                        <div key={percent} className="flex justify-between items-center">
                           <span className={dk ? "text-slate-500" : "text-slate-400"}>MwSt ({percent}%)</span>
                           <span className={dk ? "text-slate-400" : "text-slate-500"}>{formatCurrency(amount)}</span>
                        </div>
                      ))}

                      {localHotel.depositEnabled && (
                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-300 dark:border-slate-700">
                           <span className="text-amber-500 font-bold">Deposit Paid</span>
                           <input type="number" value={localHotel.depositAmount || ''} onChange={e => patchHotel({depositAmount: e.target.value === '' ? null : normalizeNumberInput(e.target.value), deposit_amount: e.target.value === '' ? null : normalizeNumberInput(e.target.value)})} className="w-20 text-right px-1 py-0.5 rounded bg-transparent border border-amber-500/30 text-amber-500 font-bold outline-none" placeholder="0.00" />
                        </div>
                      )}
                   </div>

                   <div className={cn("pt-4 border-t", dk ? "border-white/10" : "border-slate-200")}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Brutto</p>
                      <div className="flex justify-between items-end group">
                         {editingOBrutto ? (
                           <input autoFocus type="number" value={localHotel.override_total_brutto || ''} onChange={e => patchHotel({override_total_brutto: e.target.value === '' ? null : e.target.value})} onBlur={() => setEditingOBrutto(false)} onKeyDown={e => e.key==='Enter' && setEditingOBrutto(false)} className={cn("w-32 text-right px-2 py-1 rounded bg-yellow-500/20 text-yellow-600 font-black text-3xl outline-none")} />
                         ) : (
                           <span onClick={() => setEditingOBrutto(true)} className={cn("text-3xl font-black cursor-pointer rounded px-1 -ml-1 transition-colors flex items-center gap-2", masterMath.isOverriddenBrutto ? "text-yellow-500 bg-yellow-500/10" : dk ? "text-white group-hover:bg-white/10" : "text-slate-900 group-hover:bg-slate-200")}>{formatCurrency(masterMath.balance)} <Edit3 size={14} className="opacity-0 group-hover:opacity-100"/></span>
                         )}
                      </div>
                      {masterMath.pricePerBed > 0 && (
                         <p className={cn("text-xs font-bold mt-2", dk ? "text-slate-500" : "text-slate-400")}>Price / Bed: {formatCurrency(masterMath.pricePerBed)} / N</p>
                      )}
                   </div>
                </div>
            </div>
            
            {/* DURATION TABS */}
            <div className="pt-2">
              <div className={cn("inline-flex items-center gap-1 p-1.5 rounded-xl shadow-inner border flex-wrap", dk ? "bg-black/40 border-white/5" : "bg-slate-100 border-slate-200")}>
                {(localHotel.durations || []).map((d: any, i: number) => (
                  <button key={d.id || i} onClick={() => setActiveDurationTab(i)} className={cn('px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm', activeDurationTab === i ? (dk ? 'bg-teal-600 text-white border-transparent' : 'bg-white text-teal-700 border-teal-600 border') : (dk ? 'text-slate-400 hover:text-white border border-transparent' : 'text-slate-500 hover:text-slate-800 border border-transparent'))}>
                    {getDurationTabLabel(d, lang)}
                  </button>
                ))}
                <button onClick={async () => {
                  setCreatingDuration(true);
                  const created = await createDuration({ hotelId: localHotel.id });
                  const next = { ...localHotel, durations: [...localHotel.durations, { ...created, roomCards: [] }] };
                  setLocalHotel(next); onUpdate(localHotel.id, next); setActiveDurationTab(next.durations.length - 1);
                  setCreatingDuration(false);
                }} className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-dashed", dk ? "border-white/20 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/40" : "border-slate-300 text-slate-500 hover:bg-slate-200 hover:text-slate-800 hover:border-slate-400")}>
                  {creatingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />} {lang === 'de' ? 'Neu' : 'New'}
                </button>
              </div>
            </div>
            
            {localHotel.durations[activeDurationTab] && (
              <DurationCard duration={localHotel.durations[activeDurationTab]} isDarkMode={dk} lang={lang} 
                onUpdate={(id, upd) => {
                  const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) };
                  setLocalHotel(next); onUpdate(localHotel.id, next);
                }}
                onDelete={(id) => {
                  const next = { ...localHotel, durations: localHotel.durations.filter((d: any) => d.id !== id) };
                  setLocalHotel(next); onUpdate(localHotel.id, next);
                }}
              />
            )}
          </div>
        )}
      </div>

      {confirmDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn('w-full max-w-md rounded-3xl border p-8 shadow-2xl animate-in zoom-in-95', dk ? 'bg-[#1E293B] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200')}>
            <h3 className="text-2xl font-black mb-2">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className="text-sm font-bold text-slate-500 mb-6">{lang === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This action cannot be undone.'}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className={cn("px-6 py-2.5 font-bold rounded-xl border transition-all", dk ? "border-white/10 hover:bg-white/10 text-white" : "border-slate-200 hover:bg-slate-100 text-slate-700")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={async () => { await deleteHotel(localHotel.id); onDelete(localHotel.id); setConfirmDelete(false); }} className="px-6 py-2.5 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-md">{lang === 'de' ? 'Löschen' : 'Delete'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ... [ModernDropdown and CompanyMultiSelect remain exactly the same as before]

// --- MODERN DROPDOWN ---
export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select' }: any) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAddingNew(false); setNewVal(''); } }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const displayValue = (val: string) => {
    if (lang !== 'de') return val;
    const de: any = { 'Germany': 'Deutschland', 'Switzerland': 'Schweiz', 'Austria': 'Österreich', 'Netherlands': 'Niederlande', 'Poland': 'Polen', 'Belgium': 'Belgien', 'France': 'Frankreich', 'Luxembourg': 'Luxemburg' };
    return de[val] || val;
  };

  return (
    <div ref={ref} className="relative w-full h-[38px]">
      <button onClick={() => setOpen(!open)} className={cn('w-full h-full px-3 flex items-center justify-between rounded-lg border text-sm font-bold outline-none transition-all', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white hover:border-teal-500' : 'bg-white border-slate-200 text-slate-900 hover:border-teal-500')}>
        <span className="truncate">{displayValue(value) || placeholder}</span>
        <ChevronDown size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
      </button>
      {open && (
        <div className={cn('absolute top-full mt-1 left-0 right-0 z-[200] rounded-xl border shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {options.map((opt:any) => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={cn('w-full text-left px-4 py-2.5 text-sm font-bold transition-all', value === opt ? (isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700') : (isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'))}>
                {displayValue(opt)}
              </button>
            ))}
          </div>
          <div className={cn('my-1 border-t', isDarkMode ? 'border-white/10' : 'border-slate-100')} />
          {!addingNew ? (
            <button onClick={() => setAddingNew(true)} className={cn('w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 transition-all', isDarkMode ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-teal-50')}><Plus size={16} strokeWidth={3} /> {lang === 'de' ? 'Neu hinzufügen' : 'Add New'}</button>
          ) : (
            <div className="px-3 py-2 flex items-center gap-2 bg-black/10 dark:bg-white/5">
              <input autoComplete="off" autoFocus value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className={cn('flex-1 text-sm font-bold outline-none border-b bg-transparent py-1.5', isDarkMode ? 'border-teal-500 text-white' : 'border-teal-600 text-slate-900')} placeholder={lang === 'de' ? 'Tippen & Enter...' : 'Type & Enter...'} />
              <button onClick={() => { if(newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className="p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-500"><Check size={16} strokeWidth={3} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange, onDeleteOption, onAddOption }: any) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [localMemory, setLocalMemory] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handle(e: any) { 
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); 
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const safeSelected = Array.isArray(selected) ? selected : (typeof selected === 'string' && selected ? [selected] : []);
  
  const combinedOptions = Array.from(new Set([...safeOptions, ...localMemory]));
  
  const filteredOptions = combinedOptions.filter((o: string) => o.toLowerCase().includes(query.toLowerCase()));
  const exactMatchExists = combinedOptions.some((o: string) => o.toLowerCase() === query.trim().toLowerCase());
  const isAlreadySelected = safeSelected.some((o: string) => o.toLowerCase() === query.trim().toLowerCase());
  
  const handleToggle = (opt: string) => {
    onChange(safeSelected.includes(opt) ? safeSelected.filter((t: any) => t !== opt) : [...safeSelected, opt]);
    setQuery('');
  };

  const handleAddNew = async () => {
    const val = query.trim();
    if (val && !isAlreadySelected) {
      setLocalMemory(prev => Array.from(new Set([...prev, val]))); 
      onChange([...safeSelected, val]);
      setQuery('');
      if (onAddOption) {
        await onAddOption(val);
      }
    }
  };
  
  return (
    <div ref={ref} className="relative cursor-pointer min-h-[30px] flex items-center w-full" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
      <div className="flex flex-wrap gap-1.5 w-full">
        {safeSelected.length > 0 ? safeSelected.map((tag: string) => (
          <span key={tag} className={cn('px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 shadow-sm', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800')}>{tag}</span>
        )) : <span className={cn("text-xs font-bold border border-dashed px-3 py-1 rounded-md transition-colors w-full flex items-center", isDarkMode ? "text-slate-500 border-white/20 hover:text-teal-400 hover:border-teal-400" : "text-slate-400 border-slate-300 hover:text-teal-600 hover:border-teal-500")}>+ {lang === 'de' ? 'Firma' : 'Company'}</span>}
      </div>
      
      {open && (
        <div className={cn('absolute top-full mt-2 left-0 z-[200] rounded-xl border shadow-2xl min-w-[240px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')} onClick={e => e.stopPropagation()}>
          <div className={cn("flex items-center px-3 py-2 border-b", isDarkMode ? "border-white/10 bg-[#1E293B]" : "border-slate-100 bg-slate-50")}>
            <Search size={14} className={isDarkMode ? "text-slate-400" : "text-slate-500"} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("ml-2 bg-transparent text-sm font-bold outline-none w-full", isDarkMode ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400")} />
          </div>
          
          <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
            {query.trim() && !exactMatchExists && !isAlreadySelected && (
              <button onClick={handleAddNew} className={cn('w-full text-left px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all', isDarkMode ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-teal-50')}>
                <span className="opacity-70 text-xs">Create</span> "{query.trim()}"
              </button>
            )}
            {filteredOptions.map((opt: string) => {
              const isSelected = safeSelected.includes(opt);
              return (
                <div key={opt} className={cn('w-full flex items-center justify-between group transition-all', isSelected ? (isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50') : (isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'))}>
                  <button onClick={() => handleToggle(opt)} className="flex-1 text-left px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border", isSelected ? "bg-teal-500 border-teal-500" : isDarkMode ? "border-slate-500" : "border-slate-400")}>
                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className={cn(isSelected ? (isDarkMode ? 'text-teal-400' : 'text-teal-700') : (isDarkMode ? 'text-slate-300' : 'text-slate-700'))}>{opt}</span>
                  </button>
                  {onDeleteOption && (
                     <button onClick={(e) => { e.stopPropagation(); onDeleteOption(opt); setLocalMemory(prev => prev.filter(m => m !== opt)); }} className="px-3 py-2 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete from system">
                       <Trash2 size={13} />
                     </button>
                  )}
                </div>
              )
            })}
            {filteredOptions.length === 0 && !query.trim() && (
               <div className="px-4 py-3 text-xs font-bold text-slate-500 text-center">
                 {lang === 'de' ? 'Keine Firmen gefunden' : 'No companies found'}
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HotelRow;
