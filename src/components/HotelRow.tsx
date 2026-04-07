// src/components/HotelRow.tsx
import React, { useState, useRef } from 'react';
import { cn, calculateNights } from '../lib/utils';
import { updateHotel, createDuration } from '../lib/supabase';
import {
  Building2,
  ChevronDown,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Plus,
  Loader2,
} from 'lucide-react';
import DurationCard from './DurationCard';

interface HotelRowProps {
  entry: any;
  isDarkMode: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: any) => void;
}

export function HotelRow({ entry, isDarkMode, onDelete, onUpdate }: HotelRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingDuration, setAddingDuration] = useState(false);
  const [localHotel, setLocalHotel] = useState(entry);
  const saveTimer = useRef<any>(null);
  const dk = isDarkMode;

  const fieldChange = (field: string, value: string) => {
    const updated = { ...localHotel, [field]: value };
    setLocalHotel(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateHotel(entry.id, updated);
        onUpdate(entry.id, updated);
      } catch (e) {
        console.error(e);
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const totalNights = (localHotel.durations || []).reduce(
    (s: number, d: any) =>
      s + calculateNights(d.startDate || d.start_date || '', d.endDate || d.end_date || ''),
    0
  );

  const totalCost = (localHotel.durations || []).reduce((s: number, d: any) => {
    const n = calculateNights(
      d.startDate || d.start_date || '',
      d.endDate || d.end_date || ''
    );
    return (
      s +
      n *
        (d.pricePerNightPerRoom || d.price_per_night_per_room || 0) *
        (d.numberOfRooms || d.number_of_rooms || 1)
    );
  }, 0);

  const freeBeds = (localHotel.durations || []).reduce(
    (s: number, d: any) =>
      s + (d.employees || []).filter((e: any) => e === null).length,
    0
  );

  const allEmps = (localHotel.durations || []).flatMap((d: any) =>
    (d.employees || []).filter((e: any) => e !== null).map((e: any) => e.name)
  );

  const handleAddDuration = async () => {
    try {
      setAddingDuration(true);
      const today = new Date().toISOString().split('T')[0];
      const next = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const nd = await createDuration({
        hotelId: entry.id,
        startDate: today,
        endDate: next,
        roomType: 'DZ',
        numberOfRooms: 1,
        pricePerNightPerRoom: 0,
        autoDistribute: true,
        hasDiscount: false,
        isPaid: false,
        employees: [],
      });
      const updated = {
        ...localHotel,
        durations: [...(localHotel.durations || []), { ...nd, employees: [] }],
      };
      setLocalHotel(updated);
      onUpdate(entry.id, updated);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingDuration(false);
    }
  };

  const durUpdate = (did: string, ud: any) => {
    const updated = {
      ...localHotel,
      durations: localHotel.durations.map((d: any) => (d.id === did ? ud : d)),
    };
    setLocalHotel(updated);
    onUpdate(entry.id, updated);
  };

  const durDelete = (did: string) => {
    const updated = {
      ...localHotel,
      durations: localHotel.durations.filter((d: any) => d.id !== did),
    };
    setLocalHotel(updated);
    onUpdate(entry.id, updated);
  };

  const ic = cn(
    'w-full px-2 py-1 rounded-lg text-sm outline-none border transition-all bg-transparent',
    dk
      ? 'border-transparent hover:border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
      : 'border-transparent hover:border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  );

  return (
    <div
      className={cn(
        'mb-2 rounded-xl border transition-all overflow-hidden',
        dk
          ? 'bg-[#0B1224] border-white/5 hover:border-white/10'
          : 'bg-white border-slate-200 hover:border-slate-300'
      )}
    >
      {/* HEADER ROW */}
      <div
        className="grid grid-cols-12 items-center px-6 py-4 cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Name + City */}
        <div className="col-span-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
              {localHotel.name}
            </p>
            <p
              className={cn(
                'text-[10px] uppercase tracking-widest',
                dk ? 'text-slate-500' : 'text-slate-400'
              )}
            >
              {localHotel.city}
            </p>
          </div>
        </div>

        {/* Company tag */}
        <div className="col-span-1">
          <span
            className={cn(
              'px-2 py-1 rounded-full text-[10px] font-bold',
              dk
                ? 'bg-purple-600/20 text-purple-300'
                : 'bg-purple-100 text-purple-700'
            )}
          >
            {localHotel.companyTag}
          </span>
        </div>

        {/* Bookings count */}
        <div className="col-span-2 text-center">
          <p className={cn('text-sm font-bold', dk ? 'text-slate-300' : 'text-slate-700')}>
            {(localHotel.durations || []).length}
            <span
              className={cn(
                'text-[10px] font-normal ml-1',
                dk ? 'text-slate-500' : 'text-slate-400'
              )}
            >
              bookings
            </span>
          </p>
        </div>

        {/* Nights */}
        <div className="col-span-1 text-center">
          <p className="text-sm font-bold text-blue-400">{totalNights}</p>
          <p className={cn('text-[9px] uppercase', dk ? 'text-slate-600' : 'text-slate-400')}>
            nights
          </p>
        </div>

        {/* Free beds */}
        <div className="col-span-1 text-center">
          <p className={cn('text-sm font-bold', freeBeds > 0 ? 'text-amber-400' : 'text-green-400')}>
            {freeBeds}
          </p>
          <p className={cn('text-[9px] uppercase', dk ? 'text-slate-600' : 'text-slate-400')}>
            free
          </p>
        </div>

        {/* Employees preview */}
        <div className="col-span-2 flex flex-wrap gap-1">
          {allEmps.slice(0, 2).map((n: string, i: number) => (
            <span
              key={i}
              className={cn(
                'px-2 py-0.5 rounded text-[9px] font-bold',
                dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
              )}
            >
              {n}
            </span>
          ))}
          {allEmps.length > 2 && (
            <span className="text-[9px] text-slate-500">+{allEmps.length - 2}</span>
          )}
        </div>

        {/* Cost + actions */}
        <div className="col-span-2 flex items-center justify-end gap-3">
          <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
            €{totalCost.toLocaleString('de-DE')}
          </p>
          {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteModal(true);
            }}
            className={cn(
              'p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all',
              dk ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-100 text-red-600'
            )}
          >
            <Trash2 size={14} />
          </button>
          <ChevronDown
            size={16}
            className={cn(
              'transition-transform',
              dk ? 'text-slate-600' : 'text-slate-400',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* EXPANDED BODY */}
      {isOpen && (
        <div
          className={cn(
            'border-t px-6 pb-6 pt-4 space-y-4',
            dk ? 'border-white/5 bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'
          )}
        >
          {/* Inline contact fields */}
          <div
            className={cn(
              'grid grid-cols-5 gap-2 p-3 rounded-xl border',
              dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
            )}
          >
            {[
              { label: 'Address', field: 'address', ph: 'Add address...' },
              { label: 'Phone', field: 'contact', ph: '+49 30 ...' },
              { label: 'Email', field: 'email', ph: 'hotel@...' },
              { label: 'Website', field: 'webLink', ph: 'https://...' },
              { label: 'City', field: 'city', ph: 'City...' },
            ].map(({ label, field, ph }) => (
              <div key={field}>
                <label
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-widest mb-1 block',
                    dk ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  {label}
                </label>
                <input
                  type="text"
                  defaultValue={localHotel[field] || ''}
                  placeholder={ph}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => fieldChange(field, e.target.value)}
                  className={ic}
                />
              </div>
            ))}
          </div>

          {/* Duration Cards */}
          <div className="space-y-3">
            {(localHotel.durations || []).map((dur: any, i: number) => (
              <DurationCard
                key={dur.id}
                duration={dur}
                index={i}
                isDarkMode={isDarkMode}
                onUpdate={durUpdate}
                onDelete={durDelete}
              />
            ))}
          </div>

          {/* Add Duration */}
          <button
            onClick={handleAddDuration}
            disabled={addingDuration}
            className={cn(
              'w-full py-3 rounded-xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2 transition-all',
              dk
                ? 'border-white/10 text-slate-500 hover:border-blue-500/50 hover:text-blue-400'
                : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
            )}
          >
            {addingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add Booking Duration
          </button>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className={cn(
              'p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl border',
              dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-400" />
            </div>
            <h3
              className={cn(
                'text-xl font-black mb-2',
                dk ? 'text-white' : 'text-slate-900'
              )}
            >
              Delete Hotel?
            </h3>
            <p className={cn('text-sm mb-6', dk ? 'text-slate-400' : 'text-slate-600')}>
              Permanently delete <strong>{localHotel.name}</strong> and all bookings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold border',
                  dk
                    ? 'border-white/10 text-white hover:bg-white/5'
                    : 'border-slate-200 text-slate-900 hover:bg-slate-50'
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(entry.id);
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
