import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  cn,
  calcHotelFreeBeds,
  calcHotelTotalCost,
  calcHotelTotalNights,
  formatCurrency,
  formatDateDisplay,
  getDurationRowLabel,
  getDurationTabLabel,
  getEmployeeStatus,
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
  const [localHotel, setLocalHotel] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [creatingDuration, setCreatingDuration] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeDurationTab, setActiveDurationTab] = useState(0);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    setLocalHotel(entry);
  }, [entry]);

  const totalNights = useMemo(() => calcHotelTotalNights(localHotel), [localHotel]);
  const totalCost = useMemo(() => calcHotelTotalCost(localHotel), [localHotel]);
  const freeBeds = useMemo(() => calcHotelFreeBeds(localHotel), [localHotel]);

  const employees = useMemo(() => {
    return (localHotel.durations || []).flatMap((d: any) => (d.employees || []).filter(Boolean));
  }, [localHotel]);

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
      } catch (e) {
        console.error(e);
      } finally {
        setSaving(false);
      }
    }, 400);
  }

  async function addDuration() {
    try {
      setCreatingDuration(true);

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const startDate = today.toISOString().split('T')[0];
      const endDate = tomorrow.toISOString().split('T')[0];

      const created = await createDuration({
        hotelId: localHotel.id,
        startDate,
        endDate,
        roomType: 'DZ',
        numberOfRooms: 1,
        pricePerNightPerRoom: 0,
        hasDiscount: false,
        discountType: 'percentage',
        discountValue: 0,
        isPaid: false,
        bookingId: null,
      });

      const nextDurations = [...(localHotel.durations || []), { ...created, employees: created.employees || [] }];
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

  const employeePillClass = (employee: any) => {
    const status = getEmployeeStatus(employee?.checkIn, employee?.checkOut);
    if (status === 'ending-soon') return dk ? 'border-red-500/50 text-red-300 bg-red-500/10' : 'border-red-300 text-red-700 bg-red-50';
    if (status === 'completed') return dk ? 'border-green-500/50 text-green-300 bg-green-500/10' : 'border-green-300 text-green-700 bg-green-50';
    if (status === 'upcoming') return dk ? 'border-blue-500/50 text-blue-300 bg-blue-500/10' : 'border-blue-300 text-blue-700 bg-blue-50';
    return dk ? 'border-white/10 text-slate-200 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50';
  };

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
        )}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setOpen(!open)}
              className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm"
            >
              <Building2 size={16} />
            </button>

            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto hotel-row-scroll pr-1">
              <div className="min-w-[170px] flex-shrink-0">
                <p className={cn('text-[15px] font-black leading-tight', dk ? 'text-white' : 'text-slate-900')}>
                  {localHotel.name}
                </p>
                <p className={cn('text-[11px] uppercase tracking-[0.14em] leading-tight', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {localHotel.city}
                </p>
              </div>

              <span
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0',
                  dk ? 'bg-purple-500/15 text-purple-300 border border-purple-400/20' : 'bg-purple-100 text-purple-700 border border-purple-200'
                )}
              >
                {localHotel.companyTag}
              </span>

              <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                {(localHotel.durations || []).map((d: any, i: number) => (
                  <span
                    key={d.id || i}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap flex-shrink-0 border',
                      dk ? 'bg-white/[0.04] text-slate-200 border-white/10' : 'bg-slate-50 text-slate-700 border-slate-200'
                    )}
                    title={getDurationRowLabel(d, lang)}
                  >
                    {getDurationRowLabel(d, lang)}
                  </span>
                ))}
              </div>

              <div className="text-center min-w-[64px] flex-shrink-0">
                <p className="text-[15px] font-black text-blue-400 leading-none">{totalNights}</p>
                <p className={cn('text-[10px] uppercase tracking-wide mt-1', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Nächte' : 'nights'}
                </p>
              </div>

              <div className="text-center min-w-[58px] flex-shrink-0">
                <p className={cn('text-[15px] font-black leading-none', freeBeds > 0 ? 'text-amber-400' : 'text-green-400')}>
                  {freeBeds}
                </p>
                <p className={cn('text-[10px] uppercase tracking-wide mt-1', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'frei' : 'free'}
                </p>
              </div>

              <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                {employees.slice(0, 5).map((emp: any) => (
                  <div
                    key={emp.id}
                    className={cn(
                      'px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap',
                      employeePillClass(emp)
                    )}
                    title={`${emp.name} (${formatDateDisplay(emp.checkIn, lang)} → ${formatDateDisplay(emp.checkOut, lang)})`}
                  >
                    {emp.name}
                  </div>
                ))}
              </div>

              <div
                className={cn(
                  'text-[15px] font-black min-w-[92px] text-right flex-shrink-0',
                  dk ? 'text-white' : 'text-slate-900'
                )}
              >
                {formatCurrency(totalCost)}
              </div>

              {saving && <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setOpen(!open)}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                )}
              >
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <button
                onClick={() => setConfirmDelete(true)}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  dk ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                )}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div
            className={cn(
              'border-t p-4 space-y-4',
              dk ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className={inputCls}
                value={localHotel.address || ''}
                onChange={e => patchHotel({ address: e.target.value })}
                placeholder={lang === 'de' ? 'Adresse...' : 'Address...'}
              />
              <input
                className={inputCls}
                value={localHotel.contact || ''}
                onChange={e => patchHotel({ contact: e.target.value })}
                placeholder={lang === 'de' ? 'Telefon...' : 'Phone...'}
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
                placeholder={lang === 'de' ? 'Webseite...' : 'Website...'}
              />
              <input
                className={inputCls}
                value={localHotel.contactPerson || ''}
                onChange={e => patchHotel({ contactPerson: e.target.value })}
                placeholder={lang === 'de' ? 'Ansprechpartner...' : 'Contact person...'}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  list={`city-list-${localHotel.id}`}
                  className={inputCls}
                  value={localHotel.city || ''}
                  onChange={e => patchHotel({ city: e.target.value })}
                  placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
                />
                <datalist id={`city-list-${localHotel.id}`}>
                  {cityOptions.map((x) => <option key={x} value={x} />)}
                </datalist>

                <input
                  list={`company-list-${localHotel.id}`}
                  className={inputCls}
                  value={localHotel.companyTag || ''}
                  onChange={e => patchHotel({ companyTag: e.target.value })}
                  placeholder={lang === 'de' ? 'Firma / Tag...' : 'Company / tag...'}
                />
                <datalist id={`company-list-${localHotel.id}`}>
                  {companyOptions.map((x) => <option key={x} value={x} />)}
                </datalist>
              </div>
            </div>

            <textarea
              className={cn(inputCls, 'min-h-[90px] resize-y')}
              value={localHotel.notes || ''}
              onChange={e => patchHotel({ notes: e.target.value })}
              placeholder={lang === 'de' ? 'Notizen...' : 'Notes...'}
            />

            <div className="flex items-center gap-2 flex-wrap">
              {(localHotel.durations || []).map((d: any, i: number) => (
                <button
                  key={d.id || i}
                  onClick={() => setActiveDurationTab(i)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-bold border transition-all',
                    activeDurationTab === i
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk
                        ? 'border-white/10 text-slate-300 hover:bg-white/5'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {getDurationTabLabel(d, lang)}
                </button>
              ))}

              <button
                onClick={addDuration}
                disabled={creatingDuration}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {creatingDuration ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {lang === 'de' ? 'Neue Dauer' : 'Add duration'}
              </button>
            </div>

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
                  'w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold transition-all',
                  dk
                    ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400'
                    : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500'
                )}
              >
                {creatingDuration
                  ? (lang === 'de' ? 'Erstelle...' : 'Creating...')
                  : (lang === 'de' ? 'Erste Dauer hinzufügen' : 'Add first duration')}
              </button>
            )}
          </div>
        )}
      </div>

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

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn(
            'w-full max-w-md rounded-2xl border p-5',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}>
            <h3 className="text-lg font-black mb-2">
              {lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}
            </h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de'
                ? 'Dieses Hotel und alle zugehörigen Buchungen werden dauerhaft gelöscht.'
                : 'This hotel and all related durations will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className={cn(
                  'px-4 py-2 rounded-lg border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                onClick={() => onDelete(localHotel.id)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
