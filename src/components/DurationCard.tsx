// src/components/DurationCard.tsx
import React, { useState, useRef } from 'react';
import { cn, calculateNights } from '../lib/utils';
import { updateDuration, deleteDuration } from '../lib/supabase';
import { Trash2, ChevronDown, Loader2, Tag } from 'lucide-react';
import EmployeeSlot from './EmployeeSlot';

interface DurationCardProps {
  duration: any;
  index: number;
  isDarkMode: boolean;
  onUpdate: (id: string, updated: any) => void;
  onDelete: (id: string) => void;
}

export default function DurationCard({
  duration,
  index,
  isDarkMode,
  onUpdate,
  onDelete,
}: DurationCardProps) {
  const [local, setLocal] = useState(duration);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<any>(null);
  const dk = isDarkMode;

  const accentColors = ['blue', 'violet', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'indigo'];
  const accent = accentColors[index % accentColors.length];

  const startDate = local.startDate || local.start_date || '';
  const endDate = local.endDate || local.end_date || '';
  const nights = calculateNights(startDate, endDate);
  const rooms = local.numberOfRooms || local.number_of_rooms || 1;
  const roomType = local.roomType || local.room_type || 'DZ';
  const pricePerNight = local.pricePerNightPerRoom || local.price_per_night_per_room || 0;
  const isPaid = local.isPaid || local.is_paid || false;
  const hasDiscount = local.hasDiscount || local.has_discount || false;
  const discountType = local.discountType || local.discount_type || 'percentage';
  const discountValue = local.discountValue || local.discount_value || 0;

  const bedsPerRoom = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : 3;
  const totalBeds = bedsPerRoom * rooms;

  let subtotal = nights * pricePerNight * rooms;
  let discount = 0;
  if (hasDiscount) {
    discount =
      discountType === 'percentage'
        ? subtotal * (discountValue / 100)
        : discountValue;
  }
  const total = Math.max(0, subtotal - discount);

  const save = (updated: any) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateDuration(duration.id, {
          startDate: updated.startDate || updated.start_date,
          endDate: updated.endDate || updated.end_date,
          roomType: updated.roomType || updated.room_type,
          numberOfRooms: updated.numberOfRooms || updated.number_of_rooms,
          pricePerNightPerRoom:
            updated.pricePerNightPerRoom || updated.price_per_night_per_room,
          hasDiscount: updated.hasDiscount || updated.has_discount,
          discountType: updated.discountType || updated.discount_type,
          discountValue: updated.discountValue || updated.discount_value,
          isPaid: updated.isPaid || updated.is_paid,
          bookingId: updated.bookingId || updated.booking_id,
        });
        onUpdate(duration.id, updated);
      } catch (e) {
        console.error(e);
      } finally {
        setSaving(false);
      }
    }, 600);
  };

  const set = (field: string, value: any) => {
    const updated = { ...local, [field]: value };
    setLocal(updated);
    save(updated);
  };

  const handleDelete = async () => {
    try {
      await deleteDuration(duration.id);
      onDelete(duration.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmployeeUpdate = (slotIndex: number, emp: any) => {
    const employees = [...(local.employees || Array(totalBeds).fill(null))];
    while (employees.length < totalBeds) employees.push(null);
    employees[slotIndex] = emp;
    const updated = { ...local, employees };
    setLocal(updated);
    onUpdate(duration.id, updated);
  };

  const fieldCls = cn(
    'px-2 py-1 rounded-lg text-sm outline-none border transition-all bg-transparent',
    dk
      ? 'border-transparent hover:border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
      : 'border-transparent hover:border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  );

  const accentBorderMap: Record<string, string> = {
    blue: 'border-l-blue-500',
    violet: 'border-l-violet-500',
    pink: 'border-l-pink-500',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    cyan: 'border-l-cyan-500',
    rose: 'border-l-rose-500',
    indigo: 'border-l-indigo-500',
  };

  const accentDotMap: Record<string, string> = {
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    pink: 'bg-pink-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    cyan: 'bg-cyan-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div
      className={cn(
        'rounded-xl border-l-2 border transition-all',
        accentBorderMap[accent],
        dk ? 'bg-white/[0.03] border-white/8' : 'bg-white border-slate-200'
      )}
    >
      {/* HEADER */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer group flex-wrap"
        onClick={() => setOpen(!open)}
      >
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', accentDotMap[accent])} />

        {/* Date range */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => set('startDate', e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={cn(fieldCls, 'w-36')}
        />
        <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>→</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => set('endDate', e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={cn(fieldCls, 'w-36')}
        />
        <span className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-600')}>
          {nights} nights
        </span>

        {/* Room type */}
        <select
          value={roomType}
          onChange={(e) => set('roomType', e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={cn(fieldCls, 'w-20 cursor-pointer')}
        >
          <option value="EZ">EZ</option>
          <option value="DZ">DZ</option>
          <option value="TZ">TZ</option>
        </select>

        {/* Room count */}
        <div className="flex items-center gap-1">
          <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>×</span>
          <input
            type="number"
            min="1"
            max="99"
            value={rooms}
            onChange={(e) => set('numberOfRooms', parseInt(e.target.value) || 1)}
            onClick={(e) => e.stopPropagation()}
            className={cn(fieldCls, 'w-14 text-center')}
          />
          <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>rooms</span>
        </div>

        {/* Beds badge */}
        <span
          className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            dk ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
          )}
        >
          {totalBeds} beds
        </span>

        {/* Total cost */}
        <span className={cn('text-sm font-black ml-auto', dk ? 'text-white' : 'text-slate-900')}>
          €{total.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
        </span>

        {/* Paid toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            set('isPaid', !isPaid);
          }}
          className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all',
            isPaid
              ? 'bg-green-500/20 text-green-300 border-green-500/30'
              : dk
              ? 'bg-white/5 text-slate-500 border-white/10'
              : 'bg-slate-100 text-slate-400 border-slate-200'
          )}
        >
          {isPaid ? '✓ Paid' : 'Unpaid'}
        </button>

        {saving && <Loader2 size={12} className="animate-spin text-blue-400 flex-shrink-0" />}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className={cn(
            'p-1 rounded opacity-0 group-hover:opacity-100 transition-all',
            dk ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-100 text-red-600'
          )}
        >
          <Trash2 size={13} />
        </button>

        <ChevronDown
          size={14}
          className={cn(
            'transition-transform flex-shrink-0',
            dk ? 'text-slate-600' : 'text-slate-400',
            open && 'rotate-180'
          )}
        />
      </div>

      {/* BODY */}
      {open && (
        <div
          className={cn(
            'px-4 pb-4 pt-2 space-y-3 border-t',
            dk ? 'border-white/5' : 'border-slate-100'
          )}
        >
          {/* Price + discount row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs font-bold uppercase tracking-widest',
                  dk ? 'text-slate-500' : 'text-slate-400'
                )}
              >
                Price/night/room
              </span>
              <span className={cn('text-sm', dk ? 'text-slate-400' : 'text-slate-500')}>€</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pricePerNight}
                onChange={(e) => set('pricePerNightPerRoom', parseFloat(e.target.value) || 0)}
                className={cn(fieldCls, 'w-24')}
              />
            </div>

            <button
              onClick={() => set('hasDiscount', !hasDiscount)}
              className={cn(
                'flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border transition-all',
                hasDiscount
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                  : dk
                  ? 'bg-white/5 text-slate-500 border-white/10'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              )}
            >
              <Tag size={11} /> Discount
            </button>

            {hasDiscount && (
              <>
                <select
                  value={discountType}
                  onChange={(e) => set('discountType', e.target.value)}
                  className={cn(fieldCls, 'w-24')}
                >
                  <option value="percentage">%</option>
                  <option value="fixed">€ fixed</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => set('discountValue', parseFloat(e.target.value) || 0)}
                  className={cn(fieldCls, 'w-20')}
                />
              </>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
                {rooms} rooms × {nights} nights × €{pricePerNight}
                {discount > 0 && ` − €${discount.toLocaleString('de-DE', { minimumFractionDigits: 0 })}`}
              </span>
              <span className={cn('text-base font-black', dk ? 'text-white' : 'text-slate-900')}>
                = €{total.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Booking reference */}
          <input
            type="text"
            value={local.bookingId || local.booking_id || ''}
            onChange={(e) => set('bookingId', e.target.value)}
            placeholder="Booking reference / note (optional)..."
            className={cn(fieldCls, 'w-full text-xs')}
          />

          {/* Employee slots */}
          <div>
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-2',
                dk ? 'text-slate-500' : 'text-slate-400'
              )}
            >
              Bed assignments — {roomType} × {rooms} = {totalBeds} beds
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: totalBeds }).map((_, i) => (
                <EmployeeSlot
                  key={i}
                  slotIndex={i}
                  durationId={duration.id}
                  employee={(local.employees || [])[i] || null}
                  durationStart={startDate}
                  durationEnd={endDate}
                  isDarkMode={isDarkMode}
                  onUpdate={handleEmployeeUpdate}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
