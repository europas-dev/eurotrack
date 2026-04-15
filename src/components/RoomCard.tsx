// src/components/RoomCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2,
  Minus, Plus, Tag, Trash2, X, Zap, CornerDownRight, Moon, Calendar
} from 'lucide-react'
import { cn, calculateNights, formatCurrency, normalizeNumberInput, getEmployeeStatus } from '../lib/utils'
import { bedsForType, calcRoomCardTotal, extractPricingFields } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Employee, PricingTab, RoomCard as RoomCardType } from '../lib/types'

const noSpinner: React.CSSProperties = {
  MozAppearance: 'textfield' as any,
  WebkitAppearance: 'none' as any,
}

function empBorderColor(emp: Employee | null, dk: boolean): string {
  if (!emp) return dk ? 'border-white/10' : 'border-slate-200'
  const s = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '')
  if (s === 'active')       return dk ? 'border-emerald-500/60' : 'border-emerald-500'
  if (s === 'ending-soon')  return dk ? 'border-red-500/60'     : 'border-red-500'
  if (s === 'completed')    return dk ? 'border-slate-500/40'   : 'border-slate-400'
  if (s === 'upcoming')     return dk ? 'border-blue-500/60'    : 'border-blue-500'
  return dk ? 'border-white/10' : 'border-slate-200'
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function BedSlot({
  slotIndex, employee, durationStart, durationEnd, gapStart, gapEnd,
  roomCardId, durationId, dk, lang, isSubstitute, onUpdated,
}: {
  slotIndex: number; employee: Employee | null; durationStart: string; durationEnd: string;
  gapStart?: string; gapEnd?: string; roomCardId: string; durationId: string;
  dk: boolean; lang: 'de' | 'en'; isSubstitute?: boolean;
  onUpdated: (slotIndex: number, emp: Employee | null, isGapFill?: boolean, deletedId?: string) => void
}) {
  const [editing, setEditing]     = useState(false)
  const [name, setName]           = useState(employee?.name ?? '')
  const [checkIn, setCheckIn]     = useState(employee?.checkIn  ?? gapStart ?? durationStart)
  const [checkOut, setCheckOut]   = useState(employee?.checkOut ?? gapEnd   ?? durationEnd)
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveIn  = gapStart ?? durationStart
  const effectiveOut = gapEnd   ?? durationEnd
  const nights = calculateNights(checkIn, checkOut)
  const status = employee ? getEmployeeStatus(employee.checkIn ?? '', employee.checkOut ?? '') : null
  const borderCls = empBorderColor(employee, dk)
  
  const isPartial = employee && (employee.checkIn > durationStart || employee.checkOut < durationEnd);

  const inputCls = cn(
    'px-3 py-1.5 rounded-lg text-sm outline-none border transition-all h-[36px]',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  )

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (employee?.id) {
        const payload = { id: employee.id, name: name.trim(), checkIn, checkOut };
        await enqueue({ type: 'updateEmployee', payload });
        onUpdated(slotIndex, { ...employee, ...payload });
      } else {
        const isGapFill = !!(gapStart || gapEnd)
        const newId = crypto.randomUUID();
        const payload = { id: newId, durationId, roomCardId, slotIndex, name: name.trim(), checkIn, checkOut };
        await enqueue({ type: 'createEmployee', payload });
        onUpdated(slotIndex, payload as any, isGapFill);
      }
      setEditing(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!employee?.id) { onUpdated(slotIndex, null); return }
    setSaving(true)
    try {
      await enqueue({ type: 'deleteEmployee', payload: { id: employee.id } });
      onUpdated(slotIndex, null, false, employee.id)
      setName(''); setEditing(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const statusColor: Record<string, string> = {
    active:         dk ? 'text-emerald-400' : 'text-emerald-600',
    'ending-soon':  dk ? 'text-red-400'    : 'text-red-500',
    completed:      dk ? 'text-slate-400'  : 'text-slate-500',
    upcoming:       dk ? 'text-blue-400'   : 'text-blue-500',
  }

  const IconToUse = isSubstitute ? CornerDownRight : Bed;

  if (confirmDel) {
    return (
      <div className={cn('flex items-center justify-between px-3 py-1.5 rounded-lg border', dk ? 'bg-red-900/10 border-red-500/30' : 'bg-red-50 border-red-200')}>
        <span className={cn('text-sm font-bold', dk ? 'text-red-300' : 'text-red-700')}>Delete {employee?.name}?</span>
        <div className="flex gap-2">
          <button onClick={remove} disabled={saving} className="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold">{lang === 'de' ? 'Ja' : 'Yes'}</button>
          <button onClick={() => setConfirmDel(false)} className={cn('px-3 py-1 rounded text-xs font-bold border', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
        </div>
      </div>
    )
  }

  if (!editing && employee) {
    return (
      <div className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all group',
        borderCls, isPartial ? 'border-dashed' : 'border-solid', dk ? 'bg-white/5' : 'bg-white'
      )}>
        <IconToUse size={14} className={statusColor[status ?? 'active'] ?? (dk ? 'text-slate-400' : 'text-slate-500')} />
        <span onClick={() => { setName(employee.name); setCheckIn(employee.checkIn ?? effectiveIn); setCheckOut(employee.checkOut ?? effectiveOut); setEditing(true) }}
          className={cn('text-sm font-bold flex-1 cursor-pointer truncate', dk ? 'text-white' : 'text-slate-900')}>
          {employee.name}
        </span>
        <span className={cn('text-[11px] tabular-nums shrink-0 hidden sm:block', dk ? 'text-slate-400' : 'text-slate-500')}>
          {fmtDate(employee.checkIn ?? '')} ➔ {fmtDate(employee.checkOut ?? '')}
        </span>
        <span className={cn('text-[12px] font-bold shrink-0 w-8 text-right', dk ? 'text-slate-300' : 'text-slate-600')}>{nights}N</span>
        {saving ? <Loader2 size={14} className="animate-spin text-blue-400" /> : (
          <button onClick={() => setConfirmDel(true)} className={cn('opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded', dk ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50')}><Trash2 size={14} /></button>
        )}
      </div>
    )
  }

  if (!editing) {
    const isGap = !!(gapStart || gapEnd)
    return (
      <button onClick={() => { setCheckIn(effectiveIn); setCheckOut(effectiveOut); setEditing(true); setTimeout(() => inputRef.current?.focus(), 40) }}
        className={cn('w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-xs font-bold transition-all',
          isGap ? (dk ? 'border-amber-500/40 text-amber-400 hover:bg-amber-900/10' : 'border-amber-400 text-amber-600 hover:bg-amber-50')
                : (dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500')
        )}>
        <Plus size={14} /> {isGap ? `${lang === 'de' ? 'Lücke füllen' : 'Fill gap'} (${fmtDate(effectiveIn)} ➔ ${fmtDate(effectiveOut)})` : (lang === 'de' ? 'Bett zuweisen' : 'Assign bed')}
      </button>
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5 p-1.5 rounded-lg border flex-wrap sm:flex-nowrap', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
      <IconToUse size={14} className={dk ? 'text-blue-400 ml-1 hidden sm:block' : 'text-blue-500 ml-1 hidden sm:block'} />
      <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Name..." className={cn(inputCls, 'flex-1 min-w-[120px]')} />
      <input type="date" value={checkIn} min={effectiveIn} max={effectiveOut} onChange={e => setCheckIn(e.target.value)} className={cn(inputCls, 'w-[115px] px-2 text-[10px]')} />
      <span className="text-slate-400 text-xs hidden sm:block">➔</span>
      <input type="date" value={checkOut} min={checkIn} max={effectiveOut} onChange={e => setCheckOut(e.target.value)} className={cn(inputCls, 'w-[115px] px-2 text-[10px]')} />
      <div className={cn('px-2 rounded border text-[10px] font-bold text-center h-[36px] flex items-center justify-center shrink-0', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} style={{ width: 36 }}>{nights}N</div>
      <button onClick={save} disabled={saving || !name.trim()} className="px-3 h-[36px] rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center shrink-0">{saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}</button>
      <button onClick={() => setEditing(false)} className={cn('px-2 h-[36px] rounded text-sm transition-all shrink-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}><X size={14} /></button>
    </div>
  )
}

function getGapSlots(beds: number, employees: Employee[], durationStart: string, durationEnd: string): { slotIndex: number; gapStart: string; gapEnd: string }[] {
  const gaps: { slotIndex: number; gapStart: string; gapEnd: string }[] = []
  const occupied: Record<number, Employee[]> = {}
  employees.forEach(e => {
    const si = e.slotIndex ?? 0
    occupied[si] = occupied[si] ?? []
    occupied[si].push(e)
  })
  for (let i = 0; i < beds; i++) {
    const occs = (occupied[i] ?? []).sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? ''))
    if (occs.length === 0) continue
    const first = occs[0]
    if (first.checkIn && first.checkIn > durationStart) gaps.push({ slotIndex: i, gapStart: durationStart, gapEnd: first.checkIn })
    for (let j = 0; j < occs.length - 1; j++) {
      const curr = occs[j]; const next = occs[j + 1]
      if (curr.checkOut && next.checkIn && curr.checkOut < next.checkIn) gaps.push({ slotIndex: i, gapStart: curr.checkOut, gapEnd: next.checkIn })
    }
    const last = occs[occs.length - 1]
    if (last.checkOut && last.checkOut < durationEnd) gaps.push({ slotIndex: i, gapStart: last.checkOut, gapEnd: durationEnd })
  }
  return gaps
}

function NMBRow({
  nettoKey, mwstKey, bruttoKey, energyNettoKey, energyMwstKey, energyBruttoKey,
  card, dk, inputCls, onPatch, lang, multiplier, nettoLabel, bruttoLabel, disabled,
}: {
  nettoKey: keyof RoomCardType; mwstKey: keyof RoomCardType; bruttoKey: keyof RoomCardType;
  energyNettoKey?: keyof RoomCardType; energyMwstKey?: keyof RoomCardType; energyBruttoKey?: keyof RoomCardType;
  card: RoomCardType; dk: boolean; inputCls: string; onPatch: (p: Partial<RoomCardType>) => void;
  lang: 'de' | 'en'; multiplier: number; nettoLabel?: string; bruttoLabel?: string; disabled?: boolean;
}) {
  const nLabel = nettoLabel ?? 'Netto (€)'
  const bLabel = bruttoLabel ?? 'Brutto (€)'

  const netto  = card[nettoKey]  as number | null | undefined
  const mwst   = card[mwstKey]   as number | null | undefined
  const brutto = card[bruttoKey] as number | null | undefined

  const derivedBrutto = (brutto == null || brutto === 0) && netto && mwst ? Number((netto * (1 + mwst / 100)).toFixed(2)) : null
  const derivedNetto  = (netto == null || netto === 0) && brutto && mwst ? Number((brutto / (1 + mwst / 100)).toFixed(2)) : null

  const displayNetto = (netto ?? derivedNetto ?? '') as any;
  const displayBrutto = (brutto ?? derivedBrutto ?? '') as any;
  const totalNetto = (netto ?? derivedNetto ?? 0) * multiplier;
  const totalBrutto = (brutto ?? derivedBrutto ?? 0) * multiplier;

  const eNetto  = energyNettoKey ? card[energyNettoKey] as number | null | undefined : null
  const eMwst   = energyMwstKey ? card[energyMwstKey] as number | null | undefined : null
  const eBrutto = energyBruttoKey ? card[energyBruttoKey] as number | null | undefined : null

  const derivedEnergyBrutto = (eBrutto == null || eBrutto === 0) && eNetto && eMwst ? Number((eNetto * (1 + eMwst / 100)).toFixed(2)) : null
  const derivedEnergyNetto  = (eNetto == null || eNetto === 0) && eBrutto && eMwst ? Number((eBrutto / (1 + eMwst / 100)).toFixed(2)) : null

  const displayEnergyNetto = (eNetto ?? derivedEnergyNetto ?? '') as any;
  const displayEnergyBrutto = (eBrutto ?? derivedEnergyBrutto ?? '') as any;
  const totalEnergyNetto = (eNetto ?? derivedEnergyNetto ?? 0) * multiplier;
  const totalEnergyBrutto = (eBrutto ?? derivedEnergyBrutto ?? 0) * multiplier;

  const lbl = cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')
  const disabledInputCls = cn(inputCls, 'opacity-40 cursor-not-allowed pointer-events-none')

  return (
    <div className={cn('space-y-5', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex flex-col flex-1 min-w-0">
          <p className={lbl}>{nLabel}</p>
          <input type="number" min={0} step="0.01" value={displayNetto} placeholder="0.00" disabled={disabled} onChange={e => onPatch({ [nettoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-full')} />
          {multiplier > 0 && totalNetto > 0 && (<span className={cn('text-[11px] mt-1.5 font-bold pl-1', dk ? 'text-slate-500' : 'text-slate-400')}>Σ {formatCurrency(totalNetto)}</span>)}
        </div>
        <div className="flex flex-col shrink-0">
          <p className={lbl}>MwSt (%)</p>
          <input type="number" min={0} max={99} step="0.5" value={(mwst ?? '') as any} placeholder="%" disabled={disabled} onChange={e => onPatch({ [mwstKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={{ ...noSpinner, width: 72 }} className={disabled ? disabledInputCls : inputCls} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <p className={lbl}>{bLabel}</p>
          <input type="number" min={0} step="0.01" value={displayBrutto} placeholder="0.00" disabled={disabled} onChange={e => onPatch({ [bruttoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-full', derivedBrutto != null && !brutto && (dk ? 'text-amber-300' : 'text-amber-600'))} />
          {multiplier > 0 && totalBrutto > 0 && (<span className={cn('text-[11px] mt-1.5 font-bold pl-1', dk ? 'text-slate-500' : 'text-slate-400')}>Σ {formatCurrency(totalBrutto)}</span>)}
        </div>
      </div>

      {/* RESTORED: Energy Price Row */}
      {energyNettoKey && energyMwstKey && energyBruttoKey && (
        <div className={cn("flex items-start gap-3 flex-wrap p-4 rounded-xl border border-dashed", dk ? "border-yellow-500/30 bg-yellow-500/5" : "border-yellow-400/50 bg-yellow-50")}>
          <div className="flex flex-col flex-1 min-w-0">
            <p className={lbl}><Zap size={12} className="inline mr-1 text-yellow-500" />En. Netto</p>
            <input type="number" min={0} step="0.01" value={displayEnergyNetto} placeholder="0.00" disabled={disabled} onChange={e => onPatch({ [energyNettoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-full')} />
            {multiplier > 0 && totalEnergyNetto > 0 && (<span className={cn('text-[11px] mt-1.5 font-bold pl-1', dk ? 'text-yellow-600/70' : 'text-yellow-600/80')}>Σ {formatCurrency(totalEnergyNetto)}</span>)}
          </div>
          <div className="flex flex-col shrink-0">
            <p className={lbl}>MwSt</p>
            <input type="number" min={0} max={99} step="0.5" value={(eMwst ?? '') as any} placeholder="%" disabled={disabled} onChange={e => onPatch({ [energyMwstKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={{ ...noSpinner, width: 72 }} className={disabled ? disabledInputCls : inputCls} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <p className={lbl}>En. Brutto</p>
            <input type="number" min={0} step="0.01" value={displayEnergyBrutto} placeholder="0.00" disabled={disabled} onChange={e => onPatch({ [energyBruttoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-full', derivedEnergyBrutto != null && !eBrutto && (dk ? 'text-amber-300' : 'text-amber-600'))} />
            {multiplier > 0 && totalEnergyBrutto > 0 && (<span className={cn('text-[11px] mt-1.5 font-bold pl-1', dk ? 'text-yellow-600/70' : 'text-yellow-600/80')}>Σ {formatCurrency(totalEnergyBrutto)}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

export function getEffectiveNetto(netto: number|null|undefined, mwst: number|null|undefined, brutto: number|null|undefined) {
  if (netto != null && netto > 0) return netto;
  if (brutto != null && brutto > 0) return brutto / (1 + (mwst || 7) / 100);
  return 0;
}

export default function RoomCard({
  card, durationStart, durationEnd, dk, lang, allCardsOfSameType, bruttoNettoActive = false,
  onUpdate, onDelete, onApplyToSameType,
}: {
  card: RoomCardType; durationStart: string; durationEnd: string; dk: boolean; lang: 'de'|'en';
  allCardsOfSameType: RoomCardType[]; bruttoNettoActive?: boolean;
  onUpdate: (id: string, patch: Partial<RoomCardType>) => void; onDelete: (id: string) => void; onApplyToSameType: (source: RoomCardType) => void;
}) {
  const [isOpen, setIsOpen]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const saveTimer = useRef<any>(null)

  const beds   = bedsForType(card.roomType, card.bedCount)
  const nights = calculateNights(durationStart, durationEnd)
  const total  = bruttoNettoActive ? 0 : calcRoomCardTotal(card, durationStart, durationEnd)
  const activeTab: PricingTab = card.pricingTab ?? 'per_room'
  const employees = card.employees ?? []
  const gapSlots  = getGapSlots(beds, employees, durationStart, durationEnd)

  let derivedNettoPerBed = 0;
  if (activeTab === 'per_bed') derivedNettoPerBed = getEffectiveNetto(card.bedNetto, card.bedMwst, card.bedBrutto);
  else if (activeTab === 'per_room' && beds > 0) derivedNettoPerBed = getEffectiveNetto(card.roomNetto, card.roomMwst, card.roomBrutto) / beds;
  else if (activeTab === 'total_room' && beds > 0 && nights > 0) derivedNettoPerBed = getEffectiveNetto(card.totalNetto, card.totalMwst, card.totalBrutto) / (beds * nights);

  const inputCls = cn('px-3 py-2 rounded-lg text-sm outline-none border transition-all h-[38px]', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
  const labelCls = cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')
  const tabBtn = (active: boolean) => cn('px-4 py-2 rounded-lg text-sm font-bold border transition-all', active ? 'bg-amber-500 text-white border-amber-500' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    onUpdate(card.id, patch)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...patch } }) }
      catch (e) { console.error(e) } finally { setSaving(false) }
    }, 400)
  }

  function onEmployeeUpdated(slotIndex: number, emp: Employee | null, isGapFill?: boolean, deletedId?: string) {
    let next: Employee[]
    if (deletedId) next = employees.filter(e => e.id !== deletedId)
    else if (emp === null) next = employees.filter(e => (e.slotIndex ?? 0) !== slotIndex)
    else {
      const exists = employees.some(e => e.id === emp.id)
      if (exists) next = employees.map(e => e.id === emp.id ? emp : e)
      else next = [...employees, emp]
    }
    onUpdate(card.id, { employees: next as Employee[] })
  }

  const roomTotal = bruttoNettoActive ? '—' : formatCurrency(total)
  const currentMultiplier = activeTab === 'per_bed' ? (beds * nights) : activeTab === 'per_room' ? nights : 1;

  return (
    <div className={cn('rounded-xl border transition-all shadow-sm flex flex-col w-full', bruttoNettoActive ? (dk ? 'bg-[#0d1629] border-white/5 opacity-75' : 'bg-white border-slate-100 opacity-75') : (dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'))}>
      
      {/* THE ACCORDION HEADER */}
      <div 
        className={cn("flex items-center gap-4 px-4 py-3 cursor-pointer w-full", isOpen && (dk ? "border-b border-white/10" : "border-b border-slate-100"))}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'SELECT') {
            setIsOpen(!isOpen);
          }
        }}
      >
        <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={cn("p-1.5 rounded-md transition-all shrink-0", dk ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {!isOpen ? (
           // CLOSED STATE
           <>
             <div className="flex items-center gap-3 shrink-0">
               <span className={cn("font-black", dk ? "text-white" : "text-slate-900")}>{card.roomType}</span>
               <span className={cn("text-sm font-bold", dk ? "text-slate-300" : "text-slate-700")}>{card.roomNo || '---'}</span>
               <span className={cn('text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-500 tabular-nums')}>{nights}N · {beds}B</span>
             </div>
             
             <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar items-center pl-2">
                {employees.map(emp => {
                   const isPartial = emp.checkIn > durationStart || emp.checkOut < durationEnd;
                   const status = getEmployeeStatus(emp.checkIn||'', emp.checkOut||'');
                   const bg = status === 'active' ? 'bg-emerald-500' : status === 'ending-soon' ? 'bg-red-500' : status === 'upcoming' ? 'bg-blue-500' : 'bg-slate-400';
                   return (
                     <div key={emp.id} className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[11px] whitespace-nowrap border", isPartial ? "border-dashed" : "border-solid", dk ? "bg-[#1E293B] border-white/5 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
                        <span className={cn("w-2 h-2 rounded-full", bg)} />
                        <span className="font-bold truncate max-w-[100px]">{emp.name}</span>
                        {isPartial && <span className="text-[9px] opacity-60 ml-0.5">{fmtDate(emp.checkIn||'')} ➔ {fmtDate(emp.checkOut||'')}</span>}
                     </div>
                   )
                })}
                {employees.length < beds && (
                   <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[11px] whitespace-nowrap border border-dashed", dk ? "border-amber-500/30 text-amber-500 bg-amber-500/5" : "border-amber-300 text-amber-600 bg-amber-50")}>
                      + Empty Bed
                   </div>
                )}
             </div>

             <div className="flex flex-col items-end shrink-0 ml-4">
                <span className={cn('text-lg font-black tabular-nums leading-none', dk ? 'text-white' : 'text-slate-900')}>{roomTotal}</span>
             </div>
             
             <button onClick={(e) => { e.stopPropagation(); setConfirm(true); }} className={cn('p-1.5 rounded transition-all shrink-0 ml-2', dk ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}><Trash2 size={16} /></button>
           </>
        ) : (
           // EXPANDED STATE
           <div className="flex items-center gap-3 flex-1 flex-wrap">
             <select value={card.roomType} onChange={e => { const rt = e.target.value as any; queueSave({ roomType: rt, bedCount: rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount }) }} className={cn(inputCls, 'w-20 font-bold text-center pl-2 pr-0')}>
                <option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option><option value="WG">WG</option>
             </select>
             
             {/* RESTORED: WG Bed Counter */}
             {card.roomType === 'WG' && (
               <div className={cn('flex items-center rounded-lg border overflow-hidden shrink-0 h-[38px]', dk ? 'border-white/10' : 'border-slate-200')}>
                 <button onClick={(e) => { e.stopPropagation(); queueSave({ bedCount: Math.max(1, card.bedCount - 1) }) }} className={cn('px-2.5 h-full', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Minus size={14} /></button>
                 <span className={cn('px-2 text-sm font-bold min-w-[32px] text-center flex items-center justify-center h-full', dk ? 'bg-white/5 text-white' : 'bg-slate-50 text-slate-900')}>{card.bedCount}</span>
                 <button onClick={(e) => { e.stopPropagation(); queueSave({ bedCount: card.bedCount + 1 }) }} className={cn('px-2.5 h-full', dk ? 'hover:bg-white/10' : 'hover:bg-slate-50')}><Plus size={14} /></button>
               </div>
             )}

             <div className="flex items-center gap-1.5 ml-2">
                <span className={labelCls}>No:</span>
                <input type="text" value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="101" className={cn(inputCls, 'w-20 font-bold')} />
             </div>
             <div className="flex items-center gap-1.5">
                <span className={labelCls}>Etg:</span>
                <input type="text" value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="1" className={cn(inputCls, 'w-16')} />
             </div>
             <span className={cn('text-xs font-bold px-2 py-1.5 rounded bg-blue-500/10 text-blue-500 shrink-0 tabular-nums ml-1')}>{nights}N · {beds}B</span>
             
             <div className="flex-1" />
             
             <button onClick={(e) => { e.stopPropagation(); setShowCalendar(c => !c) }} className={cn('px-3 h-[38px] rounded-lg text-sm font-bold border transition-all flex items-center', showCalendar ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}><Calendar size={14}/></button>
             <button onClick={(e) => { e.stopPropagation(); setShowPricing(p => !p) }} className={cn('px-3 h-[38px] rounded-lg text-sm font-bold border transition-all flex items-center gap-2', showPricing ? 'bg-amber-500 text-white border-amber-500' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>Price {showPricing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
             
             <div className="flex flex-col items-end min-w-[100px] ml-2">
               <span className={cn('text-xl font-black tabular-nums leading-none', dk ? 'text-white' : 'text-slate-900')}>{roomTotal}</span>
               {!bruttoNettoActive && derivedNettoPerBed > 0 && (<span className={cn('text-[10px] tabular-nums mt-1 font-bold', dk ? 'text-slate-500' : 'text-slate-400')}>{formatCurrency(derivedNettoPerBed)} n/b/N</span>)}
             </div>
             
             <button onClick={(e) => { e.stopPropagation(); setConfirm(true); }} className={cn('p-2 rounded-lg border transition-all ml-2', dk ? 'border-red-500/20 text-red-400 hover:bg-red-900/20' : 'border-red-200 text-red-500 hover:bg-red-50')}><Trash2 size={16} /></button>
           </div>
        )}
      </div>

      {/* EXPANDED CONTENT (Pricing, Calendar, and Beds Grid) */}
      {isOpen && (
        <div className={cn("p-4 rounded-b-xl space-y-5", dk ? "bg-black/20" : "bg-slate-50/50")}>
           
           {/* PRICING PANEL */}
           {showPricing && (
             <div className={cn("p-4 rounded-xl border", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                {bruttoNettoActive && (
                  <div className={cn("p-3 text-xs font-bold rounded-lg mb-4", dk ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200")}>
                    {lang === 'de' ? 'Preise werden über die Hauptdauer (Brutto/Netto-Modus) gesteuert.' : 'Prices are controlled by the main duration (Brutto/Netto mode active).'}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-5">
                  <button onClick={() => queueSave({ pricingTab: 'per_bed' })} disabled={bruttoNettoActive} className={tabBtn(activeTab === 'per_bed')}>{lang === 'de' ? 'Preis/Bett' : 'Price/Bed'}</button>
                  <button onClick={() => queueSave({ pricingTab: 'per_room' })} disabled={bruttoNettoActive} className={tabBtn(activeTab === 'per_room')}>{lang === 'de' ? 'Preis/Zi.' : 'Price/Room'}</button>
                  <button onClick={() => queueSave({ pricingTab: 'total_room' })} disabled={bruttoNettoActive} className={tabBtn(activeTab === 'total_room')}>{lang === 'de' ? 'Gesamt/Zi.' : 'Total/Room'}</button>
                </div>
                {activeTab === 'per_bed' && <NMBRow nettoKey="bedNetto" mwstKey="bedMwst" bruttoKey="bedBrutto" energyNettoKey="bedEnergyNetto" energyMwstKey="bedEnergyMwst" energyBruttoKey="bedEnergyBrutto" card={card} dk={dk} inputCls={inputCls} onPatch={queueSave} lang={lang} multiplier={currentMultiplier} nettoLabel={lang === 'de' ? 'Netto/Bett (€)' : 'Netto/Bed (€)'} bruttoLabel={lang === 'de' ? 'Brutto/Bett (€)' : 'Brutto/Bed (€)'} disabled={bruttoNettoActive} />}
                {activeTab === 'per_room' && <NMBRow nettoKey="roomNetto" mwstKey="roomMwst" bruttoKey="roomBrutto" energyNettoKey="roomEnergyNetto" energyMwstKey="roomEnergyMwst" energyBruttoKey="roomEnergyBrutto" card={card} dk={dk} inputCls={inputCls} onPatch={queueSave} lang={lang} multiplier={currentMultiplier} nettoLabel={lang === 'de' ? 'Netto/Zi. (€)' : 'Netto/Room (€)'} bruttoLabel={lang === 'de' ? 'Brutto/Zi. (€)' : 'Brutto/Room (€)'} disabled={bruttoNettoActive} />}
                {activeTab === 'total_room' && <NMBRow nettoKey="totalNetto" mwstKey="totalMwst" bruttoKey="totalBrutto" energyNettoKey="totalEnergyNetto" energyMwstKey="totalEnergyMwst" energyBruttoKey="totalEnergyBrutto" card={card} dk={dk} inputCls={inputCls} onPatch={queueSave} lang={lang} multiplier={currentMultiplier} nettoLabel={lang === 'de' ? 'Netto ges. (€)' : 'Netto total (€)'} bruttoLabel={lang === 'de' ? 'Brutto ges. (€)' : 'Brutto total (€)'} disabled={bruttoNettoActive} />}
                <div className="flex items-end gap-3 flex-wrap mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button disabled={bruttoNettoActive} onClick={() => queueSave({ hasDiscount: !card.hasDiscount })} className={cn('px-4 py-2 rounded-lg text-sm font-bold border flex items-center gap-1.5 transition-all', card.hasDiscount ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50', bruttoNettoActive && "opacity-50 pointer-events-none")}>
                    <Tag size={14} />{lang === 'de' ? 'Rabatt' : 'Disc.'}
                  </button>
                  {card.hasDiscount && (
                    <div className={cn("flex items-end gap-1", bruttoNettoActive && "opacity-50 pointer-events-none")}>
                      <button disabled={bruttoNettoActive} onClick={() => queueSave({ discountType: card.discountType === 'percentage' ? 'fixed' : 'percentage' })} className={cn('px-3 py-2 rounded-l-lg rounded-r-none border-y border-l text-sm font-bold', dk ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                        {card.discountType === 'percentage' ? '%' : '€'}
                      </button>
                      <input disabled={bruttoNettoActive} type="number" min={0} value={card.discountValue || ''} placeholder={card.discountType === 'percentage' ? '10' : '50'} onChange={e => queueSave({ discountValue: normalizeNumberInput(e.target.value) })} style={{ ...noSpinner, width: 80 }} className={cn('px-3 py-2 rounded-r-lg rounded-l-none border-y border-r text-sm outline-none', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} />
                    </div>
                  )}
                  {allCardsOfSameType.length > 1 && (
                    <button onClick={() => onApplyToSameType(card)} className={cn('px-4 py-2 rounded-lg text-sm font-bold border flex items-center gap-1.5 transition-all ml-auto', dk ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-blue-400' : 'border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600')}>
                      <Copy size={14} /> {lang === 'de' ? `Alle ${card.roomType}` : `All ${card.roomType}`}
                    </button>
                  )}
                </div>
             </div>
           )}

           {/* CALENDAR PANEL */}
           {showCalendar && durationStart && durationEnd && (
             <div className={cn('px-4 py-4 rounded-xl border', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
               <p className={cn('text-[11px] font-bold uppercase tracking-widest mb-3', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Nachtkalender' : 'Night calendar'}</p>
               <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
                 {Array.from({ length: nights }).map((_, i) => {
                   const d = new Date(durationStart); d.setDate(d.getDate() + i)
                   const iso = d.toISOString().split('T')[0]
                   const [y, m, dd] = iso.split('-')
                   return (
                     <div key={iso} className={cn('rounded-lg border p-2', dk ? 'bg-[#1E293B] border-white/5' : 'bg-slate-50 border-slate-200')}>
                       <p className={cn('text-[10px] font-bold mb-1', dk ? 'text-slate-400' : 'text-slate-600')}>{dd}/{m}/{y}</p>
                       <p className={cn('text-xs font-bold', dk ? 'text-white' : 'text-slate-900')}>{formatCurrency(card.nightlyPrice || 0)}</p>
                     </div>
                   )
                 })}
               </div>
             </div>
           )}
           
           {/* HORIZONTAL BED GRID */}
           <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))` }}>
              {Array.from({ length: beds }).map((_, i) => {
                 const slotEmps = employees.filter(e => (e.slotIndex ?? 0) === i).sort((a,b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                 const slotGaps = gapSlots.filter(g => g.slotIndex === i);
                 
                 return (
                   <div key={i} className="space-y-2">
                     <div className="flex items-center justify-between pb-1 px-1">
                       <span className={cn('text-[10px] font-black tracking-widest flex items-center gap-1.5', dk ? 'text-slate-400' : 'text-slate-500')}>
                         <Bed size={12} /> {lang === 'de' ? `BETT ${i + 1}` : `BED ${i + 1}`}
                       </span>
                     </div>
                     {slotEmps.length === 0 ? (
                        <BedSlot slotIndex={i} employee={null} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={onEmployeeUpdated} />
                     ) : (
                        slotEmps.map((emp, empIdx) => (
                           <BedSlot key={emp.id} slotIndex={i} employee={emp} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} isSubstitute={empIdx > 0} onUpdated={onEmployeeUpdated} />
                        ))
                     )}
                     {slotGaps.map((gap, gi) => (
                        <BedSlot key={`gap-${i}-${gi}`} slotIndex={i} employee={null} durationStart={durationStart} durationEnd={durationEnd} gapStart={gap.gapStart} gapEnd={gap.gapEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={onEmployeeUpdated} />
                     ))}
                   </div>
                 )
              })}
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-sm rounded-2xl border p-5 shadow-2xl', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-lg font-black mb-2">{lang === 'de' ? 'Zimmerkarte löschen?' : 'Delete room card?'}</h3>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setConfirm(false)} className={cn('px-4 py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={async () => { await enqueue({ type: 'deleteRoomCard', payload: { id: card.id } }); onDelete(card.id); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
