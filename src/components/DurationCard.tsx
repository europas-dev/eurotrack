// src/components/DurationCard.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, ChevronDown, ChevronUp, Loader2,
  Minus, Plus, Receipt, Tag, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react'
import {
  cn,
  calculateNights,
  calcDurationPrice,
  formatCurrency,
  formatDateShort,
  getDurationGapInfo,
  getNightsBetween,
  getTotalBeds,
  normalizeNumberInput,
  getRoomTypeLabel,
} from '../lib/utils'
import { deleteDuration, updateDuration } from '../lib/supabase'
import { EmployeeSlot } from './EmployeeSlot'
import type { Duration } from '../lib/types'

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ label, dk }: { label: string; dk: boolean }) {
  return (
    <p className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
      {label}
    </p>
  )
}

// ─── Toggle button ────────────────────────────────────────────────────────────
function ToggleBtn({
  active, onClick, activeLabel, inactiveLabel,
  activeColor = 'bg-green-600 border-green-600', dk,
}: {
  active: boolean; onClick: () => void
  activeLabel: string; inactiveLabel: string
  activeColor?: string; dk: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5',
        active
          ? activeColor + ' text-white'
          : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
      )}
    >
      {active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
      {active ? activeLabel : inactiveLabel}
    </button>
  )
}

