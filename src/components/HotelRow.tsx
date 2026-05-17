// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock, StickyNote, ExternalLink, Search, CornerDownRight, Receipt, FileText, Ticket, Calendar, AlertTriangle, Edit3, Filter } from 'lucide-react';
import {cn, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatLastUpdated, calculateNights, calcInvoiceItem, formatDateChip} from '../lib/utils';
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
  const cleanDate = isoString.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return cleanDate;
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

export function InvoiceLineItem({ item, isEditing, onEdit, onSave, onCancel, onDelete, viewOnly, dk, lang, defaultNights = 1, defaultStart, defaultEnd }: any) {
  const [draft, setDraft] = useState(item);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [showDiscount, setShowDiscount] = useState(parseFloat(item.discountValue || 0) > 0);
  
  const noSpinner = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const inputClass = cn('px-2 py-1.5 rounded text-[12px] font-bold outline-none border transition-all h-[30px]', noSpinner, dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-teal-500' : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500');

  useEffect(() => { if (isEditing) setDraft(item); }, [isEditing, item]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (isEditing && editRef.current && !editRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.flatpickr-calendar')) onCancel();
      }
    }
    function handleKey(e: KeyboardEvent) { if (isEditing && e.key === 'Escape') onCancel(); }
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey); }
  }, [isEditing, onCancel]);

  const currentItem = isEditing ? draft : item;
  const { finalNetto, mwst, brutto } = calcInvoiceItem(currentItem, defaultNights);
  
  const hasNettoInput = currentItem.netto != null && currentItem.netto !== '';
  const hasBruttoInput = currentItem.brutto != null && currentItem.brutto !== '';
  const isPerBedAllowed = currentItem.type === 'room' || currentItem.type === 'energy' || currentItem.type === 'tax';
  const needsNote = currentItem.type === 'base' || currentItem.type === 'extra';
  const activeNights = currentItem.nights || defaultNights;

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = '30px';
    e.target.style.height = `${e.target.scrollHeight}px`;
    setDraft({ ...draft, note: e.target.value });
  };

  if (isEditing && !viewOnly) {
    return (
      <div ref={editRef} className={cn("flex flex-col p-2 border-b transition-all w-full relative z-20 shadow-xl", dk ? "bg-teal-900/20 border-teal-500/50" : "bg-teal-50 border-teal-300")}>
        <div className="flex items-start w-full gap-2">
           {/* WIDTH FIX: Expanded to 220px to prevent dropdowns from choking */}
           <div className="w-[220px] flex items-center gap-1.5 shrink-0">
               <select value={draft.type || 'room'} onChange={e => {
                   const newType = e.target.value;
                   const newMethod = (newType === 'base' || newType === 'extra') ? 'total' : draft.method;
                   setDraft({ ...draft, type: newType, method: newMethod });
               }} className={cn(inputClass, "flex-1 min-w-0 px-1 text-[11px] truncate")}>
                 {COST_TYPES.map(o => <option key={o.id} value={o.id}>{lang === 'de' ? o.de : o.en}</option>)}
               </select>
               <select disabled={!isPerBedAllowed} value={!isPerBedAllowed ? 'total' : (draft.method || 'total')} onChange={e => setDraft({ ...draft, method: e.target.value })} className={cn(inputClass, "flex-1 min-w-0 px-1 text-[11px] disabled:opacity-50 truncate")}>
                    {COST_METHODS.map(m => <option key={m.id} value={m.id}>{lang === 'de' ? m.de : m.en}</option>)}
               </select>
           </div>

           <div className="flex-1 flex flex-col items-end shrink-0 pr-3 relative">
               {draft.method === 'per_bed' && isPerBedAllowed ? (
                 <div className="flex flex-col items-end gap-1.5 w-full">
                     <div className="flex items-center justify-end gap-1.5 w-full">
                        <input type="number" title={lang === 'de' ? 'Betten' : 'Beds'} value={draft.beds ?? 1} onChange={e => setDraft({ ...draft, beds: e.target.value })} className={cn(inputClass, "w-[50px] pl-2 pr-0 text-left [appearance:auto] [&::-webkit-outer-spin-button]:appearance-auto [&::-webkit-inner-spin-button]:appearance-auto")} placeholder="1" />
                       <span className="text-[12px] text-slate-400 font-black">×</span>
                         <div className={cn("flex items-center rounded border h-[30px] cursor-pointer hover:border-teal-500 transition-colors", dk ? "bg-black/20 border-white/10 text-white" : "bg-white border-slate-200 text-slate-700")} onClick={() => setCalOpen(!calOpen)}>
                             <span className="w-[26px] text-center text-[11px] font-bold">{activeNights}</span>
                             <div className={cn("px-1 border-l h-full flex items-center", dk ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-400")}><Calendar size={12}/></div>
                         </div>
                         <div className="relative w-[100px] ml-1 shrink-0">
                            <input type="number" disabled={hasBruttoInput} placeholder="0.00" value={draft.netto ?? ''} onChange={e => setDraft({ ...draft, netto: e.target.value, brutto: null })} className={cn(inputClass, "w-full disabled:opacity-30 text-left")} />
                            {(!showDiscount && !hasBruttoInput) && <button onClick={() => { setShowDiscount(true); if(!draft.discountType) setDraft({...draft, discountType: 'fixed'}); }} className="absolute right-1 top-[5px] p-1 text-slate-400 hover:text-teal-500 rounded"><Ticket size={12}/></button>}
                         </div>
                     </div>
                     {showDiscount && !hasBruttoInput && (
                         <div className="flex items-center w-[130px] animate-in fade-in slide-in-from-top-1 mt-1">
                            <input type="number" value={draft.discountValue ?? ''} onChange={e => setDraft({ ...draft, discountValue: e.target.value })} className={cn(inputClass, "rounded-r-none border-r-0 w-[65px] px-1.5 text-right placeholder:text-[10px]")} placeholder="Rabatt" />
                            <button onClick={() => setDraft({ ...draft, discountType: draft.discountType === 'percentage' ? 'fixed' : 'percentage' })} className={cn("w-[30px] h-[30px] border-y border-r text-[11px] font-bold transition-colors", dk ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 border-slate-200 text-slate-700")}>{draft.discountType === 'percentage' ? '%' : '€'}</button>
                            <button onClick={() => { setShowDiscount(false); setDraft({ ...draft, discountValue: null }); }} className={cn("w-[30px] h-[30px] rounded-r border-y border-r flex items-center justify-center transition-colors text-slate-400 hover:text-red-500", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}><X size={14}/></button>
                         </div>
                     )}
                     {calOpen && (
                         <div className={cn("absolute top-full right-0 mt-2 p-3 rounded-xl border shadow-2xl z-[9999] flex flex-col gap-3 w-[260px]", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                            <div className="flex items-center gap-2 w-full">
                                <div className="flex-1 flex flex-col gap-1">
                                   <label className="text-[9px] font-bold text-slate-500 uppercase">Start</label>
                                   <NativeDatePicker dk={dk} value={draft.startDate || defaultStart || ''} onChange={(s: string) => setDraft({ ...draft, startDate: s, nights: calculateNights(s, draft.endDate || defaultEnd || s) })} className="w-full h-[30px]" />
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                   <label className="text-[9px] font-bold text-slate-500 uppercase">End</label>
                                   <NativeDatePicker dk={dk} min={draft.startDate || defaultStart} value={draft.endDate || defaultEnd || ''} onChange={(end: string) => setDraft({ ...draft, endDate: end, nights: calculateNights(draft.startDate || defaultStart || end, end) })} className="w-full h-[30px]" />
                                </div>
                            </div>
                            <button onClick={() => setCalOpen(false)} className="w-full py-1.5 bg-teal-500 hover:bg-teal-600 transition-colors text-white text-[11px] font-bold rounded shadow-sm">OK</button>
                         </div>
                     )}
                 </div>
               ) : (
                 <span className="text-[10px] italic text-slate-400 opacity-50 px-2 w-full text-right h-[30px] flex items-center justify-end">--</span>
               )}
           </div>

           <div className="w-[100px] flex items-center justify-end shrink-0 relative">
               {draft.method === 'total' || !isPerBedAllowed ? (
                   <div className="flex flex-col items-end gap-1.5 w-full">
                       <div className="relative w-full">
                           <input type="number" disabled={hasBruttoInput} placeholder="Netto" value={draft.netto ?? ''} onChange={e => setDraft({ ...draft, netto: e.target.value, brutto: null })} className={cn(inputClass, "w-full disabled:opacity-30 pr-6 text-left")} />
                           {(!showDiscount && !hasBruttoInput) && <button onClick={() => { setShowDiscount(true); if(!draft.discountType) setDraft({...draft, discountType: 'fixed'}); }} className="absolute right-1 top-[5px] p-1 text-slate-400 hover:text-teal-500 rounded"><Ticket size={12}/></button>}
                       </div>
                       {showDiscount && !hasBruttoInput && (
                           <div className="flex items-center w-[130px] animate-in fade-in slide-in-from-top-1 mt-1">
                            <input type="number" value={draft.discountValue ?? ''} onChange={e => setDraft({ ...draft, discountValue: e.target.value })} className={cn(inputClass, "rounded-r-none border-r-0 w-[65px] px-1.5 text-right placeholder:text-[10px]")} placeholder="Rabatt" />
                            <button onClick={() => setDraft({ ...draft, discountType: draft.discountType === 'percentage' ? 'fixed' : 'percentage' })} className={cn("w-[30px] h-[30px] border-y border-r text-[11px] font-bold transition-colors", dk ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 border-slate-200 text-slate-700")}>{draft.discountType === 'percentage' ? '%' : '€'}</button>
                            <button onClick={() => { setShowDiscount(false); setDraft({ ...draft, discountValue: null }); }} className={cn("w-[30px] h-[30px] rounded-r border-y border-r flex items-center justify-center transition-colors text-slate-400 hover:text-red-500", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}><X size={14}/></button>
                         </div>
                       )}
                   </div>
               ) : (
                   <div className={cn("w-full flex items-center justify-end h-[30px] text-[13px] font-bold opacity-80")}>{formatCurrency(finalNetto)}</div>
               )}
           </div>

           {/* WIDTH FIX: Expanded MwSt to 75px */}
           <div className="w-[75px] shrink-0 px-2 relative z-[60]">
               <MwstInput value={draft.mwst} onChange={(v:any) => setDraft({ ...draft, mwst: v })} isDarkMode={dk} disabled={false} />
           </div>

           <div className="w-[110px] shrink-0 pr-2 text-right">
               <input type="number" disabled={hasNettoInput} placeholder={hasNettoInput ? formatCurrency(brutto) : "Brutto"} value={draft.brutto ?? ''} onChange={e => setDraft({ ...draft, brutto: e.target.value, netto: null })} className={cn(inputClass, "w-full text-left", hasNettoInput ? "disabled:opacity-100 disabled:bg-transparent disabled:border-transparent text-[13px] font-black px-1 placeholder-slate-900 dark:placeholder-white" : "")} />
           </div>

           {/* UX FIX: Removed Delete Button completely from Edit Mode. Replaced with clean Save/Cancel */}
           <div className="w-[75px] flex items-start justify-end gap-1.5 shrink-0">
              <button onClick={() => onSave(draft)} className="p-1.5 h-[30px] w-[32px] flex items-center justify-center text-white bg-teal-500 hover:bg-teal-600 rounded transition-all shadow-sm shrink-0"><Check size={14} strokeWidth={3}/></button>
              <button onClick={onCancel} className={cn("p-1.5 h-[30px] w-[32px] flex items-center justify-center rounded transition-all shadow-sm border shrink-0", dk ? "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white" : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900")}><X size={14} strokeWidth={3}/></button>
           </div>
        </div>
        
        {needsNote && (
           <div className="w-full mt-2 animate-in fade-in">
              <textarea rows={1} value={draft.note || ''} onChange={handleNoteChange} className={cn(inputClass, "w-full text-[11px] font-medium resize-none overflow-hidden placeholder-opacity-50 min-h-[30px]")} placeholder={lang === 'de' ? "Notiz (Optional)..." : "Note (Optional)..."} />
           </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-start px-3 py-3 border-b last:border-b-0 transition-colors group relative gap-2", dk ? "border-white/5 hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50/50")}>
       <div className="w-[220px] flex flex-col gap-0.5 shrink-0 pr-2">
          <div className={cn("text-[12px] font-black leading-tight", dk ? "text-slate-200" : "text-slate-800")}>
             {getTranslation(COST_TYPES, currentItem.type || 'room', lang)}
             {currentItem.method === 'per_bed' && <span className="text-[9.5px] font-bold text-slate-500 ml-1 tracking-normal font-sans">({activeNights} {lang==='de'?'Nächte':'Nights'}, {currentItem.beds||1} {lang==='de'?'Betten':'Beds'})</span>}
          </div>
          {(currentItem.startDate || currentItem.endDate || defaultStart || defaultEnd) && currentItem.method === 'per_bed' && (
             <span className="text-[10px] italic text-slate-400 mt-0.5 opacity-80">
                {formatShortDate(currentItem.startDate || defaultStart)} - {formatShortDate(currentItem.endDate || defaultEnd)}
             </span>
          )}
          {currentItem.note && (
             <span className="text-[11px] font-medium text-slate-500 italic mt-1 whitespace-pre-wrap leading-tight">{currentItem.note}</span>
          )}
       </div>

       <div className="flex-1 flex items-start justify-end pr-3">
          {currentItem.method === 'per_bed' ? (
             <span className={cn("text-[13px] font-bold pt-0.5", dk ? "text-slate-300" : "text-slate-700")}>{formatCurrency(parseFloat(currentItem.netto)||0)}</span>
          ) : (
             <span className="text-[11px] italic text-slate-400 opacity-50 w-[75px] text-right pt-0.5">--</span>
          )}
       </div>

       <div className="w-[100px] shrink-0 flex flex-col items-end">
          <span className={cn("text-[13px] font-bold pt-0.5", dk ? "text-slate-300" : "text-slate-700")}>
             {hasBruttoInput ? (lang === 'de' ? 'Auto' : 'Auto') : formatCurrency(finalNetto)}
          </span>
          {currentItem.discountValue > 0 && !hasBruttoInput && <span className="text-[9px] font-black text-teal-500 leading-none mt-1 border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.5 rounded">-{currentItem.discountType === 'percentage' ? `${currentItem.discountValue}%` : `${currentItem.discountValue}€`}</span>}
       </div>

       <div className="w-[75px] shrink-0 pt-0.5 text-center px-2">
          <span className={cn("text-[13px] font-bold", dk ? "text-slate-400" : "text-slate-500")}>{currentItem.mwst ?? 7}%</span>
       </div>

       <div className="w-[110px] shrink-0 pt-0.5 pr-2 text-right">
          <span className={cn("text-[13px] font-black", dk ? "text-white" : "text-slate-900")}>
             {hasNettoInput ? formatCurrency(brutto) : formatCurrency(parseFloat(currentItem.brutto)||0)}
          </span>
       </div>

       {confirmDelete ? (
           /* FIX: Absolute overlay, solid background, whitespace-nowrap */
           <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 p-1.5 rounded-lg shadow-xl border animate-in fade-in slide-in-from-right-2 z-50", dk ? "bg-slate-800 border-red-500/30" : "bg-white border-red-200")}>
              <span className="text-[11px] font-black text-red-500 px-2 whitespace-nowrap">{lang === 'de' ? 'Zeile löschen?' : 'Delete row?'}</span>
              <button onClick={onDelete} className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded shadow-sm transition-colors"><Check size={14} strokeWidth={3}/></button>
              <button onClick={() => setConfirmDelete(false)} className={cn("p-1.5 rounded transition-colors shadow-sm", dk ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}><X size={14} strokeWidth={3}/></button>
           </div>
       ) : (
           <div className="w-[75px] flex items-start justify-end opacity-0 group-hover:opacity-100 transition-opacity pt-0.5 shrink-0 gap-1">
              {!viewOnly && <button onClick={onEdit} className="p-1.5 rounded text-slate-400 hover:text-teal-500 bg-black/5 dark:bg-white/5 transition-colors"><Edit3 size={14}/></button>}
              {!viewOnly && <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded text-slate-400 hover:text-red-500 bg-black/5 dark:bg-white/5 transition-colors"><Trash2 size={14}/></button>}
           </div>
       )}
    </div>
  )
}

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

export function MwstInput({ value, onChange, isDarkMode, disabled }: { value: string | null, onChange: (v: string | null) => void, isDarkMode: boolean, disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', handle); return () => document.removeEventListener('mousedown', handle); }, []);
  return (
    <div ref={ref} className="relative flex items-center h-[30px]">
      <input type="number" disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : e.target.value)} className={cn('w-12 px-1 rounded-l-lg text-[12px] font-bold outline-none border transition-all h-full text-center', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', disabled && "opacity-50 cursor-not-allowed")} placeholder="--" />
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('px-1 h-full rounded-r-lg border border-l-0 transition-all flex items-center justify-center', isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100', disabled && "hidden")}><ChevronDown size={12} /></button>
      {open && !disabled && (
        <div className={cn("absolute top-full right-0 mt-1 w-20 z-[9999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-2 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button>)}
        </div>
      )}
    </div>
  );
}

export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select', allowAdd = true, disabled, onOpenChange }: any) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  
  // FIX: Tells HotelRow to lock z-index when this menu opens
  useEffect(() => { if (onOpenChange) onOpenChange(open); }, [open, onOpenChange]);
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

export function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange, onDeleteOption, onRenameOption, onAddOption, disabled, searchQuery, onOpenChange }: any) {
  const [open, setOpen] = useState(false);
  
  useEffect(() => { if (onOpenChange) onOpenChange(open); }, [open, onOpenChange]);

  const [query, setQuery] = useState('');
  const [localMemory, setLocalMemory] = useState<string[]>([]);
  
  const [editingOpt, setEditingOpt] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [confirmDeleteOpt, setConfirmDeleteOpt] = useState<string | null>(null);
  
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handle(e: any) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); setEditingOpt(null); setConfirmDeleteOpt(null); } } document.addEventListener('mousedown', handle); return () => document.removeEventListener('mousedown', handle); }, []);

  const handleInlineRename = (oldName: string) => {
      const val = editVal.trim();
      if (val && val !== oldName) {
         if (onRenameOption) {
             onRenameOption(oldName, val);
         } else {
             if (safeSelected.includes(oldName)) onChange([...safeSelected.filter((t:any) => t !== oldName), val]);
         }
         setLocalMemory(prev => [...prev.filter(m => m !== oldName), val]);
      }
      setEditingOpt(null);
  };

  const handleInlineDelete = (opt: string) => {
      if (onDeleteOption) {
          onDeleteOption(opt);
      } else {
          if (safeSelected.includes(opt)) onChange(safeSelected.filter((t:any) => t !== opt));
      }
      setLocalMemory(prev => prev.filter(m => m !== opt));
      setConfirmDeleteOpt(null);
  };
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
            <input autoFocus autoComplete="new-password" spellCheck="false" name={Math.random().toString()} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("ml-2 bg-transparent text-sm font-bold outline-none w-full", isDarkMode ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400")} />
          </div>
          <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
            {query.trim() && !exactMatchExists && !isAlreadySelected && (
              <button onClick={handleAddNew} className={cn('w-full text-left px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all', isDarkMode ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-teal-50')}><span className="opacity-70 text-xs">Create</span> "{query.trim()}"</button>
            )}
            {filteredOptions.map((opt: string) => {
              const isSelected = safeSelected.includes(opt);
              return (
                <div key={opt} className={cn('w-full flex items-center justify-between group transition-all', isSelected ? (isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50') : (isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'))}>
                  {editingOpt === opt ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 animate-in fade-in" onClick={e => e.stopPropagation()}>
                       <input autoFocus autoComplete="new-password" spellCheck="false" name={Math.random().toString()} value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleInlineRename(opt); else if (e.key === 'Escape') setEditingOpt(null); }} className="flex-1 bg-transparent border-b-2 border-teal-500 outline-none text-[13px] font-black text-teal-600 dark:text-teal-400 py-0.5" />
                       <button onClick={() => handleInlineRename(opt)} className="p-1 text-white bg-teal-500 hover:bg-teal-600 rounded shadow-sm transition-colors"><Check size={12} strokeWidth={3}/></button>
                       <button onClick={() => setEditingOpt(null)} className="p-1 text-slate-500 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded transition-colors"><X size={12} strokeWidth={3}/></button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => handleToggle(opt)} className="flex-1 text-left px-4 py-2 text-sm font-bold flex items-center gap-2">
                        <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border", isSelected ? "bg-teal-500 border-teal-500" : isDarkMode ? "border-slate-500" : "border-slate-400")}>{isSelected && <Check size={10} className="text-white" strokeWidth={4} />}</div>
                        <span className={cn(isSelected ? (isDarkMode ? 'text-teal-400' : 'text-teal-700') : (isDarkMode ? 'text-slate-300' : 'text-slate-700'))}>{opt}</span>
                      </button>
                      
                      {confirmDeleteOpt === opt ? (
                         <div className="flex items-center gap-1 pr-3 animate-in fade-in" onClick={e => e.stopPropagation()}>
                            <span className="text-[10px] font-black text-red-500 uppercase mr-1">{lang === 'de' ? 'Sicher?' : 'Sure?'}</span>
                            <button onClick={() => handleInlineDelete(opt)} className="p-1 text-white bg-red-500 hover:bg-red-600 rounded shadow-sm transition-colors"><Check size={12} strokeWidth={3}/></button>
                            <button onClick={() => setConfirmDeleteOpt(null)} className="p-1 text-slate-600 bg-slate-200 hover:bg-slate-300 rounded transition-colors"><X size={12} strokeWidth={3}/></button>
                         </div>
                      ) : (
                         <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2" onClick={e => e.stopPropagation()}>
                           <button onClick={() => { setEditingOpt(opt); setEditVal(opt); setConfirmDeleteOpt(null); }} className="p-1.5 text-slate-400 hover:text-teal-500 transition-colors" title="Rename"><Edit3 size={14}/></button>
                           {onDeleteOption && (<button onClick={() => { setConfirmDeleteOpt(opt); setEditingOpt(null); }} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete from system"><Trash2 size={14} /></button>)}
                         </div>
                      )}
                    </>
                  )}
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

export function MonthFilterDropdown({ selectedMonth, localMonthFilter, setLocalMonthFilter, selectedYear, monthOptions, lang, dk, disabled }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const currentVal = selectedMonth !== null ? selectedMonth : localMonthFilter;
  const displayStr = currentVal === 'all' ? (lang === 'de' ? 'Alle Monate' : 'All Months') : monthOptions[currentVal as number];

  return (
    <div ref={ref} className="relative">
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn("flex items-center px-2 py-1.5 rounded-lg border w-max transition-all shadow-sm outline-none", dk ? "bg-black/40 border-white/10 hover:border-white/30" : "bg-white border-slate-200 hover:border-slate-300", disabled && "opacity-50 cursor-not-allowed")}>
         <span className={cn("text-[12px] font-black border-r pr-2 mr-2", dk ? "text-teal-400 border-white/10" : "text-teal-600 border-slate-200")}>{selectedYear || new Date().getFullYear()}</span>
         <Filter size={14} className={cn("mr-1.5", dk ? "text-slate-500" : "text-slate-400")}/>
         <span className={cn("text-[11px] font-black uppercase tracking-wide pr-2", dk ? "text-white" : "text-slate-700")}>{displayStr}</span>
         <ChevronDown size={12} className={dk ? "text-slate-500" : "text-slate-400"}/>
      </button>
      {open && !disabled && (
        <div className={cn("absolute top-full left-0 mt-2 w-[220px] z-[200] rounded-2xl border shadow-2xl p-2 overflow-hidden animate-in fade-in slide-in-from-top-2", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
           <div className="flex flex-col gap-1">
             <button onClick={() => { setLocalMonthFilter('all'); setOpen(false); }} className={cn("w-full text-center px-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", currentVal === 'all' ? (dk ? "bg-teal-500/20 text-teal-400" : "bg-teal-50 text-teal-600") : (dk ? "bg-white/5 text-slate-300 hover:bg-white/10" : "bg-slate-100 text-slate-700 hover:bg-slate-200"))}>
                {lang === 'de' ? 'Alle Monate' : 'All Months'}
             </button>
             <div className="grid grid-cols-3 gap-1 mt-1">
               {monthOptions.map((m: string, idx: number) => (
                 <button key={idx} onClick={() => { setLocalMonthFilter(idx); setOpen(false); }} className={cn("w-full text-center py-2.5 rounded-xl text-[11px] font-black uppercase transition-all border", currentVal === idx ? (dk ? "bg-teal-500/20 border-teal-500/30 text-teal-400 shadow-inner" : "bg-teal-50 border-teal-200 text-teal-600 shadow-inner") : (dk ? "border-transparent bg-transparent text-slate-400 hover:bg-white/5 hover:text-white" : "border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"))}>
                    {m}
                 </button>
               ))}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', searchScope = 'all', selectedMonth = null, selectedYear = null, companyOptions = [], cityOptions = [], hotelOptions = [], employeeOptions = [], onDelete, onUpdate, onDeleteCompanyOption, onRenameCompanyOption, onAddOption, viewOnly, isSelected = false, onSelect = () => {}, isBulkActive = false, isOpen = false, onToggle = () => {}, showGlobalFinancials = false, activeSort = 'created_at', activeFilterDue, activeFilterDeposit }: any) {
 const [activeTab, setActiveTab] = useState<'bookings'|'billing'|'info'>('bookings');
  
  const [showNotes, setShowNotes] = useState(false);
  const [editingOBrutto, setEditingOBrutto] = useState(false);
  const [editBruttoValue, setEditBruttoValue] = useState('');
  const [editingPriceBed, setEditingPriceBed] = useState(false);
  const [editPriceBedValue, setEditPriceBedValue] = useState('');
  
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState<any>(null);
  const totalRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
      function handleTotalClick(e: MouseEvent) {
          if (editingTotal && totalRef.current && !totalRef.current.contains(e.target as Node)) {
              setEditingTotal(false);
          }
      }
      function handleTotalKey(e: KeyboardEvent) {
          if (editingTotal && e.key === 'Escape') setEditingTotal(false);
      }
      document.addEventListener('mousedown', handleTotalClick);
      document.addEventListener('keydown', handleTotalKey);
      return () => { document.removeEventListener('mousedown', handleTotalClick); document.removeEventListener('keydown', handleTotalKey); }
  }, [editingTotal]);

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

  const [isRowFocused, setIsRowFocused] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [isDropdownActive, setIsDropdownActive] = useState(false);

  useEffect(() => {
     setLocalHotel((prev: any) => {
        const newTags = entry.companyTag || entry.company_tag || [];
        if (JSON.stringify(prev.companyTag) !== JSON.stringify(newTags)) {
           return { ...prev, companyTag: newTags };
        }
        return prev;
     });
  }, [entry.companyTag, entry.company_tag]);

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

    filtered = filtered.filter((inv:any) => {
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (d.getFullYear() !== (selectedYear || new Date().getFullYear())) return false;
        if (activeMonthFilter !== 'all') {
            return d.getMonth() === activeMonthFilter;
        }
        return true;
    });

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
    let nearestDueDate: string | null = null;

    (localHotel.durations || []).forEach((d: any) => {
      const nights = calculateNights(d.startDate, d.endDate);
      (d.roomCards || []).forEach((c: any) => {
         const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
         tBeds += b;
         allEmps.push(...(c.employees || []));
      });
      tFree += calcDurationFreeBeds(d, today);
    });

    const invoicesToScan = activeInvoice ? [activeInvoice] : filteredMasterInvoices;

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
       else {
          totalUnpaid += invBrutto;
          if (inv.dueDate) {
             if (!nearestDueDate || new Date(inv.dueDate) < new Date(nearestDueDate)) {
                 nearestDueDate = inv.dueDate;
             }
          }
       }
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
      nearestDueDate,
      isOverriddenBrutto: localHotel.override_total_brutto != null, 
      isOverriddenBed,
      isMasterActive: false
    };
  }, [localHotel, activeInvoice, filteredMasterInvoices, activeMonthFilter]);

  const sortedEmployees = useMemo(() => {
     const emps = [...masterMath.employees];
     emps.sort((a, b) => {
        const statusWeight = (status: string) => status === 'active' ? 1 : status === 'ending-soon' ? 2 : status === 'upcoming' ? 3 : 4;
        return statusWeight(getEmployeeStatus(a.checkIn, a.checkOut)) - statusWeight(getEmployeeStatus(b.checkIn, b.checkOut));
     });
     return emps;
  }, [masterMath.employees]);
  const visibleEmps = sortedEmployees.slice(0, 12);
  const hiddenEmps = sortedEmployees.slice(12);

  const sortedDurations = useMemo(() => {
     const durs = [...(localHotel.durations || [])];
     durs.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
     return durs;
  }, [localHotel.durations]);
  const visibleDurs = sortedDurations.slice(0, 6);
  const hiddenDurs = sortedDurations.slice(6);

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
    <div 
       className="space-y-1 relative" 
       style={{ zIndex: isDropdownActive ? 99999 : (isRowHovered || isRowFocused ? 999 : 40 - ((index || 0) % 30)) }}
       onMouseEnter={() => setIsRowHovered(true)}
       onMouseLeave={() => setIsRowHovered(false)}
       onFocus={() => setIsRowFocused(true)}
       onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsRowFocused(false); }}
    >
      
      {/* FIX: Hide selector entirely for viewers */}
      {!viewOnly && (
        <div className={cn("absolute -left-7 top-0 bottom-0 w-10 flex items-center justify-center transition-all duration-300 z-[100]", isSelected || isBulkActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 hover:opacity-100")}>
          <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); onSelect(); }} className="w-4 h-4 rounded border-slate-300 accent-teal-600 cursor-pointer shadow-sm transition-transform active:scale-90" />
        </div>
      )}

      <div className={cn('rounded-xl border transition-all duration-200 shadow-sm relative overflow-visible', isSelected ? (dk ? 'bg-teal-500/10 border-teal-500/50' : 'bg-teal-50 border-teal-500/40') : (dk ? 'bg-[#1E293B] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300'))}>  
        <div className={cn("absolute right-0 top-0 bottom-0 w-[4px] rounded-r-xl transition-colors z-[60]", masterMath.totalUnpaid > 0 ? "bg-red-500" : (masterMath.totalPaid > 0 ? "bg-emerald-500" : "bg-transparent border-l border-slate-200 dark:border-white/10"))} />

        <div className={cn('flex items-center cursor-pointer py-1 px-2 pr-2 group', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', isOpen && 'border-b', isOpen && (dk ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'))} onClick={onToggle}>
          
          <div className="flex items-center justify-center w-10 shrink-0">
            {isOpen ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          <div className="w-[200px] shrink-0 pr-4 flex flex-col justify-center relative">
            <SeamlessInput disabled={viewOnly} value={localHotel.name} options={hotelOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ name: val })} placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel Name...'} textClass={cn('text-[14px] font-black leading-tight', dk ? 'text-white' : 'text-slate-900')} searchQuery={searchScope === 'all' || searchScope === 'hotel' ? searchQuery : ''} />
            <SeamlessInput disabled={viewOnly} value={localHotel.city} options={cityOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ city: val })} placeholder={lang === 'de' ? 'Stadt...' : 'City...'} className="mt-0.5" textClass={cn("text-[10px] font-bold uppercase tracking-widest gap-1.5", dk ? "text-slate-500" : "text-slate-400")} searchQuery={searchScope === 'all' || searchScope === 'city' ? searchQuery : ''} />
            {hiddenMatchText && (
               <button onClick={(e) => { e.stopPropagation(); if (!isOpen) onToggle(); setActiveTab('billing'); }} className="mt-1.5 w-max flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 text-[9px] font-black uppercase tracking-tighter hover:bg-teal-500/20 transition-colors cursor-pointer shadow-sm">
                  <Search size={8} strokeWidth={3} /> {hiddenMatchText}
               </button>
            )}
          </div>
          

          <div className="w-[120px] shrink-0 pr-2" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect 
            onOpenChange={setIsDropdownActive}
            disabled={viewOnly}
            selected={localHotel.companyTag} 
            options={companyOptions} 
            isDarkMode={dk} 
            lang={lang} 
            onChange={(tags:any) => patchHotel({ companyTag: tags })} 
            onDeleteOption={onDeleteCompanyOption}
            onRenameOption={onRenameCompanyOption} 
            onAddOption={onAddOption}
            searchQuery={searchScope === 'all' || searchScope === 'company' ? searchQuery : ''} 
          />
          </div>

          <div className="w-[380px] shrink-0 pr-2 flex flex-wrap gap-1.5 content-center items-center">
              {visibleDurs.map((d: any, i: number) => {
                const title = `${calculateNights(d.startDate, d.endDate)} N, ${(d.roomCards || []).length} Rooms`;
                const formatChipStr = (iso: string) => {
                    if (!iso) return '';
                    const date = new Date(iso);
                    const locale = lang === 'de' ? 'de-DE' : 'en-GB';
                    return `${date.getDate().toString().padStart(2, '0')} ${date.toLocaleString(locale, { month: 'short' }).replace('.', '')}`;
                };
                return (
                  <button key={d.id} title={title} onClick={(e) => { 
                      e.stopPropagation(); if (!isOpen) onToggle(); setActiveTab('bookings'); 
                      const trueIdx = localHotel.durations.findIndex((dur:any) => dur.id === d.id);
                      setActiveDurationTab(trueIdx >= 0 ? trueIdx : 0); 
                  }} className={cn('flex-1 min-w-[100px] max-w-[105px] px-1 py-0.5 rounded text-[10px] font-bold border truncate text-center shadow-sm hover:ring-1 ring-teal-500/30 transition-all', dk ? 'bg-[#0F172A] border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')}>
                    {d.startDate && d.endDate ? `${formatChipStr(d.startDate)} - ${formatChipStr(d.endDate)}` : 'New'}
                  </button>
                )
              })}
              {hiddenDurs.length > 0 && (
                 <div className="relative group/hiddenDur" onMouseEnter={() => setIsDropdownActive(true)} onMouseLeave={() => setIsDropdownActive(false)}>
                    <span className="px-2 py-0.5 rounded-full border border-dashed border-slate-400 text-[10px] font-bold flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">+{hiddenDurs.length}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-max max-w-[280px] opacity-0 group-hover/hiddenDur:opacity-100 transition-opacity pointer-events-none group-hover/hiddenDur:pointer-events-auto" style={{ zIndex: 999999 }}>
                        <div className="p-2 bg-slate-800 text-white rounded-lg shadow-xl flex flex-wrap gap-1.5">
                            {hiddenDurs.map((d: any) => {
                                const trueIdx = localHotel.durations.findIndex((dur:any) => dur.id === d.id);
                                const formatChipStr = (iso: string) => {
                                    if (!iso) return '';
                                    const date = new Date(iso);
                                    const locale = lang === 'de' ? 'de-DE' : 'en-GB';
                                    return `${date.getDate().toString().padStart(2, '0')} ${date.toLocaleString(locale, { month: 'short' }).replace('.', '')}`;
                                };
                                return (
                                    <button key={d.id} onClick={(e) => { 
                                        e.stopPropagation(); if (!isOpen) onToggle(); setActiveTab('bookings'); setActiveDurationTab(trueIdx >= 0 ? trueIdx : 0); 
                                    }} className="px-2 py-0.5 rounded text-[10px] font-bold border truncate text-center shadow-sm hover:ring-1 ring-teal-500/30 transition-all bg-slate-700 border-white/10 text-white hover:bg-slate-600">
                                    {d.startDate && d.endDate ? `${formatChipStr(d.startDate)} - ${formatChipStr(d.endDate)}` : 'New'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                 </div>
              )}
          </div>

          <div className="flex-1 min-w-[200px] flex flex-wrap gap-1.5 pr-4 content-center">
              {visibleEmps.map((emp: any, empIdx: number) => {
                const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                const borderCls = status === 'active' ? "border-emerald-500/50" : status === 'upcoming' ? "border-blue-500/50" : status === 'ending-soon' ? "border-red-500/50" : "border-slate-500/40";
                const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                const shortName = emp.name ? emp.name.trim().split(' ').pop() : '_ _ _';
                
                const parentDur = localHotel.durations.find((d:any) => (d.roomCards||[]).some((rc:any) => (rc.employees||[]).some((e:any) => e.id === emp.id)));
                const parentRc = parentDur?.roomCards?.find((rc:any) => (rc.employees||[]).some((e:any) => e.id === emp.id));
                const empsInSlot = (parentRc?.employees || []).filter((e:any) => e.slotIndex === emp.slotIndex);
                empsInSlot.sort((a:any, b:any) => new Date(a.checkIn||0).getTime() - new Date(b.checkIn||0).getTime());
                const isSubstitute = empsInSlot.length > 1 && empsInSlot[0].id !== emp.id;
                
                let isPartial = false;
                if (parentDur && (emp.checkIn > parentDur.startDate || emp.checkOut < parentDur.endDate)) isPartial = true;
                
                return (
                <React.Fragment key={emp.id}>
                  <div className="relative group/emp">
                      <button onClick={(e) => { 
                          e.stopPropagation(); if (!isOpen) onToggle(); setActiveTab('bookings'); 
                          const findEmpTab = () => {
                             for (let i = 0; i < localHotel.durations.length; i++) {
                                if ((localHotel.durations[i].roomCards || []).some((rc:any) => (rc.employees || []).some((ex:any) => ex.id === emp.id))) return i;
                             } return 0;
                          };
                          setActiveDurationTab(findEmpTab());
                          setTimeout(() => { 
                             window.dispatchEvent(new CustomEvent('open-emp-slot', { detail: emp.id }));
                          }, 300);
                      }} 
                        className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:opacity-80 transition-opacity", borderCls, isPartial ? "border-dashed" : "border-solid", dk ? "bg-[#1E293B] text-slate-200" : "bg-slate-50 text-slate-700")}>
                        {isSubstitute ? <CornerDownRight size={10} className={cn("shrink-0", status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400')} /> : <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />}
                        <HighlightText text={shortName} query={searchScope === 'all' || searchScope === 'employee' ? searchQuery : ''} />
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 w-max z-[999999] opacity-0 group-hover/emp:opacity-100 transition-opacity pointer-events-none">
                          <div className="px-3 py-2 bg-slate-800 text-white rounded-lg shadow-xl text-center">
                              <p className="text-xs font-bold">{emp.name}</p>
                              <p className="text-[10px] text-slate-300">{formatShortDate(emp.checkIn, lang)} ➔ {formatShortDate(emp.checkOut, lang)} ({calculateNights(emp.checkIn||'', emp.checkOut||'')}N)</p>
                          </div>
                      </div>
                  </div>
                  {empIdx === 6 && <div className="basis-full h-0" />}
                </React.Fragment>
                );
              })}
              
              {hiddenEmps.length > 0 && (
                 <div className="relative group/hiddenEmp" onMouseEnter={() => setIsDropdownActive(true)} onMouseLeave={() => setIsDropdownActive(false)}>
                    <span className="px-2 py-0.5 rounded-full border border-dashed border-slate-400 text-[10px] font-bold flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">+{hiddenEmps.length}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-max max-w-[280px] z-[999999] opacity-0 group-hover/hiddenEmp:opacity-100 transition-opacity pointer-events-none group-hover/hiddenEmp:pointer-events-auto">
                        <div className="p-2 bg-slate-800 text-white rounded-lg shadow-xl flex flex-wrap gap-1.5">
                            {hiddenEmps.map((emp: any) => {
                                const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                                const borderCls = status === 'active' ? "border-emerald-500/50" : status === 'upcoming' ? "border-blue-500/50" : status === 'ending-soon' ? "border-red-500/50" : "border-slate-500/40";
                                const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                                
                                const parentDur = localHotel.durations.find((d:any) => (d.roomCards||[]).some((rc:any) => (rc.employees||[]).some((e:any) => e.id === emp.id)));
                                const parentRc = parentDur?.roomCards?.find((rc:any) => (rc.employees||[]).some((e:any) => e.id === emp.id));
                                const empsInSlot = (parentRc?.employees || []).filter((e:any) => e.slotIndex === emp.slotIndex);
                                empsInSlot.sort((a:any, b:any) => new Date(a.checkIn||0).getTime() - new Date(b.checkIn||0).getTime());
                                const isSubstitute = empsInSlot.length > 1 && empsInSlot[0].id !== emp.id;
                                
                                let isPartial = false;
                                if (parentDur && (emp.checkIn > parentDur.startDate || emp.checkOut < parentDur.endDate)) isPartial = true;
                                
                                return (
                                    <button key={emp.id} onClick={(e) => { 
                                        e.stopPropagation(); if (!isOpen) onToggle(); setActiveTab('bookings'); 
                                        const findEmpTab = () => {
                                           for (let i = 0; i < localHotel.durations.length; i++) {
                                              if ((localHotel.durations[i].roomCards || []).some((rc:any) => (rc.employees || []).some((ex:any) => ex.id === emp.id))) return i;
                                           } return 0;
                                        };
                                        setActiveDurationTab(findEmpTab());
                                        setTimeout(() => { 
                                           window.dispatchEvent(new CustomEvent('open-emp-slot', { detail: emp.id }));
                                        }, 300);
                                    }} 
                                    className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:opacity-80 transition-opacity", borderCls, isPartial ? "border-dashed" : "border-solid", "bg-slate-700 text-white hover:bg-slate-600")}>
                                    {isSubstitute ? <CornerDownRight size={10} className={cn("shrink-0", status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400')} /> : <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />}
                                    {emp.name?.trim().split(' ').pop()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                 </div>
              )}
          </div>
          
          <div className="w-12 shrink-0 text-center">
            <p className={cn('text-xl font-black', masterMath.freeBeds > 0 ? 'text-red-500' : dk ? 'text-teal-500' : 'text-teal-600')}>{masterMath.freeBeds}</p>
          </div>
          
          <div className="w-12 shrink-0 text-center">
            <p className={cn('text-xl font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{masterMath.totalBeds}</p>
          </div>
        
          <div className="w-[120px] shrink-0 flex flex-col items-end justify-center pr-4 relative border-r dark:border-white/10 border-slate-200">
            <div className={cn('font-black leading-none text-right', selectedMonth !== null ? 'text-md' : 'text-lg', dk ? 'text-white' : 'text-slate-900')}>
              {formatCurrency(masterMath.displayBrutto)}
            </div>
            
            {showGlobalFinancials && (
               <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] font-bold">
                  <span className="text-emerald-500">{formatCurrency(masterMath.totalPaid)}</span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-red-500">{formatCurrency(masterMath.totalUnpaid)}</span>
               </div>
            )}

            {!showGlobalFinancials && (activeSort === 'payment_due' || (activeFilterDue && activeFilterDue !== 'all')) && masterMath.nearestDueDate && (
               <div className="text-[9px] font-bold text-red-500 mt-1 uppercase tracking-wider">
                  {lang === 'de' ? 'Fällig: ' : 'Due: '} {formatShortDate(masterMath.nearestDueDate)}
               </div>
            )}

            {!showGlobalFinancials && activeFilterDeposit === 'yes' && localHotel.depositEnabled && (
               <div className="text-[9px] font-bold text-amber-500 mt-1 uppercase tracking-wider">
                  {lang === 'de' ? 'Kaution: ' : 'Deposit: '} {formatCurrency(parseFloat(localHotel.depositAmount || '0'))}
               </div>
            )}
            
            {!showGlobalFinancials && activeSort === 'bed_price' && masterMath.pricePerBed > 0 && (
               <div className="text-[12px] font-bold text-slate-500 mt-1">
                  {formatCurrency(masterMath.pricePerBed)} / {lang === 'de' ? 'Bett' : 'Bed'}
               </div>
            )}
            
            {/* FIX: Always show Total Paid when sorting by it, even if 0 */}
            {!showGlobalFinancials && activeSort === 'total_paid' && (
               <div className="text-[12px] font-bold text-emerald-500 mt-1">
                  {formatCurrency(masterMath.totalPaid)}
               </div>
            )}
          </div>

          <div className="w-8 shrink-0 flex flex-col items-center justify-center gap-0.5 pl-2">
               <button onClick={handleBookmarkToggle} className={cn("p-0.5 rounded transition-colors", isBookmarked ? "text-yellow-500" : "text-slate-400 hover:text-slate-800 dark:hover:text-white")}><Star size={12} className={isBookmarked ? "fill-yellow-500" : ""} /></button>
               <div className="relative group/time">
                  <button onClick={(e) => e.stopPropagation()} className="p-0.5 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><Clock size={12} /></button>
                  <div className={cn("absolute right-full mr-2 top-1/2 -translate-y-1/2 w-max px-2 py-1 text-[9px] font-bold rounded opacity-0 group-hover/time:opacity-100 z-[99999] whitespace-nowrap pointer-events-none shadow-xl border", dk ? "bg-slate-800 text-white border-white/10" : "bg-white text-slate-700 border-slate-200")}>{formatLastUpdated(localHotel.last_updated_by || localHotel.lastUpdatedBy, localHotel.last_updated_at || localHotel.lastUpdatedAt, lang)}</div>
               </div>
               {!viewOnly && (
                 <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-0.5 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
               )}
          </div>
        </div>
                  
        {isOpen && (
          <div className={cn('rounded-b-2xl border-t shadow-inner flex flex-col', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50 border-slate-200')} onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center px-4 pt-2 gap-2 border-b border-slate-200 dark:border-white/10">
               <button onClick={() => setActiveTab('bookings')} className={cn("px-5 py-2.5 text-sm font-bold transition-all border-b-2", activeTab === 'bookings' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300")}>{lang === 'de' ? 'Buchungszeiträume' : 'Booking Periods'}</button>
               <button onClick={() => setActiveTab('billing')} className={cn("px-5 py-2.5 text-sm font-bold transition-all border-b-2", activeTab === 'billing' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300")}>{lang === 'de' ? 'Abrechnung & Rechnungen' : 'Billing & Invoice'}</button>
               <button onClick={() => setActiveTab('info')} className={cn("px-5 py-2.5 text-sm font-bold transition-all border-b-2", activeTab === 'info' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300")}>{lang === 'de' ? 'Hotel Info' : 'Hotel Info'}</button>
            </div>

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

            {activeTab === 'billing' && (
              <div className="flex flex-col xl:flex-row bg-white dark:bg-transparent rounded-b-2xl animate-in fade-in">
                <div className={cn("w-full xl:w-[280px] shrink-0 p-4 flex flex-col gap-3 border-b xl:border-b-0 xl:border-r transition-colors", dk ? "border-white/10 bg-[#0F172A]/80" : "border-slate-200 bg-slate-50")}>
                    <div className="flex items-center justify-between mb-2">
                       <label className={labelCls}><Receipt size={14}/> {lang === 'de' ? 'Rechnungen' : 'Invoices'}</label>
                       <div className="flex items-center gap-2">
                           {totalInvs > 0 && (
                             <div className={cn("flex items-center rounded-lg border shadow-sm overflow-hidden", dk ? "bg-black/40 border-white/10" : "bg-white border-slate-200")}>
                               <button onClick={() => setInvoiceFilter('all')} className={cn("flex items-center gap-1.5 text-[11px] font-black transition-colors px-2 py-1", invoiceFilter === 'all' ? (dk ? "bg-white/10 text-white" : "bg-slate-100 text-slate-800") : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")} title="All"><FileText size={11} className={invoiceFilter === 'all' ? "opacity-100" : "opacity-60"} /> {totalInvs}</button>
                               <div className={cn("w-px h-3.5", dk ? "bg-white/10" : "bg-slate-200")} />
                               <button onClick={() => setInvoiceFilter('paid')} className={cn("flex items-center gap-1 text-[11px] font-black transition-colors px-2 py-1", invoiceFilter === 'paid' ? (dk ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600") : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50")}><span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" /> {paidInvs}</button>
                               <div className={cn("w-px h-3.5", dk ? "bg-white/10" : "bg-slate-200")} />
                               <button onClick={() => setInvoiceFilter('unpaid')} className={cn("flex items-center gap-1 text-[11px] font-black transition-colors px-2 py-1", invoiceFilter === 'unpaid' ? (dk ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600") : "text-slate-400 hover:text-red-500 hover:bg-red-50/50")}><span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" /> {unpaidInvs}</button>
                             </div>
                           )}
                           {!viewOnly && (
                             <button onClick={() => {
                                 const newId = Math.random().toString();
                                 const newDraft = { id: newId, number: '', note: '', isPaid: false, billingMode: 'detailed', items: [], startDate: null, endDate: null, dueDate: null, paymentDate: null };
                                 setInvoiceDraft(newDraft); setEditingInvoiceId(newId); setSelectedInvoiceId(newId);
                             }} className="p-1.5 rounded-md text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/20 transition-all shrink-0"><Plus size={14} strokeWidth={3} /></button>
                           )}
                       </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px] no-scrollbar">
                       {editingInvoiceId && invoiceDraft && !localHotel.invoices.find((i:any) => i.id === editingInvoiceId) && (
                          <div className={cn("group relative flex flex-col gap-2 p-3 rounded-xl transition-all border shadow-md", dk ? "bg-teal-900/30 border-teal-500/50" : "bg-teal-50 border-teal-300")}>
                             <input autoFocus value={invoiceDraft.number} onChange={e => setInvoiceDraft({...invoiceDraft, number: e.target.value})} className="w-full text-[13px] font-black border-none bg-transparent outline-none p-0 focus:ring-0 placeholder:text-slate-400" placeholder="RE-..." />
                             
                             <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 flex flex-col gap-0.5">
                                   <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Start' : 'Start'}</label>
                                   <NativeDatePicker dk={dk} value={invoiceDraft.startDate || ''} onChange={(s: string) => setInvoiceDraft({...invoiceDraft, startDate: s})} className="w-full h-[28px]" />
                                </div>
                                <div className="flex-1 flex flex-col gap-0.5">
                                   <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Ende' : 'End'}</label>
                                   <NativeDatePicker dk={dk} disabled={!invoiceDraft.startDate} min={invoiceDraft.startDate} value={invoiceDraft.endDate || ''} onChange={(end: string) => setInvoiceDraft({...invoiceDraft, endDate: end})} className="w-full h-[28px]" />
                                </div>
                             </div>

                             <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 flex flex-col gap-0.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Fällig am:' : 'Payment Due:'}</label>
                                    <NativeDatePicker dk={dk} value={invoiceDraft.dueDate || ''} onChange={(due: string) => setInvoiceDraft({...invoiceDraft, dueDate: due})} className="w-full h-[28px]" />
                                </div>
                                {invoiceDraft.isPaid && (
                                   <div className="flex-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-right-2">
                                      <label className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Bezahlt am:' : 'Paid On:'}</label>
                                      <NativeDatePicker dk={dk} value={invoiceDraft.paymentDate || ''} onChange={(pd: string) => setInvoiceDraft({...invoiceDraft, paymentDate: pd})} className="w-full h-[28px] [&>div]:border-emerald-500 [&>div]:text-emerald-600 dark:[&>div]:text-emerald-400" />
                                   </div>
                                )}
                             </div>

                             <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-200 dark:border-white/10">
                                <button onClick={() => setInvoiceDraft({...invoiceDraft, isPaid: !invoiceDraft.isPaid})} className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-colors shrink-0", invoiceDraft.isPaid ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-black/10 dark:bg-white/10 text-slate-500")}>
                                   {invoiceDraft.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Unpaid')}
                                </button>
                             </div>
                             
                             <textarea value={invoiceDraft.note || ''} onChange={e => setInvoiceDraft({...invoiceDraft, note: e.target.value})} className="w-full text-[11px] font-medium border-none bg-transparent outline-none p-0 mt-2 text-slate-500 focus:ring-0 placeholder:italic placeholder:opacity-50 resize-none h-10" placeholder={lang === 'de' ? "Notiz hinzufügen..." : "Add note..."} />
                             
                             <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200 dark:border-white/10">
                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Discard draft?')) { setEditingInvoiceId(null); setInvoiceDraft(null); setSelectedInvoiceId(null); } }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-md"><Trash2 size={14} /></button>
                                <button disabled={!invoiceDraft.number || !invoiceDraft.startDate || !invoiceDraft.endDate || (invoiceDraft.isPaid && !invoiceDraft.paymentDate)} onClick={(e) => { e.stopPropagation(); patchHotel({ invoices: [invoiceDraft, ...localHotel.invoices] }); setSelectedInvoiceId(invoiceDraft.id); setEditingInvoiceId(null); setInvoiceDraft(null); }} className="p-1.5 px-3 text-white bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 rounded-md transition-all"><Check size={16} strokeWidth={3} /></button>
                             </div>
                          </div>
                       )}

                       {filteredInvoices.length === 0 && !editingInvoiceId ? (
                         <p className="text-[11px] font-medium italic text-slate-400 mt-2">{totalInvs === 0 ? (lang === 'de' ? 'Keine Rechnungen' : 'No invoices') : (lang === 'de' ? 'Keine Treffer' : 'No matches')}</p>
                       ) : (
                         filteredInvoices.map((inv: any) => {
                           const isActiveSelection = selectedInvoiceId === inv.id;
                           const isEditingMeta = editingInvoiceId === inv.id;
                           if (isEditingMeta) {
                              const draft = invoiceDraft || inv;
                              return (
                                 <div key={inv.id} className={cn("group relative flex flex-col gap-2 p-3 rounded-xl transition-all border shadow-md", dk ? "bg-teal-900/30 border-teal-500/50" : "bg-teal-50 border-teal-300")}>
                                    <input autoFocus value={draft.number} onChange={e => setInvoiceDraft({...draft, number: e.target.value})} className="w-full text-[13px] font-black border-none bg-transparent outline-none p-0 focus:ring-0 placeholder:text-slate-400" placeholder="RE-..." />
                                    <div className="flex items-center gap-2 mt-1">
                                       <div className="flex-1 flex flex-col gap-0.5">
                                          <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Start' : 'Start'}</label>
                                          <NativeDatePicker dk={dk} value={draft.startDate || ''} onChange={(s: string) => setInvoiceDraft({...draft, startDate: s})} className="w-full h-[28px]" />
                                       </div>
                                       <div className="flex-1 flex flex-col gap-0.5">
                                          <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Ende' : 'End'}</label>
                                          <NativeDatePicker dk={dk} disabled={!draft.startDate} min={draft.startDate} value={draft.endDate || ''} onChange={(end: string) => setInvoiceDraft({...draft, endDate: end})} className="w-full h-[28px]" />
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                       <div className="flex-1 flex flex-col gap-0.5">
                                           <label className="text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Fällig am:' : 'Payment Due:'}</label>
                                           <NativeDatePicker dk={dk} value={draft.dueDate || ''} onChange={(due: string) => setInvoiceDraft({...draft, dueDate: due})} className="w-full h-[28px]" />
                                       </div>
                                       {draft.isPaid && (
                                          <div className="flex-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-right-2">
                                             <label className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Calendar size={10}/> {lang === 'de' ? 'Bezahlt am:' : 'Paid On:'}</label>
                                             <NativeDatePicker dk={dk} value={draft.paymentDate || ''} onChange={(pd: string) => setInvoiceDraft({...draft, paymentDate: pd})} className="w-full h-[28px] [&>div]:border-emerald-500 [&>div]:text-emerald-600 dark:[&>div]:text-emerald-400" />
                                          </div>
                                       )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-200 dark:border-white/10">
                                       <button onClick={() => setInvoiceDraft({...draft, isPaid: !draft.isPaid})} className={cn("px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors shrink-0", draft.isPaid ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-black/10 dark:bg-white/10 text-slate-500")}>
                                          {draft.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Unpaid')}
                                       </button>
                                    </div>
                                    <textarea value={draft.note || ''} onChange={e => setInvoiceDraft({...draft, note: e.target.value})} className="w-full text-[11px] font-medium border-none bg-transparent outline-none p-0 mt-2 text-slate-500 focus:ring-0 placeholder:italic placeholder:opacity-50 resize-none h-10" placeholder={lang === 'de' ? "Notiz hinzufügen..." : "Add note..."} />
                                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200 dark:border-white/10">
                                       <button onClick={(e) => { e.stopPropagation(); setInvoiceToDelete(inv.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-md"><Trash2 size={14} /></button>
                                       <div className="flex items-center gap-2">
                                          <button onClick={() => { setEditingInvoiceId(null); setInvoiceDraft(null); }} className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-md"><X size={16} /></button>
                                          <button disabled={!draft.number || !draft.startDate || !draft.endDate || (draft.isPaid && !draft.paymentDate)} onClick={(e) => { e.stopPropagation(); patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === inv.id ? { ...i, number: draft.number, startDate: draft.startDate, endDate: draft.endDate, dueDate: draft.dueDate, paymentDate: draft.paymentDate, isPaid: draft.isPaid, note: draft.note } : i) }); setEditingInvoiceId(null); setInvoiceDraft(null); }} className="p-1.5 px-3 text-white bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 rounded-md transition-all"><Check size={16} strokeWidth={3} /></button>
                                       </div>
                                    </div>
                                 </div>
                              );
                           }

                           const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
                           let invBrutto = inv.billingMode === 'total' ? (parseFloat(inv.totalNetto)||0) * (1 + (parseFloat(inv.totalMwst)||0)/100) : (inv.items||[]).reduce((sum:number, it:any) => sum + calcInvoiceItem(it, defaultN).brutto, 0);

                           return (
                              <div key={inv.id} onClick={() => { setSelectedInvoiceId(isActiveSelection ? null : inv.id); setEditingItemId(null); setEditingTotal(false); }} className={cn("group relative flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer border shadow-sm hover:shadow-md", isActiveSelection ? (dk ? "bg-teal-900/30 border-teal-500/50 shadow-md" : "bg-teal-50 border-teal-300 shadow-md") : (dk ? "bg-[#1E293B] border-white/5 hover:border-white/20" : "bg-white border-slate-100 hover:border-slate-300"))}>
                                 <div className="flex items-center gap-2.5">
                                    <div className={cn("relative flex items-center justify-center group/info cursor-help shrink-0")}>
                                       <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-colors", dk ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-400 group-hover/info:border-teal-500 group-hover/info:text-teal-500")}>i</div>
                                       <div className={cn("absolute left-7 top-0 w-max min-w-[200px] max-w-[250px] p-3 rounded-xl shadow-2xl border opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all z-[9999] -translate-x-2 group-hover/info:translate-x-0 flex flex-col gap-1", dk ? "bg-slate-800 border-white/10" : "bg-white border-slate-200")}>
                                         <p className={cn("text-[13px] font-black leading-tight border-b pb-1 mb-1", dk ? "text-white border-white/10" : "text-slate-900 border-slate-100")}>{inv.number || 'Unnamed'}</p>
                                         <p className={cn("text-[11px] font-bold", dk ? "text-slate-300" : "text-slate-600")}><span className="opacity-60">Period:</span> {inv.startDate ? `${formatShortDate(inv.startDate, lang)} - ${formatShortDate(inv.endDate, lang)}` : '--'}</p>
                                         <p className={cn("text-[11px] font-bold", dk ? "text-slate-300" : "text-slate-600")}><span className="opacity-60">{inv.dueDate ? (lang==='de'?'Fällig:':'Due:') : (lang==='de'?'Erstellt:':'Created:')}</span> {inv.dueDate ? formatShortDate(inv.dueDate, lang) : formatShortDate(inv.created_at || new Date().toISOString(), lang)}</p>
                                         {inv.isPaid && <p className={cn("text-[11px] font-bold text-emerald-500")}><span className="opacity-60">Paid on:</span> {inv.paymentDate ? formatShortDate(inv.paymentDate, lang) : '--'}</p>}
                                         {inv.note && <p className={cn("text-[11px] font-medium leading-relaxed break-words whitespace-pre-wrap mt-1 pt-1 border-t", dk ? "text-slate-400 border-white/10" : "text-slate-500 border-slate-100")}>{inv.note}</p>}
                                       </div>
                                    </div>
                                    <div className="flex flex-col">
                                       <div className="flex items-center gap-1.5">
                                          <span className={cn("w-2 h-2 rounded-full shrink-0", inv.isPaid ? "bg-emerald-500" : "bg-red-500")} />
                                          <span className={cn("text-[13px] font-black truncate max-w-[120px]", dk ? "text-slate-200" : "text-slate-800", isActiveSelection && "text-teal-600 dark:text-teal-400")}>
                                             <HighlightText text={inv.number || 'Unnamed'} query={searchScope === 'all' || searchScope === 'invoice' ? searchQuery : ''} />
                                          </span>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-3 shrink-0">
                                    <span className={cn("text-[13px] font-black", dk ? "text-white" : "text-slate-900")}>{formatCurrency(invBrutto)}</span>
                                    {(!viewOnly && isActiveSelection) && (
                                       <button onClick={(e) => { e.stopPropagation(); setEditingInvoiceId(inv.id); setInvoiceDraft(inv); }} className="p-1.5 bg-black/5 dark:bg-white/5 rounded text-slate-500 hover:text-teal-600 transition-all shrink-0"><Edit3 size={14} /></button>
                                    )}
                                 </div>
                              </div>
                           );
                         })
                       )}
                    </div>
                </div>

                <div className="flex-1 p-0 flex flex-col min-w-[700px] z-10 border-r border-slate-200 dark:border-white/10">
                   <div className={cn("px-5 h-[50px] border-b flex items-center justify-between shrink-0", dk ? "border-white/10" : "border-slate-200", activeInvoice ? (dk ? "bg-[#1E293B]" : "bg-slate-50") : "bg-transparent")}>
                      <div className="flex items-center gap-4 flex-1">
                          {activeInvoice ? (
                             <div className="flex items-center gap-3">
                               <span className="text-[13px] text-slate-500">{lang === 'de' ? 'Leistungszeitraum:' : 'Billing period:'}</span>
                               {(activeInvoice.startDate || activeInvoice.endDate) ? (
                                   <div className="flex items-center gap-2 text-[11px] font-bold bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300">
                                      <Calendar size={12} className="opacity-50"/> 
                                      <span>{activeInvoice.startDate ? formatShortDate(activeInvoice.startDate, lang) : '--'} - {activeInvoice.endDate ? formatShortDate(activeInvoice.endDate, lang) : '--'}</span>
                                      <span className="opacity-30">|</span>
                                      <span>{calculateNights(activeInvoice.startDate, activeInvoice.endDate)} {lang==='de'?'Nächte':'Nights'}</span>
                                      <span className="opacity-30">|</span>
                                      {activeInvoice.isPaid ? (
                                         <span className="text-emerald-600 dark:text-emerald-400">{lang==='de'?'Bezahlt am: ':'Paid on: '} {formatShortDate(activeInvoice.paymentDate, lang)}</span>
                                      ) : (
                                         <span className={cn(activeInvoice.dueDate ? "text-red-500" : "text-slate-500 font-normal")}>{activeInvoice.dueDate ? (lang==='de'?'Fällig am: ':'Payment Due: ') : (lang==='de'?'Erstellt am: ':'Created on: ')} {activeInvoice.dueDate ? formatShortDate(activeInvoice.dueDate, lang) : formatShortDate(activeInvoice.created_at || new Date().toISOString(), lang)}</span>
                                      )}
                                   </div>
                                ) : (
                                   <span className="text-[11px] font-medium italic text-slate-400">Kein Zeitraum gewählt</span>
                                )}
                             </div>
                          ) : (
                             <>
                                <div className={cn("flex items-center px-2 py-1.5 rounded-lg border w-[250px] transition-colors focus-within:border-teal-500 shadow-sm", dk ? "bg-black/40 border-white/10" : "bg-white border-slate-200")}>
                                    <Search size={14} className={dk ? "text-slate-500" : "text-slate-400"} />
                                    <input value={itemSearchQuery} onChange={(e) => setItemSearchQuery(e.target.value)} className={cn("w-full bg-transparent border-none outline-none text-[12px] font-bold px-2 placeholder-slate-400 focus:ring-0", dk ? "text-white" : "text-slate-900")} placeholder={lang === 'de' ? "Suchen..." : "Search..."} />
                                    {itemSearchQuery && <button onClick={() => setItemSearchQuery('')} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>}
                                </div>
                                <MonthFilterDropdown 
                                  selectedMonth={selectedMonth} 
                                  localMonthFilter={localMonthFilter} 
                                  setLocalMonthFilter={setLocalMonthFilter} 
                                  selectedYear={selectedYear} 
                                  monthOptions={monthOptions} 
                                  lang={lang} 
                                  dk={dk} 
                                  disabled={selectedMonth !== null} 
                                />
                             </>
                          )}
                      </div>

                      {activeInvoice && !viewOnly && (
                         <div className={cn("flex items-center p-0.5 rounded-lg border", dk ? "bg-black/40 border-white/10" : "bg-slate-100 border-slate-200")}>
                            <button disabled={activeInvoice.items?.length > 0} onClick={() => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, billingMode: 'total'} : i) }); setEditingTotal(false); setEditingItemId(null); }} className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", activeInvoice.billingMode === 'total' ? (dk ? "bg-teal-500 text-white" : "bg-white shadow-sm text-teal-700") : "text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed")}>💰 {lang === 'de' ? 'Gesamtbetrag' : 'Total'}</button>
                            <button disabled={activeInvoice.totalNetto || activeInvoice.totalBrutto} onClick={() => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, billingMode: 'detailed'} : i) }); setEditingTotal(false); }} className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", activeInvoice.billingMode !== 'total' ? (dk ? "bg-teal-500 text-white" : "bg-white shadow-sm text-teal-700") : "text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed")}>📝 {lang === 'de' ? 'Detailliert' : 'Detailed'}</button>
                         </div>
                      )}
                   </div>

                   <div className="flex-1 overflow-y-auto max-h-[400px] relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {activeInvoice ? (
                         activeInvoice.billingMode === 'total' ? (
                            <div className="p-4">
                               <div ref={totalRef} className={cn("flex flex-col p-4 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-top-2 relative z-20", dk ? "bg-[#1E293B]" : "bg-white", editingTotal ? (dk ? "border-teal-500/50 shadow-xl bg-teal-900/20" : "border-teal-300 shadow-xl bg-teal-50") : (dk ? "border-slate-800" : "border-slate-100"))}>
                                  {/* WIDTH FIX: Added gap-5 to prevent inputs from overlapping */}
                                  <div className="flex items-center gap-5 w-full">
                                     <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                                        <label className={labelCls}>Netto</label>
                                        <input disabled={viewOnly || !editingTotal || (editingTotal ? totalDraft?.totalBrutto : activeInvoice.totalBrutto)} type="number" value={editingTotal ? (totalDraft?.totalNetto ?? '') : (activeInvoice.totalNetto ?? '')} onChange={e => setTotalDraft({...totalDraft, totalNetto: e.target.value, totalBrutto: null})} className={cn(inputCls, "w-[100px] disabled:opacity-30 text-right")} placeholder="0.00" />
                                        {(!showTotalDiscount && !(editingTotal ? totalDraft?.totalBrutto : activeInvoice.totalBrutto) && editingTotal && !viewOnly) && <button onClick={() => { setShowTotalDiscount(true); if(!totalDraft?.discountType) setTotalDraft({...totalDraft, discountType: 'fixed'}); }} className="p-1.5 rounded text-slate-400 hover:text-teal-500 bg-black/5 dark:bg-white/5 shrink-0"><Ticket size={14}/></button>}
                                        {showTotalDiscount && !(editingTotal ? totalDraft?.totalBrutto : activeInvoice.totalBrutto) && (
                                            <div className="flex items-center w-[130px] shrink-0 animate-in fade-in slide-in-from-left-2 ml-1">
                                               <input disabled={!editingTotal} type="number" value={editingTotal ? (totalDraft?.discountValue ?? '') : (activeInvoice.discountValue ?? '')} onChange={e => setTotalDraft({...totalDraft, discountValue: e.target.value})} className={cn(inputCls, "rounded-r-none border-r-0 w-[65px] px-1.5 text-right placeholder:text-[10px]")} placeholder="Rabatt" />
                                               <button disabled={!editingTotal} onClick={() => setTotalDraft({...totalDraft, discountType: totalDraft?.discountType === 'percentage' ? 'fixed' : 'percentage'})} className={cn("w-[30px] h-[34px] border-y border-r text-[11px] font-bold transition-colors disabled:opacity-50", dk ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 border-slate-200 text-slate-700")}>{editingTotal ? (totalDraft?.discountType === 'percentage' ? '%' : '€') : (activeInvoice.discountType === 'percentage' ? '%' : '€')}</button>
                                               {editingTotal && <button onClick={() => { setShowTotalDiscount(false); setTotalDraft({...totalDraft, discountValue: null}); }} className={cn("w-[30px] h-[34px] rounded-r border-y border-r flex items-center justify-center transition-colors text-slate-400 hover:text-red-500", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}><X size={14}/></button>}
                                            </div>
                                        )}
                                     </div>
                                     <div className="w-[100px] shrink-0 flex items-center gap-2">
                                        <label className={labelCls}>MwSt</label>
                                        {editingTotal && !viewOnly ? (
                                           <MwstInput value={totalDraft?.totalMwst} onChange={(v:any) => setTotalDraft({...totalDraft, totalMwst: v})} isDarkMode={dk} />
                                        ) : (
                                           <div className={cn(inputCls, "text-center border-transparent bg-transparent px-0 text-sm")}>{activeInvoice.totalMwst || 7}%</div>
                                        )}
                                     </div>
                                     <div className="w-[160px] shrink-0 flex items-center gap-2">
                                        <label className={labelCls}>Brutto</label>
                                        <div className="relative flex-1">
                                            <input disabled={viewOnly || !editingTotal || (editingTotal ? totalDraft?.totalNetto : activeInvoice.totalNetto)} type="number" value={editingTotal ? (totalDraft?.totalBrutto ?? '') : (activeInvoice.totalBrutto ?? '')} onChange={e => setTotalDraft({...totalDraft, totalBrutto: e.target.value, totalNetto: null})} className={cn(inputCls, "w-full disabled:opacity-100 disabled:bg-transparent disabled:border-transparent font-black text-sm text-right pr-2 placeholder-slate-900 dark:placeholder-white")} placeholder={(editingTotal ? totalDraft?.totalNetto : activeInvoice.totalNetto) ? formatCurrency(parseFloat((editingTotal ? totalDraft?.totalNetto : activeInvoice.totalNetto)) * (1 + (parseFloat((editingTotal ? totalDraft?.totalMwst : activeInvoice.totalMwst))||0)/100)) : "0.00"} />
                                        </div>
                                     </div>
                                     {!viewOnly && (
                                        <div className="w-max flex items-center justify-end gap-1.5 ml-3">
                                           {editingTotal ? (
                                              <>
                                                <button onClick={() => {
                                                    patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, ...totalDraft} : i) });
                                                    setEditingTotal(false);
                                                }} className="h-[34px] w-[34px] rounded-xl flex items-center justify-center font-bold transition-all shadow-sm bg-teal-500 hover:bg-teal-600 text-white">
                                                   <Check size={16} strokeWidth={3} />
                                                </button>
                                                <button onClick={() => setEditingTotal(false)} className={cn("h-[34px] w-[34px] rounded-xl flex items-center justify-center font-bold transition-all border", dk ? "border-white/10 hover:bg-white/10 text-slate-400 hover:text-white" : "border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800")}>
                                                   <X size={16} strokeWidth={3} />
                                                </button>
                                              </>
                                          ) : (
                                              <button onClick={() => {
                                                  setTotalDraft({ totalNetto: activeInvoice.totalNetto, totalBrutto: activeInvoice.totalBrutto, totalMwst: activeInvoice.totalMwst, discountValue: activeInvoice.discountValue, discountType: activeInvoice.discountType || 'fixed', note: activeInvoice.note });
                                                  setShowTotalDiscount(parseFloat(activeInvoice.discountValue || 0) > 0);
                                                  setEditingTotal(true);
                                              }} className={cn("h-[34px] w-[34px] rounded-xl flex items-center justify-center font-bold transition-all shadow-sm", dk ? "bg-white/10 hover:bg-white/20 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700")}>
                                                 <Edit3 size={14} />
                                              </button>
                                           )}
                                        </div>
                                     )}
                                  </div>
                                  <div className="w-full mt-3 border-t pt-3 dark:border-white/10 border-slate-100 animate-in fade-in">
                                     <textarea disabled={!editingTotal} rows={1} value={editingTotal ? (totalDraft?.note || '') : (activeInvoice.note || '')} onChange={e => { e.target.style.height='34px'; e.target.style.height=`${e.target.scrollHeight}px`; setTotalDraft({...totalDraft, note: e.target.value}) }} className={cn(inputCls, "w-full text-[12px] font-medium resize-none overflow-hidden placeholder-opacity-50 min-h-[34px] disabled:bg-transparent disabled:border-transparent")} placeholder={lang === 'de' ? "Notiz (Optional)..." : "Note (Optional)..."} />
                                  </div>
                               </div>
                            </div>
                         ) : (
                            <div className="flex flex-col animate-in fade-in pb-5">
                               <div className={cn("sticky top-0 z-10 flex items-center px-3 py-2 gap-2 border-b mb-3 backdrop-blur-md", dk ? "bg-[#0B1224]/95 border-white/10" : "bg-slate-50/95 border-slate-200")}>
                               <div className="w-[220px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{lang === 'de' ? 'Beschreibung' : 'Description'}</div>
                               <div className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-3">{lang === 'de' ? 'Netto (Bett)' : 'Netto (Bed)'}</div>
                               <div className="w-[100px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{lang === 'de' ? 'Gesamt Netto' : 'Total Netto'}</div>
                               <div className="w-[75px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-2">MwSt</div>
                               <div className="w-[110px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-2">{lang === 'de' ? 'Gesamt Brutto' : 'Total Brutto'}</div>
                               <div className="w-[75px] shrink-0"></div>
                            </div>
                               
                               {(activeInvoice.items || []).length === 0 && <p className="text-[12px] font-bold text-slate-400 italic mt-6 mx-5 text-center py-6 bg-slate-100 dark:bg-white/5 rounded-xl border border-dashed border-slate-300 dark:border-white/10">{lang === 'de' ? 'Noch keine Posten vorhanden. Klicke unten, um zu starten.' : 'No line items. Click below to start.'}</p>}
                               
                               {(activeInvoice.items || []).map((item: any) => (
                                          <InvoiceLineItem 
                                             key={item.id} item={item} dk={dk} lang={lang} viewOnly={viewOnly}
                                             defaultNights={activeInvoice.startDate && activeInvoice.endDate ? calculateNights(activeInvoice.startDate, activeInvoice.endDate) : 1}
                                             defaultStart={activeInvoice.startDate} defaultEnd={activeInvoice.endDate}
                                             isEditing={editingItemId === item.id} 
                                             onEdit={() => setEditingItemId(item.id)} 
                                             onSave={(savedDraft: any) => { 
                                                 patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, items: i.items.map((it:any) => it.id === item.id ? savedDraft : it)} : i) });
                                                 setEditingItemId(null); 
                                             }}
                                             onCancel={() => setEditingItemId(null)}
                                             onDelete={() => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, items: i.items.filter((it:any) => it.id !== item.id)} : i) }); setEditingItemId(null); }}
                                          />
                               ))}
                               {!viewOnly && (
                                  <button onClick={() => {
                                      const newId = Math.random().toString();
                                      patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, items: [...(i.items||[]), { id: newId, type: 'room', method: 'per_bed', netto: null, mwst: 7, brutto: null }]} : i) });
                                      setEditingItemId(newId);
                                  }} className="mt-4 mx-5 py-3 rounded-lg border border-dashed text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-teal-500 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-all">+ {lang === 'de' ? 'Zeile hinzufügen' : 'Add Row'}</button>
                               )}
                            </div>
                         )
                      ) : (
                         <div className="flex flex-col animate-in fade-in pb-5">
                            <div className={cn("sticky top-0 z-10 flex items-center px-3 py-2 gap-2 border-b mb-3 backdrop-blur-md", dk ? "bg-[#0B1224]/95 border-white/10" : "bg-slate-50/95 border-slate-200")}>
                               <div className="w-[220px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{lang === 'de' ? 'Beschreibung' : 'Description'}</div>
                               <div className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-3">{lang === 'de' ? 'Netto (Bett)' : 'Netto (Bed)'}</div>
                               <div className="w-[100px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{lang === 'de' ? 'Gesamt Netto' : 'Total Netto'}</div>
                               <div className="w-[75px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-2">MwSt</div>
                               <div className="w-[110px] shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-2">{lang === 'de' ? 'Gesamt Brutto' : 'Total Brutto'}</div>
                               <div className="w-[75px] shrink-0"></div>
                            </div>
                            
                            {filteredMasterInvoices.length > 0 ? filteredMasterInvoices.map((inv: any) => {
                               const isExpanded = expandedInvoices.includes(inv.id);
                               const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
                               let invBrutto = inv.billingMode === 'total' ? (parseFloat(inv.totalNetto)||0) * (1 + (parseFloat(inv.totalMwst)||0)/100) : (inv.items||[]).reduce((sum:number, it:any) => sum + calcInvoiceItem(it, defaultN).brutto, 0);
                               return (
                               <div key={inv.id} className="flex flex-col mb-3 px-3">
                                  {/* ... expand button remains same ... */}
                                  <button onClick={() => setExpandedInvoices(prev => isExpanded ? prev.filter(id => id !== inv.id) : [...prev, inv.id])} className={cn("flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-colors group border shadow-sm", inv.isPaid ? (dk ? "bg-emerald-950/20 border-emerald-500/20" : "bg-emerald-50 border-emerald-200") : (dk ? "bg-red-950/20 border-red-500/20" : "bg-red-50 border-red-200"))}>
                                     <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown size={16} className={inv.isPaid ? "text-emerald-500" : "text-red-500"}/> : <ChevronRight size={16} className={inv.isPaid ? "text-emerald-500" : "text-red-500"}/>}
                                        <span className={cn("text-[14px] font-black", inv.isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                           <HighlightText text={inv.number || 'Draft'} query={itemSearchQuery} />
                                        </span>
                                     </div>
                                     <div className="flex items-center gap-3">
                                        <span className={cn("text-[14px] font-black", inv.isPaid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{formatCurrency(invBrutto)}</span>
                                     </div>
                                  </button>
                                  {isExpanded && (
                                    <div className="pl-6 pt-1 animate-in fade-in slide-in-from-top-1">
                                      {inv.billingMode === 'total' ? (
                                         <div className="flex items-center px-2 py-2 gap-2 border-b border-slate-100 dark:border-white/5">
                                            <div className="w-[220px] shrink-0 text-[12px] font-bold text-slate-600 dark:text-slate-300">{lang === 'de' ? 'Gesamtbetrag' : 'Total'}</div>
                                            <div className="flex-1 text-[11px] italic text-slate-400 opacity-50 text-right pr-3">--</div>
                                            <div className="w-[100px] shrink-0 text-[12px] font-bold text-slate-700 dark:text-slate-300 text-right"><HighlightText text={formatCurrency(parseFloat(inv.totalNetto)||0)} query={itemSearchQuery} /></div>
                                            <div className="w-[75px] shrink-0 text-[12px] font-bold text-slate-500 text-center px-2">{inv.totalMwst}%</div>
                                            <div className="w-[110px] shrink-0 text-[12px] font-black text-slate-900 dark:text-white text-right pr-2"><HighlightText text={formatCurrency(invBrutto)} query={itemSearchQuery} /></div>
                                            <div className="w-[75px] shrink-0"></div>
                                         </div>
                                      ) : (
                                         <div className="flex flex-col">
                                            {(inv.items || []).map((item: any) => {
                                               const { finalNetto, mwst, brutto } = calcInvoiceItem(item, defaultN);
                                               return (
                                                  <div key={item.id} className="flex items-start px-2 py-2.5 gap-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                                     <div className="w-[220px] shrink-0 flex flex-col gap-0.5">
                                                        <div className="text-[12px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                                           <HighlightText text={getTranslation(COST_TYPES, item.type || 'room', lang)} query={itemSearchQuery} />
                                                           {item.method === 'per_bed' && <span className="text-[9.5px] text-slate-400 font-bold ml-1 tracking-normal font-sans">({item.nights||defaultN} {lang==='de'?'Nächte':'Nights'}, {item.beds||1} {lang==='de'?'Betten':'Beds'})</span>}
                                                        </div>
                                                        {item.note && <span className="text-[10px] italic text-slate-400 mt-1 whitespace-pre-wrap"><HighlightText text={item.note} query={itemSearchQuery} /></span>}
                                                     </div>
                                                     <div className="flex-1 text-[12px] font-bold text-slate-700 dark:text-slate-300 pt-0.5 text-right pr-3">
                                                        {item.method === 'per_bed' ? <HighlightText text={formatCurrency(parseFloat(item.netto)||0)} query={itemSearchQuery} /> : <span className="opacity-50 text-[11px] italic">--</span>}
                                                     </div>
                                                     <div className="w-[100px] shrink-0 text-[12px] font-bold text-slate-700 dark:text-slate-300 pt-0.5 text-right"><HighlightText text={formatCurrency(finalNetto)} query={itemSearchQuery} /></div>
                                                     <div className="w-[75px] shrink-0 text-[12px] font-bold text-slate-500 pt-0.5 text-center px-2">{mwst}%</div>
                                                     <div className="w-[110px] shrink-0 text-[12px] font-black text-slate-900 dark:text-white pt-0.5 text-right pr-2"><HighlightText text={formatCurrency(brutto)} query={itemSearchQuery} /></div>
                                                     <div className="w-[75px] shrink-0"></div>
                                                  </div>
                                               )
                                            })}
                                            {(inv.items || []).length === 0 && <div className="px-2 py-1.5 text-[11px] italic text-slate-400">Leer</div>}
                                         </div>
                                      )}
                                    </div>
                                  )}
                               </div>
                               );
                            }) : (
                               <p className="text-[12px] font-bold text-slate-400 italic mt-4 mx-5 text-center py-6 bg-slate-100 dark:bg-white/5 rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                                   {itemSearchQuery ? (lang === 'de' ? 'Keine Ergebnisse für diese Suche.' : 'No results found.') : (lang === 'de' ? 'Keine Daten. Wähle eine Rechnung auf der linken Seite aus.' : 'No data. Select an invoice on the left.')}
                               </p>
                            )}
                         </div>
                      )}
                   </div>
                </div>

                <div className={cn("w-full xl:w-[280px] p-5 flex flex-col shrink-0 rounded-b-2xl xl:rounded-bl-none transition-colors", dk ? "bg-[#0B1224]" : "bg-white", activeInvoice && (dk ? "bg-teal-950/20" : "bg-teal-50/30"))}>
                   <div className="flex items-center justify-between gap-2 mb-5">
                      {activeInvoice ? (
                         <span className="text-[14px] font-black text-teal-600 dark:text-teal-400 bg-teal-500/10 px-3 py-1 rounded-md">{activeInvoice.number || 'Draft'}</span>
                      ) : (
                         <span className="text-[12px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-md">
                            {activeMonthFilter !== 'all' 
                              ? `${monthOptions[activeMonthFilter as number]} ${selectedYear || new Date().getFullYear()}` 
                              : `${lang === 'de' ? 'Übersicht' : 'Summary'} ${selectedYear || new Date().getFullYear()}`}
                         </span>
                      )}
                      <div className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm cursor-default", (activeInvoice ? activeInvoice.isPaid : localHotel.isPaid) ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30")}>
                         {(activeInvoice ? activeInvoice.isPaid : localHotel.isPaid) ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Unpaid')}
                      </div>
                   </div>
                   
                   <div className="space-y-2 mb-5 font-medium text-[14px] border-b pb-4 border-slate-100 dark:border-white/10">
                      <div className="flex justify-between items-center">
                         <span className={dk ? "text-slate-400" : "text-slate-500"}>{lang === 'de' ? 'Gesamt Netto' : 'Total Netto'}</span>
                         <span className={cn("font-bold", dk ? "text-white" : "text-slate-900")}>{formatCurrency(activeInvoice ? masterMath.activeNetto : masterMath.displayNetto)}</span>
                      </div>
                      {Object.entries(activeInvoice ? masterMath.activeBuckets : masterMath.buckets).map(([percent, amount]: any) => (
                         <div key={percent} className="flex justify-between items-center text-[13px]">
                             <span className={dk ? "text-slate-500" : "text-slate-400"}>MwSt ({percent}%)</span>
                             <span className={dk ? "text-slate-400" : "text-slate-500"}>{formatCurrency(amount)}</span>
                         </div>
                      ))}
                   </div>
                   
                   <div className="flex flex-col gap-3">
                      {!activeInvoice && localHotel.has_global_discount && (
                        <div className="flex flex-col gap-2 p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 mb-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{lang === 'de' ? 'Gesamtrabatt' : 'Global Discount'}</span>
                            <div className="flex items-center gap-2">
                               <input disabled={viewOnly} type="number" value={localHotel.global_discount_value || ''} onChange={e => patchHotel({global_discount_value: e.target.value === '' ? null : e.target.value})} className={cn(inputCls, 'w-16 h-[28px] px-1.5 text-xs')} placeholder="0" />
                               <button disabled={viewOnly} onClick={() => patchHotel({global_discount_type: localHotel.global_discount_type === 'percentage' ? 'fixed' : 'percentage'})} className={cn("w-8 h-[28px] rounded flex items-center justify-center text-sm font-bold", dk ? "bg-white/10 text-white" : "bg-white border border-slate-200 text-slate-700")}>{localHotel.global_discount_type === 'percentage' ? '%' : '€'}</button>
                            </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center group w-full">
                         <span className={cn("text-[12px] font-black uppercase tracking-widest shrink-0", activeInvoice ? "text-teal-600 dark:text-teal-400" : "text-slate-500")}>{lang === 'de' ? 'Gesamt Brutto' : 'Total Brutto'}</span>
                         {!viewOnly && !activeInvoice && editingOBrutto ? (
                            <input autoFocus type="number" value={editBruttoValue} onChange={e => setEditBruttoValue(e.target.value)} onBlur={() => {patchHotel({override_total_brutto: editBruttoValue === '' ? null : editBruttoValue}); setEditingOBrutto(false);}} onKeyDown={e => e.key==='Enter' && (e.target as HTMLElement).blur()} className={cn("w-28 text-right px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-black text-xl outline-none ml-auto")} />
                         ) : (
                            <span onClick={() => {!viewOnly && !activeInvoice && setEditingOBrutto(true);}} className={cn("text-[22px] font-black", masterMath.isOverriddenBrutto && !activeInvoice ? "text-yellow-500" : (dk ? "text-white" : "text-slate-900"), !viewOnly && !activeInvoice && "cursor-pointer rounded px-1 -mr-1 transition-colors hover:bg-black/5")}>{formatCurrency(activeInvoice ? masterMath.activeBrutto : masterMath.displayBrutto)}</span>
                         )}
                      </div>

                      {!activeInvoice && (
                         <div className="flex flex-col gap-1.5 mt-2 mb-3">
                             <div className="flex justify-between items-center text-[12px] font-bold">
                                 <span className="text-slate-400">{lang === 'de' ? 'Total Bezahlt' : 'Total Paid'}</span><span className="text-emerald-500">{formatCurrency(masterMath.totalPaid)}</span>
                             </div>
                             <div className="flex justify-between items-center text-[12px] font-bold">
                                 <span className="text-slate-400">{lang === 'de' ? 'Total Offen' : 'Total Unpaid'}</span><span className="text-red-500">{formatCurrency(masterMath.totalUnpaid)}</span>
                             </div>
                         </div>
                      )}
                      
                      <div className="flex justify-between items-center group w-full mt-3">
                        <span className={cn("text-[12px] font-bold shrink-0", dk ? "text-slate-500" : "text-slate-400")}>{lang === 'de' ? 'Preis / Bett' : 'Price / Bed'}</span>
                        {!viewOnly && editingPriceBed ? (
                            <input autoFocus type="number" value={editPriceBedValue} onChange={e => setEditPriceBedValue(e.target.value)} onBlur={() => {patchHotel({override_price_per_bed: editPriceBedValue === '' ? null : editPriceBedValue}); setEditingPriceBed(false);}} onKeyDown={e => e.key==='Enter' && (e.target as HTMLElement).blur()} className={cn("w-20 text-right px-1 rounded bg-yellow-500/20 text-yellow-600 font-bold text-[15px] outline-none ml-auto")} />
                        ) : (
                            <span onClick={() => {!viewOnly && setEditingPriceBed(true);}} className={cn("text-[15px] font-bold", masterMath.isOverriddenBed && "text-yellow-600", !viewOnly && "cursor-pointer rounded px-1 -mr-1 transition-colors group-hover:bg-black/5 text-right ml-auto")}>
                               {!masterMath.isOverriddenBed && masterMath.pricePerBed > 0 ? 'ab ' : ''}{masterMath.pricePerBed === 0 && !masterMath.isOverriddenBed ? '0,00 €' : formatCurrency(masterMath.pricePerBed)} / N {!viewOnly && <Edit3 size={11} className="opacity-0 group-hover:opacity-100 ml-1 inline-block"/>}
                            </span>
                        )}
                      </div>

                      {!activeInvoice && (
                         <div className="flex items-center justify-between gap-1.5 mt-auto pt-5 border-t border-slate-100 dark:border-white/10">
                            <button disabled={viewOnly} onClick={() => patchHotel({depositEnabled: !localHotel.depositEnabled})} className={cn("px-3 py-2 text-[10px] font-black uppercase rounded-lg border transition-all", localHotel.depositEnabled ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" : dk ? "border-white/10 text-slate-500 hover:text-white" : "border-slate-200 text-slate-400")}>{lang === 'de' ? 'Kaution' : 'Deposit'}</button>
                            {localHotel.depositEnabled && (
                               <input disabled={viewOnly} type="number" value={localHotel.depositAmount || ''} onChange={e => patchHotel({depositAmount: e.target.value === '' ? null : e.target.value})} className={cn(inputCls, 'w-[100px] h-[32px] px-2 text-[12px] text-amber-500 border-amber-500/30 font-black')} placeholder="0.00" />
                            )}
                         </div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* TAB 3: HOTEL INFO */}
            {activeTab === 'info' && (() => {
               // Seamless styling: Transparent borders until hovered or focused
               const seamlessInput = cn('w-full px-2 py-1.5 rounded-lg text-sm font-bold outline-none border border-transparent transition-all h-[34px]', dk ? 'bg-transparent text-white hover:bg-white/5 focus:bg-[#1E293B] focus:border-teal-500 placeholder-slate-600' : 'bg-transparent text-slate-900 hover:bg-slate-50 focus:bg-white focus:border-teal-500 placeholder-slate-400', viewOnly && "opacity-60 cursor-default");
               
               return (
                 <div className="p-5 bg-white dark:bg-[#0B1224] rounded-b-2xl border-t border-slate-200 dark:border-white/5 animate-in fade-in">
                    <div className="grid grid-cols-12 gap-x-6 gap-y-5">
                       
                       {/* ROW 1 */}
                       {/* Column 1: Adresse (Span 5) */}
                       <div className="col-span-5 flex flex-col">
                          <label className={cn(labelCls, 'mb-1.5')}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label>
                          <input disabled={viewOnly} autoComplete="off" value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} className={seamlessInput} placeholder="..." />
                       </div>
                       
                       {/* Column 2: Ansprechpartner (Span 4) */}
                       <div className="col-span-4 flex flex-col">
                          <label className={cn(labelCls, 'mb-1.5')}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact'}</label>
                          <input disabled={viewOnly} autoComplete="off" value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} className={seamlessInput} placeholder="..." />
                       </div>
                       
                       {/* Column 3: Telefon (Span 3) */}
                       <div className="col-span-3 flex flex-col">
                          <label className={cn(labelCls, 'mb-1.5')}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label>
                          <div className={cn('flex items-center rounded-lg border border-transparent overflow-hidden h-[34px] transition-colors focus-within:border-teal-500', dk ? 'bg-transparent hover:bg-white/5 focus-within:bg-[#1E293B]' : 'bg-transparent hover:bg-slate-50 focus-within:bg-white')}>
                             <span className={cn("px-2.5 text-xs font-bold border-r border-transparent h-full flex items-center shrink-0 opacity-50", dk ? "text-slate-400" : "text-slate-500")}>{getCountryCode(localHotel.country || 'Germany')}</span>
                             <input disabled={viewOnly} autoComplete="off" value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} className="w-full px-2 py-1.5 text-sm font-bold outline-none bg-transparent h-full" placeholder="..." />
                          </div>
                       </div>

                       {/* ROW 2 */}
                       {/* Column 1: Note Toggle + Email (Span 5) */}
                       <div className="col-span-5 flex items-end gap-3">
                          <div className="shrink-0 flex flex-col">
                             <label className={cn(labelCls, 'mb-1.5')}><StickyNote size={12}/> {lang === 'de' ? 'Notiz' : 'Note'}</label>
                             <button onClick={() => setShowNotes(!showNotes)} className={cn("w-[34px] h-[34px] rounded-lg border flex items-center justify-center transition-all", localHotel.notes ? "bg-teal-500/10 border-teal-500/30 text-teal-500 shadow-sm" : dk ? "border-transparent text-slate-400 hover:text-white hover:bg-white/5" : "border-transparent text-slate-400 hover:text-slate-800 hover:bg-slate-50")}>
                                <StickyNote size={16} />
                             </button>
                          </div>
                          <div className="flex-1 flex flex-col">
                             <label className={cn(labelCls, 'mb-1.5')}><Mail size={12}/> Email</label>
                             <div className="relative flex items-center group">
                                <input disabled={viewOnly} autoComplete="off" value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} className={cn(seamlessInput, 'pr-8')} placeholder="..." />
                                {localHotel.email && <a href={`mailto:${localHotel.email}`} className="absolute right-1 p-1 bg-teal-600 text-white rounded hover:bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"><Mail size={12} /></a>}
                             </div>
                          </div>
                       </div>

                       {/* Column 2: Webseite (Span 4) */}
                       <div className="col-span-4 flex flex-col">
                          <label className={cn(labelCls, 'mb-1.5')}><Globe size={12}/> {lang === 'de' ? 'Webseite' : 'Website'}</label>
                          <div className="relative flex items-center group">
                             <input disabled={viewOnly} autoComplete="off" value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} onKeyDown={handleEnterBlur} className={cn(seamlessInput, 'pr-8')} placeholder="..." />
                             {localHotel.website && <a href={localHotel.website.startsWith('http') ? localHotel.website : `https://${localHotel.website}`} target="_blank" rel="noreferrer" className="absolute right-1 p-1 bg-teal-600 text-white rounded hover:bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink size={12} /></a>}
                          </div>
                       </div>

                       {/* Column 3: Land (Span 3) */}
                       <div className="col-span-3 flex flex-col">
                          <label className={cn(labelCls, 'mb-1.5')}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                          {/* FIX: Passes onOpenChange to secure the z-index */}
                          <div className={cn("rounded-lg border border-transparent transition-all", dk ? "hover:border-white/10 hover:bg-white/5" : "hover:border-slate-200 hover:bg-slate-50")}>
                             <ModernDropdown disabled={viewOnly} value={localHotel.country || 'Germany'} options={getCountryOptions()} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} onOpenChange={setIsDropdownActive} />
                          </div>
                       </div>

                       {/* ROW 3: TEXTAREA */}
                       {showNotes && (
                         <div className="col-span-12 animate-in fade-in slide-in-from-top-2 duration-200 pt-2">
                           <textarea disabled={viewOnly} autoComplete="off" autoFocus value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} className={cn('w-full px-3 py-3 rounded-lg text-sm font-bold outline-none border transition-all min-h-[80px] h-auto resize-y', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-600 focus:border-teal-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-500')} placeholder={lang === 'de' ? "Private Notizen hier eintragen..." : "Write private notes here..."} />
                         </div>
                       )}
                    </div>
                 </div>
               );
            })()}
          </div>
        )}
      </div>

      {confirmDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
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
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
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
