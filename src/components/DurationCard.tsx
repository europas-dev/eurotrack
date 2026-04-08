// src/components/DurationCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Loader2, Tag, Trash2, Minus, Plus } from 'lucide-react';
import { cn, calculateNights, formatCurrency, getDurationGapInfo, getDurationTotal, getNightsBetween, getTotalBeds, normalizeNumberInput } from '../lib/utils';
import { deleteDuration, updateDuration } from '../lib/supabase';
import { EmployeeSlot } from './EmployeeSlot';
import { RoomType } from '../lib/types';

interface DurationCardProps {
  duration: any;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  onUpdate: (id: string, updated: any) => void;
  onDelete: (id: string) => void;
}

export default function DurationCard({ duration, isDarkMode, lang = 'de', onUpdate, onDelete }: DurationCardProps) {
  const dk = isDarkMode;
  const [local, setLocal] = useState(duration);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => { setLocal(duration); }, [duration.id]);

  if (!local) return null;

  const totalBeds  = getTotalBeds(local.roomType as RoomType, local.numberOfRooms, local.wgBeds);
  const nights     = calculateNights(local.startDate ?? '', local.endDate ?? '');
  const allNights  = useMemo(() => getNightsBetween(local.startDate ?? '', local.endDate ?? ''), [local.startDate, local.endDate]);
  const gaps       = getDurationGapInfo(local);
  const total      = getDurationTotal(local);

  const computedBrutto = local.nettoPrice != null && local.mwst != null
    ? local.nettoPrice * (1 + local.mwst / 100) : null;
  const computedNetto = local.bruttoPrice != null && local.mwst != null
    ? local.bruttoPrice / (1 + local.mwst / 100) : null;

  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  );

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

  const roomCount = Math.max(1, Number(local.numberOfRooms) || 1);
  const labelCls = cn('text-xs font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500');

  return (
    <div className={cn('rounded-2xl border p-4 space-y-4', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      {/* Row 1: dates, room type, rooms */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Von' : 'From'}</label>
          <input type="date" value={local.startDate ?? ''} onChange={e => patch({ startDate: e.target.value })} className={cn(inputCls, 'w-40')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Bis' : 'To'}</label>
          <input type="date" value={local.endDate ?? ''} onChange={e => patch({ endDate: e.target.value })} className={cn(inputCls, 'w-40')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Zimmertyp' : 'Room type'}</label>
          <select value={local.roomType || 'DZ'} onChange={e => patch({ roomType: e.target.value })} className={cn(inputCls, 'w-24')}>
            <option value="EZ">EZ</option>
            <option value="DZ">DZ</option>
            <option value="TZ">TZ</option>
            <option value="WG">WG</option>
          </select>
        </div>

        {local.roomType === 'WG' ? (
          <div className="flex flex-col gap-0.5">
            <label className={labelCls}>{lang === 'de' ? 'Betten' : 'Beds'}</label>
            <input type="number" min={1} value={local.wgBeds ?? 2}
              onChange={e => patch({ wgBeds: Math.max(1, parseInt(e.target.value) || 1) })}
              className={cn(inputCls, 'w-20')} />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <label className={labelCls}>{lang === 'de' ? 'Zimmer' : 'Rooms'}</label>
            <div className={cn('flex items-center rounded-lg border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
              <button onClick={() => patch({ numberOfRooms: Math.max(1, roomCount - 1) })} className={cn('px-3 py-2', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Minus size={14} /></button>
              <div className={cn('px-3 py-2 text-sm font-bold min-w-[40px] text-center', dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900')}>{roomCount}</div>
              <button onClick={() => patch({ numberOfRooms: roomCount + 1 })} className={cn('px-3 py-2', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Plus size={14} /></button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center ml-auto">
          <span className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>{nights}</span>
          <span className={cn('text-[9px] uppercase', dk ? 'text-slate-600' : 'text-slate-400')}>{lang === 'de' ? 'Nächte' : 'nights'}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className={cn('text-xs font-bold', totalBeds === 0 ? 'text-amber-400' : dk ? 'text-green-400' : 'text-green-600')}>{totalBeds}</span>
          <span className={cn('text-[9px] uppercase', dk ? 'text-slate-600' : 'text-slate-400')}>{lang === 'de' ? 'Betten' : 'beds'}</span>
        </div>
        {saving && <Loader2 size={13} className="animate-spin text-blue-400 ml-1" />}
      </div>

      {/* Row 2: Room details */}
      <div className={cn('grid grid-cols-2 gap-2 p-3 rounded-xl border', dk ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-50 border-slate-100')}>
        <p className={cn('col-span-2 text-[9px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>
          {lang === 'de' ? 'Zimmer-Details' : 'Room details'}
        </p>
        <input type="text" value={local.roomNumber ?? ''} onChange={e => patch({ roomNumber: e.target.value })}
          placeholder={lang === 'de' ? 'Wohnung Nr...' : 'Room No...'} className={inputCls} />
        <input type="text" value={local.floor ?? ''} onChange={e => patch({ floor: e.target.value })}
          placeholder={lang === 'de' ? 'Stockwerk...' : 'Floor...'} className={inputCls} />
      </div>

      {/* Row 3: Pricing */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Preis/Nacht/Zimmer' : 'Price/night/room'}</label>
          <input type="number" min={0} step={0.01} value={local.pricePerNightPerRoom ?? 0}
            onChange={e => patch({ pricePerNightPerRoom: normalizeNumberInput(e.target.value) })}
            className={cn(inputCls, 'w-32')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Gesamtpreis' : 'Total price'}</label>
          <input type="number" min={0} step={0.01}
            value={local.totalPrice ?? ''}
            placeholder={lang === 'de' ? 'optional' : 'optional'}
            onChange={e => {
              const tp = normalizeNumberInput(e.target.value);
              const impliedNightly = nights > 0 && roomCount > 0 ? tp / nights / roomCount : 0;
              patch({ totalPrice: tp, pricePerNightPerRoom: impliedNightly });
            }}
            className={cn(inputCls, 'w-32')} />
        </div>

        <button onClick={() => patch({ hasDiscount: !local.hasDiscount })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
            local.hasDiscount ? 'bg-blue-600 text-white border-blue-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          <Tag size={12} /> {lang === 'de' ? 'Rabatt' : 'Discount'}
        </button>
        {local.hasDiscount && (
          <>
            <select value={local.discountType || 'percentage'} onChange={e => patch({ discountType: e.target.value })} className={cn(inputCls, 'w-28')}>
              <option value="percentage">%</option>
              <option value="fixed">fix €</option>
            </select>
            <input type="number" min={0} value={local.discountValue || 0}
              onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
              className={cn(inputCls, 'w-24')} />
          </>
        )}

        <div className={cn('ml-auto text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
          {lang === 'de' ? 'Gesamt ' : 'Total '}{formatCurrency(total)}
        </div>
      </div>

      {/* Row 4: Brutto / Netto / MwSt */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Netto (€)</label>
          <input type="number" min={0} step={0.01} value={local.nettoPrice ?? ''}
            placeholder="—"
            onChange={e => patch({ nettoPrice: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
            className={cn(inputCls, 'w-28')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>MwSt %</label>
          <input type="number" min={0} step={0.01} value={local.mwst ?? ''}
            placeholder="—"
            onChange={e => patch({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
            className={cn(inputCls, 'w-24')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Brutto (€)</label>
          <input type="number" min={0} step={0.01}
            value={local.bruttoPrice ?? computedBrutto ?? ''}
            placeholder={computedBrutto != null ? computedBrutto.toFixed(2) : '—'}
            onChange={e => patch({ bruttoPrice: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
            className={cn(inputCls, 'w-28')} />
        </div>
        {computedNetto != null && local.bruttoPrice != null && (
          <div className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
            → Netto: {formatCurrency(computedNetto)}
          </div>
        )}
      </div>

      {/* Row 5: Invoice + Paid + Deposit */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
          <label className={labelCls}>{lang === 'de' ? 'Rechnung Nr.' : 'Invoice No.'}</label>
          <input type="text" value={local.invoiceNumber ?? ''} onChange={e => patch({ invoiceNumber: e.target.value })}
            placeholder={lang === 'de' ? 'Rechnung Nr...' : 'Invoice No...'} className={inputCls} />
        </div>

        <button onClick={() => patch({ isPaid: !local.isPaid })}
          className={cn('px-4 py-2 rounded-lg text-xs font-bold border transition-all mt-4',
            local.isPaid ? 'bg-green-600 text-white border-green-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          {local.isPaid ? (lang === 'de' ? '✓ Bezahlt' : '✓ Paid') : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
        </button>

        <button onClick={() => patch({ depositEnabled: !local.depositEnabled })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all mt-4',
            local.depositEnabled ? 'bg-purple-600 text-white border-purple-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          {lang === 'de' ? 'Kaution' : 'Deposit'}
        </button>
        {local.depositEnabled && (
          <div className="flex flex-col gap-0.5 mt-4">
            <label className={labelCls}>{lang === 'de' ? 'Kautionsbetrag' : 'Deposit amount'}</label>
            <input type="number" min={0} step={0.01} value={local.depositAmount ?? 0}
              onChange={e => patch({ depositAmount: normalizeNumberInput(e.target.value) })}
              className={cn(inputCls, 'w-28')} />
          </div>
        )}

        <input type="text" value={local.bookingId ?? ''} onChange={e => patch({ bookingId: e.target.value })}
          placeholder={lang === 'de' ? 'Buchungsreferenz...' : 'Booking ref...'}
          className={cn(inputCls, 'flex-1 min-w-[140px] mt-4')} />
      </div>

      {/* Manual nightly prices + calendar toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => patch({ useManualPrices: !local.useManualPrices })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
            local.useManualPrices ? 'bg-purple-600 text-white border-purple-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          {local.useManualPrices ? (lang === 'de' ? 'Manuelle Preise AN' : 'Manual prices ON') : (lang === 'de' ? 'Manuelle Nachtpreise' : 'Manual nightly prices')}
        </button>
        <button onClick={() => setShowCalendar(!showCalendar)}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1',
            dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          <CalendarDays size={13} />
          {showCalendar ? (lang === 'de' ? 'Kalender ausblenden' : 'Hide calendar') : (lang === 'de' ? 'Kalender zeigen' : 'Show calendar')}
        </button>
        <button onClick={() => setConfirmDelete(true)}
          className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1 ml-auto">
          <Trash2 size={13} /> {lang === 'de' ? 'Löschen' : 'Delete'}
        </button>
      </div>

      {/* Calendar */}
      {showCalendar && local.startDate && local.endDate && (
        <div className={cn('rounded-xl border p-3', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
          <div className="flex items-center justify-between mb-3">
            <p className={cn('text-xs font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
              {lang === 'de' ? 'Nachtkalender' : 'Night calendar'}
            </p>
            <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>{allNights.length} {lang === 'de' ? 'Nächte' : 'nights'}</p>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {allNights.map(night => (
              <div key={night} className={cn('rounded-lg border p-2', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
                <p className={cn('text-[11px] font-bold mb-1', dk ? 'text-slate-300' : 'text-slate-700')}>
                  {night.split('-').reverse().join('.')}
                </p>
                {local.useManualPrices ? (
                  <input type="number" min={0} step={0.01}
                    value={(local.nightlyPrices || {})[night] ?? local.pricePerNightPerRoom ?? 0}
                    onChange={e => patch({ nightlyPrices: { ...(local.nightlyPrices || {}), [night]: normalizeNumberInput(e.target.value) } })}
                    className={cn(inputCls, 'w-full px-2 py-1 text-xs')} />
                ) : (
                  <p className={cn('text-xs font-bold', dk ? 'text-white' : 'text-slate-900')}>
                    {formatCurrency(Number(local.pricePerNightPerRoom) || 0)}
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
            {lang === 'de' ? 'Frei' : 'Free'}: {gaps.length}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: totalBeds }).map((_, slotIndex) => {
            const employee = local.employees?.[slotIndex] ?? null;
            const substituteGap = gaps.find((g: any) => g.slotIndex === slotIndex);
            return (
              <div key={slotIndex} className="space-y-2">
                <EmployeeSlot
                  durationId={local.id} slotIndex={slotIndex} employee={employee}
                  durationStart={local.startDate} durationEnd={local.endDate}
                  isDarkMode={dk} lang={lang} onUpdated={onEmployeeUpdated}
                />
                {substituteGap && employee ? (
                  <EmployeeSlot
                    durationId={local.id} slotIndex={slotIndex} employee={null}
                    durationStart={substituteGap.availableFrom} durationEnd={substituteGap.availableTo}
                    isDarkMode={dk} lang={lang} onUpdated={onEmployeeUpdated}
                    substituteWindow={{ from: substituteGap.availableFrom, to: substituteGap.availableTo }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht.' : 'This duration will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
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
