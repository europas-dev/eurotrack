// src/components/DurationCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, ChevronDown, ChevronUp, Copy, Loader2,
  Minus, Plus, Tag, Trash2, Check, PlusCircle, X,
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, normalizeNumberInput,
} from '../lib/utils'
import { calcRoomCardTotal } from '../lib/roomCardUtils'
import { deleteDuration, updateDuration } from '../lib/supabase'
import {
  createRoomCard, deleteRoomCard, getRoomCardsForDuration,
} from '../lib/supabaseRoomCards'
import type { Duration, ExtraCost, RoomCard } from '../lib/types'
import RoomCardComponent, { getEffectiveNetto } from './RoomCard'

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

  const extraCosts: ExtraCost[] = local.extraCosts ?? []
  const extraTotal = extraCosts.reduce((s, e) => s + (e.amount || 0), 0)

  let bruttoBase: number
  if (local.useBruttoNetto) {
    if (local.brutto != null && local.brutto > 0) {
      bruttoBase = local.brutto + extraTotal
    } else if (local.netto != null && local.netto > 0 && local.mwst != null) {
      bruttoBase = (local.netto * (1 + local.mwst / 100)) + extraTotal
    } else {
      bruttoBase = extraTotal
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

  // ── MATCH ROOM CARD NETTO LOGIC EXACTLY ──
  let totalNettoBase = 0;
  if (local.useBruttoNetto) {
    const b = local.brutto || 0;
    const m = local.mwst || 7;
    const n = local.netto || (b / (1 + m / 100));
    totalNettoBase = n;
  } else {
    totalNettoBase = roomCards.reduce((sum, c) => {
      const rcBrutto = calcRoomCardTotal(c, local.startDate, local.endDate);
      const m = c.roomMwst ?? c.bedMwst ?? c.totalMwst ?? 7;
      return sum + (rcBrutto / (1 + m / 100));
    }, 0);
  }
  const stdPricePerBedNetto = hasDates && totalBeds > 0 && nights > 0
    ? totalNettoBase / nights / totalBeds
    : 0;

  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  )
  const labelCls = cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')
  const togOff = cn('px-3 py-2 rounded-lg text-sm font-bold border transition-all',
    dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  )
  const togOn = (color: string) =>
    `px-3 py-2 rounded-lg text-sm font-bold border transition-all bg-${color}-600 text-white border-${color}-600`

  function queueSave(next: Duration) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await updateDuration(local.id, next); onUpdate(local.id, next) }
      catch (e) { console.error(e) }
      finally { setSaving(false) }
    }, 400)
  }
  function patch(changes: Partial<Duration>) {
    const next = { ...local, roomCards, ...changes } as Duration
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

  function syncRoomCardsToParent(newCards: RoomCard[]) {
    const nextLocal = { ...local, roomCards: newCards } as Duration;
    setLocal(nextLocal);
    onUpdate(local.id, nextLocal);
  }

  const typeCount: Record<string, number> = {}
  roomCards.forEach(c => { typeCount[c.roomType] = (typeCount[c.roomType] ?? 0) + 1 })

  async function handleAddRoomCard(roomType: string) {
    if (!hasDates) return
    setAddingType(roomType)
    try {
      const bedCount = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 2
      const card = await createRoomCard(local.id, roomType, bedCount, roomCards.length)
      setRoomCards(prev => { const n = [...prev, card]; syncRoomCardsToParent(n); return n; })
    } catch (e) { console.error(e) }
    finally { setAddingType(null) }
  }
  async function handleRemoveLastOfType(roomType: string) {
    const cards = roomCards.filter(c => c.roomType === roomType)
    if (!cards.length) return
    const last = cards[cards.length - 1]
    try {
      await deleteRoomCard(last.id)
      setRoomCards(prev => { const n = prev.filter(c => c.id !== last.id); syncRoomCardsToParent(n); return n; })
    } catch (e) { console.error(e) }
  }
  function handleCardUpdate(id: string, p: Partial<RoomCard>) {
    setRoomCards(prev => { const n = prev.map(c => c.id === id ? { ...c, ...p } : c); syncRoomCardsToParent(n); return n; })
  }
  function handleCardDelete(id: string) {
    setRoomCards(prev => { const n = prev.filter(c => c.id !== id); syncRoomCardsToParent(n); return n; })
  }
  function handleApplyToSameType(source: RoomCard) {
    const pricingFields = extractPricingFields(source)
    setRoomCards(prev => {
      const n = prev.map(c => {
        if (c.id === source.id || c.roomType !== source.roomType) return c
        import('../lib/supabaseRoomCards').then(({ updateRoomCard }) => updateRoomCard(c.id, pricingFields).catch(console.error))
        return { ...c, ...pricingFields }
      })
      syncRoomCardsToParent(n)
      return n
    })
  }

  function toggleBruttoNetto() {
    patch({ useBruttoNetto: !local.useBruttoNetto })
  }

  function forceDMY(isoString: string | null | undefined) {
    if (!isoString) return 'dd/mm/yyyy';
    const [y, m, d] = isoString.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <div className={cn('rounded-2xl border', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      <div className="flex gap-4 p-5 flex-wrap items-start">

        {/* ── Left Side: Core Controls ── */}
        <div className="flex flex-col gap-5 flex-1 min-w-[320px]">

          {/* ROW 1: Dates & Metrics */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 relative">
              <label className={labelCls}>{lang === 'de' ? 'Check-in' : 'Check-in'}</label>
              <div className="relative w-40 h-[38px]">
                <input type="date" value={local.startDate || ''}
                  onChange={e => patch({ startDate: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={cn(inputCls, 'absolute inset-0 flex items-center justify-between pointer-events-none')}>
                  <span className={local.startDate ? (dk ? 'text-white' : 'text-slate-900') : (dk ? 'text-slate-500' : 'text-slate-400')}>
                    {forceDMY(local.startDate)}
                  </span>
                  <CalendarDays size={16} className={dk ? 'text-slate-500' : 'text-slate-400'} />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-1 relative">
              <label className={labelCls}>{lang === 'de' ? 'Check-out' : 'Check-out'}</label>
              <div className="relative w-40 h-[38px]">
                <input type="date" value={local.endDate || ''} min={local.startDate || undefined}
                  onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={cn(inputCls, 'absolute inset-0 flex items-center justify-between pointer-events-none')}>
                  <span className={local.endDate ? (dk ? 'text-white' : 'text-slate-900') : (dk ? 'text-slate-500' : 'text-slate-400')}>
                    {forceDMY(local.endDate)}
                  </span>
                  <CalendarDays size={16} className={dk ? 'text-slate-500' : 'text-slate-400'} />
                </div>
              </div>
            </div>
            
            {local.startDate && (
              <div className="flex items-center gap-1.5 self-end pb-0.5">
                {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                  <div key={p.label} className="flex items-center">
                    <button onClick={() => applyPreset(p.days)}
                      className={cn('px-2.5 py-2 rounded-l-lg text-sm font-bold border transition-all',
                        checkoutOffset === p.days ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}>{p.label}</button>
                    <div className="flex flex-col">
                      <button onClick={() => applyPreset(p.days, 1)} className={cn('px-1.5 text-[9px] leading-[11px] py-0.5 border-y border-r rounded-tr-lg', dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>+</button>
                      <button onClick={() => applyPreset(p.days, -1)} className={cn('px-1.5 text-[9px] leading-[11px] py-0.5 border-b border-r rounded-br-lg', dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>−</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasDates && (
              <div className={cn('self-end flex items-center gap-3 px-4 py-2 rounded-xl border text-sm font-bold shrink-0 mb-0.5',
                dk ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}>
                <span className={cn('text-base font-black', dk ? 'text-white' : 'text-slate-900')}>{nights}N</span>
                {roomCards.length > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{roomCards.length} {lang === 'de' ? 'Zi.' : 'rooms'}</span>
                    <span className="opacity-40">·</span>
                    <span>{totalBeds}B</span>
                    <span className="opacity-40">·</span>
                    {freeBeds > 0 ? (
                      <span className="text-red-500">{freeBeds} {lang === 'de' ? 'frei' : 'free'}</span>
                    ) : (
                      <span className="text-green-500">{lang === 'de' ? 'Ausgebucht' : 'Fully booked'}</span>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2 self-end pb-0.5">
              {saving && <Loader2 size={16} className="animate-spin text-blue-400" />}
              <button onClick={() => setConfirm(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* ROW 2: References & Rooms */}
          <div className="flex items-end gap-5 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice No.'}</label>
              <input type="text" value={local.rechnungNr || ''}
                onChange={e => patch({ rechnungNr: e.target.value })}
                placeholder="RE-2026-..."
                className={cn(inputCls, 'w-36')} />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className={labelCls}>{lang === 'de' ? 'Buchungsreferenz / Notiz' : 'Booking ref / note'}</label>
              <input type="text" value={local.bookingId || ''}
                onChange={e => patch({ bookingId: e.target.value })}
                placeholder={lang === 'de' ? 'Referenz / Notiz...' : 'Reference / note...'}
                className={cn(inputCls, 'w-56')} />
            </div>

            {hasDates && (
              <div className="flex flex-col gap-1">
                <label className={labelCls}>{lang === 'de' ? 'Zimmer hinzufügen' : 'Add Rooms'}</label>
                <div className="flex items-center">
                  {ROOM_TYPES.map(rt => (
                    <div key={rt} className="flex items-center">
                      {(typeCount[rt] ?? 0) > 0 && (
                        <button onClick={() => handleRemoveLastOfType(rt)}
                          className={cn('px-2 py-2 rounded-l-full text-sm font-bold border-y border-l transition-all',
                            dk ? 'border-white/10 text-slate-400 hover:bg-red-900/20 hover:text-red-400' : 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500'
                          )}><Minus size={12} /></button>
                      )}
                      <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType}
                        className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-bold border transition-all',
                          (typeCount[rt] ?? 0) > 0 ? 'rounded-none border-x-0' : 'rounded-full',
                          (typeCount[rt] ?? 0) > 0
                            ? dk ? 'border-y border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-y border-blue-400 bg-blue-50 text-blue-600'
                            : dk ? 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                        )}>
                        {addingType === rt ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {rt}
                        {(typeCount[rt] ?? 0) > 0 && (
                          <span className={cn('px-2 rounded-full text-xs font-black',
                            dk ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700')}>{typeCount[rt]}</span>
                        )}
                      </button>
                      {(typeCount[rt] ?? 0) > 0 && (
                        <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType}
                          className={cn('px-2 py-2 rounded-r-full text-sm font-bold border-y border-r transition-all',
                            dk ? 'border-white/10 text-slate-400 hover:bg-blue-900/20 hover:text-blue-400' : 'border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-500'
                          )}><Plus size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!hasDates && (
            <div className={cn('text-sm text-center py-4 mt-5 rounded-xl border-2 border-dashed',
              dk ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400')}>
              📅 {lang === 'de' ? 'Check-in und Check-out eingeben, um Zimmer hinzuzufügen' : 'Enter check-in and check-out to add rooms'}
            </div>
          )}
        </div>

        {/* ── Right Side: Expanded Pricing Card (flex-1 dynamically fills space) ── */}
        {hasDates && (
          <div className={cn(
            'flex-1 min-w-[400px] shrink-0 rounded-2xl border p-5 flex flex-col gap-0',
            dk ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
          )}>
            
            {/* ROW 1: Brutto / Netto Inputs */}
            <div className="flex items-center gap-3">
              <button onClick={toggleBruttoNetto}
                className={cn('shrink-0 px-4 py-2.5 rounded-lg text-sm font-bold border transition-all whitespace-nowrap',
                  local.useBruttoNetto ? 'bg-amber-500 text-white border-amber-500' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                )}
              >Brutto / Netto</button>

              {local.useBruttoNetto && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className={labelCls}>Netto €</span>
                    <input type="number" min={0} step="0.01" value={local.netto ?? ''} placeholder="0"
                      onChange={e => patch({ netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value), brutto: null })}
                      className={cn(inputCls, 'w-full')} />
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className={labelCls}>MwSt %</span>
                    <input type="number" min={0} max={99} step="1" value={local.mwst ?? ''} placeholder="%"
                      onChange={e => patch({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                      className={cn(inputCls, 'w-16')} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className={labelCls}>Brutto €</span>
                    <input type="number" min={0} step="0.01" value={local.brutto ?? ''} placeholder="0"
                      onChange={e => patch({ brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value), netto: null })}
                      className={cn(inputCls, 'w-full')} />
                  </div>
                </div>
              )}
            </div>

            {/* ROW 2: Toggles (Discount + Extra Cost mapped inline) */}
            {!local.useBruttoNetto && (
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                <div className="flex items-center">
                  <button onClick={() => patch({ hasDiscount: !local.hasDiscount })}
                    className={cn('shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-all',
                      local.hasDiscount ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}>
                    <Tag size={12} />{lang === 'de' ? 'Rabatt' : 'Disc.'}
                  </button>
                  {local.hasDiscount && (
                    <div className="flex items-center ml-2">
                      <button onClick={() => patch({ discountType: local.discountType === 'percentage' ? 'fixed' : 'percentage' })}
                        className={cn('px-3 py-2 rounded-l-lg rounded-r-none border text-sm font-bold border-r-0', dk ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-700')}>
                        {local.discountType === 'percentage' ? '%' : '€'}
                      </button>
                      <input type="number" min={0} value={local.discountValue || ''}
                        onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
                        className={cn('px-3 py-2 rounded-r-lg rounded-l-none border text-sm outline-none w-20', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} />
                    </div>
                  )}
                </div>

                <button onClick={addExtraCost} className={cn('px-3 py-2 rounded-lg text-sm font-bold border flex items-center gap-1.5 transition-all',
                  dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  <PlusCircle size={14} /> {lang === 'de' ? 'Extrakosten' : 'Extra Cost'}
                </button>
              </div>
            )}

            {/* Render Extra Costs directly beneath */}
            {extraCosts.length > 0 && !local.useBruttoNetto && (
              <div className="flex flex-col gap-2 mt-3">
                {extraCosts.map(ec => (
                  <div key={ec.id} className="flex items-center gap-2">
                    <input type="text" value={ec.note} onChange={e => patchExtraCost(ec.id, { note: e.target.value })}
                      placeholder={lang === 'de' ? 'Notiz...' : 'Note...'}
                      className={cn('w-40 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none border', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} />
                    <input type="number" min={0} step="0.01" value={ec.amount || ''} placeholder="€"
                      onChange={e => patchExtraCost(ec.id, { amount: normalizeNumberInput(e.target.value) })}
                      className={cn('w-24 px-3 py-1.5 rounded-lg text-sm outline-none border', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} />
                    <button onClick={() => removeExtraCost(ec.id)} className={cn('p-1.5 rounded', dk ? 'text-red-400 hover:bg-red-400/10' : 'text-red-500 hover:bg-red-50')}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className={cn('my-4 border-t', dk ? 'border-white/[0.06]' : 'border-slate-100')} />

            {/* ROW 4: Paid | Deposit | Total */}
            <div className="flex items-center gap-4">
              <button onClick={() => patch({ isPaid: !local.isPaid })}
                className={cn('shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold border transition-all',
                  local.isPaid ? 'bg-green-600 text-white border-green-600' : dk ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
                )}>
                {local.isPaid && <Check size={16} />}
                {local.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
              </button>

              <div className="flex items-center gap-2">
                <button onClick={() => patch({ depositEnabled: !local.depositEnabled })}
                  className={cn('shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold border transition-all',
                    local.depositEnabled ? 'bg-purple-600 text-white border-purple-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}>
                  {lang === 'de' ? 'Kaution' : 'Deposit'}
                </button>
                {local.depositEnabled && (
                  <input type="number" min={0} step="0.01" value={local.depositAmount ?? ''} placeholder="€"
                    onChange={e => patch({ depositAmount: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn('px-3 py-2.5 rounded-xl border text-sm outline-none w-24', dk ? 'bg-white/5 border-purple-500/30 text-white' : 'bg-white border-purple-300 text-slate-900')} />
                )}
              </div>

              <div className="ml-auto flex flex-col items-end">
                <span className={labelCls}>{lang === 'de' ? 'Gesamt' : 'Total'}</span>
                <span className={cn('text-4xl font-black leading-none mt-1', dk ? 'text-white' : 'text-slate-900')}>
                  {formatCurrency(displayTotal)}
                </span>
                {stdPricePerBedNetto > 0 && (
                  <span className={cn('text-xs mt-2 font-bold', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {formatCurrency(stdPricePerBedNetto)} netto/bed/N
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ROOM CARDS */}
      {loadingCards && (
        <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
      )}
      {!loadingCards && roomCards.length > 0 && (
        <div className={cn('border-t px-5 py-4', dk ? 'border-white/10' : 'border-slate-100')}>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
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

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-6',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-3">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-base mb-6', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.' : 'This duration will be permanently deleted. This cannot be undone.'}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirm(false)}
                className={cn('px-5 py-2.5 rounded-xl border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                onClick={async () => { await deleteDuration(local.id); onDelete(local.id) }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
