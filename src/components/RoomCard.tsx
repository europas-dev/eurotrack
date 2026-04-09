import React, { useCallback, useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2,
  Minus, Plus, Tag, Trash2, User, X,
} from 'lucide-react'
import { cn, calculateNights, formatCurrency, formatDateDisplay, getNightsBetween, normalizeNumberInput } from '../lib/utils'
import { bedsForType, calcRoomCardBrutto, calcRoomCardNetto, calcRoomCardTotal } from '../lib/roomCardUtils'
import {
  updateRoomCard, deleteRoomCard,
  createRoomCardEmployee, updateRoomCardEmployee, deleteRoomCardEmployee,
} from '../lib/supabaseRoomCards'
import type { Employee, RoomCard as RoomCardType } from '../lib/types'
import { getEmployeeStatus } from '../lib/utils'

// ── Employee border color ─────────────────────────────────────────────────────
function empBorderColor(emp: Employee | null, dk: boolean): string {
  if (!emp) return dk ? 'border-white/10' : 'border-slate-200'
  const s = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '')
  if (s === 'active')      return dk ? 'border-emerald-500/60' : 'border-emerald-500'
  if (s === 'ending-soon') return dk ? 'border-red-500/60'     : 'border-red-500'
  if (s === 'completed')   return dk ? 'border-green-500/40'   : 'border-green-400'
  if (s === 'upcoming')    return dk ? 'border-blue-500/60'    : 'border-blue-500'
  return dk ? 'border-white/10' : 'border-slate-200'
}

