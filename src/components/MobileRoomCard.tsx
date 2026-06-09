// src/components/MobileRoomCard.tsx

import React, { useEffect, useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2, Phone,
  Minus, Plus, Trash2, X, Zap, CornerDownRight, Moon, Calendar, Check, Ticket, RotateCcw, Eye, EyeOff
} from 'lucide-react'
import { cn, calculateNights, formatCurrency, normalizeNumberInput, getEmployeeStatus } from '../lib/utils'
import { bedsForType, calcRoomCardTotal, calcRoomCardNettoSum } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Employee, PricingTab, RoomCard as RoomCardType } from '../lib/types'

const noSpinner: React.CSSProperties = { MozAppearance: 'textfield' as any, WebkitAppearance: 'none' as any }

function fmtDateDe(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function empBorderColor(emp: Employee | null, dk: boolean): string {
  if (!emp) return dk ? 'border-white/10' : 'border-slate-200'
  const s = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '')
  if (s === 'active') return dk ? 'border-emerald-500/50' : 'border-emerald-500'
  if (s === 'ending-soon') return dk ? 'border-red-500/50' : 'border-red-500'
  if (s === 'completed') return dk ? 'border-slate-500/40' : 'border-slate-400'
  if (s === 'upcoming') return dk ? 'border-blue-500/50' : 'border-blue-500'
  return dk ? 'border-white/10' : 'border-slate-200'
}

