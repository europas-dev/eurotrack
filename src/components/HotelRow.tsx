// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  cn, formatCurrency, formatDateDisplay, getDurationTabLabel, getEmployeeStatus, calcDurationFreeBeds, formatDateChip
} from '../lib/utils';
import { createDuration, updateHotel, deleteHotel } from '../lib/supabase';
import { calcRoomCardTotal } from '../lib/roomCardUtils';
import DurationCard from './DurationCard';

interface HotelRowProps {
  entry: any;
  index: number;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  companyOptions?: string[];
  cityOptions?: string[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: any) => void;
}

// Helper to generate type-breakdown tooltips
function getDurationTooltip(d: any, lang: string): string {
  const rc = d.roomCards || [];
  if (rc.length === 0) return lang === 'de' ? 'Keine Zimmer' : 'No rooms';
  const counts: Record<string, number> = {};
  rc.forEach((c: any) => { counts[c.roomType] = (counts[c.roomType] || 0) + 1; });
  const breakdown = Object.entries(counts).map(([type, count]) => `${count} ${type}`).join(', ');
  return `${rc.length} ${lang === 'de' ? 'Zimmer' : 'Rooms'} ➔ ${breakdown}`;
}

export function HotelRow({ entry, index, isDarkMode, lang = 'de', companyOptions = [], cityOptions = [], onDelete, onUpdate }: HotelRowProps) {
  const dk = isDarkMode;
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

  function patchHotel(changes: any) {
    const next = { ...localHotel, ...changes };
    setLocalHotel(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateHotel(localHotel.id, next);
        onUpdate(localHotel.id, next);
      } catch (e) { console.error(e); }
      finally { setSaving(false); }
    }, 400);
  }

  const statLblCls = cn('text-[10px] uppercase tracking-widest font-bold mb-0.5', dk ? 'text-slate-500' : 'text-slate-400');

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  );

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
      console.error(e);
    } finally {
      setCreatingDuration(false);
    }
  }

  return (
    <div className="space-y-1 relative" style={{ zIndex: 100 - index }}>
      <div className={cn('rounded-2xl border overflow-hidden transition-all', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
        <div className={cn('flex items-center gap-0 cursor-pointer p-1', dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70')} onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-center w-10 shrink-0">
            {open ? <ChevronDown size={18} className="text-blue-500" /> : <ChevronRight size={18} className="text-slate-500" />}
          </div>

          <div className="w-52 shrink-0 py-3">
            <p className={cn('text-lg font-black leading-tight truncate', dk ? 'text-white' : 'text-slate-900')}>{localHotel.name}</p>
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              <CityInlineEdit
                value={localHotel.city || ''}
                options={cityOptions}
                isDarkMode={dk}
                hotelId={localHotel.id}
                onChange={val => patchHotel({ city: val || null })}
              />
            </p>
          </div>

          <div className="w-40 shrink-0 px-2" onClick={e => e.stopPropagation()}>
            <CompanyMultiSelect selected={localHotel.companyTag} options={companyOptions} isDarkMode={dk} lang={lang} onChange={tags => patchHotel({ companyTag: tags })} />
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-1 px-4 min-w-0">
            {localHotel.durations.map((d: any) => (
              <div key={d.id} title={getDurationTooltip(d, lang)} className={cn('px-3 py-1.5 rounded-lg text-[13px] font-bold border truncate transition-colors cursor-help', dk ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}>
                {d.startDate && d.endDate ? `${formatDateChip(d.startDate)} - ${formatDateChip(d.endDate)}` : 'New'}
              </div>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-10 pr-6">
            <div className="text-center min-w-[50px]">
              <p className={statLblCls}>{lang === 'de' ? 'Frei' : 'Free'}</p>
              <p className={cn('text-xl font-black', freeBeds > 0 ? 'text-red-500' : 'text-emerald-500')}>{freeBeds}</p>
            </div>
            <div className="text-center min-w-[50px]">
              <p className={statLblCls}>{lang === 'de' ? 'Betten' : 'Beds'}</p>
              <p className={cn('text-xl font-black', dk ? 'text-slate-300' : 'text-slate-700')}>{totalBeds}</p>
            </div>
            <div className="text-right min-w-[120px]">
              <p className={statLblCls}>{lang === 'de' ? 'Kosten' : 'Cost'}</p>
              <p className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(totalCost)}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-slate-500 hover:text-red-500 hover:bg-red-500/10">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {open && (
          <div className={cn('border-t p-6 space-y-6', dk ? 'bg-white/[0.01]' : 'bg-slate-50/30')} onClick={e => e.stopPropagation()}>
            <div className="flex items-end gap-3 flex-wrap">
              {[
                { key: 'address',       label: lang === 'de' ? 'Adresse'         : 'Address',         placeholder: lang === 'de' ? 'Adresse...'          : 'Address...',        width: 'w-44' },
                { key: 'contactPerson', label: lang === 'de' ? 'Ansprechpartner' : 'Contact person', placeholder: lang === 'de' ? 'Ansprechpartner...' : 'Contact person...', width: 'w-36' },
                { key: 'phone',         label: lang === 'de' ? 'Telefon'         : 'Phone',           placeholder: lang === 'de' ? 'Telefon...'          : 'Phone...',          width: 'w-32' },
                { key: 'email',         label: 'Email',                                              placeholder: 'Email...',                                               width: 'w-40' },
                { key: 'webLink',       label: lang === 'de' ? 'Webseite'        : 'Website',         placeholder: lang === 'de' ? 'Webseite...'         : 'Website...',        width: 'w-40' },
              ].map(({ key, label, placeholder, width }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</label>
                  <input className={cn(inputCls, width)} value={(localHotel as any)[key] || ''} onChange={e => patchHotel({ [key]: e.target.value })} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <textarea className={cn(inputCls, 'min-h-[72px] resize-y')} value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })} placeholder={lang === 'de' ? 'Notizen...' : 'Notes...'} />

            <div className="flex items-center gap-2 flex-wrap">
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
                className={cn('w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold',
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
              <button onClick={() => setConfirmDelete(false)} className={cn('px-6 py-2.5 font-bold rounded-xl border border-white/10')}>Cancel</button>
              <button onClick={async () => { await deleteHotel(localHotel.id); onDelete(localHotel.id); }} className="px-6 py-2.5 font-bold rounded-xl bg-red-600 text-white">Delete</button>
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
      <span onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }} className="cursor-text hover:underline">
        {value || <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>—</span>}
      </span>
    );
  }
  return (
    <span onClick={e => e.stopPropagation()}>
      <input autoFocus list={listId} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
        className={cn('text-[11px] uppercase tracking-widest outline-none border-b bg-transparent w-28',
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
    const next = selected.includes(tag)
      ? selected.filter(t => t !== tag)
      : [...selected, tag];
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
      <div
        className="flex flex-wrap gap-1 cursor-pointer min-h-[22px]"
        onClick={() => setOpen(o => !o)}
      >
        {selected.length > 0 ? selected.map(tag => (
          <span key={tag} className={cn(
            'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
            dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
          )}>
            {tag}
            <span onMouseDown={e => { e.preventDefault(); removeTag(tag, e); }} className="cursor-pointer hover:opacity-70 ml-0.5">
              <X size={8} />
            </span>
          </span>
        )) : (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-dashed',
            dk ? 'border-white/20 text-slate-500 hover:border-purple-400 hover:text-purple-400'
               : 'border-slate-300 text-slate-400 hover:border-purple-400 hover:text-purple-600'
          )}>
            <Plus size={8} /> {lang === 'de' ? 'Firma' : 'Company'}
          </span>
        )}
      </div>

      {open && (
        <div className={cn(
          'absolute top-full mt-1 left-0 z-50 rounded-xl border shadow-xl min-w-[180px] py-1',
          dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
        )}>
          {allOptions.length > 0 && (
            <>
              <div className={cn('px-3 pt-1 pb-0.5 text-[9px] font-black uppercase tracking-widest', dk ? 'text-slate-600' : 'text-slate-400')}>
                {lang === 'de' ? 'Firmen' : 'Companies'}
              </div>
              {allOptions.map(opt => (
                <button key={opt} onClick={() => toggle(opt)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors flex items-center gap-2',
                    selected.includes(opt)
                      ? dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700'
                      : dk ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className={cn('w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0',
                    selected.includes(opt)
                      ? 'bg-purple-500 border-purple-500'
                      : dk ? 'border-white/20' : 'border-slate-300'
                  )}>
                    {selected.includes(opt) && <Check size={8} className="text-white" />}
                  </span>
                  {opt}
                </button>
              ))}
            </>
          )}

          <div className={cn('my-1 border-t', dk ? 'border-white/10' : 'border-slate-100')} />

          {!addingNew ? (
            <button onClick={() => { setAddingNew(true); setNewVal(''); }}
              className={cn('w-full text-left px-3 py-1.5 text-[11px] font-bold flex items-center gap-1',
                dk ? 'text-blue-400 hover:bg-white/5' : 'text-blue-600 hover:bg-blue-50'
              )}>
              <Plus size={11} /> {lang === 'de' ? 'Neue Firma erstellen' : 'Create new company'}
            </button>
          ) : (
            <div className="px-2 py-1.5 flex items-center gap-1">
              <input
                autoFocus
                value={newVal}
                onChange={e => setNewVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmNew(); if (e.key === 'Escape') { setAddingNew(false); setNewVal(''); } }}
                placeholder={lang === 'de' ? 'Firmenname...' : 'Company name...'}
                className={cn('flex-1 text-[11px] outline-none border-b bg-transparent py-0.5',
                  dk ? 'border-blue-500 text-white placeholder-slate-600' : 'border-blue-500 text-slate-900 placeholder-slate-400'
                )}
              />
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
