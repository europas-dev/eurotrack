// src/components/HotelRow.tsx
import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Trash2, Plus } from 'lucide-react';
import {
  cn, formatCurrency, calculateNights, getTotalBeds,
  getFreeBeds, getDurationTotal, getDurationTagLabel,
  getEmployeeStatus, getEmployeeStatusColor,
} from '../lib/utils';
import { offlineSync } from '../lib/offlineSync';
import { createDuration, deleteDuration as supaDeleteDuration } from '../lib/supabase';
import DurationCard from './DurationCard';

interface Props {
  hotel: any;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  highlightText?: string;
  showPaidAmounts?: boolean;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onDurationUpdate: (hotelId: string, durId: string, data: any) => void;
  onDurationDelete: (hotelId: string, durId: string) => void;
  onDurationCreate: (hotelId: string, dur: any) => void;
}

export default function HotelRow({
  hotel, isDarkMode: dk, lang = 'de', highlightText = '', showPaidAmounts = false,
  onUpdate, onDelete, onDurationUpdate, onDurationDelete, onDurationCreate,
}: Props) {
  const [expanded, setExpanded]         = useState(false);
  const [activeDurIdx, setActiveDurIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingDur, setAddingDur]       = useState(false);
  const saveTimer = useRef<any>(null);
  const today = new Date().toISOString().split('T')[0];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalNights = hotel.durations.reduce((s: number, d: any) => s + calculateNights(d.startDate, d.endDate), 0);
  const totalCost   = hotel.durations.reduce((s: number, d: any) => s + getDurationTotal(d), 0);
  const paidCost    = hotel.durations.filter((d:any) => d.isPaid).reduce((s:number,d:any) => s + getDurationTotal(d), 0);
  const unpaidCost  = totalCost - paidCost;
  const freeBeds    = hotel.durations.reduce((s:number,d:any) => s + getFreeBeds(d, today), 0);

  const allEmployees: any[] = [];
  hotel.durations.forEach((d: any) => {
    (d.employees || []).forEach((e: any) => { if (e) allEmployees.push({ ...e, durationId: d.id }); });
  });

  // ── Inline edit ────────────────────────────────────────────────────────────
  function patchHotel(changes: any) {
    const next = { ...hotel, ...changes };
    onUpdate(hotel.id, next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await offlineSync.enqueue({ type: 'updateHotel', payload: { id: hotel.id, ...next } });
    }, 400);
  }

  // ── Highlight ──────────────────────────────────────────────────────────────
  function hl(text: string): React.ReactNode {
    if (!highlightText || !text) return text;
    const re = new RegExp(`(${highlightText.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return text.split(re).map((p, i) =>
      re.test(p) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 rounded px-0.5">{p}</mark> : p
    );
  }

  // ── Add duration ───────────────────────────────────────────────────────────
  async function handleAddDuration() {
    if (addingDur) return;
    setAddingDur(true);
    try {
      const created = await createDuration({ hotelId: hotel.id });
      onDurationCreate(hotel.id, created);
      setActiveDurIdx(hotel.durations.length);
      setExpanded(true);
    } catch {
      await offlineSync.enqueue({ type: 'createDuration', payload: { hotelId: hotel.id } });
    }
    setAddingDur(false);
  }

  // ── Delete hotel ───────────────────────────────────────────────────────────
  async function handleDelete() {
    await offlineSync.enqueue({ type: 'deleteHotel', payload: { id: hotel.id } });
    onDelete(hotel.id);
    setConfirmDelete(false);
  }

  const inp = cn(
    'bg-transparent outline-none border-b transition-all text-sm font-semibold min-w-0',
    dk ? 'border-transparent focus:border-white/30 text-white placeholder-slate-600'
       : 'border-transparent focus:border-slate-300 text-slate-900 placeholder-slate-300'
  );

  return (
    <div className={cn('rounded-xl border transition-all',
      dk ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-sm'
    )}>

      {/* ══ MAIN ROW ════════════════════════════════════════════════════════ */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 min-h-[52px] flex-wrap',
        expanded && (dk ? 'border-b border-white/10' : 'border-b border-slate-100')
      )}>

        {/* Chevron */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('shrink-0 p-1 rounded-md transition-colors',
            dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-400')}
        >
          {expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
        </button>

        {/* Hotel name — inline editable */}
        <input
          value={hotel.name || ''}
          onChange={e => patchHotel({ name: e.target.value })}
          placeholder={lang==='de' ? 'Hotelname...' : 'Hotel name...'}
          className={cn(inp, 'w-36 min-w-[100px]')}
        />

        <span className={cn('select-none', dk ? 'text-slate-700' : 'text-slate-300')}>·</span>

        {/* City — inline editable */}
        <input
          value={hotel.city || ''}
          onChange={e => patchHotel({ city: e.target.value })}
          placeholder={lang==='de' ? 'Stadt...' : 'City...'}
          className={cn(inp, 'w-24 min-w-[70px]')}
        />

        <span className={cn('select-none', dk ? 'text-slate-700' : 'text-slate-300')}>·</span>

        {/* Company — inline editable */}
        <input
          value={hotel.companyTag || ''}
          onChange={e => patchHotel({ companyTag: e.target.value })}
          placeholder={lang==='de' ? 'Firma...' : 'Company...'}
          className={cn(inp, 'w-28 min-w-[70px]')}
        />

        {/* Duration tags */}
        {hotel.durations.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-1">
            {hotel.durations.map((d: any, i: number) => (
              <button
                key={d.id}
                onClick={() => { setExpanded(true); setActiveDurIdx(i); }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors',
                  d.isPaid
                    ? dk ? 'bg-green-900/30 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
                    : dk ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                )}
                title={`${d.startDate || '?'} → ${d.endDate || '?'}`}
              >
                {getDurationTagLabel(d)}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-w-[8px]"/>

        {/* Total nights */}
        {totalNights > 0 && (
          <span className={cn('text-xs font-semibold shrink-0', dk ? 'text-slate-500' : 'text-slate-400')}>
            {totalNights}N
          </span>
        )}

        {/* Free beds — RED if > 0 */}
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            'text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-full transition-colors',
            freeBeds > 0
              ? 'bg-red-500/15 text-red-500'
              : dk ? 'text-slate-700' : 'text-slate-300'
          )}
          title={`${freeBeds} ${lang==='de' ? 'freie Betten heute' : 'free beds today'}`}
        >
          {freeBeds > 0 ? `${freeBeds} frei` : '—'}
        </button>

        {/* Employee pills */}
        <div className="flex items-center gap-1 flex-wrap shrink-0 max-w-[180px]">
          {allEmployees.slice(0, 4).map((e: any, i: number) => {
            const status = getEmployeeStatus(e, today);
            return (
              <span key={i} className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold truncate max-w-[72px]',
                getEmployeeStatusColor(status)
              )}>
                {e.name}
              </span>
            );
          })}
          {allEmployees.length > 4 && (
            <span className={cn('text-[10px] font-semibold', dk ? 'text-slate-500' : 'text-slate-400')}>
              +{allEmployees.length - 4}
            </span>
          )}
        </div>

        {/* Total cost */}
        <span className={cn('text-sm font-black shrink-0', dk ? 'text-white' : 'text-slate-900')}>
          {formatCurrency(totalCost)}
        </span>

        {/* Paid / unpaid — only when payment filter is active */}
        {showPaidAmounts && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-green-500">{formatCurrency(paidCost)}</span>
            <span className="text-[11px] font-semibold text-red-400">{formatCurrency(unpaidCost)}</span>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={14}/>
        </button>
      </div>

      {/* ══ EXPANDED PANEL ══════════════════════════════════════════════════ */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-4">

          {/* Contact fields — only here, not in main row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              { key: 'address',       label: lang==='de' ? 'Adresse'         : 'Address',        ph: 'Musterstr. 1, Berlin' },
              { key: 'contactPerson', label: lang==='de' ? 'Ansprechpartner' : 'Contact person', ph: 'Max Mustermann' },
              { key: 'contact',       label: lang==='de' ? 'Telefon'         : 'Phone',          ph: '+49 30 ...' },
              { key: 'email',         label: 'E-Mail',                                           ph: 'hotel@example.com' },
              { key: 'webLink',       label: 'Website',                                          ph: 'https://...' },
            ] as { key: string; label: string; ph: string }[]).map(({ key, label, ph }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className={cn('text-[10px] font-semibold uppercase tracking-wide',
                  dk ? 'text-slate-500' : 'text-slate-400')}>{label}</label>
                <input
                  value={(hotel as any)[key] || ''}
                  onChange={e => patchHotel({ [key]: e.target.value })}
                  placeholder={ph}
                  className={cn('px-2.5 py-1.5 rounded-md border text-sm outline-none transition-all',
                    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
                       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400'
                  )}
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold uppercase tracking-wide',
              dk ? 'text-slate-500' : 'text-slate-400')}>{lang==='de' ? 'Notiz' : 'Notes'}</label>
            <textarea
              value={hotel.notes || ''}
              onChange={e => patchHotel({ notes: e.target.value })}
              placeholder={lang==='de' ? 'Interne Notiz...' : 'Internal note...'}
              rows={2}
              className={cn('px-2.5 py-1.5 rounded-md border text-sm outline-none resize-none transition-all',
                dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
                   : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400'
              )}
            />
          </div>

          {/* Last updated */}
          {hotel.lastUpdatedBy && (
            <p className={cn('text-[10px]', dk ? 'text-slate-600' : 'text-slate-400')}>
              {lang==='de' ? 'Zuletzt geändert von' : 'Last updated by'}: {hotel.lastUpdatedBy}
              {hotel.lastUpdatedAt && ` · ${new Date(hotel.lastUpdatedAt).toLocaleString('de-DE')}`}
            </p>
          )}

          {/* Duration tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {hotel.durations.map((d: any, i: number) => (
              <button
                key={d.id}
                onClick={() => setActiveDurIdx(i)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                  activeDurIdx === i
                    ? 'bg-blue-600 text-white border-blue-600'
                    : dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {getDurationTagLabel(d)}
              </button>
            ))}
            <button
              onClick={handleAddDuration}
              disabled={addingDur}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <Plus size={12}/>{lang==='de' ? 'Aufenthalt' : 'Duration'}
            </button>
          </div>

          {/* Empty state */}
          {hotel.durations.length === 0 && (
            <div
              onClick={handleAddDuration}
              className={cn(
                'rounded-xl border-2 border-dashed flex items-center justify-center py-8 cursor-pointer transition-colors',
                dk ? 'border-white/10 hover:border-white/20 text-slate-600 hover:text-slate-400'
                   : 'border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-500'
              )}
            >
              <Plus size={16} className="mr-2"/>
              {lang==='de' ? 'Ersten Aufenthalt hinzufügen' : 'Add first duration'}
            </div>
          )}

          {/* Active duration card */}
          {hotel.durations[activeDurIdx] && (
            <DurationCard
              key={hotel.durations[activeDurIdx].id}
              duration={hotel.durations[activeDurIdx]}
              isDarkMode={dk}
              lang={lang}
              onUpdate={(id, data) => onDurationUpdate(hotel.id, id, data)}
              onDelete={id => {
                onDurationDelete(hotel.id, id);
                setActiveDurIdx(Math.max(0, activeDurIdx - 1));
              }}
            />
          )}
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={cn('w-full max-w-sm rounded-xl border p-5',
            dk ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}>
            <h3 className="text-base font-black mb-2">{lang==='de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {hotel.name || (lang==='de' ? 'Dieses Hotel' : 'This hotel')} {lang==='de' ? 'wird dauerhaft gelöscht.' : 'will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-semibold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                )}>
                {lang==='de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang==='de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
