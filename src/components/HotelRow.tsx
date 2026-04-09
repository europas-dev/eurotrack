import React, { useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  cn, calcHotelFreeBeds, calcHotelTotalBeds, calcHotelTotalCost, calcHotelTotalNights,
  formatCurrency, formatDateDisplay, getDurationRowLabel, getDurationTabLabel, getEmployeeStatus
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
  onAddBelow?: (afterHotelId: string) => void;
}

export function HotelRow({
  entry,
  isDarkMode,
  lang = 'de',
  companyOptions = [],
  cityOptions = [],
  onDelete,
  onUpdate,
  onAddBelow,
}: HotelRowProps) {
  const dk = isDarkMode;
  const [open, setOpen] = useState(false);
  const [localHotel, setLocalHotel] = useState({ ...entry, durations: entry?.durations ?? [] });
  const [saving, setSaving] = useState(false);
  const [creatingDuration, setCreatingDuration] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  const totalNights = useMemo(() => calcHotelTotalNights(localHotel), [localHotel]);
  const totalCost   = useMemo(() => calcHotelTotalCost(localHotel),   [localHotel]);
  const freeBeds    = useMemo(() => calcHotelFreeBeds(localHotel),    [localHotel]);
  const totalBeds   = useMemo(() => calcHotelTotalBeds ? calcHotelTotalBeds(localHotel) : (localHotel.durations || []).reduce((acc: number, d: any) => {
    const rt = d.roomType || 'DZ';
    const n  = Number(d.numberOfRooms || 1);
    if (rt === 'EZ') return acc + n;
    if (rt === 'DZ') return acc + n * 2;
    if (rt === 'TZ') return acc + n * 3;
    if (rt === 'WG') return acc + n;
    return acc + n;
  }, 0), [localHotel]);

  const employees = useMemo(() =>
    (localHotel.durations || []).flatMap((d: any) => (d.employees || []).filter(Boolean))
  , [localHotel]);

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk
      ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  );

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

  async function addDuration() {
    try {
      setCreatingDuration(true);
      const created = await createDuration({
        hotelId: localHotel.id,
        startDate: '', endDate: '',
        roomType: 'DZ', numberOfRooms: 1,
        pricePerNightPerRoom: 0,
        pricePerBedPerNight: null,
        hasDiscount: false, discountType: 'percentage', discountValue: 0,
        isPaid: false, bookingId: null,
        useManualPrices: false, nightlyPrices: {},
        useBruttoNetto: false, brutto: null, netto: null, mwst: null,
        depositEnabled: false, depositAmount: null,
        rechnungNr: '', extensionNote: '', autoDistribute: true,
      });
      const nextDurations = [...(localHotel.durations || []), { ...created, employees: [] }];
      const next = { ...localHotel, durations: nextDurations };
      setLocalHotel(next);
      onUpdate(localHotel.id, next);
      setOpen(true);
      setActiveDurationTab(nextDurations.length - 1);
    } catch (e) {
      console.error(e);
      alert(lang === 'de' ? 'Dauer konnte nicht erstellt werden' : 'Could not create duration');
    } finally {
      setCreatingDuration(false);
    }
  }

  /* ── pill colour by status ── */
  function employeePillCls(employee: any) {
    const status = getEmployeeStatus(employee?.checkIn, employee?.checkOut);
    if (status === 'ending-soon') return dk ? 'border-red-500 text-red-300'    : 'border-red-400 text-red-700 bg-red-50';
    if (status === 'completed')   return dk ? 'border-green-500 text-green-300' : 'border-green-400 text-green-700 bg-green-50';
    if (status === 'upcoming')    return dk ? 'border-blue-500 text-blue-300'   : 'border-blue-400 text-blue-700 bg-blue-50';
    return dk ? 'border-white/20 text-slate-300' : 'border-slate-300 text-slate-700 bg-slate-50';
  }

  /* ── last-updated display ── */
  const lastUpdatedLabel = useMemo(() => {
    const ts = localHotel.lastUpdatedAt || localHotel.updated_at;
    if (!ts) return null;
    const d = new Date(ts);
    return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }, [localHotel.lastUpdatedAt, localHotel.updated_at, lang]);

  const narrowStatCls = cn('text-center flex-shrink-0 select-none');
  const statNumCls   = cn('text-sm font-black leading-tight');
  const statLblCls   = cn('text-[10px] uppercase tracking-wide leading-tight', dk ? 'text-slate-500' : 'text-slate-400');

  return (
    <div className="space-y-1">
      {/* ━━ CARD ━━ */}
      <div className={cn(
        'rounded-2xl border overflow-hidden',
        dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
      )}>

        {/* ━━ MAIN ROW ━━
            Layout: table-like with fixed-width narrow columns on the right,
            and flexible wrapping columns on the left.
            Row height grows with content – no truncation on text columns. */}
        <div
          className={cn(
            'flex items-stretch gap-0 cursor-pointer select-none',
            dk ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'
          )}
          onClick={() => setOpen(o => !o)}
        >

          {/* COL 1 — chevron (narrow, 40px) */}
          <div className="flex items-center justify-center flex-shrink-0 px-3" style={{ width: 40 }}>
            {open
              ? <ChevronDown  size={16} className={dk ? 'text-blue-400' : 'text-blue-600'} />
              : <ChevronRight size={16} className={dk ? 'text-slate-500' : 'text-slate-400'} />}
          </div>

          {/* COL 2 — Hotel name + city (wraps, min 160px) */}
          <div className="py-3 pr-3 flex-shrink-0" style={{ width: 180, minWidth: 120 }}>
            {/* inline edit: click text to edit, stop propagation */}
            <p
              className={cn('text-sm font-black leading-snug break-words', dk ? 'text-white' : 'text-slate-900')}
              style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
              title={localHotel.name}
              onClick={e => e.stopPropagation()}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => patchHotel({ name: e.currentTarget.textContent || '' })}
                className="outline-none cursor-text focus:underline"
              >
                {localHotel.name}
              </span>
            </p>
            <p
              className={cn('text-[11px] uppercase tracking-widest leading-tight break-words mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}
              style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
              onClick={e => e.stopPropagation()}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => patchHotel({ city: e.currentTarget.textContent || '' })}
                className="outline-none cursor-text focus:underline"
              >
                {localHotel.city}
              </span>
            </p>
          </div>

          {/* COL 3 — Company chips (wraps, min 100px) */}
          <div className="py-3 pr-3 flex-shrink-0" style={{ width: 130, minWidth: 80 }}>
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(localHotel.companyTag)
                ? localHotel.companyTag
                : localHotel.companyTag ? [localHotel.companyTag] : []
              ).map((c: string, i: number) => (
                <span
                  key={i}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold break-words',
                    dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                  )}
                >
                  {c}
                </span>
              ))}
              {!localHotel.companyTag && (
                <span className={cn('text-[10px]', dk ? 'text-slate-600' : 'text-slate-300')}>—</span>
              )}
            </div>
          </div>

          {/* COL 4 — Duration chips (2 per line, wraps) */}
          <div className="py-3 pr-3 flex-1 min-w-[180px]">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
              {(localHotel.durations || []).map((d: any, i: number) => (
                <span
                  key={d.id || i}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-bold leading-tight',
                    dk ? 'bg-white/5 text-slate-300 border border-white/10' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  )}
                  style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
                >
                  {getDurationRowLabel(d, lang)}
                </span>
              ))}
              {(localHotel.durations || []).length === 0 && (
                <span className={cn('text-[10px] col-span-2', dk ? 'text-slate-600' : 'text-slate-300')}>—</span>
              )}
            </div>
          </div>

          {/* COL 5 — Employees (4 per line, wraps) */}
          <div className="py-3 pr-3 flex-1 min-w-[160px]">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              {employees.slice(0, 16).map((emp: any) => (
                <span
                  key={emp.id}
                  className={cn(
                    'px-1.5 py-0.5 rounded border text-[10px] font-bold leading-tight',
                    employeePillCls(emp)
                  )}
                  title={`${emp.name} (${formatDateDisplay(emp.checkIn, lang)} → ${formatDateDisplay(emp.checkOut, lang)})`}
                  style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}
                >
                  {emp.name}
                </span>
              ))}
              {employees.length === 0 && (
                <span className={cn('text-[10px] col-span-4', dk ? 'text-slate-600' : 'text-slate-300')}>—</span>
              )}
            </div>
          </div>

          {/* ── NARROW STAT COLUMNS (right side, fixed widths, single-line) ── */}

          {/* COL 6 — Total Nights */}
          <div className={cn(narrowStatCls, 'py-3 px-2 border-l', dk ? 'border-white/10' : 'border-slate-100')} style={{ width: 64 }}>
            <p className={cn(statLblCls)}>🌙 {lang === 'de' ? 'Nächte' : 'Nights'}</p>
            <p className={cn(statNumCls, 'text-blue-400')}>{totalNights}</p>
          </div>

          {/* COL 7 — Free Beds */}
          <div className={cn(narrowStatCls, 'py-3 px-2 border-l', dk ? 'border-white/10' : 'border-slate-100')} style={{ width: 64 }}>
            <p className={cn(statLblCls)}>{lang === 'de' ? 'Frei' : 'Free'}</p>
            <p className={cn(statNumCls, freeBeds > 0 ? 'text-red-400' : dk ? 'text-slate-500' : 'text-slate-300')}>{freeBeds}</p>
          </div>

          {/* COL 8 — Total Beds */}
          <div className={cn(narrowStatCls, 'py-3 px-2 border-l', dk ? 'border-white/10' : 'border-slate-100')} style={{ width: 64 }}>
            <p className={cn(statLblCls)}>{lang === 'de' ? 'Betten' : 'Beds'}</p>
            <p className={cn(statNumCls, dk ? 'text-slate-300' : 'text-slate-700')}>{totalBeds}</p>
          </div>

          {/* COL 9 — Total Cost (Brutto or total) */}
          <div className={cn(narrowStatCls, 'py-3 px-3 border-l', dk ? 'border-white/10' : 'border-slate-100')} style={{ width: 100 }}>
            <p className={cn(statLblCls)}>{lang === 'de' ? 'Kosten' : 'Cost'}</p>
            <p className={cn(statNumCls, dk ? 'text-white' : 'text-slate-900')} style={{ fontSize: 12 }}>
              {formatCurrency(totalCost)}
            </p>
          </div>

          {/* COL 10 — Last Updated (clock icon + tooltip) */}
          <div
            className={cn('py-3 px-2 border-l flex flex-col items-center justify-center flex-shrink-0', dk ? 'border-white/10' : 'border-slate-100')}
            style={{ width: 40 }}
            title={lastUpdatedLabel ? (lang === 'de' ? `Zuletzt geändert: ${lastUpdatedLabel}` : `Last updated: ${lastUpdatedLabel}`) : (lang === 'de' ? 'Noch nicht gespeichert' : 'Not saved yet')}
          >
            {saving
              ? <Loader2 size={13} className="animate-spin text-blue-400" />
              : <Clock size={13} className={dk ? 'text-slate-600' : 'text-slate-300'} />}
          </div>
        </div>{/* end main row */}

        {/* ━━ EXPANDED PANEL ━━ */}
        {open && (
          <div
            className={cn('border-t p-4 space-y-4', dk ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50')}
            onClick={e => e.stopPropagation()}
          >

            {/* Hotel name / City / Company — inline editable inputs */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { key: 'name',       label: lang === 'de' ? 'Hotelname'  : 'Hotel name', placeholder: 'Hotel...',                                  width: 'w-44', list: undefined },
                { key: 'city',       label: lang === 'de' ? 'Stadt'      : 'City',       placeholder: lang === 'de' ? 'Stadt...' : 'City...',       width: 'w-36', list: `city-list-${localHotel.id}` },
                { key: 'companyTag', label: lang === 'de' ? 'Firma'      : 'Company',    placeholder: lang === 'de' ? 'Firma...' : 'Company...',    width: 'w-36', list: `company-list-${localHotel.id}` },
              ].map(({ key, label, placeholder, width, list }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</label>
                  <input
                    list={list}
                    className={cn(inputCls, width)}
                    value={(localHotel as any)[key] || ''}
                    onChange={e => patchHotel({ [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <datalist id={`city-list-${localHotel.id}`}>
                {cityOptions.map(x => <option key={x} value={x} />)}
              </datalist>
              <datalist id={`company-list-${localHotel.id}`}>
                {companyOptions.map(x => <option key={x} value={x} />)}
              </datalist>
            </div>

            {/* Single row: Address / Contact person / Phone / Email / Website */}
            <div className="flex items-end gap-3 flex-wrap">
              {[
                { key: 'address',       label: lang === 'de' ? 'Adresse'         : 'Address',        placeholder: lang === 'de' ? 'Adresse...'         : 'Address...',        width: 'w-44' },
                { key: 'contactPerson', label: lang === 'de' ? 'Ansprechpartner' : 'Contact person', placeholder: lang === 'de' ? 'Ansprechpartner...' : 'Contact person...',  width: 'w-36' },
                { key: 'contact',       label: lang === 'de' ? 'Telefon'         : 'Phone',          placeholder: lang === 'de' ? 'Telefon...'         : 'Phone...',           width: 'w-32' },
                { key: 'email',         label: 'Email',                                              placeholder: 'Email...',                                                   width: 'w-40' },
                { key: 'webLink',       label: lang === 'de' ? 'Webseite'        : 'Website',        placeholder: lang === 'de' ? 'Webseite...'        : 'Website...',         width: 'w-40' },
              ].map(({ key, label, placeholder, width }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</label>
                  <input
                    className={cn(inputCls, width)}
                    value={(localHotel as any)[key] || ''}
                    onChange={e => patchHotel({ [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <textarea
              className={cn(inputCls, 'min-h-[72px] resize-y')}
              value={localHotel.notes || ''}
              onChange={e => patchHotel({ notes: e.target.value })}
              placeholder={lang === 'de' ? 'Notizen...' : 'Notes...'}
            />

            {/* Duration tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {(localHotel.durations || []).map((d: any, i: number) => (
                <button
                  key={d.id || i}
                  onClick={() => setActiveDurationTab(i)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-bold border transition-all',
                    activeDurationTab === i
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {getDurationTabLabel(d, lang)}
                </button>
              ))}
              <button
                onClick={addDuration}
                disabled={creatingDuration}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {lang === 'de' ? 'Neue Dauer' : 'Add duration'}
              </button>
            </div>

            {/* Duration card */}
            {(localHotel.durations || []).length > 0 ? (
              <DurationCard
                duration={localHotel.durations[activeDurationTab]}
                isDarkMode={dk}
                lang={lang}
                onUpdate={(id, updatedDuration) => {
                  const next = {
                    ...localHotel,
                    durations: (localHotel.durations || []).map((d: any) => d.id === id ? updatedDuration : d),
                  };
                  setLocalHotel(next);
                  onUpdate(localHotel.id, next);
                }}
                onDelete={(durationId) => {
                  const nextDurations = (localHotel.durations || []).filter((d: any) => d.id !== durationId);
                  const next = { ...localHotel, durations: nextDurations };
                  setLocalHotel(next);
                  onUpdate(localHotel.id, next);
                  setActiveDurationTab(prev => Math.max(0, Math.min(prev, nextDurations.length - 1)));
                }}
              />
            ) : (
              <button
                onClick={addDuration}
                disabled={creatingDuration}
                className={cn(
                  'w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500'
                )}
              >
                {creatingDuration
                  ? (lang === 'de' ? 'Erstelle...' : 'Creating...')
                  : (lang === 'de' ? 'Erste Dauer hinzufügen' : 'Add first duration')}
              </button>
            )}

            {/* Actions bar */}
            <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: dk ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
              <button
                onClick={addDuration}
                disabled={creatingDuration}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {lang === 'de' ? 'Dauer' : 'Duration'}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setConfirmDelete(true)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1',
                  dk ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'
                )}
              >
                <Trash2 size={12} />
                {lang === 'de' ? 'Hotel löschen' : 'Delete hotel'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add hotel below */}
      <div className="flex justify-center">
        <button
          onClick={() => onAddBelow?.(localHotel.id)}
          className={cn(
            'px-3 py-1 rounded-full text-[11px] flex items-center gap-1 transition-all',
            dk ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-500'
          )}
        >
          <Plus size={11} />
          {lang === 'de' ? 'Hotel darunter hinzufügen' : 'Add hotel below'}
        </button>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de'
                ? 'Dieses Hotel und alle zugehörigen Buchungen werden dauerhaft gelöscht.'
                : 'This hotel and all related durations will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
              >
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

export default HotelRow;
