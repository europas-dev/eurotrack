// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock, StickyNote, ExternalLink, Search, CornerDownRight, Receipt, FileText, Ticket, Calendar, AlertTriangle, Edit3, Filter } from 'lucide-react';
import {
  cn, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatLastUpdated, calculateNights
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

// Standardizes JS Date string to dd.mm.yyyy for Display
function formatShortDate(isoString?: string | null, lang: string = 'de'): string {
  if (!isoString) return '';
  const parts = isoString.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return isoString;
}

function formatCurrency(amount: number): string {
  return (amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const HighlightText = ({ text, query }: { text: string; query?: string }) => {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span style={{ display: 'inline', whiteSpace: 'pre' }}>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-teal-400 text-black" style={{ fontWeight: 'inherit', padding: 0, margin: 0, display: 'inline' }}>{part}</span>
        ) : (
          <span key={i} style={{ display: 'inline' }}>{part}</span>
        )
      )}
    </span>
  );
};

// --- NATIVE CALENDAR WRAPPER (Forces dd.mm.yyyy text but keeps native popup) ---
export function NativeDatePicker({ value, onChange, min, disabled, className, dk, placeholder = "dd.mm.yyyy" }: any) {
   return (
      <div className={cn("relative flex items-center overflow-hidden transition-all", className)}>
         <input type="date" min={min} disabled={disabled} value={value || ''} onChange={e => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" />
         <div className={cn("w-full h-full flex items-center justify-between px-2 text-[11px] font-bold border rounded", disabled ? "opacity-50 bg-transparent" : (dk ? "bg-black/40 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"))}>
            <span>{value ? formatShortDate(value) : placeholder}</span>
            <Calendar size={12} className={dk ? "text-slate-500" : "text-slate-400"} />
         </div>
      </div>
   );
}

export const COST_TYPES = [
  { id: 'room', de: 'Zimmerpreis', en: 'Room Cost' },
  { id: 'base', de: 'Grundkosten', en: 'Main Cost' },
  { id: 'extra', de: 'Extra', en: 'Extra' },
  { id: 'energy', de: 'Energiekosten', en: 'Energy Cost' },
  { id: 'tax', de: 'Bettensteuer', en: 'Bed Tax' }
];

export const COST_METHODS = [
  { id: 'total', de: 'Gesamt', en: 'Total' },
  { id: 'per_bed', de: 'Pro Bett', en: 'Per Bed' }
];

export function getTranslation(dict: any[], id: string, lang: string) {
  const item = dict.find(d => d.id === id);
  return item ? (lang === 'de' ? item.de : item.en) : id;
}

export function calcInvoiceItem(item: any, defaultNights: number = 1) {
  const mwst = item.mwst != null ? parseFloat(item.mwst) : 0;
  let finalNetto = 0;
  let brutto = 0;

  if (item.brutto != null && item.brutto !== '') {
      brutto = parseFloat(item.brutto);
      finalNetto = brutto / (1 + mwst / 100);
  } else {
      let baseNetto = parseFloat(item.netto) || 0;
      if (item.method === 'per_bed') {
        const beds = parseFloat(item.beds) || 1;
        const nights = parseFloat(item.nights) || defaultNights;
        baseNetto = baseNetto * beds * nights;
      }
      finalNetto = baseNetto;
      if (item.discountValue && parseFloat(item.discountValue) > 0) {
        const dVal = parseFloat(item.discountValue);
        finalNetto = item.discountType === 'percentage' ? baseNetto * (1 - dVal/100) : Math.max(0, baseNetto - dVal);
      }
      brutto = finalNetto * (1 + mwst / 100);
  }
  return { finalNetto, mwst, brutto };
}

// --- ULTRA-COMPACT SPREADSHEET LINE ITEM (Perfectly Aligned) ---
export function InvoiceLineItem({ item, isEditing, onEdit, onSave, onChange, onDelete, viewOnly, dk, lang, defaultNights = 1, defaultStart, defaultEnd }: any) {
  const { finalNetto, mwst, brutto } = calcInvoiceItem(item, defaultNights);
  const [showDiscount, setShowDiscount] = useState(parseFloat(item.discountValue || 0) > 0);
  const [calOpen, setCalOpen] = useState(false);
  const inputClass = cn('px-2 py-1.5 rounded text-[12px] font-bold outline-none border transition-all h-[30px]', dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-teal-500' : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500');

  const hasNettoInput = item.netto != null && item.netto !== '';
  const hasBruttoInput = item.brutto != null && item.brutto !== '';
  const isPerBedAllowed = item.type === 'room' || item.type === 'energy' || item.type === 'tax';
  const needsNote = item.type === 'base' || item.type === 'extra';
  const activeNights = item.nights || defaultNights;

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = '30px';
    e.target.style.height = `${e.target.scrollHeight}px`;
    onChange({ note: e.target.value });
  };

  // EDIT MODE
  if (isEditing && !viewOnly) {
    return (
      <div className={cn("flex flex-col p-2 border-b transition-all w-full", dk ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
        <div className="flex items-start w-full">
           
           {/* COL 1: TYPE & METHOD */}
           <div className="flex-1 min-w-[200px] flex items-center gap-1.5 shrink-0 pr-2">
               <select value={item.type || 'room'} onChange={e => {
                   const newType = e.target.value;
                   const newMethod = (newType === 'base' || newType === 'extra') ? 'total' : item.method;
                   onChange({ type: newType, method: newMethod });
               }} className={cn(inputClass, "w-1/2 px-1")}>
                 {COST_TYPES.map(o => <option key={o.id} value={o.id}>{lang === 'de' ? o.de : o.en}</option>)}
               </select>
               <select disabled={!isPerBedAllowed} value={!isPerBedAllowed ? 'total' : (item.method || 'total')} onChange={e => onChange({ method: e.target.value })} className={cn(inputClass, "w-1/2 px-1 disabled:opacity-50")}>
                    {COST_METHODS.map(m => <option key={m.id} value={m.id}>{lang === 'de' ? m.de : m.en}</option>)}
               </select>
           </div>

           {/* COL 2: NETTO (BED) + FLIGHT CALENDAR */}
           <div className="w-[240px] flex flex-col items-end shrink-0 pr-2 relative">
               {item.method === 'per_bed' && isPerBedAllowed ? (
                 <div className="flex items-center justify-end gap-1.5 w-full">
                    {/* BEDS x NIGHTS [CAL] */}
                    <input type="number" title={lang === 'de' ? 'Betten' : 'Beds'} value={item.beds ?? 1} onChange={e => onChange({ beds: e.target.value })} className={cn(inputClass, "w-[34px] px-1 text-center")} placeholder="1" />
                    <span className="text-[12px] text-slate-400 font-black">×</span>
                    <div className={cn("flex items-center rounded border h-[30px] cursor-pointer hover:border-teal-500 transition-colors", dk ? "bg-black/20 border-white/10 text-white" : "bg-white border-slate-200 text-slate-700")} onClick={() => setCalOpen(!calOpen)}>
                        <span className="w-[26px] text-center text-[11px] font-bold">{activeNights}</span>
                        <div className={cn("px-1 border-l h-full flex items-center", dk ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-400")}><Calendar size={12}/></div>
                    </div>

                    {/* NETTO [TICKET] */}
                    <div className="relative w-[75px] ml-1 shrink-0">
                       <input type="number" disabled={hasBruttoInput} placeholder="0.00" value={item.netto ?? ''} onChange={e => onChange({ netto: e.target.value, brutto: null })} className={cn(inputClass, "w-full disabled:opacity-30 pr-6 text-right")} />
                       {(!showDiscount && !hasBruttoInput) && <button onClick={() => setShowDiscount(true)} className="absolute right-1 top-[5px] p-1 text-slate-400 hover:text-teal-500 rounded"><Ticket size={12}/></button>}
                    </div>
                    
                    {/* RETURN FLIGHT CALENDAR POPOVER */}
                    {calOpen && (
                        <div className={cn("absolute top-full right-0 mt-2 p-3 rounded-xl border shadow-2xl z-[999] flex flex-col gap-3 w-[260px]", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                           <div className="flex items-center gap-2 w-full">
                               <div className="flex-1 flex flex-col gap-1">
                                  <label className="text-[9px] font-bold text-slate-500 uppercase">Start</label>
                                  <NativeDatePicker dk={dk} value={item.startDate || defaultStart || ''} onChange={(s: string) => onChange({ startDate: s, nights: calculateNights(s, item.endDate || defaultEnd || s) })} className="w-full h-[30px]" />
                               </div>
                               <div className="flex-1 flex flex-col gap-1">
                                  <label className="text-[9px] font-bold text-slate-500 uppercase">End</label>
                                  <NativeDatePicker dk={dk} min={item.startDate || defaultStart} value={item.endDate || defaultEnd || ''} onChange={(end: string) => onChange({ endDate: end, nights: calculateNights(item.startDate || defaultStart || end, end) })} className="w-full h-[30px]" />
                               </div>
                           </div>
                           <button onClick={() => setCalOpen(false)} className="w-full py-1.5 bg-teal-500 hover:bg-teal-600 transition-colors text-white text-[11px] font-bold rounded shadow-sm">OK</button>
                        </div>
                    )}
                 </div>
               ) : (
                 <span className="text-[10px] italic text-slate-400 opacity-50 px-2 w-full text-right h-[30px] flex items-center justify-end">--</span>
               )}
               
               {/* INLINE DISCOUNT DROPDOWN */}
               {showDiscount && !hasBruttoInput && (
                  <div className="flex items-center justify-end w-[130px] animate-in fade-in slide-in-from-top-1 mt-1 mr-[-2px]">
                     <input type="number" value={item.discountValue ?? ''} onChange={e => onChange({ discountValue: e.target.value })} className={cn(inputClass, "rounded-r-none border-r-0 w-[60px] px-1.5 text-right")} placeholder="0" />
                     <button onClick={() => onChange({ discountType: item.discountType === 'percentage' ? 'fixed' : 'percentage' })} className={cn("w-[35px] h-[30px] border-y border-r text-[11px] font-bold transition-colors", dk ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 border-slate-200 text-slate-700")}>{item.discountType === 'percentage' ? '%' : '€'}</button>
                     <button onClick={() => { setShowDiscount(false); onChange({ discountValue: null }); }} className={cn("w-[25px] h-[30px] rounded-r border-y border-r flex items-center justify-center transition-colors text-slate-400 hover:text-red-500", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}><X size={14}/></button>
                  </div>
               )}
           </div>

           {/* COL 3: TOTAL NETTO */}
           <div className="w-[100px] flex items-center justify-end shrink-0 pr-2 relative">
               {item.method === 'total' || !isPerBedAllowed ? (
                   <div className="relative w-full">
                       <input type="number" disabled={hasBruttoInput} placeholder="Netto" value={item.netto ?? ''} onChange={e => onChange({ netto: e.target.value, brutto: null })} className={cn(inputClass, "w-full disabled:opacity-30 pr-6 text-right")} />
                       {(!showDiscount && !hasBruttoInput) && <button onClick={() => setShowDiscount(true)} className="absolute right-1 top-[5px] p-1 text-slate-400 hover:text-teal-500 rounded"><Ticket size={12}/></button>}
                   </div>
               ) : (
                   <div className={cn("w-full flex items-center justify-end h-[30px] text-[13px] font-bold opacity-80")}>{formatCurrency(finalNetto)}</div>
               )}
           </div>

           {/* COL 4: MWST (70px) */}
           <div className="w-[70px] shrink-0 pl-1">
               <MwstInput value={item.mwst} onChange={(v:any) => onChange({ mwst: v })} isDarkMode={dk} disabled={false} />
           </div>

           {/* COL 5: TOTAL BRUTTO */}
           <div className="w-[110px] shrink-0 pl-2">
               <input type="number" disabled={hasNettoInput} placeholder={hasNettoInput ? formatCurrency(brutto) : "Brutto"} value={item.brutto ?? ''} onChange={e => onChange({ brutto: e.target.value, netto: null })} className={cn(inputClass, "w-full text-right", hasNettoInput ? "disabled:opacity-100 disabled:bg-transparent disabled:border-transparent text-[13px] font-black px-1 placeholder-slate-900 dark:placeholder-white" : "")} />
           </div>

           {/* ACTIONS */}
           <div className="w-[60px] flex items-center justify-end gap-1.5 shrink-0 pl-1">
              <button onClick={onSave} className="p-1.5 h-[30px] w-[26px] flex items-center justify-center text-white bg-teal-500 hover:bg-teal-600 rounded transition-all shadow-sm"><Check size={14} strokeWidth={3}/></button>
              <button onClick={onDelete} className="p-1.5 h-[30px] w-[26px] flex items-center justify-center text-white bg-red-500 hover:bg-red-600 rounded transition-all shadow-sm"><Trash2 size={13}/></button>
           </div>
        </div>
        
        {/* ROW 2: NOTE (Auto Expands) */}
        {needsNote && (
           <div className="w-full mt-2 animate-in fade-in">
              <textarea rows={1} value={item.note || ''} onChange={handleNoteChange} className={cn(inputClass, "w-full text-[11px] font-medium resize-none overflow-hidden placeholder-opacity-50 min-h-[30px]")} placeholder={lang === 'de' ? "Notiz (Optional)..." : "Note (Optional)..."} />
           </div>
        )}
      </div>
    )
  }

  // VIEW MODE
  return (
    <div className={cn("flex items-start px-3 py-3 border-b last:border-b-0 transition-colors group", dk ? "border-white/5 hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50/50")}>
       <div className="flex-1 min-w-[200px] flex flex-col gap-0.5 shrink-0 overflow-hidden pr-2">
          <div className="flex items-center gap-1.5">
             <span className={cn("text-[12px] font-black truncate", dk ? "text-slate-200" : "text-slate-800")}>{getTranslation(COST_TYPES, item.type || 'room', lang)}</span>
             {item.method === 'per_bed' && <span className="text-[10px] font-bold text-slate-500 shrink-0">({activeNights} {lang==='de'?'Nächte':'Nights'}, {item.beds||1} {lang==='de'?'Betten':'Beds'})</span>}
          </div>
          {(item.startDate || item.endDate || defaultStart || defaultEnd) && item.method === 'per_bed' && (
             <span className="text-[10px] italic text-slate-400 mt-0.5 opacity-80">
                {formatShortDate(item.startDate || defaultStart)} - {formatShortDate(item.endDate || defaultEnd)}
             </span>
          )}
          {item.note && (
             <span className="text-[11px] font-medium text-slate-500 italic mt-1 whitespace-pre-wrap leading-tight">{item.note}</span>
          )}
       </div>

       <div className="w-[240px] shrink-0 flex items-start justify-end pr-3">
          {item.method === 'per_bed' ? (
             <span className={cn("text-[13px] font-bold pt-0.5", dk ? "text-slate-300" : "text-slate-700")}>{formatCurrency(parseFloat(item.netto)||0)}</span>
          ) : (
             <span className="text-[11px] italic text-slate-400 opacity-50 w-[75px] text-right pt-0.5">--</span>
          )}
       </div>

       <div className="w-[100px] shrink-0 flex flex-col items-end pr-2">
          <span className={cn("text-[13px] font-bold pt-0.5", dk ? "text-slate-300" : "text-slate-700")}>
             {hasBruttoInput ? (lang === 'de' ? 'Auto' : 'Auto') : formatCurrency(finalNetto)}
          </span>
          {item.discountValue > 0 && !hasBruttoInput && <span className="text-[9px] font-black text-teal-500 leading-none mt-1 border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.5 rounded">-{item.discountType === 'percentage' ? `${item.discountValue}%` : `${item.discountValue}€`}</span>}
       </div>

       <div className="w-[70px] shrink-0 pt-0.5 text-center">
          <span className={cn("text-[13px] font-bold", dk ? "text-slate-400" : "text-slate-500")}>{item.mwst ?? 7}%</span>
       </div>

       <div className="w-[110px] shrink-0 pt-0.5 pr-2 text-right">
          <span className={cn("text-[13px] font-black", dk ? "text-white" : "text-slate-900")}>
             {hasNettoInput ? formatCurrency(brutto) : formatCurrency(parseFloat(item.brutto)||0)}
          </span>
       </div>

       <div className="w-[60px] flex items-start justify-end opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
          {!viewOnly && <button onClick={onEdit} className="p-1.5 rounded text-slate-400 hover:text-teal-500 bg-black/5 dark:bg-white/5 transition-colors"><Edit3 size={14}/></button>}
       </div>
    </div>
  )
}

// --- SEAMLESS AUTOCOMPLETE INPUT ---
function SeamlessInput({ value, options, isDarkMode, onChange, placeholder, className, textClass, searchQuery, disabled }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [showOptions, setShowOptions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setEditing(false); setShowOptions(false); setDraft(value || ''); } }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [value]);
  const filtered = draft.trim().length > 0 ? (options || []).filter((o: string) => o.toLowerCase().includes(draft.toLowerCase()) && o.toLowerCase() !== draft.toLowerCase()).slice(0, 5) : [];
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
          {filtered.map((opt: string) => <button key={opt} onClick={() => { setDraft(opt); onChange(opt); setEditing(false); setShowOptions(false); }} className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-all", isDarkMode ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}>{opt}</button>)}
        </div>
      )}
    </div>
  );
}

// --- MINI DROPDOWN COMPONENT FOR MWST ---
export function MwstInput({ value, onChange, isDarkMode, disabled }: { value: string | null, onChange: (v: string | null) => void, isDarkMode: boolean, disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', handle); return () => document.removeEventListener('mousedown', handle); }, []);
  return (
    <div ref={ref} className="relative flex items-center h-[30px]">
      <input type="number" disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : e.target.value)} className={cn('w-12 px-1 rounded-l-lg text-[12px] font-bold outline-none border transition-all h-full text-center', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', disabled && "opacity-50 cursor-not-allowed")} placeholder="--" />
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('px-1 h-full rounded-r-lg border border-l-0 transition-all flex items-center justify-center', isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100', disabled && "hidden")}><ChevronDown size={12} /></button>
      {open && !disabled && (
        <div className={cn("absolute top-full right-0 mt-1 w-20 z-[999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-2 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button>)}
        </div>
      )}
    </div>
  );
}

export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select', allowAdd = true, disabled }: any) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAddingNew(false); setNewVal(''); } } document.addEventListener('mousedown', handle); return () => document.removeEventListener('mousedown', handle); }, []);
  const displayValue = (val: string) => { if (lang !== 'de') return val; const de: any = { 'Germany': 'Deutschland', 'Switzerland': 'Schweiz', 'Austria': 'Österreich', 'Netherlands': 'Niederlande', 'Poland': 'Polen', 'Belgium': 'Belgien', 'France': 'Frankreich', 'Luxembourg': 'Luxemburg' }; return de[val] || val; };
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
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={cn('w-full text-left px-4 py-2.5 text-sm font-bold transition-all', value === opt ? (isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700') : (isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'))}>{displayValue(opt)}</button>
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

export function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange, onDeleteOption, onAddOption, disabled, searchQuery }: any) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [localMemory, setLocalMemory] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handle(e: any) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } } document.addEventListener('mousedown', handle); return () => document.removeEventListener('mousedown', handle); }, []);
  const safeOptions = Array.isArray(options) ? options : [];
  const safeSelected = Array.isArray(selected) ? selected : (typeof selected === 'string' && selected ? [selected] : []);
  const combinedOptions = Array.from(new Set([...safeOptions, ...localMemory]));
  const filteredOptions = combinedOptions.filter((o: string) => o.toLowerCase().includes(query.toLowerCase()));
  const exactMatchExists = combinedOptions.some((o: string) => o.toLowerCase() === query.trim().toLowerCase());
  const isAlreadySelected = safeSelected.some((o: string) => o.toLowerCase() === query.trim().toLowerCase());
  const handleToggle = (opt: string) => { if (disabled) return; onChange(safeSelected.includes(opt) ? safeSelected.filter((t: any) => t !== opt) : [...safeSelected, opt]); setQuery(''); };
  const handleAddNew = async () => { if (disabled) return; const val = query.trim(); if (val && !isAlreadySelected) { setLocalMemory(prev => Array.from(new Set([...prev, val]))); onChange([...safeSelected, val]); setQuery(''); if (onAddOption) { await onAddOption(val); } } };
  return (
    <div ref={ref} className={cn("relative min-h-[30px] flex items-center w-full", disabled ? "cursor-default" : "cursor-pointer")} onClick={(e) => { if (disabled) return; e.stopPropagation(); setOpen(true); }}>
      <div className="flex flex-wrap gap-1.5 w-full">
        {safeSelected.length > 0 ? safeSelected.map((tag: string) => (
          <span key={tag} className={cn('px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 shadow-sm', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800')}>
            <HighlightText text={tag} query={searchQuery} />
          </span>
        )) : <span className={cn("text-xs font-bold border border-dashed px-3 py-1 rounded-md transition-colors w-full flex items-center", isDarkMode ? "text-slate-500 border-white/20 hover:text-teal-400 hover:border-teal-400" : "text-slate-400 border-slate-300 hover:text-teal-600 hover:border-teal-500")}>+ {lang === 'de' ? 'Firma' : 'Company'}</span>}
      </div>
      {open && !disabled && (
        <div className={cn('absolute top-full mt-2 left-0 z-[200] rounded-xl border shadow-xl min-w-[240px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')} onClick={e => e.stopPropagation()}>
          <div className={cn("flex items-center px-3 py-2 border-b", isDarkMode ? "border-white/10 bg-[#1E293B]" : "border-slate-100 bg-slate-50")}>
            <Search size={14} className={isDarkMode ? "text-slate-400" : "text-slate-500"} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("ml-2 bg-transparent text-sm font-bold outline-none w-full", isDarkMode ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400")} />
          </div>
          <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
            {query.trim() && !exactMatchExists && !isAlreadySelected && (
              <button onClick={handleAddNew} className={cn('w-full text-left px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all', isDarkMode ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-teal-50')}><span className="opacity-70 text-xs">Create</span> "{query.trim()}"</button>
            )}
            {filteredOptions.map((opt: string) => {
              const isSelected = safeSelected.includes(opt);
              return (
                <div key={opt} className={cn('w-full flex items-center justify-between group transition-all', isSelected ? (isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50') : (isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'))}>
                  <button onClick={() => handleToggle(opt)} className="flex-1 text-left px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border", isSelected ? "bg-teal-500 border-teal-500" : isDarkMode ? "border-slate-500" : "border-slate-400")}>{isSelected && <Check size={10} className="text-white" strokeWidth={4} />}</div>
                    <span className={cn(isSelected ? (isDarkMode ? 'text-teal-400' : 'text-teal-700') : (isDarkMode ? 'text-slate-300' : 'text-slate-700'))}>{opt}</span>
                  </button>
                  {onDeleteOption && (<button onClick={(e) => { e.stopPropagation(); onDeleteOption(opt); setLocalMemory(prev => prev.filter(m => m !== opt)); }} className="px-3 py-2 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete from system"><Trash2 size={13} /></button>)}
                </div>
              )
            })}
            {filteredOptions.length === 0 && !query.trim() && (<div className="px-4 py-3 text-xs font-bold text-slate-500 text-center">{lang === 'de' ? 'Keine Firmen gefunden' : 'No companies found'}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', searchScope = 'all', selectedMonth = null, selectedYear = null, companyOptions = [], cityOptions = [], hotelOptions = [], employeeOptions = [], onDelete, onUpdate, onDeleteCompanyOption, onAddOption, viewOnly, isSelected = false, onSelect = () => {}, isBulkActive = false, isOpen = false, onToggle = () => {}, showGlobalFinancials = false }: any) {
  const [activeTab, setActiveTab] = useState<'bookings'|'billing'|'info'>('bookings');
  
  const [showNotes, setShowNotes] = useState(false);
  const [editingOBrutto, setEditingOBrutto] = useState(false);
  const [editBruttoValue, setEditBruttoValue] = useState('');
  const [editingPriceBed, setEditingPriceBed] = useState(false);
  const [editPriceBedValue, setEditPriceBedValue] = useState('');
  
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState<any>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<string[]>([]);
  const [showTotalDiscount, setShowTotalDiscount] = useState(false);
  
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'paid' | 'unpaid'>('all'); 
  const [localMonthFilter, setLocalMonthFilter] = useState<number | 'all'>('all');
  const [itemSearchQuery, setItemSearchQuery] = useState(''); 
  
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [creatingDuration, setCreatingDuration] = useState(false);
  const saveTimer = useRef<any>(null);

  // Accordion cleanup: Reset month filter when closed
  useEffect(() => {
     if (!isOpen) setLocalMonthFilter('all');
  }, [isOpen]);
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]').includes(entry.id); } catch { return false; }
  });

  const [localHotel, setLocalHotel] = useState({
    ...entry,
    contactPerson: entry?.contactperson || entry?.contactPerson || '',
    website: entry?.weblink || entry?.website || '',
    companyTag: Array.isArray(entry?.companyTag) ? entry.companyTag : (entry?.companyTag ? [entry.companyTag] : []),
    durations: entry?.durations ?? [],
    invoices: (Array.isArray(entry?.invoices) ? entry.invoices : 
             (entry?.rechnung_nr ? [{ id: 'init', number: entry.rechnung_nr, note: '', isPaid: entry.is_paid || entry.isPaid || false }] : []))
             .map((inv: any) => ({
                ...inv,
                billingMode: inv.billingMode || 'detailed',
                totalNetto: inv.totalNetto || null,
                totalMwst: inv.totalMwst || 7,
                startDate: inv.startDate || null,
                endDate: inv.endDate || null,
                dueDate: inv.dueDate || null,
                paymentDate: inv.paymentDate || null,
                items: inv.items || []
             }))
  });

  const activeInvoice = useMemo(() => localHotel.invoices?.find((i:any) => i.id === selectedInvoiceId), [localHotel.invoices, selectedInvoiceId]);

  const hiddenMatchText = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    const invoiceMatch = localHotel.invoices?.some((inv: any) => inv.number?.toLowerCase().includes(q)) || 
                         localHotel.durations?.some((d:any) => d.rechnungNr?.toLowerCase().includes(q));
    if (invoiceMatch && (searchScope === 'all' || searchScope === 'invoice')) 
      return lang === 'de' ? `Treffer: Rechnung` : `Invoice Match`;
    return null;
  }, [localHotel, searchQuery, searchScope, lang]);

  const activeMonthFilter = selectedMonth !== null ? selectedMonth : localMonthFilter;
  const monthOptions = lang === 'de' 
      ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const filteredInvoices = useMemo(() => {
     let filtered = localHotel.invoices || [];
     if (invoiceFilter === 'paid') filtered = filtered.filter((inv:any) => inv.isPaid);
     if (invoiceFilter === 'unpaid') filtered = filtered.filter((inv:any) => !inv.isPaid);
     return filtered.filter((inv: any) => inv.id === selectedInvoiceId || inv.id === editingInvoiceId || true);
  }, [localHotel.invoices, invoiceFilter, selectedInvoiceId, editingInvoiceId]);

  const filteredMasterInvoices = useMemo(() => {
    let filtered = localHotel.invoices || [];

    if (invoiceFilter === 'paid') filtered = filtered.filter((inv:any) => inv.isPaid);
    if (invoiceFilter === 'unpaid') filtered = filtered.filter((inv:any) => !inv.isPaid);

    if (activeMonthFilter !== 'all') {
        filtered = filtered.filter((inv:any) => {
            const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getMonth() === activeMonthFilter && d.getFullYear() === (selectedYear || new Date().getFullYear());
        });
    }

    if (itemSearchQuery.trim()) {
        const lowerQ = itemSearchQuery.toLowerCase();
        filtered = filtered.map((inv: any) => {
            const matchesInvNum = inv.number?.toLowerCase().includes(lowerQ);
            if (inv.billingMode === 'total') {
                if (matchesInvNum || inv.totalNetto?.toString().includes(lowerQ) || inv.totalMwst?.toString().includes(lowerQ)) return inv;
                return null;
            }
            const matchingItems = (inv.items || []).filter((item: any) => {
                const typeText = getTranslation(COST_TYPES, item.type || 'room', lang).toLowerCase();
                return typeText.includes(lowerQ) || item.note?.toLowerCase().includes(lowerQ) || item.netto?.toString().includes(lowerQ) || item.brutto?.toString().includes(lowerQ) || matchesInvNum; 
            });
            if (matchingItems.length > 0) return { ...inv, items: matchingItems };
            return null;
        }).filter(Boolean);
    }
    
    return filtered;
  }, [localHotel.invoices, itemSearchQuery, invoiceFilter, activeMonthFilter, selectedYear, lang]);

  const masterMath = useMemo(() => {
    let tFree = 0; let tBeds = 0; const allEmps: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    let buckets: Record<string, number> = {};
    let finalNetto = 0;
    let finalBrutto = 0;
    let minPricePerBed: number | null = null;
    let totalPaid = 0;
    let totalUnpaid = 0;

    (localHotel.durations || []).forEach((d: any) => {
      const nights = calculateNights(d.startDate, d.endDate);
      (d.roomCards || []).forEach((c: any) => {
         const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
         tBeds += b;
         allEmps.push(...(c.employees || []));
      });
      tFree += calcDurationFreeBeds(d, today);
    });

    const invoicesToScan = (!activeInvoice && activeMonthFilter !== 'all') ? filteredMasterInvoices : (localHotel.invoices || []);

    invoicesToScan.forEach((inv: any) => {
       let invBrutto = 0;
       if (inv.billingMode === 'total') {
          const n = parseFloat(inv.totalNetto) || 0;
          const m = parseFloat(inv.totalMwst) || 0;
          const b = n * (1 + m/100);
          finalNetto += n;
          finalBrutto += b;
          invBrutto += b;
          if (n > 0 && m !== null) buckets[m] = (buckets[m] || 0) + (n * (m/100));
       } else {
          (inv.items || []).forEach((item: any) => {
             const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
             const { finalNetto: itemNetto, mwst: itemMwst, brutto: itemBrutto } = calcInvoiceItem(item, defaultN);
             finalNetto += itemNetto;
             finalBrutto += itemBrutto;
             invBrutto += itemBrutto;
             if (itemNetto > 0 && itemMwst !== null) buckets[itemMwst] = (buckets[itemMwst] || 0) + (itemNetto * (itemMwst/100));
             
             if (item.type === 'room' && item.method === 'per_bed' && item.netto && parseFloat(item.netto) > 0) {
                 const bedPrice = parseFloat(item.netto);
                 if (minPricePerBed === null || bedPrice < minPricePerBed) minPricePerBed = bedPrice;
             }
          });
       }
       if (inv.isPaid) totalPaid += invBrutto;
       else totalUnpaid += invBrutto;
    });

    let activeNetto = 0; let activeBrutto = 0; let activeBuckets: Record<string, number> = {};
    if (activeInvoice) {
       if (activeInvoice.billingMode === 'total') {
          const n = parseFloat(activeInvoice.totalNetto) || 0;
          const m = parseFloat(activeInvoice.totalMwst) || 0;
          activeBrutto = n * (1 + m/100);
          activeNetto = n;
          if (n > 0 && m !== null) activeBuckets[m] = n * (m/100);
       } else {
          (activeInvoice.items || []).forEach((item: any) => {
             const defaultN = activeInvoice.startDate && activeInvoice.endDate ? calculateNights(activeInvoice.startDate, activeInvoice.endDate) : 1;
             const { finalNetto: itemNetto, mwst: itemMwst, brutto: itemBrutto } = calcInvoiceItem(item, defaultN);
             activeNetto += itemNetto;
             activeBrutto += itemBrutto;
             if (itemNetto > 0 && itemMwst !== null) activeBuckets[itemMwst] = (activeBuckets[itemMwst] || 0) + (itemNetto * (itemMwst/100));
          });
       }
    }

    let discountedNetto = finalNetto;
    let discountedBrutto = finalBrutto;
    if (localHotel.has_global_discount && localHotel.global_discount_value) {
       const gVal = parseFloat(localHotel.global_discount_value);
       const isFixed = localHotel.global_discount_type === 'fixed';
       const target = localHotel.global_discount_target || 'netto';
       
       if (target === 'netto') {
          let ratio = isFixed ? (gVal / finalNetto) : (gVal / 100);
          if (!isFinite(ratio)) ratio = 0;
          discountedNetto = Math.max(0, finalNetto - (isFixed ? gVal : finalNetto * ratio));
          discountedBrutto = discountedNetto;
          Object.keys(buckets).forEach(k => {
              buckets[k] = buckets[k] * (1 - ratio);
              discountedBrutto += buckets[k];
          });
       } else {
          discountedBrutto = Math.max(0, finalBrutto - (isFixed ? gVal : finalBrutto * (gVal/100)));
       }
    }

    let finalPriceBed = minPricePerBed || 0;
    let isOverriddenBed = false;
    if (localHotel.override_price_per_bed != null) {
       const overrideVal = parseFloat(localHotel.override_price_per_bed);
       if (minPricePerBed !== null && minPricePerBed < overrideVal) {
           finalPriceBed = minPricePerBed; 
           isOverriddenBed = false;
       } else {
           finalPriceBed = overrideVal;
           isOverriddenBed = true;
       }
    }

    return { 
      freeBeds: tFree, 
      totalBeds: tBeds, 
      employees: allEmps, 
      displayNetto: discountedNetto, 
      displayBrutto: localHotel.override_total_brutto != null ? parseFloat(localHotel.override_total_brutto) : discountedBrutto, 
      buckets, 
      activeNetto,
      activeBrutto,
      activeBuckets,
      pricePerBed: finalPriceBed,
      totalPaid,
      totalUnpaid,
      isOverriddenBrutto: localHotel.override_total_brutto != null, 
      isOverriddenBed
    };
  }, [localHotel, activeInvoice, filteredMasterInvoices, activeMonthFilter]);

  // SMART SORTER: EMPLOYEES (Active first, Max 8)
  const sortedEmployees = useMemo(() => {
     const emps = [...masterMath.employees];
     emps.sort((a, b) => {
        const statusWeight = (status: string) => status === 'active' ? 1 : status === 'ending-soon' ? 2 : status === 'upcoming' ? 3 : 4;
        return statusWeight(getEmployeeStatus(a.checkIn, a.checkOut)) - statusWeight(getEmployeeStatus(b.checkIn, b.checkOut));
     });
     return emps;
  }, [masterMath.employees]);
  const visibleEmps = sortedEmployees.slice(0, 8);
  const hiddenEmps = sortedEmployees.slice(8);

  // SMART SORTER: DURATIONS (Newest first, Max 4)
  const sortedDurations = useMemo(() => {
     const durs = [...(localHotel.durations || [])];
     durs.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
     return durs;
  }, [localHotel.durations]);
  const visibleDurs = sortedDurations.slice(0, 4);
  const hiddenDurs = sortedDurations.slice(4);
  function patchHotel(changes: any) {
    if (viewOnly) return; 
    let next = { ...localHotel, ...changes };
    if ('invoices' in changes) {
       const hasInvs = next.invoices && next.invoices.length > 0;
       if (hasInvs) {
          const allPaid = next.invoices.every((inv: any) => inv.isPaid);
          next.isPaid = allPaid;
          changes.isPaid = allPaid; 
       } else {
          next.isPaid = false;
          changes.isPaid = false;
       }
    }
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
        if ('isPaid' in next) dbPayload.is_paid = next.isPaid;
        if ('depositEnabled' in next) dbPayload.deposit_enabled = next.depositEnabled;
        if ('depositAmount' in next) dbPayload.deposit_amount = next.depositAmount;
        if ('has_global_discount' in next) dbPayload.has_global_discount = next.has_global_discount;
        if ('global_discount_value' in next) dbPayload.global_discount_value = next.global_discount_value;
        if ('global_discount_type' in next) dbPayload.global_discount_type = next.global_discount_type;
        if ('global_discount_target' in next) dbPayload.global_discount_target = next.global_discount_target;
        if ('override_total_brutto' in next) dbPayload.override_total_brutto = next.override_total_brutto;
        if ('override_price_per_bed' in next) dbPayload.override_price_per_bed = next.override_price_per_bed;
        if ('invoices' in next) dbPayload.invoices = next.invoices;

        await updateHotel(localHotel.id, dbPayload);
        onUpdate(localHotel.id, next);
      } catch (e: any) { console.error(`Error saving: ${e.message}`); }
      finally { setSaving(false); }
    }, 400);
  }

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
  const totalInvs = (localHotel.invoices || []).length;
  const paidInvs = (localHotel.invoices || []).filter((i: any) => i.isPaid).length;
  const unpaidInvs = totalInvs - paidInvs;
  
return (
    <div className="space-y-1 relative" style={{ zIndex: 40 - (index % 30) }}>
      
      <div className={cn("absolute -left-7 top-0 bottom-0 w-10 flex items-center justify-center transition-all duration-300 z-[100]", isSelected || isBulkActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 hover:opacity-100")}>
        <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); onSelect(); }} className="w-4 h-4 rounded border-slate-300 accent-teal-600 cursor-pointer shadow-sm transition-transform active:scale-90" />
      </div>

      <div className={cn('rounded-xl border transition-all duration-200 shadow-sm relative overflow-visible', isSelected ? (dk ? 'bg-teal-500/10 border-teal-500/50' : 'bg-teal-50 border-teal-500/40') : (dk ? 'bg-[#1E293B] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300'))}>
        
        {/* VERTICAL STATUS LINE */}
        <div className={cn("absolute right-0 top-0 bottom-0 w-[4px] rounded-r-xl transition-colors z-[60]", masterMath.totalUnpaid > 0 ? "bg-red-500" : (masterMath.totalPaid > 0 ? "bg-emerald-500" : "bg-transparent border-l border-slate-200 dark:border-white/10"))} />

        {/* ALIGNED GRID MAIN ROW */}
        <div className={cn('flex items-center cursor-pointer p-2 pr-6', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', isOpen && 'border-b', isOpen && (dk ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'))} onClick={onToggle}>
          
          <div className="flex items-center justify-center w-10 shrink-0">
            {isOpen ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>
          
          <div className="w-[200px] py-2 shrink-0 pr-4">
            <SeamlessInput disabled={viewOnly} value={localHotel.name} options={hotelOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ name: val })} placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel Name...'} textClass={cn('text-[14px] font-black leading-tight', dk ? 'text-white' : 'text-slate-900')} searchQuery={searchScope === 'all' || searchScope === 'hotel' ? searchQuery : ''} />
            <SeamlessInput disabled={viewOnly} value={localHotel.city} options={cityOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ city: val })} placeholder={lang === 'de' ? 'Stadt...' : 'City...'} className="mt-0.5" textClass={cn("text-[10px] font-bold uppercase tracking-widest gap-1.5", dk ? "text-slate-500" : "text-slate-400")} searchQuery={searchScope === 'all' || searchScope === 'city' ? searchQuery : ''} />
          </div>

          <div className="w-[120px] shrink-0 pr-2" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect disabled={viewOnly} selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={(tags:any) => patchHotel({ companyTag: tags })} onDeleteOption={onDeleteCompanyOption} onAddOption={onAddOption} searchQuery={searchScope === 'all' || searchScope === 'company' ? searchQuery : ''} />
          </div>

          <div className="w-[150px] shrink-0 pr-2 flex flex-wrap gap-1.5">
              {visibleDurs.map((d: any, i: number) => {
                // 1. Hover Title Logic (Rooms & Nights)
                const typeCount: any = {};
                (d.roomCards || []).forEach((c:any) => { typeCount[c.roomType] = (typeCount[c.roomType] || 0) + 1 });
                const roomStr = Object.entries(typeCount).map(([rt, count]) => `${count} ${rt}`).join(', ');
                const n = calculateNights(d.startDate, d.endDate);
                const title = `${n} N, ${(d.roomCards || []).length} Rooms ${roomStr ? `(${roomStr})` : ''}`;
                
                // 2. Format as '02 Dec'
                const formatChipDate = (iso: string) => {
                    const date = new Date(iso);
                    const locale = lang === 'de' ? 'de-DE' : 'en-GB';
                    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' }).replace('.', '');
                };

                return (
                  <button key={d.id} title={title} onClick={(e) => { e.stopPropagation(); onToggle(); setActiveTab('bookings'); setActiveDurationTab(i); }} className={cn('px-2 py-0.5 rounded text-[10px] font-bold border truncate text-center shadow-sm hover:ring-1 ring-teal-500/30 transition-all', dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')}>
                    {d.startDate && d.endDate ? `${formatChipDate(d.startDate)} - ${formatChipDate(d.endDate)}` : 'New'}
                  </button>
                )
              })}
              {hiddenDurs.length > 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-dashed border-slate-300 dark:border-white/20 text-slate-400">+{hiddenDurs.length}</span>}
          </div>

          <div className="flex-1 min-w-[200px] flex flex-wrap gap-1.5 pr-4">
              {visibleEmps.map((emp: any) => {
                const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                const borderCls = status === 'active' ? "border-emerald-500/50" : status === 'upcoming' ? "border-blue-500/50" : status === 'ending-soon' ? "border-red-500/50" : "border-slate-500/40";
                const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                
                const shortName = emp.name ? emp.name.trim().split(' ').pop() : '_ _ _';
                const n = calculateNights(emp.checkIn||'', emp.checkOut||'');
                
                return (
                <div key={emp.id} className="relative group">
                    <button onClick={(e) => { e.stopPropagation(); onToggle(); setActiveTab('bookings'); setTimeout(() => { const el = document.getElementById(`emp-slot-${emp.id}`); if(el){ el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.classList.add('ring-2', 'ring-teal-500'); setTimeout(()=>el.classList.remove('ring-2','ring-teal-500'), 2000);} }, 100); }} 
                      className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:opacity-80 transition-opacity", borderCls, dk ? "bg-[#1E293B] text-slate-200" : "bg-slate-50 text-slate-700")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                      <HighlightText text={shortName} query={searchScope === 'all' || searchScope === 'employee' ? searchQuery : ''} />
                    </button>
                    {/* Hover Popover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-slate-800 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[200] shadow-xl text-center">
                        <p className="text-xs font-bold">{emp.name}</p>
                        <p className="text-[10px] text-slate-300">{formatShortDate(emp.checkIn, lang)} ➔ {formatShortDate(emp.checkOut, lang)} ({n}N)</p>
                    </div>
                </div>
                );
              })}
              
              {/* + X More Popover */}
              {hiddenEmps.length > 0 && (
                 <div className="relative group">
                    <button onClick={(e) => { e.stopPropagation(); onToggle(); setActiveTab('bookings'); }} className="px-2 py-0.5 rounded-full border border-dashed border-slate-400 text-[10px] font-bold flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">+{hiddenEmps.length}</button>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] px-3 py-2 bg-slate-800 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999] shadow-xl flex flex-wrap gap-1">
                        {hiddenEmps.map(e => <span key={e.id} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{e.name?.trim().split(' ').pop()}</span>)}
                    </div>
                 </div>
              )}
          </div>

          <div className="w-12 shrink-0 text-center">
            <p className={cn('text-sm font-black', masterMath.freeBeds > 0 ? 'text-red-500' : dk ? 'text-teal-500' : 'text-teal-600')}>{masterMath.freeBeds}</p>
          </div>
          
          <div className="w-12 shrink-0 text-center">
            <p className={cn('text-sm font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{masterMath.totalBeds}</p>
          </div>
        
          <div className="w-[140px] shrink-0 flex flex-col items-end justify-center pr-2 relative">
            {hiddenMatchText && (
               <div className="absolute right-full mr-4 flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 text-teal-500 text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">
                  <Search size={10} strokeWidth={3} /> {hiddenMatchText}
               </div>
            )}
            
            <div className={cn('font-black leading-none text-right', selectedMonth !== null ? 'text-md' : 'text-lg', dk ? 'text-white' : 'text-slate-900')}>
              {formatCurrency(masterMath.displayBrutto)}
            </div>
            
            {showGlobalFinancials && (
               <div className="flex flex-col items-end mt-1 space-y-0.5">
                  <span className="text-emerald-500 text-[10px] font-bold leading-none">{formatCurrency(masterMath.totalPaid)}</span>
                  <span className="text-red-500 text-[10px] font-bold leading-none">{formatCurrency(masterMath.totalUnpaid)}</span>
               </div>
            )}

            {/* RESTORED ICONS */}
            <div className="flex items-center justify-end gap-1 mt-2 opacity-30 hover:opacity-100 transition-opacity">
               <button onClick={handleBookmarkToggle} className={cn("p-1 rounded transition-colors", isBookmarked ? "text-yellow-500" : "text-slate-500 hover:text-slate-800 dark:hover:text-white")}><Star size={12} className={isBookmarked ? "fill-yellow-500" : ""} /></button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"><Clock size={12} /></button>
                  <div className={cn("absolute right-0 bottom-full mb-2 w-max px-2 py-1 text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 z-[9999] whitespace-nowrap pointer-events-none shadow-xl border", dk ? "bg-slate-800 text-white border-white/10" : "bg-white text-slate-700 border-slate-200")}>{formatLastUpdated(localHotel.last_updated_by || localHotel.lastUpdatedBy, localHotel.last_updated_at || localHotel.lastUpdatedAt, lang)}</div>
               </div>
               {!viewOnly && (
                 <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1 rounded text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
               )}
            </div>
          </div>
            
            <div className={cn('font-black leading-none text-right', selectedMonth !== null ? 'text-md' : 'text-lg', dk ? 'text-white' : 'text-slate-900')}>
              {formatCurrency(masterMath.displayBrutto)}
            </div>
            
            {showGlobalFinancials && (
               <div className="flex flex-col items-end mt-1 space-y-0.5 animate-in fade-in">
                  <span className="text-emerald-500 text-[10px] font-bold leading-none">{formatCurrency(masterMath.totalPaid)}</span>
                  <span className="text-red-500 text-[10px] font-bold leading-none">{formatCurrency(masterMath.totalUnpaid)}</span>
               </div>
            )}
          </div>
        </div>

        {isOpen && (
          <div className={cn('rounded-b-2xl border-t shadow-inner flex flex-col', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50 border-slate-200')} onClick={e => e.stopPropagation()}>
            
            {/* 3 TABS NAVIGATOR */}
            <div className="flex items-center px-4 pt-2 gap-2 border-b border-slate-200 dark:border-white/10">
               <button onClick={() => setActiveTab('bookings')} className={cn("px-5 py-2.5 text-sm font-bold transition-all border-b-2", activeTab === 'bookings' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300")}>{lang === 'de' ? 'Buchungszeiträume' : 'Booking Periods'}</button>
               <button onClick={() => setActiveTab('billing')} className={cn("px-5 py-2.5 text-sm font-bold transition-all border-b-2", activeTab === 'billing' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300")}>{lang === 'de' ? 'Abrechnung & Rechnungen' : 'Billing & Invoice'}</button>
               <button onClick={() => setActiveTab('info')} className={cn("px-5 py-2.5 text-sm font-bold transition-all border-b-2", activeTab === 'info' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300")}>{lang === 'de' ? 'Hotel Info' : 'Hotel Info'}</button>
            </div>

            {/* TAB 1: BOOKING PERIODS */}
            {activeTab === 'bookings' && (
              <div className="p-4 bg-white dark:bg-[#1E293B] rounded-b-2xl animate-in fade-in">
                <div className={cn("flex items-end gap-1 flex-wrap mb-[3px]")}>
                  {(localHotel.durations || []).map((d: any, i: number) => {
                    const isActive = activeDurationTab === i;
                    return (
                      <button key={d.id || i} onClick={() => setActiveDurationTab(i)} className={cn('px-5 py-2 text-sm font-bold transition-all border', isActive ? (dk ? 'bg-[#0B1224] text-teal-400 border-white/10 border-b-0 rounded-t-xl z-10' : 'bg-slate-50 text-teal-700 border-slate-200 border-b-0 rounded-t-xl z-10') : (dk ? 'bg-black/20 text-slate-500 border-transparent hover:text-slate-300 rounded-lg' : 'bg-slate-100 text-slate-500 border-transparent hover:text-slate-700 rounded-lg'))} style={isActive ? { marginBottom: '-1px' } : {}}>
                        {getDurationTabLabel(d, lang)}
                      </button>
                    );
                  })}
                  {!viewOnly && (
                    <button onClick={async () => {
                      setCreatingDuration(true);
                      const created = await createDuration({ hotelId: localHotel.id });
                      const next = { ...localHotel, durations: [...localHotel.durations, { ...created, roomCards: [] }] };
                      patchHotel({ durations: next.durations }); setActiveDurationTab(next.durations.length - 1); setCreatingDuration(false);
                    }} className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-dashed ml-1", dk ? "border-white/20 text-slate-400 hover:bg-white/10 hover:text-white" : "border-slate-300 text-slate-500 hover:bg-slate-200 hover:text-slate-800")}>
                      {creatingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />} {lang === 'de' ? 'Neu' : 'New'}
                    </button>
                  )}
                </div>
                {localHotel.durations[activeDurationTab] && (
              <div className={cn("relative z-0", activeDurationTab === 0 ? "[&>div]:rounded-tl-none" : "")}>
                <DurationCard 
                  duration={localHotel.durations[activeDurationTab]} 
                  isDarkMode={dk} lang={lang} 
                  isMasterPricingActive={masterMath.isMasterActive} 
                  viewOnly={viewOnly} searchQuery={searchQuery} searchScope={searchScope} employeeOptions={employeeOptions}
                  onUpdate={(id, upd) => patchHotel({ durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) })} 
                  onDelete={(id) => { const n = localHotel.durations.filter((d: any) => d.id !== id); patchHotel({ durations: n }); enqueue({ type: 'deleteDuration', payload: { id } }); if (activeDurationTab >= n.length) setActiveDurationTab(Math.max(0, n.length - 1)); }} 
                />
              </div>
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

      {invoiceToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn('w-full max-w-sm rounded-3xl border p-6 shadow-2xl animate-in zoom-in-95', dk ? 'bg-[#1E293B] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200')}>
            <div className="flex items-center gap-3 mb-2 text-red-500"><AlertTriangle size={24} /><h3 className="text-xl font-black">{lang === 'de' ? 'Rechnung löschen?' : 'Delete invoice?'}</h3></div>
            <p className="text-sm font-bold text-slate-500 mb-6 mt-2">{lang === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This action cannot be undone.'}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setInvoiceToDelete(null)} className={cn("px-5 py-2 font-bold rounded-xl border transition-all", dk ? "border-white/10 hover:bg-white/10 text-white" : "border-slate-200 hover:bg-slate-100 text-slate-700")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={() => { patchHotel({ invoices: localHotel.invoices.filter((i: any) => i.id !== invoiceToDelete) }); setEditingInvoiceId(null); setInvoiceDraft(null); setInvoiceToDelete(null); }} className="px-5 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-md">{lang === 'de' ? 'Löschen' : 'Delete'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default HotelRow;
