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

  const hiddenMatchText = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    for (const d of (localHotel.durations || [])) {
      if (d.rechnungNr?.toLowerCase().includes(q)) return `Invoice ${d.rechnungNr}`;
      for (const rc of (d.roomCards || [])) {
        for (const emp of (rc.employees || [])) {
          if (emp.name?.toLowerCase().includes(q)) return `Emp: ${emp.name}`;
        }
      }
    }
    return null;
  }, [localHotel, searchQuery]);

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
        console.error("Database Save Failed:", e);
        alert(`Error: ${e.message}`);
      }
      finally { setSaving(false); }
    }, 400);
  }

  const handleEnterBlur = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
  };

  const statLblCls = cn('text-[10px] uppercase tracking-widest font-bold mb-0.5', dk ? 'text-slate-500' : 'text-slate-400');
  const inputCls = cn('w-full px-3 py-2 rounded-lg text-sm font-bold outline-none border transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400');
  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500');

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
              <CityInlineEdit value={localHotel.city || ''} options={cityOptions} isDarkMode={dk} hotelId={localHotel.id} onChange={val => patchHotel({ city: val || null })} lang={lang} />
            </p>
          </div>

          <div className="flex-[1.5] px-2 min-w-[140px]" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={tags => patchHotel({ companyTag: tags })} />
          </div>

          <div className="flex-[1.5] px-2 min-w-[150px]">
            <div className="grid grid-cols-2 gap-1.5 w-max">
              {localHotel.durations.map((d: any) => (
                <div key={d.id} title={getDurationTooltip(d, lang)} className={cn('px-2 py-1.5 rounded-lg text-[10px] font-bold border truncate transition-colors text-center cursor-help', dk ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}>
                  {d.startDate && d.endDate ? `${formatShortDate(d.startDate, lang)} - ${formatShortDate(d.endDate, lang)}` : 'New'}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-[2] min-w-[200px] px-2">
            <div className="grid grid-cols-3 gap-1.5 w-max max-w-full">
              {visibleEmps.map((emp: any, i: number) => {
                const status = getEmployeeStatus(emp.checkIn, emp.checkOut);
                return (
                  <div key={i} title={emp.name} className={cn("px-2 py-1 rounded border text-[10px] font-bold truncate text-center transition-all max-w-[85px]", 
                    status === 'active' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" :
                    status === 'upcoming' ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400" :
                    status === 'ending-soon' ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400" :
                    "bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400"
                  )}>
                    <HighlightText text={emp.name} query={searchQuery} />
                  </div>
                );
              })}
              {hiddenEmpsCount > 0 && (
                <div className={cn("px-2 py-1 rounded border text-[10px] font-black flex items-center justify-center", dk ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600")}>
                  +{hiddenEmpsCount}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-5 pr-4 shrink-0">
            <div className="text-center min-w-[40px]">
              <p className={statLblCls}>{lang === 'de' ? 'Frei' : 'Free'}</p>
              <p className={cn('text-lg font-black', freeBeds > 0 ? 'text-red-500' : 'text-emerald-500')}>{freeBeds}</p>
            </div>
            <div className="text-center min-w-[40px]">
              <p className={statLblCls}>{lang === 'de' ? 'Betten' : 'Beds'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{totalBeds}</p>
            </div>
            <div className="text-right min-w-[100px]">
              <p className={statLblCls}>{lang === 'de' ? 'Kosten' : 'Cost'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(totalCost)}</p>
            </div>
            
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
               <button onClick={(e) => { e.stopPropagation(); onTogglePin(); }} className={cn("p-1.5 rounded-lg transition-all", isPinned ? "text-yellow-500" : dk ? "text-slate-500 hover:text-yellow-500" : "text-slate-400 hover:text-yellow-500")}>
                 <Star size={16} className={isPinned ? "fill-yellow-500" : ""} />
               </button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className={cn("p-1.5 rounded-lg transition-all", dk ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}><Clock size={16} /></button>
                  <div className="absolute right-0 bottom-full mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[100] shadow-xl">
                     Updated by {localHotel.lastupdatedby || 'Admin'} on {new Date(localHotel.lastupdatedat || localHotel.created_at).toLocaleDateString()}
                  </div>
               </div>
               <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} className={cn("p-1.5 rounded-lg transition-all", dk ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}><Trash2 size={16} /></button>
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
                 <label className={labelCls}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact Person'}</label>
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
                 <ModernDropdown value={localHotel.country || 'Germany'} options={DEFAULT_COUNTRIES} onChange={v => patchHotel({ country: v })} isDarkMode={dk} lang={lang} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2">
              {(localHotel.durations || []).map((d: any, i: number) => (
                <button key={d.id || i} onClick={() => setActiveDurationTab(i)} className={cn('px-4 py-2 rounded-lg text-sm font-bold border transition-all shadow-sm', activeDurationTab === i ? 'bg-blue-600 text-white border-blue-600' : dk ? 'bg-[#1E293B] border-white/10 text-slate-300' : 'bg-white border-slate-200')}>{getDurationTabLabel(d, lang)}</button>
              ))}
              <button onClick={addDuration} className={cn('px-4 py-2 rounded-lg text-sm font-bold border flex items-center gap-1.5 shadow-sm', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50')}>
                {creatingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {lang === 'de' ? 'Neue Dauer' : 'Add duration'}
              </button>
            </div>
            {localHotel.durations[activeDurationTab] && (
              <DurationCard duration={localHotel.durations[activeDurationTab]} isDarkMode={dk} lang={lang} onUpdate={(id, upd) => { const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) }; setLocalHotel(next); onUpdate(localHotel.id, next); }} onDelete={(id) => { const next = { ...localHotel, durations: localHotel.durations.filter((d: any) => d.id !== id) }; setLocalHotel(next); onUpdate(localHotel.id, next); }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModernDropdown({ value, options, onChange, isDarkMode, lang, placeholder = 'Select' }: { value: string, options: string[], onChange: (v: string) => void, isDarkMode: boolean, lang?: string, placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAddingNew(false); setNewVal(''); } }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  const allOptions = Array.from(new Set([...options, value])).filter(Boolean).sort();
  const displayValue = (val: string) => {
    if (lang !== 'de') return val;
    const de: any = { 'Germany': 'Deutschland', 'Switzerland': 'Schweiz', 'Austria': 'Österreich', 'Netherlands': 'Niederlande', 'Poland': 'Polen', 'Belgium': 'Belgien', 'France': 'Frankreich', 'Luxembourg': 'Luxemburg' };
    return de[val] || val;
  };
  return (
    <div ref={ref} className="relative w-full h-[38px]">
      <button onClick={() => setOpen(!open)} className={cn('w-full h-full px-3 flex items-center justify-between rounded-lg border text-sm font-bold outline-none transition-all', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
        <span className="truncate">{displayValue(value) || placeholder}</span>
        <ChevronDown size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
      </button>
      {open && (
        <div className={cn('absolute top-full mt-1 left-0 right-0 z-[100] rounded-xl border shadow-xl py-1 overflow-hidden', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          <div className="max-h-48 overflow-y-auto">
            {allOptions.map(opt => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={cn('w-full text-left px-3 py-2 text-sm font-bold', value === opt ? (isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : (isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'))}>{displayValue(opt)}</button>
            ))}
          </div>
          <div className={cn('my-1 border-t', isDarkMode ? 'border-white/10' : 'border-slate-100')} />
          {!addingNew ? (
            <button onClick={() => setAddingNew(true)} className={cn('w-full text-left px-3 py-2 text-sm font-bold flex items-center gap-1.5', isDarkMode ? 'text-blue-400' : 'text-blue-600')}><Plus size={14} /> {lang === 'de' ? 'Neu' : 'Add'}</button>
          ) : (
            <div className="px-2 py-1.5 flex items-center gap-1">
              <input autoFocus value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className={cn('flex-1 text-sm outline-none border-b bg-transparent', isDarkMode ? 'border-blue-500 text-white' : 'border-blue-500 text-slate-900')} />
              <button onClick={() => { if(newVal.trim()) { onChange(newVal.trim()); setOpen(false); } }}><Check size={16} /></button>
            </div>
          )}
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
            <button key={opt} onClick={(e) => { e.stopPropagation(); onChange(selected.includes(opt) ? selected.filter((t: any) => t !== opt) : [...selected, opt]); }} className={cn('w-full text-left px-3 py-2 text-xs font-bold', selected.includes(opt) ? 'text-blue-500' : 'text-slate-500')}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HotelRow;
