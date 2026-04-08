// src/components/DurationCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Loader2, Tag, Trash2, Minus, Plus } from 'lucide-react';
import {
  cn, calculateNights, formatCurrency, getDurationGapInfo, getDurationTotal,
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

export default function DurationCard({ duration, isDarkMode, lang = 'de', onUpdate, onDelete }: DurationCardProps) {
  const dk = isDarkMode;
  const [local, setLocal] = useState(duration);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => { setLocal(duration); }, [duration]);

  const totalBeds = getTotalBeds(local.roomType, local.numberOfRooms);
  const nights    = calculateNights(local.startDate, local.endDate);
  const allNights = useMemo(() => getNightsBetween(local.startDate, local.endDate), [local.startDate, local.endDate]);
  const gaps      = getDurationGapInfo(local);
  const total     = getDurationTotal(local);
  const nightlyPrices = local.nightlyPrices || {};
  const roomCount = Math.max(1, Number(local.numberOfRooms || 1));

  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
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
    try {
      await deleteDuration(local.id);
      onDelete(local.id);
    } catch (e) { console.error(e); }
  }

  return (
    <div className={cn('rounded-2xl border p-4 space-y-4', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      {/* ── Row 1: dates, room type, room count, nights, beds ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={local.startDate || ''} onChange={e => patch({ startDate: e.target.value })}
          className={cn(inputCls, 'w-40')} />
        <input type="date" value={local.endDate || ''} onChange={e => patch({ endDate: e.target.value })}
          className={cn(inputCls, 'w-40')} />

        <select value={local.roomType || 'DZ'} onChange={e => patch({ roomType: e.target.value })}
          className={cn(inputCls, 'w-24')}>
          <option value="EZ">EZ</option>
          <option value="DZ">DZ</option>
          <option value="TZ">TZ</option>
        </select>

        {/* Room count stepper */}
        <div className={cn('flex items-center rounded-lg border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
          <button onClick={() => patch({ numberOfRooms: Math.max(1, roomCount - 1) })}
            className={cn('px-3 py-2', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}>
            <Minus size={14} />
          </button>
          <div className={cn('px-3 py-2 text-sm font-bold min-w-[52px] text-center', dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900')}>
            {roomCount}
          </div>
          <button onClick={() => patch({ numberOfRooms: roomCount + 1 })}
            className={cn('px-3 py-2', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}>
            <Plus size={14} />
          </button>
        </div>

        <div className={cn('text-sm font-bold', dk ? 'text-slate-300' : 'text-slate-700')}>
          {nights} {lang === 'de' ? 'Nächte' : 'nights'}
        </div>
        <div className={cn('text-sm font-bold', dk ? 'text-slate-300' : 'text-slate-700')}>
          {totalBeds} {lang === 'de' ? 'Betten' : 'beds'}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <button onClick={() => setShowCalendar(!showCalendar)}
            className={cn('px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1',
              dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
            <CalendarDays size={13} />
            {showCalendar ? (lang === 'de' ? 'Kalender aus' : 'Hide calendar') : (lang === 'de' ? 'Kalender an' : 'Show calendar')}
          </button>
          <button onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1">
            <Trash2 size={13} />
            {lang === 'de' ? 'Löschen' : 'Delete'}
          </button>
        </div>
      </div>

      {/* ── Row 2: pricing, discount, paid, total ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className={cn('text-xs font-bold uppercase tracking-widest whitespace-nowrap', dk ? 'text-slate-400' : 'text-slate-500')}>
            {lang === 'de' ? 'Preis/Nacht/Zi' : 'Price/Night/Room'}
          </label>
          <input type="number" min={0} step="0.01"
            value={local.pricePerNightPerRoom ?? 0}
            onChange={e => patch({ pricePerNightPerRoom: normalizeNumberInput(e.target.value) })}
            className={cn(inputCls, 'w-28')} />
        </div>

        {/* Manual nightly prices toggle */}
        <button onClick={() => patch({ useManualPrices: !local.useManualPrices })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
            local.useManualPrices
              ? 'bg-purple-600 text-white border-purple-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          {local.useManualPrices ? (lang === 'de' ? 'Manuelle Preise AN' : 'Manual ON') : (lang === 'de' ? 'Manuelle Nächte' : 'Manual nights')}
        </button>

        {/* Discount toggle */}
        <button onClick={() => patch({ hasDiscount: !local.hasDiscount })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
            local.hasDiscount
              ? 'bg-blue-600 text-white border-blue-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          <Tag size={12} />
          {lang === 'de' ? 'Rabatt' : 'Discount'}
        </button>

        {local.hasDiscount && (
          <>
            <select value={local.discountType || 'percentage'} onChange={e => patch({ discountType: e.target.value })}
              className={cn(inputCls, 'w-24')}>
              <option value="percentage">%</option>
              <option value="fixed">€ fix</option>
            </select>
            <input type="number" min={0}
              value={local.discountValue || 0}
              onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
              className={cn(inputCls, 'w-24')} />
          </>
        )}

        {/* Paid toggle */}
        <button onClick={() => patch({ isPaid: !local.isPaid })}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold border transition-all',
            local.isPaid
              ? 'bg-green-600 text-white border-green-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
          {local.isPaid ? (lang === 'de' ? '✓ Bezahlt' : '✓ Paid') : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
        </button>

        <div className={cn('ml-auto text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
          {lang === 'de' ? 'Gesamt:' : 'Total:'} {formatCurrency(total)}
        </div>
      </div>

      {/* ── Booking reference / note ── */}
      <input type="text" value={local.bookingId || ''}
        onChange={e => patch({ bookingId: e.target.value })}
        placeholder={lang === 'de' ? 'Buchungsreferenz / Notiz...' : 'Booking reference / note...'}
        className={cn(inputCls, 'w-full')} />

      {/* ── Extension note ── */}
      {local.extensionNote !== undefined && (
        <input type="text" value={local.extensionNote || ''}
          onChange={e => patch({ extensionNote: e.target.value })}
          placeholder={lang === 'de' ? 'Verlängerungsnotiz...' : 'Extension note...'}
          className={cn(inputCls, 'w-full')} />
      )}

      {/* ── Night calendar ── */}
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
            {allNights.map(night => (
              <div key={night} className={cn('rounded-lg border p-2', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
                <p className={cn('text-[11px] font-bold mb-1', dk ? 'text-slate-300' : 'text-slate-700')}>
                  {night.split('-').reverse().join('/')}
                </p>
                {local.useManualPrices ? (
                  <input type="number" min={0} step="0.01"
                    value={nightlyPrices[night] ?? local.pricePerNightPerRoom ?? 0}
                    onChange={e => patch({ nightlyPrices: { ...(local.nightlyPrices || {}), [night]: normalizeNumberInput(e.target.value) } })}
                    className={cn(inputCls, 'w-full px-2 py-1 text-xs')} />
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

      {/* ── Bed assignments ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={cn('text-xs font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
            {lang === 'de' ? 'Bettenbelegung' : 'Bed assignments'}
          </p>
          <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
            {lang === 'de' ? 'Frei jetzt' : 'Free now'}: {gaps.length}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: totalBeds }).map((_, slotIndex) => {
            const employee = local.employees?.[slotIndex] ?? null;
            const substituteGap = gaps.find(g => g.slotIndex === slotIndex);
            return (
              <div key={slotIndex} className="space-y-2">
                <EmployeeSlot
                  durationId={local.id} slotIndex={slotIndex} employee={employee}
                  durationStart={local.startDate} durationEnd={local.endDate}
                  isDarkMode={dk} lang={lang} onUpdated={onEmployeeUpdated}
                />
                {employee && substituteGap && (
                  <EmployeeSlot
                    durationId={local.id} slotIndex={slotIndex} employee={null}
                    durationStart={substituteGap.availableFrom} durationEnd={substituteGap.availableTo}
                    isDarkMode={dk} lang={lang} onUpdated={onEmployeeUpdated}
                    substituteWindow={{ from: substituteGap.availableFrom, to: substituteGap.availableTo }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Delete confirm modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht.' : 'This duration will be permanently deleted.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang === 'de' 
