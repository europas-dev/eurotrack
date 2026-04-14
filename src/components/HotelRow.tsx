// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock, Loader2, Plus, Trash2, X, MapPin, User, Phone, Globe, Mail, Building, Star } from 'lucide-react';
import {
  cn, formatCurrency, formatDateDisplay, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatDateChip
} from '../lib/utils';
import { createDuration, updateHotel, deleteHotel } from '../lib/supabase';
import { calcRoomCardTotal } from '../lib/roomCardUtils';
import DurationCard from './DurationCard';

export const COUNTRIES = [
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '+49' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dial: '+41' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', dial: '+43' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '+31' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dial: '+48' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', dial: '+32' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '+33' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', dial: '+352' }
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

// Highlighter Utility
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

// Helper to generate type-breakdown tooltips
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

  // Hidden Match Logic for Search
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

  // Employee Sorting Logic (Active first, Completed pushed to overflow)
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
  const countryData = COUNTRIES.find(c => c.code === (localHotel.country || 'DE')) || COUNTRIES[0];

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

  const statLblCls = cn('text-[10px] uppercase tracking-widest font-bold mb-0.5', dk ? 'text-slate-500' : 'text-slate-400');
  const inputCls = cn('w-full px-3 py-2 rounded-lg text-sm font-bold outline-none border transition-all focus:border-blue-500', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400');

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
      <div className={cn('rounded-2xl border overflow-hidden transition-all duration-200 shadow-sm', dk ? 'bg-[#0F172A] border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300')}>
        
        {/* 1. MAIN COMPACT ROW */}
        <div className={cn('flex items-center gap-0 cursor-pointer p-1', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70')} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-blue-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          {/* Identity */}
          <div className="w-48 shrink-0 py-2 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <h3 className={cn('text-[15px] font-black leading-tight truncate', dk ? 'text-white' : 'text-slate-900')}>
                <HighlightText text={localHotel.name} query={searchQuery} />
              </h3>
            </div>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate mt-0.5", dk ? "text-slate-500" : "text-slate-400")}>
              <CityInlineEdit value={localHotel.city || ''} options={cityOptions} isDarkMode={dk} hotelId={localHotel.id} onChange={val => patchHotel({ city: val || null })} />
            </p>
            {hiddenMatchText && !open && (
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-[9px] font-bold rounded-full truncate max-w-full">
                🔍 {hiddenMatchText}
              </span>
            )}
          </div>

          {/* Company Badge */}
          <div className="w-36 shrink-0 px-2" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={tags => patchHotel({ companyTag: tags })} />
          </div>

          {/* Durations Preview */}
          <div className="flex items-center gap-1.5 flex-wrap w-36 px-2 min-w-0">
            {localHotel.durations.map((d: any) => (
              <div key={d.id} title={getDurationTooltip(d, lang)} className={cn('px-2 py-1 rounded-lg text-[11px] font-bold border truncate transition-colors cursor-help', dk ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}>
                {d.startDate && d.endDate ? `${formatDateChip(d.startDate)} - ${formatDateChip(d.endDate)}` : 'New'}
              </div>
            ))}
          </div>

          {/* Employee Grid (3 per row, max 6) */}
          <div className="flex-1 min-w-[180px] px-2">
            <div className="grid grid-cols-3 gap-1.5 w-max">
              {visibleEmps.map((emp: any, i: number) => {
                const status = getEmployeeStatus(emp.checkIn, emp.checkOut);
                return (
                  <div key={i} className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold truncate text-center transition-all", 
                    status === 'active' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" :
                    status === 'upcoming' ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400" :
                    status === 'ending-soon' ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400" :
                    "bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400"
                  )}>
                    <HighlightText text={emp.name.split(' ')[0]} query={searchQuery} />
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

          {/* Stats & Action Zone (Far Right) */}
          <div className="ml-auto flex items-center gap-6 pr-4 shrink-0">
            <div className="text-center min-w-[40px]">
              <p className={statLblCls}>Free</p>
              <p className={cn('text-lg font-black', freeBeds > 0 ? 'text-red-500' : 'text-emerald-500')}>{freeBeds}</p>
            </div>
            <div className="text-center min-w-[40px]">
              <p className={statLblCls}>Beds</p>
              <p className={cn('text-lg font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{totalBeds}</p>
            </div>
            <div className="text-right min-w-[90px]">
              <p className={statLblCls}>Cost</p>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(totalCost)}</p>
            </div>
            
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
               <button onClick={(e) => { e.stopPropagation(); onTogglePin(); }} className={cn("p-1.5 rounded-lg transition-all", isPinned ? "text-yellow-500" : dk ? "text-slate-500 hover:text-yellow-500" : "text-slate-400 hover:text-yellow-500")}>
                 <Star size={14} className={isPinned ? "fill-yellow-500" : ""} />
               </button>
               <div className="relative group">
                  <button onClick={(e) => e.stopPropagation()} className={cn("p-1.5 rounded-lg transition-all", dk ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}><Clock size={14} /></button>
                  <div className="absolute right-0 bottom-full mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-xl">
                     Updated by {localHotel.updated_by || 'Admin'} on {new Date(localHotel.updated_at || localHotel.created_at).toLocaleDateString()}
                  </div>
               </div>
               <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} className={cn("p-1.5 rounded-lg transition-all", dk ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}><Trash2 size={14} /></button>
            </div>
          </div>
        </div>

        {/* 2. EXPANDED CRM BREAKDOWN */}
        {open && (
          <div className={cn('border-t p-5 space-y-5', dk ? 'bg-[#0B1224] border-white/5' : 'bg-slate-50/50 border-slate-100')} onClick={e => e.stopPropagation()}>
            
            {/* Contact Form Grid */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4">
                 <label className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><MapPin size={10}/> {lang === 'de' ? 'Adresse' : 'Address'}</label>
                 <input value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })} placeholder="Europastrasse 24, 45326..." className={inputCls} />
              </div>
              <div className="col-span-12 md:col-span-4">
                 <label className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><User size={10}/> {lang === 'de' ? 'Ansprechpartner' : 'Contact Person'}</label>
                 <input value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })} placeholder="Max Mustermann..." className={inputCls} />
              </div>
              <div className="col-span-12 md:col-span-4">
                 <label className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><Phone size={10}/> {lang === 'de' ? 'Telefon' : 'Phone'}</label>
                 <div className={cn('flex items-center rounded-lg border overflow-hidden transition-all focus-within:border-blue-500', dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}>
                    <span className={cn('px-2 py-2 text-xs font-black border-r select-none', dk ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}>{countryData.dial}</span>
                    <input value={localHotel.phone || ''} onChange={e => patchHotel({ phone: e.target.value })} placeholder="151 23456789" maxLength={15} className={cn('flex-1 px-3 py-2 text-sm font-bold outline-none bg-transparent', dk ? 'text-white' : 'text-slate-900')} />
                 </div>
              </div>

              <div className="col-span-12 md:col-span-5">
                 <label className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><Mail size={10}/> Email</label>
                 <div className="relative flex items-center">
                   <input value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })} placeholder="hotel@example.com" className={cn(inputCls, 'pr-10')} />
                   {localHotel.email && (
                     <a href={`mailto:${localHotel.email}`} className="absolute right-2 p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-all shadow-sm">
                       <Mail size={12} />
                     </a>
                   )}
                 </div>
              </div>
              <div className="col-span-12 md:col-span-4">
                 <label className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><Globe size={10}/> {lang === 'de' ? 'Webseite' : 'Website'}</label>
                 <div className="relative flex items-center">
                   <input value={localHotel.website || ''} onChange={e => patchHotel({ website: e.target.value })} placeholder="www.hotel.com" className={cn(inputCls, 'pr-10')} />
                   {localHotel.website && (
                     <a href={localHotel.website.startsWith('http') ? localHotel.website : `https://${localHotel.website}`} target="_blank" rel="noreferrer" className="absolute right-2 p-1.5 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-all shadow-sm">
                       <Globe size={12} />
                     </a>
                   )}
                 </div>
              </div>
              <div className="col-span-12 md:col-span-3">
                 <label className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><Building size={10}/> {lang === 'de' ? 'Land' : 'Country'}</label>
                 <select value={localHotel.country || 'DE'} onChange={e => patchHotel({ country: e.target.value })} className={cn('w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none transition-all cursor-pointer appearance-none', dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500')}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code} className={dk?'bg-[#1E293B]':''}>{c.flag} {c.name}</option>)}
                 </select>
              </div>
            </div>

            <textarea className={cn(inputCls, 'min-h-[72px] resize-y font-normal mt-4')} value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} placeholder={lang === 'de' ? 'Notizen...' : 'Notes...'} />

            <div className="flex items-center gap-2 flex-wrap pt-2">
              {(localHotel.durations || []).map((d: any, i: number) => (
                <button key={d.id || i} onClick={() => setActiveDurationTab(i)}
                  className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
                    activeDurationTab === i ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  )}>{getDurationTabLabel(d, lang)}</button>
              ))}
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}>
                {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
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
                className={cn('w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold transition-all',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500'
                )}>
                {creatingDuration ? (lang === 'de' ? 'Erstelle...' : 'Creating...') : (lang === 'de' ? 'Erste Dauer hinzufügen' : 'Add first duration')}
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

// ── City inline-edit with datalist ────────────────────────────────────────────
function CityInlineEdit({ value, options, isDarkMode, hotelId, onChange }: {
  value: string; options: string[]; isDarkMode: boolean; hotelId: string;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const listId = `city-dl-${hotelId}`;
  if (!editing) {
    return (
      <span onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }} className="cursor-text hover:underline inline-block min-w-[30px]">
        {value || <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>—</span>}
      </span>
    );
  }
  return (
    <span onClick={e => e.stopPropagation()}>
      <input autoFocus list={listId} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
        className={cn('text-[10px] font-bold uppercase tracking-widest outline-none border-b bg-transparent w-28',
          isDarkMode ? 'border-blue-500 text-slate-300' : 'border-blue-500 text-slate-500'
        )}
      />
      <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
    </span>
  );
}

// ── Company multi-select dropdown ───────────────────────────────────────────
function CompanyMultiSelect({ selected, options, isDarkMode, lang, onChange }: {
  selected: string[];
  options: string[];
  isDarkMode: boolean;
  lang: string;
  onChange: (tags: string[]) => void;
}) {
  const dk = isDarkMode;
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newVal, setNewVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setAddingNew(false); setNewVal('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function toggle(tag: string) {
    const next = selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag];
    onChange(next);
  }

  function removeTag(tag: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selected.filter(t => t !== tag));
  }

  function confirmNew() {
    const v = newVal.trim();
    if (v && !selected.includes(v)) onChange([...selected, v]);
    setAddingNew(false); setNewVal(''); setOpen(false);
  }

  const allOptions = Array.from(new Set([...options, ...selected])).sort();

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1 cursor-pointer min-h-[22px]" onClick={() => setOpen(o => !o)}>
        {selected.length > 0 ? selected.map(tag => (
          <span key={tag} className={cn('inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border', dk ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}>
            {tag}
            <span onMouseDown={e => { e.preventDefault(); removeTag(tag, e); }} className="cursor-pointer hover:opacity-70 ml-0.5">
              <X size={8} />
            </span>
          </span>
        )) : (
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-dashed', dk ? 'border-white/20 text-slate-500 hover:border-blue-400 hover:text-blue-400' : 'border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600')}>
            <Plus size={8} /> {lang === 'de' ? 'Firma' : 'Company'}
          </span>
        )}
      </div>

      {open && (
        <div className={cn('absolute top-full mt-1 left-0 z-50 rounded-xl border shadow-xl min-w-[180px] py-1', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
          {allOptions.length > 0 && (
            <>
              <div className={cn('px-3 pt-1 pb-0.5 text-[9px] font-black uppercase tracking-widest', dk ? 'text-slate-600' : 'text-slate-400')}>
                {lang === 'de' ? 'Firmen' : 'Companies'}
              </div>
              {allOptions.map(opt => (
                <button key={opt} onClick={() => toggle(opt)} className={cn('w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors flex items-center gap-2', selected.includes(opt) ? (dk ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700') : (dk ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'))}>
                  <span className={cn('w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0', selected.includes(opt) ? 'bg-blue-500 border-blue-500' : (dk ? 'border-white/20' : 'border-slate-300'))}>
                    {selected.includes(opt) && <Check size={8} className="text-white" />}
                  </span>
                  {opt}
                </button>
              ))}
            </>
          )}
          <div className={cn('my-1 border-t', dk ? 'border-white/10' : 'border-slate-100')} />
          {!addingNew ? (
            <button onClick={() => { setAddingNew(true); setNewVal(''); }} className={cn('w-full text-left px-3 py-1.5 text-[11px] font-bold flex items-center gap-1', dk ? 'text-blue-400 hover:bg-white/5' : 'text-blue-600 hover:bg-blue-50')}>
              <Plus size={11} /> {lang === 'de' ? 'Neue Firma' : 'New company'}
            </button>
          ) : (
            <div className="px-2 py-1.5 flex items-center gap-1">
              <input autoFocus value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmNew(); if (e.key === 'Escape') { setAddingNew(false); setNewVal(''); } }} placeholder={lang === 'de' ? 'Firmenname...' : 'Company name...'} className={cn('flex-1 text-[11px] outline-none border-b bg-transparent py-0.5', dk ? 'border-blue-500 text-white placeholder-slate-600' : 'border-blue-500 text-slate-900 placeholder-slate-400')} />
              <button onClick={confirmNew} className="text-blue-500 hover:text-blue-400 p-0.5"><Check size={12} /></button>
              <button onClick={() => { setAddingNew(false); setNewVal(''); }} className={cn('p-0.5', dk ? 'text-slate-500' : 'text-slate-400')}><X size={12} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HotelRow;
