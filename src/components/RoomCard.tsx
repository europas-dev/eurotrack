// src/components/RoomCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2, Phone,
  Minus, Plus, Tag, Trash2, X, Zap, CornerDownRight, Moon, Calendar, Check, Ticket
} from 'lucide-react'
import { cn, calculateNights, formatCurrency, normalizeNumberInput, getEmployeeStatus } from '../lib/utils'
import { bedsForType, calcRoomCardTotal, calcRoomCardNettoSum } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Employee, PricingTab, RoomCard as RoomCardType } from '../lib/types'

const noSpinner: React.CSSProperties = { MozAppearance: 'textfield' as any, WebkitAppearance: 'none' as any }

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function empBorderColor(emp: Employee | null, dk: boolean): string {
  if (!emp) return dk ? 'border-white/10' : 'border-slate-200'
  const s = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '')
  if (s === 'active') return dk ? 'border-emerald-500/60' : 'border-emerald-500'
  if (s === 'ending-soon') return dk ? 'border-red-500/60' : 'border-red-500'
  if (s === 'completed') return dk ? 'border-slate-500/40' : 'border-slate-400'
  if (s === 'upcoming') return dk ? 'border-blue-500/60' : 'border-blue-500'
  return dk ? 'border-white/10' : 'border-slate-200'
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
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(employee?.name ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '+49 ')
  const [checkIn, setCheckIn] = useState(employee?.checkIn ?? gapStart ?? durationStart)
  const [checkOut, setCheckOut] = useState(employee?.checkOut ?? gapEnd ?? durationEnd)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveIn = gapStart ?? durationStart
  const effectiveOut = gapEnd ?? durationEnd
  const nights = calculateNights(checkIn, checkOut)
  const status = employee ? getEmployeeStatus(employee.checkIn ?? '', employee.checkOut ?? '') : null
  const borderCls = empBorderColor(employee, dk)
  const isPartial = employee && (employee.checkIn > durationStart || employee.checkOut < durationEnd);

  const inputCls = cn(
    'px-3 py-1.5 rounded-lg text-sm outline-none border transition-all h-[38px]',
    dk ? 'bg-white/5 border-white/10 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
  )

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const cleanPhone = phone.trim() === '+49' ? '' : phone.trim();
    try {
      if (employee?.id) {
        const payload = { id: employee.id, name: name.trim(), phone: cleanPhone, checkIn, checkOut };
        await enqueue({ type: 'updateEmployee', payload });
        onUpdated(slotIndex, { ...employee, ...payload });
      } else {
        const isGapFill = !!(gapStart || gapEnd)
        const newId = crypto.randomUUID();
        const payload = { id: newId, durationId, roomCardId, slotIndex, name: name.trim(), phone: cleanPhone, checkIn, checkOut };
        await enqueue({ type: 'createEmployee', payload });
        onUpdated(slotIndex, payload as any, isGapFill);
      }
      setEditing(false)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function remove() {
    if (!employee?.id) { onUpdated(slotIndex, null); return }
    setSaving(true)
    try {
      await enqueue({ type: 'deleteEmployee', payload: { id: employee.id } });
      onUpdated(slotIndex, null, false, employee.id)
      setName(''); setPhone('+49 '); setEditing(false)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const IconToUse = isSubstitute ? CornerDownRight : Bed;

  if (confirmDel) {
    return (
      <div className={cn('flex items-center justify-between px-4 py-2 rounded-lg border', dk ? 'bg-red-900/10 border-red-500/30' : 'bg-red-50 border-red-200')}>
        <span className={cn('text-sm font-bold', dk ? 'text-red-300' : 'text-red-700')}>Delete {employee?.name}?</span>
        <div className="flex gap-2">
          <button onClick={remove} disabled={saving} className="px-4 py-1.5 rounded bg-red-600 text-white text-xs font-bold">Yes</button>
          <button onClick={() => setConfirmDel(false)} className={cn('px-4 py-1.5 rounded text-xs font-bold border', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>Cancel</button>
        </div>
      </div>
    )
  }

  if (!editing && employee) {
    return (
      <div className={cn('flex items-center gap-4 px-4 py-2.5 rounded-lg transition-all group', borderCls, isPartial ? 'border-2 border-dashed' : 'border-2 border-solid', dk ? 'bg-[#1E293B]' : 'bg-white')}>
        <IconToUse size={16} className={status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400'} />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <span onClick={() => { setName(employee.name); setPhone(employee.phone || '+49 '); setCheckIn(employee.checkIn ?? effectiveIn); setCheckOut(employee.checkOut ?? effectiveOut); setEditing(true) }} className={cn('text-base font-bold cursor-pointer truncate', dk ? 'text-white' : 'text-slate-900')}>{employee.name}</span>
        </div>

        {employee.phone && employee.phone !== '+49' && employee.phone !== '+49 ' && (
          <a href={`tel:${employee.phone.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors border", dk ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100")}>
            <Phone size={12} /> <span className="hidden sm:inline">{employee.phone}</span>
          </a>
        )}

        <span className={cn('text-[13px] tabular-nums shrink-0 hidden md:block', dk ? 'text-slate-400' : 'text-slate-500')}>{fmtDate(employee.checkIn ?? '')} ➔ {fmtDate(employee.checkOut ?? '')}</span>
        <span className={cn('text-[14px] font-black shrink-0 w-10 text-right', dk ? 'text-slate-300' : 'text-slate-600')}>{calculateNights(employee.checkIn||'', employee.checkOut||'')}N</span>
        {saving ? <Loader2 size={16} className="animate-spin text-blue-400" /> : <button onClick={() => setConfirmDel(true)} className={cn('opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded', dk ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50')}><Trash2 size={16} /></button>}
      </div>
    )
  }

  if (!editing) {
    const isGap = !!(gapStart || gapEnd)
    return (
      <button onClick={() => { setCheckIn(effectiveIn); setCheckOut(effectiveOut); setEditing(true); setTimeout(() => inputRef.current?.focus(), 40) }} className={cn('w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-sm font-bold transition-all', isGap ? (dk ? 'border-amber-500/40 text-amber-400 hover:bg-amber-900/10' : 'border-amber-400 text-amber-600 hover:bg-amber-50') : (dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'))}>
        <Plus size={16} /> {isGap ? `${lang === 'de' ? 'Lücke füllen' : 'Fill gap'} (${fmtDate(effectiveIn)} ➔ ${fmtDate(effectiveOut)})` : 'Assign bed'}
      </button>
    )
  }

  // 2-ROW EDIT LAYOUT
  return (
    <div className={cn('flex flex-col gap-3 p-3 rounded-xl border', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
      <div className="flex items-center gap-3">
        <IconToUse size={18} className={dk ? 'text-blue-400 ml-1 hidden sm:block' : 'text-blue-500 ml-1 hidden sm:block'} />
        <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Name..." className={cn(inputCls, 'flex-[6] font-bold text-base')} />
        <div className="relative flex items-center flex-[4]">
          <Phone size={14} className={cn("absolute left-2.5", dk ? "text-slate-500" : "text-slate-400")} />
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="+49" className={cn(inputCls, 'w-full pl-8 text-sm')} />
        </div>
      </div>
      <div className="flex items-center gap-3 pl-1 sm:pl-8 flex-wrap sm:flex-nowrap">
        <input type="date" value={checkIn} min={effectiveIn} max={effectiveOut} onChange={e => setCheckIn(e.target.value)} className={cn(inputCls, 'w-[130px] px-3 font-medium')} />
        <span className="text-slate-400 text-sm hidden sm:block">➔</span>
        <input type="date" value={checkOut} min={checkIn} max={effectiveOut} onChange={e => setCheckOut(e.target.value)} className={cn(inputCls, 'w-[130px] px-3 font-medium')} />
        <div className={cn('px-2 rounded border text-xs font-black text-center h-[38px] flex items-center justify-center shrink-0', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} style={{ width: 48 }}>{nights}N</div>
        <div className="flex-1" />
        <button onClick={save} disabled={saving || !name.trim()} className="px-5 h-[38px] rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm">Save</button>
        <button onClick={() => setEditing(false)} className={cn('px-3 h-[38px] rounded text-sm transition-all shrink-0 border', dk ? 'border-white/10 text-slate-400 hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}><X size={16} /></button>
      </div>
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

function InlineNMBRow({
  nettoKey, mwstKey, bruttoKey, energyNettoKey, energyMwstKey, energyBruttoKey,
  card, dk, inputCls, onPatch, disabled
}: {
  nettoKey: keyof RoomCardType; mwstKey: keyof RoomCardType; bruttoKey: keyof RoomCardType;
  energyNettoKey?: keyof RoomCardType; energyMwstKey?: keyof RoomCardType; energyBruttoKey?: keyof RoomCardType;
  card: RoomCardType; dk: boolean; inputCls: string; onPatch: (p: Partial<RoomCardType>) => void; disabled?: boolean;
}) {
  const lbl = cn('text-[10px] font-black uppercase tracking-widest h-4 flex items-end mb-1.5', dk ? 'text-slate-500' : 'text-slate-400')
  const disabledInputCls = cn(inputCls, 'opacity-40 cursor-not-allowed pointer-events-none')

  // COMPUTED LOCKS FOR NETTO/BRUTTO
  const bNettoDisplay = (card[bruttoKey] != null && card[mwstKey] != null) ? (Number(card[bruttoKey]) / (1 + Number(card[mwstKey])/100)).toFixed(2) : '';
  const bBruttoDisplay = (card[nettoKey] != null && card[mwstKey] != null) ? (Number(card[nettoKey]) * (1 + Number(card[mwstKey])/100)).toFixed(2) : '';

  const eNettoDisplay = (energyBruttoKey && energyMwstKey && card[energyBruttoKey] != null && card[energyMwstKey] != null) ? (Number(card[energyBruttoKey]) / (1 + Number(card[energyMwstKey])/100)).toFixed(2) : '';
  const eBruttoDisplay = (energyNettoKey && energyMwstKey && card[energyNettoKey] != null && card[energyMwstKey] != null) ? (Number(card[energyNettoKey]) * (1 + Number(card[energyMwstKey])/100)).toFixed(2) : '';

  return (
    <div className={cn("flex items-start gap-4 flex-nowrap w-max", disabled && "opacity-50 pointer-events-none")}>
      
      {/* BASE PRICE GROUP */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col">
            <p className={lbl}>Netto (€)</p>
            <input type="number" min={0} step="0.01" value={card[nettoKey] != null ? card[nettoKey] : bNettoDisplay} onChange={e => onPatch({[nettoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value), [bruttoKey]: null} as any)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-24', card[bruttoKey] != null && 'bg-slate-100 dark:bg-white/5 text-slate-400')} placeholder="Auto" />
          </div>
          
          {/* TICKET DISCOUNT BUTTON */}
          {!(card.hasDiscount || Boolean(card.discountValue)) && (
            <div className="flex flex-col justify-end h-full mt-[22px]">
              <button onClick={() => onPatch({ hasDiscount: true } as any)} className={cn("p-1.5 h-[34px] rounded-lg border flex items-center justify-center transition-all", dk ? "border-white/10 text-slate-400 hover:text-teal-400" : "border-slate-200 text-slate-400 hover:text-teal-500 hover:bg-slate-50")}>
                <Ticket size={14} />
              </button>
            </div>
          )}
        </div>

        {/* EXPANDED DISCOUNT UI */}
        {(card.hasDiscount || Boolean(card.discountValue)) && (
          <div className="flex items-center gap-1.5 shrink-0 animate-in fade-in zoom-in-95 duration-200 mt-1">
            <span className={cn('text-[10px] font-bold uppercase text-slate-400', dk && 'text-slate-500')}>Disc.</span>
            <div className="relative flex items-center h-[34px] w-[80px]">
              <input type="number" value={card.discountValue || ''} onChange={e => onPatch({discountValue: e.target.value === '' ? null : normalizeNumberInput(e.target.value)} as any)} className={cn(inputCls, 'w-full pr-6 h-full')} placeholder="0" />
              <button onClick={() => onPatch({discountType: card.discountType === 'percentage' ? 'fixed' : 'percentage'} as any)} className={cn("absolute right-1 w-5 h-5 rounded flex items-center justify-center text-xs font-bold", dk ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>{card.discountType === 'percentage' ? '%' : '€'}</button>
            </div>
            <button onClick={() => onPatch({hasDiscount: false, discountValue: null} as any)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <p className={lbl}>MwSt (%)</p>
        <input type="number" min={0} max={99} step="0.5" value={card[mwstKey] ?? ''} onChange={e => onPatch({[mwstKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value)} as any)} disabled={disabled} style={{ ...noSpinner }} className={cn(disabled ? disabledInputCls : inputCls, 'w-16 text-center')} placeholder="%" />
      </div>

      <div className="flex flex-col">
        <p className={lbl}>Brutto (€)</p>
        <input type="number" min={0} step="0.01" value={card[bruttoKey] != null ? card[bruttoKey] : bBruttoDisplay} onChange={e => onPatch({[bruttoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value), [nettoKey]: null} as any)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-24', card[nettoKey] != null && 'bg-slate-100 dark:bg-white/5 text-slate-400')} placeholder="Auto" />
      </div>

      {/* ENERGY GROUP */}
      {energyNettoKey && (
        <div className={cn("flex items-start gap-4 px-4 py-2.5 rounded-xl border border-dashed ml-2", dk ? "border-yellow-500/30 bg-yellow-500/5" : "border-yellow-400/60 bg-yellow-50/50")}>
          <div className="flex flex-col">
            <p className={lbl}><Zap size={10} className="inline mr-1 text-yellow-500" />En. Netto</p>
            <input type="number" min={0} step="0.01" value={card[energyNettoKey] != null ? card[energyNettoKey] : eNettoDisplay} onChange={e => onPatch({[energyNettoKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value), [energyBruttoKey!]: null} as any)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-24', card[energyBruttoKey!] != null && 'bg-slate-100 dark:bg-white/5 text-slate-400')} placeholder="Auto" />
          </div>
          <div className="flex flex-col">
            <p className={lbl}>MwSt</p>
            <input type="number" min={0} max={99} step="0.5" value={card[energyMwstKey!] ?? ''} onChange={e => onPatch({[energyMwstKey!]: e.target.value === '' ? null : normalizeNumberInput(e.target.value)} as any)} disabled={disabled} style={{ ...noSpinner }} className={cn(disabled ? disabledInputCls : inputCls, 'w-16 text-center')} placeholder="%" />
          </div>
          <div className="flex flex-col">
            <p className={lbl}>En. Brutto</p>
            <input type="number" min={0} step="0.01" value={card[energyBruttoKey!] != null ? card[energyBruttoKey!] : eBruttoDisplay} onChange={e => onPatch({[energyBruttoKey!]: e.target.value === '' ? null : normalizeNumberInput(e.target.value), [energyNettoKey]: null} as any)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputCls, 'w-24', card[energyNettoKey!] != null && 'bg-slate-100 dark:bg-white/5 text-slate-400')} placeholder="Auto" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function RoomCard({
  card, durationStart, durationEnd, dk, lang, allCardsOfSameType, isMasterPricingActive = false,
  onUpdate, onDelete, onApplyToSameType,
}: {
  card: RoomCardType; durationStart: string; durationEnd: string; dk: boolean; lang: 'de'|'en';
  allCardsOfSameType: RoomCardType[]; isMasterPricingActive?: boolean;
  onUpdate: (id: string, patch: Partial<RoomCardType>) => void; onDelete: (id: string) => void; onApplyToSameType: (source: RoomCardType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [isApplyActive, setApplyActive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const saveTimer = useRef<any>(null)

  const beds = bedsForType(card.roomType, card.bedCount)
  const nights = calculateNights(durationStart, durationEnd)
  const activeTab: PricingTab = card.pricingTab ?? 'per_room'
  const employees = card.employees ?? []

  const inputCls = cn('px-2 py-1 rounded-lg text-sm font-bold outline-none border transition-all h-[34px]', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
  const labelCls = cn('text-[10px] font-black uppercase tracking-widest text-slate-400')
  const tabBtn = (active: boolean) => cn('px-5 py-2.5 rounded-lg text-sm font-black border transition-all shadow-sm', active ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    const updatedCard = { ...card, ...patch };
    const newNettoTotal = calcRoomCardNettoSum(updatedCard, durationStart, durationEnd);
    const newBruttoTotal = calcRoomCardTotal(updatedCard, durationStart, durationEnd);

    const finalPatch = { ...patch, totalNetto: newNettoTotal, totalBrutto: newBruttoTotal };

    onUpdate(card.id, finalPatch)
    saveTimer.current = setTimeout(async () => {
      try { await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...finalPatch } }) }
      catch (e) { console.error(e) }
    }, 400)
  }

  // --- Calculations for UI ---
  const calculatedFinalBrutto = calcRoomCardTotal(card, durationStart, durationEnd);
  const calculatedTotalNetto = calcRoomCardNettoSum(card, durationStart, durationEnd);
  const calculatedTotalMwst = Math.max(0, calculatedFinalBrutto - calculatedTotalNetto);
  
  const multiplier = activeTab === 'per_bed' ? (beds * nights) : activeTab === 'per_room' ? nights : 1;
  
  let calculatedTotalEnergy = 0;
  if (activeTab === 'per_bed') calculatedTotalEnergy = (Number(card.bedEnergyNetto) || 0) * multiplier;
  else if (activeTab === 'per_room') calculatedTotalEnergy = (Number(card.roomEnergyNetto) || 0) * multiplier;
  else if (activeTab === 'total_room') calculatedTotalEnergy = Number(card.totalEnergyNetto) || 0;

  const pricePerBedPerNight = (beds > 0 && nights > 0) ? calculatedTotalNetto / (beds * nights) : 0;
  const roomTotalDisplay = formatCurrency(calculatedFinalBrutto)

  return (
    <div className={cn('rounded-xl border transition-all shadow-sm flex flex-col w-full overflow-hidden', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      
      {/* HEADER: COMPACT LAYOUT */}
      <div className={cn("flex items-center gap-4 px-4 py-3 cursor-pointer w-full", isOpen && (dk ? "border-b border-white/10" : "border-b border-slate-100"))} onClick={(e) => { if (!['INPUT','BUTTON','SELECT'].includes((e.target as HTMLElement).tagName)) setIsOpen(!isOpen) }}>
        <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={cn("p-1.5 rounded-md transition-all shrink-0", dk ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>

        {!isOpen ? (
           <>
             <div className="flex items-center gap-4 shrink-0 min-w-[280px]">
               <span className={cn("font-black w-8", dk ? "text-white" : "text-slate-900")}>{card.roomType}</span>
               <span className={cn("text-base font-bold w-24 truncate", dk ? "text-slate-300" : "text-slate-700")}>{card.roomNo || '---'}</span>
               <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-500/10 text-blue-500 font-black text-xs shrink-0"><Moon size={14} /> {nights} <div className="w-px h-3 bg-blue-500/30 mx-0.5" /> <Bed size={14} /> {beds}</span>
             </div>
             
             {/* THE SURGICAL FIX: Tooltips, Partial Borders, Substitute Icons, and Free Bed Slot Logic */}
             <div className="flex-1 flex gap-2 items-center px-4 overflow-x-auto no-scrollbar">
                {Array.from({ length: beds }).flatMap((_, i) => {
                   const slotE = employees.filter(e => (e.slotIndex ?? 0) === i).sort((a,b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                   return slotE.map((emp, empIdx) => {
                     const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                     const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                     const textColor = status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400';
                     
                     const isPartial = (emp.checkIn || '') > durationStart || (emp.checkOut || '') < durationEnd;
                     const isSubstitute = empIdx > 0;
                     const phoneTip = emp.phone && emp.phone !== '+49' && emp.phone !== '+49 ' ? `📞 ${emp.phone} | ` : '';
                     const tooltipText = `${phoneTip}${calculateNights(emp.checkIn||'', emp.checkOut||'')}N (${fmtDate(emp.checkIn||'')} ➔ ${fmtDate(emp.checkOut||'')})`;
                     
                     return (
                       <div key={emp.id} title={tooltipText} className={cn("px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2", isPartial ? "border-2 border-dashed" : "border-2 border-solid", empBorderColor(emp, dk), dk ? "bg-[#1E293B] text-slate-200" : "bg-slate-50 text-slate-700")}>
                         {isSubstitute ? <CornerDownRight size={12} className={textColor} /> : <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />}
                         <span className="truncate max-w-[120px]">{emp.name}</span>
                       </div>
                     )
                   });
                })}
                {(() => {
                  const occupiedSlots = new Set(employees.map(e => e.slotIndex ?? 0)).size;
                  const freeSlots = beds - occupiedSlots;
                  if (freeSlots > 0) {
                    return <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap border-2 border-dashed", dk ? "border-amber-500/40 text-amber-500 bg-amber-500/5" : "border-amber-400 text-amber-600 bg-amber-50")}><Plus size={12} /> {freeSlots} {lang === 'de' ? 'Frei' : 'Empty'}</div>;
                  }
                  return null;
                })()}
             </div>
             
             <div className="flex flex-col items-end shrink-0 ml-4">
                {isMasterPricingActive ? <span className="text-[10px] opacity-40 font-black uppercase tracking-widest">Master Active</span> : <span className="text-xl font-black tabular-nums">{roomTotalDisplay}</span>}
             </div>
             <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className={cn('p-2 rounded transition-all shrink-0 ml-4', dk ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}><Trash2 size={18} /></button>
           </>
        ) : (
           <div className="flex items-center gap-3 flex-1">
             <select value={card.roomType} onChange={e => { const rt = e.target.value as any; queueSave({ roomType: rt, bedCount: rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount }) }} className={cn(inputCls, 'w-20 text-center pr-0')}><option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option><option value="WG">WG</option></select>
             <div className="flex items-center gap-1.5"><span className={labelCls}>No:</span><input type="text" value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="101" className={cn(inputCls, 'w-44')} /></div>
             <div className="flex items-center gap-1.5"><span className={labelCls}>Etg:</span><input type="text" value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="1" className={cn(inputCls, 'w-16')} /></div>
             <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-500 font-black text-sm shrink-0 ml-2"><Moon size={16} /> {nights} <Bed size={16} className="ml-1" /> {beds}</span>
             <div className="flex-1" />
             {!isMasterPricingActive && (
               <>
                 <button onClick={(e) => { e.stopPropagation(); setShowPricing(!showPricing) }} className={tabBtn(showPricing)}>Price</button>
                 <div className="flex flex-col items-end min-w-[120px] ml-2"><span className="text-xl font-black">{roomTotalDisplay}</span></div>
               </>
             )}
             <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
           </div>
        )}
      </div>

      {isOpen && (
        <div className="p-6 border-t bg-slate-50/50 dark:bg-black/20">
           {showPricing && !isMasterPricingActive && (
             <div className="mb-6 flex flex-col xl:flex-row shadow-sm rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                
                {/* LEFT SIDE: PRICING INPUTS */}
                <div className="flex-1 p-5 bg-white dark:bg-[#0F172A] border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-white/10 flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => queueSave({ pricingTab: 'per_bed' })} className={tabBtn(activeTab === 'per_bed')}>Price/Bed</button>
                    <button onClick={() => queueSave({ pricingTab: 'per_room' })} className={tabBtn(activeTab === 'per_room')}>Price/Room</button>
                    <button onClick={() => queueSave({ pricingTab: 'total_room' })} className={tabBtn(activeTab === 'total_room')}>Total/Room</button>
                  </div>
                  
                  <div className="flex items-start gap-4 overflow-x-auto no-scrollbar">
                    <InlineNMBRow 
                      nettoKey={activeTab === 'per_bed' ? "bedNetto" : activeTab === 'per_room' ? "roomNetto" : "totalNetto"} 
                      mwstKey={activeTab === 'per_bed' ? "bedMwst" : activeTab === 'per_room' ? "roomMwst" : "totalMwst"} 
                      bruttoKey={activeTab === 'per_bed' ? "bedBrutto" : activeTab === 'per_room' ? "roomBrutto" : "totalBrutto"} 
                      energyNettoKey={activeTab === 'per_bed' ? "bedEnergyNetto" : activeTab === 'per_room' ? "roomEnergyNetto" : "totalEnergyNetto"}
                      energyMwstKey={activeTab === 'per_bed' ? "bedEnergyMwst" : activeTab === 'per_room' ? "roomEnergyMwst" : "totalEnergyMwst"}
                      energyBruttoKey={activeTab === 'per_bed' ? "bedEnergyBrutto" : activeTab === 'per_room' ? "roomEnergyBrutto" : "totalEnergyBrutto"}
                      card={card} dk={dk} inputCls={inputCls} onPatch={queueSave} multiplier={multiplier} activeTab={activeTab} 
                    />
                    
                    {allCardsOfSameType.length > 1 && (
                      <div className="flex items-end h-full mt-[22px]">
                        <button onClick={() => { onApplyToSameType(card); setApplyActive(true); setTimeout(()=>setApplyActive(false), 1000); }} className={cn('px-4 h-[34px] rounded-lg text-sm font-black border flex items-center gap-2 transition-all', isApplyActive ? 'bg-green-500 text-white border-transparent shadow-lg' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-blue-400' : 'border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600')}>
                          {isApplyActive ? <Check size={14}/> : <Copy size={14}/>} All {card.roomType}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE: SUMMARY COLUMN */}
                <div className="w-full xl:w-[280px] shrink-0 p-5 bg-slate-50 dark:bg-[#0F172A]/80 flex flex-col justify-between">
                   <div className="space-y-2 mb-4 text-[13px] font-medium">
                      <div className="flex justify-between items-center"><span className={dk ? "text-slate-400" : "text-slate-500"}>Total Netto</span><span className={cn("font-bold", dk ? "text-white" : "text-slate-900")}>{formatCurrency(calculatedTotalNetto)}</span></div>
                      {calculatedTotalEnergy > 0 && <div className="flex justify-between items-center text-yellow-600 dark:text-yellow-500"><span className="opacity-80">Energy</span><span>{formatCurrency(calculatedTotalEnergy)}</span></div>}
                      {calculatedTotalMwst > 0 && <div className="flex justify-between items-center text-slate-500 dark:text-slate-400"><span>MwSt</span><span>{formatCurrency(calculatedTotalMwst)}</span></div>}
                   </div>
                   <div className="pt-3 border-t border-slate-200 dark:border-white/10">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-black uppercase text-slate-500">Final Brutto</span>
                         <span className="text-xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(calculatedFinalBrutto)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
                         <span>Price / Bed</span>
                         <span>{formatCurrency(pricePerBedPerNight)} / N</span>
                      </div>
                   </div>
                </div>
             </div>
           )}
           
           <div className="grid gap-6 items-start" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(400px, 1fr))` }}>
              {Array.from({ length: beds }).map((_, i) => {
                 const slotE = employees.filter(e => (e.slotIndex ?? 0) === i).sort((a,b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                 return (
                   <div key={i} className="space-y-3">
                     <div className="flex items-center justify-between pb-1.5 px-1"><span className={cn('text-[11px] font-black tracking-widest flex items-center gap-1.5', dk ? 'text-slate-400' : 'text-slate-500')}><Bed size={14} /> BED {i + 1}</span></div>
                     <div className="space-y-3">
                       {slotE.length === 0 ? (<BedSlot slotIndex={i} employee={null} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={(idx, emp) => {
                         const next = emp === null ? employees.filter(e => e.slotIndex !== idx) : employees.some(e => e.id === emp.id) ? employees.map(e => e.id === emp.id ? emp : e) : [...employees, emp];
                         onUpdate(card.id, { employees: next });
                       }} />) : (slotE.map((emp, empIdx) => (<BedSlot key={emp.id} slotIndex={i} employee={emp} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} isSubstitute={empIdx > 0} onUpdated={(idx, e) => {
                         const next = e === null ? employees.filter(empItem => empItem.id !== emp.id) : employees.map(empItem => empItem.id === e.id ? e : empItem);
                         onUpdate(card.id, { employees: next });
                       }} />)))}
                       {getGapSlots(beds, employees, durationStart, durationEnd).filter(g => g.slotIndex === i).map((gap, gi) => (<BedSlot key={`gap-${i}-${gi}`} slotIndex={i} employee={null} durationStart={durationStart} durationEnd={durationEnd} gapStart={gap.gapStart} gapEnd={gap.gapEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={(idx, emp) => {
                         const next = emp === null ? employees : [...employees, emp];
                         onUpdate(card.id, { employees: next });
                       }} />))}
                     </div>
                   </div>
                 )
              })}
           </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-sm rounded-3xl border p-6 shadow-2xl', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-3">Delete Room?</h3><p className="text-sm mb-6 opacity-60">This cannot be undone.</p>
            <div className="flex justify-end gap-3"><button onClick={() => setConfirmDelete(false)} className={cn('px-5 py-2.5 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>Cancel</button><button onClick={async () => { await enqueue({ type: 'deleteRoomCard', payload: { id: card.id } }); onDelete(card.id); setConfirmDelete(false); }} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Delete</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