// ─── DurationCard ─────────────────────────────────────────────────────────────
export function DurationCard({
  duration, isDarkMode, lang = 'de', onUpdate, onDelete,
}: {
  duration: Duration
  isDarkMode: boolean
  lang?: 'de' | 'en'
  onUpdate: (id: string, updated: Duration) => void
  onDelete: (id: string) => void
}) {
  const dk = isDarkMode
  const [local, setLocal]               = useState<Duration>(duration)
  const [saving, setSaving]             = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Reverse-calc state ────────────────────────────────────────────────────
  // totalDraft: what the user is currently typing in the reverse-calc field.
  // totalFocused: true while the input has focus.
  // When blurred → commit the reverse calculation → do NOT overwrite while typing.
  const [totalDraft, setTotalDraft]     = useState('')
  const [totalFocused, setTotalFocused] = useState(false)

  const saveTimer = useRef<any>(null)

  useEffect(() => { setLocal(duration) }, [duration.id])

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalBeds   = getTotalBeds(local.roomType, local.numberOfRooms)
  const nights      = calculateNights(local.startDate, local.endDate)
  const allNights   = useMemo(() => getNightsBetween(local.startDate, local.endDate), [local.startDate, local.endDate])
  const gaps        = useMemo(() => getDurationGapInfo(local), [local])
  const priceResult = useMemo(() => calcDurationPrice(local), [local])
  const roomCount   = Math.max(1, Number(local.numberOfRooms) || 1)
  const freeBeds    = Math.max(0, totalBeds - (local.employees ?? []).filter(Boolean).length)

  // ── Save ──────────────────────────────────────────────────────────────────
  function queueSave(next: Duration) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true)
        await updateDuration(local.id, next)
        onUpdate(local.id, next)
      } catch (e) {
        console.error('DurationCard save error:', e)
      } finally {
        setSaving(false)
      }
    }, 500)
  }

  function patch(changes: Partial<Duration>) {
    const next = { ...local, ...changes } as Duration
    setLocal(next)
    queueSave(next)
  }

  // ── Employee slot update ──────────────────────────────────────────────────
  function onEmployeeUpdated(slotIndex: number, employee: any | null) {
    const employees = [...(local.employees ?? [])]
    while (employees.length < totalBeds) employees.push(null)
    employees[slotIndex] = employee
    const next = { ...local, employees } as Duration
    setLocal(next)
    onUpdate(local.id, next)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    try {
      await deleteDuration(local.id)
      onDelete(local.id)
    } catch (e) {
      console.error('Delete duration error:', e)
    }
  }

  // ── Reverse-calc ──────────────────────────────────────────────────────────
  // The user types a TOTAL → we derive pricePerNightPerRoom.
  // We keep a local draft string so React never overwrites the input mid-type.
  // Commit happens on blur or Enter key.
  function commitTotalInput() {
    const entered = normalizeNumberInput(totalDraft)
    if (entered > 0 && nights > 0 && roomCount > 0) {
      const impliedPerNight = entered / nights / roomCount
      patch({ pricePerNightPerRoom: Math.round(impliedPerNight * 100) / 100 })
    }
    setTotalFocused(false)
    setTotalDraft('')
  }

  // What to show in the reverse-calc input when not focused:
  // Show the live calculated total so it stays in sync with the per-night field.
  const reversePlaceholder =
    nights > 0 && (local.pricePerNightPerRoom ?? 0) > 0
      ? String((local.pricePerNightPerRoom! * roomCount * nights).toFixed(2))
      : ''

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = cn(
    'px-2.5 py-1.5 rounded-lg text-sm outline-none border transition-all',
    dk
      ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  )
  const labelCls = cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'rounded-2xl border space-y-0 overflow-hidden',
      dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
    )}>

      {/* ══════════════════════════════════════════════════════
          ROW 1 — Dates · Room type · Count · Nights · Beds
      ══════════════════════════════════════════════════════ */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3 flex-wrap border-b',
        dk ? 'border-white/10' : 'border-slate-100'
      )}>

        {/* Check-in */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Anreise' : 'Check-in'}</span>
          <input type="date" value={local.startDate || ''}
            onChange={e => patch({ startDate: e.target.value })}
            className={cn(inputCls, 'w-36')} />
        </div>

        {/* Check-out */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Abreise' : 'Check-out'}</span>
          <input type="date" value={local.endDate || ''}
            onChange={e => patch({ endDate: e.target.value })}
            className={cn(inputCls, 'w-36')} />
        </div>

        {/* Room type */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Zimmertyp' : 'Room type'}</span>
          <select value={local.roomType || 'DZ'}
            onChange={e => patch({ roomType: e.target.value as any })}
            className={cn(inputCls, 'w-28')}>
            {(['EZ', 'DZ', 'TZ', 'WG'] as const).map(rt => (
              <option key={rt} value={rt}>{getRoomTypeLabel(rt, lang)}</option>
            ))}
          </select>
        </div>

        {/* Room / Bed count */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>
            {local.roomType === 'WG'
              ? (lang === 'de' ? 'Betten' : 'Beds')
              : (lang === 'de' ? 'Zimmer' : 'Rooms')}
          </span>
          <div className={cn(
            'flex items-center rounded-lg border overflow-hidden',
            dk ? 'border-white/10' : 'border-slate-200'
          )}>
            <button onClick={() => patch({ numberOfRooms: Math.max(1, roomCount - 1) })}
              className={cn('px-2.5 py-1.5 transition-all', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}>
              <Minus size={13} />
            </button>
            <div className={cn(
              'px-3 py-1.5 text-sm font-bold min-w-[40px] text-center',
              dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900'
            )}>{roomCount}</div>
            <button onClick={() => patch({ numberOfRooms: roomCount + 1 })}
              className={cn('px-2.5 py-1.5 transition-all', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}>
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Nights pill */}
        <div className="flex flex-col gap-0.5 text-center">
          <span className={labelCls}>{lang === 'de' ? 'Nächte' : 'Nights'}</span>
          <div className={cn('px-3 py-1.5 rounded-lg text-sm font-black',
            dk ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-50 text-blue-700')}>
            {nights}
          </div>
        </div>

        {/* Beds pill */}
        <div className="flex flex-col gap-0.5 text-center">
          <span className={labelCls}>{lang === 'de' ? 'Betten' : 'Beds'}</span>
          <div className={cn('px-3 py-1.5 rounded-lg text-sm font-black',
            dk ? 'bg-white/5 text-slate-200' : 'bg-slate-100 text-slate-700')}>
            {totalBeds}
          </div>
        </div>

        <div className="flex-1" />

        {saving && <Loader2 size={14} className="animate-spin text-blue-400 flex-shrink-0" />}

        {/* Calendar toggle */}
        <button onClick={() => setShowCalendar(!showCalendar)}
          className={cn(
            'px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all',
            showCalendar
              ? 'bg-purple-600 text-white border-purple-600'
              : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          )}>
          <CalendarDays size={12} />
          {showCalendar
            ? (lang === 'de' ? 'Kalender ausblenden' : 'Hide calendar')
            : (lang === 'de' ? 'Kalender zeigen' : 'Show calendar')}
        </button>

        {/* Delete */}
        <button onClick={() => setConfirmDelete(true)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 flex items-center gap-1 transition-all">
          <Trash2 size={12} />
          {lang === 'de' ? 'Löschen' : 'Delete'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 2 — Pricing
      ══════════════════════════════════════════════════════ */}
      <div className={cn('px-4 py-3 border-b space-y-3', dk ? 'border-white/10' : 'border-slate-100')}>

        {/* Mode toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <SectionLabel label={lang === 'de' ? 'Preisgestaltung' : 'Pricing'} dk={dk} />
          <div className="flex-1" />

          <ToggleBtn
            active={!!local.useBruttoNetto}
            onClick={() => patch({ useBruttoNetto: !local.useBruttoNetto })}
            activeLabel={lang === 'de' ? 'Brutto/Netto AN' : 'Brutto/Netto ON'}
            inactiveLabel="Brutto/Netto"
            activeColor="bg-amber-600 border-amber-600"
            dk={dk}
          />

          {!local.useBruttoNetto && (
            <ToggleBtn
              active={!!local.useManualPrices}
              onClick={() => patch({ useManualPrices: !local.useManualPrices })}
              activeLabel={lang === 'de' ? 'Nachtpreise AN' : 'Night prices ON'}
              inactiveLabel={lang === 'de' ? 'Nachtpreise' : 'Night prices'}
              activeColor="bg-purple-600 border-purple-600"
              dk={dk}
            />
          )}

          <ToggleBtn
            active={!!local.hasDiscount}
            onClick={() => patch({ hasDiscount: !local.hasDiscount })}
            activeLabel={lang === 'de' ? 'Rabatt AN' : 'Discount ON'}
            inactiveLabel={lang === 'de' ? 'Rabatt' : 'Discount'}
            activeColor="bg-blue-600 border-blue-600"
            dk={dk}
          />
        </div>

        {/* ── Simple pricing mode ────────────────────────── */}
        {!local.useBruttoNetto && (
          <div className="flex items-end gap-3 flex-wrap">

            {/* Price per night per room */}
            <div className="flex flex-col gap-0.5">
              <span className={labelCls}>
                {local.roomType === 'WG'
                  ? (lang === 'de' ? 'Preis / Nacht / Bett' : 'Price / night / bed')
                  : (lang === 'de' ? 'Preis / Nacht / Zimmer' : 'Price / night / room')}
              </span>
              <input
                type="number"
                min={0} step={0.01}
                value={local.pricePerNightPerRoom ?? ''}
                onChange={e => patch({ pricePerNightPerRoom: normalizeNumberInput(e.target.value) })}
                placeholder="0"
                className={cn(inputCls, 'w-28')}
              />
            </div>

            {/* Reverse-calc total input
                - While focused: shows totalDraft (what user is typing)
                - While blurred: shows the live computed total (read-only feel)
                - On blur/Enter: commits → derives pricePerNightPerRoom
                This prevents React from overwriting mid-type. */}
            <div className="flex flex-col gap-0.5">
              <span className={labelCls}>
                {lang === 'de' ? 'Gesamtbetrag (Rückrechnung)' : 'Total (reverse calc)'}
              </span>
              <input
                type="number"
                min={0} step={0.01}
                // While focused show the draft; while blurred show computed total
                value={totalFocused ? totalDraft : reversePlaceholder}
                placeholder={lang === 'de' ? 'Gesamt eingeben...' : 'Enter total...'}
                onFocus={() => {
                  setTotalFocused(true)
                  // Pre-fill draft with current computed total so user can edit it
                  setTotalDraft(reversePlaceholder)
                }}
                onChange={e => setTotalDraft(e.target.value)}
                onBlur={commitTotalInput}
                onKeyDown={e => { if (e.key === 'Enter') commitTotalInput() }}
                className={cn(inputCls, 'w-36')}
              />
            </div>

            {/* Discount fields */}
            {local.hasDiscount && (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className={labelCls}>{lang === 'de' ? 'Rabattart' : 'Discount type'}</span>
                  <select
                    value={local.discountType || 'percentage'}
                    onChange={e => patch({ discountType: e.target.value as any })}
                    className={cn(inputCls, 'w-28')}>
                    <option value="percentage">{lang === 'de' ? 'Prozent %' : 'Percent %'}</option>
                    <option value="fixed">{lang === 'de' ? 'Fest EUR' : 'Fixed EUR'}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={labelCls}>{lang === 'de' ? 'Rabattwert' : 'Discount value'}</span>
                  <input
                    type="number" min={0}
                    value={local.discountValue ?? ''}
                    onChange={e => patch({ discountValue: normalizeNumberInput(e.target.value) })}
                    placeholder="0"
                    className={cn(inputCls, 'w-24')}
                  />
                </div>
              </>
            )}

            {/* Computed total */}
            <div className="flex flex-col gap-0.5 ml-auto text-right">
              <span className={labelCls}>{lang === 'de' ? 'Gesamt' : 'Total'}</span>
              <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>
                {priceResult.total > 0 ? formatCurrency(priceResult.total) : '—'}
              </p>
              {'rawBeforeDiscount' in priceResult && (priceResult as any).rawBeforeDiscount > 0 && (
                <p className={cn('text-[10px] line-through', dk ? 'text-slate-600' : 'text-slate-300')}>
                  {formatCurrency((priceResult as any).rawBeforeDiscount)}
                </p>
              )}
              {nights > 0 && priceResult.total > 0 && (
                <p className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {formatCurrency(priceResult.perNight)} / {lang === 'de' ? 'Nacht' : 'night'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Brutto / Netto / MwSt mode ─────────────────── */}
        {local.useBruttoNetto && (
          <div className="flex items-end gap-3 flex-wrap">

            {/* Brutto */}
            <div className="flex flex-col gap-0.5">
              <span className={labelCls}>Brutto (€)</span>
              <input type="number" min={0} step={0.01}
                value={local.brutto ?? ''}
                onChange={e => {
                  const v = normalizeNumberInput(e.target.value)
                  patch({ brutto: v > 0 ? v : undefined })
                }}
                placeholder="0.00"
                className={cn(inputCls, 'w-28')} />
            </div>

            {/* Netto */}
            <div className="flex flex-col gap-0.5">
              <span className={labelCls}>Netto (€)</span>
              <input type="number" min={0} step={0.01}
                value={local.netto ?? ''}
                onChange={e => {
                  const v = normalizeNumberInput(e.target.value)
                  patch({ netto: v > 0 ? v : undefined })
                }}
                placeholder="0.00"
                className={cn(inputCls, 'w-28')} />
            </div>

            {/* MwSt */}
            <div className="flex flex-col gap-0.5">
              <span className={labelCls}>MwSt (%)</span>
              <input type="number" min={0} max={100} step={0.1}
                value={local.mwst ?? ''}
                onChange={e => {
                  const v = normalizeNumberInput(e.target.value)
                  patch({ mwst: v >= 0 ? v : undefined })
                }}
                placeholder={lang === 'de' ? 'z.B. 19' : 'e.g. 19'}
                className={cn(inputCls, 'w-24')} />
            </div>

            {/* Result panel */}
            <div className="flex flex-col gap-0.5 ml-auto text-right min-w-[120px]">
              <span className={labelCls}>{lang === 'de' ? 'Berechnet' : 'Calculated'}</span>

              {/* Brutto result — shows '—' when neither Brutto nor Netto+MwSt derivable */}
              {priceResult.brutto != null ? (
                <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>
                  {formatCurrency(priceResult.brutto)}
                  <span className={cn('text-[10px] ml-1 font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>Brutto</span>
                </p>
              ) : priceResult.netto != null ? (
                // Only Netto entered (no MwSt) — show Netto as total
                <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>
                  {formatCurrency(priceResult.netto)}
                  <span className={cn('text-[10px] ml-1 font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>Netto</span>
                </p>
              ) : (
                <p className={cn('text-lg font-black', dk ? 'text-slate-600' : 'text-slate-300')}>—</p>
              )}

              {/* Netto line — only shown when Brutto was entered and Netto was derived */}
              {priceResult.brutto != null && priceResult.netto != null && (
                <p className={cn('text-xs mt-0.5', dk ? 'text-slate-400' : 'text-slate-600')}>
                  {formatCurrency(priceResult.netto)}
                  <span className={cn('ml-1', dk ? 'text-slate-600' : 'text-slate-400')}>Netto</span>
                </p>
              )}

              {/* Hint when Brutto is entered but MwSt is missing */}
              {priceResult.brutto != null && priceResult.netto == null && (
                <p className={cn('text-[10px] mt-0.5', dk ? 'text-slate-600' : 'text-slate-400')}>
                  {lang === 'de' ? 'Netto unbekannt – MwSt fehlt' : 'Netto unknown – MwSt missing'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 3 — Invoice · Payment · Deposit
      ══════════════════════════════════════════════════════ */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3 flex-wrap border-b',
        dk ? 'border-white/10' : 'border-slate-100'
      )}>

        {/* Rechnungsnr */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Rechnungsnr.' : 'Invoice no.'}</span>
          <div className="flex items-center gap-1">
            <Receipt size={13} className={dk ? 'text-slate-500' : 'text-slate-400'} />
            <input type="text"
              value={local.rechnungNr || ''}
              onChange={e => patch({ rechnungNr: e.target.value })}
              placeholder={lang === 'de' ? 'RE-2026-001' : 'INV-2026-001'}
              className={cn(inputCls, 'w-36')} />
          </div>
        </div>

        {/* Booking ref */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Buchungsreferenz' : 'Booking ref.'}</span>
          <input type="text"
            value={local.bookingId || ''}
            onChange={e => patch({ bookingId: e.target.value })}
            placeholder={lang === 'de' ? 'Ref. / Notiz...' : 'Ref. / Note...'}
            className={cn(inputCls, 'w-36')} />
        </div>

        {/* Paid */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Zahlungsstatus' : 'Payment'}</span>
          <ToggleBtn
            active={!!local.isPaid}
            onClick={() => patch({ isPaid: !local.isPaid })}
            activeLabel={lang === 'de' ? 'Bezahlt' : 'Paid'}
            inactiveLabel={lang === 'de' ? 'Unbezahlt' : 'Unpaid'}
            activeColor="bg-green-600 border-green-600"
            dk={dk}
          />
        </div>

        {/* Deposit toggle */}
        <div className="flex flex-col gap-0.5">
          <span className={labelCls}>{lang === 'de' ? 'Kaution' : 'Deposit'}</span>
          <ToggleBtn
            active={!!local.depositEnabled}
            onClick={() => patch({ depositEnabled: !local.depositEnabled })}
            activeLabel={lang === 'de' ? 'Kaution AN' : 'Deposit ON'}
            inactiveLabel={lang === 'de' ? 'Keine Kaution' : 'No deposit'}
            activeColor="bg-amber-600 border-amber-600"
            dk={dk}
          />
        </div>

        {/* Deposit amount */}
        {local.depositEnabled && (
          <div className="flex flex-col gap-0.5">
            <span className={labelCls}>{lang === 'de' ? 'Kautionsbetrag (€)' : 'Deposit amount (€)'}</span>
            <input type="number" min={0} step={0.01}
              value={local.depositAmount ?? ''}
              onChange={e => {
                const v = normalizeNumberInput(e.target.value)
                patch({ depositAmount: v > 0 ? v : undefined })
              }}
              placeholder="0.00"
              className={cn(inputCls, 'w-28')} />
          </div>
        )}

        {/* Extension note */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-[160px]">
          <span className={labelCls}>{lang === 'de' ? 'Verlängerungsnotiz' : 'Extension note'}</span>
          <input type="text"
            value={local.extensionNote || ''}
            onChange={e => patch({ extensionNote: e.target.value })}
            placeholder={lang === 'de' ? 'Optionale Notiz...' : 'Optional note...'}
            className={cn(inputCls, 'w-full')} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 4 — Night calendar (collapsed by default)
      ══════════════════════════════════════════════════════ */}
      {showCalendar && local.startDate && local.endDate && (
        <div className={cn(
          'px-4 py-3 border-b',
          dk ? 'border-white/10 bg-white/[0.01]' : 'border-slate-100 bg-slate-50/50'
        )}>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel
              label={`${lang === 'de' ? 'Nachtkalender' : 'Night calendar'} · ${allNights.length} ${lang === 'de' ? 'Nächte' : 'nights'}`}
              dk={dk}
            />
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {allNights.map(night => {
              const nightPrice = (local.nightlyPrices ?? {})[night] ?? local.pricePerNightPerRoom ?? 0
              return (
                <div key={night} className={cn(
                  'rounded-lg border p-2',
                  dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
                )}>
                  <p className={cn('text-[11px] font-bold mb-1', dk ? 'text-slate-300' : 'text-slate-700')}>
                    {night.split('-').reverse().slice(0, 2).join('.')}
                  </p>
                  {local.useManualPrices ? (
                    <input type="number" min={0} step={0.01}
                      value={(local.nightlyPrices ?? {})[night] ?? local.pricePerNightPerRoom ?? 0}
                      onChange={e => patch({
                        nightlyPrices: { ...(local.nightlyPrices ?? {}), [night]: normalizeNumberInput(e.target.value) }
                      })}
                      className={cn(inputCls, 'w-full px-2 py-1 text-xs')} />
                  ) : (
                    <p className={cn('text-xs font-bold', dk ? 'text-white' : 'text-slate-900')}>
                      {formatCurrency(nightPrice)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ROW 5 — Bed assignments
      ══════════════════════════════════════════════════════ */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel label={lang === 'de' ? 'Bettenbelegung' : 'Bed assignments'} dk={dk} />
          <p className={cn('text-xs font-bold', freeBeds > 0 ? 'text-red-400' : 'text-green-400')}>
            {freeBeds} {lang === 'de' ? 'frei' : 'free'}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: totalBeds }).map((_, slotIndex) => {
            const employee = (local.employees ?? [])[slotIndex] ?? null
            const gap = gaps.find(g => g.slotIndex === slotIndex)
            return (
              <div key={slotIndex} className="space-y-2">
                <EmployeeSlot
                  key={`${local.id}-slot-${slotIndex}`}
                  slotIndex={slotIndex}
                  employee={employee}
                  duration={local}
                  isDarkMode={dk}
                  lang={lang}
                  onUpdate={onEmployeeUpdated}
                />
                {gap && (
                  <div className={cn(
                    'text-[10px] rounded-lg px-2 py-1 border',
                    dk ? 'bg-amber-900/20 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                  )}>
                    {lang === 'de' ? 'Lücke' : 'Gap'}:{' '}
                    {gap.availableFrom} → {gap.availableTo}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={cn(
            'w-full max-w-sm rounded-2xl border p-5 shadow-2xl',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          )}>
            <h3 className="text-lg font-black mb-2">
              {lang === 'de' ? 'Buchungszeitraum löschen?' : 'Delete this duration?'}
            </h3>
            <p className={cn('text-sm mb-5', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de'
                ? 'Dieser Buchungszeitraum und alle Mitarbeiterzuordnungen werden dauerhaft gelöscht.'
                : 'This duration and all employee assignments will be permanently deleted.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={handleDelete}
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
