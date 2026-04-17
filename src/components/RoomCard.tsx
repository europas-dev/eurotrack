// src/components/RoomCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2,
  Minus, Plus, Tag, Trash2, X, Zap, CornerDownRight, Moon, Calendar, Check
} from 'lucide-react'
import { cn, calculateNights, formatCurrency, normalizeNumberInput, getEmployeeStatus } from '../lib/utils'
import { bedsForType, calcRoomCardTotal } from '../lib/roomCardUtils'
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
    try {
      if (employee?.id) {
        const payload = { id: employee.id, name: name.trim(), checkIn, checkOut };
        await enqueue({ type: 'updateEmployee', payload });
        onUpdated(slotIndex, { ...employee, ...payload });
      } else {
        const newId = crypto.randomUUID();
        const payload = { id: newId, durationId, roomCardId, slotIndex, name: name.trim(), checkIn, checkOut };
        await enqueue({ type: 'createEmployee', payload });
        onUpdated(slotIndex, payload as any, !!(gapStart || gapEnd));
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
      setName(''); setEditing(false)
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
        <IconToUse size={16} className={status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : 'text-slate-400'} />
        <span onClick={() => { setName(employee.name); setCheckIn(employee.checkIn ?? effectiveIn); setCheckOut(employee.checkOut ?? effectiveOut); setEditing(true) }} className={cn('text-base font-bold flex-1 cursor-pointer truncate', dk ? 'text-white' : 'text-slate-900')}>{employee.name}</span>
        <span className={cn('text-[13px] tabular-nums shrink-0 hidden sm:block', dk ? 'text-slate-400' : 'text-slate-500')}>{fmtDate(employee.checkIn ?? '')} ➔ {fmtDate(employee.checkOut ?? '')}</span>
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

  return (
    <div className={cn('flex items-center gap-2 p-1.5 rounded-lg border flex-wrap sm:flex-nowrap', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
      <IconToUse size={16} className={dk ? 'text-blue-400 ml-2 hidden sm:block' : 'text-blue-500 ml-2 hidden sm:block'} />
      <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Name..." className={cn(inputCls, 'flex-1 min-w-[150px] font-bold text-base')} />
      <input type="date" value={checkIn} min={effectiveIn} max={effectiveOut} onChange={e => setCheckIn(e.target.value)} className={cn(inputCls, 'w-[130px] px-3 font-medium')} />
      <span className="text-slate-400 text-sm hidden sm:block">➔</span>
      <input type="date" value={checkOut} min={checkIn} max={effectiveOut} onChange={e => setCheckOut(e.target.value)} className={cn(inputCls, 'w-[130px] px-3 font-medium')} />
      <div className={cn('px-2 rounded border text-xs font-black text-center h-[38px] flex items-center justify-center shrink-0', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} style={{ width: 48 }}>{nights}N</div>
      <button onClick={save} disabled={saving || !name.trim()} className="px-5 h-[38px] rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Save</button>
      <button onClick={() => setEditing(false)} className={cn('px-3 h-[38px] rounded text-sm transition-all shrink-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}><X size={16} /></button>
    </div>
  )
}

function InlineNMBRow({
  nettoKey, mwstKey, bruttoKey, energyNettoKey, energyMwstKey, energyBruttoKey,
  card, dk, inputCls, onPatch, disabled, multiplier
}: {
  nettoKey: keyof RoomCardType; mwstKey: keyof RoomCardType; bruttoKey: keyof RoomCardType;
  energyNettoKey?: keyof RoomCardType; energyMwstKey?: keyof RoomCardType; energyBruttoKey?: keyof RoomCardType;
  card: RoomCardType; dk: boolean; inputCls: string; onPatch: (p: Partial<RoomCardType>) => void; disabled?: boolean; multiplier: number;
}) {
  const lbl = cn('text-[10px] font-black uppercase tracking-widest h-4 flex items-end mb-1', dk ? 'text-slate-500' : 'text-slate-400')
  const sumLbl = cn('text-[11px] font-black mt-1 pl-1 h-4', dk ? 'text-slate-500' : 'text-slate-400')
  
  const updateNetto = (v: string) => {
    const n = v === '' ? null : normalizeNumberInput(v);
    const m = card[mwstKey] as number ?? 0;
    const b = n !== null ? Number((n * (1 + m / 100)).toFixed(2)) : null;
    onPatch({ [nettoKey]: n, [bruttoKey]: b } as any);
  }
  const updateBrutto = (v: string) => {
    const b = v === '' ? null : normalizeNumberInput(v);
    const m = card[mwstKey] as number ?? 0;
    const n = b !== null ? Number((b / (1 + m / 100)).toFixed(2)) : null;
    onPatch({ [bruttoKey]: b, [nettoKey]: n } as any);
  }

  return (
    <div className={cn("flex items-start gap-3 flex-nowrap w-max", disabled && "opacity-50 pointer-events-none")}>
      <div className="flex flex-col"><p className={lbl}>Netto (€)</p><input type="number" value={card[nettoKey] ?? ''} placeholder="0.00" disabled={disabled} onChange={e => updateNetto(e.target.value)} style={noSpinner} className={cn(inputCls, 'w-32')} /><div className={sumLbl}>{(card[nettoKey] as number ?? 0) > 0 && `Σ ${formatCurrency((card[nettoKey] as number ?? 0) * multiplier)}`}</div></div>
      <div className="flex flex-col"><p className={lbl}>MwSt (%)</p><input type="number" value={card[mwstKey] ?? ''} placeholder="%" disabled={disabled} onChange={e => onPatch({ [mwstKey]: e.target.value === '' ? null : normalizeNumberInput(e.target.value) } as any)} style={noSpinner} className={cn(inputCls, 'w-16')} /><div className={sumLbl}/></div>
      <div className="flex flex-col"><p className={lbl}>Brutto (€)</p><input type="number" value={card[bruttoKey] ?? ''} placeholder="0.00" disabled={disabled} onChange={e => updateBrutto(e.target.value)} style={noSpinner} className={cn(inputCls, 'w-32')} /><div className={sumLbl}>{(card[bruttoKey] as number ?? 0) > 0 && `Σ ${formatCurrency((card[bruttoKey] as number ?? 0) * multiplier)}`}</div></div>
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
  const saveTimer = useRef<any>(null)

  const beds = bedsForType(card.roomType, card.bedCount)
  const nights = calculateNights(durationStart, durationEnd)
  const total = calcRoomCardTotal(card, durationStart, durationEnd)
  const activeTab: PricingTab = card.pricingTab ?? 'per_room'
  const employees = card.employees ?? []

  const inputCls = cn('px-2 py-1 rounded-lg text-sm font-bold outline-none border transition-all h-[34px]', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
  const labelCls = cn('text-[10px] font-black uppercase tracking-widest text-slate-400')
  const tabBtn = (active: boolean) => cn('px-4 py-1.5 rounded-lg text-xs font-black border transition-all', active ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    onUpdate(card.id, patch)
    saveTimer.current = setTimeout(async () => {
      try { await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...patch } }) }
      catch (e) { console.error(e) }
    }, 400)
  }

  const roomTotalDisplay = formatCurrency(total)
  const multiplier = activeTab === 'per_bed' ? (beds * nights) : activeTab === 'per_room' ? nights : 1;

  return (
    <div className={cn('rounded-xl border transition-all shadow-sm flex flex-col w-full overflow-hidden', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      
      {/* HEADER: COMPRESSED ONE-LINE LAYOUT */}
      <div className="flex items-center gap-3 px-4 py-2 cursor-pointer w-full hover:bg-black/5" onClick={() => setIsOpen(!isOpen)}>
        <button className="p-1 text-slate-400">{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>

        <div className="flex items-center gap-4 shrink-0 min-w-[340px]">
          <span className="font-black text-sm w-6 uppercase">{card.roomType}</span>
          
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <span className={labelCls}>NO:</span>
            <input value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="101" className={cn(inputCls, 'w-24')} />
          </div>
          
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <span className={labelCls}>ETG:</span>
            <input value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="1" className={cn(inputCls, 'w-10 text-center')} />
          </div>

          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-500 font-black text-[11px]"><Moon size={12} /> {nights} <Bed size={12} className="ml-1" /> {beds}</span>
        </div>

        <div className="flex-1 flex gap-2 overflow-hidden items-center px-2">
          {employees.map(emp => (
            <div key={emp.id} className={cn("px-2 py-1 rounded border text-[11px] font-bold whitespace-nowrap", dk ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>{emp.name}</div>
          ))}
          {beds - employees.length > 0 && <div className="text-[10px] font-black text-amber-500 uppercase">+{beds - employees.length} FREE</div>}
        </div>

        <div className="ml-auto flex items-center gap-4">
          {!isMasterPricingActive ? (
            <div className="flex items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); setShowPricing(!showPricing) }} className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all", showPricing ? "bg-blue-600 text-white" : "bg-white text-slate-500")}>Price</button>
              <div className="text-right">
                <span className="text-sm font-black tabular-nums">{roomTotalDisplay}</span>
                <p className="text-[9px] font-bold text-slate-400">{(total / (nights || 1)).toFixed(2)}€/N</p>
              </div>
            </div>
          ) : (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Master Active</span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(card.id); }} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
        </div>
      </div>

      {/* PRICING SUB-SECTION */}
      {isOpen && showPricing && !isMasterPricingActive && (
        <div className="p-4 border-t bg-slate-50/50">
          <div className="flex flex-col gap-4 animate-in slide-in-from-top-1 duration-200">
             <div className="flex gap-2">
                {(['per_bed', 'per_room', 'total_room'] as PricingTab[]).map(t => (
                  <button key={t} onClick={() => queueSave({ pricingTab: t })} className={tabBtn(activeTab === t)}>{t.replace('_','/').toUpperCase()}</button>
                ))}
             </div>
             <div className="flex items-start gap-4">
                <InlineNMBRow 
                  nettoKey={activeTab === 'per_bed' ? "bedNetto" : activeTab === 'per_room' ? "roomNetto" : "totalNetto"} 
                  mwstKey={activeTab === 'per_bed' ? "bedMwst" : activeTab === 'per_room' ? "roomMwst" : "totalMwst"} 
                  bruttoKey={activeTab === 'per_bed' ? "bedBrutto" : activeTab === 'per_room' ? "roomBrutto" : "totalBrutto"} 
                  card={card} dk={dk} inputCls={inputCls} onPatch={queueSave} multiplier={multiplier} 
                />
             </div>
          </div>
        </div>
      )}

      {/* CALENDAR/BEDS SECTION */}
      {isOpen && (
        <div className="p-4 border-t">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(320px, 1fr))` }}>
            {Array.from({ length: beds }).map((_, i) => (
              <div key={i} className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase">Bed {i + 1}</span>
                <BedSlot slotIndex={i} employee={employees.find(e => e.slotIndex === i) || null} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={(idx, emp) => {
                  const next = emp === null ? employees.filter(e => e.slotIndex !== idx) : employees.some(e => e.id === emp.id) ? employees.map(e => e.id === emp.id ? emp : e) : [...employees, emp];
                  onUpdate(card.id, { employees: next });
                }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