function MobileMwstInput({ value, onChange, isDarkMode, disabled }: { value: string | null, onChange: (v: string | null) => void, isDarkMode: boolean, disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const baseInputCls = cn('w-full px-2 py-1.5 rounded-l-lg text-sm font-bold outline-none border transition-all h-[42px] text-center', disabled && "opacity-50 cursor-not-allowed bg-transparent", !disabled && (isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'));
  
  return (
    <div ref={ref} className="relative flex items-center h-[42px] w-full">
      <input type="number" value={value ?? ''} onChange={e => { const cleanV = e.target.value.replace(/^0+(?=\d)/, ''); onChange(cleanV === '' ? null : cleanV); }} disabled={disabled} className={baseInputCls} placeholder="%" style={noSpinner} />
      <button onClick={() => setOpen(!open)} disabled={disabled} className={cn('px-2 h-[42px] rounded-r-lg border border-l-0 transition-all flex items-center justify-center shrink-0', disabled && "opacity-50 cursor-not-allowed", !disabled && (isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'))}><ChevronDown size={14} /></button>
      {open && !disabled && (
        <div className={cn("absolute top-full right-0 mt-1 w-full z-[999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => (
            <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-3 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- VERTICAL MOBILE BED SLOT ---
function MobileBedSlot({
  slotIndex, employee, durationStart, durationEnd, gapStart, gapEnd,
  roomCardId, durationId, dk, lang, isSubstitute, onUpdated, viewOnly, employeeOptions
}: any) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(employee?.name ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '+49 ')
  const [checkIn, setCheckIn] = useState(employee?.checkIn ?? gapStart ?? durationStart)
  const [checkOut, setCheckOut] = useState(employee?.checkOut ?? gapEnd ?? durationEnd)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const effectiveIn = gapStart ?? durationStart
  const effectiveOut = gapEnd ?? durationEnd
  const nights = calculateNights(checkIn, checkOut)
  const status = employee ? getEmployeeStatus(employee.checkIn ?? '', employee.checkOut ?? '') : null
  const borderCls = empBorderColor(employee, dk)
  const isPartial = employee && (employee.checkIn > durationStart || employee.checkOut < durationEnd);

  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all h-[42px] font-bold w-full',
    dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-blue-500 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 placeholder-slate-400'
  )

  async function save() {
    if (viewOnly) return; 
    if (!name.trim()) return
    setSaving(true)
    const cleanPhone = phone.trim() === '+49' ? '' : phone.trim();
    const finalIn = checkIn === '' ? null : checkIn;
    const finalOut = checkOut === '' ? null : checkOut;

    try {
      if (employee?.id) {
        const payload = { id: employee.id, name: name.trim(), phone: cleanPhone, checkIn: finalIn, checkOut: finalOut };
        await enqueue({ type: 'updateEmployee', payload });
        onUpdated(slotIndex, { ...employee, ...payload });
      } else {
        const isGapFill = !!(gapStart || gapEnd)
        const newId = crypto.randomUUID();
        const payload = { id: newId, durationId, roomCardId, slotIndex, name: name.trim(), phone: cleanPhone, checkIn: finalIn, checkOut: finalOut };
        await enqueue({ type: 'createEmployee', payload });
        onUpdated(slotIndex, payload as any, isGapFill);
      }
      setEditing(false)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function remove() {
    if (viewOnly) return; 
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
      <div className={cn('flex flex-col gap-3 p-4 rounded-xl border shadow-sm', dk ? 'bg-red-950/20 border-red-500/30' : 'bg-red-50 border-red-200')}>
        <span className={cn('text-sm font-black text-center', dk ? 'text-red-400' : 'text-red-700')}>{lang === 'de' ? 'Mitarbeiter löschen?' : 'Delete Employee?'}</span>
        <div className="flex gap-2 w-full">
          <button onClick={() => setConfirmDel(false)} className={cn('flex-1 py-2 rounded-lg text-sm font-bold border', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
          <button onClick={remove} disabled={saving || viewOnly} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold shadow-sm">{lang === 'de' ? 'Ja, Löschen' : 'Yes, Delete'}</button>
        </div>
      </div>
    )
  }

  // --- EDIT MODE (Mobile Stacked) ---
  if (editing || (!employee && editing)) {
    return (
      <div className={cn('flex flex-col gap-3 p-3 rounded-xl border shadow-md', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <input disabled={viewOnly} type="text" value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'de' ? 'Name...' : 'Name...'} className={inputCls} list={`emp-list-${roomCardId}-${slotIndex}`} />
        <datalist id={`emp-list-${roomCardId}-${slotIndex}`}>
            {name.trim().length > 0 && employeeOptions?.map((opt: string) => <option key={opt} value={opt} />)}
        </datalist>
        
        <div className="relative flex items-center w-full">
          <Phone size={14} className={cn("absolute left-3", dk ? "text-slate-500" : "text-slate-400")} />
          <input disabled={viewOnly} type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49" className={cn(inputCls, 'pl-9')} />
        </div>

        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
             <div className={cn(inputCls, 'absolute inset-0 flex items-center justify-between pointer-events-none bg-transparent px-3', viewOnly && "opacity-60")}>
               <span className="text-[12px]">{fmtDateDe(checkIn)}</span>
             </div>
             <input type="date" disabled={viewOnly} value={checkIn || ''} min={effectiveIn} max={effectiveOut} onChange={e => setCheckIn(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          </div>
          <span className="text-slate-400 text-xs shrink-0">➔</span>
          <div className="relative flex-1">
             <div className={cn(inputCls, 'absolute inset-0 flex items-center justify-between pointer-events-none bg-transparent px-3', viewOnly && "opacity-60")}>
               <span className="text-[12px]">{fmtDateDe(checkOut)}</span>
             </div>
             <input type="date" disabled={viewOnly} value={checkOut || ''} min={checkIn || effectiveIn} max={effectiveOut} onChange={e => setCheckOut(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          </div>
        </div>

        <div className="flex gap-2 w-full pt-1">
           <button onClick={() => setEditing(false)} className={cn('flex-1 py-2 rounded-lg font-bold border transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}>
              {lang === 'de' ? 'Abbrechen' : 'Cancel'}
           </button>
           <button onClick={save} disabled={saving || !name.trim()} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center justify-center gap-2 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />} {lang === 'de' ? 'Speichern' : 'Save'}
           </button>
        </div>
      </div>
    )
  }

  // --- VIEW MODE (Mobile Vertical Layout) ---
  if (!editing && employee) {
    return (
      <div id={`emp-slot-${employee.id}`} className={cn('flex flex-col gap-2 p-3 rounded-xl transition-all relative shadow-sm', borderCls, isPartial ? 'border-2 border-dashed' : 'border-2 border-solid', dk ? 'bg-[#0F172A]' : 'bg-white')}>
         <div className="flex items-start justify-between w-full">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <IconToUse size={18} className={cn("shrink-0", status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400')} />
              <span onClick={() => { if(!viewOnly) setEditing(true) }} className={cn('text-[15px] font-black truncate flex-1', !viewOnly ? "cursor-pointer" : "cursor-default", dk ? 'text-white' : 'text-slate-900')}>{employee.name}</span>
            </div>
            {!viewOnly && (
              <button onClick={() => setConfirmDel(true)} className={cn('p-1.5 rounded-lg shrink-0 transition-colors', dk ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50')}><Trash2 size={16} /></button>
            )}
         </div>
         
         <div className="flex flex-col gap-1.5 pl-7">
            {employee.phone && employee.phone !== '+49' && employee.phone.trim() !== '' && (
              <a href={`tel:${employee.phone.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className={cn("flex items-center gap-1.5 text-[12px] font-bold w-max", dk ? "text-blue-400" : "text-blue-600")}>
                <Phone size={12} /> <span>{employee.phone}</span>
              </a>
            )}
            <div className="flex items-center justify-between w-full mt-1">
               <span className={cn('text-[12px] font-bold tabular-nums', dk ? 'text-slate-400' : 'text-slate-500')}>{fmtDateDe(employee.checkIn ?? '')} ➔ {fmtDateDe(employee.checkOut ?? '')}</span>
               <span className={cn('text-[13px] font-black shrink-0 px-2 py-0.5 rounded-md', dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600')}>{nights}N</span>
            </div>
         </div>
      </div>
    )
  }

  // --- EMPTY GAP SLOT ---
  const isGap = !!(gapStart || gapEnd)
  return (
    <button disabled={viewOnly} onClick={() => { if(!viewOnly) setEditing(true) }} className={cn('w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-bold transition-all', isGap ? (dk ? 'border-amber-500/40 text-amber-400 bg-amber-500/5' : 'border-amber-400 text-amber-600 bg-amber-50') : (dk ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'), viewOnly && "opacity-60 cursor-default hover:bg-transparent pointer-events-none")}>
      {!viewOnly && <Plus size={16} />} {isGap ? `${lang === 'de' ? 'Lücke füllen' : 'Fill gap'} (${fmtDateDe(effectiveIn)} ➔ ${fmtDateDe(effectiveOut)})` : (lang === 'de' ? 'Bett zuweisen' : 'Assign bed')}
    </button>
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

// --- MAIN MOBILE ROOM CARD COMPONENT ---
export default function MobileRoomCard({
  card, durationStart, durationEnd, dk, lang, allCardsOfSameType, isMasterPricingActive = false,
  onUpdate, onDelete, onApplyToSameType, viewOnly, employeeOptions
}: any) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const beds = bedsForType(card.roomType, card.bedCount)
  const nights = calculateNights(durationStart, durationEnd)
  const employees = card.employees ?? []

  // Ensure employees are clamped to duration
  useEffect(() => {
    if (viewOnly) return; 
    const currentEmps = card.employees ?? [];
    if (!currentEmps.length) return;
    
    let changed = false;
    const changedEmployees: any[] = [];
    
    const newEmp = currentEmps.map((emp: any) => {
       let inD = emp.checkIn || '';
       let outD = emp.checkOut || '';
       let modified = false;

       if (inD && outD) {
           if (outD <= durationStart || inD >= durationEnd) {
              inD = ''; outD = ''; modified = true;
           } else {
              if (inD < durationStart) { inD = durationStart; modified = true; }
              if (outD > durationEnd) { outD = durationEnd; modified = true; }
           }
       }
       
       if (modified) {
           changed = true;
           const updatedEmp = { ...emp, checkIn: inD === '' ? null : inD, checkOut: outD === '' ? null : outD };
           changedEmployees.push(updatedEmp);
           return updatedEmp;
       }
       return emp;
    });

    if (changed) {
       onUpdate(card.id, { employees: newEmp });
       changedEmployees.forEach(emp => {
         enqueue({ type: 'updateEmployee', payload: { id: emp.id, checkIn: emp.checkIn, checkOut: emp.checkOut } });
       });
    }
  }, [durationStart, durationEnd, JSON.stringify(card.employees)]);

  const inputCls = cn('px-3 py-2 rounded-lg text-sm font-bold outline-none border transition-all h-[42px] w-full', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', viewOnly && "opacity-60 cursor-default")
  const labelCls = cn('text-[10px] font-black uppercase tracking-widest mb-1.5 block', dk ? 'text-slate-500' : 'text-slate-400')

  function queueSave(patch: Partial<RoomCardType>) {
    if (viewOnly) return;
    onUpdate(card.id, patch)
    setTimeout(async () => {
      try { await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...patch } }) }
      catch (e) { console.error(e) }
    }, 400)
  }

  // --- FINANCIAL UPDATE LOGIC (Adapted for Mobile Grid) ---
  const updateNetto = (v: string) => {
    if (viewOnly) return;
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const n = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const m = card.roomMwst as number | null | undefined;
    if (m != null && String(m) !== '') {
      const b = n !== null ? Number((n * (1 + m / 100)).toFixed(2)) : null;
      queueSave({ roomNetto: n, roomBrutto: b } as any);
    } else {
      queueSave({ roomNetto: n, roomBrutto: null } as any);
    }
  }

  const updateBrutto = (v: string) => {
    if (viewOnly) return;
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const b = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const m = card.roomMwst as number | null | undefined;
    if (m != null && String(m) !== '') {
      const n = b !== null ? Number((b / (1 + m / 100)).toFixed(2)) : null;
      queueSave({ roomBrutto: b, roomNetto: n } as any);
    } else {
      queueSave({ roomBrutto: b, roomNetto: null } as any);
    }
  }

  const updateMwst = (v: string | null) => {
    if (viewOnly) return;
    const cleanV = v ? v.replace(/^0+(?=\d)/, '') : null;
    const m = cleanV === null || cleanV === '' ? null : normalizeNumberInput(cleanV);
    const n = card.roomNetto as number | null | undefined;
    const b = card.roomBrutto as number | null | undefined;
    if (m != null && cleanV !== '') {
      if (n != null) {
        queueSave({ roomMwst: m, roomBrutto: Number((n * (1 + m / 100)).toFixed(2)) } as any);
      } else if (b != null) {
        queueSave({ roomMwst: m, roomNetto: Number((b / (1 + m / 100)).toFixed(2)) } as any);
      } else {
        queueSave({ roomMwst: m } as any);
      }
    } else {
      queueSave({ roomMwst: null, roomBrutto: null } as any);
    }
  }

  const bNettoDisplay = (card.roomBrutto != null && card.roomMwst != null && String(card.roomMwst) !== '') ? (Number(card.roomBrutto) / (1 + Number(card.roomMwst)/100)).toFixed(2) : '';
  const bBruttoDisplay = (card.roomNetto != null && card.roomMwst != null && String(card.roomMwst) !== '') ? (Number(card.roomNetto) * (1 + Number(card.roomMwst)/100)).toFixed(2) : '';

  const multiplier = card.pricingTab === 'per_room' ? nights : (card.pricingTab === 'total_room' ? 1 : nights * beds);
  const tNetto = (card.roomNetto != null ? Number(card.roomNetto) : Number(bNettoDisplay) || 0) * multiplier;
  
  const currentDiscountValue = card.discountValue as number | null | undefined;
  const currentDiscountType = card.discountType as 'percentage' | 'fixed' | undefined || 'percentage';

  let dNettoTotal = tNetto;
  if (currentDiscountValue && currentDiscountValue > 0) {
      if (currentDiscountType === 'percentage') {
          dNettoTotal = tNetto * (1 - currentDiscountValue/100);
      } else {
          if (card.pricingTab === 'total_room') {
              dNettoTotal = Math.max(0, tNetto - currentDiscountValue);
          } else {
              const rawUnit = card.roomNetto != null ? Number(card.roomNetto) : Number(bNettoDisplay) || 0;
              const discountedUnit = Math.max(0, rawUnit - currentDiscountValue);
              dNettoTotal = discountedUnit * multiplier;
          }
      }
  }
  const dBruttoTotal = dNettoTotal * (1 + (Number(card.roomMwst) || 0) / 100);

  const nVal = card.roomNetto === 0 ? '' : (card.roomNetto != null ? card.roomNetto : bNettoDisplay);
  const bVal = card.roomBrutto === 0 ? '' : (card.roomBrutto != null ? card.roomBrutto : bBruttoDisplay);

  return (
    <div className={cn('rounded-xl border transition-all shadow-sm flex flex-col w-full', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      
      {/* 1. COLLAPSED HEADER */}
      <div className={cn("flex items-center justify-between p-4 cursor-pointer w-full", isOpen && (dk ? "border-b border-white/10 bg-black/20" : "border-b border-slate-100 bg-slate-50/50"))} onClick={() => setIsOpen(!isOpen)}>
         <div className="flex items-center gap-3">
            <button className={cn("p-1 rounded-md transition-all shrink-0", dk ? "text-slate-400" : "text-slate-500")}>
               {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <div className="flex flex-col">
               <div className="flex items-center gap-2">
                  <span className={cn("font-black text-sm", dk ? "text-white" : "text-slate-900")}>{card.roomType}</span>
                  <span className={cn("font-bold text-sm", dk ? "text-slate-300" : "text-slate-700")}>{card.roomNo || '---'}</span>
               </div>
               <span className="text-[11px] font-bold text-slate-400">{nights} {lang==='de'?'Nächte':'Nights'} • {beds} {lang==='de'?'Betten':'Beds'}</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <span className={cn("font-black text-sm", dk ? "text-teal-400" : "text-teal-600")}>{formatCurrency(dBruttoTotal)}</span>
         </div>
      </div>

      {/* 2. EXPANDED BODY */}
      {isOpen && (
        <div className="flex flex-col p-4 gap-6">
           
           {/* SECTION A: CONFIGURATION 2x2 GRID */}
           <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                 <label className={labelCls}>{lang === 'de' ? 'Zimmertyp' : 'Room Type'}</label>
                 <select disabled={viewOnly} value={card.roomType} onChange={e => { const rt = e.target.value as any; queueSave({ roomType: rt, bedCount: rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount }) }} className={inputCls}>
                    <option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option><option value="WG">WG</option>
                 </select>
              </div>
              <div className="flex flex-col">
                 <label className={labelCls}>{lang === 'de' ? 'Betten' : 'Beds'}</label>
                 <div className={cn("flex items-center h-[42px] rounded-lg border overflow-hidden", dk ? "border-white/10 bg-[#1E293B]" : "border-slate-200 bg-white")}>
                    <button disabled={viewOnly || card.roomType !== 'WG'} onClick={() => queueSave({ bedCount: Math.max(1, (card.bedCount || 1) - 1) })} className={cn("flex-1 h-full font-black text-lg transition-colors border-r", dk ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100", (viewOnly || card.roomType !== 'WG') && "opacity-50 cursor-not-allowed")}>−</button>
                    <div className={cn("w-10 h-full flex items-center justify-center font-black text-sm", dk ? "text-white" : "text-slate-900")}>{card.bedCount || 1}</div>
                    <button disabled={viewOnly || card.roomType !== 'WG'} onClick={() => queueSave({ bedCount: (card.bedCount || 1) + 1 })} className={cn("flex-1 h-full font-black text-lg transition-colors border-l", dk ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100", (viewOnly || card.roomType !== 'WG') && "opacity-50 cursor-not-allowed")}>+</button>
                 </div>
              </div>
              <div className="flex flex-col">
                 <label className={labelCls}>{lang === 'de' ? 'Zimmer Nr.' : 'Room No.'}</label>
                 <input disabled={viewOnly} type="text" value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="..." className={inputCls} />
              </div>
              <div className="flex flex-col">
                 <label className={labelCls}>{lang === 'de' ? 'Etage' : 'Floor'}</label>
                 <input disabled={viewOnly} type="text" value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="..." className={inputCls} />
              </div>
           </div>

           {/* SECTION B: EMPLOYEES & BEDS */}
           <div className="flex flex-col gap-3 pt-4 border-t dark:border-white/10 border-slate-200">
              <h4 className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Mitarbeiter' : 'Employees'}</h4>
              <div className="flex flex-col gap-3">
                 {Array.from({ length: beds }).map((_, i) => {
                    const slotE = employees.filter(e => (e.slotIndex ?? 0) === i).sort((a,b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                    return (
                      <div key={i} className="flex flex-col gap-2 relative">
                         {/* Bed Indicator */}
                         <div className="flex items-center gap-2 mb-1">
                            <Bed size={14} className={dk ? "text-slate-500" : "text-slate-400"}/>
                            <span className={cn("text-[10px] font-black uppercase", dk ? "text-slate-500" : "text-slate-400")}>Bed {i + 1}</span>
                         </div>
                         
                         {slotE.length === 0 ? (
                           <MobileBedSlot viewOnly={viewOnly} employeeOptions={employeeOptions} slotIndex={i} employee={null} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={(idx:any, emp:any) => { const next = emp === null ? employees.filter(e => e.slotIndex !== idx) : employees.some(e => e.id === emp.id) ? employees.map(e => e.id === emp.id ? emp : e) : [...employees, emp]; onUpdate(card.id, { employees: next }); }} />
                         ) : (
                           slotE.map((emp, empIdx) => (
                             <MobileBedSlot viewOnly={viewOnly} employeeOptions={employeeOptions} key={emp.id} slotIndex={i} employee={emp} durationStart={durationStart} durationEnd={durationEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} isSubstitute={empIdx > 0} onUpdated={(idx:any, e:any) => { const next = e === null ? employees.filter(empItem => empItem.id !== emp.id) : employees.map(empItem => empItem.id === e.id ? e : empItem); onUpdate(card.id, { employees: next }); }} />
                           ))
                         )}
                         {getGapSlots(beds, employees, durationStart, durationEnd).filter(g => g.slotIndex === i).map((gap, gi) => (
                           <MobileBedSlot viewOnly={viewOnly} employeeOptions={employeeOptions} key={`gap-${i}-${gi}`} slotIndex={i} employee={null} durationStart={durationStart} durationEnd={durationEnd} gapStart={gap.gapStart} gapEnd={gap.gapEnd} roomCardId={card.id} durationId={card.durationId} dk={dk} lang={lang} onUpdated={(idx:any, emp:any) => { const next = emp === null ? employees : [...employees, emp]; onUpdate(card.id, { employees: next }); }} />
                         ))}
                      </div>
                    )
                 })}
              </div>
           </div>

           {/* SECTION C: FINANCIALS */}
           <div className={cn("flex flex-col p-4 rounded-xl gap-4 mt-2", dk ? "bg-[#1E293B] border border-white/5" : "bg-slate-50 border border-slate-200")}>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className="flex flex-col">
                    <label className={labelCls}>Netto (€)</label>
                    <input type="number" min={0} step="0.01" value={nVal} onChange={e => updateNetto(e.target.value)} disabled={viewOnly} style={noSpinner} className={cn(inputCls, card.roomBrutto != null && (dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'))} placeholder="Auto" />
                 </div>
                 
                 <div className="flex flex-col">
                    <label className={labelCls}>{lang === 'de' ? 'Rabatt' : 'Discount'}</label>
                    {currentDiscountValue == null ? (
                       <button disabled={viewOnly} onClick={() => queueSave({ discountValue: 0, discountType: 'fixed' } as any)} className={cn("h-[42px] rounded-lg border flex items-center justify-center transition-all w-full", dk ? "border-white/10 text-slate-400 hover:text-teal-400 bg-black/20" : "border-slate-200 text-slate-400 hover:text-teal-500 bg-white")}>
                         <Ticket size={16} />
                       </button>
                    ) : (
                       <div className="flex items-center gap-1.5 w-full">
                         <div className="relative flex items-center h-[42px] flex-1">
                           <input disabled={viewOnly} type="number" value={currentDiscountValue || ''} onChange={e => queueSave({ discountValue: e.target.value.replace(/^0+(?=\d)/, '') === '' ? null : normalizeNumberInput(e.target.value.replace(/^0+(?=\d)/, '')) } as any)} className={cn(inputCls, 'w-full pr-8 text-sm')} placeholder="0" />
                           <button disabled={viewOnly} onClick={() => queueSave({ discountType: currentDiscountType === 'percentage' ? 'fixed' : 'percentage'} as any)} className={cn("absolute right-1.5 w-7 h-7 rounded flex items-center justify-center text-[12px] font-black border transition-colors", dk ? "bg-white/10 border-white/10 text-white" : "bg-slate-100 border-slate-300 text-slate-700")}>
                             {currentDiscountType === 'percentage' ? '%' : '€'}
                           </button>
                         </div>
                         {!viewOnly && (
                           <button onClick={() => queueSave({ discountValue: null, discountType: 'percentage' } as any)} className={cn("p-2 transition-colors shrink-0", dk ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500")}><X size={16} /></button>
                         )}
                       </div>
                    )}
                 </div>

                 <div className="flex flex-col">
                    <label className={labelCls}>MwSt (%)</label>
                    <MobileMwstInput value={card.roomMwst as any} onChange={(v) => updateMwst(v || '')} isDarkMode={dk} disabled={viewOnly} />
                 </div>
                 
                 <div className="flex flex-col">
                    <label className={labelCls}>Brutto (€)</label>
                    <input type="number" min={0} step="0.01" value={bVal} onChange={e => updateBrutto(e.target.value)} disabled={viewOnly} style={noSpinner} className={cn(inputCls, card.roomNetto != null && (dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'))} placeholder="Auto" />
                 </div>
              </div>

              {/* Dynamic Totals Summary */}
              <div className={cn("flex flex-col pt-3 border-t", dk ? "border-white/10" : "border-slate-200")}>
                 <div className="flex justify-between items-center text-[12px]">
                    <span className={dk ? "text-slate-400" : "text-slate-500"}>Total Netto</span>
                    <span className={cn("font-bold", dk ? "text-slate-300" : "text-slate-700")}>{formatCurrency(tNetto)}</span>
                 </div>
                 {dNettoTotal !== tNetto && (
                    <div className="flex justify-between items-center text-[12px] mt-0.5">
                       <span className={dk ? "text-teal-500" : "text-teal-600"}>{lang === 'de' ? 'Nach Rabatt' : 'After Disc.'}</span>
                       <span className={cn("font-bold", dk ? "text-teal-400" : "text-teal-600")}>{formatCurrency(dNettoTotal)}</span>
                    </div>
                 )}
                 <div className="flex justify-between items-center text-[14px] mt-1.5 pt-1.5 border-t border-slate-200 dark:border-white/10">
                    <span className={cn("font-black", dk ? "text-white" : "text-slate-900")}>Total Brutto</span>
                    <span className={cn("font-black", dk ? "text-white" : "text-slate-900")}>{formatCurrency(dBruttoTotal)}</span>
                 </div>
              </div>

              {/* Apply to All & Delete Room */}
              {!viewOnly && (
                 <div className="flex flex-col gap-2 mt-2">
                    {allCardsOfSameType.length > 1 && (
                       <button onClick={() => onApplyToSameType(card)} className="w-full py-2.5 rounded-lg border border-dashed flex items-center justify-center gap-2 text-[12px] font-bold transition-all shadow-sm border-blue-500/50 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10 dark:hover:bg-blue-500/20">
                          <Copy size={14} /> {lang === 'de' ? `Auf alle ${card.roomType} anwenden` : `Apply to all ${card.roomType}`}
                       </button>
                    )}
                    <button onClick={() => setConfirmDelete(true)} className={cn("w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-[12px] font-bold transition-all shadow-sm", dk ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-600 hover:bg-red-100")}>
                       <Trash2 size={14} /> {lang === 'de' ? 'Zimmer löschen' : 'Delete Room'}
                    </button>
                 </div>
              )}
           </div>

        </div>
      )}
      
      {/* DELETE CONFIRMATION OVERLAY */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={cn('w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-2">{lang === 'de' ? 'Zimmer löschen?' : 'Delete Room?'}</h3>
            <p className="text-xs font-bold text-slate-500 mb-6">{lang === 'de' ? 'Alle Mitarbeiter in diesem Zimmer werden entfernt.' : 'All employees in this room will be removed.'}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className={cn("px-5 py-2.5 text-xs font-bold rounded-lg border", dk ? "border-white/10 text-slate-300 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={() => { onDelete(card.id); setConfirmDelete(false); }} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md">{lang === 'de' ? 'Löschen' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
