// src/components/DurationCard.tsx
import React, { useState, useRef } from 'react';
import { cn, calculateNights, getTotalBeds } from '../lib/utils';
import { updateDuration, deleteDuration } from '../lib/supabase';
import { Trash2, ChevronDown, Loader2, CreditCard, Tag } from 'lucide-react';
import EmployeeSlot from './EmployeeSlot';

interface DurationCardProps {
  duration: any;
  index: number;
  isDarkMode: boolean;
  onUpdate: (id: string, updated: any) => void;
  onDelete: (id: string) => void;
}

export default function DurationCard({ duration, index, isDarkMode, onUpdate, onDelete }: DurationCardProps) {
  const [local, setLocal] = useState(duration);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<any>(null);
  const dk = isDarkMode;

  const colors = ['blue','violet','pink','emerald','amber','cyan','rose','indigo'];
  const color = colors[index % colors.length];

  const nights = calculateNights(local.startDate || local.start_date || '', local.endDate || local.end_date || '');
  const rooms = local.numberOfRooms || local.number_of_rooms || 1;
  const roomType = local.roomType || local.room_type || 'DZ';
  const pricePerNight = local.pricePerNightPerRoom || local.price_per_night_per_room || 0;
  const totalBeds = getTotalBeds(roomType, rooms);
  const filledBeds = (local.employees || []).filter((e: any) => e !== null).length;
  const freeBeds = totalBeds - filledBeds;

  let subtotal = nights * pricePerNight * rooms;
  let discount = 0;
  if (local.hasDiscount || local.has_discount) {
    if ((local.discountType || local.discount_type) === 'percentage') {
      discount = subtotal * ((local.discountValue || local.discount_value || 0) / 100);
    } else {
      discount = local.discountValue || local.discount_value || 0;
    }
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
          pricePerNightPerRoom: updated.pricePerNightPerRoom || updated.price_per_night_per_room,
          hasDiscount: updated.hasDiscount || updated.has_discount,
          discountType: updated.discountType || updated.discount_type,
          discountValue: updated.discountValue || updated.discount_value,
          isPaid: updated.isPaid || updated.is_paid,
          bookingId: updated.bookingId || updated.booking_id,
          extensionNote: updated.extensionNote || updated.extension_note,
        });
        onUpdate(duration.id, updated);
      } catch(e) { console.error(e); }
      finally { setSaving(false); }
    }, 600);
  };

  const set = (field: string, value: any) => {
    const updated = { ...local, [field]: value };
    setLocal(updated);
    save(updated);
  };

  const handleEmployeeUpdate = (slotIndex: number, emp: any) => {
    const employees = [...(local.employees || Array(totalBeds).fill(null))];
    while (employees.length < totalBeds) employees.push(null);
    employees[slotIndex] = emp;
    const updated = { ...local, employees };
    setLocal(updated);
    onUpdate(duration.id, updated);
  };

  const handleDeleteDuration = async () => {
    try {
      await deleteDuration(duration.id);
      onDelete(duration.id);
    } catch(e) { console.error(e); }
  };

  const fieldCls = cn(
    "px-2 py-1 rounded-lg text-sm outline-none border transition-all bg-transparent",
    dk ? "border-transparent hover:border-white/10 focus:border-blue-500 text-white placeholder-slate-600"
       : "border-transparent hover:border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400"
  );

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      dk ? "bg-white/[0.03] border-white/8" : "bg-white border-slate-200",
      `border-l-2 border-l-${color}-500`
    )}>
      {/* ── DURATION HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer group"
        onClick={() => setOpen(!open)}>
        <div className={cn(`w-2 h-2 rounded-full bg-${color}-500 flex-shrink-0`)} />

        {/* Date range */}
        <div className="flex items-center gap-1 flex-1 flex-wrap gap-y-1">
          <input type="date" value={local.startDate || local.start_date || ''}
            onChange={e => set('startDate', e.target.value)}
            onClick={e => e.stopPropagation()}
            className={cn(fieldCls, "w-36")} />
          <span className={cn("text-xs", dk ? "text-slate-500" : "text-slate-400")}>→</span>
          <input type="date" value={local.endDate || local.end_date || ''}
            onChange={e => set('endDate', e.target.value)}
            onClick={e => e.stopPropagation()}
            className={cn(fieldCls, "w-36")} />
          <span className={cn("text-xs font-bold ml-1", dk ? "text-slate-400" : "text-slate-600")}>
            {nights} nights
          </span>
        </div>

        {/* Room type */}
        <select value={roomType} onChange={e => set('roomType', e.target.value)}
          onClick={e => e.stopPropagation()}
          className={cn(fieldCls, "w-20 cursor-pointer")}>
          <option value="EZ">EZ</option>
          <option value="DZ">DZ</option>
          <option value="TZ">TZ</option>
        </select>

        {/* Rooms count */}
        <div className="flex items-center gap-1">
          <span className={cn("text-xs", dk ? "text-slate-500" : "text-slate-400")}>×</span>
          <input type="number" min="1" max="99" value={rooms}
            onChange={e => set('numberOfRooms', parseInt(e.target.value) || 1)}
            onClick={e => e.stopPropagation()}
            className={cn(fieldCls, "w-14 text-center")} />
          <span className={cn("text-xs", dk ? "text-slate-500" : "text-slate-400")}>rooms</span>
        </div>

        {/* Beds status */}
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
          freeBeds > 0
            ? dk ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"
            : dk ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-700")}>
          {filledBeds}/{totalBeds} beds
        </span>

        {/* Total */}
        <span className={cn("text-sm font-black min-w-[80px] text-right",
          dk ? "text-white" : "text-slate-900")}>
          €{total.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
        </span>

        {/* Paid badge */}
        <button onClick={e => { e.stopPropagation(); set('isPaid', !(local.isPaid || local.is_paid)); }}
          className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all",
            (local.isPaid || local.is_paid)
              ? "bg-green-500/20 text-green-300 border-green-500/30"
              : dk ? "bg-white/5 text-slate-500 border-white/10 hover:border-green-500/30" : "bg-slate-100 text-slate-400 border-slate-200")}>
          {(local.isPaid || local.is_paid) ? '✓ Paid' : 'Unpaid'}
        </button>

        {saving && <Loader2 size={12} className="animate-spin text-blue-400 flex-shrink-0" />}

        <button onClick={e => { e.stopPropagation(); handleDeleteDuration(); }}
          className={cn("p-1 rounded opacity-0 group-hover:opacity-100 transition-all",
            dk ? "hover:bg-red-600/20 text-red-400" : "hover:bg-red-100 text-red-600")}>
          <Trash2 size={13} />
        </button>

        <ChevronDown size={14} className={cn("transition-transform flex-shrink-0",
          dk ? "text-slate-600" : "text-slate-400", open && "rotate-180")} />
      </div>

      {/* ── DURATION BODY ── */}
      {open && (
        <div className={cn("px-4 pb-4 space-y-3 border-t",
          dk ? "border-white/5" : "border-slate-100")}>

          {/* Price + discount row */}
          <div className="flex items-center gap-4 pt-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-bold uppercase tracking-widest", dk ? "text-slate-500" : "text-slate-400")}>Price/night/room</span>
              <span className={cn("text-sm", dk ? "text-slate-400" : "text-slate-500")}>€</span>
              <input type="number" min="0" step="0.01" value={pricePerNight}
                onChange={e => set('pricePerNightPerRoom', parseFloat(e.target.value) || 0)}
                className={cn(fieldCls, "w-24")} />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => set('hasDiscount', !(local.hasDiscount || local.has_discount))}
                className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border transition-all",
                  (local.hasDiscount || local.has_discount)
                    ? "bg-blue-600/20 text-blue-300 border-blue-500/30"
                    : dk ? "bg-white/5 text-slate-500 border-white/10" : "bg-slate-100 text-slate-400 border-slate-200")}>
                <Tag size={11} /> Discount
              </button>
              {(local.hasDiscount || local.has_discount) && (
                <>
                  <select value={local.discountType || local.discount_type || 'percentage'}
                    onChange={e => set('discountType', e.target.value)}
                    className={cn(fieldCls, "w-24")}>
                    <option value="percentage">%</option>
                    <option value="fixed">€ fixed</option>
                  </select>
                  <input type="number" min="0" value={local.discountValue || local.discount_value || 0}
                    onChange={e => set('discountValue', parseFloat(e.target.value) || 0)}
                    className={cn(fieldCls, "w-20")} />
                </>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className={cn("text-xs", dk ? "text-slate-500" : "text-slate-400")}>
                {rooms} rooms × {nights} nights × €{pricePerN
