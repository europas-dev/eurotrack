import React, { useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights,
  calcHotelPaidTotal, calcHotelUnpaidTotal,
  formatCurrency, formatDateDisplay, getDurationTabLabel, getEmployeeStatus, highlightText
} from '../lib/utils';
import { createDuration, updateHotel } from '../lib/supabase';
import DurationCard from './DurationCard';

interface HotelRowProps {
  entry: any;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  companyOptions?: string[];
  cityOptions?: string[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: any) => void;
  showPaidTotals?: boolean;
  searchQuery?: string;
}

export function HotelRow({
  entry, isDarkMode, lang = 'de', companyOptions = [], cityOptions = [],
  onDelete, onUpdate, showPaidTotals = false, searchQuery = '',
}: HotelRowProps) {
  const dk = isDarkMode;
  const [open, setOpen] = useState(false);
  const [localHotel, setLocalHotel] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [creatingDuration, setCreatingDuration] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  const totalNights = useMemo(() => calcHotelTotalNights(localHotel), [localHotel]);
  const totalCost   = useMemo(() => calcHotelTotalCost(localHotel),   [localHotel]);
  const freeBeds    = useMemo(() => calcHotelFreeBeds(localHotel),    [localHotel]);
  const paidTotal   = useMemo(() => calcHotelPaidTotal(localHotel),   [localHotel]);
  const unpaidTotal = useMemo(() => calcHotelUnpaidTotal(localHotel), [localHotel]);
  const employees   = useMemo(() => localHotel.durations.flatMap((d: any) => d.employees.filter(Boolean)), [localHotel]);

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  );

  function patchHotel(changes: any) {
    const next = { ...localHotel, ...changes };
    setLocalHotel(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await updateHotel(localHotel.id, next); onUpdate(localHotel.id, next); }
      catch (e) { console.error(e); }
      finally { setSaving(false); }
    }, 400);
  }

  async function addDuration() {
    try {
      setCreatingDuration(true);
      const created = await createDuration({
        hotelId: localHotel.id, startDate: '', endDate: '', roomType: 'DZ',
        numberOfRooms: 1, pricePerNightPerRoom: 0, hasDiscount: false,
        discountType: 'percentage', discountValue: 0, isPaid: false,
        depositEnabled: false, depositAmount: 0, invoiceNumber: '',
        bookingId: null, useManualPrices: false, nightlyPrices: {},
      });
      const nextDurations = [...localHotel.durations, { ...created, employees: [] }];
      const next = { ...localHotel, durations: nextDurations };
      setLocalHotel(next);
      onUpdate(localHotel.id, next);
      setOpen(true);
      setActiveDurationTab(nextDurations.length - 1);
    } catch (e) { console.error(e); }
    finally { setCreatingDuration(false); }
  }

  const employeePillClass = (employee: any) => {
    const status = getEmployeeStatus(employee?.checkIn, employee?.checkOut);
    if (status === 'ending-soon') return dk ? 'border-red-500 text-red-300 bg-red-500/10' : 'border-red-300 text-red-700 bg-red-50';
    if (status === 'completed')   return dk ? 'border-green-500 text-green-300 bg-green-500/10' : 'border-green-300 text-green-700 bg-green-50';
    if (status === 'upcoming')    return dk ? 'border-blue-500 text-blue-300 bg-blue-500/10' : 'border-blue-300 text-blue-700 bg-blue-50';
    return dk ? 'border-white/10 text-slate-200 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50';
  };

  function hl(text: string) {
    if (!searchQuery || !text) return text;
    return highlightText(text, searchQuery);
  }

  function openToDuration(idx: number) {
    setOpen(true);
    setActiveDurationTab(idx);
  }

  return (
    <div className="space-y-1">
      <div className={cn('rounded-2xl border overflow-hidden', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

        {/* ── MAIN ROW ─────────────────────────────────────────── */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">

            {/* Chevron expand */}
            <button
              onClick={() => setOpen(!open)}
              className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Name + city + company */}
            <div className="min-w-[160px] flex-shrink-0">
              <p className={cn('text-sm font-black leading-tight', dk ? 'text-white' : 'text-slate-900')}
                dangerouslySetInnerHTML={{ __html: hl(localHotel.name || '—') }} />
              <p className={cn('text-[11px] uppercase tracking-widest leading-tight', dk ? 'text-slate-500' : 'text-slate-400')}
                dangerouslySetInnerHTML={{ __html: hl(localHotel.city || '') }} />
            </div>

            <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex-shrink-0',
              dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')}
              dangerouslySetInnerHTML={{ __html: hl(localHotel.companyTag || '') }} />

            {/* Duration tags */}
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none">
              {localHotel.durations.map((d: any, i: number) => (
                <button key={d.id || i}
                  onClick={() => openToDuration(i)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap flex-shrink-0 border transition-all',
                    dk ? 'bg-white/5 border-white/10 text-slate-300 hover:border-blue-500/40 hover:text-blue-400'
                       : 'bg-slate-100 border-transparent text-slate-600 hover:border-blue-300 hover:text-blue-600'
                  )}>
                  {getDurationTabLabel(d, lang)}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Nights */}
            <div className="text-center min-w-[60px] flex-shrink-0">
              <p className="text-sm font-black text-blue-400">{totalNights}</p>
              <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Nächte' : 'nights'}</p>
            </div>

            {/* Free beds — red when > 0 */}
            <button
              onClick={() => openToDuration(0)}
              className="text-center min-w-[52px] flex-shrink-0 cursor-pointer">
              <p className={cn('text-sm font-black', freeBeds > 0 ? 'text-red-400' : 'text-green-400')}>{freeBeds}</p>
              <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'frei' : 'free'}</p>
            </button>

            {/* Employee pills */}
            <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
              {employees.slice(0, 5).map((emp: any) => (
                <button key={emp.id}
                  onClick={() => openToDuration(localHotel.durations.findIndex((d: any) => d.employees?.includes(emp)))}
                  className={cn('px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap', employeePillClass(emp))}
                  title={`${emp.name} ${formatDateDisplay(emp.checkIn, lang)} – ${formatDateDisplay(emp.checkOut, lang)}`}>
                  {emp.name}
                </button>
              ))}
            </div>

            {/* Total cost */}
            <div className={cn('text-sm font-black min-w-[90px] text-right flex-shrink-0', dk ? 'text-white' : 'text-slate-900')}>
              {formatCurrency(totalCost)}
            </div>

            {/* Conditional paid/unpaid totals */}
            {showPaidTotals && (
              <div className="flex gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-[10px] text-green-400 font-bold">{formatCurrency(paidTotal)}</p>
                  <p className={cn('text-[9px] uppercase', dk ? 'text-slate-600' : 'text-slate-400')}>{lang === 'de' ? 'bezahlt' : 'paid'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-red-400 font-bold">{formatCurrency(unpaidTotal)}</p>
                  <p className={cn('text-[9px] uppercase', dk ? 'text-slate-600' : 'text-slate-400')}>{lang === 'de' ? 'offen' : 'unpaid'}</p>
                </div>
              </div>
            )}

            {saving && <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />}

            {/* Add duration */}
            <button onClick={addDuration} disabled={creatingDuration}
              className={cn('px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1 flex-shrink-0',
                dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
              {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {lang === 'de' ? 'Dauer' : 'Duration'}
            </button>

            {/* Delete */}
            <button onClick={() => setConfirmDelete(true)}
              className={cn('p-2 rounded-lg flex-shrink-0', dk ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* ── EXPANDED PANEL ───────────────────────────────────── */}
        {open && (
          <div className={cn('border-t p-4 space-y-4', dk ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50')}>

            {/* Hotel editable fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className={inputCls} value={localHotel.name || ''} onChange={e => patchHotel({ name: e.target.value })}
                placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'} />
              <input list={`city-list-${localHotel.id}`} className={inputCls} value={localHotel.city || ''} onChange={e => patchHotel({ city: e.target.value })}
                placeholder={lang === 'de' ? 'Stadt...' : 'City...'} />
              <datalist id={`city-list-${localHotel.id}`}>{cityOptions.map(x => <option key={x} value={x} />)}</datalist>
              <input list={`company-list-${localHotel.id}`} className={inputCls} value={localHotel.companyTag || ''} onChange={e => patchHotel({ companyTag: e.target.value })}
                placeholder={lang === 'de' ? 'Firma...' : 'Company...'} />
              <datalist id={`company-list-${localHotel.id}`}>{companyOptions.map(x => <option key={x} value={x} />)}</datalist>
              <input className={inputCls} value={localHotel.address || ''} onChange={e => patchHotel({ address: e.target.value })}
                placeholder={lang === 'de' ? 'Adresse...' : 'Address...'} />
              <input className={inputCls} value={localHotel.contactPerson || ''} onChange={e => patchHotel({ contactPerson: e.target.value })}
                placeholder={lang === 'de' ? 'Ansprechpartner...' : 'Contact person...'} />
              <input className={inputCls} value={localHotel.contact || ''} onChange={e => patchHotel({ contact: e.target.value })}
                placeholder={lang === 'de' ? 'Telefon...' : 'Phone...'} />
              <input className={inputCls} value={localHotel.email || ''} onChange={e => patchHotel({ email: e.target.value })}
                placeholder="Email..." />
              <input className={inputCls} value={localHotel.webLink || ''} onChange={e => patchHotel({ webLink: e.target.value })}
                placeholder={lang === 'de' ? 'Webseite...' : 'Website...'} />
            </div>
            <textarea className={cn(inputCls, 'min-h-[70px] resize-y')} value={localHotel.notes || ''} onChange={e => patchHotel({ notes: e.target.value })}
              placeholder={lang === 'de' ? 'Notizen...' : 'Notes...'} />

            {/* Last updated metadata */}
            {(localHotel.updatedAt || localHotel.updatedBy) && (
              <p className={cn('text-[10px]', dk ? 'text-slate-600' : 'text-slate-400')}>
                {lang === 'de' ? 'Zuletzt geändert' : 'Last updated'}: {localHotel.updatedBy ? `${localHotel.updatedBy} · ` : ''}{localHotel.updatedAt ? new Date(localHotel.updatedAt).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB') : ''}
              </p>
            )}

            {/* Duration tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {localHotel.durations.map((d: any, i: number) => (
                <button key={d.id || i} onClick={() => setActiveDurationTab(i)}
                  className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
                    activeDurationTab === i
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                  {getDurationTabLabel(d, lang)}
                </button>
              ))}
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {lang === 'de' ? 'Neue Dauer' : 'Add duration'}
              </button>
            </div>

            {localHotel.durations.length > 0 ? (
              <DurationCard
                duration={localHotel.durations[activeDurationTab]}
                isDarkMode={dk} lang={lang}
                onUpdate={(id: string, updatedDuration: any) => {
                  const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? updatedDuration : d) };
                  setLocalHotel(next); onUpdate(localHotel.id, next);
                }}
                onDelete={(durationId: string) => {
                  const nextDurations = localHotel.durations.filter((d: any) => d.id !== durationId);
                  const next = { ...localHotel, durations: nextDurations };
                  setLocalHotel(next); onUpdate(localHotel.id, next);
                  setActiveDurationTab(prev => Math.max(0, Math.min(prev, nextDurations.length - 1)));
                }}
              />
            ) : (
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400'
                     : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500')}>
                {creatingDuration ? (lang === 'de' ? 'Erstelle...' : 'Creating...') : (lang === 'de' ? 'Erste Dauer hinzufügen' : 'Add first duration')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Dieses Hotel und alle zugehörigen Buchungen werden dauerhaft gelöscht.' : 'This hotel and all related durations will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={() => onDelete(localHotel.id)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
