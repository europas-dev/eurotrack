// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, Clock, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star } from 'lucide-react';
import { cn, getEmployeeStatus, calcDurationFreeBeds } from '../lib/utils';
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

// Format: "1 Apr - 14 Apr"
function formatShortDate(isoString?: string | null, lang: string = 'de'): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
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
      } catch (e) { console.error("Database Save Failed:", e); }
      finally { setSaving(false); }
    }, 400);
  }

  const handleEnterBlur = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const statLblCls = cn('text-[10px] uppercase tracking-widest font-bold mb-0.5', dk ? 'text-slate-500' : 'text-slate-400');
  const inputCls = cn('w-full px-3 py-2 rounded-lg text-xs font-bold outline-none border transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400');
  const labelCls = cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500');

  async function addDuration() {
    try {
      setCreatingDuration(true);
      const created = await createDuration(localHotel.id);
      const nextDurations = [...(localHotel.durations || []), { ...created, roomCards: [] }];
      const next = { ...localHotel, durations: nextDurations };
      setLocalHotel(next);
      onUpdate(localHotel.id, next);
      setOpen(true);
      setActiveDurationTab(nextDurations.length - 1);
    } catch (e) {
      console.error("Failed to create duration:", e);
    } finally {
      setCreatingDuration(false);
    }
  }

  return (
    <div className="space-y-1 relative" style={{ zIndex: 100 - index }}>
      {/* Removed overflow-hidden so the dropdowns can float freely over other rows */}
      <div className={cn('rounded-2xl border transition-all duration-200 shadow-sm relative', dk ? 'bg-[#0F172A] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300')}>
        
        {/* MAIN COMPACT ROW */}
        <div className={cn('flex items-center gap-0 cursor-pointer p-1.5', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', open && 'border-b', open && (dk ? 'border-white/5 bg-[#0B1224]' : 'border-slate-100 bg-slate-50/50'))} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-blue-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          <div className="flex-[2] py-2 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <h3 className={cn('text-[15px] font-black leading-tight truncate', dk ? 'text-white' : 'text-slate-900')}>
                <HighlightText text={localHotel.name} query={searchQuery} />
              </h3>
            </div>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate mt-0.5", dk ? "text-slate-500" : "text-slate-400")}>
              <CityInlineEdit value={localHotel.city || ''} options={cityOptions} isDarkMode={dk} hotelId={localHotel.id} onChange={val => patchHotel({ city: val || null })} lang={lang} />
            </p>
            {hiddenMatchText && !open && (
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-[9px] font-bold rounded-full truncate max-w-full">
                🔍 {hiddenMatchText}
              </span>
            )}
          </div>

          <div className="flex-[1.5] px-2 min-w-0" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={tags => patchHotel({ companyTag: tags })} />
          </div>

          {/* Durations (2 Per Line Grid) */}
          <div className="flex-[1.5] px-2 min-w-[140px]">
            <div className="grid grid-cols-2 gap-1.5 w-max">
              {localHotel.durations.map((d: any) => (
                <div key={d.id} title={getDurationTooltip(d, lang)} className={cn('px-2 py-1 rounded-lg text-[10px] font-bold border truncate transition-colors text-center cursor-help', dk ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}>
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
                  <div key={i} title={emp.name} className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold truncate text-center transition-all", 
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
                <div className={cn("px-1.5 py-0.5 rounded border text-[9px] font-black flex items-center justify-center", dk ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600")}>
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
            <div className="text-right min-w-[90px]">
              <p className={statLblCls}>{lang === 'de' ? 'Kosten' : 'Cost'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(totalCost)}</p>
            </div>
            
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
               <button onClick={(e) => { e.stopPropagation(); onTogglePin(); }} className={cn("p-1.5 rounded-lg transition-all", isPinned ? "text-yellow-500" : dk ? "text-slate-500 hover:text-yellow-500 hover:bg-white/5" : "text-slate-400 hover:text-yellow-500 hover:bg-white")}>
                 <Star size={14} className={isPinned ? "fill-yellow-500" : ""} />
               </button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className={cn("p-1.5 rounded-lg transition-all", dk ? "text-slate-500 hover:text-slate-300 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-white")}><Clock size={14} /></button>
                  <div className="absolute right-0 bottom-full mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-xl">
                     Updated by {localHotel.updated_by || 'Admin'} on {new Date(localHotel.updated_at || localHotel.created_at).toLocaleDateString()}
                  </div>
               </div>
               <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} className={cn("p-1.5 rounded-lg transition-all", dk ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}><Trash2 size={14} /></button>
            </div>
          </div>
        </div>

        {/* EXPANDED CRM BREAKDOWN (1-LINE) */}
        {open && (
          <div className={cn('p-5 space-y-6 rounded-b-2xl', dk ? 'bg-[#0B1224]' : 'bg-slate-50/50')} onClick={e => e.stopPropagation()}>
            
            {/* The 1-Line Flex Grid */}
            <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end">
              
              <div className="flex-[2.5_2.5_0%] min-w-[200px]">
                 <label className={labelCls}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label>
                 <input value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} placeholder={lang === 'de' ? 'Adresse eingeben...' : 'Enter address...'} className={inputCls} />
              </div>
              
              <div className="flex-[1.5_1.5_0%] min-w-[140px]">
                 <label className={labelCls}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact Person'}</label>
                 <input value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} placeholder={lang === 'de' ? 'Name eingeben...' : 'Enter name...'} className={inputCls} />
              </div>
              
              <div className="flex-[1.5_1.5_0%] min-w-[140px]">
                 <label className={labelCls}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label>
                 <div className={cn('flex items-center rounded-lg border overflow-hidden transition-all focus-within:border-blue-500 h-[38px]', dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}>
                    <input value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} placeholder={lang === 'de' ? 'Nummer eingeben...' : 'Enter number...'} className={cn('w-full px-3 py-2 text-xs font-bold outline-none bg-transparent h-full', dk ? 'text-white' : 'text-slate-900')} />
                 </div>
              </div>

              <div className="flex-[1.5_1.5_0%] min-w-[160px]">
                 <label className={labelCls}><Mail size={12}/> Email</label>
                 <div className="relative flex items-center h-[38px]">
                   <input value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} placeholder={lang === 'de' ? 'Email eingeben...' : 'Enter email...'} className={cn(inputCls, 'h-full pr-8')} />
                   {localHotel.email && (
                     <a href={`mailto:${localHotel.email}`} className="absolute right-1.5 p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-all shadow-sm">
                       <Mail size={12} />
                     </a>
                   )}
                 </div>
              </div>
              
              <div className="flex-[1.5_1.5_0%] min-w-[160px]">
                 <label className={labelCls}><Globe size={12}/> {lang === 'de' ? 'Webseite' : 'Website'}</label>
                 <div className="relative flex items-center h-[38px]">
                   <input value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} onKeyDown={handleEnterBlur} placeholder={lang === 'de' ? 'Link eingeben...' : 'Enter link...'} className={cn(inputCls, 'h-full pr-8')} />
                   {localHotel.website && (
                     <a href={localHotel.website.startsWith('http') ? localHotel.website : `https://${localHotel.website}`} target="_blank" rel="noreferrer" className="absolute right-1.5 p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-all shadow-sm">
                       <Globe size={12} />
                     </a>
                   )}
                 </div>
              </div>
              
              <div className="flex-[1_1_0%] min-w-[120px]">
                 <label className={labelCls}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                 <ModernDropdown 
                    value={localHotel.country || 'Germany'} 
                    options={DEFAULT_COUNTRIES} 
                    onChange={v => patchHotel({ country: v })} 
                    isDarkMode={dk} lang={lang} 
                 />
              </div>
            </div>

            <textarea className={cn(inputCls, 'min-h-[50px] resize-y font-normal mt-2')} value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} placeholder={lang === 'de' ? 'Zusätzliche Notizen eingeben...' : 'Enter additional notes...'} />

            <div className="flex items-center gap-2 flex-wrap pt-2">
              {(localHotel.durations || []).map((d: any, i: number) => (
                <button key={d.id || i} onClick={() => setActiveDurationTab(i)}
                  className={cn('px-4 py-2 rounded-lg text-xs font-bold border transition-all shadow-sm',
                    activeDurationTab === i ? 'bg-blue-600 text-white border-blue-600' : dk ? 'bg-[#1E293B] border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  )}>{getDurationTabLabel(d, lang)}</button>
              ))}
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('px-4 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm',
                  dk ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                )}>
                {creatingDuration ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {lang === 'de' ? 'Neue Dauer' : 'Add duration'}
              </button>
            </div>

            {(localHotel.durations || []).length > 0 ? (
              <DurationCard 
                duration={localHotel.durations[activeDurationTab]} 
                isDarkMode={dk} lang={lang} 
                onUpdate={(id, upd) => {
                  const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? upd : d) };
                  setLocalHotel(next); onUpdate(localHotel.id, next);
                }}
                onDelete={(id) => {
                  const next = { ...localHotel, durations: localHotel.durations.filter((d: any) => d.id !== id) };
                  setLocalHotel(next); onUpdate(localHotel.id, next);
                }}
              />
            ) : (
               <button onClick={addDuration} disabled={creatingDuration}
                className={cn('w-full mt-2 py-6 rounded-xl border-2 border-dashed text-sm font-bold transition-all flex items-center justify-center gap-2',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5' : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                )}>
                {creatingDuration ? <><Loader2 size={16} className="animate-spin"/> {lang === 'de' ? 'Erstelle...' : 'Creating...'}</> : <><Plus size={16}/> {lang === 'de' ? 'Erste Dauer hinzufügen' : 'Add first duration'}</>}
              </button>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn('w-full max-w-md rounded-3xl border p-8 shadow-2xl', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-2xl font-black mb-4">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className="text-slate-500 mb-8">{lang === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This action cannot be undone.'}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className={cn('px-6 py-2.5 font-bold rounded-xl border transition-all', dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50')}>Cancel</button>
              <button onClick={async () => { await deleteHotel(localHotel.id); onDelete(localHotel.id); }} className="px-6 py-2.5 font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
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

  return (
    <div ref={ref} className="relative w-full h-[38px]">
      <button onClick={() => setOpen(!open)} className={cn('w-full h-full px-3 flex items-center justify-between rounded-lg border text-xs font-bold outline-none transition-all', isDarkMode ? 'bg-[#1E293B] border-white/10 text-white hover:border-blue-500' : 'bg-white border-slate-200 text-slate-900 hover:border-blue-500')}>
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={14} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
      </button>
      {open && (
        <div className={cn('absolute top-full mt-1 left-0 right-0 z-50 rounded-xl border shadow-xl py-1 overflow-hidden', isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {allOptions.map(opt => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={cn('w-full text-left px-3 py-2 text-xs font-bold transition-all', value === opt ? (isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') : (isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'))}>
                {opt}
              </button>
            ))}
          </div>
          <div className={cn('my-1 border-t', isDarkMode ? 'border-white/10' : 'border-slate-100')} />
          {!addingNew ? (
            <button onClick={() => { setAddingNew(true); setNewVal(''); }} className={cn('w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-all', isDarkMode ? 'text-blue-400 hover:bg-white/5' : 'text-blue-600 hover:bg-blue-50')}>
              <Plus size={12} /> {lang === 'de' ? 'Neu hinzufügen' : 'Add New'}
            </button>
          ) : (
            <div className="px-2 py-1.5 flex items-center gap-1">
              <input autoFocus value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { onChange(newVal.trim()); setOpen(false); setAddingNew(false); } if (e.key === 'Escape') setAddingNew(false); }} placeholder="..." className={cn('flex-1 text-xs outline-none border-b bg-transparent py-0.5', isDarkMode ? 'border-blue-500 text-white' : 'border-blue-500 text-slate-900')} />
              <button onClick={() => { if(newVal.trim()){ onChange(newVal.trim()); setOpen(false); setAddingNew(false); } }} className="text-blue-500 hover:text-blue-400 p-0.5"><Check size={12} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CityInlineEdit({ value, options, isDarkMode, hotelId, onChange, lang }: { value: string; options: string[]; isDarkMode: boolean; hotelId: string; onChange: (val: string) => void; lang?: string; }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const listId = `city-dl-${hotelId}`;
  if (!editing) {
    return (
      <span onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }} className="cursor-text hover:underline inline-block min-w-[30px]">
        {value || <span className={isDarkMode ? 'text-slate-600' : 'text-slate-400'}>{lang === 'de' ? 'Stadt eingeben...' : 'Enter city...'}</span>}
      </span>
    );
  }
  return (
    <span onClick={e => e.stopPropagation()}>
      <input autoFocus list={listId} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
        className={cn('text-[10px] font-bold uppercase tracking-widest outline-none border-b bg-transparent w-28', isDarkMode ? 'border-blue-500 text-slate-300' : 'border-blue-500 text-slate-500')}
      />
      <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
    </span>
  );
}

function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange }: { selected: string[]; options: string[]; isDarkMode: boolean; lang: string; onChange: (tags: string[]) => void; }) {
  const dk = isDarkMode;
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAddingNew(false); setNewVal(''); } }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function toggle(tag: string) { onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]); }
  function removeTag(tag: string, e: React.MouseEvent) { e.stopPropagation(); onChange(selected.filter(t => t !== tag)); }
  function confirmNew() { const v = newVal.trim(); if (v && !selected.includes(v)) onChange([...selected, v]); setAddingNew(false); setNewVal(''); setOpen(false); }

  const allOptions = Array.from(new Set([...options, ...selected])).filter(Boolean).sort();

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1 cursor-pointer min-h-[24px]" onClick={() => setOpen(o => !o)}>
        {selected.length > 0 ? selected.map(tag => (
          <span key={tag} className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border shadow-sm', dk ? 'bg-white/5 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700')}>
            {tag} <span onMouseDown={e => { e.preventDefault(); removeTag(tag, e); }} className="cursor-pointer hover:opacity-70 ml-0.5"><X size={10} /></span>
          </span>
        )) : (
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold border border-dashed', dk ? 'border-white/20 text-slate-500 hover:border-blue-400 hover:text-blue-400' : 'border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600')}>
            <Plus size={10} /> {lang === 'de' ? 'Firma' : 'Company'}
          </span>
        )}
      </div>

      {open && (
        <div className={cn('absolute top-full mt-1 left-0 z-50 rounded-xl border shadow-xl min-w-[180px] py-1', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {allOptions.length > 0 && (
              <>
                <div className={cn('px-3 pt-1 pb-1 text-[9px] font-black uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Firmen' : 'Companies'}
                </div>
                {allOptions.map(opt => (
                  <button key={opt} onClick={() => toggle(opt)} className={cn('w-full text-left px-3 py-2 text-[11px] font-bold transition-colors flex items-center gap-2', selected.includes(opt) ? (dk ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700') : (dk ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'))}>
                    <span className={cn('w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0', selected.includes(opt) ? 'bg-blue-500 border-blue-500' : (dk ? 'border-white/20' : 'border-slate-300'))}>
                      {selected.includes(opt) && <Check size={10} className="text-white" />}
                    </span>
                    {opt}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className={cn('my-1 border-t', dk ? 'border-white/10' : 'border-slate-100')} />
          {!addingNew ? (
            <button onClick={() => { setAddingNew(true); setNewVal(''); }} className={cn('w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-1.5', dk ? 'text-blue-400 hover:bg-white/5' : 'text-blue-600 hover:bg-blue-50')}>
              <Plus size={12} /> {lang === 'de' ? 'Neue Firma' : 'New company'}
            </button>
          ) : (
            <div className="px-2 py-2 flex items-center gap-1">
              <input autoFocus value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmNew(); if (e.key === 'Escape') { setAddingNew(false); setNewVal(''); } }} placeholder={lang === 'de' ? 'Firmenname...' : 'Company name...'} className={cn('flex-1 text-[11px] font-bold outline-none border-b bg-transparent py-0.5', dk ? 'border-blue-500 text-white placeholder-slate-600' : 'border-blue-500 text-slate-900 placeholder-slate-400')} />
              <button onClick={confirmNew} className="text-blue-500 hover:text-blue-400 p-0.5"><Check size={14} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HotelRow;
