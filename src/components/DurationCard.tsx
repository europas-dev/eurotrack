import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, ChevronDown, ChevronUp,
  Loader2, Minus, Plus, Tag, Trash2, Check, PlusCircle, X,
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, normalizeNumberInput, formatDateDMY,
} from '../lib/utils'
import { calcRoomCardTotal, calcPricePerBedPerNight, extractPricingFields } from '../lib/roomCardUtils'
import { deleteDuration, updateDuration } from '../lib/supabase'
import {
  createRoomCard, deleteRoomCard, getRoomCardsForDuration,
} from '../lib/supabaseRoomCards'
import type { Duration, ExtraCost, RoomCard } from '../lib/types'
import RoomCardComponent from './RoomCard'

interface Props {
  duration: Duration
  isDarkMode: boolean
  lang?: 'de' | 'en'
  onUpdate: (id: string, updated: any) => void
  onDelete: (id: string) => void
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const ROOM_TYPES = ['EZ', 'DZ', 'TZ', 'WG'] as const

export default function DurationCard({
  duration, isDarkMode, lang = 'de', onUpdate, onDelete,
}: Props) {
  const dk = isDarkMode
  const [local, setLocal]           = useState<Duration>(duration)
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirm] = useState(false)
  const [roomCards, setRoomCards]   = useState<RoomCard[]>(duration.roomCards ?? [])
  const [loadingCards, setLoadingCards] = useState(false)
  const [addingType, setAddingType] = useState<string | null>(null)
  const [checkoutOffset, setCheckoutOffset] = useState<number | null>(null)
  const saveTimer = useRef<any>(null)

  useEffect(() => {
    setLocal(duration)
    if (!duration.roomCards?.length) {
      setLoadingCards(true)
      getRoomCardsForDuration(duration.id)
        .then(setRoomCards).catch(console.error).finally(() => setLoadingCards(false))
    } else {
      setRoomCards(duration.roomCards)
    }
  }, [duration])

  const nights   = calculateNights(local.startDate, local.endDate)
  const hasDates = !!(local.startDate && local.endDate && nights > 0)

