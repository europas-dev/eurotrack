// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock } from 'lucide-react';
import {
  cn, formatCurrency, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatDateChip
} from '../lib/utils';
import { createDuration, updateHotel, deleteHotel } from '../lib/supabase';
import { calcRoomCardTotal } from '../lib/roomCardUtils';
import DurationCard from './DurationCard';

export const DEFAULT_COUNTRIES = [
  'Germany', 'Switzerland', 'Austria', 'Netherlands', 'Poland', 'Belgium', 'France', 'Luxembourg'
];

// THE FIX: Returns simple strings to prevent React Error #31
export function getCountryOptions(lang: string = 'de') {
  const de: any = { 'Germany': 'Deutschland', 'Switzerland': 'Schweiz', 'Austria': 'Österreich', 'Netherlands': 'Niederlande', 'Poland': 'Polen', 'Belgium': 'Belgien', 'France': 'Frankreich', 'Luxembourg': 'Luxemburg' };
  return DEFAULT_COUNTRIES.map(c => lang === 'de' ? (de[c] || c) : c);
}

interface HotelRowProps {
  entry: any;
  index: number;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  searchQuery?: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
  companyOptions?: string[];
  cityOptions?: string[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: any) => void;
}

function formatShortDate(isoString?: string | null, lang: string = 'de'): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });
}

const HighlightText = ({ text, query }: { text: string; query?: string }) => {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-yellow-400 text-black px-0.5 rounded font-bold">{part}</mark> : part
      )}
    </>
  );
};

function getDurationTooltip(d: any, lang: string): string {
  const rc = d.roomCards || [];
  if (rc.length === 0) return lang === 'de' ? 'Keine Zimmer' : 'No rooms';
  const counts: Record<string, number> = {};
  rc.forEach((c: any) => { counts[c.roomType] = (counts[c.roomType] || 0) + 1; });
  const breakdown = Object.entries(counts).map(([type, count]) => `${count} ${type}`).join(', ');
  return `${rc.length} ${lang === 'de' ? 'Zimmer' : 'Rooms'} ➔ ${breakdown}`;
}

