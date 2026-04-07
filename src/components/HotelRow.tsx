import React, { useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights, getDurationSummary, getEmployeeStatus } from '../lib/utils';
import { createDuration, deleteHotel, updateHotel } from '../lib/supabase';
import DurationCard from './DurationCard';

interface HotelRowProps {
  entry: any;
  isDarkMode: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: any) => void;
}

export function HotelRow({ entry, isDarkMode, onDelete, onUpdate }: HotelRowProps) {
  const dk = isDarkMode;
  const [open, setOpen] = useState(false);
  const [localHotel, setLocalHotel] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  const totalNights = useMemo(() => calcHotelTotalNights(localHotel), [localHotel]);
  const totalCost = useMemo(() => calcHotelTotalCost(localHotel), [localHotel]);
  const freeBeds = useMemo(() => calcHotelFreeBeds(localHotel), [localHotel]);

  const employees = useMemo(() => {
    return (localHotel.durations || []).flatMap((d: any) => (d.employees || []).filter(Boolean));
  }, [localHotel]);

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
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
      } catch (e) {
        console.error(e);
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  async function addDuration() {
    try {
      const created = await createDuration({
        hotelId: localHotel.id,
        startDate: '',
        endDate: '',
        roomType: 'DZ',
        numberOfRooms: 1,
        pricePerNightPerRoom: 0,
        hasDiscount: false,
        discountType: 'percentage',
        discountValue: 0,
        isPaid: false,
        bookingId: null,
        useManualPrices: false,
        nightlyPrices: {},
      });

      const next = {
        ...localHotel,
        durations: [...(localHotel.durations || []), { ...created, employees: [] }],
      };
      setLocalHotel(next);
      onUpdate(localHotel.id, next);
      setOpen(true);
      setActiveDurationTab((next.durations || []).length - 1);
    } catch (e) {
      console.error(e);
    }
  }

  async function removeHotel() {
    try {
      await deleteHotel(localHotel.id);
      onDelete(localHotel.id);
    } catch (e) {
      console.error(e);
    }
  }

  const avatarBorder = (employee: any) => {
    const status = getEmployeeStatus(employee?.checkIn, employee?.checkOut);
    if (status === 'ending-soon') return 'border-red-500';
    if (status === 'completed') return 'border-green-500';
    if (status === 'upcoming') return 'border-blue-500';
    return 'border-white/40';
  };

  return (
    <div className="space-y-1">
      <div className={cn(
        'rounded-2xl border overflow-hidden',
        dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
      )}>
        <div
          className="px-4 py-3 flex items-center gap-3 flex-wrap cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Building2 size={16} />
          </div>

          <div className="min-w-[180px]">
            <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
              {localHotel.name}
            </p>
            <p className={cn('text-[11px] uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
              {localHotel.city}
            </p>
          </div>

          <span className={cn(
            'px-2 py-1 rounded-full text-[10px] font-bold',
            dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
          )}>
            {localHotel.companyTag}
          </span>

          <div className="flex-1 min-w-[280px] flex flex-wrap gap-2">
            {(localHotel.durations || []).map((d: any, i: number) => (
              <span
                key={d.id || i}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-bold',
                  dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-700'
                )}
              >
                {getDurationSummary(d)}
              </span>
            ))}
          </div>

          <div className="text-center min-w-[64px]">
            <p className="text-sm font-black text-blue-400">{totalNights}</p>
            <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>nights</p>
          </div>

          <div className="text-center min-w-[64px]">
            <p className={cn('text-sm font-black', freeBeds > 0 ? 'text-amber-400' : 'text-green-400')}>
              {freeBeds}
            </p>
            <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>free</p>
          </div>

          <div className="flex items-center gap-1 min-w-[120px] flex-wrap">
            {employees.slice(0, 6).map((emp: any) => (
              <div
                key={emp.id}
                className={cn(
                  'w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black',
                  avatarBorder(emp),
                  dk ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'
                )}
                title={`${emp.name} (${emp.checkIn} → ${emp.checkOut})`}
              >
                {emp.name?.charAt(0)?.toUpperCase()}
              </div>
            ))}
          </div>

          <div className={cn('text-sm font-black min-w-[90px] text-right', dk ? 'text-white' : 'text-slate-900')}>
            €{totalCost.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
          </div>

          {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}

          <button
            onClick={(e) => {
              e.stopPropagation();
              removeHotel();
            }}
            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={14} />
          </button>

          <div className={cn('p-1', dk ? 'text-slate-500' : 'text-slate-400')}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {open && (
          <div className={cn(
            'border-t p-4 space-y-4',
            dk ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'
          )}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className={inputCls}
                value={localHotel.address || ''}
                onChange={e => patchHotel({ address: e.target.value })}
                placeholder="Address..."
              />
              <input
                className={inputCls}
                value={localHotel.contact || ''}
                onChange={e => patchHotel({ contact: e.target.value })}
                placeholder="Phone..."
              />
              <input
                className={inputCls}
                value={localHotel.email || ''}
                onChange={e => patchHotel({ email: e.target.value })}
                placeholder="Email..."
              />

              <input
                className={inputCls}
                value={localHotel.webLink || ''}
                onChange={e => patchHotel({ webLink: e.target.value })}
                placeholder="Website..."
              />
              <input
                className={inputCls}
                value={localHotel.contactPerson || ''}
                onChange={e => patchHotel({ contactPerson: e.target.value })}
                placeholder="Contact person..."
              />
              <input
                className={inputCls}
                value={localHotel.city || ''}
                onChange={e => patchHotel({ city: e.target.value })}
                placeholder="City..."
              />
            </div>

            <textarea
              className={cn(inputCls, 'min-h-[90px] resize-y')}
              value={localHotel.notes || ''}
              onChange={e => patchHotel({ notes: e.target.value })}
              placeholder="Notes..."
            />

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
                  #{i + 1} {getDurationSummary(d)}
                </button>
              ))}

              <button
                onClick={addDuration}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                <Plus size={12} />
                Add duration
              </button>
            </div>

            {(localHotel.durations || []).length > 0 ? (
              <DurationCard
                duration={localHotel.durations[activeDurationTab]}
                isDarkMode={dk}
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
                className={cn(
                  'w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400'
                    : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500'
                )}
              >
                Add first duration
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          className={cn(
            'px-3 py-1 rounded-full text-[11px] flex items-center gap-1 transition-all',
            dk ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-500'
          )}
        >
          <Plus size={11} />
          add hotel below
        </button>
      </div>
    </div>
  );
}