  // Aggregate totals from room cards
  const roomCardsTotal = roomCards.reduce(
    (s, c) => s + calcRoomCardTotal(c, local.startDate, local.endDate), 0
  )
  const totalBeds = hasDates ? roomCards.reduce(
    (s, c) => s + (c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2)),
    0
  ) : 0
  const assignedBeds = hasDates ? roomCards.reduce(
    (s, c) => s + (c.employees?.length ?? 0), 0
  ) : 0
  const freeBeds = totalBeds - assignedBeds

  const stdPricePerBed = hasDates && totalBeds > 0 && nights > 0
    ? roomCardsTotal / nights / totalBeds
    : 0

  const extraCosts: ExtraCost[] = local.extraCosts ?? []
  const extraTotal = extraCosts.reduce((s, e) => s + (e.amount || 0), 0)

  // ── Grand total calculation ──────────────────────────────────────────────
  // When useBruttoNetto is ON:
  //   - Total comes ONLY from the brutto/netto inputs here — room card prices are ignored
  //   - On first activation (brutto/netto/mwst all null) → total is exactly 0
  //   - extraCosts are also excluded in brutto/netto mode
  //   - Deposit is NEVER deducted — it is a display note only
  // When useBruttoNetto is OFF:
  //   - Total = roomCardsTotal + extraTotal (with optional discount)
  let bruttoBase: number
  if (local.useBruttoNetto) {
    if (local.brutto != null && local.brutto > 0) {
      bruttoBase = local.brutto
    } else if (local.netto != null && local.netto > 0 && local.mwst != null) {
      bruttoBase = local.netto * (1 + local.mwst / 100)
    } else {
      bruttoBase = 0
    }
  } else {
    bruttoBase = roomCardsTotal + extraTotal
  }

  let discountedTotal = bruttoBase
  if (!local.useBruttoNetto && local.hasDiscount && local.discountValue) {
    discountedTotal = local.discountType === 'fixed'
      ? bruttoBase - local.discountValue
      : bruttoBase * (1 - local.discountValue / 100)
  }
  const displayTotal = Math.max(0, discountedTotal)

  const inputCls = cn(
    'px-2.5 py-1.5 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  )
  const labelCls = cn('text-[9px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')
  const togOff = cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
    dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  )
  const togOn = (color: string) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all bg-${color}-600 text-white border-${color}-600`

  function queueSave(next: Duration) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await updateDuration(local.id, next); onUpdate(local.id, next) }
      catch (e) { console.error(e) }
      finally { setSaving(false) }
    }, 400)
  }
  function patch(changes: Partial<Duration>) {
    const next = { ...local, ...changes } as Duration
    setLocal(next); queueSave(next)
  }

  function applyPreset(days: number, delta = 0) {
    if (!local.startDate) return
    const d = days + delta
    setCheckoutOffset(d)
    patch({ endDate: addDays(local.startDate, d) })
  }

  function addExtraCost() {
    const next: ExtraCost[] = [...extraCosts, { id: uid(), note: '', amount: 0 }]
    patch({ extraCosts: next })
  }
  function patchExtraCost(id: string, changes: Partial<ExtraCost>) {
    const next = extraCosts.map(e => e.id === id ? { ...e, ...changes } : e)
    patch({ extraCosts: next })
  }
  function removeExtraCost(id: string) {
    patch({ extraCosts: extraCosts.filter(e => e.id !== id) })
  }

  const typeCount: Record<string, number> = {}
  roomCards.forEach(c => { typeCount[c.roomType] = (typeCount[c.roomType] ?? 0) + 1 })

  async function handleAddRoomCard(roomType: string) {
    if (!hasDates) return
    setAddingType(roomType)
    try {
      const bedCount = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 2
      const card = await createRoomCard(local.id, roomType, bedCount, roomCards.length)
      setRoomCards(prev => [...prev, card])
    } catch (e) { console.error(e) }
    finally { setAddingType(null) }
  }
  async function handleRemoveLastOfType(roomType: string) {
    const cards = roomCards.filter(c => c.roomType === roomType)
    if (!cards.length) return
    const last = cards[cards.length - 1]
    try {
      await deleteRoomCard(last.id)
      setRoomCards(prev => prev.filter(c => c.id !== last.id))
    } catch (e) { console.error(e) }
  }
  function handleCardUpdate(id: string, p: Partial<RoomCard>) {
    setRoomCards(prev => prev.map(c => c.id === id ? { ...c, ...p } : c))
  }
  function handleCardDelete(id: string) {
    setRoomCards(prev => prev.filter(c => c.id !== id))
  }
  function handleApplyToSameType(source: RoomCard) {
    const pricingFields = extractPricingFields(source)
    setRoomCards(prev => prev.map(c => {
      if (c.id === source.id || c.roomType !== source.roomType) return c
      import('../lib/supabaseRoomCards').then(({ updateRoomCard }) =>
        updateRoomCard(c.id, pricingFields).catch(console.error)
      )
      return { ...c, ...pricingFields }
    }))
  }

  // Toggle brutto/netto mode:
  // ON  → clear brutto/netto/mwst so total immediately shows €0,00
  //        all room-card price inputs are disabled via bruttoNettoActive prop
  // OFF → restore room-card-based totals
  function toggleBruttoNetto() {
    if (!local.useBruttoNetto) {
      patch({ useBruttoNetto: true, brutto: null, netto: null, mwst: null })
    } else {
      patch({ useBruttoNetto: false })
    }
  }

  return (
    <div className={cn('rounded-2xl border', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      <div className="flex gap-3 p-4 flex-wrap items-start">

        {/* Left: dates + room chips */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">

          {/* ROW 1: dates + presets + nights + stats + trash */}
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Check-in' : 'Check-in'}</label>
              <div className="relative">
                <input
                  type="date"
                  value={local.startDate || ''}
                  onChange={e => patch({ startDate: e.target.value })}
                  className={cn(inputCls, 'w-36')}
                />
                {!local.startDate && (
                  <span className={cn(
                    'absolute inset-0 flex items-center px-2.5 text-sm pointer-events-none',
                    dk ? 'text-slate-600' : 'text-slate-400'
                  )}>dd/mm/yyyy</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Check-out' : 'Check-out'}</label>
              <div className="relative">
                <input
                  type="date"
                  value={local.endDate || ''}
                  min={local.startDate || undefined}
                  onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }}
                  className={cn(inputCls, 'w-36')}
                />
                {!local.endDate && (
                  <span className={cn(
                    'absolute inset-0 flex items-center px-2.5 text-sm pointer-events-none',
                    dk ? 'text-slate-600' : 'text-slate-400'
                  )}>dd/mm/yyyy</span>
                )}
              </div>
            </div>
            {local.startDate && (
              <div className="flex items-center gap-1 self-end pb-0.5">
                {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                  <div key={p.label} className="flex items-center gap-0.5">
                    <button onClick={() => applyPreset(p.days, -1)}
                      className={cn('px-1.5 py-1.5 rounded text-xs border', dk ? 'border-white/10 text-slate-500 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>−</button>
                    <button onClick={() => applyPreset(p.days)}
                      className={cn('px-2 py-1.5 rounded text-xs font-bold border transition-all',
                        checkoutOffset === p.days ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}>{p.label}</button>
                    <button onClick={() => applyPreset(p.days, 1)}
                      className={cn('px-1.5 py-1.5 rounded text-xs border', dk ? 'border-white/10 text-slate-500 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>+</button>
                  </div>
                ))}
              </div>
            )}
            {hasDates && (
              <div className={cn('self-end px-3 py-1.5 rounded-lg border text-sm font-black shrink-0',
                dk ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-900')}>{nights}N</div>
            )}
            {hasDates && roomCards.length > 0 && (
              <div className="self-end pb-0.5 flex items-center gap-1 text-sm font-bold">
                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>{roomCards.length} {lang === 'de' ? 'Zi.' : 'rooms'}</span>
                <span className={dk ? 'text-slate-600' : 'text-slate-300'}>·</span>
                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>{totalBeds}B</span>
                {freeBeds > 0 && (<><span className={dk ? 'text-slate-600' : 'text-slate-300'}>·</span><span className="text-red-500 font-bold">{freeBeds} {lang === 'de' ? 'frei' : 'free'}</span></>)}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2 self-end">
              {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
              <button onClick={() => setConfirm(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* ROW 2: Invoice + Booking ref */}
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice No.'}</label>
              <input type="text" value={local.rechnungNr || ''}
                onChange={e => patch({ rechnungNr: e.target.value })}
                placeholder="RE-2026-..."
                className={cn(inputCls, 'w-36')} />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Buchungsreferenz / Notiz' : 'Booking ref / note'}</label>
              <input type="text" value={local.bookingId || ''}
                onChange={e => patch({ bookingId: e.target.value })}
                placeholder={lang === 'de' ? 'Referenz / Notiz...' : 'Reference / note...'}
                className={cn(inputCls, 'w-48')} />
            </div>
          </div>

          {/* ROW 3: Room type chips */}
          {hasDates && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>{lang === 'de' ? 'Zimmer:' : 'Rooms:'}</span>
              {ROOM_TYPES.map(rt => (
                <div key={rt} className="flex items-center">
                  {(typeCount[rt] ?? 0) > 0 && (
                    <button onClick={() => handleRemoveLastOfType(rt)}
                      className={cn('px-1.5 py-1 rounded-l-full text-xs font-bold border-y border-l transition-all',
                        dk ? 'border-white/10 text-slate-400 hover:bg-red-900/20 hover:text-red-400' : 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500'
                      )}><Minus size={10} /></button>
                  )}
                  <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType}
                    className={cn('flex items-center gap-1 px-2.5 py-1 text-xs font-bold border transition-all',
                      (typeCount[rt] ?? 0) > 0 ? 'rounded-none border-x-0' : 'rounded-full',
                      (typeCount[rt] ?? 0) > 0
                        ? dk ? 'border-y border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-y border-blue-400 bg-blue-50 text-blue-600'
                        : dk ? 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                    )}>
                    {addingType === rt ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                    {rt}
                    {(typeCount[rt] ?? 0) > 0 && (
                      <span className={cn('px-1 rounded-full text-[10px] font-black',
                        dk ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700')}>{typeCount[rt]}</span>
                    )}
                  </button>
                  {(typeCount[rt] ?? 0) > 0 && (
                    <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType}
                      className={cn('px-1.5 py-1 rounded-r-full text-xs font-bold border-y border-r transition-all',
                        dk ? 'border-white/10 text-slate-400 hover:bg-blue-900/20 hover:text-blue-400' : 'border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-500'
                      )}><Plus size={10} /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!hasDates && (
            <div className={cn('text-xs text-center py-3 rounded-xl border-2 border-dashed',
              dk ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400')}>
              📅 {lang === 'de' ? 'Check-in und Check-out eingeben, um Zimmer hinzuzufügen' : 'Enter check-in and check-out to add rooms'}
            </div>
          )}
        </div>

        {/* ── Right: Total Cost Card ── */}
        {hasDates && (
          <div className={cn(
            'w-72 shrink-0 rounded-xl border p-3 flex flex-col gap-0',
            dk ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
          )}>

            {/* ── ROW 1: Brutto/Netto toggle ── */}
            {/* When ON: total comes only from these inputs (starts at €0); all room-card prices disabled */}
            <div className="flex items-center gap-1.5 min-h-[36px]">
              <button
                onClick={toggleBruttoNetto}
                className={cn(
                  'shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap',
                  local.useBruttoNetto
                    ? 'bg-amber-500 text-white border-amber-500'
                    : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                )}
              >Brutto / Netto</button>

              {local.useBruttoNetto && (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {/* Brutto — entering this clears netto */}
                  <div className="flex flex-col gap-0 flex-1 min-w-0">
                    <span className={cn('text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5', dk ? 'text-slate-600' : 'text-slate-400')}>Brutto €</span>
                    <input
                      type="number" min={0} step="0.01"
                      value={local.brutto ?? ''}
                      placeholder="0"
                      onChange={e => {
                        const val = e.target.value === '' ? null : normalizeNumberInput(e.target.value)
                        patch({ brutto: val, netto: null })
                      }}
                      className={cn(
                        'px-1.5 py-1 rounded-lg text-xs outline-none border transition-all w-full',
                        dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
                           : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                      )}
                    />
                  </div>
                  {/* Netto — entering this clears brutto */}
                  <div className="flex flex-col gap-0 flex-1 min-w-0">
                    <span className={cn('text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5', dk ? 'text-slate-600' : 'text-slate-400')}>Netto €</span>
                    <input
                      type="number" min={0} step="0.01"
                      value={local.netto ?? ''}
                      placeholder="0"
                      onChange={e => {
                        const val = e.target.value === '' ? null : normalizeNumberInput(e.target.value)
                        patch({ netto: val, brutto: null })
                      }}
                      className={cn(
                        'px-1.5 py-1 rounded-lg text-xs outline-none border transition-all w-full',
                        dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
                           : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                      )}
                    />
                  </div>
                  {/* MwSt */}
                  <div className="flex flex-col gap-0 shrink-0">
                    <span className={cn('text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5', dk ? 'text-slate-600' : 'text-slate-400')}>MwSt %</span>
                    <input
                      type="number" min={0} max={99} step="1"
                      value={local.mwst ?? ''}
                      placeholder="%"
                      onChange={e => patch({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                      className={cn(
                        'px-1.5 py-1 rounded-lg text-xs outline-none border transition-all',
                        dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
                           : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                      )}
                      style={{ width: 40 }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={cn('my-1.5 border-t', dk ? 'border-white/[0.06]' : 'border-slate-100')} />

            {/* ── ROW 2: Discount | Deposit (note only — never deducted) ── */}
            <div className="flex items-center gap-1.5 min-h-[36px] flex-wrap">
              {/* Discount — only shown when brutto/netto mode is OFF */}
              {!local.useBruttoNetto && (
                <>
                  <button onClick={() => patch({ hasDiscount: !local.hasDiscount })}
                    className={cn('shrink-0 flex items-center gap-1', local.hasDiscount ? togOn('blue') : togOff)}>
                    <Tag size={10} />{lang === 'de' ? 'Rabatt' : 'Disc.'}
                  </button>
                  {local.hasDiscount && (
                    <div className="flex items-center">
                      <button
                        onClick={() => patch({ discountType: local.discountType === 'percentage' ? 'fixed' : 'percentage' })}
                        className={cn('px-2 py-1.5 rounded-l-lg rounded-r-none border text-xs font-bold border-r-0',
                          dk ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                        {local.discountType === 'percentage' ? '%' : '€'}
                      </button>
                      <input type="number" min={0} value={local.discountValue || ''}
                        placeholder={local.discountType === 'percentage' ? '10' : '50'}
                        onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
                        className={cn('px-2 py-1.5 rounded-r-lg rounded-l-none border text-xs outline-none',
                          dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}
                        style={{ width: 52 }} />
                    </div>
                  )}
                  <span className={cn('text-xs', dk ? 'text-slate-700' : 'text-slate-300')}>·</span>
                </>
              )}

              {/* Deposit — note only, NEVER deducted from total */}
              <button onClick={() => patch({ depositEnabled: !local.depositEnabled })}
                className={cn('shrink-0 flex items-center gap-1', local.depositEnabled ? togOn('purple') : togOff)}>
                {lang === 'de' ? 'Kaution' : 'Deposit'}
              </button>
              {local.depositEnabled && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min={0} step="0.01"
                    value={local.depositAmount ?? ''}
                    placeholder="€"
                    onChange={e => patch({ depositAmount: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn('px-2 py-1.5 rounded-lg border text-xs outline-none',
                      dk ? 'bg-white/5 border-purple-500/30 text-white placeholder-slate-600' : 'bg-white border-purple-300 text-slate-900 placeholder-slate-400')}
                    style={{ width: 64 }}
                  />
                  {/* Explicit badge: deposit is a note, not subtracted */}
                  <span className={cn(
                    'text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border',
                    dk ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : 'border-purple-200 text-purple-600 bg-purple-50'
                  )}>
                    {lang === 'de' ? 'Nur Notiz' : 'Note only'}
                  </span>
                </div>
              )}
            </div>

            <div className={cn('my-1.5 border-t', dk ? 'border-white/[0.06]' : 'border-slate-100')} />

            {/* ── ROW 3: Extra costs (hidden in brutto/netto mode) ── */}
            {!local.useBruttoNetto && (
              <div className="flex flex-col gap-1 min-h-[32px]">
                <div className="flex items-center justify-between">
                  <span className={cn('text-[9px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Extrakosten' : 'Extra costs'}
                  </span>
                  <button onClick={addExtraCost}
                    className={cn('p-0.5 rounded transition-all', dk ? 'text-slate-500 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600')}>
                    <PlusCircle size={13} />
                  </button>
                </div>
                {extraCosts.map(ec => (
                  <div key={ec.id} className="flex items-center gap-1">
                    <input type="text" value={ec.note}
                      onChange={e => patchExtraCost(ec.id, { note: e.target.value })}
                      placeholder={lang === 'de' ? 'Notiz...' : 'Note...'}
                      className={cn(
                        'flex-1 min-w-0 px-2 py-1 rounded-lg text-xs outline-none border transition-all',
                        dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                      )} />
                    <input type="number" min={0} step="0.01" value={ec.amount || ''}
                      placeholder="€"
                      onChange={e => patchExtraCost(ec.id, { amount: normalizeNumberInput(e.target.value) })}
                      className={cn('px-2 py-1 rounded-lg text-xs outline-none border transition-all',
                        dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}
                      style={{ width: 64 }} />
                    <button onClick={() => removeExtraCost(ec.id)}
                      className={cn('p-1 rounded', dk ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50')}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {extraTotal > 0 && (
                  <div className="flex justify-between">
                    <span className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
                      {lang === 'de' ? 'Extrasumme' : 'Extra total'}
                    </span>
                    <span className={cn('text-[10px] font-bold', dk ? 'text-white' : 'text-slate-900')}>
                      +{formatCurrency(extraTotal)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className={cn('my-1.5 border-t', dk ? 'border-white/[0.06]' : 'border-slate-100')} />

            {/* ── ROW 4: Paid/Unpaid + Total ── */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => patch({ isPaid: !local.isPaid })}
                className={cn(
                  'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                  local.isPaid
                    ? 'bg-green-600 text-white border-green-600'
                    : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {local.isPaid && <Check size={11} />}
                {local.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
              </button>

              <div className="ml-auto flex flex-col items-end">
                <span className={cn('text-[9px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Gesamt' : 'Total'}
                  {!local.useBruttoNetto && local.hasDiscount && local.discountValue ? (
                    <span className={cn('ml-1', dk ? 'text-blue-400' : 'text-blue-600')}>
                      -{local.discountType === 'percentage' ? `${local.discountValue}%` : formatCurrency(local.discountValue)}
                    </span>
                  ) : null}
                </span>
                <span className={cn('text-2xl font-black leading-tight', dk ? 'text-white' : 'text-slate-900')}>
                  {formatCurrency(displayTotal)}
                </span>
                {stdPricePerBed > 0 && !local.useBruttoNetto && (
                  <span className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {formatCurrency(stdPricePerBed)}/bed/N
                  </span>
                )}
                {/* Deposit shown as info note below total — never subtracted */}
                {local.depositEnabled && local.depositAmount ? (
                  <span className={cn('text-[10px] mt-0.5', dk ? 'text-purple-400' : 'text-purple-600')}>
                    {lang === 'de'
                      ? `Kaution: ${formatCurrency(local.depositAmount)} (Notiz)`
                      : `Deposit: ${formatCurrency(local.depositAmount)} (note)`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ROOM CARDS */}
      {loadingCards && (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-blue-400" /></div>
      )}
      {!loadingCards && roomCards.length > 0 && (
        <div className={cn('border-t px-4 py-3', dk ? 'border-white/10' : 'border-slate-100')}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {roomCards.map(card => (
              <RoomCardComponent
                key={card.id} card={card}
                durationStart={local.startDate} durationEnd={local.endDate}
                dk={dk} lang={lang}
                allCardsOfSameType={roomCards.filter(c => c.roomType === card.roomType)}
                onUpdate={handleCardUpdate}
                onDelete={handleCardDelete}
                onApplyToSameType={handleApplyToSameType}
                bruttoNettoActive={local.useBruttoNetto}
              />
            ))}
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.' : 'This duration will be permanently deleted. This cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                onClick={async () => { await deleteDuration(local.id); onDelete(local.id) }}
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
