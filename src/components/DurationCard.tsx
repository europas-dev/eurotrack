import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, ChevronDown, ChevronUp,
  Loader2, Minus, Plus, Tag, Trash2,
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, normalizeNumberInput,
} from '../lib/utils'
import { calcRoomCardTotal } from '../lib/roomCardUtils'
import { deleteDuration, updateDuration } from '../lib/supabase'
import {
  createRoomCard, deleteRoomCard, getRoomCardsForDuration,
} from '../lib/supabaseRoomCards'
import type { Duration, RoomCard } from '../lib/types'
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

  // ── Aggregate totals from room cards ──────────────────────────────────────
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

  // grand total: override if duration-level brutto set, otherwise sum cards
  const grandTotal = local.useBruttoNetto && local.brutto
    ? local.brutto
    : local.useBruttoNetto && local.netto && local.mwst
    ? local.netto * (1 + local.mwst / 100)
    : roomCardsTotal

  // Discount on grand total
  let discountedTotal = grandTotal
  if (local.hasDiscount && local.discountValue) {
    discountedTotal = local.discountType === 'fixed'
      ? grandTotal - local.discountValue
      : grandTotal * (1 - local.discountValue / 100)
  }
  const displayTotal = Math.max(0, discountedTotal)

  const inputCls = cn(
    'px-2.5 py-1.5 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  )
  const labelCls = cn('text-[9px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')

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

  // ── Type chip counts ──────────────────────────────────────────────────────
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
    const pricingFields = {
      nightlyPrice: source.nightlyPrice, pricePerBed: source.pricePerBed,
      pricePerBedAmount: source.pricePerBedAmount, useBruttoNetto: source.useBruttoNetto,
      brutto: source.brutto, netto: source.netto, mwst: source.mwst,
      hasDiscount: source.hasDiscount, discountType: source.discountType,
      discountValue: source.discountValue,
    }
    setRoomCards(prev => prev.map(c => {
      if (c.id === source.id || c.roomType !== source.roomType) return c
      import('../lib/supabaseRoomCards').then(({ updateRoomCard }) =>
        updateRoomCard(c.id, pricingFields).catch(console.error)
      )
      return { ...c, ...pricingFields }
    }))
  }

  const togOn  = (color: string) => `px-3 py-2 rounded-lg text-xs font-bold border transition-all bg-${color}-600 text-white border-${color}-600`
  const togOff = cn(
    'px-3 py-2 rounded-lg text-xs font-bold border transition-all',
    dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  )

  return (
    <div className={cn('rounded-2xl border', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      {/* ══ TOP SECTION ══ */}
      <div className="flex gap-3 p-4 flex-wrap items-start">

        {/* ── Left: date + stats in one row ── */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">

          {/* ─── ROW 1: Check-in | Check-out | Presets | Nights | rooms·beds·free | trash ─── */}
          <div className="flex items-end gap-2 flex-wrap">
            {/* Check-in */}
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Check-in' : 'Check-in'}</label>
              <input type="date"
                value={local.startDate || ''}
                onChange={e => patch({ startDate: e.target.value })}
                className={cn(inputCls, 'w-36')}
              />
            </div>

            {/* Check-out */}
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Check-out' : 'Check-out'}</label>
              <input type="date"
                value={local.endDate || ''}
                min={local.startDate || undefined}
                onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }}
                className={cn(inputCls, 'w-36')}
              />
            </div>

            {/* Quick presets */}
            {local.startDate && (
              <div className="flex items-center gap-1 self-end pb-0.5">
                {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                  <div key={p.label} className="flex items-center gap-0.5">
                    <button
                      onClick={() => applyPreset(p.days, -1)}
                      className={cn('px-1.5 py-1.5 rounded text-xs border', dk ? 'border-white/10 text-slate-500 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>−</button>
                    <button
                      onClick={() => applyPreset(p.days)}
                      className={cn(
                        'px-2 py-1.5 rounded text-xs font-bold border transition-all',
                        checkoutOffset === p.days
                          ? 'bg-blue-600 text-white border-blue-600'
                          : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}
                    >{p.label}</button>
                    <button onClick={() => applyPreset(p.days, 1)}
                      className={cn('px-1.5 py-1.5 rounded text-xs border', dk ? 'border-white/10 text-slate-500 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>+</button>
                  </div>
                ))}
              </div>
            )}

            {/* Nights badge */}
            {hasDates && (
              <div className={cn('self-end px-3 py-1.5 rounded-lg border text-sm font-black shrink-0',
                dk ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-900')}>
                {nights}N
              </div>
            )}

            {/* rooms · beds · free — same row, after nights badge */}
            {hasDates && roomCards.length > 0 && (
              <div className="self-end pb-0.5 flex items-center gap-1 text-sm font-bold">
                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>
                  {roomCards.length} {lang === 'de' ? 'Zi.' : 'rooms'}
                </span>
                <span className={dk ? 'text-slate-600' : 'text-slate-300'}>·</span>
                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>
                  {totalBeds} {lang === 'de' ? 'B.' : 'beds'}
                </span>
                {freeBeds > 0 && (
                  <>
                    <span className={dk ? 'text-slate-600' : 'text-slate-300'}>·</span>
                    <span className="text-red-500 font-bold">
                      {freeBeds} {lang === 'de' ? 'frei' : 'free'}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2 self-end">
              {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
              <button
                onClick={() => setConfirm(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* ─── ROW 2: Invoice + Booking ref (fixed width) ─── */}
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice No.'}</label>
              <input type="text"
                value={local.rechnungNr || ''}
                onChange={e => patch({ rechnungNr: e.target.value })}
                placeholder="RE-2026-..."
                className={cn(inputCls, 'w-36')}
              />
            </div>
            {/* Fixed width — no longer flex-1/w-full */}
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>{lang === 'de' ? 'Buchungsreferenz / Notiz' : 'Booking ref / note'}</label>
              <input type="text"
                value={local.bookingId || ''}
                onChange={e => patch({ bookingId: e.target.value })}
                placeholder={lang === 'de' ? 'Referenz / Notiz...' : 'Reference / note...'}
                className={cn(inputCls, 'w-48')}
              />
            </div>
          </div>

          {/* ─── ROW 3: Room type chips ─── */}
          {hasDates && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>
                {lang === 'de' ? 'Zimmer:' : 'Rooms:'}
              </span>
              {ROOM_TYPES.map(rt => (
                <div key={rt} className="flex items-center">
                  {(typeCount[rt] ?? 0) > 0 && (
                    <button
                      onClick={() => handleRemoveLastOfType(rt)}
                      className={cn(
                        'px-1.5 py-1 rounded-l-full text-xs font-bold border-y border-l transition-all',
                        dk ? 'border-white/10 text-slate-400 hover:bg-red-900/20 hover:text-red-400'
                           : 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500'
                      )}
                    ><Minus size={10} /></button>
                  )}
                  <button
                    onClick={() => handleAddRoomCard(rt)}
                    disabled={!!addingType}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 text-xs font-bold border transition-all',
                      (typeCount[rt] ?? 0) > 0 ? 'rounded-none border-x-0' : 'rounded-full',
                      (typeCount[rt] ?? 0) > 0
                        ? dk ? 'border-y border-blue-500/40 bg-blue-500/10 text-blue-400'
                              : 'border-y border-blue-400 bg-blue-50 text-blue-600'
                        : dk ? 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                              : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                    )}
                  >
                    {addingType === rt ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                    {rt}
                    {(typeCount[rt] ?? 0) > 0 && (
                      <span className={cn('px-1 rounded-full text-[10px] font-black',
                        dk ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                        {typeCount[rt]}
                      </span>
                    )}
                  </button>
                  {(typeCount[rt] ?? 0) > 0 && (
                    <button
                      onClick={() => handleAddRoomCard(rt)}
                      disabled={!!addingType}
                      className={cn(
                        'px-1.5 py-1 rounded-r-full text-xs font-bold border-y border-r transition-all',
                        dk ? 'border-white/10 text-slate-400 hover:bg-blue-900/20 hover:text-blue-400'
                           : 'border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-500'
                      )}
                    ><Plus size={10} /></button>
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

        {/* ── Right: summary cost card — wider w-80 ── */}
        {hasDates && (
          <div className={cn(
            'w-80 shrink-0 rounded-xl border p-4 flex flex-col gap-3',
            dk ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
          )}>

            {/* ── Master Brutto/Netto toggle ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => patch({ useBruttoNetto: !local.useBruttoNetto })}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-bold border transition-all',
                  local.useBruttoNetto
                    ? 'bg-amber-500 text-white border-amber-500'
                    : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                )}
              >Brutto / Netto</button>
              <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
                {local.useBruttoNetto
                  ? (lang === 'de' ? '— Gesamtpreis manuell' : '— manual total price')
                  : (lang === 'de' ? '— Summe der Zimmer' : '— sum of rooms')}
              </span>
            </div>

            {/* ── Brutto/Netto inputs (master mode) ── */}
            {local.useBruttoNetto && (
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>Brutto (€)</label>
                  <input type="number" min={0} step="0.01"
                    value={local.brutto ?? ''}
                    placeholder="Brutto..."
                    onChange={e => patch({ brutto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-28 text-sm')} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>Netto (€)</label>
                  <input type="number" min={0} step="0.01"
                    value={local.netto ?? ''}
                    placeholder="Netto..."
                    onChange={e => patch({ netto: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-28 text-sm')} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>MwSt (%)</label>
                  <input type="number" min={0} max={100} step="0.1"
                    value={local.mwst ?? ''}
                    placeholder="19"
                    onChange={e => patch({ mwst: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                    className={cn(inputCls, 'w-20 text-sm')} />
                </div>
              </div>
            )}

            {/* ── Toggle buttons row: Discount · Deposit · Paid ── */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => patch({ hasDiscount: !local.hasDiscount })}
                className={cn('flex items-center gap-1', local.hasDiscount ? togOn('blue') : togOff)}>
                <Tag size={11} />{lang === 'de' ? 'Rabatt' : 'Disc.'}
              </button>
              <button onClick={() => patch({ depositEnabled: !local.depositEnabled })}
                className={cn(local.depositEnabled ? togOn('purple') : togOff)}>
                {lang === 'de' ? 'Kaution' : 'Deposit'}
              </button>
              <button onClick={() => patch({ isPaid: !local.isPaid })}
                className={cn(local.isPaid ? togOn('green') : togOff)}>
                {local.isPaid ? '✓ ' : ''}{lang === 'de' ? 'Bezahlt' : 'Paid'}
              </button>
            </div>

            {/* ── Discount inputs ── */}
            {local.hasDiscount && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => patch({ discountType: local.discountType === 'percentage' ? 'fixed' : 'percentage' })}
                  className={cn('px-2.5 py-2 rounded-l-lg rounded-r-none border text-sm font-bold border-r-0 transition-all',
                    dk ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {local.discountType === 'percentage' ? '%' : '€'}
                </button>
                <input
                  type="number" min={0}
                  value={local.discountValue || ''}
                  placeholder={local.discountType === 'percentage' ? '10' : '50'}
                  onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
                  className={cn('px-2.5 py-2 rounded-r-lg rounded-l-none border text-sm outline-none transition-all w-24',
                    dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                  )}
                />
              </div>
            )}

            {/* ── Deposit amount ── */}
            {local.depositEnabled && (
              <input
                type="number" min={0} step="0.01"
                value={local.depositAmount ?? ''}
                placeholder="Kaution €"
                onChange={e => patch({ depositAmount: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
                className={cn('px-2.5 py-2 rounded-lg border text-sm outline-none transition-all w-full',
                  dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                )}
              />
            )}

            {/* ── Grand total ── */}
            <div className={cn('pt-2 border-t flex items-baseline justify-between',
              dk ? 'border-white/10' : 'border-slate-200')}>
              <span className={cn('text-sm font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>
                {lang === 'de' ? 'Gesamt' : 'Total'}
                {local.hasDiscount && local.discountValue ? (
                  <span className={cn('ml-1 text-xs', dk ? 'text-blue-400' : 'text-blue-600')}>
                    -{local.discountType === 'percentage' ? `${local.discountValue}%` : formatCurrency(local.discountValue)}
                  </span>
                ) : null}
              </span>
              <span className={cn('text-2xl font-black', dk ? 'text-white' : 'text-slate-900')}>
                {formatCurrency(displayTotal)}
              </span>
            </div>

            {local.depositEnabled && local.depositAmount ? (
              <div className="flex items-center justify-between">
                <span className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Kaution' : 'Deposit'}</span>
                <span className={cn('text-sm font-bold', dk ? 'text-purple-400' : 'text-purple-700')}>{formatCurrency(local.depositAmount)}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ══ ROOM CARDS ══ */}
      {loadingCards && (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-blue-400" />
        </div>
      )}
      {!loadingCards && roomCards.length > 0 && (
        <div className={cn('border-t px-4 py-3', dk ? 'border-white/10' : 'border-slate-100')}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {roomCards.map(card => (
              <RoomCardComponent
                key={card.id}
                card={card}
                durationStart={local.startDate}
                durationEnd={local.endDate}
                dk={dk}
                lang={lang}
                allCardsOfSameType={roomCards.filter(c => c.roomType === card.roomType)}
                onUpdate={handleCardUpdate}
                onDelete={handleCardDelete}
                onApplyToSameType={handleApplyToSameType}
              />
            ))}
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM ══ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht.' : 'This duration will be permanently deleted.'}
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
