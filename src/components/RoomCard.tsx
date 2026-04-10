import React, { useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2,
  Minus, Plus, Tag, Trash2, X,
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, formatDateDisplay,
  getNightsBetween, normalizeNumberInput,
} from '../lib/utils'
import {
  bedsForType, calcRoomCardBrutto, calcRoomCardNetto, calcRoomCardTotal,
} from '../lib/roomCardUtils'
import {
  updateRoomCard, deleteRoomCard,
  createRoomCardEmployee, updateRoomCardEmployee, deleteRoomCardEmployee,
} from '../lib/supabaseRoomCards'
import type { Employee, RoomCard as RoomCardType } from '../lib/types'
import { getEmployeeStatus } from '../lib/utils'

function empBorderColor(emp: Employee | null, dk: boolean): string {
  if (!emp) return dk ? 'border-white/10' : 'border-slate-200'
  const s = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '')
  if (s === 'active')      return dk ? 'border-emerald-500/60' : 'border-emerald-500'
  if (s === 'ending-soon') return dk ? 'border-red-500/60'     : 'border-red-500'
  if (s === 'completed')   return dk ? 'border-green-500/40'   : 'border-green-400'
  if (s === 'upcoming')    return dk ? 'border-blue-500/60'    : 'border-blue-500'
  return dk ? 'border-white/10' : 'border-slate-200'
}

