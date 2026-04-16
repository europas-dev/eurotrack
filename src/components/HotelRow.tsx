// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star, Clock, StickyNote, ExternalLink, Search, CornerDownRight } from 'lucide-react';
import {
  cn, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatDateChip, formatLastUpdated, calcHotelTotalCost, calculateNights
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
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
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
function SeamlessInput({ value, options, isDarkMode, onChange, placeholder, className, textClass }: any) {
  const [draft, setDraft] = useState(value || '');
  const [showOptions, setShowOptions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(value || ''); }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) { 
      if (ref.current && !ref.current.contains(e.target as Node)) { 
        setShowOptions(false); 
        if (draft !== value) onChange(draft);
      } 
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [draft, value, onChange]);

  const filtered = (options || []).filter((o: string) => o.toLowerCase().includes(draft.toLowerCase()) && o.toLowerCase() !== draft.toLowerCase()).slice(0, 5);

  return (
    <div ref={ref} className={cn("relative w-full", className)} onClick={e => e.stopPropagation()}>
      <input 
        value={draft} 
        onChange={e => { setDraft(e.target.value); setShowOptions(true); }}
        onBlur={() => { setTimeout(() => { if (draft !== value) onChange(draft); }, 150); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setShowOptions(false); e.currentTarget.blur(); } }}
        placeholder={placeholder}
        className={cn("w-full bg-transparent border-none outline-none focus:ring-0 p-0 m-0 truncate placeholder:opacity-40 transition-colors focus:text-teal-500", textClass)} 
      />
      {showOptions && filtered.length > 0 && (
        <div className={cn("absolute top-full left-0 mt-1 w-max min-w-[200px] z-[200] rounded-xl border shadow-xl py-1 overflow-hidden", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {filtered.map((opt: string) => (
            <button key={opt} onClick={() => { setDraft(opt); onChange(opt); setShowOptions(false); }} className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-all", isDarkMode ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- HOTEL ROW MAIN EXPORT ---
export function HotelRow({ entry, index, isDarkMode: dk, lang = 'de', searchQuery = '', selectedMonth = null, selectedYear = null, companyOptions = [], cityOptions = [], hotelOptions = [], onDelete, onUpdate, onDeleteCompanyOption }: any) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eurotrack_bookmarks') || '[]').includes(entry.id); } catch { return false; }
  });

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
      if (d.rechnungNr?.toLowerCase().includes(q)) return lang === 'de' ? `Treffer: Rechnung` : `Invoice Match`;
      for (const rc of (d.roomCards || [])) {
        for (const emp of (rc.employees || [])) {
          if (emp.name?.toLowerCase().includes(q)) return lang === 'de' ? `Treffer: Mitarbeiter` : `Employee Match`;
        }
      }
    }
    return null;
  }, [localHotel, searchQuery, lang]);

  const { totalCost, freeBeds, totalBeds, employees } = useMemo(() => {
    let tFree = 0; let tBeds = 0; const allEmps: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    (localHotel.durations || []).forEach((d: any) => {
      const rCards = d.roomCards || [];
      rCards.forEach((c: any) => {
        const b = c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2);
        tBeds += b;
        allEmps.push(...(c.employees || []));
      });
      tFree += calcDurationFreeBeds(d, today);
    });

    const tCost = calcHotelTotalCost(localHotel, selectedMonth, selectedYear);
    return { totalCost: tCost, freeBeds: tFree, totalBeds: tBeds, employees: allEmps };
  }, [localHotel, selectedMonth, selectedYear]);

  const visibleEmps = employees.slice(0, 6);
  const hiddenEmpsCount = employees.length > 6 ? employees.length - 6 : 0;

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
        
        {/* MAIN ROW */}
        <div className={cn('flex flex-wrap md:flex-nowrap items-center gap-0 cursor-pointer p-2', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70', open && 'border-b', open && (dk ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50/50'))} onClick={() => setOpen(!open)}>
          
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          {/* IDENTITY */}
          <div className="flex-[2] py-2 min-w-[200px] pr-2">
            <SeamlessInput 
               value={localHotel.name} options={hotelOptions} isDarkMode={dk} 
               onChange={(val:any) => patchHotel({ name: val })} placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel Name...'} 
               textClass={cn('text-[15px] font-black leading-tight', dk ? 'text-white' : 'text-slate-900')} 
            />
            <SeamlessInput 
               value={localHotel.city} options={cityOptions} isDarkMode={dk} 
               onChange={(val:any) => patchHotel({ city: val })} placeholder={lang === 'de' ? 'Stadt...' : 'City...'} 
               className="mt-0.5" textClass={cn("text-[10px] font-bold uppercase tracking-widest", dk ? "text-slate-500" : "text-slate-400")} 
            />
            {hiddenMatchText && !open && (
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-[9px] font-bold rounded-full truncate">
                🔍 {hiddenMatchText}
              </span>
            )}
          </div>

          {/* COMPANY (Shrunk to flex-[0.8] to prevent gap and save space) */}
          <div className="flex-[0.8] px-2 min-w-[120px]" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={(tags:any) => patchHotel({ companyTag: tags })} onDeleteOption={onDeleteCompanyOption} />
          </div>

          {/* DURATIONS */}
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
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 z-[100] pointer-events-none shadow-xl border border-white/10 transition-opacity">
                      {tooltipText}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* EMPLOYEES (Expanded to flex-[2.5] to easily fit 3 chips) */}
          <div className="flex-[2.5] px-2">
            <div className="flex flex-wrap gap-1.5">
              {visibleEmps.map((emp: any, i: number) => {
                const status = getEmployeeStatus(emp.checkIn, emp.checkOut);
                const nights = calculateNights(emp.checkIn, emp.checkOut);
                
                // EXACT BED SLOT LOGIC: Only border colors change.
                const isUpcoming = status === 'upcoming';
                const borderCls = status === 'active' 
                  ? "border-emerald-500 border-solid" 
                  : status === 'upcoming' 
                  ? "border-blue-500 border-dashed" 
                  : status === 'ending-soon' 
                  ? "border-red-500 border-dashed" 
                  : "border-slate-300 border-solid dark:border-slate-600";
                
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

          {/* RIGID METRICS */}
          <div className="ml-auto flex items-center gap-6 pr-3 shrink-0 min-w-[280px] justify-end">
            <div className="text-center w-10">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{lang === 'de' ? 'Frei' : 'Free'}</p>
              <p className={cn('text-lg font-black', freeBeds > 0 ? 'text-red-500' : dk ? 'text-teal-500' : 'text-teal-600')}>{freeBeds}</p>
            </div>
            <div className="text-center w-10">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{lang === 'de' ? 'Betten' : 'Beds'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{totalBeds}</p>
            </div>
            <div className="text-right min-w-[100px]">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{lang === 'de' ? 'Kosten' : 'Cost'}</p>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(totalCost)}</p>
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
               <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>

        {/* EXPANDED BREAKDOWN */}
        {open && (
          <div className={cn('p-6 space-y-6 rounded-b-2xl border-t', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50 border-slate-200')} onClick={e => e.stopPropagation()}>
            
            <div className="flex flex-wrap xl:flex-nowrap gap-4 items-end">
              {/* NOTE & ADDRESS ALIGNMENT FIX */}
              <div className="flex-[2.5] min-w-[220px] flex items-end gap-2">
                 <div className="shrink-0">
                    <label className={labelCls}><StickyNote size={12}/> {lang === 'de' ? 'Notiz' : 'Note'}</label>
                    <button 
                      onClick={() => setShowNotes(!showNotes)} 
                      className={cn("w-[38px] h-[38px] rounded-lg border flex items-center justify-center transition-all", 
                        localHotel.notes ? "bg-teal-500/10 border-teal-500/30 text-teal-500" : 
                        dk ? "bg-[#1E293B] border-white/10 text-slate-400 hover:text-white hover:bg-white/5" : 
                        "bg-white border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50"
                      )} 
                      title={lang === 'de' ? 'Notizen' : 'Notes'}
                    >
                      <StickyNote size={16} />
                    </button>
                 </div>
                 <div className="flex-1">
                    <label className={labelCls}><MapPin size={12}/> {lang === 'de' ? 'Adresse' : 'Address'}</label>
                    <input autoComplete="off" value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} onKeyDown={handleEnterBlur} className={inputCls} placeholder="..." />
                 </div>
              </div>
              
              <div className="flex-[1.5] min-w-[140px]">
                 <label className={labelCls}><User size={12}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact'}</label>
                 <input autoComplete="off" value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} onKeyDown={handleEnterBlur} className={inputCls} placeholder="..." />
              </div>
              
              <div className="flex-[1.5] min-w-[140px]">
                 <label className={labelCls}><Phone size={12}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label>
                 <div className={cn('flex items-center rounded-lg border overflow-hidden transition-all focus-within:border-teal-500 h-[38px]', dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}>
                    <span className={cn("px-2.5 text-xs font-bold border-r h-full flex items-center shrink-0", dk ? "bg-black/40 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500")}>
                      {getCountryCode(localHotel.country || 'Germany')}
                    </span>
                    <input autoComplete="off" value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} onKeyDown={handleEnterBlur} className={cn('w-full px-2 py-2 text-sm font-bold outline-none bg-transparent h-full', dk ? 'text-white' : 'text-slate-900')} placeholder="..." />
                 </div>
              </div>
              
              <div className="flex-[1.5] min-w-[160px]">
                 <label className={labelCls}><Mail size={12}/> Email</label>
                 <div className="relative flex items-center h-[38px]">
                   <input autoComplete="off" value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} onKeyDown={handleEnterBlur} className={cn(inputCls, 'pr-10')} placeholder="..." />
                   {localHotel.email && (
                     <a href={`mailto:${localHotel.email}`} className="absolute right-1.5 p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-500 transition-all shadow-sm">
                       <Mail size={14} />
                     </a>
                   )}
                 </div>
              </div>
              
              <div className="flex-[1.5] min-w-[160px]">
                 <label className={labelCls}><Globe size={12}/> {lang === 'de' ? 'Webseite' : 'Website'}</label>
                 <div className="relative flex items-center h-[38px]">
                   <input autoComplete="off" value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} onKeyDown={handleEnterBlur} className={cn(inputCls, 'pr-10')} placeholder="..." />
                   {localHotel.website && (
                     <a href={localHotel.website.startsWith('http') ? localHotel.website : `https://${localHotel.website}`} target="_blank" rel="noreferrer" className="absolute right-1.5 p-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-500 transition-all shadow-sm">
                       <ExternalLink size={14} />
                     </a>
                   )}
                 </div>
              </div>

              <div className="flex-[1] min-w-[120px]">
                 <label className={labelCls}><Building size={12}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                 <ModernDropdown value={localHotel.country || 'Germany'} options={getCountryOptions()} onChange={(v:string) => patchHotel({ country: v })} isDarkMode={dk} lang={lang} />
              </div>
            </div>

            {showNotes && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea autoComplete="off" autoFocus value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} className={cn(inputCls, 'min-h-[60px] h-auto resize-y p-3')} placeholder={lang === 'de' ? "Private Notizen hier eintragen..." : "Write private notes here..."} />
              </div>
            )}
            
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

// --- NOTION STYLE MULTI-SELECT ---
export function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange, onDeleteOption }: any) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
  
  // Safe Array mapping
  const safeSelected = Array.isArray(selected) ? selected : (typeof selected === 'string' && selected ? [selected] : []);
  
  const filteredOptions = safeOptions.filter((o: string) => o.toLowerCase().includes(query.toLowerCase()));
  const exactMatchExists = safeOptions.some((o: string) => o.toLowerCase() === query.trim().toLowerCase());
  const isAlreadySelected = safeSelected.some((o: string) => o.toLowerCase() === query.trim().toLowerCase());
  
  const handleToggle = (opt: string) => {
    onChange(safeSelected.includes(opt) ? safeSelected.filter((t: any) => t !== opt) : [...safeSelected, opt]);
    setQuery('');
  };

  const handleAddNew = () => {
    const val = query.trim();
    if (val && !isAlreadySelected) {
      onChange([...safeSelected, val]);
      setQuery('');
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
            {filteredOptions.map((opt: string) => (
              <div key={opt} className={cn('w-full flex items-center justify-between group transition-all', safeSelected.includes(opt) ? (isDarkMode ? 'text-teal-400 bg-teal-500/10' : 'text-teal-700 bg-teal-50') : (isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'))}>
                <button onClick={() => handleToggle(opt)} className="flex-1 text-left px-4 py-2 text-sm font-bold flex items-center justify-between">
                  {opt} {safeSelected.includes(opt) && <Check size={14} strokeWidth={3} />}
                </button>
                {/* THE TRASH ICON TO DELETE COMPANY GLOBALLY */}
                {onDeleteOption && (
                   <button onClick={(e) => { e.stopPropagation(); onDeleteOption(opt); }} className="px-3 py-2 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete from system">
                     <Trash2 size={13} />
                   </button>
                )}
              </div>
            ))}
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
