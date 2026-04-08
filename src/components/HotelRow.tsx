// src/components/HotelRow.tsx
import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights,
  formatCurrency, formatDateDisplay, getDurationRowLabel,
  getDurationTabLabel, getEmployeeStatus
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
  entry, isDarkMode, lang = 'de',
  companyOptions = [], cityOptions = [],
  onDelete, onUpdate, onAddBelow,
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

  const employees = useMemo(() =>
    (localHotel.durations || []).flatMap((d: any) => (d.employees || []).filter(Boolean)),
    [localHotel]);

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
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
        hasDiscount: false, discountType: 'percentage', discountValue: 0,
        isPaid: false, bookingId: null,
        useManualPrices: false, nightlyPrices: {},
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
    } finally { setCreatingDuration(false); }
  }

  const employeePillClass = (emp: any) => {
    const s = getEmployeeStatus(emp?.checkIn, emp?.checkOut);
    if (s === 'ending-soon') return dk ? 'border-red-500 text-red-300 bg-red-500/10'   : 'border-red-300 text-red-700 bg-red-50';
    if (s === 'completed')   return dk ? 'border-green-500 text-green-300 bg-green-500/10' : 'border-green-300 text-green-700 bg-green-50';
    if (s === 'upcoming')    return dk ? 'border-blue-500 text-blue-300 bg-blue-500/10'  : 'border-blue-300 text-blue-700 bg-blue-50';
    return dk ? 'border-white/10 text-slate-200 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50';
  };

  return (
    <div className="space-y-1">
      <div className={cn('rounded-2xl border overflow-hidden', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

        {/* ── Collapsed row ── */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">

            {/* Chevron expand — replaces hotel icon */}
            <button onClick={() => setOpen(!open)}
              className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Scrollable pill row */}
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-x-auto scrollbar-thin">

              {/* Hotel name + city */}
              <div className="min-w-[160px] flex-shrink-0">
                <p className={cn('text-sm font-black leading-tight', dk ? 'text-white' : 'text-slate-900')}>
                  {localHotel.name}
                </p>
                <p className={cn('text-[11px] uppercase tracking-widest leading-tight', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {localHotel.city}
                </p>
              </div>

              {/* Company tag — single field */}
              {localHotel.company && (
                <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex-shrink-0',
                  dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                  {localHotel.company}
                </span>
              )}

              {/* Duration labels */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {(localHotel.durations || []).map((d: any, i: number) => (
                  <span key={d.id || i}
                    className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap',
                      dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-700')}>
                    {getDurationRowLabel(d, lang)}
                  </span>
                ))}
              </div>

              {/* Nights */}
              <div className="text-center min-w-[64px] flex-shrink-0">
                <p className="text-sm font-black text-blue-400">{totalNights}</p>
                <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Nächte' : 'nights'}
                </p>
              </div>

              {/* Free beds */}
              <div className="text-center min-w-[56px] flex-shrink-0">
                <p className={cn('text-sm font-black', freeBeds > 0 ? 'text-amber-400' : 'text-green-400')}>
                  {freeBeds}
                </p>
                <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'frei' : 'free'}
                </p>
              </div>

              {/* Employee pills */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {employees.slice(0, 5).map((emp: any) => (
                  <div key={emp.id}
                    className={cn('p