export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', isPinned = false, onTogglePin = () => {}, companyOptions = [], cityOptions = [], onDelete, onUpdate }: HotelRowProps) {
  const [open, setOpen] = useState(false);
  const [localHotel, setLocalHotel] = useState({
    ...entry,
    companyTag: Array.isArray(entry?.companyTag) ? entry.companyTag : (entry?.companyTag ? [entry.companyTag] : []),
    durations: entry?.durations ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [creatingDuration, setCreatingDuration] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  const { totalCost, freeBeds, totalBeds, employees } = useMemo(() => {
    let tCost = 0; let tFree = 0; let tBeds = 0; const allEmps: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    (localHotel.durations || []).forEach((d: any) => {
      const rCards = d.roomCards || [];
      const extraTotal = (d.extraCosts || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      rCards.forEach((c: any) => {
        const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
        tBeds += b;
        allEmps.push(...(c.employees || []));
      });
      tFree += calcDurationFreeBeds(d, today);
      let bruttoBase = d.useBruttoNetto ? (d.brutto || 0) : rCards.reduce((s: number, c: any) => s + calcRoomCardTotal(c, d.startDate, d.endDate), 0);
      bruttoBase += extraTotal;
      if (!d.useBruttoNetto && d.hasDiscount && d.discountValue) {
        bruttoBase = d.discountType === 'fixed' ? bruttoBase - d.discountValue : bruttoBase * (1 - d.discountValue / 100);
      }
      tCost += Math.max(0, bruttoBase);
    });
    return { totalCost: tCost, freeBeds: tFree, totalBeds: tBeds, employees: allEmps };
  }, [localHotel]);

  const sortedEmployees = useMemo(() => {
    const statusWeight: Record<string, number> = { active: 1, 'ending-soon': 2, upcoming: 3, none: 4, completed: 5 };
    return [...employees].sort((a: any, b: any) => {
      const statA = statusWeight[getEmployeeStatus(a.checkIn, a.checkOut)];
      const statB = statusWeight[getEmployeeStatus(b.checkIn, b.checkOut)];
      return statA - statB;
    });
  }, [employees]);

  const visibleEmps = sortedEmployees.slice(0, 6);
  const hiddenEmpsCount = sortedEmployees.length - 6;

  function patchHotel(changes: any) {
    const next = { ...localHotel, ...changes };
    setLocalHotel(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateHotel(localHotel.id, next);
        onUpdate(localHotel.id, next);
      } catch (e: any) { 
        console.error("Save Error:", e);
        alert(`Error: ${e.message}`);
      }
      finally { setSaving(false); }
    }, 400);
  }

  const handleEnterBlur = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLElement).blur();
  };

  async function addDuration() {
    try {
      setCreatingDuration(true);
      const created = await createDuration({ hotelId: localHotel.id });
      const nextDurations = [...(localHotel.durations || []), { ...created, roomCards: [] }];
      const next = { ...localHotel, durations: nextDurations };
      setLocalHotel(next);
      onUpdate(localHotel.id, next);
      setOpen(true);
      setActiveDurationTab(nextDurations.length - 1);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setCreatingDuration(false);
    }
  }

  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500');
  const inputCls = cn('w-full px-3 py-2 rounded-lg text-sm font-bold outline-none border transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400');

  return (
    <div className="space-y-1 relative" style={{ zIndex: 40 - (index % 30) }}>
      <div className={cn('rounded-2xl border transition-all duration-200 shadow-sm relative', dk ? 'bg-[#0F172A] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300')}>
        
        <div className={cn('flex items-center gap-0 cursor-pointer p-2', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', open && 'border-b', open && (dk ? 'border-white/5 bg-[#0B1224]' : 'border-slate-100 bg-slate-50/50'))} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-blue-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          <div className="flex-[2] py-2 min-w-[180px] pr-2">
            <h3 className={cn('text-[15px] font-black leading-tight truncate', dk ? 'text-white' : 'text-slate-900')}>
              <HighlightText text={localHotel.name} query={searchQuery} />
            </h3>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate mt-0.5", dk ? "text-slate-500" : "text-slate-400")}>
              <CityInlineEdit value={localHotel.city || ''} options={cityOptions} isDarkMode={dk} hotelId={localHotel.id} onChange={(val:any) => patchHotel({ city: val || null })} lang={lang} />
            </p>
          </div>

          <div className="flex-[1.5] px-2 min-w-[140px]" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={(tags:any) => patchHotel({ companyTag: tags })} />
          </div>

          <div className="flex-[1.5] px-2 min-w-[150px]">
            <div className="grid grid-cols-2 gap-1.5 w-max">
              {localHotel.durations.map((d: any) => (
                <div key={d.id} title={getDurationTooltip(d, lang)} className={cn('px-2 py-1.5 rounded-lg text-[10px] font-bold border truncate transition-colors text-center cursor-help', dk ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700')}>
                  {d.startDate && d.endDate ? `${formatShortDate(d.startDate, lang)} - ${formatShortDate(d.endDate, lang)}` : 'New'}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-[2] min-w-[200px] px-2">
            <div className="grid grid-cols-3 gap-1.5 w-max">
              {visibleEmps.map((emp: any, i: number) => {
                const status = getEmployeeStatus(emp.checkIn, emp.checkOut);
                return (
                  <div key={i} title={emp.name} className={cn("px-2 py-1 rounded border text-[10px] font-bold truncate text-center", 
                    status === 'active' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-500"
                  )}>
                    <HighlightText text={emp.name} query={searchQuery} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-5 pr-4 shrink-0">
            <div className="text-right min-w-[100px]">
              <p className={cn('text-[10px] uppercase font-bold text-slate-500')}>{lang === 'de' ? 'Kosten' : 'Cost'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(totalCost)}</p>
            </div>
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
               <button onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className={cn("p-1.5 rounded-lg", isPinned ? "text-yellow-500" : "text-slate-400")}><Star size={16} className={isPinned ? "fill-yellow-500" : ""} /></button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-slate-400"><Clock size={16} /></button>
                  <div className="absolute right-0 bottom-full mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 z-[100]">
                     Updated by {localHotel.lastupdatedby || 'Admin'}
                  </div>
               </div>
               <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>

        {open && (
          <div className={cn('p-5 space-y-6 rounded-b-2xl', dk ? 'bg-[#0B1224]' : 'bg-slate-50/50')} onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap xl:flex-nowrap gap-3 items-end">
              <div className="flex-[2.5_2.5_0%] min-w-[180px]">
                 <label className={labelCls}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label>
                 <input value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} placeholder="..." className={inputCls} />
              </div>
              <div className="flex-[1.5_1.5_0%] min-w-[140px]">
                 <label className={labelCls}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact'}</label>
                 <input value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} placeholder="..." className={inputCls} />
              </div>
              <div className="flex-[1.5_1.5_0%] min-w-[140px]">
                 <label className={labelCls}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label>
                 <input value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} placeholder="..." className={inputCls} />
              </div>
              <div className="flex-[1.5_1.5_0%] min-w-[160px]">
                 <label className={labelCls}><Mail size={12}/> Email</label>
                 <input value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} placeholder="..." className={inputCls} />
              </div>
              <div className="flex-[1.5_1.5_0%] min-w-[160px]">
                 <label className={labelCls}><Globe size={12}/> {lang === 'de' ? 'Webseite' : 'Website'}</label>
                 <input value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} onKeyDown={handleEnterBlur} placeholder="..." className={inputCls} />
              </div>
              <div className="flex-[1_1_0%] min-w-[120px]">
                 <label className={labelCls}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                 <ModernDropdown value={localHotel.country || 'Germany'} options={getCountryOptions(lang)} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2">
              {(localHotel.durations || []).map((d: any, i: number) => (
                <button key={d.id || i} onClick={() => setActiveDurationTab(i)} className={cn('px-4 py-2 rounded-lg text-sm font-bold border transition-all', activeDurationTab === i ? 'bg-blue-600 text-white' : dk ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-700')}>{getDurationTabLabel(d, lang)}</button>
              ))}
              <button onClick={addDuration} className="px-4 py-2 rounded-lg text-sm font-bold border bg-blue-600/10 text-blue-500">
                {creatingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
            {localHotel.durations[activeDurationTab] && (
              <DurationCard duration={localHotel.durations[activeDurationTab]} isDarkMode={dk} lang={lang} onUpdate={(id, upd) => { const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) }; setLocalHotel(next); onUpdate(localHotel.id, next); }} onDelete={(id) => { const next = { ...localHotel, durations: localHotel.durations.filter((d: any) => d.id !== id) }; setLocalHotel(next); onUpdate(localHotel.id, next); }} />
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn('w-full max-w-md rounded-3xl border p-8 shadow-2xl', dk ? 'bg-[#0F172A] text-white' : 'bg-white text-slate-900')}>
            <h3 className="text-2xl font-black mb-4">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="px-6 py-2.5 font-bold">Cancel</button>
              <button onClick={async () => { await deleteHotel(localHotel.id); onDelete(localHotel.id); }} className="px-6 py-2.5 font-bold bg-red-600 text-white rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select' }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Accept either string options or objects, but render text correctly
  return (
    <div ref={ref} className="relative w-full h-[38px]">
      <button onClick={() => setOpen(!open)} className={cn('w-full h-full px-3 flex items-center justify-between rounded-lg border text-sm font-bold', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className={cn('absolute top-full mt-1 left-0 right-0 z-[100] rounded-xl border shadow-xl py-1 overflow-hidden', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white')}>
          <div className="max-h-48 overflow-y-auto">
            {options.map((opt:any) => {
              const label = typeof opt === 'string' ? opt : opt.label;
              const val = typeof opt === 'string' ? opt : opt.value;
              return (
                <button key={val} onClick={() => { onChange(val); setOpen(false); }} className={cn('w-full text-left px-3 py-2 text-sm font-bold', value === val ? 'text-blue-500 bg-blue-500/10' : isDarkMode ? 'text-slate-300' : 'text-slate-700')}>{label}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CityInlineEdit({ value, options, isDarkMode, hotelId, onChange, lang }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) return <span onClick={e => { e.stopPropagation(); setEditing(true); }} className="cursor-text hover:underline">{value || (lang === 'de' ? 'Stadt...' : 'City...')}</span>;
  return <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { onChange(draft); setEditing(false); }} onKeyDown={e => { if(e.key === 'Enter') { onChange(draft); setEditing(false); } }} className="text-[10px] font-bold uppercase outline-none border-b bg-transparent w-28 border-blue-500" />;
}

function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: any) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  return (
    <div ref={ref} className="relative cursor-pointer min-h-[24px]" onClick={() => setOpen(!open)}>
      <div className="flex flex-wrap gap-1">
        {selected.length > 0 ? selected.map((tag: string) => (
          <span key={tag} className={cn('px-2 py-0.5 rounded text-[11px] font-bold border', isDarkMode ? 'bg-white/5 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700')}>{tag}</span>
        )) : <span className="text-[11px] text-slate-400 font-bold border border-dashed px-2 py-0.5 rounded">+ {lang === 'de' ? 'Firma' : 'Company'}</span>}
      </div>
      {open && (
        <div className={cn('absolute top-full mt-1 left-0 z-[100] rounded-xl border shadow-xl min-w-[160px] py-1', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          {options.map((opt: string) => (
            <button key={opt} onClick={(e) => { e.stopPropagation(); onChange(selected.includes(opt) ? selected.filter((t: any) => t !== opt) : [...selected, opt]); }} className={cn('w-full text-left px-3 py-2 text-xs font-bold', selected.includes(opt) ? 'text-blue-500 bg-blue-500/10' : isDarkMode ? 'text-slate-300' : 'text-slate-700')}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HotelRow;
