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
      <div className={cn("truncate transition-opacity w-full min-h-[20px]", !disabled ? "cursor-text hover:opacity-70" : "cursor-default", textClass)} onClick={(e) => { if (disabled) return; e.stopPropagation(); setEditing(true); setDraft(value || ''); setShowOptions(true); }}>
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

function MwstInput({ value, onChange, isDarkMode, disabled }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  return (
    <div ref={ref} className="relative flex items-center h-[34px]">
      <input type="number" disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : e.target.value)} className={cn('w-16 px-2 py-1.5 rounded-l-lg text-sm font-bold outline-none border transition-all h-full text-center', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', disabled && "opacity-50")} placeholder="--" />
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('px-1.5 h-full rounded-r-lg border border-l-0 transition-all flex items-center justify-center', isDarkMode ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500', disabled && "hidden")}><ChevronDown size={14} /></button>
      {open && (
        <div className={cn("absolute top-full right-0 mt-1 w-20 z-[999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => ( <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-2 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button> ))}
        </div>
      )}
    </div>
  );
}

export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', companyOptions = [], cityOptions = [], hotelOptions = [], onDelete, onUpdate, onDeleteCompanyOption, onAddOption, viewOnly }: any) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const initialBaseCosts = entry?.base_costs?.length > 0 ? entry.base_costs : [{ id: 'default', netto: entry?.base_netto ?? null, mwst: entry?.base_mwst ?? null, brutto: entry?.base_brutto ?? null, discountValue: null, discountType: 'fixed', showDiscount: false }];
  const [showMasterBase, setShowMasterBase] = useState(initialBaseCosts.some((bc:any) => bc.netto != null || bc.brutto != null));
  const [showExtras, setShowExtras] = useState(entry.extra_costs?.length > 0);
  const [editingOBrutto, setEditingOBrutto] = useState(false);
  const [editBruttoValue, setEditBruttoValue] = useState('');
  const [editingPriceBed, setEditingPriceBed] = useState(false);
  const [editPriceBedValue, setEditPriceBedValue] = useState('');
  const [localHotel, setLocalHotel] = useState({ ...entry, contactPerson: entry?.contactperson || '', website: entry?.weblink || '', companyTag: Array.isArray(entry?.companyTag) ? entry.companyTag : [], durations: entry?.durations ?? [], extraCosts: entry?.extra_costs ?? [], baseCosts: initialBaseCosts });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  // Math Engine preserved exactly
  const masterMath = useMemo(() => {
    let tFree = 0; let tBeds = 0; const allEmps: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    let sumDurationNetto = 0; let sumDurationBrutto = 0;
    let buckets: Record<string, number> = {}; let minPricePerBed: number | null = null;
    (localHotel.durations || []).forEach((d: any) => {
      const nights = calculateNights(d.startDate, d.endDate);
      (d.roomCards || []).forEach((c: any) => {
         const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
         tBeds += b; allEmps.push(...(c.employees || []));
         const cardNetto = calcRoomCardNettoSum(c, d.startDate, d.endDate);
         const cardBrutto = calcRoomCardTotal(c, d.startDate, d.endDate);
         sumDurationNetto += cardNetto; sumDurationBrutto += cardBrutto;
         if (b > 0 && nights > 0 && cardNetto > 0) { const p = cardNetto / (b * nights); if (minPricePerBed === null || p < minPricePerBed) minPricePerBed = p; }
         let amwst = c.pricingTab === 'per_room' ? parseFloat(c.roomMwst) : parseFloat(c.bedMwst);
         if (!isNaN(amwst)) buckets[amwst] = (buckets[amwst] || 0) + (cardBrutto - cardNetto);
      });
      tFree += calcDurationFreeBeds(d, today);
    });
    let isMasterActive = (localHotel.baseCosts || []).some((bc: any) => bc.netto != null || bc.brutto != null);
    const baseWithDisplay = (localHotel.baseCosts || []).map((bc: any) => {
        let bMwSt = parseFloat(bc.mwst); let dNetto = bc.netto;
        if (bc.discountValue) { const v = parseFloat(bc.discountValue); dNetto = bc.discountType === 'fixed' ? bc.netto - v : bc.netto * (1 - v/100); }
        return { ...bc, discountedNetto: dNetto };
    });
    const displayBrutto = localHotel.override_total_brutto ?? sumDurationBrutto;
    return { freeBeds: tFree, totalBeds: tBeds, employees: allEmps, displayBrutto, buckets, pricePerBed: localHotel.override_price_per_bed ?? minPricePerBed ?? 0, baseCostsWithDisplay: baseWithDisplay, isMasterActive };
  }, [localHotel]);

  function patchHotel(changes: any) {
    if (viewOnly) return;
    const next = { ...localHotel, ...changes };
    setLocalHotel(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        const dbPayload = { name: next.name, city: next.city, address: next.address, contactperson: next.contactPerson, phone: next.phone, email: next.email, weblink: next.website, country: next.country, notes: next.notes, rechnung_nr: next.rechnungNr, booking_id: next.bookingId, is_paid: next.isPaid, base_costs: next.baseCosts, extra_costs: next.extraCosts, override_total_brutto: next.override_total_brutto, override_price_per_bed: next.override_price_per_bed };
        await updateHotel(localHotel.id, dbPayload);
        onUpdate(localHotel.id, next);
      } catch (e) { console.error(e); } finally { setSaving(false); }
    }, 400);
  }

  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500', dk && 'text-slate-400');
  const inputCls = cn('w-full px-2 py-1.5 rounded-lg text-sm font-bold outline-none border transition-all h-[34px]', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', viewOnly && "opacity-60 cursor-default");

  return (
    <div className="space-y-1 relative">
      <div className={cn('rounded-2xl border transition-all duration-200 shadow-sm relative', dk ? 'bg-[#1E293B] border-white/5' : 'bg-white border-slate-200')}>
        
        {/* MAIN ROW */}
        <div className={cn('flex items-center gap-0 cursor-pointer p-2', open && 'border-b')} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0"> {open ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-slate-500" />} </div>
          <div className="flex-[2] py-2 min-w-[200px]">
            <SeamlessInput disabled={viewOnly} value={localHotel.name} options={hotelOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ name: val })} placeholder="Hotelname..." textClass="text-[15px] font-black" searchQuery={searchQuery} />
            <SeamlessInput disabled={viewOnly} value={localHotel.city} options={cityOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ city: val })} placeholder="Stadt..." textClass="text-[10px] uppercase font-bold text-slate-400" searchQuery={searchQuery} />
          </div>
          
          {/* ACTIONS: DELETE REMOVED FOR VIEWERS */}
          <div className="ml-auto flex items-center gap-6 pr-3">
             <div className="text-right min-w-[100px]">
                <p className="text-[10px] uppercase font-bold text-slate-500">Kosten</p>
                <p className="text-lg font-black">{formatCurrency(masterMath.displayBrutto)}</p>
             </div>
             {!viewOnly && (
               <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
             )}
          </div>
        </div>

        {/* EXPANDED BREAKDOWN */}
        {open && (
          <div className={cn('p-6 space-y-6 rounded-b-2xl border-t', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50 border-slate-200')} onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-[2] min-w-[180px] flex items-end gap-2">
                 <div className="flex-1"><label className={labelCls}>Adresse</label><input disabled={viewOnly} value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} className={inputCls} placeholder="..." /></div>
              </div>
              <div className="flex-[1.5] min-w-[120px]"><label className={labelCls}>Ansprechpartner</label><input disabled={viewOnly} value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} className={inputCls} placeholder="..." /></div>
              <div className="flex-[1.5] min-w-[140px]"><label className={labelCls}>Email</label><input disabled={viewOnly} value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} className={inputCls} placeholder="..." /></div>
              <div className="flex-[1] min-w-[100px]"><label className={labelCls}>Land</label><ModernDropdown disabled={viewOnly} value={localHotel.country || 'Germany'} options={getCountryOptions()} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} /></div>
            </div>

            <div className={cn("rounded-2xl border flex flex-col xl:flex-row shadow-md", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}>
                <div className="w-full xl:w-[240px] p-5 flex flex-col gap-4 border-r">
                    <div><label className={labelCls}>Rechnungsnr.</label><input disabled={viewOnly} value={localHotel.rechnungNr || ''} onChange={e => patchHotel({ rechnungNr: e.target.value })} className={inputCls} /></div>
                </div>
                <div className="flex-1 p-5 flex flex-col gap-5">
                   {!viewOnly && (
                     <div className="flex items-center gap-2">
                        <button onClick={() => setShowMasterBase(!showMasterBase)} className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-teal-600 text-white">Brutto / Netto</button>
                        <button onClick={() => patchHotel({has_global_discount: !localHotel.has_global_discount})} className="px-3 py-1.5 text-xs font-bold rounded-lg border">Gesamtrabatt</button>
                     </div>
                   )}
                   {/* DURATION TABS */}
                   <DurationCard duration={localHotel.durations[activeDurationTab]} isDarkMode={dk} lang={lang} viewOnly={viewOnly} onUpdate={(id, upd) => { const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) }; setLocalHotel(next); onUpdate(localHotel.id, next); }} onDelete={(id) => {}} />
                </div>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border p-8 bg-white dark:bg-[#1E293B]">
            <h3 className="text-2xl font-black mb-2">Hotel löschen?</h3>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConfirmDelete(false)} className="px-6 py-2.5 font-bold">Abbrechen</button>
              <button onClick={async () => { await deleteHotel(localHotel.id); onDelete(localHotel.id); setConfirmDelete(false); }} className="px-6 py-2.5 font-bold bg-red-600 text-white rounded-xl">Löschen</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

export default HotelRow;
