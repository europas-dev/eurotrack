// src/components/DurationCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Minus, Plus, Loader2 } from 'lucide-react';
import {
  cn, calculateNights, formatCurrency, getDurationTotal,
  getNightsBetween, getTotalBeds, normalizeNumberInput,
  getImpliedNightlyPrice, getBruttoFromNetto, getNettoFromBrutto,
  getEmployeeStatus, getEmployeeStatusColor,
} from '../lib/utils';
import { offlineSync } from '../lib/offlineSync';
import { deleteDuration } from '../lib/supabase';

interface Props {
  duration: any;
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  onUpdate: (id: string, updated: any) => void;
  onDelete: (id: string) => void;
}

export default function DurationCard({ duration, isDarkMode: dk, lang = 'de', onUpdate, onDelete }: Props) {
  const [local, setLocal]               = useState(duration);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNightCal, setShowNightCal] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => { setLocal(duration); }, [duration]);

  const nights     = calculateNights(local.startDate, local.endDate);
  const allNights  = useMemo(() => getNightsBetween(local.startDate, local.endDate), [local.startDate, local.endDate]);
  const totalBeds  = getTotalBeds(local.roomType, local.numberOfRooms, local.wgBeds);
  const total      = getDurationTotal(local);
  const impliedNPR = getImpliedNightlyPrice(local);

  // Brutto / Netto derived
  const derivedBrutto = (local.nettoPrice  && local.mwst != null) ? getBruttoFromNetto(local.nettoPrice,  local.mwst) : null;
  const derivedNetto  = (local.bruttoPrice && local.mwst != null) ? getNettoFromBrutto(local.bruttoPrice, local.mwst) : null;

  const inp = cn(
    'px-2 py-1.5 rounded-md text-sm border outline-none transition-all w-full',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400'
  );

  function queueSave(next: any) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await offlineSync.enqueue({ type: 'updateDuration', payload: { id: next.id, ...next } });
      onUpdate(next.id, next);
      setSaving(false);
    }, 400);
  }

  function patch(changes: any) {
    const next = { ...local, ...changes };
    setLocal(next);
    queueSave(next);
  }

  async function handleDelete() {
    try { await deleteDuration(local.id); }
    catch { await offlineSync.enqueue({ type: 'deleteDuration', payload: { id: local.id } }); }
    onDelete(local.id);
    setConfirmDelete(false);
  }

  async function handleEmployeeSave(slotIndex: number, emp: any) {
    const employees = [...(local.employees || [])];
    while (employees.length <= slotIndex) employees.push(null);
    const isNew = !emp.id;
    const entry = isNew
      ? { ...emp, id: `temp_${Date.now()}`, durationId: local.id, slotIndex }
      : emp;
    await offlineSync.enqueue({
      type: isNew ? 'createEmployee' : 'updateEmployee',
      payload: { ...emp, durationId: local.id, slotIndex },
    });
    employees[slotIndex] = entry;
    const next = { ...local, employees };
    setLocal(next);
    onUpdate(local.id, next);
  }

  async function handleEmployeeClear(slotIndex: number) {
    const employees = [...(local.employees || [])];
    const emp = employees[slotIndex];
    if (emp?.id) await offlineSync.enqueue({ type: 'deleteEmployee', payload: { id: emp.id } });
    employees[slotIndex] = null;
    const next = { ...local, employees };
    setLocal(next);
    onUpdate(local.id, next);
  }

  const rooms = Math.max(1, local.numberOfRooms || 1);
  const today = new Date().toISOString().split('T')[0];

  const sectionLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2',
    dk ? 'text-slate-500' : 'text-slate-400');

  return (
    <div className={cn('rounded-xl border p-4 space-y-4',
      dk ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-sm'
    )}>

      {/* ── Row 1: Dates · Room type · Count · WG beds · Nights · Beds ── */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className={cn('text-[10px] font-semibold', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Von':'From'}</label>
          <input type="date" value={local.startDate||''} onChange={e=>patch({startDate:e.target.value})} className={cn(inp,'w-36')}/>
        </div>
        <div className="flex flex-col gap-1">
          <label className={cn('text-[10px] font-semibold', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Bis':'To'}</label>
          <input type="date" value={local.endDate||''} onChange={e=>patch({endDate:e.target.value})} className={cn(inp,'w-36')}/>
        </div>
        <div className="flex flex-col gap-1">
          <label className={cn('text-[10px] font-semibold', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Typ':'Type'}</label>
          <select value={local.roomType||'DZ'} onChange={e=>patch({roomType:e.target.value})} className={cn(inp,'w-20')}>
            <option value="EZ">EZ</option>
            <option value="DZ">DZ</option>
            <option value="TZ">TZ</option>
            <option value="WG">WG</option>
          </select>
        </div>

        {/* WG: manual bed count */}
        {local.roomType === 'WG' ? (
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Betten':'Beds'}</label>
            <input type="number" min={1} value={local.wgBeds||1}
              onChange={e=>patch({wgBeds:Math.max(1,parseInt(e.target.value)||1)})}
              className={cn(inp,'w-20')}/>
          </div>
        ) : (
          /* EZ/DZ/TZ: room count stepper */
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Zimmer':'Rooms'}</label>
            <div className={cn('flex items-center rounded-md border overflow-hidden', dk?'border-white/10':'border-slate-200')}>
              <button onClick={()=>patch({numberOfRooms:Math.max(1,rooms-1)})}
                className={cn('px-2 py-1.5', dk?'hover:bg-white/10 text-white':'hover:bg-slate-50 text-slate-700')}>
                <Minus size={12}/>
              </button>
              <span className={cn('px-3 text-sm font-bold', dk?'text-white':'text-slate-900')}>{rooms}</span>
              <button onClick={()=>patch({numberOfRooms:rooms+1})}
                className={cn('px-2 py-1.5', dk?'hover:bg-white/10 text-white':'hover:bg-slate-50 text-slate-700')}>
                <Plus size={12}/>
              </button>
            </div>
          </div>
        )}

        <div className={cn('text-sm font-bold px-2 py-1.5 shrink-0', dk?'text-slate-300':'text-slate-700')}>
          {nights}N · {totalBeds} {lang==='de'?'Betten':'beds'}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saving && <Loader2 size={13} className="animate-spin text-blue-400"/>}
          <button onClick={()=>setConfirmDelete(true)} className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={14}/>
          </button>
        </div>
      </div>

      {/* ── Row 2: Room No · Floor · Invoice · Booking ref ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { key:'roomNo',    label:'Wohnung Nr',                         ph:'Nr...' },
          { key:'floor',     label:'Stockwerk',                          ph:'EG / 1. OG' },
          { key:'invoiceNo', label:'Rechnung Nr',                        ph:'INV-...' },
          { key:'bookingId', label:lang==='de'?'Buchungsreferenz':'Ref', ph:'REF-...' },
        ].map(({key,label,ph})=>(
          <div key={key} className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-500':'text-slate-400')}>{label}</label>
            <input value={(local as any)[key]||''} onChange={e=>patch({[key]:e.target.value})} placeholder={ph} className={inp}/>
          </div>
        ))}
      </div>

      {/* ── PRICING ── */}
      <div className={cn('rounded-lg border p-3 space-y-3', dk?'border-white/10 bg-white/[0.02]':'border-slate-100 bg-slate-50')}>
        <p className={sectionLabel}>{lang==='de'?'Preisgestaltung':'Pricing'}</p>

        {/* Price inputs */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-400':'text-slate-500')}>
              {lang==='de'?'Preis / Nacht / Zimmer':'Price / night / room'}
            </label>
            <input type="number" min={0} step="0.01"
              value={local.pricePerNightPerRoom??0}
              onChange={e=>patch({pricePerNightPerRoom:normalizeNumberInput(e.target.value), totalPriceOverride:null})}
              className={cn(inp,'w-32')}/>
          </div>

          <span className={cn('text-xs pb-2', dk?'text-slate-600':'text-slate-400')}>oder</span>

          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-400':'text-slate-500')}>
              {lang==='de'?'Gesamtpreis (Eingabe)':'Total price (enter)'}
            </label>
            <input type="number" min={0} step="0.01"
              value={local.totalPriceOverride||''}
              placeholder="..."
              onChange={e=>{
                const v=normalizeNumberInput(e.target.value);
                patch({totalPriceOverride:v>0?v:null});
              }}
              className={cn(inp,'w-32')}/>
          </div>

          {impliedNPR !== null && (
            <span className={cn('text-xs pb-2 font-semibold', dk?'text-blue-400':'text-blue-600')}>
              ≈ {formatCurrency(impliedNPR)}/Nacht
            </span>
          )}
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={()=>{ setShowNightCal(!showNightCal); patch({useManualPrices:!local.useManualPrices}); }}
            className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
              local.useManualPrices
                ? 'bg-purple-600 text-white border-purple-600'
                : dk?'border-white/10 text-slate-300 hover:bg-white/5':'border-slate-200 text-slate-600 hover:bg-white'
            )}>
            {lang==='de'?'Manuelle Nachtpreise':'Manual nightly prices'}
          </button>

          <button
            onClick={()=>patch({hasDiscount:!local.hasDiscount})}
            className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
              local.hasDiscount
                ? 'bg-orange-500 text-white border-orange-500'
                : dk?'border-white/10 text-slate-300 hover:bg-white/5':'border-slate-200 text-slate-600 hover:bg-white'
            )}>
            {lang==='de'?'Rabatt':'Discount'}
          </button>

          {local.hasDiscount && (
            <>
              <select value={local.discountType||'percentage'} onChange={e=>patch({discountType:e.target.value})} className={cn(inp,'w-20')}>
                <option value="percentage">%</option>
                <option value="fixed">€ fix</option>
              </select>
              <input type="number" min={0} value={local.discountValue||0}
                onChange={e=>patch({discountValue:normalizeNumberInput(e.target.value)})}
                className={cn(inp,'w-24')}/>
            </>
          )}
        </div>

        {/* Manual nightly calendar */}
        {local.useManualPrices && showNightCal && allNights.length > 0 && (
          <div className={cn('rounded-lg border p-3', dk?'border-white/10 bg-slate-800':'border-slate-200 bg-white')}>
            <p className={sectionLabel}>{lang==='de'?'Preis pro Nacht':'Price per night'}</p>
            <div className="grid gap-2" style={{gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))'}}>
              {allNights.map(night=>(
                <div key={night} className={cn('rounded-md border p-2', dk?'border-white/10 bg-slate-900':'border-slate-100 bg-slate-50')}>
                  <p className={cn('text-[10px] font-bold mb-1', dk?'text-slate-300':'text-slate-600')}>
                    {night.split('-').reverse().join('.')}
                  </p>
                  <input type="number" min={0} step="0.01"
                    value={(local.nightlyPrices||{})[night]??local.pricePerNightPerRoom??0}
                    onChange={e=>patch({nightlyPrices:{...(local.nightlyPrices||{}),[night]:normalizeNumberInput(e.target.value)}})}
                    className={cn('w-full px-1.5 py-1 rounded text-xs border outline-none',
                      dk?'bg-white/5 border-white/10 text-white':'bg-white border-slate-200 text-slate-900')}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brutto / Netto / MwSt */}
        <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-dashed border-slate-300/20">
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-400':'text-slate-500')}>Netto (€)</label>
            <input type="number" min={0} step="0.01" value={local.nettoPrice??''} placeholder="—"
              onChange={e=>patch({nettoPrice:normalizeNumberInput(e.target.value)||null})}
              className={cn(inp,'w-28')}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-400':'text-slate-500')}>MwSt (%)</label>
            <input type="number" min={0} max={100} step="0.1" value={local.mwst??''} placeholder="19"
              onChange={e=>patch({mwst:normalizeNumberInput(e.target.value)||null})}
              className={cn(inp,'w-20')}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className={cn('text-[10px] font-semibold', dk?'text-slate-400':'text-slate-500')}>Brutto (€)</label>
            <input type="number" min={0} step="0.01" value={local.bruttoPrice??''} placeholder="—"
              onChange={e=>patch({bruttoPrice:normalizeNumberInput(e.target.value)||null, nettoPrice:null})}
              className={cn(inp,'w-28')}/>
          </div>
          {derivedBrutto !== null && !local.bruttoPrice && (
            <span className={cn('text-xs pb-2 font-semibold', dk?'text-green-400':'text-green-700')}>
              Brutto: {formatCurrency(derivedBrutto)}
            </span>
          )}
          {derivedNetto !== null && (
            <span className={cn('text-xs pb-2 font-semibold', dk?'text-green-400':'text-green-700')}>
              Netto: {formatCurrency(derivedNetto)}
            </span>
          )}
          {local.bruttoPrice && !local.mwst && (
            <span className={cn('text-xs pb-2 italic', dk?'text-yellow-500':'text-yellow-700')}>
              {lang==='de'?'MwSt unbekannt — Netto nicht berechenbar':'MwSt unknown — Netto cannot be derived'}
            </span>
          )}
        </div>

        {/* Paid + Deposit + Total */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-dashed border-slate-300/20">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={()=>patch({isPaid:!local.isPaid})}
              className={cn('px-2.5 py-1 rounded-md text-xs font-bold border transition-all',
                local.isPaid
                  ? 'bg-green-600 text-white border-green-600'
                  : dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-white'
              )}>
              {local.isPaid?(lang==='de'?'Bezahlt':'Paid'):(lang==='de'?'Offen':'Unpaid')}
            </button>

            <button
              onClick={()=>patch({hasDeposit:!local.hasDeposit, depositAmount:local.hasDeposit?null:local.depositAmount})}
              className={cn('px-2.5 py-1 rounded-md text-xs font-bold border transition-all',
                local.hasDeposit
                  ? 'bg-blue-600 text-white border-blue-600'
                  : dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-white'
              )}>
              {lang==='de'?'Kaution':'Deposit'}
            </button>

            {local.hasDeposit && (
              <input type="number" min={0} step="0.01"
                value={local.depositAmount||''}
                placeholder="€ Betrag"
                onChange={e=>patch({depositAmount:normalizeNumberInput(e.target.value)||null})}
                className={cn(inp,'w-28')}/>
            )}
          </div>

          <span className={cn('text-sm font-black', dk?'text-white':'text-slate-900')}>
            {lang==='de'?'Gesamt:':'Total:'} {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* ── BED ASSIGNMENTS ── */}
      <div>
        <p className={sectionLabel}>
          {lang==='de'?'Bettenbelegung':'Bed assignments'} · {totalBeds} {lang==='de'?'Betten':'beds'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({length: totalBeds}).map((_, slotIndex) => {
            const emp    = local.employees?.[slotIndex] ?? null;
            const status = emp ? getEmployeeStatus(emp, today) : null;
            return (
              <BedSlot
                key={slotIndex}
                slotIndex={slotIndex}
                employee={emp}
                statusColor={status ? getEmployeeStatusColor(status) : ''}
                durationStart={local.startDate}
                durationEnd={local.endDate}
                dk={dk}
                lang={lang}
                onSave={(e: any) => handleEmployeeSave(slotIndex, e)}
                onClear={() => handleEmployeeClear(slotIndex)}
              />
            );
          })}
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={cn('w-full max-w-sm rounded-xl border p-5',
            dk?'bg-slate-900 border-white/10 text-white':'bg-white border-slate-200 text-slate-900'
          )}>
            <h3 className="text-base font-black mb-2">{lang==='de'?'Aufenthalt löschen?':'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk?'text-slate-400':'text-slate-600')}>
              {lang==='de'?'Alle Daten werden gelöscht.':'All data will be deleted.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-semibold',
                  dk?'border-white/10 text-slate-300 hover:bg-white/5':'border-slate-200 text-slate-600 hover:bg-slate-50'
                )}>{lang==='de'?'Abbrechen':'Cancel'}</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang==='de'?'Löschen':'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BED SLOT COMPONENT ───────────────────────────────────────────────────────
function BedSlot({ slotIndex, employee, statusColor, durationStart, durationEnd, dk, lang, onSave, onClear }: any) {
  const [editing,   setEditing]  = useState(!employee);
  const [name,      setName]     = useState(employee?.name    || '');
  const [checkIn,   setCheckIn]  = useState(employee?.checkIn  || durationStart || '');
  const [checkOut,  setCheckOut] = useState(employee?.checkOut || durationEnd   || '');

  useEffect(() => {
    setName(employee?.name    || '');
    setCheckIn(employee?.checkIn  || durationStart || '');
    setCheckOut(employee?.checkOut || durationEnd   || '');
    setEditing(!employee);
  }, [employee, durationStart, durationEnd]);

  const inp = cn('px-2 py-1 rounded-md text-xs border outline-none w-full transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400');

  function save() {
    if (!name.trim()) return;
    onSave({ ...(employee || {}), name: name.trim(), checkIn, checkOut });
    setEditing(false);
  }

  if (!editing && employee) {
    return (
      <div className={cn('rounded-lg border p-2.5 flex items-center justify-between gap-2',
        dk?'border-white/10 bg-white/[0.02]':'border-slate-200 bg-slate-50')}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', statusColor || 'bg-slate-100 text-slate-500')}>
            {slotIndex + 1}
          </span>
          <div className="min-w-0">
            <p className={cn('text-sm font-semibold truncate', dk?'text-white':'text-slate-900')}>{employee.name}</p>
            <p className={cn('text-[10px]', dk?'text-slate-500':'text-slate-400')}>
              {employee.checkIn  ? employee.checkIn.split('-').reverse().join('.')  : '—'} →{' '}
              {employee.checkOut ? employee.checkOut.split('-').reverse().join('.') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={()=>setEditing(true)}
            className={cn('p-1 rounded text-xs', dk?'text-slate-400 hover:bg-white/10':'text-slate-500 hover:bg-slate-200')}>✎</button>
          <button onClick={onClear} className="p-1 rounded text-red-400 hover:bg-red-500/10 text-xs">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-2.5 space-y-1.5',
      dk?'border-white/10 bg-white/[0.02]':'border-slate-200 bg-slate-50')}>
      <div className="flex items-center gap-1.5">
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
          dk?'bg-white/10 text-slate-300':'bg-slate-200 text-slate-600')}>{slotIndex + 1}</span>
        <span className={cn('text-[10px]', dk?'text-slate-500':'text-slate-400')}>
          {lang==='de'?'Bett':'Bed'} {slotIndex + 1}
        </span>
      </div>
      <input value={name} onChange={e=>setName(e.target.value)}
        placeholder={lang==='de'?'Mitarbeitername...':'Employee name...'}
        className={inp}/>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <p className={cn('text-[9px] mb-0.5', dk?'text-slate-500':'text-slate-400')}>Check-in</p>
          <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} className={inp}/>
        </div>
        <div>
          <p className={cn('text-[9px] mb-0.5', dk?'text-slate-500':'text-slate-400')}>Check-out</p>
          <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)} className={inp}/>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={save}
          className="flex-1 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
          {lang==='de'?'Speichern':'Save'}
        </button>
        {employee && (
          <button onClick={()=>setEditing(false)}
            className={cn('px-2 py-1 rounded-md border text-xs',
              dk?'border-white/10 text-slate-400':'border-slate-200 text-slate-500')}>✕</button>
        )}
      </div>
    </div>
  );
}
