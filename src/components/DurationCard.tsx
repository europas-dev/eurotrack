import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, ChevronDown, ChevronUp,
  Loader2, Plus, Tag, Trash2,
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, normalizeNumberInput,
  getDurationTotal,
} from '../lib/utils'
import { calcRoomCardTotal } from '../lib/roomCardUtils'
import { deleteDuration, updateDuration } from '../lib/supabase'
import {
  createRoomCard, getRoomCardsForDuration,
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

// ── Date quick-picker ─────────────────────────────────────────────────────────
function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DurationCard({
  duration, isDarkMode, lang = 'de', onUpdate, onDelete,
}: Props) {
  const dk = isDarkMode
  const [local, setLocal]         = useState<Duration>(duration)
  const [saving, setSaving]       = useState(false)
  const [confirmDelete, setConfirm] = useState(false)
  const [roomCards, setRoomCards] = useState<RoomCard[]>(duration.roomCards ?? [])
  const [loadingCards, setLoadingCards] = useState(false)
  const [addingType, setAddingType] = useState<string | null>(null)

  // Duration-level total override
  const [totalOverride, setTotalOverride] = useState(false)
  const [totalBruttoRaw, setTotalBruttoRaw] = useState('')
  const [totalNettoRaw, setTotalNettoRaw]   = useState('')
  const [totalMwstRaw, setTotalMwstRaw]     = useState('')

  const saveTimer = useRef<any>(null)

  useEffect(() => {
    setLocal(duration)
    // load room cards if not already embedded
    if (!duration.roomCards?.length) {
      setLoadingCards(true)
      getRoomCardsForDuration(duration.id)
        .then(cards => setRoomCards(cards))
        .catch(console.error)
        .finally(() => setLoadingCards(false))
    } else {
      setRoomCards(duration.roomCards)
    }
  }, [duration])

  const nights = calculateNights(local.startDate, local.endDate)
  const hasDates = !!(local.startDate && local.endDate && nights > 0)

  // ── Sum of all room card totals ───────────────────────────────────────────
  const roomCardsTotal = roomCards.reduce(
    (s, c) => s + calcRoomCardTotal(c, local.startDate, local.endDate), 0
  )
  const totalBeds = roomCards.reduce(
    (s, c) => s + (c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : c.bedCount),
    0
  )

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
    setLocal(next)
    queueSave(next)
  }

  // ── Checkout quick presets ────────────────────────────────────────────────
  const [checkoutOffset, setCheckoutOffset] = useState<number | null>(null)
  function applyCheckoutPreset(baseDays: number, delta = 0) {
    if (!local.startDate) return
    const d = baseDays + delta
    setCheckoutOffset(d)
    patch({ endDate: addDays(local.startDate, d) })
  }

  // ── Add room card ─────────────────────────────────────────────────────────
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

  // ── Room card updates ─────────────────────────────────────────────────────
  function handleCardUpdate(id: string, patch: Partial<RoomCard>) {
    setRoomCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function handleCardDelete(id: string) {
    setRoomCards(prev => prev.filter(c => c.id !== id))
  }

  function handleApplyToSameType(source: RoomCard) {
    // Copy pricing fields from source to all cards of same room type
    const pricingFields = {
      nightlyPrice: source.nightlyPrice,
      pricePerBed: source.pricePerBed,
      pricePerBedAmount: source.pricePerBedAmount,
      useBruttoNetto: source.useBruttoNetto,
      brutto: source.brutto,
      netto: source.netto,
      mwst: source.mwst,
      hasDiscount: source.hasDiscount,
      discountType: source.discountType,
      discountValue: source.discountValue,
    }
    setRoomCards(prev => prev.map(c => {
      if (c.id === source.id || c.roomType !== source.roomType) return c
      // fire DB update for each
      import('../lib/supabaseRoomCards').then(({ updateRoomCard }) =>
        updateRoomCard(c.id, pricingFields).catch(console.error)
      )
      return { ...c, ...pricingFields }
    }))
  }

  // ── Duration-level total override ─────────────────────────────────────────
  function commitTotalOverride() {
    const b = normalizeNumberInput(totalBruttoRaw)
    const n = normalizeNumberInput(totalNettoRaw)
    const m = normalizeNumberInput(totalMwstRaw)
    if (b > 0) patch({ useBruttoNetto: true, brutto: b, netto: null, mwst: m > 0 ? m : null })
    else if (n > 0 && m > 0) patch({ useBruttoNetto: true, netto: n, mwst: m, brutto: null })
  }

  // ── Grand total ───────────────────────────────────────────────────────────
  const grandTotal = local.useBruttoNetto
    ? (local.brutto ?? (local.netto && local.mwst ? local.netto * (1 + local.mwst / 100) : null) ?? roomCardsTotal)
    : roomCardsTotal

  // ── Type chips for adding rooms ───────────────────────────────────────────
  const ROOM_TYPES = ['EZ', 'DZ', 'TZ', 'WG'] as const
  const typeCount: Record<string, number> = {}
  roomCards.forEach(c => { typeCount[c.roomType] = (typeCount[c.roomType] ?? 0) + 1 })

  return (
    <div className={cn('rounded-2xl border p-4 space-y-4', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

      {/* ── Row 1: Dates + nights + meta ── */}
      <div className="flex items-end gap-3 flex-wrap">
        {/* Check-in */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Check-in' : 'Check-in'}</label>
          <input type="date"
            value={local.startDate || ''}
            onChange={e => patch({ startDate: e.target.value })}
            className={cn(inputCls, 'w-40')}
          />
        </div>

        {/* Check-out with quick presets */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Check-out' : 'Check-out'}</label>
          <input type="date"
            value={local.endDate || ''}
            min={local.startDate || undefined}
            onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }}
            className={cn(inputCls, 'w-40')}
          />
          {/* Quick presets */}
          {local.startDate && (
            <div className="flex items-center gap-1 mt-1">
              {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(preset => (
                <div key={preset.label} className="flex items-center gap-0.5">
                  <button
                    onClick={() => applyCheckoutPreset(preset.days, checkoutOffset != null && checkoutOffset !== preset.days ? 0 : 0)}
                    className={cn('px-2 py-0.5 rounded text-xs font-bold border transition-all',
                      checkoutOffset === preset.days
                        ? 'bg-blue-600 text-white border-blue-600'
                        : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    )}
                  >{preset.label}</button>
                  <button onClick={() => applyCheckoutPreset(preset.days, -1)}
                    className={cn('px-1 py-0.5 rounded text-xs border', dk ? 'border-white/10 text-slate-500 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>−</button>
                  <button onClick={() => applyCheckoutPreset(preset.days, 1)}
                    className={cn('px-1 py-0.5 rounded text-xs border', dk ? 'border-white/10 text-slate-500 hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>+</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nights badge */}
        {hasDates && (
          <div className={cn('px-3 py-2 rounded-lg border text-sm font-black',
            dk ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-900')}>
            {nights} {lang === 'de' ? 'Nächte' : 'nights'}
          </div>
        )}

        {/* Total beds */}
        {totalBeds > 0 && (
          <div className={cn('px-3 py-2 rounded-lg border text-sm font-bold',
            dk ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600')}>
            {totalBeds} {lang === 'de' ? 'Betten' : 'beds'}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
          <button
            onClick={() => setConfirm(true)}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1"
          >
            <Trash2 size={13} />
            {lang === 'de' ? 'Löschen' : 'Delete'}
          </button>
        </div>
      </div>

      {/* ── Row 2: Invoice + Booking ref ── */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice No.'}</label>
          <input type="text"
            value={local.rechnungNr || ''}
            onChange={e => patch({ rechnungNr: e.target.value })}
            placeholder="RE-2026-..."
            className={cn(inputCls, 'w-36')}
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <label className={labelCls}>{lang === 'de' ? 'Buchungsreferenz / Notiz' : 'Booking ref / note'}</label>
          <input type="text"
            value={local.bookingId || ''}
            onChange={e => patch({ bookingId: e.target.value })}
            placeholder={lang === 'de' ? 'Referenz / Notiz...' : 'Reference / note...'}
            className={cn(inputCls, 'w-full')}
          />
        </div>
      </div>

      {/* ── Row 3: Add room type chips ── */}
      {hasDates && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>
            {lang === 'de' ? '+ Zimmertyp hinzufügen:' : '+ Add room type:'}
          </span>
          {ROOM_TYPES.map(rt => (
            <button
              key={rt}
              onClick={() => handleAddRoomCard(rt)}
              disabled={!!addingType}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                typeCount[rt]
                  ? dk ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-blue-400 bg-blue-50 text-blue-600'
                  : dk ? 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
              )}
            >
              {addingType === rt ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {rt}
              {typeCount[rt] ? (
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-black',
                  dk ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                  {typeCount[rt]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* ── Not-yet-dated hint ── */}
      {!hasDates && (
        <div className={cn('text-xs text-center py-4 rounded-xl border-2 border-dashed',
          dk ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400')}>
          {lang === 'de'
            ? '📅 Check-in und Check-out eingeben, um Zimmerkarten hinzuzufügen'
            : '📅 Enter check-in and check-out to add room cards'}
        </div>
      )}

      {/* ── Room cards ── */}
      {loadingCards && (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-blue-400" />
        </div>
      )}
      {!loadingCards && roomCards.length > 0 && (
        <div className="space-y-3">
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
      )}

      {/* ── Duration-level total override + discount + deposit + paid ── */}
      <div className={cn('rounded-xl border p-3 space-y-3', dk ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200')}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-500')}>
            {lang === 'de' ? 'Gesamtpreis überschreiben:' : 'Override total price:'}
          </span>
          <button
            onClick={() => setTotalOverride(t => !t)}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
              totalOverride ? 'bg-amber-500 text-white border-amber-500' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            )}
          >
            {lang === 'de' ? 'Gesamtbrutto' : 'Total brutto'}
          </button>
        </div>

        {totalOverride && (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>Total Brutto (€)</label>
              <input type="number" min={0} step="0.01"
                value={totalBruttoRaw}
                onChange={e => setTotalBruttoRaw(e.target.value)}
                onBlur={commitTotalOverride}
                placeholder="0.00"
                className={cn(inputCls, 'w-32')}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>Total Netto (€)</label>
              <input type="number" min={0} step="0.01"
                value={totalNettoRaw}
                onChange={e => setTotalNettoRaw(e.target.value)}
                onBlur={commitTotalOverride}
                placeholder="0.00"
                className={cn(inputCls, 'w-32')}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={labelCls}>MwSt (%)</label>
              <input type="number" min={0} max={100} step="0.1"
                value={totalMwstRaw}
                onChange={e => setTotalMwstRaw(e.target.value)}
                onBlur={commitTotalOverride}
                placeholder="19"
                className={cn(inputCls, 'w-20')}
              />
            </div>
          </div>
        )}

        {/* Discount */}
        <div className="flex items-end gap-3 flex-wrap">
          <button
            onClick={() => patch({ hasDiscount: !local.hasDiscount })}
            className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all',
              local.hasDiscount ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <Tag size={11} />{lang === 'de' ? 'Rabatt' : 'Discount'}
          </button>
          {local.hasDiscount && (
            <>
              <select value={local.discountType} onChange={e => patch({ discountType: e.target.value as any })}
                className={cn(inputCls, 'w-20')}>
                <option value="percentage">%</option>
                <option value="fixed">€ fix</option>
              </select>
              <input type="number" min={0}
                value={local.discountValue || ''}
                onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
                className={cn(inputCls, 'w-24')} />
            </>
          )}

          {/* Deposit */}
          <button
            onClick={() => patch({ depositEnabled: !local.depositEnabled })}
            className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
              local.depositEnabled ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {lang === 'de' ? 'Kaution' : 'Deposit'}
          </button>
          {local.depositEnabled && (
            <input type="number" min={0} step="0.01"
              value={local.depositAmount ?? ''}
              placeholder="0.00"
              onChange={e => patch({ depositAmount: e.target.value === '' ? null : normalizeNumberInput(e.target.value) })}
              className={cn(inputCls, 'w-28')} />
          )}

          {/* Paid */}
          <button
            onClick={() => patch({ isPaid: !local.isPaid })}
            className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ml-auto',
              local.isPaid ? 'bg-green-600 text-white border-green-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {local.isPaid ? (lang === 'de' ? 'Bezahlt ✓' : 'Paid ✓') : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
          </button>
        </div>

        {/* Grand total bar */}
        <div className="flex items-center justify-between pt-1">
          <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
            {roomCards.length} {lang === 'de' ? 'Zimmerkarte(n)' : 'room card(s)'}
            {' · '}{totalBeds} {lang === 'de' ? 'Betten' : 'beds'}
            {local.depositEnabled && local.depositAmount
              ? ` · Kaution: ${formatCurrency(local.depositAmount)}`
              : ''}
          </span>
          <span className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>
            {lang === 'de' ? 'Gesamt: ' : 'Total: '}
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-5',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm mb-4', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht.' : 'This duration will be deleted permanently.'}
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