// ── Bed slot ──────────────────────────────────────────────────────────────────
function BedSlot({
  slotIndex, employee, durationStart, durationEnd,
  roomCardId, durationId, dk, lang,
  onUpdated,
}: {
  slotIndex: number
  employee: Employee | null
  durationStart: string
  durationEnd: string
  roomCardId: string
  durationId: string
  dk: boolean
  lang: 'de' | 'en'
  onUpdated: (slotIndex: number, emp: Employee | null) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(employee?.name ?? '')
  const [checkIn, setCheckIn]   = useState(employee?.checkIn  ?? durationStart)
  const [checkOut, setCheckOut] = useState(employee?.checkOut ?? durationEnd)
  const [saving, setSaving]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const nights = calculateNights(checkIn, checkOut)
  const status = employee ? getEmployeeStatus(employee.checkIn ?? '', employee.checkOut ?? '') : null
  const borderCls = empBorderColor(employee, dk)

  const inputCls = cn(
    'px-2 py-1 rounded-lg text-xs outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  )

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (employee?.id) {
        await updateRoomCardEmployee(employee.id, { name: name.trim(), checkIn, checkOut })
        onUpdated(slotIndex, { ...employee, name: name.trim(), checkIn, checkOut })
      } else {
        const created = await createRoomCardEmployee(roomCardId, durationId, slotIndex, {
          name: name.trim(), checkIn, checkOut,
        })
        onUpdated(slotIndex, created)
      }
      setEditing(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!employee?.id) { onUpdated(slotIndex, null); return }
    setSaving(true)
    try {
      await deleteRoomCardEmployee(employee.id)
      onUpdated(slotIndex, null)
      setName(''); setEditing(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  // ── Compact view: assigned ────────────────────────────────────────────────
  if (!editing && employee) {
    const statusLabel: Record<string, string> = {
      active: dk ? 'text-emerald-400' : 'text-emerald-600',
      'ending-soon': dk ? 'text-red-400' : 'text-red-500',
      completed: dk ? 'text-green-400' : 'text-green-600',
      upcoming: dk ? 'text-blue-400' : 'text-blue-500',
    }
    return (
      <div
        onClick={() => {
          setName(employee.name); setCheckIn(employee.checkIn ?? durationStart)
          setCheckOut(employee.checkOut ?? durationEnd); setEditing(true)
        }}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 cursor-pointer transition-all group',
          borderCls,
          dk ? 'bg-white/3 hover:bg-white/6' : 'bg-white hover:bg-slate-50'
        )}
      >
        <Bed size={11} className={statusLabel[status ?? 'active'] ?? (dk ? 'text-slate-400' : 'text-slate-500')} />
        <span className={cn('text-xs font-bold flex-1 truncate', dk ? 'text-white' : 'text-slate-900')}>
          {employee.name}
        </span>
        <span className={cn('text-[10px] tabular-nums', dk ? 'text-slate-500' : 'text-slate-400')}>
          {formatDateDisplay(employee.checkIn ?? '', lang)}–{formatDateDisplay(employee.checkOut ?? '', lang)}
        </span>
        <span className={cn('text-[10px] font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>
          {calculateNights(employee.checkIn ?? '', employee.checkOut ?? '')}N
        </span>
        {saving && <Loader2 size={10} className="animate-spin text-blue-400" />}
      </div>
    )
  }

  // ── Compact view: empty ───────────────────────────────────────────────────
  if (!editing) {
    return (
      <button
        onClick={() => {
          setCheckIn(durationStart); setCheckOut(durationEnd); setEditing(true)
          setTimeout(() => inputRef.current?.focus(), 40)
        }}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 border-dashed text-xs font-bold transition-all',
          dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400'
             : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
        )}
      >
        <Bed size={11} />
        <span>{lang === 'de' ? `Bett ${slotIndex + 1} – frei` : `Bed ${slotIndex + 1} – vacant`}</span>
      </button>
    )
  }

  // ── Edit form ─────────────────────────────────────────────────────────────
  return (
    <div className={cn('rounded-lg border p-2.5 space-y-2', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
      <div className="flex items-center gap-1.5">
        <Bed size={11} className={dk ? 'text-slate-400' : 'text-slate-500'} />
        <span className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
          {lang === 'de' ? `Bett ${slotIndex + 1}` : `Bed ${slotIndex + 1}`}
        </span>
      </div>
      <input
        ref={inputRef} type="text" value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        placeholder={lang === 'de' ? 'Name...' : 'Name...'}
        className={cn(inputCls, 'w-full')}
      />
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>In</p>
          <input type="date" value={checkIn} min={durationStart} max={durationEnd}
            onChange={e => setCheckIn(e.target.value)} className={cn(inputCls, 'w-full')} />
        </div>
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>Out</p>
          <input type="date" value={checkOut} min={checkIn} max={durationEnd}
            onChange={e => setCheckOut(e.target.value)} className={cn(inputCls, 'w-full')} />
        </div>
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Nächte' : 'Nights'}</p>
          <div className={cn('px-2 py-1 rounded-lg border text-xs font-bold text-center', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            {nights}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1">
          {saving && <Loader2 size={10} className="animate-spin" />}
          {lang === 'de' ? 'Speichern' : 'Save'}
        </button>
        {employee?.id && (
          <button onClick={remove} className="px-2.5 py-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 text-xs font-bold">
            {lang === 'de' ? 'Del' : 'Del'}
          </button>
        )}
        <button onClick={() => setEditing(false)}
          className={cn('px-2.5 py-1.5 rounded-lg text-xs', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Main RoomCard component ───────────────────────────────────────────────────
interface RoomCardProps {
  card: RoomCardType
  durationStart: string
  durationEnd: string
  dk: boolean
  lang: 'de' | 'en'
  allCardsOfSameType: RoomCardType[]
  onUpdate: (id: string, patch: Partial<RoomCardType>) => void
  onDelete: (id: string) => void
  onApplyToSameType: (sourceCard: RoomCardType) => void
}

export default function RoomCard({
  card, durationStart, durationEnd, dk, lang,
  allCardsOfSameType, onUpdate, onDelete, onApplyToSameType,
}: RoomCardProps) {
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const saveTimer = useRef<any>(null)

  const beds    = bedsForType(card.roomType, card.bedCount)
  const nights  = calculateNights(durationStart, durationEnd)
  const allNights = getNightsBetween(durationStart, durationEnd)
  const total   = calcRoomCardTotal(card, durationStart, durationEnd)
  const derivedBrutto = calcRoomCardBrutto(card)
  const derivedNetto  = calcRoomCardNetto(card)
  const isWG = card.roomType === 'WG'

  const inputCls = cn(
    'px-2.5 py-1.5 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  )
  const labelCls = cn('text-[9px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    const next = { ...card, ...patch }
    onUpdate(card.id, patch)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await updateRoomCard(card.id, patch) }
      catch (e) { console.error(e) }
      finally { setSaving(false) }
    }, 400)
  }

  function patchBedCount(raw: number) {
    const n = Math.max(1, raw)
    queueSave({ bedCount: n })
  }

  function onEmployeeUpdated(slotIndex: number, emp: Employee | null) {
    const emps = [...(card.employees ?? [])]
    while (emps.length < beds) emps.push(null as any)
    emps[slotIndex] = emp as any
    onUpdate(card.id, { employees: emps.filter(Boolean) as Employee[] })
  }

  const freeNow = (card.employees ?? []).filter(e => {
    if (!e) return false
    const s = getEmployeeStatus(e.checkIn ?? '', e.checkOut ?? '')
    return s === 'active' || s === 'ending-soon' || s === 'upcoming'
  }).length

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      dk ? 'bg-[#0d1629] border-white/10' : 'bg-white border-slate-200'
    )}>
      {/* ── Header row ── */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 flex-wrap',
        dk ? 'border-b border-white/8' : 'border-b border-slate-100'
      )}>
        {/* Room No */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Zimmer' : 'Room'}</label>
          <input
            type="text" value={card.roomNo}
            onChange={e => queueSave({ roomNo: e.target.value })}
            placeholder="101"
            className={cn(inputCls, 'w-16 text-center font-bold')}
          />
        </div>
        {/* Floor */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Etage' : 'Floor'}</label>
          <input
            type="text" value={card.floor}
            onChange={e => queueSave({ floor: e.target.value })}
            placeholder="1"
            className={cn(inputCls, 'w-14 text-center')}
          />
        </div>
        {/* Room type */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Typ</label>
          <select
            value={card.roomType}
            onChange={e => {
              const rt = e.target.value as any
              const bc = rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount
              queueSave({ roomType: rt, bedCount: bc })
            }}
            className={cn(inputCls, 'w-20')}
          >
            <option value="EZ">EZ</option>
            <option value="DZ">DZ</option>
            <option value="TZ">TZ</option>
            <option value="WG">WG</option>
          </select>
        </div>
        {/* WG: bed count stepper */}
        {isWG && (
          <div className="flex flex-col gap-0.5">
            <label className={labelCls}>{lang === 'de' ? 'Betten' : 'Beds'}</label>
            <div className={cn('flex items-center rounded-lg border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
              <button onClick={() => patchBedCount(card.bedCount - 1)}
                className={cn('px-2 py-1.5', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Minus size={12} /></button>
              <span className={cn('px-2 py-1.5 text-sm font-bold min-w-[32px] text-center',
                dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900')}>{card.bedCount}</span>
              <button onClick={() => patchBedCount(card.bedCount + 1)}
                className={cn('px-2 py-1.5', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Plus size={12} /></button>
            </div>
          </div>
        )}
        {/* Nights + beds badge */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className={cn('text-xs font-bold px-2 py-1 rounded-md',
            dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600')}>
            {nights}N
          </span>
          <span className={cn('text-xs font-bold px-2 py-1 rounded-md',
            dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600')}>
            {beds} {lang === 'de' ? 'Betten' : 'beds'}
          </span>
          {freeNow < beds && (
            <span className={cn('text-xs font-bold px-2 py-1 rounded-md',
              dk ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700')}>
              {beds - freeNow} {lang === 'de' ? 'belegt' : 'occupied'}
            </span>
          )}
        </div>
        {/* Total */}
        <span className={cn('ml-auto text-base font-black', dk ? 'text-white' : 'text-slate-900')}>
          {formatCurrency(total)}
        </span>
        {/* Actions */}
        <div className="flex items-center gap-1">
          {saving && <Loader2 size={12} className="animate-spin text-blue-400" />}
          <button
            onClick={() => setShowPricing(p => !p)}
            className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
              showPricing
                ? 'bg-amber-500 text-white border-amber-500'
                : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            {lang === 'de' ? 'Preis' : 'Price'}
            {showPricing ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />}
          </button>
          <button
            onClick={() => setShowCalendar(c => !c)}
            className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
              showCalendar
                ? 'bg-blue-600 text-white border-blue-600'
                : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            📅
          </button>
          <button
            onClick={() => setConfirm(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Pricing panel ── */}
      {showPricing && (
        <div className={cn('px-3 py-3 space-y-3 border-b', dk ? 'border-white/8 bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60')}>
          <div className="flex items-end gap-3 flex-wrap">
            {/* Mode toggle */}
            <button
              onClick={() => queueSave({ useBruttoNetto: !card.useBruttoNetto, pricingMode: !card.useBruttoNetto ? 'brutto_netto' : 'simple' })}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
                card.useBruttoNetto
                  ? 'bg-amber-500 text-white border-amber-500'
                  : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              )}
            >
              Brutto/Netto
            </button>

            {!card.useBruttoNetto && (
              <>
                {/* Simple: price/night/room */}
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>{lang === 'de' ? 'Preis/Nacht/Zimmer' : 'Price/night/room'}</label>
                  <input
                    type="number" min={0} step="0.01"
                    value={card.nightlyPrice || ''}
                    onChange={e => queueSave({ nightlyPrice: normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-28')}
                  />
                </div>
                {/* WG: price/bed/night */}
                {isWG && (
                  <div className="flex flex-col gap-0.5">
                    <label className={labelCls}>{lang === 'de' ? 'Preis/Bett/Nacht' : 'Price/bed/night'}</label>
                    <input
                      type="number" min={0} step="0.01"
                      value={card.pricePerBedAmount || ''}
                      placeholder="25.00"
                      onChange={e => {
                        const perBed = normalizeNumberInput(e.target.value)
                        queueSave({
                          pricePerBed: perBed > 0,
                          pricePerBedAmount: perBed,
                          nightlyPrice: perBed * beds,
                        })
                      }}
                      className={cn(inputCls, 'w-28')}
                    />
                    {card.pricePerBedAmount > 0 && (
                      <span className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
                        = {formatCurrency(card.pricePerBedAmount * beds)}{lang === 'de' ? '/Zimmer/N' : '/room/N'}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            {card.useBruttoNetto && (
              <>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>Brutto (€)</label>
                  <input type="number" min={0} step="0.01"
                    value={card.brutto ?? ''} placeholder="Brutto..."
                    onChange={e => queueSave({ brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-28')} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>Netto (€)</label>
                  <input type="number" min={0} step="0.01"
                    value={card.netto ?? ''} placeholder="Netto..."
                    onChange={e => queueSave({ netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-28')} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>MwSt (%)</label>
                  <input type="number" min={0} max={100} step="0.1"
                    value={card.mwst ?? ''} placeholder="19..."
                    onChange={e => queueSave({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-20')} />
                </div>
                {/* Derived display */}
                <div className={cn('self-end px-2.5 py-1.5 rounded-lg border text-xs font-bold',
                  dk ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white')}>
                  {derivedBrutto != null && card.netto && !card.brutto && (
                    <span className={dk ? 'text-amber-400' : 'text-amber-600'}>→ Brutto: {formatCurrency(derivedBrutto)}</span>
                  )}
                  {derivedNetto != null && card.brutto && (
                    <span className={dk ? 'text-green-400' : 'text-green-700'}>→ Netto: {formatCurrency(derivedNetto)}</span>
                  )}
                  {!derivedBrutto && !derivedNetto && <span className={dk ? 'text-slate-500' : 'text-slate-400'}>—</span>}
                </div>
              </>
            )}

            {/* Discount */}
            <button
              onClick={() => queueSave({ hasDiscount: !card.hasDiscount })}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all self-end',
                card.hasDiscount ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <Tag size={11} />{lang === 'de' ? 'Rabatt' : 'Discount'}
            </button>
            {card.hasDiscount && (
              <>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>Typ</label>
                  <select value={card.discountType}
                    onChange={e => queueSave({ discountType: e.target.value as any })}
                    className={cn(inputCls, 'w-20')}>
                    <option value="percentage">%</option>
                    <option value="fixed">€ fix</option>
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>{lang === 'de' ? 'Wert' : 'Value'}</label>
                  <input type="number" min={0}
                    value={card.discountValue || ''}
                    onChange={e => queueSave({ discountValue: normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-24')} />
                </div>
              </>
            )}

            {/* Apply to same type */}
            {allCardsOfSameType.length > 1 && (
              <button
                onClick={() => onApplyToSameType(card)}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all self-end',
                  dk ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-blue-400' : 'border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                )}
              >
                <Copy size={11} />
                {lang === 'de' ? `Auf alle ${card.roomType} anwenden` : `Apply to all ${card.roomType}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Night calendar ── */}
      {showCalendar && durationStart && durationEnd && (
        <div className={cn('px-3 py-2.5 border-b', dk ? 'border-white/8 bg-white/[0.02]' : 'border-slate-100 bg-slate-50/40')}>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
            {lang === 'de' ? 'Nachtkalender' : 'Night calendar'}
          </p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))' }}>
            {allNights.map(night => (
              <div key={night} className={cn('rounded-lg border p-1.5', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
                <p className={cn('text-[10px] font-bold mb-1', dk ? 'text-slate-400' : 'text-slate-600')}>
                  {night.split('-').reverse().join('/')}
                </p>
                {card.useManualPrices ? (
                  <input
                    type="number" min={0} step="0.01"
                    value={(card.nightlyPrices?.[night] ?? card.nightlyPrice) || ''}
                    onChange={e => queueSave({ nightlyPrices: { ...(card.nightlyPrices ?? {}), [night]: normalizeNumberInput(e.target.value) } })}
                    className={cn(inputCls, 'w-full px-1.5 py-1 text-xs')}
                  />
                ) : (
                  <p className={cn('text-xs font-bold', dk ? 'text-white' : 'text-slate-900')}>
                    {formatCurrency(card.nightlyPrice || 0)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => queueSave({ useManualPrices: !card.useManualPrices })}
            className={cn('mt-2 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
              card.useManualPrices ? 'bg-purple-600 text-white border-purple-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {card.useManualPrices ? (lang === 'de' ? 'Manuelle Preise AN' : 'Manual ON') : (lang === 'de' ? 'Manuelle Nachtpreise' : 'Manual nightly')}
          </button>
        </div>
      )}

      {/* ── Bed slots ── */}
      <div className="px-3 py-2.5 space-y-1.5">
        {Array.from({ length: beds }).map((_, i) => {
          const emp = (card.employees ?? []).find(e => e?.slotIndex === i) ?? null
          return (
            <BedSlot
              key={i}
              slotIndex={i}
              employee={emp}
              durationStart={durationStart}
              durationEnd={durationEnd}
              roomCardId={card.id}
              durationId={card.durationId}
              dk={dk}
              lang={lang}
              onUpdated={onEmployeeUpdated}
            />
          )
        })}
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-sm rounded-2xl border p-5', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-base font-black mb-2">{lang === 'de' ? 'Zimmerkarte löschen?' : 'Delete room card?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {card.roomType} {card.roomNo ? `– ${card.roomNo}` : ''}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                onClick={async () => { await deleteRoomCard(card.id); onDelete(card.id) }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
