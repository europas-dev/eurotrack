// src/components/HotelRow.tsx
// FIXES:
//  1. Every column has a fixed width — no layout collapsing when names are long
//  2. Text truncates with ellipsis, full text shown in tooltip
//  3. Main row shows Brutto > Netto > total cost in that priority
//  4. Expanded panel: 5 info fields in ONE row, Notes below, then duration tabs
//  5. Hotel/City/Company are inline-editable directly in the main row

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2, ChevronDown, ChevronUp,
  Loader2, Plus, Trash2
} from 'lucide-react'
import {
  cn,
  formatCurrency,
  formatDateDisplay,
  getDurationTabLabel,
  getEmployeeStatus,
  calcHotelFreeBeds,
  calcHotelTotalCost,
  calcHotelTotalNights,
} from '../lib/utils'
import { createDuration, updateHotel } from '../lib/supabase'
import { DurationCard } from './DurationCard'

interface HotelRowProps {
  entry: any
  isDarkMode: boolean
  lang?: 'de' | 'en'
  showPaymentTotals?: boolean
  companyOptions?: string[]
  cityOptions?: string[]
  onDelete: (id: string) => void
  onUpdate: (id: string, updated: any) => void
}

// ── InlineEdit: click-to-edit text in the main row ───────────────────────────
function InlineEdit({
  value, onChange, placeholder, dk, textClass, datalistId, datalistOptions,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  dk: boolean; textClass?: string; datalistId?: string; datalistOptions?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) onChange(trimmed)
  }
  const cancel = () => { setEditing(false); setDraft(value) }

  if (editing) {
    return (
      <>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          onBlur={commit}
          list={datalistId}
          className={cn(
            'w-full px-1.5 py-0.5 rounded text-sm outline-none border transition-all',
            dk
              ? 'bg-white/10 border-blue-500 text-white placeholder-slate-600'
              : 'bg-blue-50 border-blue-400 text-slate-900 placeholder-slate-400'
          )}
        />
        {datalistId && datalistOptions && (
          <datalist id={datalistId}>
            {datalistOptions.map(o => <option key={o} value={o} />)}
          </datalist>
        )}
      </>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title={value || placeholder}
      className={cn(
        'w-full text-left px-1 py-0.5 rounded transition-all block',
        textClass,
        dk ? 'hover:bg-white/5' : 'hover:bg-slate-100'
      )}
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
    >
      {value
        ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{value}</span>
        : <span className={dk ? 'text-slate-600 text-xs' : 'text-slate-300 text-xs'}>{placeholder}</span>}
    </button>
  )
}

// ── Bed capacity per room type ────────────────────────────────────────────────
function getBedCapacity(roomType: string, numberOfRooms: number): number {
  if (roomType === 'EZ') return numberOfRooms * 1
  if (roomType === 'DZ') return numberOfRooms * 2
  if (roomType === 'TZ') return numberOfRooms * 3
  return numberOfRooms // WG: numberOfRooms = bed count
}

