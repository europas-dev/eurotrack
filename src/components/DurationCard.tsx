import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Loader2, Tag, Trash2, Minus, Plus } from 'lucide-react';
import {
  cn, calculateNights, formatCurrency,
  getDurationGapInfo, getDurationTotal,
  getNightsBetween, getTotalBeds, normalizeNumberInput
} from '../lib/utils';
import { deleteDuration, updateDuration } from '../lib/supabase';
import EmployeeSlot from './EmployeeSlot';

interface DurationCardProps {
  duration: any;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  onUpdate: (id: string, updated: any) => void;
  onDelete: (id: string) => void;
}

export default function DurationCard({
  duration,
  isDarkMode,
  lang = 'de',
  onUpdate,
  onDelete,
}: DurationCardProps) {
  const dk = isDarkMode;
  const [local, setLocal] = useState(duration);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');
  const [totalFocused, setTotalFocused] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => { setLocal(duration); }, [duration]);

  const totalBeds = getTotalBeds(local.roomType, local.numberOfRooms);
  const nights = calculateNights(local.startDate, local.endDate);
  const nightlyPrices = local.nightlyPrices || {};
  const allNights = useMemo(() => getNightsBetween(local.startDate, local.endDate), [local.startDate, local.endDate]);
  const gaps = getDurationGapInfo(local);
  const total = getDurationTotal(local);

  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  );
  const labelCls = cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500');

  function queueSave(next: any) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateDuration(local.id, next);
        onUpdate(local.id, next);
      } catch (e) { console.error(e); }
      finally { setSaving(false); }
    }, 400);
  }

  function patch(changes: any) {
    const next = { ...local, ...changes };
    setLocal(next);
    queueSave(next);
  }

  function onEmployeeUpdated(slotIndex: number, employee: any | null) {
    const employees = [...(local.employees || [])];
    while (employees.length < totalBeds) employees.push(null);
    employees[slotIndex] = employee;
    const next = { ...local, employees };
    setLocal(next);
    onUpdate(local.id, next);
  }

  async function handleDelete() {
    try { await deleteDuration(local.id); onDelete(local.id); }
    catch (e) { console.error(e); }
  }

  function commitReverseCalc(raw: string) {
    const entered = normalizeNumberInput(raw);
    if (entered > 0 && nights > 0 && roomCount > 0) {
      patch({ pricePerNightPerRoom: entered / nights / roomCount });
    }
    setTotalDraft('');
    setTotalFocused(false);
  }

  const mwstRate  = local.mwst   != null ? Number(local.mwst)   : null;
  const bruttoVal = local.brutto != null ? Number(local.brutto) : null;
  const nettoVal  = local.netto  != null ? Number(local.netto)  : null;
  let derivedNetto:  number | null = null;
  let derivedBrutto: number | null = null;
  if (local.useBruttoNetto) {
    if (bruttoVal != null && mwstRate != null) derivedNetto  = bruttoVal / (1 + mwstRate / 100);
    else if (nettoVal != null && mwstRate != null) derivedBrutto = nettoVal * (1 + mwstRate / 100);
  }

  const roomCount = Math.max(1, Number(local.numberOfRooms || 1));

  return (
    <div className={cn('rounded-2xl border p-4 space-y-4', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      {/* Row 1: Dates / room type / count / nights / beds / actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={local.startDate || ''} onChange={e => patch({ startDate: e.target.value })} className={cn(inputCls, 'w-40')} />
        <input type="date" value={local.endDate   || ''} onChange={e => patch({ endDate:   e.target.value })} className={cn(inputCls, 'w-40')} />

        <select value={local.roomType || 'DZ'} onChange={e => patch({ roomType: e.target.value })} className={cn(inputCls, 'w-24')}>
          <option value="EZ">EZ</option>
          <option value="DZ">DZ</option>
          <option value="TZ">TZ</option>
          <option value="WG">WG</option>
        </select>

        <div className={cn('flex items-center rounded-lg border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
          <button onClick={() => patch({ numberOfRooms: Math.max(1, roomCount - 1) })} className={cn('px-3 py-2', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Minus size={14} /></button>
          <div className={cn('px-3 py-2 text-sm font-bold min-w-[52px] text-center', dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900')}>{roomCount}</div>
          <button onClick={() => patch({ numberOfRooms: roomCount + 1 })} className={cn('px-3 py-2', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Plus size={14} /></button>
        </div>

        <div className={cn('text-sm font-bold', dk ? 'text-slate-300' : 'text-slate-700')}>
          {nights} {lang === 'de' ? 'Nächte' : 'nights'}
        </div>
        <div className={cn('text-sm font-bold', dk ? 'text-slate-300' : 'text-slate-700')}>
          {totalBeds} {lang === 'de' ? 'Betten' : 'beds'}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={cn('px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1',
              dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
          >
            <CalendarDays size={13} />
            {showCalendar ? (lang === 'de' ? 'Kalender ausblenden' : 'Hide calendar') : (lang === 'de' ? 'Kalender zeigen' : 'Show calendar')}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1"
          >
            <Trash2 size={13} />
            {lang === 'de' ? 'Löschen' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Row 2: Price / night / room + Reverse-calc + toggles */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === 'de' ? 'Preis / Nacht / Zimmer' : 'Price / night / room'}</label>
          <input
            type="number" min={0} step="0.01"
            value={local.pricePerNightPerRoom ?? 0}
            onChange={e => patch({ pricePerNightPerRoom: normalizeNumberInput(e.target.value) })}
            className={cn(inputCls, 'w-28')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === 'de' ? 'Oder Gesamtpreis eingeben' : 'Or enter total'}</label>
          <input
            type="number" min={0} step="0.01"
            value={totalFocused ? totalDraft : (total > 0 ? total.toFixed(2) : '')}
            placeholder={lang === 'de' ? 'Gesamt → auto' : 'Total → auto'}
            onFocus={() => { setTotalFocused(true); setTotalDraft(''); }}
            onChange={e => setTotalDraft(e.target.value)}
            onBlur={e => commitReverseCalc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitReverseCalc(totalDraft); }}
            className={cn(inputCls, 'w-32')}
          />
        </div>

        <button
          onClick={() => patch({ useManualPrices: !local.useManualPrices })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all self-end',
            local.useManualPrices ? 'bg-purple-600 text-white border-purple-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
        >
          {local.useManualPrices ? (lang === 'de' ? 'Manuelle Preise AN' : 'Manual ON') : (lang === 'de' ? 'Manuelle Nachtpreise' : 'Manual nightly')}
        </button>

        <button
          onClick={() => patch({ hasDiscount: !local.hasDiscount })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 self-end',
            local.hasDiscount ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
        >
          <Tag size={12} />
          {lang === 'de' ? 'Rabatt' : 'Discount'}
        </button>

        {local.hasDiscount && (
          <>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{lang === 'de' ? 'Rabatttyp' : 'Type'}</label>
              <select value={local.discountType || 'percentage'} onChange={e => patch({ discountType: e.target.value })} className={cn(inputCls, 'w-24')}>
                <option value="percentage">%</option>
                <option value="fixed">€ fix</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{lang === 'de' ? 'Wert' : 'Value'}</label>
              <input type="number" min={0} value={local.discountValue || 0} onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })} className={cn(inputCls, 'w-24')} />
            </div>
          </>
        )}

        <button
          onClick={() => patch({ isPaid: !local.isPaid })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all self-end',
            local.isPaid ? 'bg-green-600 text-white border-green-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
        >
          {local.isPaid ? (lang === 'de' ? 'Bezahlt ✓' : 'Paid ✓') : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
        </button>
      </div>

      {/* Row 3: Brutto / Netto / MwSt */}
      <div className="flex items-end gap-3 flex-wrap">
        <button
          onClick={() => patch({ useBruttoNetto: !local.useBruttoNetto })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
            local.useBruttoNetto ? 'bg-amber-500 text-white border-amber-500' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
        >
          {lang === 'de' ? 'Brutto / Netto' : 'Gross / Net'}
        </button>

        {local.useBruttoNetto && (
          <>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Brutto (€)</label>
              <input
                type="number" min={0} step="0.01"
                value={local.brutto ?? ''}
                placeholder="Brutto..."
                onChange={e => patch({ brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                className={cn(inputCls, 'w-28')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>MwSt (%)</label>
              <input
                type="number" min={0} max={100} step="0.1"
                value={local.mwst ?? ''}
                placeholder="19..."
                onChange={e => patch({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                className={cn(inputCls, 'w-20')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Netto (€)</label>
              <input
                type="number" min={0} step="0.01"
                value={local.netto ?? ''}
                placeholder="Netto..."
                onChange={e => patch({ netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                className={cn(inputCls, 'w-28')}
              />
            </div>

            <div className={cn('self-end px-3 py-2 rounded-lg border text-xs font-bold', dk ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
              {bruttoVal != null && derivedNetto != null && (
                <span className={dk ? 'text-green-400' : 'text-green-700'}>Netto: {formatCurrency(derivedNetto)}</span>
              )}
              {nettoVal != null && derivedBrutto != null && (
                <span className={dk ? 'text-amber-400' : 'text-amber-700'}>Brutto: {formatCurrency(derivedBrutto)}</span>
              )}
              {bruttoVal != null && mwstRate == null && (
                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>
                  {lang === 'de' ? 'MwSt fehlt → Netto unbekannt' : 'MwSt missing → Netto unknown'}
                </span>
              )}
              {bruttoVal == null && nettoVal == null && (
                <span className={dk ? 'text-slate-500' : 'text-slate-400'}>—</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Row 4: Deposit */}
      <div className="flex items-end gap-3 flex-wrap">
        <button
          onClick={() => patch({ depositEnabled: !local.depositEnabled })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
            local.depositEnabled ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
        >
          {lang === 'de' ? 'Kaution / Anzahlung' : 'Deposit'}
        </button>

        {local.depositEnabled && (
          <div className="flex flex-col gap-1">
            <label className={labelCls}>{lang === 'de' ? 'Betrag (€)' : 'Amount (€)'}</label>
            <input
              type="number" min={0} step="0.01"
              value={local.depositAmount ?? ''}
              placeholder="0.00"
              onChange={e => patch({ depositAmount: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
              className={cn(inputCls, 'w-28')}
            />
          </div>
        )}
      </div>

      {/* Row 5: Invoice No. + Booking ref */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice No.'}</label>
          <input
            type="text"
            value={local.rechnungNr || ''}
            onChange={e => patch({ rechnungNr: e.target.value })}
            placeholder="RE-2026-..."
            className={cn(inputCls, 'w-36')}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className={labelCls}>{lang === 'de' ? 'Buchungsreferenz / Notiz' : 'Booking ref / note'}</label>
          <input
            type="text"
            value={local.bookingId || ''}
            onChange={e => patch({ bookingId: e.target.value })}
            placeholder={lang === 'de' ? 'Buchungsreferenz / Notiz...' : 'Booking reference / note...'}
            className={cn(inputCls, 'w-full')}
          />
        </div>
      </div>

      {/* Total bar */}
      <div className={cn('flex items-center justify-end gap-4 px-4 py-3 rounded-xl border',
        dk ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50')}>
        {local.useBruttoNetto && (
          <span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
            {bruttoVal != null ? `Brutto: ${formatCurrency(bruttoVal)}` : derivedBrutto != null ? `Brutto: ${formatCurrency(derivedBrutto)}` : ''}
            {derivedNetto != null ? ` · Netto: ${formatCurrency(derivedNetto)}` : ''}
          </span>
        )}
        <span className={cn('text-base font-black', dk ? 'text-white' : 'text-slate-900')}>
          {lang === 'de' ? 'Gesamt:' : 'Total:'} {formatCurrency(total)}
        </span>
      </div>

      {/* Night calendar */}
      {showCalendar && local.startDate && local.endDate && (
        <div className={cn('rounded-xl border p-3', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
          <div className="flex items-center justify-between mb-3">
            <p className={cn('text-xs font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
              {lang === 'de' ? 'Nachtkalender' : 'Night calendar'}
            </p>
            <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
              {allNights.length} {lang === 'de' ? 'Nächte' : 'nights'}
            </p>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
            {allNights.map((night) => (
              <div key={night} className={cn('rounded-lg border p-2', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
                <p className={cn('text-[11px] font-bold mb-1', dk ? 'text-slate-300' : 'text-slate-700')}>
                  {night.split('-').reverse().join('/')}
                </p>
                {local.useManualPrices ? (
                  <input
                    type="number" min={0} step="0.01"
                    value={nightlyPrices[night] ?? local.pricePerNightPerRoom ?? 0}
                    onChange={e => patch({ nightlyPrices: { ...(local.nightlyPrices || {}), [night]: normalizeNumberInput(e.target.value) } })}
                    className={cn(inputCls, 'w-full px-2 py-1 text-xs')}
                  />
                ) : (
                  <p className={cn('text-xs font-bold', dk ? 'text-white' : 'text-slate-900')}>
                    {formatCurrency(Number(local.pricePerNightPerRoom || 0))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bed assignments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={cn('text-xs font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
            {lang === 'de' ? 'Bettenbelegung' : 'Bed assignments'}
          </p>
          <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
            {lang === 'de' ? 'Freie Betten jetzt' : 'Free beds now'}: {gaps.length}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: totalBeds }).map((_, slotIndex) => {
            const employee = local.employees?.[slotIndex] ?? null;
            const substituteGap = gaps.find((g: any) => g.slotIndex === slotIndex);
            return (
              <div key={slotIndex} className="space-y-2">
                <EmployeeSlot
                  durationId={local.id}
                  slotIndex={slotIndex}
                  employee={employee}
                  durationStart={local.startDate}
                  durationEnd={local.endDate}
                  isDarkMode={dk}
                  lang={lang}
                  onUpdated={onEmployeeUpdated}
                />
                {!employee && substituteGap?.type === 'full' ? null : substituteGap ? (
                  <EmployeeSlot
                    durationId={local.id}
                    slotIndex={slotIndex}
                    employee={null}
                    durationStart={substituteGap.availableFrom}
                    durationEnd={substituteGap.availableTo}
                    isDarkMode={dk}
                    lang={lang}
                    onUpdated={onEmployeeUpdated}
                    substituteWindow={{ from: substituteGap.availableFrom, to: substituteGap.availableTo }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht.' : 'This duration will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className={cn('px-4 py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
