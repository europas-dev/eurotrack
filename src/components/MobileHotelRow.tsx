// src/components/MobileHotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronUp, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock, StickyNote, ExternalLink, Search, CornerDownRight, Receipt, FileText, Ticket, Calendar, AlertTriangle, Edit3, Filter, Bed, Users, Coins } from 'lucide-react';
import { cn, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatLastUpdated, calculateNights, calcInvoiceItem } from '../lib/utils';
import { createDuration, updateHotel, deleteHotel } from '../lib/supabase';
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

export function MobileInvoiceLineItem({ item, isEditing, onEdit, onSave, onCancel, onDelete, viewOnly, dk, lang, defaultNights = 1, defaultStart, defaultEnd }: any) {
  const [draft, setDraft] = useState(item);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [showDiscount, setShowDiscount] = useState(parseFloat(item.discountValue || 0) > 0);
  
  const noSpinner = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const inputClass = cn('px-2 py-1.5 rounded text-[12px] font-bold outline-none border transition-all h-[34px]', noSpinner, dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-teal-500' : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500');

  useEffect(() => { if (isEditing) setDraft(item); }, [isEditing, item]);

  const currentItem = isEditing ? draft : item;
  const { finalNetto, mwst, brutto } = calcInvoiceItem(currentItem, defaultNights);
  
  const hasNettoInput = currentItem.netto != null && currentItem.netto !== '';
  const hasBruttoInput = currentItem.brutto != null && currentItem.brutto !== '';
  const isPerBedAllowed = currentItem.type === 'room' || currentItem.type === 'energy' || currentItem.type === 'tax';
  const needsNote = currentItem.type === 'base' || currentItem.type === 'extra';
  const activeNights = currentItem.nights || defaultNights;

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = '34px';
    e.target.style.height = `${e.target.scrollHeight}px`;
    setDraft({ ...draft, note: e.target.value });
  };

  if (isEditing && !viewOnly) {
    return (
      <div ref={editRef} className={cn("flex flex-col p-3 border-b transition-all w-full relative z-20 shadow-lg gap-3", dk ? "bg-teal-900/20 border-teal-500/50" : "bg-teal-50 border-teal-300")}>
        
        {/* ROW 1: Type & Method */}
        <div className="flex items-center gap-2 w-full">
            <select value={draft.type || 'room'} onChange={e => {
                const newType = e.target.value;
                const newMethod = (newType === 'base' || newType === 'extra') ? 'total' : draft.method;
                setDraft({ ...draft, type: newType, method: newMethod });
            }} className={cn(inputClass, "flex-1 px-2 text-[12px]")}>
              {COST_TYPES.map(o => <option key={o.id} value={o.id}>{lang === 'de' ? o.de : o.en}</option>)}
            </select>
            <select disabled={!isPerBedAllowed} value={!isPerBedAllowed ? 'total' : (draft.method || 'total')} onChange={e => setDraft({ ...draft, method: e.target.value })} className={cn(inputClass, "flex-1 px-2 text-[12px] disabled:opacity-50")}>
                 {COST_METHODS.map(m => <option key={m.id} value={m.id}>{lang === 'de' ? m.de : m.en}</option>)}
            </select>
        </div>

        {/* ROW 2: Beds & Nights (If Per Bed) */}
        {draft.method === 'per_bed' && isPerBedAllowed && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{lang === 'de' ? 'Betten' : 'Beds'}</span>
                    <input type="number" value={draft.beds ?? 1} onChange={e => setDraft({ ...draft, beds: e.target.value })} className={cn(inputClass, "w-[60px] text-center")} placeholder="1" />
                </div>
                <span className="text-[12px] text-slate-400 font-black">×</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{lang === 'de' ? 'Nächte' : 'Nights'}</span>
                    <div className={cn("flex items-center rounded border h-[34px] cursor-pointer hover:border-teal-500 transition-colors px-2", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-700")} onClick={() => setCalOpen(!calOpen)}>
                        <span className="text-center text-[12px] font-bold mr-2">{activeNights}</span>
                        <Calendar size={12} className={dk ? "text-slate-500" : "text-slate-400"}/>
                    </div>
                </div>
            </div>
        )}

        {/* CALENDAR DROPDOWN */}
        {calOpen && draft.method === 'per_bed' && (
            <div className={cn("p-3 rounded-xl border shadow-xl flex flex-col gap-3 w-full", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Start</label>
                        <NativeDatePicker dk={dk} value={draft.startDate || defaultStart || ''} onChange={(s: string) => setDraft({ ...draft, startDate: s, nights: calculateNights(s, draft.endDate || defaultEnd || s) })} className="w-full h-[34px]" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">End</label>
                        <NativeDatePicker dk={dk} min={draft.startDate || defaultStart} value={draft.endDate || defaultEnd || ''} onChange={(end: string) => setDraft({ ...draft, endDate: end, nights: calculateNights(draft.startDate || defaultStart || end, end) })} className="w-full h-[34px]" />
                    </div>
                </div>
                <button onClick={() => setCalOpen(false)} className="w-full py-2 bg-teal-500 hover:bg-teal-600 transition-colors text-white text-[12px] font-bold rounded shadow-sm">OK</button>
            </div>
        )}

        {/* ROW 3: Financials (Netto, MwSt, Brutto) */}
        <div className="grid grid-cols-3 gap-2 w-full">
            <div className="flex flex-col gap-1 relative">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Netto</label>
                <div className="relative">
                   <input type="number" disabled={hasBruttoInput} placeholder="0.00" value={draft.netto ?? ''} onChange={e => setDraft({ ...draft, netto: e.target.value, brutto: null })} className={cn(inputClass, "w-full disabled:opacity-30 text-right pr-6")} />
                   {(!showDiscount && !hasBruttoInput) && <button onClick={() => { setShowDiscount(true); if(!draft.discountType) setDraft({...draft, discountType: 'fixed'}); }} className="absolute right-1 top-[7px] p-1 text-slate-400 hover:text-teal-500 rounded"><Ticket size={12}/></button>}
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">MwSt</label>
                <MwstInput value={draft.mwst} onChange={(v:any) => setDraft({ ...draft, mwst: v })} isDarkMode={dk} disabled={false} />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Brutto</label>
                <input type="number" disabled={hasNettoInput} placeholder={hasNettoInput ? formatCurrency(brutto) : "Brutto"} value={draft.brutto ?? ''} onChange={e => setDraft({ ...draft, brutto: e.target.value, netto: null })} className={cn(inputClass, "w-full text-right", hasNettoInput ? "disabled:opacity-100 disabled:bg-transparent disabled:border-transparent text-[13px] font-black px-1 placeholder-slate-900 dark:placeholder-white" : "")} />
            </div>
        </div>

        {/* DISCOUNT ROW */}
        {showDiscount && !hasBruttoInput && (
            <div className="flex items-center w-full animate-in fade-in slide-in-from-top-1 mt-1">
                <input type="number" value={draft.discountValue ?? ''} onChange={e => setDraft({ ...draft, discountValue: e.target.value })} className={cn(inputClass, "rounded-r-none border-r-0 flex-1 px-2 text-right placeholder:text-[10px]")} placeholder="Rabatt" />
                <button onClick={() => setDraft({ ...draft, discountType: draft.discountType === 'percentage' ? 'fixed' : 'percentage' })} className={cn("w-[40px] h-[34px] border-y border-r text-[12px] font-bold transition-colors", dk ? "bg-white/10 hover:bg-white/20 border-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 border-slate-200 text-slate-700")}>{draft.discountType === 'percentage' ? '%' : '€'}</button>
                <button onClick={() => { setShowDiscount(false); setDraft({ ...draft, discountValue: null }); }} className={cn("w-[40px] h-[34px] rounded-r border-y border-r flex items-center justify-center transition-colors text-slate-400 hover:text-red-500", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}><X size={14}/></button>
            </div>
        )}
        
        {/* ROW 4: Notes */}
        {needsNote && (
           <div className="w-full mt-1 animate-in fade-in">
              <textarea rows={1} value={draft.note || ''} onChange={handleNoteChange} className={cn(inputClass, "w-full text-[12px] font-medium resize-none overflow-hidden placeholder-opacity-50 min-h-[34px]")} placeholder={lang === 'de' ? "Notiz (Optional)..." : "Note (Optional)..."} />
           </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-200 dark:border-teal-500/30">
           <button onClick={onCancel} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all border", dk ? "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white" : "border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
           <button onClick={() => onSave(draft)} className="px-6 py-2 flex items-center gap-2 text-white bg-teal-500 hover:bg-teal-600 rounded-lg transition-all shadow-sm text-xs font-bold"><Check size={14} strokeWidth={3}/> {lang === 'de' ? 'Speichern' : 'Save'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col px-3 py-3 border-b last:border-b-0 transition-colors relative gap-2", dk ? "border-white/5" : "border-slate-100")}>
       
       <div className="flex justify-between items-start w-full">
           <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-3">
              <div className={cn("text-[13px] font-black leading-tight", dk ? "text-slate-200" : "text-slate-800")}>
                 {getTranslation(COST_TYPES, currentItem.type || 'room', lang)}
                 {currentItem.method === 'per_bed' && <span className="text-[10px] font-bold text-slate-500 ml-1 tracking-normal font-sans">({activeNights} {lang==='de'?'Nächte':'Nights'}, {currentItem.beds||1} {lang==='de'?'Betten':'Beds'})</span>}
              </div>
              {(currentItem.startDate || currentItem.endDate || defaultStart || defaultEnd) && currentItem.method === 'per_bed' && (
                 <span className="text-[11px] italic text-slate-400 mt-0.5 opacity-80">
                    {formatShortDate(currentItem.startDate || defaultStart)} - {formatShortDate(currentItem.endDate || defaultEnd)}
                 </span>
              )}
              {currentItem.note && (
                 <span className="text-[12px] font-medium text-slate-500 italic mt-1 whitespace-pre-wrap leading-tight">{currentItem.note}</span>
              )}
           </div>

           <div className="flex flex-col items-end shrink-0">
              <span className={cn("text-[14px] font-black", dk ? "text-white" : "text-slate-900")}>
                 {hasNettoInput ? formatCurrency(brutto) : formatCurrency(parseFloat(currentItem.brutto)||0)}
              </span>
              <span className={cn("text-[11px] font-bold mt-0.5", dk ? "text-slate-400" : "text-slate-500")}>
                  {currentItem.method === 'per_bed' ? formatCurrency(parseFloat(currentItem.netto)||0) : '--'} Netto
              </span>
              {currentItem.discountValue > 0 && !hasBruttoInput && <span className="text-[10px] font-black text-teal-500 leading-none mt-1 border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.5 rounded">-{currentItem.discountType === 'percentage' ? `${currentItem.discountValue}%` : `${currentItem.discountValue}€`}</span>}
           </div>
       </div>

       {confirmDelete ? (
           <div className={cn("flex flex-col gap-3 p-3 mt-2 rounded-xl shadow-md border animate-in fade-in slide-in-from-top-2", dk ? "bg-slate-800 border-red-500/30" : "bg-red-50 border-red-200")}>
              <span className="text-[12px] font-black text-red-500 text-center">{lang === 'de' ? 'Zeile endgültig löschen?' : 'Permanently delete row?'}</span>
              <div className="flex gap-2">
                 <button onClick={() => setConfirmDelete(false)} className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm", dk ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-white text-slate-600 border border-slate-200")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
                 <button onClick={onDelete} className="flex-1 py-2 text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-colors text-xs font-bold">{lang === 'de' ? 'Löschen' : 'Delete'}</button>
              </div>
           </div>
       ) : (
           <div className="flex items-center justify-end gap-2 mt-1">
              {!viewOnly && <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400 transition-colors"><Edit3 size={12}/> {lang === 'de' ? 'Bearbeiten' : 'Edit'}</button>}
              {!viewOnly && <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-red-500 bg-red-50 dark:bg-red-500/10 transition-colors"><Trash2 size={12}/></button>}
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
        <div className={cn("absolute top-full left-0 mt-1 w-max min-w-[200px] max-w-[300px] z-[200] rounded-xl border shadow-xl py-1 overflow-hidden", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {filtered.map((opt: string) => <button key={opt} onClick={() => { setDraft(opt); onChange(opt); setEditing(false); setShowOptions(false); }} className={cn("w-full text-left px-4 py-3 text-sm font-bold transition-all truncate", isDarkMode ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}>{opt}</button>)}
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
    <div ref={ref} className="relative flex items-center h-[34px] w-full">
      <input type="number" disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : e.target.value)} className={cn('flex-1 px-2 rounded-l-lg text-[13px] font-bold outline-none border transition-all h-full text-center', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', disabled && "opacity-50 cursor-not-allowed")} placeholder="--" />
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('px-2 h-full rounded-r-lg border border-l-0 transition-all flex items-center justify-center', isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100', disabled && "hidden")}><ChevronDown size={14} /></button>
      {open && !disabled && (
        <div className={cn("absolute top-full left-0 right-0 mt-1 z-[9999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-2.5 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button>)}
        </div>
      )}
    </div>
  );
}

export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select', allowAdd = true, disabled, onOpenChange }: any) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  
  useEffect(() => { if (onOpenChange) onOpenChange(open); }, [open, onOpenChange]);
  const [newVal, setNewVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAddingNew(false); setNewVal(''); } } document.addEventListener('mousedown', handle); return () => document.removeEventListener('mousedown', handle); }, []);
  const displayValue = (val: string) => { if (lang !== 'de') return val; const de: any = { 'Germany': 'Deutschland', 'Switzerland': 'Schweiz', 'Austria': 'Österreich', 'Netherlands': 'Niederlande', 'Poland': 'Polen', 'Belgium': 'Belgien', 'France': 'Frankreich', 'Luxembourg': 'Luxemburg' }; return de[val] || val; };
  return (
    <div ref={ref} className="relative w-full h-[38px]">
      <button disabled={disabled} onClick={() => setOpen(!open)} className={cn('w-full h-full px-3 flex items-center justify-between rounded-lg border text-sm font-bold outline-none transition-all', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white hover:border-teal-500' : 'bg-white border-slate-200 text-slate-900 hover:border-teal-500', disabled && "opacity-60 cursor-not-allowed")}>
        <span className="truncate">{displayValue(value) || placeholder}</span>
        <ChevronDown size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
      </button>
      {open && !disabled && (
        <div className={cn('absolute top-full mt-1 left-0 right-0 z-[200] rounded-xl border shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {options.map((opt:any) => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={cn('w-full text-left px-4 py-3 text-sm font-bold transition-all', value === opt ? (isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700') : (isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'))}>{displayValue(opt)}</button>
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
                  <button onClick={() => { if(newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className="p-2 bg-teal-600 text-white rounded-md hover:bg-teal-500"><Check size={16} strokeWidth={3} /></button>
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
    <div ref={ref} className={cn("relative min-h-[24px] flex items-center w-full", disabled ? "cursor-default" : "cursor-pointer")} onClick={(e) => { if (disabled) return; e.stopPropagation(); setOpen(true); }}>
      <div className="flex flex-wrap gap-1.5 w-full justify-end">
        {safeSelected.length > 0 ? safeSelected.map((tag: string) => (
          <span key={tag} className={cn('px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1.5 shadow-sm truncate max-w-[120px]', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800')}>
            <HighlightText text={tag} query={searchQuery} />
          </span>
        )) : <span className={cn("text-[10px] font-bold border border-dashed px-2 py-1 rounded-md transition-colors flex items-center", isDarkMode ? "text-slate-500 border-white/20 hover:text-teal-400 hover:border-teal-400" : "text-slate-400 border-slate-300 hover:text-teal-600 hover:border-teal-500")}>+ {lang === 'de' ? 'Firma' : 'Company'}</span>}
      </div>
      {open && !disabled && (
        <div className={cn('absolute top-full mt-2 right-0 z-[200] rounded-xl border shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 w-[240px]', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')} onClick={e => e.stopPropagation()}>
          <div className={cn("flex items-center px-3 py-3 border-b", isDarkMode ? "border-white/10 bg-[#1E293B]" : "border-slate-100 bg-slate-50")}>
            <Search size={16} className={isDarkMode ? "text-slate-400" : "text-slate-500"} />
            <input autoFocus autoComplete="new-password" spellCheck="false" name={Math.random().toString()} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }} placeholder={lang === 'de' ? "Suchen..." : "Search..."} className={cn("ml-2 bg-transparent text-sm font-bold outline-none w-full", isDarkMode ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400")} />
          </div>
          <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
            {query.trim() && !exactMatchExists && !isAlreadySelected && (
              <button onClick={handleAddNew} className={cn('w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 transition-all', isDarkMode ? 'text-teal-400 hover:bg-white/10' : 'text-teal-600 hover:bg-teal-50')}><span className="opacity-70 text-xs">Create</span> "{query.trim()}"</button>
            )}
            {filteredOptions.map((opt: string) => {
              const isSelected = safeSelected.includes(opt);
              return (
                <div key={opt} className={cn('w-full flex items-center justify-between group transition-all', isSelected ? (isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50') : (isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'))}>
                  {editingOpt === opt ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 animate-in fade-in" onClick={e => e.stopPropagation()}>
                       <input autoFocus autoComplete="new-password" spellCheck="false" name={Math.random().toString()} value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleInlineRename(opt); else if (e.key === 'Escape') setEditingOpt(null); }} className="flex-1 bg-transparent border-b-2 border-teal-500 outline-none text-sm font-black text-teal-600 dark:text-teal-400 py-1" />
                       <button onClick={() => handleInlineRename(opt)} className="p-1.5 text-white bg-teal-500 hover:bg-teal-600 rounded shadow-sm transition-colors"><Check size={14} strokeWidth={3}/></button>
                       <button onClick={() => setEditingOpt(null)} className="p-1.5 text-slate-500 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded transition-colors"><X size={14} strokeWidth={3}/></button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => handleToggle(opt)} className="flex-1 text-left px-4 py-3 text-sm font-bold flex items-center gap-3">
                        <div className={cn("w-4 h-4 rounded flex items-center justify-center shrink-0 border", isSelected ? "bg-teal-500 border-teal-500" : isDarkMode ? "border-slate-500" : "border-slate-400")}>{isSelected && <Check size={12} className="text-white" strokeWidth={4} />}</div>
                        <span className={cn(isSelected ? (isDarkMode ? 'text-teal-400' : 'text-teal-700') : (isDarkMode ? 'text-slate-300' : 'text-slate-700'))}>{opt}</span>
                      </button>
                      
                      {confirmDeleteOpt === opt ? (
                         <div className="flex items-center gap-1.5 pr-3 animate-in fade-in" onClick={e => e.stopPropagation()}>
                            <span className="text-[10px] font-black text-red-500 uppercase mr-1">{lang === 'de' ? 'Sicher?' : 'Sure?'}</span>
                            <button onClick={() => handleInlineDelete(opt)} className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded shadow-sm transition-colors"><Check size={14} strokeWidth={3}/></button>
                            <button onClick={() => setConfirmDeleteOpt(null)} className="p-1.5 text-slate-600 bg-slate-200 hover:bg-slate-300 rounded transition-colors"><X size={14} strokeWidth={3}/></button>
                         </div>
                      ) : (
                         <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-3 gap-1" onClick={e => e.stopPropagation()}>
                           <button onClick={() => { setEditingOpt(opt); setEditVal(opt); setConfirmDeleteOpt(null); }} className="p-2 text-slate-400 hover:text-teal-500 transition-colors bg-black/5 dark:bg-white/5 rounded-md" title="Rename"><Edit3 size={14}/></button>
                           {onDeleteOption && (<button onClick={() => { setConfirmDeleteOpt(opt); setEditingOpt(null); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-black/5 dark:bg-white/5 rounded-md" title="Delete from system"><Trash2 size={14} /></button>)}
                         </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {filteredOptions.length === 0 && !query.trim() && (<div className="px-4 py-4 text-sm font-bold text-slate-500 text-center">{lang === 'de' ? 'Keine Firmen gefunden' : 'No companies found'}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// MAIN MOBILE ROW COMPONENT
export default function MobileHotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', searchScope = 'all', selectedMonth = null, selectedYear = null, companyOptions = [], cityOptions = [], hotelOptions = [], employeeOptions = [], onDelete, onUpdate, onDeleteCompanyOption, onRenameCompanyOption, onAddOption, viewOnly, isSelected = false, onSelect = () => {}, isBulkActive = false, showGlobalFinancials = false, activeSort = 'created_at', activeFilterDue, activeFilterDeposit }: any) {
 const [activeTab, setActiveTab] = useState<'bookings'|'billing'|'info'>('bookings');
 
 // We replace the global `isOpen` prop with our own local state so tapping ALWAYS works.
 const [isExpanded, setIsExpanded] = useState(false);
  
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
     if (!isExpanded) {
        setLocalMonthFilter('all');
        setInvoiceFilter('all');
        setItemSearchQuery('');
     }
  }, [isExpanded]);

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

  const activeMonthFilter = selectedMonth !== null ? selectedMonth : localMonthFilter;

  // 1. BASE INVOICES (Only filtered by Time, used for stable Math calculations)
  const mathInvoices = useMemo(() => {
     return (localHotel.invoices || []).filter((inv:any) => {
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (d.getFullYear() !== (selectedYear || new Date().getFullYear())) return false;
        if (activeMonthFilter !== 'all' && d.getMonth() !== activeMonthFilter) return false;
        return true;
     });
  }, [localHotel.invoices, selectedYear, activeMonthFilter]);

  // 2. UI INVOICES (Filtered by Search and Paid/Unpaid status for the visual list)
  const filteredMasterInvoices = useMemo(() => {
    let filtered = mathInvoices;
    if (invoiceFilter === 'paid') filtered = filtered.filter((inv:any) => inv.isPaid);
    if (invoiceFilter === 'unpaid') filtered = filtered.filter((inv:any) => !inv.isPaid);

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
  }, [mathInvoices, itemSearchQuery, invoiceFilter, lang]);

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

    const invoicesToScan = activeInvoice ? [activeInvoice] : mathInvoices;

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
  }, [localHotel, activeInvoice, mathInvoices]);

  const sortedEmployees = useMemo(() => {
     const emps = [...masterMath.employees];
     emps.sort((a, b) => {
        const statusWeight = (status: string) => status === 'active' ? 1 : status === 'ending-soon' ? 2 : status === 'upcoming' ? 3 : 4;
        return statusWeight(getEmployeeStatus(a.checkIn, a.checkOut)) - statusWeight(getEmployeeStatus(b.checkIn, b.checkOut));
     });
     return emps;
  }, [masterMath.employees]);

  const sortedDurations = useMemo(() => {
     const durs = [...(localHotel.durations || [])];
     durs.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
     return durs;
  }, [localHotel.durations]);

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
  const inputCls = cn('w-full px-3 py-2.5 rounded-lg text-sm font-bold outline-none border transition-all', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400', viewOnly && "opacity-60 cursor-default");

  return (
    <div className={cn('w-full rounded-2xl border mb-3 transition-all duration-200 shadow-sm relative overflow-hidden', 
          isSelected ? (dk ? 'bg-teal-500/10 border-teal-500/50' : 'bg-teal-50 border-teal-500/40') 
          : isExpanded ? (dk ? 'bg-[#1E293B] border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.1)]' : 'bg-white border-teal-400/60 shadow-[0_0_15px_rgba(20,184,166,0.15)]') 
          : (dk ? 'bg-[#1E293B] border-white/5' : 'bg-white border-slate-200'))}
         style={{ zIndex: isDropdownActive ? 99999 : 10 }}
    >
      <div className={cn("absolute top-0 bottom-0 left-0 w-1.5 transition-colors z-[60]", masterMath.totalUnpaid > 0 ? "bg-red-500" : (masterMath.totalPaid > 0 ? "bg-emerald-500" : "bg-transparent border-r border-slate-200 dark:border-white/10"))} />

      {/* MOBILE COLLAPSED VIEW (Always Visible) */}
      <div className="p-3 pl-4 flex flex-col">
         
         <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
               <SeamlessInput disabled={viewOnly} value={localHotel.name} options={hotelOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ name: val })} placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel Name...'} textClass={cn('text-lg font-black leading-tight', dk ? 'text-white' : 'text-slate-900')} searchQuery={searchScope === 'all' || searchScope === 'hotel' ? searchQuery : ''} />
               <div className="flex items-center gap-1.5 mt-1">
                  <MapPin size={12} className={dk ? "text-slate-500" : "text-slate-400"} /> 
                  <SeamlessInput disabled={viewOnly} value={localHotel.city} options={cityOptions} isDarkMode={dk} onChange={(val:any) => patchHotel({ city: val })} placeholder={lang === 'de' ? 'Stadt...' : 'City...'} textClass={cn("text-[11px] font-bold uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")} searchQuery={searchScope === 'all' || searchScope === 'city' ? searchQuery : ''} />
               </div>
            </div>

            {/* COMPANY TAG MOVED TO RIGHT SIDE */}
            <div className="shrink-0 w-[120px] text-right" onClick={e => e.stopPropagation()}>
               <CompanyMultiSelect onOpenChange={setIsDropdownActive} disabled={viewOnly} selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={(tags:any) => patchHotel({ companyTag: tags })} onDeleteOption={onDeleteCompanyOption} onRenameOption={onRenameCompanyOption} onAddOption={onAddOption} searchQuery={searchScope === 'all' || searchScope === 'company' ? searchQuery : ''} />
            </div>

            <button onClick={handleBookmarkToggle} className={cn("ml-2 p-1.5 rounded-full transition-colors shrink-0", isBookmarked ? "text-yellow-500 bg-yellow-500/10" : "text-slate-400 bg-slate-100 dark:bg-white/5 dark:hover:text-white")}>
               <Star size={18} className={isBookmarked ? "fill-yellow-500" : ""} />
            </button>
         </div>

         {/* MOBILE METRICS BLOCK (Correct Bed / Users Icons) */}
         <div className={cn("flex items-center justify-between p-3 rounded-xl border mt-3", dk ? "bg-black/20 border-white/5" : "bg-slate-50 border-slate-100")}>
             <div className="flex items-center gap-4">
                 <div className="flex flex-col items-center justify-center gap-1">
                     <Bed size={14} className={dk ? "text-slate-500" : "text-slate-400"} strokeWidth={3} />
                     <span className={cn('text-sm font-black leading-none', masterMath.freeBeds > 0 ? 'text-red-500' : dk ? 'text-teal-500' : 'text-teal-600')}>{masterMath.freeBeds}</span>
                 </div>
                 <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
                 <div className="flex flex-col items-center justify-center gap-1">
                     <Users size={14} className={dk ? "text-slate-500" : "text-slate-400"} strokeWidth={3} />
                     <span className={cn('text-sm font-black leading-none', dk ? 'text-slate-300' : 'text-slate-700')}>{masterMath.totalBeds}</span>
                 </div>
             </div>
             
             <div className="flex flex-col items-end">
                <span className={cn('font-black text-xl leading-none', dk ? 'text-white' : 'text-slate-900')}>
                   {formatCurrency(masterMath.displayBrutto)}
                </span>
                {masterMath.nearestDueDate && (
                   <span className="text-[9px] font-bold text-red-500 mt-1 uppercase tracking-wider">
                      {lang === 'de' ? 'Fällig: ' : 'Due: '} {formatShortDate(masterMath.nearestDueDate)}
                   </span>
                )}
             </div>
         </div>

         {/* 4-COLUMN DURATIONS GRID (Max 8) */}
         {sortedDurations.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mt-3">
               {sortedDurations.slice(0, 8).map((d: any, i: number) => {
                   const formatChipStr = (iso: string) => {
                       if (!iso) return '';
                       const date = new Date(iso);
                       const locale = lang === 'de' ? 'de-DE' : 'en-GB';
                       return `${date.getDate().toString().padStart(2, '0')} ${date.toLocaleString(locale, { month: 'short' }).replace('.', '')}`;
                   };
                   return (
                      <button key={i} onClick={(e) => { e.stopPropagation(); setIsExpanded(true); setActiveTab('bookings'); setActiveDurationTab(i); }} className={cn("px-1 py-1 rounded text-[9px] font-bold border text-center truncate", dk ? "bg-slate-800 border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-700")}>
                         {d.startDate && d.endDate ? `${formatChipStr(d.startDate)} - ${formatChipStr(d.endDate)}` : 'New'}
                      </button>
                   )
               })}
               {sortedDurations.length > 8 && (
                   <button onClick={(e) => { e.stopPropagation(); setIsExpanded(true); setActiveTab('bookings'); }} className={cn("px-1 py-1 rounded text-[9px] font-bold border text-center", dk ? "bg-teal-500/20 border-teal-500/30 text-teal-400" : "bg-teal-50 border-teal-200 text-teal-700")}>
                      +{sortedDurations.length - 8}
                   </button>
               )}
            </div>
         )}
         
         {/* 5-COLUMN EMPLOYEES GRID (Max 10) */}
         {sortedEmployees.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5 mt-2">
               {sortedEmployees.slice(0, 10).map((emp: any, i: number) => {
                  const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                  
                  // Color assignment
                  const borderCls = status === 'active' ? (dk ? "border-emerald-500/50" : "border-emerald-600") : status === 'upcoming' ? (dk ? "border-blue-500/50" : "border-blue-600") : status === 'ending-soon' ? (dk ? "border-red-500/50" : "border-red-600") : (dk ? "border-slate-500/40" : "border-slate-400");
                  const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                  
                  // Dashed Border Logic
                  const parentDur = localHotel.durations.find((d:any) => (d.roomCards||[]).some((rc:any) => (rc.employees||[]).some((e:any) => e.id === emp.id)));
                  const isPartial = parentDur && (emp.checkIn > parentDur.startDate || emp.checkOut < parentDur.endDate);
                  const shortName = emp.name ? emp.name.trim().split(' ').pop() : '_ _ _';

                  return (
                     <button key={i} onClick={(e) => { 
                         e.stopPropagation(); 
                         setIsExpanded(true); 
                         setActiveTab('bookings'); 
                         // Automatically find which duration tab this employee belongs to
                         const tIdx = localHotel.durations.findIndex((dur:any) => (dur.roomCards||[]).some((rc:any) => (rc.employees||[]).some((ex:any) => ex.id === emp.id)));
                         setActiveDurationTab(tIdx >= 0 ? tIdx : 0);
                         // Open the specific room card
                         setTimeout(() => window.dispatchEvent(new CustomEvent('open-emp-slot', { detail: emp.id })), 300);
                     }} className={cn("px-1 py-1 rounded-full text-[8.5px] font-bold flex items-center justify-center gap-1 border truncate transition-all", borderCls, isPartial ? "border-dashed" : "border-solid", dk ? "bg-[#1E293B] text-slate-200" : "bg-slate-50 text-slate-800")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                        <span className="truncate"><HighlightText text={shortName} query={searchScope === 'all' || searchScope === 'employee' ? searchQuery : ''} /></span>
                     </button>
                  )
               })}
               {sortedEmployees.length > 10 && (
                   <button onClick={(e) => { e.stopPropagation(); setIsExpanded(true); setActiveTab('bookings'); }} className={cn("px-1 py-1 rounded-full text-[8.5px] font-bold border text-center transition-all", dk ? "bg-teal-500/20 border-teal-500/30 text-teal-400" : "bg-teal-50 border-teal-200 text-teal-700")}>
                      +{sortedEmployees.length - 10}
                   </button>
               )}
            </div>
         )}

         {/* EXPAND TOGGLE (Uses local state isExpanded) */}
         <button onClick={() => setIsExpanded(!isExpanded)} className={cn("w-full mt-3 pt-3 border-t flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors", dk ? "border-white/5 text-slate-400 hover:text-white" : "border-slate-100 text-slate-500 hover:text-slate-900")}>
            {isExpanded ? <ChevronUp size={14} className="text-teal-500"/> : <ChevronDown size={14} className="text-teal-500"/>} 
            {isExpanded ? (lang === 'de' ? 'Schließen' : 'Close') : (lang === 'de' ? 'Details öffnen' : 'Open Details')}
         </button>
      </div>

      {/* MOBILE EXPANDED VIEW */}
      {isExpanded && (
         <div className={cn("flex flex-col border-t", dk ? "bg-[#0B1224] border-white/5" : "bg-slate-50 border-slate-200")} onClick={e => e.stopPropagation()}>
            
            {/* Mobile Tabs */}
            <div className="flex items-center px-2 pt-2 border-b border-slate-200 dark:border-white/10">
               <button onClick={() => setActiveTab('bookings')} className={cn("flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center", activeTab === 'bookings' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500")}>{lang === 'de' ? 'Buchungen' : 'Bookings'}</button>
               <button onClick={() => setActiveTab('billing')} className={cn("flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center", activeTab === 'billing' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500")}>{lang === 'de' ? 'Rechnungen' : 'Billing'}</button>
               <button onClick={() => setActiveTab('info')} className={cn("flex-1 py-3 text-xs font-bold transition-all border-b-2 text-center", activeTab === 'info' ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-slate-500")}>{lang === 'de' ? 'Info' : 'Info'}</button>
            </div>

            {/* TAB: BOOKINGS */}
            {activeTab === 'bookings' && (
               <div className="p-3 bg-white dark:bg-[#1E293B] animate-in fade-in flex flex-col gap-4">
                  
                  {/* Duration Pills Slider */}
                  <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                     {(localHotel.durations || []).map((d: any, i: number) => {
                        const isActive = activeDurationTab === i;
                        return (
                           <button key={d.id || i} onClick={() => setActiveDurationTab(i)} className={cn('px-4 py-2 text-xs font-bold transition-all border rounded-xl whitespace-nowrap shrink-0', isActive ? (dk ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-teal-50 text-teal-700 border-teal-200') : (dk ? 'bg-black/20 text-slate-400 border-white/5' : 'bg-slate-100 text-slate-500 border-slate-200'))}>
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
                        }} className={cn("px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-dashed shrink-0", dk ? "border-white/20 text-slate-400 bg-white/5" : "border-slate-300 text-slate-500 bg-white")}>
                           {creatingDuration ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />} {lang === 'de' ? 'Neu' : 'New'}
                        </button>
                     )}
                  </div>

                  {/* Active Duration Card */}
                  {localHotel.durations[activeDurationTab] && (
                     <div className="relative z-0 -mt-2">
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

            {/* TAB: BILLING */}
            {activeTab === 'billing' && (
               <div className="flex flex-col animate-in fade-in">
                  
                  {/* Invoice Header / Selector */}
                  <div className={cn("p-4 border-b flex flex-col gap-3 shrink-0", dk ? "bg-[#0F172A] border-white/5" : "bg-slate-50 border-slate-200")}>
                     <div className="flex items-center justify-between">
                        <label className={labelCls}><Receipt size={14}/> {lang === 'de' ? 'Rechnungen' : 'Invoices'}</label>
                        {!viewOnly && (
                           <button onClick={() => {
                              const newId = Math.random().toString();
                              const newDraft = { id: newId, number: '', note: '', isPaid: false, billingMode: 'detailed', items: [], startDate: null, endDate: null, dueDate: null, paymentDate: null };
                              setInvoiceDraft(newDraft); setEditingInvoiceId(newId); setSelectedInvoiceId(newId);
                           }} className="p-1.5 rounded-lg text-white bg-teal-500 hover:bg-teal-600 transition-all shadow-sm"><Plus size={14} strokeWidth={3} /></button>
                        )}
                     </div>
                     
                     {/* Horizontal scrolling invoice list */}
                     <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {filteredMasterInvoices.length === 0 && !editingInvoiceId ? (
                           <span className="text-xs text-slate-400 italic py-2">{lang === 'de' ? 'Keine Rechnungen' : 'No invoices'}</span>
                        ) : (
                           filteredMasterInvoices.map((inv: any) => {
                              const isActive = selectedInvoiceId === inv.id;
                              const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
                              let invBrutto = inv.billingMode === 'total' ? (parseFloat(inv.totalNetto)||0) * (1 + (parseFloat(inv.totalMwst)||0)/100) : (inv.items||[]).reduce((sum:number, it:any) => sum + calcInvoiceItem(it, defaultN).brutto, 0);
                              return (
                                 <button key={inv.id} onClick={() => { setSelectedInvoiceId(isActive ? null : inv.id); setEditingItemId(null); setEditingTotal(false); }} className={cn("flex flex-col p-2.5 rounded-xl border text-left shrink-0 min-w-[140px] transition-all", isActive ? (dk ? "bg-teal-900/40 border-teal-500/60 shadow-md" : "bg-teal-50 border-teal-400 shadow-md") : (dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200"))}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                       <span className={cn("w-2 h-2 rounded-full shrink-0", inv.isPaid ? "bg-emerald-500" : "bg-red-500")} />
                                       <span className={cn("text-xs font-black truncate", dk ? "text-white" : "text-slate-900")}>{inv.number || 'Unnamed'}</span>
                                    </div>
                                    <span className={cn("text-xs font-bold", isActive ? "text-teal-600 dark:text-teal-400" : (dk ? "text-slate-400" : "text-slate-500"))}>{formatCurrency(invBrutto)}</span>
                                 </button>
                              )
                           })
                        )}
                        {/* Draft Invoice Card */}
                        {editingInvoiceId && invoiceDraft && !localHotel.invoices.find((i:any) => i.id === editingInvoiceId) && (
                           <div className={cn("flex flex-col p-2.5 rounded-xl border shrink-0 min-w-[140px] border-teal-500 border-dashed bg-teal-500/10")}>
                              <span className="text-xs font-black text-teal-600 dark:text-teal-400">{lang === 'de' ? 'Neue Rechnung' : 'New Invoice'}</span>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Active Invoice Content */}
                  <div className="p-3 bg-white dark:bg-transparent min-h-[300px]">
                     {editingInvoiceId && invoiceDraft ? (
                        // INVOICE META EDIT MODE
                        <div className={cn("flex flex-col gap-3 p-4 rounded-2xl border shadow-lg animate-in fade-in slide-in-from-top-2", dk ? "bg-[#1E293B] border-teal-500/30" : "bg-white border-teal-300")}>
                           <input autoFocus value={invoiceDraft.number} onChange={e => setInvoiceDraft({...invoiceDraft, number: e.target.value})} className="w-full text-lg font-black border-b-2 bg-transparent outline-none py-1 border-teal-500 focus:ring-0 placeholder:text-slate-400" placeholder="RE-..." />
                           
                           <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={12}/> {lang === 'de' ? 'Start' : 'Start'}</label>
                                 <NativeDatePicker dk={dk} value={invoiceDraft.startDate || ''} onChange={(s: string) => setInvoiceDraft({...invoiceDraft, startDate: s})} className="w-full h-[38px]" />
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={12}/> {lang === 'de' ? 'Ende' : 'End'}</label>
                                 <NativeDatePicker dk={dk} disabled={!invoiceDraft.startDate} min={invoiceDraft.startDate} value={invoiceDraft.endDate || ''} onChange={(end: string) => setInvoiceDraft({...invoiceDraft, endDate: end})} className="w-full h-[38px]" />
                              </div>
                           </div>

                           <div className="flex flex-col gap-1 mt-1">
                              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Calendar size={12}/> {lang === 'de' ? 'Fällig am:' : 'Payment Due:'}</label>
                              <NativeDatePicker dk={dk} value={invoiceDraft.dueDate || ''} onChange={(due: string) => setInvoiceDraft({...invoiceDraft, dueDate: due})} className="w-full h-[38px]" />
                           </div>

                           <div className="flex items-center justify-between p-3 mt-1 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{lang === 'de' ? 'Status' : 'Status'}</span>
                              <button onClick={() => setInvoiceDraft({...invoiceDraft, isPaid: !invoiceDraft.isPaid})} className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors", invoiceDraft.isPaid ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400")}>
                                 {invoiceDraft.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Unpaid')}
                              </button>
                           </div>

                           {invoiceDraft.isPaid && (
                              <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
                                 <label className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Calendar size={12}/> {lang === 'de' ? 'Bezahlt am:' : 'Paid On:'}</label>
                                 <NativeDatePicker dk={dk} value={invoiceDraft.paymentDate || ''} onChange={(pd: string) => setInvoiceDraft({...invoiceDraft, paymentDate: pd})} className="w-full h-[38px] [&>div]:border-emerald-500 [&>div]:text-emerald-600 dark:[&>div]:text-emerald-400" />
                              </div>
                           )}

                           <textarea value={invoiceDraft.note || ''} onChange={e => setInvoiceDraft({...invoiceDraft, note: e.target.value})} className={cn(inputCls, "min-h-[80px] resize-none")} placeholder={lang === 'de' ? "Notiz hinzufügen..." : "Add note..."} />
                           
                           <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-200 dark:border-white/10">
                              <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Discard draft?')) { setEditingInvoiceId(null); setInvoiceDraft(null); if (!localHotel.invoices.find((i:any) => i.id === editingInvoiceId)) setSelectedInvoiceId(null); } }} className="p-3 text-slate-400 hover:text-red-500 rounded-lg bg-slate-100 dark:bg-white/5"><Trash2 size={16} /></button>
                              <button disabled={!invoiceDraft.number || !invoiceDraft.startDate || !invoiceDraft.endDate || (invoiceDraft.isPaid && !invoiceDraft.paymentDate)} onClick={(e) => { 
                                 e.stopPropagation(); 
                                 const isNew = !localHotel.invoices.find((i:any) => i.id === editingInvoiceId);
                                 patchHotel({ invoices: isNew ? [invoiceDraft, ...localHotel.invoices] : localHotel.invoices.map((i:any) => i.id === editingInvoiceId ? invoiceDraft : i) }); 
                                 setSelectedInvoiceId(invoiceDraft.id); setEditingInvoiceId(null); setInvoiceDraft(null); 
                              }} className="px-6 py-3 text-white bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-all font-black flex items-center gap-2"><Check size={16} strokeWidth={3} /> {lang === 'de' ? 'Speichern' : 'Save'}</button>
                           </div>
                        </div>
                     ) : activeInvoice ? (
                        // ACTIVE INVOICE VIEW
                        <div className="flex flex-col animate-in fade-in">
                           <div className={cn("p-4 rounded-xl border flex flex-col gap-3 mb-4", dk ? "bg-[#1E293B] border-white/10" : "bg-slate-50 border-slate-200")}>
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h4 className={cn("text-lg font-black leading-tight", dk ? "text-white" : "text-slate-900")}>{activeInvoice.number}</h4>
                                    <p className="text-xs font-bold text-slate-500 mt-1">{activeInvoice.startDate ? formatShortDate(activeInvoice.startDate, lang) : '--'} - {activeInvoice.endDate ? formatShortDate(activeInvoice.endDate, lang) : '--'} ({calculateNights(activeInvoice.startDate, activeInvoice.endDate)}N)</p>
                                 </div>
                                 {!viewOnly && (
                                    <button onClick={() => { setEditingInvoiceId(activeInvoice.id); setInvoiceDraft(activeInvoice); }} className="p-2 bg-black/5 dark:bg-white/5 rounded-lg text-slate-500 hover:text-teal-600 transition-all"><Edit3 size={16} /></button>
                                 )}
                              </div>
                              <div className="flex gap-2">
                                 <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-black uppercase", activeInvoice.isPaid ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>{activeInvoice.isPaid ? 'Bezahlt' : 'Offen'}</span>
                                 {!activeInvoice.isPaid && activeInvoice.dueDate && <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">Fällig: {formatShortDate(activeInvoice.dueDate, lang)}</span>}
                              </div>
                              {activeInvoice.note && <p className="text-xs font-medium text-slate-500 italic mt-1 pt-3 border-t border-slate-200 dark:border-white/10">{activeInvoice.note}</p>}
                           </div>

                           {/* Switcher Total / Detailed */}
                           {!viewOnly && (
                              <div className={cn("flex items-center p-1.5 rounded-xl border mb-4", dk ? "bg-black/40 border-white/10" : "bg-slate-100 border-slate-200")}>
                                 <button disabled={activeInvoice.items?.length > 0} onClick={() => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, billingMode: 'total'} : i) }); setEditingTotal(false); setEditingItemId(null); }} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", activeInvoice.billingMode === 'total' ? (dk ? "bg-teal-500 text-white" : "bg-white shadow-md text-teal-700") : "text-slate-400 disabled:opacity-30")}>💰 {lang === 'de' ? 'Gesamtbetrag' : 'Total'}</button>
                                 <button disabled={activeInvoice.totalNetto || activeInvoice.totalBrutto} onClick={() => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, billingMode: 'detailed'} : i) }); setEditingTotal(false); }} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", activeInvoice.billingMode !== 'total' ? (dk ? "bg-teal-500 text-white" : "bg-white shadow-md text-teal-700") : "text-slate-400 disabled:opacity-30")}>📝 {lang === 'de' ? 'Detailliert' : 'Detailed'}</button>
                              </div>
                           )}

                           {/* Invoice Content */}
                           {activeInvoice.billingMode === 'total' ? (
                              <div ref={totalRef} className={cn("flex flex-col p-4 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-top-2", dk ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200", editingTotal && (dk ? "border-teal-500/50 shadow-xl bg-teal-900/20" : "border-teal-300 shadow-xl bg-teal-50"))}>
                                 
                                 {/* Edit Button */}
                                 {!viewOnly && !editingTotal && (
                                    <button onClick={() => {
                                       setTotalDraft({ totalNetto: activeInvoice.totalNetto, totalBrutto: activeInvoice.totalBrutto, totalMwst: activeInvoice.totalMwst, discountValue: activeInvoice.discountValue, discountType: activeInvoice.discountType || 'fixed', note: activeInvoice.note });
                                       setShowTotalDiscount(parseFloat(activeInvoice.discountValue || 0) > 0);
                                       setEditingTotal(true);
                                    }} className="self-end mb-4 p-2 bg-slate-100 dark:bg-white/10 rounded-lg text-slate-500 hover:text-teal-600 transition-colors"><Edit3 size={14}/></button>
                                 )}

                                 <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                       <label className="text-[10px] font-bold text-slate-500 uppercase">Netto</label>
                                       <div className="relative">
                                          <input disabled={viewOnly || !editingTotal || (editingTotal ? totalDraft?.totalBrutto : activeInvoice.totalBrutto)} type="number" value={editingTotal ? (totalDraft?.totalNetto ?? '') : (activeInvoice.totalNetto ?? '')} onChange={e => setTotalDraft({...totalDraft, totalNetto: e.target.value, totalBrutto: null})} className={cn(inputCls, "w-full disabled:opacity-50 text-right text-lg")} placeholder="0.00" />
                                          {(!showTotalDiscount && !(editingTotal ? totalDraft?.totalBrutto : activeInvoice.totalBrutto) && editingTotal && !viewOnly) && <button onClick={() => { setShowTotalDiscount(true); if(!totalDraft?.discountType) setTotalDraft({...totalDraft, discountType: 'fixed'}); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded text-slate-400 hover:text-teal-500 bg-black/5 dark:bg-white/5"><Ticket size={14}/></button>}
                                       </div>
                                    </div>
                                    
                                    {showTotalDiscount && !(editingTotal ? totalDraft?.totalBrutto : activeInvoice.totalBrutto) && (
                                       <div className="flex items-center w-full animate-in fade-in">
                                          <input disabled={!editingTotal} type="number" value={editingTotal ? (totalDraft?.discountValue ?? '') : (activeInvoice.discountValue ?? '')} onChange={e => setTotalDraft({...totalDraft, discountValue: e.target.value})} className={cn(inputCls, "rounded-r-none border-r-0 flex-1 px-3 text-right")} placeholder="Rabatt" />
                                          <button disabled={!editingTotal} onClick={() => setTotalDraft({...totalDraft, discountType: totalDraft?.discountType === 'percentage' ? 'fixed' : 'percentage'})} className={cn("w-[50px] h-[42px] border-y border-r text-sm font-bold transition-colors disabled:opacity-50", dk ? "bg-white/10 text-white border-white/10" : "bg-slate-200 text-slate-700 border-slate-200")}>{editingTotal ? (totalDraft?.discountType === 'percentage' ? '%' : '€') : (activeInvoice.discountType === 'percentage' ? '%' : '€')}</button>
                                          {editingTotal && <button onClick={() => { setShowTotalDiscount(false); setTotalDraft({...totalDraft, discountValue: null}); }} className={cn("w-[40px] h-[42px] rounded-r border-y border-r flex items-center justify-center transition-colors text-slate-400 hover:text-red-500", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200")}><X size={16}/></button>}
                                       </div>
                                    )}

                                    <div className="flex items-center gap-4">
                                       <div className="w-[100px] flex flex-col gap-1 shrink-0">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase">MwSt</label>
                                          {editingTotal && !viewOnly ? (
                                             <MwstInput value={totalDraft?.totalMwst} onChange={(v:any) => setTotalDraft({...totalDraft, totalMwst: v})} isDarkMode={dk} />
                                          ) : (
                                             <div className={cn(inputCls, "text-center opacity-50")}>{activeInvoice.totalMwst || 7}%</div>
                                          )}
                                       </div>
                                       <div className="flex-1 flex flex-col gap-1">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase">Brutto</label>
                                          <input disabled={viewOnly || !editingTotal || (editingTotal ? totalDraft?.totalNetto : activeInvoice.totalNetto)} type="number" value={editingTotal ? (totalDraft?.totalBrutto ?? '') : (activeInvoice.totalBrutto ?? '')} onChange={e => setTotalDraft({...totalDraft, totalBrutto: e.target.value, totalNetto: null})} className={cn(inputCls, "w-full disabled:opacity-100 disabled:bg-transparent disabled:border-transparent font-black text-xl text-right placeholder-slate-900 dark:placeholder-white")} placeholder={(editingTotal ? totalDraft?.totalNetto : activeInvoice.totalNetto) ? formatCurrency(parseFloat((editingTotal ? totalDraft?.totalNetto : activeInvoice.totalNetto)) * (1 + (parseFloat((editingTotal ? totalDraft?.totalMwst : activeInvoice.totalMwst))||0)/100)) : "0.00"} />
                                       </div>
                                    </div>

                                    {editingTotal && (
                                       <>
                                          <textarea disabled={!editingTotal} rows={2} value={editingTotal ? (totalDraft?.note || '') : (activeInvoice.note || '')} onChange={e => setTotalDraft({...totalDraft, note: e.target.value})} className={cn(inputCls, "w-full text-sm font-medium resize-none")} placeholder={lang === 'de' ? "Notiz (Optional)..." : "Note (Optional)..."} />
                                          <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t dark:border-teal-500/30 border-teal-200">
                                             <button onClick={() => setEditingTotal(false)} className={cn("px-4 py-2 rounded-lg text-sm font-bold border", dk ? "border-white/10 text-slate-300" : "border-slate-200 text-slate-600")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
                                             <button onClick={() => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, ...totalDraft} : i) }); setEditingTotal(false); }} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-teal-500 shadow-md">{lang === 'de' ? 'Speichern' : 'Save'}</button>
                                          </div>
                                       </>
                                    )}
                                 </div>
                              </div>
                           ) : (
                              <div className="flex flex-col gap-2">
                                 {(activeInvoice.items || []).length === 0 && <p className="text-sm font-bold text-slate-400 italic text-center py-10 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">{lang === 'de' ? 'Noch keine Posten vorhanden.' : 'No line items yet.'}</p>}
                                 
                                 {(activeInvoice.items || []).map((item: any) => {
                                    const isEditing = editingItemId === item.id;
                                    const defaultN = activeInvoice.startDate && activeInvoice.endDate ? calculateNights(activeInvoice.startDate, activeInvoice.endDate) : 1;
                                    
                                    if (isEditing) {
                                       return <MobileInvoiceLineItem key={item.id} item={item} dk={dk} lang={lang} viewOnly={viewOnly} defaultNights={defaultN} defaultStart={activeInvoice.startDate} defaultEnd={activeInvoice.endDate} isEditing={true} onSave={(savedDraft: any) => { patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, items: i.items.map((it:any) => it.id === item.id ? savedDraft : it)} : i) }); setEditingItemId(null); }} onCancel={() => setEditingItemId(null)} />
                                    }

                                    const { finalNetto, mwst, brutto } = calcInvoiceItem(item, defaultN);
                                    
                                    return (
                                       <div key={item.id} className={cn("flex flex-col p-3 rounded-xl border shadow-sm", dk ? "bg-[#1E293B] border-white/5" : "bg-white border-slate-200")}>
                                          <div className="flex justify-between items-start mb-2">
                                             <div className="flex flex-col">
                                                <span className={cn("text-sm font-black", dk ? "text-slate-200" : "text-slate-800")}>{getTranslation(COST_TYPES, item.type || 'room', lang)}</span>
                                                {item.method === 'per_bed' && <span className="text-[10px] text-slate-500 font-bold">({item.nights||defaultN} {lang==='de'?'Nächte':'Nights'}, {item.beds||1} {lang==='de'?'Betten':'Beds'})</span>}
                                             </div>
                                             <div className="flex items-center gap-1">
                                                {!viewOnly && <button onClick={() => setEditingItemId(item.id)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 transition-colors"><Edit3 size={14}/></button>}
                                                {!viewOnly && <button onClick={() => { if(window.confirm('Delete item?')) patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, items: i.items.filter((it:any) => it.id !== item.id)} : i) }); setEditingItemId(null); }} className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 transition-colors"><Trash2 size={14}/></button>}
                                             </div>
                                          </div>
                                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5">
                                             <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Netto</span>
                                                <span className={cn("text-xs font-bold", dk ? "text-slate-300" : "text-slate-700")}>{formatCurrency(finalNetto)}</span>
                                             </div>
                                             <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">MwSt</span>
                                                <span className="text-xs font-bold text-slate-500">{mwst}%</span>
                                             </div>
                                             <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Brutto</span>
                                                <span className={cn("text-sm font-black", dk ? "text-white" : "text-slate-900")}>{formatCurrency(brutto)}</span>
                                             </div>
                                          </div>
                                          {item.note && <p className="text-[11px] font-medium text-slate-500 italic mt-2">{item.note}</p>}
                                       </div>
                                    )
                                 })}
                                 {!viewOnly && !editingItemId && (
                                    <button onClick={() => {
                                       const newId = Math.random().toString();
                                       patchHotel({ invoices: localHotel.invoices.map((i:any) => i.id === activeInvoice.id ? {...i, items: [...(i.items||[]), { id: newId, type: 'room', method: 'per_bed', netto: null, mwst: 7, brutto: null }]} : i) });
                                       setEditingItemId(newId);
                                    }} className={cn("w-full py-3 rounded-xl border border-dashed text-sm font-black uppercase tracking-widest transition-all", dk ? "border-white/20 text-slate-400 bg-white/5 hover:bg-white/10" : "border-slate-300 text-slate-500 bg-white hover:bg-slate-50")}>+ {lang === 'de' ? 'Posten hinzufügen' : 'Add Item'}</button>
                                 )}
                              </div>
                           )}
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                           <Receipt size={48} className="mb-4 text-slate-400" />
                           <p className="text-sm font-bold">{lang === 'de' ? 'Wählen Sie eine Rechnung oben aus' : 'Select an invoice above'}</p>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* TAB: INFO */}
            {activeTab === 'info' && (() => {
               const seamlessInput = cn('w-full px-3 py-3 rounded-xl text-sm font-bold outline-none border transition-all h-[46px]', dk ? 'bg-black/20 border-white/10 text-white focus:bg-[#1E293B] focus:border-teal-500 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-teal-500 placeholder-slate-400', viewOnly && "opacity-60 cursor-default");
               
               return (
                 <div className="p-4 bg-white dark:bg-[#0B1224] animate-in fade-in flex flex-col gap-4">
                    <div className="flex flex-col">
                       <label className={cn(labelCls, 'mb-1.5')}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label>
                       <input disabled={viewOnly} autoComplete="off" value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} className={seamlessInput} placeholder="..." />
                    </div>
                    <div className="flex flex-col">
                       <label className={cn(labelCls, 'mb-1.5')}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact'}</label>
                       <input disabled={viewOnly} autoComplete="off" value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} className={seamlessInput} placeholder="..." />
                    </div>
                    <div className="flex flex-col">
                       <label className={cn(labelCls, 'mb-1.5')}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label>
                       <div className={cn('flex items-center rounded-xl border overflow-hidden h-[46px] transition-colors focus-within:border-teal-500', dk ? 'bg-black/20 border-white/10 focus-within:bg-[#1E293B]' : 'bg-slate-50 border-slate-200 focus-within:bg-white')}>
                          <span className={cn("px-3 text-sm font-bold border-r h-full flex items-center shrink-0 opacity-60", dk ? "border-white/10 text-slate-300" : "border-slate-200 text-slate-600")}>{getCountryCode(localHotel.country || 'Germany')}</span>
                          <input disabled={viewOnly} autoComplete="off" value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} className="w-full px-3 py-3 text-sm font-bold outline-none bg-transparent h-full" placeholder="..." />
                       </div>
                    </div>
                    <div className="flex flex-col">
                       <label className={cn(labelCls, 'mb-1.5')}><Mail size={12}/> Email</label>
                       <div className="relative flex items-center group">
                          <input disabled={viewOnly} autoComplete="off" value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} className={cn(seamlessInput, 'pr-12')} placeholder="..." />
                          {localHotel.email && <a href={`mailto:${localHotel.email}`} className="absolute right-2 p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500"><Mail size={14} /></a>}
                       </div>
                    </div>
                    <div className="flex flex-col">
                       <label className={cn(labelCls, 'mb-1.5')}><Globe size={12}/> {lang === 'de' ? 'Webseite' : 'Website'}</label>
                       <div className="relative flex items-center group">
                          <input disabled={viewOnly} autoComplete="off" value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} onKeyDown={handleEnterBlur} className={cn(seamlessInput, 'pr-12')} placeholder="..." />
                          {localHotel.website && <a href={localHotel.website.startsWith('http') ? localHotel.website : `https://${localHotel.website}`} target="_blank" rel="noreferrer" className="absolute right-2 p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500"><ExternalLink size={14} /></a>}
                       </div>
                    </div>
                    <div className="flex flex-col">
                       <label className={cn(labelCls, 'mb-1.5')}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                       <div className={cn("rounded-xl border transition-all h-[46px]", dk ? "border-white/10 bg-black/20" : "border-slate-200 bg-slate-50")}>
                          <ModernDropdown disabled={viewOnly} value={localHotel.country || 'Germany'} options={getCountryOptions()} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} onOpenChange={setIsDropdownActive} />
                       </div>
                    </div>
                    <div className="flex flex-col pt-2">
                       <label className={cn(labelCls, 'mb-1.5')}><StickyNote size={12}/> {lang === 'de' ? 'Notiz' : 'Note'}</label>
                       <textarea disabled={viewOnly} autoComplete="off" value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} className={cn('w-full px-3 py-3 rounded-xl text-sm font-medium outline-none border transition-all min-h-[100px] resize-y', dk ? 'bg-black/20 border-white/10 text-white focus:bg-[#1E293B] focus:border-teal-500 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-teal-500 placeholder-slate-400')} placeholder={lang === 'de' ? "Private Notizen hier eintragen..." : "Write private notes here..."} />
                    </div>
                 </div>
               );
            })()}
         </div>
      )}
    </div>
  );
}
