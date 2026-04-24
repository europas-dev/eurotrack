// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock, StickyNote, ExternalLink, Search, CornerDownRight, Receipt, FileText, Tag, Calculator, Edit3, PlusCircle, Ticket } from 'lucide-react';
import {
  cn, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatDateChip, formatLastUpdated, calculateNights
} from '../lib/utils';
import { createDuration, updateHotel, deleteHotel } from '../lib/supabase';
import { calcRoomCardTotal, calcRoomCardNettoSum } from '../lib/roomCardUtils';
import { enqueue } from '../lib/offlineSync';
import DurationCard from './DurationCard';

export const DEFAULT_COUNTRIES = ['Germany', 'Switzerland', 'Austria', 'Netherlands', 'Poland', 'Belgium', 'France', 'Luxembourg'];
export function getCountryOptions() { return DEFAULT_COUNTRIES; }

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
    <>{parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-teal-400 text-black px-0.5 rounded font-bold">{part}</mark> : part)}</>
  );
};

// --- SEAMLESS AUTOCOMPLETE INPUT ---
function SeamlessInput({ value, options, isDarkMode, onChange, placeholder, className, textClass, searchQuery, disabled }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [showOptions, setShowOptions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(value || ''); }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) { 
      if (ref.current && !ref.current.contains(e.target as Node)) { setEditing(false); setShowOptions(false); if (draft !== value) onChange(draft); } 
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [draft, value, onChange]);

  const filtered = (options || []).filter((o: string) => o.toLowerCase().includes(draft.toLowerCase()) && o.toLowerCase() !== draft.toLowerCase()).slice(0, 5);

  if (!editing || disabled) {
    return (
      <div className={cn("truncate transition-opacity w-full min-h-[20px]", disabled ? "cursor-default" : "cursor-text hover:opacity-70", textClass)} onClick={(e) => { if (disabled) return; e.stopPropagation(); setEditing(true); setDraft(value || ''); setShowOptions(true); }}>
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

// --- MINI DROPDOWN COMPONENT FOR MWST ---
function MwstInput({ value, onChange, isDarkMode, disabled }: { value: string | null, onChange: (v: string | null) => void, isDarkMode: boolean, disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center h-[34px]">
      <input type="number" disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : e.target.value)} className={cn('w-16 px-2 py-1.5 rounded-l-lg text-sm font-bold outline-none border transition-all h-full text-center', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', disabled && "opacity-50 cursor-not-allowed")} placeholder="--" />
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('px-1.5 h-full rounded-r-lg border border-l-0 transition-all flex items-center justify-center', isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100', disabled && "hidden")}><ChevronDown size={14} /></button>
      {open && !disabled && (
        <div className={cn("absolute top-full right-0 mt-1 w-20 z-[999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => (
            <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-2 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', selectedMonth = null, selectedYear = null, companyOptions = [], cityOptions = [], hotelOptions = [], onDelete, onUpdate, onDeleteCompanyOption, onAddOption, viewOnly }: any) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  const initialBaseCosts = entry?.base_costs?.length > 0 
    ? entry.base_costs.map((bc: any) => ({
        ...bc,
        discountType: (bc.discountValue && parseFloat(bc.discountValue) > 0 && bc.discountType === 'percentage') ? 'percentage' : 'fixed'
      }))
    : [{ 
        id: 'default', 
        netto: entry?.base_netto ?? null, 
        mwst: (entry?.base_netto == null && entry?.base_brutto == null) ? null : (entry?.base_mwst ?? null), 
        brutto: entry?.base_brutto ?? null, 
        discountValue: entry?.discount_value ?? null, 
        discountType: (entry?.discount_value && parseFloat(entry?.discount_value) > 0 && entry?.discount_type === 'percentage') ? 'percentage' : 'fixed',
        showDiscount: !!entry?.discount_value 
      }];

  const [showMasterBase, setShowMasterBase] = useState(initialBaseCosts.some((bc:any) => bc.netto != null || bc.brutto != null));
  const [showExtras, setShowExtras] = useState(entry.extra_costs?.length > 0);
  
  const [editingOBrutto, setEditingOBrutto] = useState(false);
  const [editBruttoValue, setEditBruttoValue] = useState('');
  const [editingPriceBed, setEditingPriceBed] = useState(false);
  const [editPriceBedValue, setEditPriceBedValue] = useState('');

  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]').includes(entry.id); } catch { return false; }
  });

  const [localHotel, setLocalHotel] = useState({
    ...entry,
    contactPerson: entry?.contactperson || entry?.contactPerson || '',
    website: entry?.weblink || entry?.website || '',
    companyTag: Array.isArray(entry?.companyTag) ? entry.companyTag : (entry?.companyTag ? [entry.companyTag] : []),
    durations: entry?.durations ?? [],
    extraCosts: entry?.extra_costs ?? [],
    baseCosts: initialBaseCosts,
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

  // --- THE MASTER ACCOUNTING ENGINE & MWST BUCKETER ---
  const masterMath = useMemo(() => {
    let tFree = 0; let tBeds = 0; const allEmps: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    let sumDurationNetto = 0;
    let sumDurationBrutto = 0;
    let totalNightsAllRooms = 0;
    
    let buckets: Record<string, number> = {};
    let minPricePerBed: number | null = null;

    (localHotel.durations || []).forEach((d: any) => {
      const nights = calculateNights(d.startDate, d.endDate);
      
      (d.roomCards || []).forEach((c: any) => {
         const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
         tBeds += b;
         totalNightsAllRooms += (b * nights);
         allEmps.push(...(c.employees || []));

         const cardNetto = calcRoomCardNettoSum(c, d.startDate, d.endDate);
         const cardBrutto = calcRoomCardTotal(c, d.startDate, d.endDate);
         
         sumDurationNetto += cardNetto;
         sumDurationBrutto += cardBrutto;

         if (b > 0 && nights > 0 && cardNetto > 0) {
             const pricePerNight = cardNetto / (b * nights);
             if (minPricePerBed === null || pricePerNight < minPricePerBed) {
                 minPricePerBed = pricePerNight;
             }
         }

         let activeMwst: number | null = null;
         if (c.pricingTab === 'per_room') {
            if (c.roomMwst != null && c.roomMwst !== '') activeMwst = parseFloat(c.roomMwst);
         } else {
            if (c.bedMwst != null && c.bedMwst !== '') activeMwst = parseFloat(c.bedMwst);
         }

         if (activeMwst !== null && !isNaN(activeMwst)) {
             buckets[activeMwst] = (buckets[activeMwst] || 0) + (cardBrutto - cardNetto);
         }
      });

      tFree += calcDurationFreeBeds(d, today);
    });

    let bNettoTotal = 0; let bBruttoTotal = 0;
    let isMasterActive = (localHotel.baseCosts || []).some((bc: any) => bc.netto != null || bc.brutto != null);

    if (isMasterActive) {
        buckets = {};
    }

    const baseCostsWithDisplay = (localHotel.baseCosts || []).map((bc: any) => {
        let bNetto = 0; let bBrutto = 0;
        let bMwSt = bc.mwst != null ? parseFloat(bc.mwst) : null;
        let isMwstValid = bMwSt !== null && !isNaN(bMwSt);
        let bNettoDisplay = ''; let bBruttoDisplay = '';
        let discountedNetto = 0;

        if (bc.netto != null) {
            bNetto = parseFloat(bc.netto);
            bNettoDisplay = bc.netto.toString();
            discountedNetto = bNetto;
            if (bc.discountValue) {
                const dVal = parseFloat(bc.discountValue);
                discountedNetto = bc.discountType === 'fixed' ? Math.max(0, bNetto - dVal) : Math.max(0, bNetto * (1 - dVal/100));
            }
            if (isMwstValid) {
                bBrutto = discountedNetto * (1 + bMwSt/100);
                bBruttoDisplay = bBrutto.toFixed(2);
            }
        } else if (bc.brutto != null) {
            bBrutto = parseFloat(bc.brutto);
            bBruttoDisplay = bc.brutto.toString();
            if (isMwstValid) {
                let dNetto = bBrutto / (1 + bMwSt/100);
                discountedNetto = dNetto;
                if (bc.discountValue) {
                    const dVal = parseFloat(bc.discountValue);
                    bNetto = bc.discountType === 'fixed' ? dNetto + dVal : (dVal === 100 ? 0 : dNetto / (1 - dVal/100));
                } else {
                    bNetto = dNetto;
                }
                bNettoDisplay = bNetto.toFixed(2);
            }
        }

        bNettoTotal += discountedNetto > 0 ? discountedNetto : bNetto;
        bBruttoTotal += bBrutto;

        if (isMwstValid && (bc.netto != null || bc.brutto != null)) {
            buckets[bMwSt!] = (buckets[bMwSt!] || 0) + ((discountedNetto > 0 ? discountedNetto : bNetto) * (bMwSt! / 100));
        }

        return { ...bc, bNettoDisplay, bBruttoDisplay, discountedNetto };
    });

    let extraNettoTotal = 0; let extraBruttoTotal = 0;
    const extrasWithDisplay = (localHotel.extraCosts || []).map((ec: any) => {
       let eNetto = 0; let eBrutto = 0;
       let eMwst = ec.mwst != null ? parseFloat(ec.mwst) : null;
       let eMwstValid = eMwst !== null && !isNaN(eMwst);
       let eNettoDisplay = ''; let eBruttoDisplay = '';

       if (ec.netto != null) {
         eNetto = parseFloat(ec.netto);
         eNettoDisplay = ec.netto.toString();
         if (eMwstValid) { eBrutto = eNetto * (1 + eMwst!/100); eBruttoDisplay = eBrutto.toFixed(2); }
       } else if (ec.brutto != null) {
         eBrutto = parseFloat(ec.brutto);
         eBruttoDisplay = ec.brutto.toString();
         if (eMwstValid) { eNetto = eBrutto / (1 + eMwst!/100); eNettoDisplay = eNetto.toFixed(2); }
       }
       extraNettoTotal += eNetto;
       extraBruttoTotal += eBrutto;
       if (eMwstValid && eNetto > 0) buckets[eMwst!] = (buckets[eMwst!] || 0) + (eNetto * (eMwst! / 100));
       return { ...ec, eNettoDisplay, eBruttoDisplay };
    });

    let preGlobalNetto = (isMasterActive ? bNettoTotal : sumDurationNetto) + extraNettoTotal;
    let preGlobalBrutto = (isMasterActive ? bBruttoTotal : sumDurationBrutto) + extraBruttoTotal;
    
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
          finalBrutto = finalNetto;
          Object.keys(buckets).forEach(k => {
             buckets[k] = buckets[k] * (1 - ratio);
             finalBrutto += buckets[k];
          });
       } else {
          finalBrutto = Math.max(0, preGlobalBrutto - (isFixed ? gVal : preGlobalBrutto * (gVal/100)));
       }
    }

    const displayBrutto = localHotel.override_total_brutto != null ? parseFloat(localHotel.override_total_brutto) : finalBrutto;
    
    let pricePerBed = 0;
    if (localHotel.override_price_per_bed != null) {
       pricePerBed = parseFloat(localHotel.override_price_per_bed);
    } else if (!isMasterActive && minPricePerBed !== null) {
       pricePerBed = minPricePerBed;
    }

    return { 
      freeBeds: tFree, 
      totalBeds: tBeds, 
      employees: allEmps, 
      displayNetto: finalNetto, 
      displayBrutto, 
      buckets, 
      pricePerBed, 
      baseCostsWithDisplay, 
      extrasWithDisplay, 
      isMasterActive, 
      isOverriddenBrutto: localHotel.override_total_brutto != null, 
      isOverriddenBed: localHotel.override_price_per_bed != null 
    };
  }, [localHotel]);

  const visibleEmps = masterMath.employees.slice(0, 6);
  const hiddenEmpsCount = masterMath.employees.length > 6 ? masterMath.employees.length - 6 : 0;

  function patchHotel(changes: any) {
    if (viewOnly) return; // FIX: Lock save function for viewer
    const next = { ...localHotel, ...changes };
    setLocalHotel(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        const dbPayload: any = {};
        if ('name' in next) dbPayload.name = next.name;
        if ('city' in next) dbPayload.city = next.city;
        if ('companyTag' in next) dbPayload.company_tag = next.companyTag;
        if ('address' in next) dbPayload.address = next.address;
        if ('contactPerson' in next) dbPayload.contactperson = next.contactPerson;
        if ('phone' in next) dbPayload.phone = next.phone;
        if ('email' in next) dbPayload.email = next.email;
        if ('website' in next) dbPayload.weblink = next.website;
        if ('country' in next) dbPayload.country = next.country;
        if ('notes' in next) dbPayload.notes = next.notes;
        
        if ('rechnungNr' in next) dbPayload.rechnung_nr = next.rechnungNr;
        if ('bookingId' in next) dbPayload.booking_id = next.bookingId;
        if ('isPaid' in next) dbPayload.is_paid = next.isPaid;
        
        if ('depositEnabled' in next) dbPayload.deposit_enabled = next.depositEnabled;
        if ('depositAmount' in next) dbPayload.deposit_amount = next.depositAmount;
        
        if ('has_global_discount' in next) dbPayload.has_global_discount = next.has_global_discount;
        if ('global_discount_value' in next) dbPayload.global_discount_value = next.global_discount_value;
        if ('global_discount_type' in next) dbPayload.global_discount_type = next.global_discount_type;
        if ('global_discount_target' in next) dbPayload.global_discount_target = next.global_discount_target;
        
        if ('baseCosts' in next) dbPayload.base_costs = next.baseCosts;
        if ('extraCosts' in next) dbPayload.extra_costs = next.extraCosts;
        
        if ('override_total_brutto' in next) dbPayload.override_total_brutto = next.override_total_brutto;
        if ('override_price_per_bed' in next) dbPayload.override_price_per_bed = next.override_price_per_bed;

        await updateHotel(localHotel.id, dbPayload);
        onUpdate(localHotel.id, next);
      } catch (e: any) { console.error(`Error saving: ${e.message}`); }
      finally { setSaving(false); }
    }, 400);
  }

  const addBaseCost = () => {
    const next = [...localHotel.baseCosts, { id: Math.random().toString(), netto: null, mwst: null, brutto: null, discountValue: null, discountType: 'fixed', showDiscount: false }];
    patchHotel({ baseCosts: next });
  };
  const updateBaseCost = (id: string, updates: any) => {
    const next = localHotel.baseCosts.map((bc: any) => bc.id === id ? { ...bc, ...updates } : bc);
    patchHotel({ baseCosts: next });
  };
  const removeBaseCost = (id: string) => {
    let next = localHotel.baseCosts.filter((bc: any) => bc.id !== id);
    if (next.length === 0) next = [{ id: Math.random().toString(), netto: null, mwst: null, brutto: null, discountValue: null, discountType: 'fixed', showDiscount: false }];
    patchHotel({ baseCosts: next });
  };

  const toggleExtras = () => {
     if (showExtras) {
        setShowExtras(false);
     } else {
        setShowExtras(true);
        if (localHotel.extraCosts.length === 0) {
           patchHotel({ extraCosts: [{ id: Math.random().toString(), note: '', netto: null, mwst: null, brutto: null }] });
        }
     }
  };

  const addExtra = () => {
    patchHotel({ extraCosts: [...localHotel.extraCosts, { id: Math.random().toString(), note: '', netto: null, mwst: null, brutto: null }] });
  };
  const updateExtra = (id: string, updates: any) => {
    const next = localHotel.extraCosts.map((e:any) => e.id === id ? { ...e, ...updates } : e);
    patchHotel({ extraCosts: next });
  };
  const removeExtra = (id: string) => {
    const next = localHotel.extraCosts.filter((e:any) => e.id !== id);
    patchHotel({ extraCosts: next });
    if (next.length === 0) setShowExtras(false);
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
  
  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500', dk && 'text-slate-400');
  const inputCls = cn('w-full px-2 py-1.5 rounded-lg text-sm font-bold outline-none border transition-all h-[34px]', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400', viewOnly && "opacity-60 cursor-default");

  const targetOptions = lang === 'de' ? ['Gesamt Netto', 'Gesamt Brutto'] : ['Total Netto', 'Total Brutto'];
  const currentTarget = localHotel.global_discount_target === 'brutto' ? targetOptions[1] : targetOptions[0];

  return (
    <div className="space-y-1 relative" style={{ zIndex: 40 - (index % 30) }}>
      <div className={cn('rounded-2xl border transition-all duration-200 shadow-sm relative', dk ? 'bg-[#1E293B] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300')}>
        
        {/* MAIN ROW */}
        <div className={cn('flex flex-wrap md:flex-nowrap items-center gap-0 cursor-pointer p-2', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', open && 'border-b', open && (dk ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'))} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          <div className="flex-[2] py-2 min-w-[200px] pr-2">
            <SeamlessInput disabled={viewOnly} value={localHotel.name} options={hotelOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ name: val })} placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel Name...'} textClass={cn('text-[15px] font-black leading-tight', dk ? 'text-white' : 'text-slate-900')} searchQuery={searchQuery} />
            <SeamlessInput disabled={viewOnly} value={localHotel.city} options={cityOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ city: val })} placeholder={lang === 'de' ? 'Stadt...' : 'City...'} className="mt-0.5" textClass={cn("text-[10px] font-bold uppercase tracking-widest gap-1.5", dk ? "text-slate-500" : "text-slate-400")} searchQuery={searchQuery} />
          </div>

          <div className="flex-[0.8] px-2 min-w-[120px]" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect disabled={viewOnly} selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={(tags:any) => patchHotel({ companyTag: tags })} onDeleteOption={onDeleteCompanyOption} onAddOption={onAddOption} />
          </div>

          <div className="flex-[1.5] px-2 min-w-[120px]">
            <div className="flex flex-wrap gap-1.5">
              {localHotel.durations.map((d: any, i: number) => {
                const typeCount: any = {};
                (d.roomCards || []).forEach((c:any) => { typeCount[c.roomType] = (typeCount[c.roomType] || 0) + 1 });
                const roomStr = Object.entries(typeCount).map(([rt, count]) => `${count} ${rt}`).join(', ');
                const n = calculateNights(d.startDate, d.endDate);
                const title = `${n} N, ${(d.roomCards || []).length} Rooms ${roomStr ? `(${roomStr})` : ''}`;
                
                return (
                  <button key={d.id} title={title} onClick={(e) => { e.stopPropagation(); setOpen(true); setActiveDurationTab(i); }} className={cn('px-2.5 py-1 rounded-md text-xs font-bold border truncate text-center transition-all shadow-sm hover:ring-2 ring-teal-500/30', dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')}>
                    {d.startDate && d.endDate ? `${formatShortDate(d.startDate, lang)} - ${formatShortDate(d.endDate, lang)}` : 'New'}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-[2.5] px-2">
            <div className="flex flex-wrap gap-1.5">
              {visibleEmps.map((emp: any, i: number) => {
                const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                
                // NEW: Find the duration this employee belongs to so we can check for partial stays
                const parentDuration = localHotel.durations.find((d: any) => d.id === emp.duration_id || d.id === emp.durationId);
                const isPartial = parentDuration && (emp.checkIn > parentDuration.startDate || emp.checkOut < parentDuration.endDate);
                
                // NEW: Check if this employee is a replacement (Substitute)
                // In the main row list, we check if they have a 'slot_index' shared with another emp in the same duration
                const isSubstitute = masterMath.employees.some((other: any) => 
                  other.id !== emp.id && 
                  other.slot_index === emp.slot_index && 
                  other.duration_id === emp.duration_id &&
                  (other.checkIn < emp.checkIn) // The one who came first is the original
                );

                const borderCls = status === 'active' ? "border-emerald-500/50" : status === 'upcoming' ? "border-blue-500/50" : status === 'ending-soon' ? "border-red-500/50" : "border-slate-500/40";
                const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                const textColor = status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400';
                
                const n = calculateNights(emp.checkIn||'', emp.checkOut||'');
                const tooltip = `${n}N (${formatShortDate(emp.checkIn, lang)} ➔ ${formatShortDate(emp.checkOut, lang)})`;

                return (
                <button 
                  key={emp.id || i} 
                  title={tooltip} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    // 1. Open the hotel row if it's closed
                    setOpen(true); 
                    
                    // 2. Find and set the correct duration tab
                    const durationIdx = localHotel.durations.findIndex((d: any) => d.id === emp.duration_id || d.id === emp.durationId);
                    if (durationIdx !== -1) setActiveDurationTab(durationIdx);
                
                    // 3. Scroll to the specific employee slot
                    setTimeout(() => {
                      const element = document.getElementById(`emp-slot-${emp.id}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Optional: Add a brief "flash" effect so the user sees which one it is
                        element.classList.add('ring-2', 'ring-teal-500');
                        setTimeout(() => element.classList.remove('ring-2', 'ring-teal-500'), 2000);
                      }
                    }, 100); 
                  }} 
                  className={cn(
                    "px-2.5 py-0.5 rounded-full border-2 text-xs font-bold truncate text-center shadow-sm flex items-center justify-center gap-1.5 transition-all hover:opacity-80", 
                    borderCls, 
                    isPartial ? "border-dashed" : "border-solid",
                    dk ? "bg-[#1E293B] text-slate-200" : "bg-slate-50 text-slate-700"
                  )}
                >
                  {isSubstitute ? (
                    <CornerDownRight size={12} className={textColor} />
                  ) : (
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                  )}
                  <HighlightText text={emp.name || '_ _ _'} query={searchQuery} />
               </button>
                );
              })}
              {hiddenEmpsCount > 0 && <div className="px-2 py-0.5 rounded-full border border-dashed border-slate-400 text-[11px] font-bold text-center flex items-center justify-center">+{hiddenEmpsCount}</div>}
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
               <button onClick={handleBookmarkToggle} className={cn("p-1.5 rounded-lg transition-all", isBookmarked ? "text-yellow-500 hover:text-yellow-400 bg-yellow-500/10" : "text-slate-400 hover:text-yellow-500 hover:bg-white/5")}>
                 <Star size={16} className={isBookmarked ? "fill-yellow-500" : ""} />
               </button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"><Clock size={16} /></button>
                  <div className="absolute right-0 bottom-full mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 z-[100] whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
                    {formatLastUpdated(localHotel.last_updated_by || localHotel.lastUpdatedBy, localHotel.last_updated_at || localHotel.lastUpdatedAt, lang)}
                  </div>
               </div>
               {!viewOnly && (
                 <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
               )}
            </div>
          </div>
        </div>

        {/* EXPANDED BREAKDOWN */}
        {open && (
          <div className={cn('p-6 space-y-6 rounded-b-2xl border-t', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50 border-slate-200')} onClick={e => e.stopPropagation()}>
            
            {/* CONTACT ROW */}
            <div className="flex flex-wrap xl:flex-nowrap gap-4 items-end">
              <div className="flex-[2] min-w-[180px] flex items-end gap-2">
                 <div className="shrink-0"><label className={cn(labelCls, 'mb-1.5')}><StickyNote size={12}/> {lang === 'de' ? 'Notiz' : 'Note'}</label><button onClick={() => setShowNotes(!showNotes)} className={cn("w-[34px] h-[34px] rounded-lg border flex items-center justify-center transition-all", localHotel.notes ? "bg-teal-500/10 border-teal-500/30 text-teal-500" : dk ? "bg-[#1E293B] text-slate-400 hover:text-white hover:bg-white/5" : "bg-white border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50")}><StickyNote size={16} /></button></div>
                 <div className="flex-1"><label className={cn(labelCls, 'mb-1.5')}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label><input disabled={viewOnly} autoComplete="off" value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} className={inputCls} placeholder="..." /></div>
              </div>
              <div className="flex-[1.5] min-w-[120px]"><label className={cn(labelCls, 'mb-1.5')}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact'}</label><input disabled={viewOnly} autoComplete="off" value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} className={inputCls} placeholder="..." /></div>
              <div className="flex-[1.5] min-w-[120px]"><label className={cn(labelCls, 'mb-1.5')}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label><div className={cn('flex items-center rounded-lg border overflow-hidden h-[34px]', dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}><span className={cn("px-2.5 text-xs font-bold border-r h-full flex items-center shrink-0", dk ? "bg-black/40 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500")}>{getCountryCode(localHotel.country || 'Germany')}</span><input disabled={viewOnly} autoComplete="off" value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} className={cn('w-full px-2 py-1.5 text-sm font-bold outline-none bg-transparent h-full', dk ? 'text-white' : 'text-slate-900')} placeholder="..." /></div></div>
              <div className="flex-[1.5] min-w-[140px]"><label className={cn(labelCls, 'mb-1.5')}><Mail size={12}/> Email</label><div className="relative flex items-center h-[34px]"><input disabled={viewOnly} autoComplete="off" value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} className={cn(inputCls, 'pr-8')} placeholder="..." />{localHotel.email && <a href={`mailto:${localHotel.email}`} className="absolute right-1 p-1 bg-teal-600 text-white rounded hover:bg-teal-500"><Mail size={12} /></a>}</div></div>
              <div className="flex-[1.5] min-w-[140px]"><label className={cn(labelCls, 'mb-1.5')}><Globe size={12}/> {lang === 'de' ? 'Webseite' : 'Website'}</label><div className="relative flex items-center h-[34px]"><input disabled={viewOnly} autoComplete="off" value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} onKeyDown={handleEnterBlur} className={cn(inputCls, 'pr-8')} placeholder="..." />{localHotel.website && <a href={localHotel.website.startsWith('http') ? localHotel.website : `https://${localHotel.website}`} target="_blank" rel="noreferrer" className="absolute right-1 p-1 bg-teal-600 text-white rounded hover:bg-teal-500"><ExternalLink size={12} /></a>}</div></div>
              <div className="flex-[1] min-w-[100px]"><label className={cn(labelCls, 'mb-1.5')}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label><ModernDropdown disabled={viewOnly} value={localHotel.country || 'Germany'} options={getCountryOptions()} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} /></div>
            </div>

            {showNotes && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea disabled={viewOnly} autoComplete="off" autoFocus value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} className={cn(inputCls, 'min-h-[60px] h-auto resize-y p-3')} placeholder={lang === 'de' ? "Private Notizen hier eintragen..." : "Write private notes here..."} />
              </div>
            )}

            {/* MASTER INVOICE CARD */}
            <div className={cn("rounded-2xl border flex flex-col xl:flex-row shadow-md", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}>
                
                {/* COL 1: Identity */}
                <div className={cn("w-full xl:w-[240px] shrink-0 p-5 flex flex-col gap-4 border-b xl:border-b-0 xl:border-r rounded-tl-2xl", dk ? "border-white/10 bg-[#0F172A]/50" : "border-slate-200 bg-slate-50/50")}>
                    <div>
                       <label className={cn(labelCls, 'mb-1.5')}><Receipt size={12}/> {lang === 'de' ? 'Rechnungsnr.' : 'Invoice No.'}</label>
                       <input disabled={viewOnly} value={localHotel.rechnungNr || ''} onChange={e => patchHotel({ rechnungNr: e.target.value })} className={inputCls} placeholder="RE-2026-..." />
                    </div>
                    <div>
                       <label className={cn(labelCls, 'mb-1.5')}><FileText size={12}/> {lang === 'de' ? 'Buchungsref.' : 'Booking Ref'}</label>
                       <input disabled={viewOnly} value={localHotel.bookingId || ''} onChange={e => patchHotel({ bookingId: e.target.value })} className={inputCls} placeholder="..." />
                    </div>
                </div>

                {/* COL 2: Action Center */}
                <div className="flex-1 p-5 flex flex-col gap-5 min-w-[320px]">
                   <div className="flex items-center gap-2 flex-wrap">
                      {!viewOnly && <button onClick={() => setShowMasterBase(!showMasterBase)} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5", showMasterBase ? (dk ? "bg-teal-600 text-white border-teal-500" : "bg-teal-600 text-white border-teal-700") : (dk ? "bg-[#1E293B] text-slate-400 border-white/10 hover:text-white" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"))}><Calculator size={12}/> Brutto / Netto</button>}
                      {!viewOnly && <button onClick={() => patchHotel({has_global_discount: !localHotel.has_global_discount})} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5", localHotel.has_global_discount ? (dk ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-indigo-50 text-indigo-600 border-indigo-200") : (dk ? "bg-[#1E293B] text-slate-400 border-white/10 hover:text-white" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"))}><Tag size={12} /> {lang === 'de' ? 'Gesamtrabatt' : 'Global Disc'}</button>}
                      {!viewOnly && <button onClick={toggleExtras} className={cn("px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5", showExtras ? (dk ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-50 text-amber-600 border-amber-200") : (dk ? "bg-[#1E293B] text-slate-400 border-white/10 hover:text-white" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"))}><PlusCircle size={12} /> {lang === 'de' ? 'Extra' : 'Extra'}</button>}
                   </div>

                   <div className="flex flex-col gap-3">
                      {showMasterBase && (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                           {masterMath.baseCostsWithDisplay.map((bc: any, index: number) => (
                              <div key={bc.id} style={{ zIndex: 60 - index, position: 'relative' }} className={cn("flex flex-col md:flex-row md:items-start justify-between gap-4 p-3 rounded-xl border", dk ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
                                 <div className="flex items-center gap-2 shrink-0 mt-1">
                                    {!viewOnly && <button onClick={addBaseCost} className={cn("p-1.5 h-[34px] rounded-lg transition-all flex items-center justify-center shrink-0 border", dk ? "bg-[#1E293B] border-white/10 text-teal-400 hover:bg-white/10" : "bg-white border-slate-200 text-teal-600 hover:bg-slate-100")}><Plus size={16}/></button>}
                                    <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{lang === 'de' ? 'Grundkosten' : 'Base Cost'} {index > 0 ? `#${index + 1}` : ''}</span>
                                 </div>
                                 
                                 <div className="flex-1 flex flex-wrap xl:flex-nowrap items-start gap-2 justify-end w-full pt-1">
                                    <div className="flex flex-col gap-1">
                                       <div className="flex items-center gap-1.5">
                                          <span className={labelCls}>Netto</span>
                                          <input disabled={viewOnly} type="number" value={bc.netto != null ? bc.netto : bc.bNettoDisplay} onChange={e => updateBaseCost(bc.id, {netto: e.target.value === '' ? null : e.target.value, brutto: null})} className={cn(inputCls, 'w-full max-w-[120px] min-w-[80px]', bc.brutto != null && "opacity-50 pointer-events-none")} placeholder="Auto" />
                                          
                                          {!(bc.showDiscount || Boolean(bc.discountValue)) && (!viewOnly) ? (
                                             <button onClick={() => updateBaseCost(bc.id, {showDiscount: true})} title="Rabatt hinzufügen" className={cn("p-1.5 rounded-lg border transition-all flex items-center justify-center shrink-0", dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-teal-400" : "bg-white border-slate-200 text-slate-400 hover:text-teal-500 hover:bg-slate-50")}>
                                               <Ticket size={14} />
                                             </button>
                                          ) : null}
                                       </div>
                                       
                                       {(bc.showDiscount || Boolean(bc.discountValue)) && parseFloat(bc.discountValue) > 0 ? (
                                          <div className="text-[12px] font-black text-teal-600 dark:text-teal-400 text-right">↳ {formatCurrency(bc.discountedNetto)}</div>
                                       ) : null}
                                    </div>
                                    
                                    {(bc.showDiscount || Boolean(bc.discountValue)) ? (
                                      <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in zoom-in-95 duration-200">
                                        <span className={labelCls}>{lang === 'de' ? 'Rabatt' : 'Discount'}</span>
                                        <div className="relative flex items-center h-[34px] w-[90px]">
                                          <input disabled={viewOnly} type="number" value={bc.discountValue || ''} onChange={e => updateBaseCost(bc.id, {discountValue: e.target.value === '' ? null : e.target.value})} className={cn(inputCls, 'w-full pr-7 h-full')} placeholder="0" />
                                          <button disabled={viewOnly} onClick={() => updateBaseCost(bc.id, {discountType: bc.discountType === 'percentage' ? 'fixed' : 'percentage'})} className={cn("absolute right-1 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all", dk ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700")}>{bc.discountType === 'percentage' ? '%' : '€'}</button>
                                        </div>
                                        {!viewOnly && <button onClick={() => updateBaseCost(bc.id, {showDiscount: false, discountValue: null})} className="text-slate-400 hover:text-red-500 transition-colors"><X size={14} /></button>}
                                      </div>
                                    ) : null}
                                    
                                    <div className="flex items-center gap-1.5 shrink-0"><span className={labelCls}>MwSt</span><MwstInput disabled={viewOnly} value={bc.mwst} onChange={(v:any) => updateBaseCost(bc.id, {mwst: v})} isDarkMode={dk} /></div>
                                    
                                    <div className="flex items-center gap-1.5">
                                       <span className={labelCls}>Brutto</span>
                                       <input disabled={viewOnly} type="number" value={bc.brutto != null ? bc.brutto : bc.bBruttoDisplay} onChange={e => updateBaseCost(bc.id, {brutto: e.target.value === '' ? null : e.target.value, netto: null})} className={cn(inputCls, 'w-full max-w-[120px] min-w-[80px]', bc.netto != null && "opacity-50 pointer-events-none")} placeholder="Auto" />
                                    </div>

                                    {!viewOnly && localHotel.baseCosts.length > 1 ? (
                                       <button onClick={() => removeBaseCost(bc.id)} className={cn("p-1.5 h-[34px] rounded-lg transition-all flex items-center justify-center shrink-0 border ml-1", dk ? "bg-[#1E293B] border-white/10 text-red-400 hover:bg-white/10" : "bg-white border-slate-200 text-red-500 hover:bg-slate-100")}><X size={16}/></button>
                                    ) : null}
                                 </div>
                              </div>
                           ))}
                        </div>
                      )}

                      {localHotel.has_global_discount ? (
                        <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 rounded-xl border animate-in fade-in slide-in-from-top-2", dk ? "bg-indigo-500/5 border-indigo-500/20" : "bg-indigo-50/50 border-indigo-200")}>
                           <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{lang === 'de' ? 'Gesamtrabatt' : 'Global Discount'}</span>
                           <div className="flex items-center gap-3 flex-wrap justify-end">
                              <div className="flex items-center gap-1.5"><span className={labelCls}>{lang === 'de' ? 'Wert' : 'Value'}</span>
                                <div className="relative flex items-center h-[34px] w-[100px]">
                                  <input disabled={viewOnly} type="number" value={localHotel.global_discount_value || ''} onChange={e => patchHotel({global_discount_value: e.target.value === '' ? null : e.target.value})} className={cn(inputCls, 'w-full pr-7 h-full')} placeholder="0" />
                                  <button disabled={viewOnly} onClick={() => patchHotel({global_discount_type: localHotel.global_discount_type === 'percentage' ? 'fixed' : 'percentage'})} className={cn("absolute right-1 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all", dk ? "bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400" : "bg-indigo-100 hover:bg-indigo-200 text-indigo-700")}>{localHotel.global_discount_type === 'percentage' ? '%' : '€'}</button>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5"><span className={labelCls}>{lang === 'de' ? 'Ziel' : 'Target'}</span>
                                 <div className="w-[140px]">
                                    <ModernDropdown disabled={viewOnly} value={currentTarget} options={targetOptions} allowAdd={false} onChange={(v: string) => patchHotel({global_discount_target: v.includes('Brutto') || v.includes('brutto') ? 'brutto' : 'netto'})} isDarkMode={dk} lang={lang} />
                                 </div>
                              </div>
                           </div>
                        </div>
                      ) : null}

                      {showExtras ? (
                        <div className={cn("flex flex-col md:flex-row md:items-start justify-between gap-4 p-3 rounded-xl border animate-in fade-in slide-in-from-top-2", dk ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200")}>
                           <span className="text-sm font-bold text-amber-500 shrink-0 mt-2">{lang === 'de' ? 'Extra' : 'Extra'}</span>
                           <div className="flex-1 flex flex-col gap-2 items-end w-full">
                               {masterMath.extrasWithDisplay.map((ec:any, index: number) => (
                                  <div key={ec.id} style={{ zIndex: 40 - index, position: 'relative' }} className="flex flex-nowrap items-center gap-2 w-full justify-end">
                                     {!viewOnly && <button onClick={addExtra} className={cn("p-1.5 h-[34px] rounded-lg transition-all flex items-center justify-center shrink-0 border", dk ? "bg-[#1E293B] border-white/10 text-teal-400 hover:bg-white/10" : "bg-white border-slate-200 text-teal-600 hover:bg-slate-100")}><Plus size={16}/></button>}
                                     <input disabled={viewOnly} value={ec.note} onChange={e => updateExtra(ec.id, {note: e.target.value})} className={cn(inputCls, 'flex-1 min-w-[140px]')} placeholder={lang === 'de' ? "Notiz..." : "Note..."} />
                                     
                                     <div className="flex items-center gap-1.5"><span className={labelCls}>Netto</span><input disabled={viewOnly} type="number" value={ec.netto != null ? ec.netto : ec.eNettoDisplay} onChange={e => updateExtra(ec.id, {netto: e.target.value === '' ? null : e.target.value, brutto: null})} className={cn(inputCls, 'w-full max-w-[100px] min-w-[70px]', ec.brutto != null && "opacity-50 pointer-events-none")} placeholder="Auto" /></div>
                                     <div className="flex items-center gap-1.5 shrink-0"><span className={labelCls}>MwSt</span><MwstInput disabled={viewOnly} value={ec.mwst} onChange={(v:any) => updateExtra(ec.id, {mwst: v})} isDarkMode={dk} /></div>
                                     <div className="flex items-center gap-1.5"><span className={labelCls}>Brutto</span><input disabled={viewOnly} type="number" value={ec.brutto != null ? ec.brutto : ec.eBruttoDisplay} onChange={e => updateExtra(ec.id, {brutto: e.target.value === '' ? null : e.target.value, netto: null})} className={cn(inputCls, 'w-full max-w-[100px] min-w-[70px]', ec.netto != null && "opacity-50 pointer-events-none")} placeholder="Auto" /></div>
                                     {!viewOnly && <button onClick={() => removeExtra(ec.id)} className={cn("p-1.5 h-[34px] rounded-lg transition-all flex items-center justify-center shrink-0 border", dk ? "bg-[#1E293B] border-white/10 text-red-400 hover:bg-white/10" : "bg-white border-slate-200 text-red-500 hover:bg-slate-100")}><X size={16}/></button>}
                                  </div>
                               ))}
                           </div>
                        </div>
                      ) : null}
                   </div>
                </div>

                {/* COL 3: Master Summary (FIXED ALIGNMENT) */}
                <div className={cn("w-full xl:w-[380px] p-5 flex flex-col shrink-0 border-t xl:border-t-0 xl:border-l rounded-tr-2xl rounded-br-2xl rounded-bl-2xl xl:rounded-bl-none", dk ? "bg-[#0F172A]/80 border-white/10" : "bg-slate-50 border-slate-200")}>
                   <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-1.5 flex-1 max-w-[160px]">
                         <button disabled={viewOnly} onClick={() => patchHotel({depositEnabled: !localHotel.depositEnabled})} className={cn("px-3 py-1.5 text-[11px] font-black uppercase rounded-lg border transition-all h-[34px]", localHotel.depositEnabled ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : dk ? "border-white/10 text-slate-500 hover:text-white" : "border-slate-200 text-slate-400")}>{lang === 'de' ? 'Kaution' : 'Deposit'}</button>
                         {localHotel.depositEnabled ? (
                            <input disabled={viewOnly} type="number" value={localHotel.depositAmount || ''} onChange={e => patchHotel({depositAmount: e.target.value === '' ? null : e.target.value})} className={cn(inputCls, 'w-[100px] h-[34px] px-2 text-xs text-amber-500 border-amber-500/30')} placeholder="0.00" />
                         ) : null}
                      </div>
                      <button disabled={viewOnly} onClick={() => patchHotel({isPaid: !localHotel.isPaid})} className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all border h-[34px]", localHotel.isPaid ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40" : "bg-red-500/10 text-red-500 border-red-500/30")}>
                         {localHotel.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Unpaid')}
                      </button>
                   </div>

                   <div className="space-y-1.5 mb-4 font-medium text-[14px]">
                      <div className="flex justify-between items-center">
                         <span className={dk ? "text-slate-400" : "text-slate-500"}>{lang === 'de' ? 'Gesamt Netto' : 'Total Netto'}</span>
                         <span className={cn("font-bold", dk ? "text-white" : "text-slate-900")}>{formatCurrency(masterMath.displayNetto)}</span>
                      </div>
                      
                      {Object.keys(masterMath.buckets).length > 0 ? (
                        Object.entries(masterMath.buckets).map(([percent, amount]: any) => (
                          <div key={percent} className="flex justify-between items-center text-[13px]">
                             <span className={dk ? "text-slate-500" : "text-slate-400"}>MwSt ({percent}%)</span>
                             <span className={dk ? "text-slate-400" : "text-slate-500"}>{formatCurrency(amount)}</span>
                          </div>
                        ))
                      ) : (
                        masterMath.isMasterActive ? <div className="text-right text-xs opacity-50 italic">--</div> : null
                      )}
                   </div>

                   <div className={cn("pt-4 border-t flex flex-col gap-3 mt-auto", dk ? "border-white/10" : "border-slate-200")}>
                      
                      <div className="flex justify-between items-center group w-full">
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 shrink-0">{lang === 'de' ? 'Gesamt Brutto' : 'Total Brutto'}</span>
                         {!viewOnly && editingOBrutto ? (
                           <input autoFocus type="number" value={editBruttoValue} onChange={e => setEditBruttoValue(e.target.value)} onBlur={() => {patchHotel({override_total_brutto: editBruttoValue === '' ? null : editBruttoValue}); setEditingOBrutto(false);}} onKeyDown={e => e.key==='Enter' && (e.target as HTMLElement).blur()} className={cn("w-32 text-right px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-black text-xl outline-none ml-auto")} />
                         ) : (
                           <span onClick={() => {!viewOnly && setEditingOBrutto(true);}} className={cn("text-[22px] font-black", masterMath.isOverriddenBrutto && "text-yellow-500", !viewOnly && "cursor-pointer rounded px-1 -mr-1 transition-colors group-hover:bg-black/5")}>{formatCurrency(masterMath.displayBrutto)} {!viewOnly && <Edit3 size={14} className="opacity-0 group-hover:opacity-100 ml-2 inline-block"/>}</span>
                         )}
                      </div>
                      
                      <div className="flex justify-between items-center group w-full">
                        <span className={cn("text-[11px] font-bold shrink-0", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Preis / Bett' : 'Price / Bed'}</span>
                        {!viewOnly && editingPriceBed ? (
                           <input autoFocus type="number" value={editPriceBedValue} onChange={e => setEditPriceBedValue(e.target.value)} onBlur={() => {patchHotel({override_price_per_bed: editPriceBedValue === '' ? null : editPriceBedValue}); setEditingPriceBed(false);}} onKeyDown={e => e.key==='Enter' && (e.target as HTMLElement).blur()} className={cn("w-20 text-right px-1 rounded bg-yellow-500/20 text-yellow-600 font-bold text-[14px] outline-none ml-auto")} />
                        ) : (
                           <span onClick={() => {!viewOnly && setEditingPriceBed(true);}} className={cn("text-[14px] font-bold", masterMath.isOverriddenBed && "text-yellow-600", !viewOnly && "cursor-pointer rounded px-1 -mr-1 transition-colors group-hover:bg-black/5 text-right ml-auto")}>
                             {!masterMath.isOverriddenBed && masterMath.pricePerBed > 0 ? 'ab ' : ''}{formatCurrency(masterMath.pricePerBed)} / N {!viewOnly && <Edit3 size={11} className="opacity-0 group-hover:opacity-100 ml-1 inline-block"/>}
                           </span>
                        )}
                      </div>
                   </div>
                </div>
            </div>
            
            {/* DURATION TABS (FUSED FOLDER EFFECT) */}
            <div className="pt-4">
              <div className={cn("flex items-end gap-1 flex-wrap", dk ? "" : "")}>
                {(localHotel.durations || []).map((d: any, i: number) => {
                  const isActive = activeDurationTab === i;
                  return (
                    <button 
                      key={d.id || i} 
                      onClick={() => setActiveDurationTab(i)} 
                      className={cn(
                        'px-5 py-2.5 text-sm font-bold transition-all border', 
                        isActive 
                          ? (dk ? 'bg-[#0B1224] text-teal-400 border-white/5 border-b-0 rounded-t-xl z-10' : 'bg-white text-teal-700 border-slate-200 border-b-0 rounded-t-xl z-10') 
                          : (dk ? 'bg-[#1E293B]/50 text-slate-500 border-transparent hover:text-slate-300 rounded-lg' : 'bg-slate-100 text-slate-500 border-transparent hover:text-slate-700 rounded-lg')
                      )}
                      style={isActive ? { marginBottom: '-1px' } : { marginBottom: '3px' }}
                    >
                      {getDurationTabLabel(d, lang)}
                    </button>
                  );
                })}
                {!viewOnly && (
                  <button onClick={async () => {
                    setCreatingDuration(true);
                    const created = await createDuration({ hotelId: localHotel.id });
                    const next = { ...localHotel, durations: [...localHotel.durations, { ...created, roomCards: [] }] };
                    setLocalHotel(next); onUpdate(localHotel.id, next); setActiveDurationTab(next.durations.length - 1);
                    setCreatingDuration(false);
                  }} className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-dashed mb-[3px] ml-1", dk ? "border-white/20 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/40" : "border-slate-300 text-slate-500 hover:bg-slate-200 hover:text-slate-800 hover:border-slate-400")}>
                    {creatingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />} {lang === 'de' ? 'Neu' : 'New'}
                  </button>
                )}
              </div>
            </div>
            
            {/* FIX: Remove top-left border radius of card so it perfectly connects to the first tab */}
            {localHotel.durations[activeDurationTab] ? (
              <div className={cn("relative z-0", activeDurationTab === 0 ? "[&>div]:rounded-tl-none" : "")}>
                <DurationCard duration={localHotel.durations[activeDurationTab]} isDarkMode={dk} lang={lang} 
                  isMasterPricingActive={masterMath.isMasterActive}
                  onUpdate={(id, upd) => {
                    const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) };
                    setLocalHotel(next); onUpdate(localHotel.id, next);
                  }}
                  onDelete={(id) => {
                    const next = { ...localHotel, durations: localHotel.durations.filter((d: any) => d.id !== id) };
                    setLocalHotel(next); onUpdate(localHotel.id, next);
                    enqueue({ type: 'deleteDuration', payload: { id } });
                    if (activeDurationTab >= next.durations.length) {
                       setActiveDurationTab(Math.max(0, next.durations.length - 1));
                    }
                  }}
                />
              </div>
            ) : null}
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

export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select', allowAdd = true, disabled }: any) {
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
    <div ref={ref} className="relative w-full h-[34px]">
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('w-full h-full px-3 flex items-center justify-between rounded-lg border text-sm font-bold outline-none transition-all', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white hover:border-teal-500' : 'bg-white border-slate-200 text-slate-900 hover:border-teal-500', disabled && "opacity-60 cursor-not-allowed")}>
        <span className="truncate">{displayValue(value) || placeholder}</span>
        <ChevronDown size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
      </button>
      {open && !disabled && (
        <div className={cn('absolute top-full mt-1 left-0 right-0 z-[200] rounded-xl border shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {options.map((opt:any) => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={cn('w-full text-left px-4 py-2.5 text-sm font-bold transition-all', value === opt ? (isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700') : (isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'))}>
                {displayValue(opt)}
              </button>
            ))}
          </div>
          
          {allowAdd ? (
            <>
              <div className={cn('my-1 border-t', isDarkMode ? 'border-white/10' : 'border-slate-100')} />
              {!addingNew ? (
                <button onClick={() => setAddingNew(true)} className={cn('w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 transition-all', isDarkMode ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-teal-50')}><Plus size={16} strokeWidth={3} /> {lang === 'de' ? 'Neu hinzufügen' : 'Add New'}</button>
              ) : (
                <div className="px-3 py-2 flex items-center gap-2 bg-black/10 dark:bg-white/5">
                  <input autoComplete="off" autoFocus value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className={cn('flex-1 text-sm font-bold outline-none border-b bg-transparent py-1.5', isDarkMode ? 'border-teal-500 text-white' : 'border-teal-600 text-slate-900')} placeholder={lang === 'de' ? 'Tippen & Enter...' : 'Type & Enter...'} />
                  <button onClick={() => { if(newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className="p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-500"><Check size={16} strokeWidth={3} /></button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange, onDeleteOption, onAddOption, disabled }: any) {
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
    if (disabled) return;
    onChange(safeSelected.includes(opt) ? safeSelected.filter((t: any) => t !== opt) : [...safeSelected, opt]);
    setQuery('');
  };

  const handleAddNew = async () => {
    if (disabled) return;
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
    <div ref={ref} className={cn("relative min-h-[30px] flex items-center w-full", disabled ? "cursor-default" : "cursor-pointer")} onClick={(e) => { if (disabled) return; e.stopPropagation(); setOpen(true); }}>
      <div className="flex flex-wrap gap-1.5 w-full">
        {safeSelected.length > 0 ? safeSelected.map((tag: string) => (
          <span key={tag} className={cn('px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 shadow-sm', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800')}>{tag}</span>
        )) : <span className={cn("text-xs font-bold border border-dashed px-3 py-1 rounded-md transition-colors w-full flex items-center", isDarkMode ? "text-slate-500 border-white/20 hover:text-teal-400 hover:border-teal-400" : "text-slate-400 border-slate-300 hover:text-teal-600 hover:border-teal-500")}>+ {lang === 'de' ? 'Firma' : 'Company'}</span>}
      </div>
      
      {open && !disabled && (
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