// ─────────────────────────────────────────────────────────────────────────────
// BedSlot
// ─────────────────────────────────────────────────────────────────────────────
function BedSlot({
  slotIndex, employee,
  durationStart, durationEnd,
  gapStart, gapEnd,
  roomCardId, durationId,
  dk, lang, onUpdated,
}: {
  slotIndex: number
  employee: Employee | null
  durationStart: string
  durationEnd: string
  gapStart?: string
  gapEnd?: string
  roomCardId: string
  durationId: string
  dk: boolean
  lang: 'de' | 'en'
  onUpdated: (slotIndex: number, emp: Employee | null, replaceAll?: boolean) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(employee?.name ?? '')
  const [checkIn, setCheckIn]   = useState(employee?.checkIn  ?? gapStart ?? durationStart)
  const [checkOut, setCheckOut] = useState(employee?.checkOut ?? gapEnd   ?? durationEnd)
  const [saving, setSaving]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveIn  = gapStart ?? durationStart
  const effectiveOut = gapEnd   ?? durationEnd

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
        // If this is a gap fill, signal to parent to delete the current occupant and replace
        const isGapFill = !!(gapStart || gapEnd)
        const created = await createRoomCardEmployee(roomCardId, durationId, slotIndex, {
          name: name.trim(), checkIn, checkOut,
        })
        onUpdated(slotIndex, created, isGapFill)
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

  if (!editing && employee) {
    const statusColor: Record<string, string> = {
      active:       dk ? 'text-emerald-400' : 'text-emerald-600',
      'ending-soon': dk ? 'text-red-400'    : 'text-red-500',
      completed:    dk ? 'text-green-400'   : 'text-green-600',
      upcoming:     dk ? 'text-blue-400'    : 'text-blue-500',
    }
    return (
      <div
        onClick={() => {
          setName(employee.name)
          setCheckIn(employee.checkIn ?? effectiveIn)
          setCheckOut(employee.checkOut ?? effectiveOut)
          setEditing(true)
        }}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 cursor-pointer transition-all',
          borderCls, dk ? 'bg-white/3 hover:bg-white/6' : 'bg-white hover:bg-slate-50'
        )}
      >
        <Bed size={10} className={statusColor[status ?? 'active'] ?? (dk ? 'text-slate-400' : 'text-slate-500')} />
        <span className={cn('text-xs font-bold flex-1 truncate', dk ? 'text-white' : 'text-slate-900')}>
          {employee.name}
        </span>
        <span className={cn('text-[10px] tabular-nums shrink-0', dk ? 'text-slate-500' : 'text-slate-400')}>
          {formatDateDisplay(employee.checkIn ?? '', lang)}–{formatDateDisplay(employee.checkOut ?? '', lang)}
        </span>
        <span className={cn('text-[10px] font-bold shrink-0', dk ? 'text-slate-400' : 'text-slate-500')}>
          {calculateNights(employee.checkIn ?? '', employee.checkOut ?? '')}N
        </span>
        {saving && <Loader2 size={10} className="animate-spin text-blue-400" />}
      </div>
    )
  }

  if (!editing) {
    const isGap = !!(gapStart || gapEnd)
    return (
      <button
        onClick={() => {
          setCheckIn(effectiveIn); setCheckOut(effectiveOut); setEditing(true)
          setTimeout(() => inputRef.current?.focus(), 40)
        }}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 border-dashed text-xs font-bold transition-all',
          isGap
            ? dk ? 'border-amber-500/40 text-amber-400 hover:border-amber-400 hover:bg-amber-900/10'
                 : 'border-amber-400 text-amber-600 hover:bg-amber-50'
            : dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400'
                 : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
        )}
      >
        <Plus size={10} />
        <span>
          {isGap
            ? `${lang === 'de' ? 'Lücke füllen' : 'Fill gap'} · ${formatDateDisplay(effectiveIn, lang)}–${formatDateDisplay(effectiveOut, lang)}`
            : `${lang === 'de' ? `Bett ${slotIndex + 1} – frei` : `Bed ${slotIndex + 1} – vacant`}`
          }
        </span>
      </button>
    )
  }

  return (
    <div className={cn('rounded-lg border p-2.5 space-y-2', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
      <div className="flex items-center gap-1.5">
        <Bed size={10} className={dk ? 'text-slate-400' : 'text-slate-500'} />
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
          <input type="date" value={checkIn}
            min={effectiveIn} max={effectiveOut}
            onChange={e => setCheckIn(e.target.value)} className={cn(inputCls, 'w-full')} />
        </div>
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>Out</p>
          <input type="date" value={checkOut}
            min={checkIn} max={effectiveOut}
            onChange={e => setCheckOut(e.target.value)} className={cn(inputCls, 'w-full')} />
        </div>
        <div>
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Nächte' : 'Nights'}</p>
          <div className={cn('px-2 py-1 rounded-lg border text-xs font-bold text-center',
            dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
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
          <button onClick={remove}
            className="px-2.5 py-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 text-xs font-bold">
            Del
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

function getGapSlots(
  beds: number,
  employees: Employee[],
  durationStart: string,
  durationEnd: string
): { slotIndex: number; gapStart: string; gapEnd: string }[] {
  const gaps: { slotIndex: number; gapStart: string; gapEnd: string }[] = []
  const occupied: Record<number, Employee[]> = {}
  employees.forEach(e => {
    const si = e.slotIndex ?? 0
    occupied[si] = occupied[si] ?? []
    occupied[si].push(e)
  })

  for (let i = 0; i < beds; i++) {
    const occs = (occupied[i] ?? []).sort(
      (a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? '')
    )
    if (occs.length === 0) continue
    const first = occs[0]
    if (first.checkIn && first.checkIn > durationStart) {
      gaps.push({ slotIndex: i, gapStart: durationStart, gapEnd: first.checkIn })
    }
    for (let j = 0; j < occs.length - 1; j++) {
      const curr = occs[j]
      const next = occs[j + 1]
      if (curr.checkOut && next.checkIn && curr.checkOut < next.checkIn) {
        gaps.push({ slotIndex: i, gapStart: curr.checkOut, gapEnd: next.checkIn })
      }
    }
    const last = occs[occs.length - 1]
    if (last.checkOut && last.checkOut < durationEnd) {
      gaps.push({ slotIndex: i, gapStart: last.checkOut, gapEnd: durationEnd })
    }
  }
  return gaps
}

// ─────────────────────────────────────────────────────────────────────────────
// Main RoomCard
// ─────────────────────────────────────────────────────────────────────────────
interface RoomCardProps {
  card: RoomCardType
  durationStart: string
  durationEnd: string
  dk: boolean
  lang: 'de' | 'en'
  allCardsOfSameType: RoomCardType[]
  bruttoNettoActive?: boolean
  onUpdate: (id: string, patch: Partial<RoomCardType>) => void
  onDelete: (id: string) => void
  onApplyToSameType: (source: RoomCardType) => void
}

export default function RoomCard({
  card, durationStart, durationEnd, dk, lang,
  allCardsOfSameType, bruttoNettoActive = false, onUpdate, onDelete, onApplyToSameType,
}: RoomCardProps) {
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const saveTimer = useRef<any>(null)

  const beds         = bedsForType(card.roomType, card.bedCount)
  const nights       = calculateNights(durationStart, durationEnd)
  const allNights    = getNightsBetween(durationStart, durationEnd)
  // If duration-level Brutto/Netto is active, per-room price is disabled — show 0
  const total        = bruttoNettoActive ? 0 : calcRoomCardTotal(card, durationStart, durationEnd)
  const derivedBrutto = calcRoomCardBrutto(card)
  const derivedNetto  = calcRoomCardNetto(card)
  const isWG = card.roomType === 'WG'

  const employees = card.employees ?? []
  const occupiedCount = employees.filter(e => {
    const s = getEmployeeStatus(e.checkIn ?? '', e.checkOut ?? '')
    return s === 'active' || s === 'ending-soon' || s === 'upcoming'
  }).length

  const gapSlots = getGapSlots(beds, employees, durationStart, durationEnd)

  const inputCls = cn(
    'px-2.5 py-1.5 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  )
  const labelCls = cn('text-[9px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    onUpdate(card.id, patch)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await updateRoomCard(card.id, patch) }
      catch (e) { console.error(e) }
      finally { setSaving(false) }
    }, 400)
  }

  function patchBedCount(raw: number) {
    queueSave({ bedCount: Math.max(1, raw) })
  }

  // When filling a gap, delete the existing employee in that slot first
  function onEmployeeUpdated(slotIndex: number, emp: Employee | null, replaceAll?: boolean) {
    let existing = employees.filter(e => e.slotIndex !== slotIndex)
    if (replaceAll) {
      // Delete all employees in this slot from DB, then replace
      employees
        .filter(e => (e.slotIndex ?? 0) === slotIndex)
        .forEach(e => {
          if (e.id) deleteRoomCardEmployee(e.id).catch(console.error)
        })
    }
    const next = emp ? [...existing, emp] : existing
    onUpdate(card.id, { employees: next as Employee[] })
  }

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      dk ? 'bg-[#0d1629] border-white/10' : 'bg-white border-slate-200'
    )}>
      {/* ── ROW 1: Room No | Floor | Type | badge | total | Price btn | 📅 | 🗑 ── */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2',
        dk ? 'border-b border-white/8' : 'border-b border-slate-100'
      )}>
        {/* Room No */}
        <label className={cn(labelCls, 'shrink-0')}>No.</label>
        <input
          type="text" value={card.roomNo}
          onChange={e => queueSave({ roomNo: e.target.value })}
          placeholder="101"
          className={cn(inputCls, 'w-12 text-center font-bold text-sm')}
        />
        {/* Floor */}
        <label className={cn(labelCls, 'shrink-0')}>{lang === 'de' ? 'Etg.' : 'Fl.'}</label>
        <input
          type="text" value={card.floor}
          onChange={e => queueSave({ floor: e.target.value })}
          placeholder="1"
          className={cn(inputCls, 'w-10 text-center text-sm')}
        />
        {/* Type */}
        <select
          value={card.roomType}
          onChange={e => {
            const rt = e.target.value as any
            const bc = rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount
            queueSave({ roomType: rt, bedCount: bc })
          }}
          className={cn(inputCls, 'w-16 text-sm')}
        >
          <option value="EZ">EZ</option>
          <option value="DZ">DZ</option>
          <option value="TZ">TZ</option>
          <option value="WG">WG</option>
        </select>
        {/* WG bed stepper */}
        {isWG && (
          <div className={cn('flex items-center rounded-lg border overflow-hidden shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
            <button onClick={() => patchBedCount(card.bedCount - 1)}
              className={cn('px-1.5 py-1', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Minus size={11} /></button>
            <span className={cn('px-2 text-sm font-bold min-w-[28px] text-center',
              dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900')}>{card.bedCount}</span>
            <button onClick={() => patchBedCount(card.bedCount + 1)}
              className={cn('px-1.5 py-1', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Plus size={11} /></button>
          </div>
        )}
        {/* Nights + Beds badge */}
        <span className={cn('text-xs font-bold px-2 py-1 rounded-md shrink-0 tabular-nums',
          dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600')}>
          {nights}N·{beds}B
        </span>

        {/* RIGHT: total + price btn + calendar + delete */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className={cn('text-sm font-black tabular-nums', bruttoNettoActive ? (dk ? 'text-slate-600' : 'text-slate-300') : (dk ? 'text-white' : 'text-slate-900'))}>
            {bruttoNettoActive ? '—' : formatCurrency(total)}
          </span>
          {saving && <Loader2 size={12} className="animate-spin text-blue-400" />}
          <button
            onClick={() => { if (!bruttoNettoActive) setShowPricing(p => !p) }}
            disabled={bruttoNettoActive}
            title={bruttoNettoActive ? (lang === 'de' ? 'Deaktiviert — Brutto/Netto aktiv' : 'Disabled — Brutto/Netto active') : undefined}
            className={cn('px-2 py-1.5 rounded-lg text-xs font-bold border transition-all',
              bruttoNettoActive
                ? dk ? 'border-white/5 text-slate-700 cursor-not-allowed' : 'border-slate-100 text-slate-300 cursor-not-allowed'
                : showPricing
                  ? 'bg-amber-500 text-white border-amber-500'
                  : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            {lang === 'de' ? 'Preis' : 'Price'}{!bruttoNettoActive && (showPricing ? <ChevronUp size={10} className="inline ml-0.5" /> : <ChevronDown size={10} className="inline ml-0.5" />)}
          </button>
          <button
            onClick={() => setShowCalendar(c => !c)}
            className={cn('px-2 py-1.5 rounded-lg text-xs font-bold border transition-all',
              showCalendar
                ? 'bg-blue-600 text-white border-blue-600'
                : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >📅</button>
          <button
            onClick={() => setConfirm(true)}
            className="px-2 py-1.5 rounded-lg text-xs bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20"
          ><Trash2 size={11} /></button>
        </div>
      </div>

      {/* ── ROW 2 (Pricing panel) — only when Price btn clicked and not bruttoNettoActive ── */}
      {showPricing && !bruttoNettoActive && (
        <div className={cn('px-3 py-3 border-b space-y-3', dk ? 'border-white/8 bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60')}>
          <div className="flex items-end gap-2 flex-wrap">
            <button
              onClick={() => queueSave({ useBruttoNetto: !card.useBruttoNetto })}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
                card.useBruttoNetto
                  ? 'bg-amber-500 text-white border-amber-500'
                  : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              )}
            >Brutto/Netto</button>

            {!card.useBruttoNetto && (
              <>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>{lang === 'de' ? 'Preis/Nacht/Zimmer' : 'Price/night/room'}</label>
                  <input type="number" min={0} step="0.01"
                    value={card.nightlyPrice || ''}
                    onChange={e => queueSave({ nightlyPrice: normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-28')} />
                </div>
                {isWG && (
                  <div className="flex flex-col gap-0.5">
                    <label className={labelCls}>{lang === 'de' ? 'Preis/Bett/Nacht' : 'Price/bed/night'}</label>
                    <input type="number" min={0} step="0.01"
                      value={card.pricePerBedAmount || ''}
                      placeholder="25.00"
                      onChange={e => {
                        const v = normalizeNumberInput(e.target.value)
                        queueSave({ pricePerBed: v > 0, pricePerBedAmount: v, nightlyPrice: v * beds })
                      }}
                      className={cn(inputCls, 'w-28')} />
                    {card.pricePerBedAmount > 0 && (
                      <span className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
                        = {formatCurrency(card.pricePerBedAmount * beds)}/room
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            {card.useBruttoNetto && (
              <div className="flex items-end gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>Brutto (€)</label>
                  <input type="number" min={0} step="0.01"
                    value={card.brutto ?? ''} placeholder="Brutto"
                    onChange={e => queueSave({ brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-24')} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>Netto (€)</label>
                  <input type="number" min={0} step="0.01"
                    value={card.netto ?? ''} placeholder="Netto"
                    onChange={e => queueSave({ netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-24')} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={labelCls}>MwSt (%)</label>
                  <input type="number" min={0} max={99} step="1"
                    value={card.mwst ?? ''} placeholder="%"
                    onChange={e => queueSave({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls)}
                    style={{ width: 42 }} />
                </div>
                <div className={cn('self-end px-2.5 py-1.5 rounded-lg border text-xs font-bold',
                  dk ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white')}>
                  {derivedBrutto != null && card.netto && !card.brutto && (
                    <span className={dk ? 'text-amber-400' : 'text-amber-600'}>→ {formatCurrency(derivedBrutto)}</span>
                  )}
                  {derivedNetto != null && card.brutto && (
                    <span className={dk ? 'text-green-400' : 'text-green-700'}>→ {formatCurrency(derivedNetto)}</span>
                  )}
                  {!derivedBrutto && !derivedNetto && <span className={dk ? 'text-slate-500' : 'text-slate-400'}>—</span>}
                </div>
              </div>
            )}

            <button
              onClick={() => queueSave({ hasDiscount: !card.hasDiscount })}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all self-end',
                card.hasDiscount ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <Tag size={10} />{lang === 'de' ? 'Rabatt' : 'Disc.'}
            </button>
            {card.hasDiscount && (
              <div className="flex items-end gap-1 self-end">
                <button
                  onClick={() => queueSave({ discountType: card.discountType === 'percentage' ? 'fixed' : 'percentage' })}
                  className={cn(
                    'px-2.5 py-1.5 rounded-l-lg rounded-r-none border-y border-l text-xs font-bold transition-all',
                    dk ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                       : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {card.discountType === 'percentage' ? '%' : '€'}
                </button>
                <input
                  type="number" min={0}
                  value={card.discountValue || ''}
                  placeholder={card.discountType === 'percentage' ? '10' : '50'}
                  onChange={e => queueSave({ discountValue: normalizeNumberInput(e.target.value) })}
                  className={cn(
                    'px-2.5 py-1.5 rounded-r-lg rounded-l-none border-y border-r text-xs outline-none w-20',
                    dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                  )}
                />
              </div>
            )}

            {allCardsOfSameType.length > 1 && (
              <button
                onClick={() => onApplyToSameType(card)}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all self-end',
                  dk ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-blue-400' : 'border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                )}
              >
                <Copy size={10} />
                {lang === 'de' ? `Alle ${card.roomType}` : `All ${card.roomType}`}
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
            {card.useManualPrices ? (lang === 'de' ? 'Manual AN' : 'Manual ON') : (lang === 'de' ? 'Manuelle Nachtpreise' : 'Manual nightly')}
          </button>
        </div>
      )}

      {/* ── Bed slots ── */}
      <div className="px-3 py-2.5 space-y-1.5">
        {Array.from({ length: beds }).map((_, i) => {
          const emp = employees.find(e => (e.slotIndex ?? 0) === i) ?? null
          const slotGaps = gapSlots.filter(g => g.slotIndex === i)
          return (
            <React.Fragment key={i}>
              <BedSlot
                slotIndex={i} employee={emp}
                durationStart={durationStart} durationEnd={durationEnd}
                roomCardId={card.id} durationId={card.durationId}
                dk={dk} lang={lang} onUpdated={onEmployeeUpdated}
              />
              {slotGaps.map((gap, gi) => (
                <BedSlot
                  key={`gap-${i}-${gi}`} slotIndex={i} employee={null}
                  durationStart={durationStart} durationEnd={durationEnd}
                  gapStart={gap.gapStart} gapEnd={gap.gapEnd}
                  roomCardId={card.id} durationId={card.durationId}
                  dk={dk} lang={lang} onUpdated={onEmployeeUpdated}
                />
              ))}
            </React.Fragment>
          )
        })}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-sm rounded-2xl border p-5',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
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
