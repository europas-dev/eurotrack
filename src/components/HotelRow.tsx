import React, { useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights, formatCurrency, formatDateDisplay, getDurationRowLabel, getDurationTabLabel, getEmployeeStatus } from '../lib/utils';
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
    }, 400);
  }

  async function addDuration() {
    try {
      setCreatingDuration(true);
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
        useBruttoNetto: false,
        brutto: null,
        netto: null,
        mwst: null,
        depositEnabled: false,
        depositAmount: null,
        rechnungNr: '',
        extensionNote: '',
        autoDistribute: true,
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
    } finally {
      setCreatingDuration(false);
    }
  }

  const employeePillClass = (employee: any) => {
    const status = getEmployeeStatus(employee?.checkIn, employee?.checkOut);
    if (status === 'ending-soon') return dk ? 'border-red-500 text-red-300 bg-red-500/10' : 'border-red-300 text-red-700 bg-red-50';
    if (status === 'completed') return dk ? 'border-green-500 text-green-300 bg-green-500/10' : 'border-green-300 text-green-700 bg-green-50';
    if (status === 'upcoming') return dk ? 'border-blue-500 text-blue-300 bg-blue-500/10' : 'border-blue-300 text-blue-700 bg-blue-50';
    return dk ? 'border-white/10 text-slate-200 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50';
  };

  return (
    <div className="space-y-1">
      <div className={cn(
        'rounded-2xl border',
        dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
      )}>

        {/* ── MAIN ROW ── */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ minWidth: 0 }}>

          {/* Expand icon */}
          <button
            onClick={() => setOpen(!open)}
            className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0"
          >
            <Building2 size={16} />
          </button>

          {/* Hotel name + city — fixed 180px, truncated */}
          <div className="flex-shrink-0" style={{ width: 180, minWidth: 0, overflow: 'hidden' }}>
            <p
              className={cn('text-sm font-black leading-tight truncate', dk ? 'text-white' : 'text-slate-900')}
              title={localHotel.name}
            >
              {localHotel.name}
            </p>
            <p
              className={cn('text-[11px] uppercase tracking-widest leading-tight truncate', dk ? 'text-slate-500' : 'text-slate-400')}
              title={localHotel.city}
            >
              {localHotel.city}
            </p>
          </div>

          {/* Company tag — fixed 100px, truncated */}
          <div className="flex-shrink-0" style={{ width: 100, minWidth: 0, overflow: 'hidden' }}>
            <span
              className={cn(
                'block px-2 py-1 rounded-full text-[10px] font-bold truncate text-center',
                dk ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
              )}
              title={localHotel.companyTag}
            >
              {localHotel.companyTag}
            </span>
          </div>

          {/* Duration pills — scrollable, no row expansion */}
          <div
            className="flex items-center gap-2 flex-shrink-0"
            style={{ maxWidth: 220, overflowX: 'auto', scrollbarWidth: 'none' }}
          >
            {(localHotel.durations || []).map((d: any, i: number) => (
              <span
                key={d.id || i}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap flex-shrink-0',
                  dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-700'
                )}
              >
                {getDurationRowLabel(d, lang)}
              </span>
            ))}
          </div>

          {/* Nights — fixed 64px */}
          <div className="text-center flex-shrink-0" style={{ width: 64 }}>
            <p className="text-sm font-black text-blue-400">{totalNights}</p>
            <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Nächte' : 'nights'}
            </p>
          </div>

          {/* Free beds — fixed 56px */}
          <div className="text-center flex-shrink-0" style={{ width: 56 }}>
            <p className={cn('text-sm font-black', freeBeds > 0 ? 'text-amber-400' : 'text-green-400')}>
              {freeBeds}
            </p>
            <p className={cn('text-[10px] uppercase', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'frei' : 'free'}
            </p>
          </div>

          {/* Employee pills — scrollable strip */}
          <div
            className="flex items-center gap-1 flex-shrink-0"
            style={{ maxWidth: 180, overflowX: 'auto', scrollbarWidth: 'none' }}
          >
            {employees.slice(0, 5).map((emp: any) => (
              <div
                key={emp.id}
                className={cn(
                  'px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap flex-shrink-0',
                  employeePillClass(emp)
                )}
                title={`${emp.name} (${formatDateDisplay(emp.checkIn, lang)} → ${formatDateDisplay(emp.checkOut, lang)})`}
              >
                {emp.name}
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Total cost — fixed right-aligned */}
          <div
            className={cn('text-sm font-black flex-shrink-0', dk ? 'text-white' : 'text-slate-900')}
            style={{ width: 100, textAlign: 'right' }}
          >
            {formatCurrency(totalCost)}
          </div>

          {saving && <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />}

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={addDuration}
              disabled={creatingDuration}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1',
                dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {lang === 'de' ? 'Dauer' : 'Duration'}
            </button>

            <button
              onClick={() => setOpen(!open)}
              className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}
            >
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <button
              onClick={() => setConfirmDelete(true)}
              className={cn('p-2 rounded-lg', dk ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* ── EXPANDED PANEL ── */}
        {open && (
          <div className={cn(
            'border-t p-4 space-y-4',
            dk ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'
          )}>

            {/* Inline editable: Hotel name / City / Company */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { key: 'name', label: lang === 'de' ? 'Hotelname' : 'Hotel name', placeholder: 'Hotel...', width: 'w-44', list: undefined },
                { key: 'city', label: lang === 'de' ? 'Stadt' : 'City', placeholder: lang === 'de' ? 'Stadt...' : 'City...', width: 'w-36', list: `city-list-${localHotel.id}` },
                { key: 'companyTag', label: lang === 'de' ? 'Firma' : 'Company', placeholder: lang === 'de' ? 'Firma...' : 'Company...', width: 'w-36', list: `company-list-${localHotel.id}` },
              ].map(({ key, label, placeholder, width, list }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {label}
                  </label>
                  <input
                    list={list}
                    className={cn(inputCls, width)}
                    value={(localHotel as any)[key] || ''}
                    onChange={e => patchHotel({ [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <datalist id={`city-list-${localHotel.id}`}>
                {cityOptions.map(x => <option key={x} value={x} />)}
              </datalist>
              <datalist id={`company-list-${localHotel.id}`}>
                {companyOptions.map(x => <option key={x} value={x} />)}
              </datalist>
            </div>

            {/* Single row: Address / Contact person / Phone / Email / Website */}
            <div className="flex items-end gap-3 flex-wrap">
              {[
                { key: 'address',       label: lang === 'de' ? 'Adresse' : 'Address',               placeholder: lang === 'de' ? 'Adresse...' : 'Address...',             width: 'w-44' },
                { key: 'contactPerson', label: lang === 'de' ? 'Ansprechpartner' : 'Contact person', placeholder: lang === 'de' ? 'Ansprechpartner...' : 'Contact person...', width: 'w-36' },
                { key: 'contact',       label: lang === 'de' ? 'Telefon' : 'Phone',                  placeholder: lang === 'de' ? 'Telefon...' : 'Phone...',                 width: 'w-32' },
                { key: 'email',         label: 'Email',                                               placeholder: 'Email...',                                                width: 'w-40' },
                { key: 'webLink',       label: lang === 'de' ? 'Webseite' : 'Website',               placeholder: lang === 'de' ? 'Webseite...' : 'Website...',             width: 'w-40' },
              ].map(({ key, label, placeholder, width }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {label}
                  </label>
                  <input
                    className={cn(inputCls, width)}
                    value={(localHotel as any)[key] || ''}
                    onChange={e => patchHotel({ [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <textarea
              className={cn(inputCls, 'min-h-[72px] resize-y')}
              value={localHotel.notes || ''}
              onChange={e => patchHotel({ notes: e.target.value })}
              placeholder={lang === 'de' ? 'Notizen...' : 'Notes...'}
            />

            {/* Duration tabs */}
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
                  {getDurationTabLabel(d, lang)}
                </button>
              ))}
              <button
                onClick={addDuration}
                disabled={creatingDuration}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
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
                  'w-full py-4 rounded-xl border-2 border-dashed text-sm font-bold',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500'
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

      {/* Add hotel below */}
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

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Dieses Hotel und alle zugehörigen Buchungen werden dauerhaft gelöscht.' : 'This hotel and all related durations will be deleted permanently.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className={cn('px-4 py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={() => onDelete(localHotel.id)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
