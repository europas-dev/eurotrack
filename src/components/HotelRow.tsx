// src/components/HotelRow.tsx
import React, { useState, useRef } from 'react';
import { cn, calculateNights, getTotalBeds } from '../lib/utils';
import { updateHotel, deleteHotel, createDuration } from '../lib/supabase';
import { Building2, ChevronDown, Trash2, Phone, Mail, Globe, MapPin, Plus, Loader2 } from 'lucide-react';
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

  const handleFieldChange = (field: string, value: string) => {
    const updated = { ...localHotel, [field]: value };
    setLocalHotel(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateHotel(entry.id, updated);
        onUpdate(entry.id, updated);
      } catch (e) { console.error(e); }
      finally { setSaving(false); }
    }, 800);
  };

  const totalNights = (localHotel.durations || []).reduce((sum: number, d: any) =>
    sum + calculateNights(d.startDate || d.start_date || '', d.endDate || d.end_date || ''), 0);

  const totalCost = (localHotel.durations || []).reduce((sum: number, d: any) => {
    const nights = calculateNights(d.startDate || d.start_date || '', d.endDate || d.end_date || '');
    return sum + nights * (d.pricePerNightPerRoom || d.price_per_night_per_room || 0) * (d.numberOfRooms || d.number_of_rooms || 1);
  }, 0);

  const freeBeds = (localHotel.durations || []).reduce((sum: number, d: any) =>
    sum + (d.employees || []).filter((e: any) => e === null).length, 0);

  const allEmployees = (localHotel.durations || []).flatMap((d: any) =>
    (d.employees || []).filter((e: any) => e !== null).map((e: any) => e.name));

  const handleAddDuration = async () => {
    try {
      setAddingDuration(true);
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const newDur = await createDuration({
        hotelId: entry.id,
        startDate: today,
        endDate: nextMonth,
        roomType: 'DZ',
        numberOfRooms: 1,
        pricePerNightPerRoom: 0,
        autoDistribute: true,
        hasDiscount: false,
        isPaid: false,
        employees: [],
      });
      const updated = { ...localHotel, durations: [...(localHotel.durations || []), { ...newDur, employees: [] }] };
      setLocalHotel(updated);
      onUpdate(entry.id, updated);
    } catch (e) { console.error(e); }
    finally { setAddingDuration(false); }
  };

  const handleDurationUpdate = (durId: string, updatedDur: any) => {
    const updated = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === durId ? updatedDur : d) };
    setLocalHotel(updated);
    onUpdate(entry.id, updated);
  };

  const handleDurationDelete = (durId: string) => {
    const updated = { ...localHotel, durations: localHotel.durations.filter((d: any) => d.id !== durId) };
    setLocalHotel(updated);
    onUpdate(entry.id, updated);
  };

  const inputCls = cn(
    "w-full px-2 py-1 rounded-lg text-sm outline-none border transition-all bg-transparent",
    dk
      ? "border-transparent hover:border-white/10 focus:border-blue-500 text-white placeholder-slate-600"
      : "border-transparent hover:border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400"
  );

  return (
    <div className={cn(
      "mb-2 rounded-xl border transition-all duration-200 overflow-hidden",
      dk ? "bg-[#0B1224] border-white/5 hover:border-white/10" : "bg-white border-slate-200 hover:border-slate-300"
    )}>
      {/* HEADER ROW */}
      <div
        className="grid grid-cols-12 items-center px-6 py-4 cursor-pointer group transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="col-span-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-bold truncate", dk ? "text-white" : "text-slate-900")}>{localHotel.name}</p>
            <p className={cn("text-[10px] uppercase tracking-widest truncate", dk ? "text-slate-500" : "text-slate-400")}>
              <MapPin size={9} className="inline mr-0.5" />{localHotel.city}
            </p>
          </div>
        </div>

        <div className="col-span-1">
          <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold",
            dk ? "bg-purple-600/20 text-purple-300 border border-purple-500/20" : "bg-purple-100 text-purple-700")}>
            {localHotel.companyTag}
          </span>
        </div>

        <div className="col-span-2 text-center">
          <p className={cn("text-sm font-bold", dk ? "text-slate-300" : "text-slate-700")}>
            {(localHotel.durations || []).length}
            <span className={cn("text-[10px] font-normal ml-1", dk ? "text-slate-500" : "text-slate-400")}>bookings</span>
          </p>
        </div>

        <div className="col-span-1 text-center">
          <p className="text-sm font-bold text-blue-400">{totalNights}</p>
          <p className={cn("text-[9px] uppercase", dk ? "text-slate-600" : "text-slate-400")}>nights</p>
        </div>

        <div className="col-span-1 text-center">
          <p className={cn("text-sm font-bold", freeBeds > 0 ? "text-amber-400" : "text-green-400")}>{freeBeds}</p>
          <p className={cn("text-[9px] uppercase", dk ? "text-slate-600" : "text-slate-400")}>free</p>
        </div>

        <div className="col-span-2 flex flex-wrap gap-1">
          {allEmployees.slice(0, 2).map((name: string, i: number) => (
            <span key={i} className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase",
              dk ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-600")}>
              {name}
            </span>
          ))}
          {allEmployees.length > 2 && <span className="text-[9px] text-slate-500">+{allEmployees.length - 2}</span>}
        </div>

        <div className="col-span-2 flex items-center justify-end gap-3">
          <p className={cn("text-sm font-black", dk ? "text-white" : "text-slate-900")}>
            {"€"}{totalCost.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
          </p>
          {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
            className={cn("p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
              dk ? "hover:bg-red-600/20 text-red-400" : "hover:bg-red-100 text-red-600")}
          >
            <Trash2 size={14} />
          </button>
          <ChevronDown size={16} className={cn("transition-transform flex-shrink-0",
            dk ? "text-slate-600" : "text-slate-400", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* EXPANDED BODY */}
      {isOpen && (
        <div className={cn("border-t px-6 pb-6 pt-4 space-y-4",
          dk ? "border-white/5 bg-white/[0.01]" : "border-slate-100 bg-slate-50/50")}>

          {/* Inline contact fields */}
          <div className={cn("grid grid-cols-5 gap-2 p-3 rounded-xl border",
            dk ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
            {[
              { label: 'Address', icon: <MapPin size={10} />, field: 'address', placeholder: 'Add address...' },
              { label: 'Phone', icon: <Phone size={10} />, field: 'contact', placeholder: '+49 30 ...' },
              { label: 'Email', icon: <Mail size={10} />, field: 'email', placeholder: 'hotel@...' },
              { label: 'Website', icon: <Globe size={10} />, field: 'webLink', placeholder: 'https://...' },
              { label: 'City', icon: null, field: 'city', placeholder: 'City...' },
            ].map(({ label, icon, field, placeholder }) => (
              <div key={field}>
                <label className={cn("text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1",
                  dk ? "text-slate-500" : "text-slate-400")}>
                  {icon}{label}
                </label>
                <input
                  type="text"
                  defaultValue={localHotel[field] || ''}
                  placeholder={placeholder}
                  onClick={e => e.stopPropagation()}
                  onChange={e => handleFieldChange(field, e.target.value)}
                  className={inputCls}
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
                onUpdate={handleDurationUpdate}
                onDelete={handleDurationDelete}
              />
            ))}
          </div>

          {/* Add Duration button */}
          <button
            onClick={handleAddDuration}
            disabled={addingDuration}
            className={cn(
              "w-full py-3 rounded-xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2 transition-all",
              dk
                ? "border-white/10 text-slate-500 hover:border-blue-500/50 hover:text-blue-400"
                : "border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500"
            )}
          >
            {addingDuration ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add Booking Duration

            