// ── Derive the best display price for a hotel (Brutto > Netto > total) ────────
function getDisplayCost(hotel: any): { amount: number; label: string } {
  let brutto = 0
  let netto = 0
  let plain = 0

  for (const d of hotel.durations ?? []) {
    if (d.useBruttoNetto) {
      if (d.brutto != null) brutto += d.brutto
      else if (d.netto != null && d.mwst != null) brutto += d.netto * (1 + d.mwst / 100)
      if (d.netto != null) netto += d.netto
      else if (d.brutto != null && d.mwst != null) netto += d.brutto / (1 + d.mwst / 100)
    } else {
      if (!d.startDate || !d.endDate) continue
      const n = Math.max(0, Math.ceil((new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86400000))
      plain += n * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1)
    }
  }

  if (brutto > 0) return { amount: brutto, label: 'Brutto' }
  if (netto > 0) return { amount: netto, label: 'Netto' }
  return { amount: plain, label: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
export function HotelRow({
  entry, isDarkMode, lang = 'de', showPaymentTotals = false,
  companyOptions = [], cityOptions = [], onDelete, onUpdate,
}: HotelRowProps) {
  const dk = isDarkMode
  const [open, setOpen] = useState(false)
  const [localHotel, setLocalHotel] = useState<any>(entry)
  const [saving, setSaving] = useState(false)
  const [creatingDuration, setCreatingDuration] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeDurationTab, setActiveDurationTab] = useState(0)
  const saveTimer = useRef<any>(null)

  useEffect(() => { setLocalHotel(entry) }, [entry.id])

  const totalNights = useMemo(() =>
    (localHotel.durations ?? []).reduce((s: number, d: any) => {
      if (!d.startDate || !d.endDate) return s
      return s + Math.max(0, Math.ceil((new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86400000))
    }, 0), [localHotel.durations])

  const displayCost = useMemo(() => getDisplayCost(localHotel), [localHotel.durations])

  const paidCost = useMemo(() =>
    (localHotel.durations ?? []).filter((d: any) => d.isPaid).reduce((s: number, d: any) => {
      if (d.useBruttoNetto) return s + (d.brutto ?? 0)
      if (!d.startDate || !d.endDate) return s
      const n = Math.max(0, Math.ceil((new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86400000))
      return s + n * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1)
    }, 0), [localHotel.durations])

  const freeBeds = useMemo(() =>
    (localHotel.durations ?? []).reduce((s: number, d: any) => {
      const cap = getBedCapacity(d.roomType || 'DZ', d.numberOfRooms || 1)
      const occ = (d.employees ?? []).filter((e: any) => e != null).length
      return s + Math.max(0, cap - occ)
    }, 0), [localHotel.durations])

  const allEmployees = useMemo(() =>
    (localHotel.durations ?? []).flatMap((d: any) => (d.employees ?? []).filter(Boolean))
  , [localHotel.durations])

  function patchHotel(changes: Record<string, any>) {
    const next = { ...localHotel, ...changes }
    setLocalHotel(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await updateHotel(localHotel.id, next); onUpdate(localHotel.id, next) }
      catch (e) { console.error(e) }
      finally { setSaving(false) }
    }, 500)
  }

  async function addDuration() {
    try {
      setCreatingDuration(true)
      const created = await createDuration({
        hotelId: localHotel.id, startDate: '', endDate: '', roomType: 'DZ',
        numberOfRooms: 1, pricePerNightPerRoom: 0, hasDiscount: false,
        discountType: 'percentage', discountValue: 0, isPaid: false,
        bookingId: null, useManualPrices: false, nightlyPrices: {},
      })
      const nextDurations = [...(localHotel.durations ?? []), { ...created, employees: [] }]
      const next = { ...localHotel, durations: nextDurations }
      setLocalHotel(next); onUpdate(localHotel.id, next)
      setOpen(true); setActiveDurationTab(nextDurations.length - 1)
    } catch (e) {
      console.error(e)
      alert(lang === 'de' ? 'Dauer konnte nicht erstellt werden' : 'Could not create duration')
    } finally { setCreatingDuration(false) }
  }

  function pillCls(emp: any) {
    const s = getEmployeeStatus(emp?.checkIn, emp?.checkOut)
    if (s === 'ending-soon') return dk ? 'border-red-500 text-red-300 bg-red-500/10' : 'border-red-300 text-red-700 bg-red-50'
    if (s === 'completed') return dk ? 'border-green-500 text-green-300 bg-green-500/10' : 'border-green-300 text-green-700 bg-green-50'
    if (s === 'upcoming') return dk ? 'border-blue-500 text-blue-300 bg-blue-500/10' : 'border-blue-300 text-blue-700 bg-blue-50'
    return dk ? 'border-white/10 text-slate-200 bg-white/5' : 'border-slate-200 text-slate-700 bg-slate-50'
  }

  function durTag(d: any) {
    if (!d.startDate) return lang === 'de' ? 'Neu' : 'New'
    return `${formatDateDisplay(d.startDate, lang)} – ${formatDateDisplay(d.endDate, lang)}`
  }

  const inputCls = cn(
    'w-full px-2 py-1.5 rounded-lg text-sm outline-none border transition-all',
    dk
      ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  )
  const colLabel = cn('text-[10px] font-bold uppercase tracking-widest block mt-0.5', dk ? 'text-slate-600' : 'text-slate-300')

  // ── COLUMN WIDTHS — fixed, never flex-shrink, never grow ─────────────────
  // Hotel: 180px | City: 96px | Company: 104px | Durations: 160px | Nights: 60px | Free: 48px | Employees: 148px | Cost: 108px | Spinner: 20px | Actions: auto
  return (
    <div>
      <div className={cn(
        'rounded-2xl border overflow-hidden transition-all',
        dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200',
        open && (dk ? 'border-blue-500/30' : 'border-blue-300')
      )}>
        {/* ── MAIN ROW ── */}
        <div className="px-4 py-2.5">
          {/* table-fixed layout — all cells are fixed width, no wrapping */}
          <div className="flex items-center gap-2 w-full min-w-0" style={{ minWidth: 0 }}>

            {/* Icon + toggle */}
            <button
              onClick={() => setOpen(!open)}
              className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white flex-shrink-0 transition-all"
            >
              <Building2 size={16} />
            </button>

            {/* Hotel Name — 180px fixed */}
            <div style={{ width: 180, minWidth: 180, maxWidth: 180, overflow: 'hidden' }}>
              <InlineEdit
                value={localHotel.name || ''} onChange={v => patchHotel({ name: v })}
                placeholder={lang === 'de' ? 'Hotelname' : 'Hotel name'} dk={dk}
                textClass={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}
              />
              <span className={colLabel}>{lang === 'de' ? 'Hotel' : 'Hotel'}</span>
            </div>

            {/* City — 96px fixed */}
            <div style={{ width: 96, minWidth: 96, maxWidth: 96, overflow: 'hidden' }}>
              <InlineEdit
                value={localHotel.city || ''} onChange={v => patchHotel({ city: v })}
                placeholder={lang === 'de' ? 'Stadt' : 'City'} dk={dk}
                textClass={cn('text-sm font-bold', dk ? 'text-slate-200' : 'text-slate-800')}
                datalistId={`city-list-${localHotel.id}`} datalistOptions={cityOptions}
              />
              <span className={colLabel}>{lang === 'de' ? 'Stadt' : 'City'}</span>
            </div>

            {/* Company — 104px fixed */}
            <div style={{ width: 104, minWidth: 104, maxWidth: 104, overflow: 'hidden' }}>
              <InlineEdit
                value={localHotel.companyTag || ''} onChange={v => patchHotel({ companyTag: v })}
                placeholder={lang === 'de' ? 'Firma' : 'Company'} dk={dk}
                textClass={cn('text-sm font-bold', dk ? 'text-purple-300' : 'text-purple-700')}
                datalistId={`company-list-${localHotel.id}`} datalistOptions={companyOptions}
              />
              <span className={colLabel}>{lang === 'de' ? 'Firma' : 'Company'}</span>
            </div>

            {/* Duration tags — 160px fixed */}
            <div style={{ width: 160, minWidth: 160, maxWidth: 160, overflow: 'hidden' }} className="flex items-center gap-1">
              {(localHotel.durations ?? []).slice(0, 2).map((d: any, i: number) => (
                <span key={d.id || i} className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 border',
                  dk ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                )} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}
                  title={durTag(d)}
                >{durTag(d)}</span>
              ))}
              {(localHotel.durations ?? []).length > 2 && (
                <span className={cn('text-[10px] font-bold flex-shrink-0', dk ? 'text-slate-500' : 'text-slate-400')}>
                  +{localHotel.durations.length - 2}
                </span>
              )}
              {(localHotel.durations ?? []).length === 0 && (
                <span className={cn('text-[10px]', dk ? 'text-slate-600' : 'text-slate-300')}>—</span>
              )}
            </div>

            {/* Nights — 60px fixed */}
            <div style={{ width: 60, minWidth: 60, maxWidth: 60 }} className="text-center flex-shrink-0">
              <p className="text-sm font-black text-blue-400 leading-none">{totalNights}</p>
              <p className={cn('text-[10px] uppercase tracking-widest mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Nächte' : 'Nights'}
              </p>
            </div>

            {/* Free beds — 48px fixed, RED if > 0 */}
            <div style={{ width: 48, minWidth: 48, maxWidth: 48 }} className="text-center flex-shrink-0">
              <p className={cn('text-sm font-black leading-none', freeBeds > 0 ? 'text-red-400' : 'text-green-400')}>
                {freeBeds}
              </p>
              <p className={cn('text-[10px] uppercase tracking-widest mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Frei' : 'Free'}
              </p>
            </div>

            {/* Employee pills — 148px fixed */}
            <div style={{ width: 148, minWidth: 148, maxWidth: 148, overflow: 'hidden' }} className="flex items-center gap-1 flex-shrink-0">
              {allEmployees.slice(0, 3).map((emp: any, i: number) => (
                <div key={emp.id || i}
                  className={cn('px-1.5 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0', pillCls(emp))}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 44 }}
                  title={`${emp.name} · ${formatDateDisplay(emp.checkIn, lang)} – ${formatDateDisplay(emp.checkOut, lang)}`}
                >
                  {(emp.name ?? '?').split(' ')[0]}
                </div>
              ))}
              {allEmployees.length > 3 && (
                <span className={cn('text-[10px] font-bold flex-shrink-0', dk ? 'text-slate-500' : 'text-slate-400')}>
                  +{allEmployees.length - 3}
                </span>
              )}
            </div>

            {/* Cost — 108px fixed, shows Brutto/Netto label */}
            <div style={{ width: 108, minWidth: 108, maxWidth: 108 }} className="text-right flex-shrink-0">
              <p className={cn('text-sm font-black leading-none', dk ? 'text-white' : 'text-slate-900')}>
                {formatCurrency(displayCost.amount)}
              </p>
              {displayCost.label && (
                <p className={cn('text-[10px] font-bold mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {displayCost.label}
                </p>
              )}
              {showPaymentTotals && paidCost > 0 && (
                <p className="text-[10px] text-green-400 font-bold">
                  {lang === 'de' ? 'bez. ' : 'paid '}{formatCurrency(paidCost)}
                </p>
              )}
            </div>

            {/* Saving spinner — 20px fixed */}
            <div style={{ width: 20, minWidth: 20 }} className="flex items-center justify-center flex-shrink-0">
              {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
            </div>

            {/* Actions — auto */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 transition-all',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {creatingDuration ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {lang === 'de' ? 'Dauer' : 'Duration'}
              </button>
              <button onClick={() => setConfirmDelete(true)}
                className={cn('p-1.5 rounded-lg transition-all',
                  dk ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}>
                <Trash2 size={14} />
              </button>
              <button onClick={() => setOpen(!open)}
                className={cn('p-1.5 rounded-lg transition-all',
                  dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── EXPANDED PANEL ── */}
        {open && (
          <div className={cn('border-t px-4 py-4 space-y-4',
            dk ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50')}>

            {/* ── Info row: 5 fields in ONE single horizontal line with labels ── */}
            <div className="flex gap-3 items-end" style={{ overflowX: 'auto' }}>
              {[
                { field: 'address',       de: 'Adresse',         en: 'Address',        w: 180 },
                { field: 'contactPerson', de: 'Ansprechpartner', en: 'Contact person',  w: 140 },
                { field: 'phone',         de: 'Telefon',         en: 'Phone',           w: 120 },
                { field: 'email',         de: 'E-Mail',          en: 'Email',           w: 180 },
                { field: 'webLink',       de: 'Webseite',        en: 'Website',         w: 160 },
              ].map(({ field, de, en, w }) => (
                <div key={field} style={{ minWidth: w, flexShrink: 0 }} className="flex flex-col gap-0.5">
                  <span className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? de : en}
                  </span>
                  <input
                    type="text"
                    value={(localHotel[field] as string) || ''}
                    placeholder="–"
                    onChange={e => patchHotel({ [field]: e.target.value })}
                    className={inputCls}
                    style={{ width: w }}
                  />
                </div>
              ))}
            </div>

            {/* ── Notes ── */}
            <div className="flex flex-col gap-0.5">
              <span className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Notizen' : 'Notes'}
              </span>
              <textarea
                value={localHotel.notes || ''}
                placeholder={lang === 'de' ? 'Interne Notizen...' : 'Internal notes...'}
                onChange={e => patchHotel({ notes: e.target.value })}
                className={cn(inputCls, 'min-h-[72px] resize-y')}
              />
            </div>

            {/* ── Duration tabs ── */}
            <div className="flex items-center gap-2 flex-wrap">
              {(localHotel.durations ?? []).map((d: any, i: number) => (
                <button key={d.id || i} onClick={() => setActiveDurationTab(i)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    activeDurationTab === i ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                  {getDurationTabLabel(d, lang)}
                </button>
              ))}
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {creatingDuration ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {lang === 'de' ? 'Neue Dauer' : 'Add duration'}
              </button>
            </div>

            {/* ── DurationCard or empty ── */}
            {(localHotel.durations ?? []).length > 0 ? (
              <DurationCard
                duration={localHotel.durations[activeDurationTab]}
                isDarkMode={dk} lang={lang}
                onUpdate={(id, updated) => {
                  const next = { ...localHotel, durations: localHotel.durations.map((d: any) => d.id === id ? updated : d) }
                  setLocalHotel(next); onUpdate(localHotel.id, next)
                }}
                onDelete={durationId => {
                  const nextDurations = localHotel.durations.filter((d: any) => d.id !== durationId)
                  const next = { ...localHotel, durations: nextDurations }
                  setLocalHotel(next); onUpdate(localHotel.id, next)
                  setActiveDurationTab(prev => Math.max(0, Math.min(prev, nextDurations.length - 1)))
                }}
              />
            ) : (
              <button onClick={addDuration} disabled={creatingDuration}
                className={cn('w-full py-6 rounded-xl border-2 border-dashed text-sm font-bold transition-all',
                  dk ? 'border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400'
                    : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-500')}>
                {creatingDuration
                  ? (lang === 'de' ? 'Erstelle...' : 'Creating...')
                  : (lang === 'de' ? '+ Erste Dauer hinzufügen' : '+ Add first duration')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={cn('w-full max-w-sm rounded-2xl border p-5 shadow-2xl',
            dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Hotel löschen?' : 'Delete hotel?'}</h3>
            <p className={cn('text-sm mb-5', dk ? 'text-slate-400' : 'text-slate-600')}>
              <span className="font-bold">{localHotel.name || '—'}</span>
              {lang === 'de' ? ' und alle zugehörigen Buchungen werden dauerhaft gelöscht.' : ' and all related durations will be permanently deleted.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className={cn('px-4 py-2 rounded-lg border text-sm font-bold',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={() => onDelete(localHotel.id)}
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
