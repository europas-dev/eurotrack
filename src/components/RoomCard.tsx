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

function MwstInput({ value, onChange, isDarkMode, disabled }: { value: string | null, onChange: (v: string | null) => void, isDarkMode: boolean, disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const baseInputCls = cn('w-16 px-2 py-1.5 rounded-l-lg text-sm font-bold outline-none border transition-all h-[38px] text-center', disabled && "opacity-50 cursor-not-allowed bg-transparent", !disabled && (isDarkMode ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'));
  
  return (
    <div ref={ref} className="relative flex items-center h-[38px]">
      <input type="number" value={value ?? ''} onChange={e => { const cleanV = e.target.value.replace(/^0+(?=\d)/, ''); onChange(cleanV === '' ? null : cleanV); }} disabled={disabled} className={baseInputCls} placeholder="%" style={noSpinner} />
      <button onClick={() => setOpen(!open)} disabled={disabled} className={cn('px-1.5 h-[38px] rounded-r-lg border border-l-0 transition-all flex items-center justify-center', disabled && "opacity-50 cursor-not-allowed", !disabled && (isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'))}><ChevronDown size={14} /></button>
      {open && !disabled && (
        <div className={cn("absolute top-full right-0 mt-1 w-20 z-[999] rounded-lg shadow-xl overflow-hidden border", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          {[7, 19, 0].map(v => (
            <button key={v} onClick={() => { onChange(v.toString()); setOpen(false); }} className={cn("w-full text-center py-2 text-sm font-bold transition-all", isDarkMode ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100")}>{v}%</button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompactEmployeePill({ emp, dk, durationStart, durationEnd, isSubstitute }: any) {
  const [showPhone, setShowPhone] = useState(false);
  const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
  const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
  const textColor = status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400';
  const isPartial = (emp.checkIn || '') > durationStart || (emp.checkOut || '') < durationEnd;
  const hasPhone = emp.phone && emp.phone.trim() !== '+49' && emp.phone.trim() !== '';

  const tooltipText = `${calculateNights(emp.checkIn||'', emp.checkOut||'')}N (${fmtDateDe(emp.checkIn||'')} ➔ ${fmtDateDe(emp.checkOut||'')})`;

  return (
    <div title={tooltipText} onClick={(e) => { if(hasPhone) { e.stopPropagation(); setShowPhone(!showPhone); } }} className={cn("px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all cursor-pointer", isPartial ? "border-2 border-dashed" : "border-2 border-solid", empBorderColor(emp, dk), dk ? "bg-[#1E293B] text-slate-200" : "bg-slate-50 text-slate-700")}>
      {isSubstitute ? <CornerDownRight size={12} className={textColor} /> : <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />}
      <span className="truncate max-w-[120px]">{emp.name}</span>
      {hasPhone && !showPhone && (
        <Phone size={11} className={dk ? "text-slate-400" : "text-slate-500"} />
      )}
      {showPhone && hasPhone && (
        <span className={cn("ml-1 font-black text-[15px]", dk ? "text-blue-400" : "text-blue-600")} onClick={e => e.stopPropagation()}>{emp.phone}</span>
      )}
    </div>
  )
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
    'px-3 py-1.5 rounded-lg text-sm outline-none border transition-all h-[38px] font-bold',
    dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-blue-500 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 placeholder-slate-400'
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
      <div className={cn('flex items-center justify-between px-4 py-2 rounded-lg border', dk ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200')}>
        <span className={cn('text-sm font-bold', dk ? 'text-red-400' : 'text-red-700')}>{lang === 'de' ? 'Löschen' : 'Delete'} {employee?.name}?</span>
        <div className="flex gap-2">
          <button onClick={remove} disabled={saving} className="px-4 py-1.5 rounded bg-red-600 text-white text-xs font-bold">{lang === 'de' ? 'Ja' : 'Yes'}</button>
          <button onClick={() => setConfirmDel(false)} className={cn('px-4 py-1.5 rounded text-xs font-bold border', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
        </div>
      </div>
    )
  }

  if (!editing && employee) {
    return (
      <div className={cn('flex items-center gap-4 px-4 py-3 rounded-lg transition-all group relative', borderCls, isPartial ? 'border-2 border-dashed' : 'border-2 border-solid', dk ? 'bg-[#0F172A]' : 'bg-white')}>
        <IconToUse size={18} className={status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400'} />
        
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <span onClick={() => { setName(employee.name); setPhone(employee.phone || '+49 '); setCheckIn(employee.checkIn ?? effectiveIn); setCheckOut(employee.checkOut ?? effectiveOut); setEditing(true) }} className={cn('text-[15px] font-bold cursor-pointer truncate', dk ? 'text-white' : 'text-slate-900')}>{employee.name}</span>
        </div>

        {employee.phone && employee.phone !== '+49' && employee.phone.trim() !== '' && (
          <a href={`tel:${employee.phone.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors border shrink-0", dk ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100")}>
            <Phone size={12} /> <span className="hidden sm:inline">{employee.phone}</span>
          </a>
        )}

        <span className={cn('text-[14px] font-bold tabular-nums shrink-0 hidden md:block', dk ? 'text-slate-400' : 'text-slate-500')}>{fmtDateDe(employee.checkIn ?? '')} ➔ {fmtDateDe(employee.checkOut ?? '')}</span>
        <span className={cn('text-[15px] font-black shrink-0 w-12 text-right', dk ? 'text-slate-300' : 'text-slate-600')}>{calculateNights(employee.checkIn||'', employee.checkOut||'')}N</span>
        {saving ? <Loader2 size={18} className="animate-spin text-blue-400" /> : <button onClick={() => setConfirmDel(true)} className={cn('opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded shrink-0', dk ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50')}><Trash2 size={18} /></button>}
      </div>
    )
  }

  if (!editing) {
    const isGap = !!(gapStart || gapEnd)
    return (
      <button onClick={() => { setCheckIn(effectiveIn); setCheckOut(effectiveOut); setEditing(true); setTimeout(() => inputRef.current?.focus(), 40) }} className={cn('w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-sm font-bold transition-all', isGap ? (dk ? 'border-amber-500/40 text-amber-400 hover:bg-amber-900/10' : 'border-amber-400 text-amber-600 hover:bg-amber-50') : (dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400' : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'))}>
        <Plus size={16} /> {isGap ? `${lang === 'de' ? 'Lücke füllen' : 'Fill gap'} (${fmtDateDe(effectiveIn)} ➔ ${fmtDateDe(effectiveOut)})` : (lang === 'de' ? 'Bett zuweisen' : 'Assign bed')}
      </button>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3 p-4 rounded-xl border shadow-sm', dk ? 'bg-[#0F172A] border-white/10' : 'bg-slate-50 border-slate-200')}>
      <div className="flex items-center gap-3 w-full">
        <IconToUse size={18} className={dk ? 'text-blue-400 shrink-0 hidden sm:block' : 'text-blue-500 shrink-0 hidden sm:block'} />
        <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder={lang === 'de' ? 'Name...' : 'Name...'} className={cn(inputCls, 'flex-[6] min-w-0 text-base')} />
        <div className="relative flex items-center flex-[4] min-w-0">
          <Phone size={14} className={cn("absolute left-2.5", dk ? "text-slate-500" : "text-slate-400")} />
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="+49" className={cn(inputCls, 'w-full pl-8 text-base')} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-nowrap w-full">
        {/* Date fields made visible directly to ensure clickability */}
        <div className="relative w-[135px] shrink-0">
          <input 
            type="date" 
            value={checkIn} 
            onChange={e => setCheckIn(e.target.value)} 
            className={cn(inputCls, "w-full cursor-pointer text-[13px] uppercase")} 
          />
        </div>
        
        <span className="text-slate-400 text-sm hidden sm:block">➔</span>
        
        <div className="relative w-[135px] shrink-0">
          <input 
            type="date" 
            value={checkOut} 
            onChange={e => setCheckOut(e.target.value)} 
            className={cn(inputCls, "w-full cursor-pointer text-[13px] uppercase")} 
          />
        </div>

        {/* Clear Dates Inline */}
        <button 
          type="button" 
          onClick={() => { setCheckIn(''); setCheckOut(''); }} 
          className={cn("p-2 h-[38px] w-[38px] rounded-lg transition-colors border shrink-0 flex items-center justify-center", dk ? "border-white/10 text-slate-500 hover:text-red-400 hover:bg-white/5" : "border-slate-200 text-slate-400 hover:text-red-500 hover:bg-slate-50")} 
          title={lang === 'de' ? 'Daten löschen' : 'Clear dates'}
        >
           <X size={18} />
        </button>

        <div className={cn('px-2 rounded-lg border text-xs font-black text-center h-[38px] flex items-center justify-center shrink-0 w-12', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>{nights}N</div>
        
        <div className="flex-1 min-w-[10px]" />
        
        <button onClick={save} disabled={saving || !name.trim()} className="px-5 h-[38px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shrink-0 transition-colors">{lang === 'de' ? 'Speichern' : 'Save'}</button>
        <button onClick={() => setEditing(false)} className={cn('px-3 h-[38px] rounded-lg text-sm transition-all shrink-0 border', dk ? 'border-white/10 text-slate-400 hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}><X size={16} /></button>
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
  discountValueKey, discountTypeKey,
  card, dk, lang, onPatch, disabled, multiplier, activeTab, queueSave
}: {
  nettoKey: keyof RoomCardType; mwstKey: keyof RoomCardType; bruttoKey: keyof RoomCardType;
  energyNettoKey?: keyof RoomCardType; energyMwstKey?: keyof RoomCardType; energyBruttoKey?: keyof RoomCardType;
  discountValueKey: keyof RoomCardType; discountTypeKey: keyof RoomCardType;
  card: RoomCardType; dk: boolean; lang: 'de' | 'en'; onPatch: (p: Partial<RoomCardType>) => void; disabled?: boolean; multiplier: number; activeTab: PricingTab;
  queueSave: (patch: Partial<RoomCardType>) => void;
}) {
  const lbl = cn('text-[10px] font-black uppercase tracking-widest h-4 flex items-end mb-1.5', dk ? 'text-slate-500' : 'text-slate-400')
  const sumLbl = cn('text-[11px] font-black mt-1 pl-1 h-4 flex items-center', dk ? 'text-slate-500' : 'text-slate-400')
  const inputClsBase = cn('px-3 py-1.5 rounded-lg text-sm font-bold outline-none border transition-all h-[38px]', dk ? 'bg-[#1E293B] border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')
  const disabledInputCls = cn(inputClsBase, 'opacity-50 cursor-not-allowed pointer-events-none bg-transparent')

  const showSum = activeTab !== 'total_room';

  const updateNetto = (v: string) => {
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const n = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const m = card[mwstKey] as number | null | undefined;
    if (m != null && String(m) !== '') {
      const b = n !== null ? Number((n * (1 + m / 100)).toFixed(2)) : null;
      onPatch({ [nettoKey]: n, [bruttoKey]: b } as any);
    } else {
      onPatch({ [nettoKey]: n, [bruttoKey]: null } as any);
    }
  }

  const updateBrutto = (v: string) => {
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const b = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const m = card[mwstKey] as number | null | undefined;
    if (m != null && String(m) !== '') {
      const n = b !== null ? Number((b / (1 + m / 100)).toFixed(2)) : null;
      onPatch({ [bruttoKey]: b, [nettoKey]: n } as any);
    } else {
      onPatch({ [bruttoKey]: b, [nettoKey]: null } as any);
    }
  }

  const updateMwst = (v: string) => {
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const m = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const n = card[nettoKey] as number | null | undefined;
    const b = card[bruttoKey] as number | null | undefined;
    if (m != null && cleanV !== '') {
      if (n != null) {
        onPatch({ [mwstKey]: m, [bruttoKey]: Number((n * (1 + m / 100)).toFixed(2)) } as any);
      } else if (b != null) {
        onPatch({ [mwstKey]: m, [nettoKey]: Number((b / (1 + m / 100)).toFixed(2)) } as any);
      } else {
        onPatch({ [mwstKey]: m } as any);
      }
    } else {
      onPatch({ [mwstKey]: null, [bruttoKey]: null } as any);
    }
  }

  const updateEnergyNetto = (v: string) => {
    if (!energyNettoKey || !energyBruttoKey) return;
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const n = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const m = card[energyMwstKey!] as number | null | undefined;
    if (m != null && String(m) !== '') {
      const b = n !== null ? Number((n * (1 + m / 100)).toFixed(2)) : null;
      onPatch({ [energyNettoKey]: n, [energyBruttoKey]: b } as any);
    } else {
      onPatch({ [energyNettoKey]: n, [energyBruttoKey]: null } as any);
    }
  }

  const updateEnergyBrutto = (v: string) => {
    if (!energyNettoKey || !energyBruttoKey) return;
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const b = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const m = card[energyMwstKey!] as number | null | undefined;
    if (m != null && String(m) !== '') {
      const n = b !== null ? Number((b / (1 + m / 100)).toFixed(2)) : null;
      onPatch({ [energyBruttoKey]: b, [energyNettoKey]: n } as any);
    } else {
      onPatch({ [energyBruttoKey]: b, [energyNettoKey]: null } as any);
    }
  }

  const updateEnergyMwst = (v: string) => {
    if (!energyNettoKey || !energyBruttoKey || !energyMwstKey) return;
    const cleanV = v.replace(/^0+(?=\d)/, '');
    const m = cleanV === '' ? null : normalizeNumberInput(cleanV);
    const n = card[energyNettoKey] as number | null | undefined;
    const b = card[energyBruttoKey] as number | null | undefined;
    if (m != null && cleanV !== '') {
      if (n != null) {
        onPatch({ [energyMwstKey]: m, [energyBruttoKey]: Number((n * (1 + m / 100)).toFixed(2)) } as any);
      } else if (b != null) {
        onPatch({ [energyMwstKey]: m, [energyNettoKey]: Number((b / (1 + m / 100)).toFixed(2)) } as any);
      } else {
        onPatch({ [energyMwstKey]: m } as any);
      }
    } else {
      onPatch({ [energyMwstKey]: null, [energyBruttoKey]: null } as any);
    }
  }

  const bNettoDisplay = (card[bruttoKey] != null && card[mwstKey] != null && String(card[mwstKey]) !== '') ? (Number(card[bruttoKey]) / (1 + Number(card[mwstKey])/100)).toFixed(2) : '';
  const bBruttoDisplay = (card[nettoKey] != null && card[mwstKey] != null && String(card[mwstKey]) !== '') ? (Number(card[nettoKey]) * (1 + Number(card[mwstKey])/100)).toFixed(2) : '';

  const eNettoDisplay = (energyBruttoKey && energyMwstKey && card[energyBruttoKey] != null && card[energyMwstKey] != null && String(card[energyMwstKey]) !== '') ? (Number(card[energyBruttoKey]) / (1 + Number(card[energyMwstKey])/100)).toFixed(2) : '';
  const eBruttoDisplay = (energyNettoKey && energyMwstKey && card[energyNettoKey] != null && card[energyMwstKey] != null && String(card[energyMwstKey]) !== '') ? (Number(card[energyNettoKey]) * (1 + Number(card[energyMwstKey])/100)).toFixed(2) : '';

  const tNetto = (card[nettoKey] != null ? Number(card[nettoKey]) : Number(bNettoDisplay) || 0) * multiplier;
  const tBrutto = (card[bruttoKey] != null ? Number(card[bruttoKey]) : Number(bBruttoDisplay) || 0) * multiplier;
  const tENetto = energyNettoKey ? (card[energyNettoKey] != null ? Number(card[energyNettoKey]) : Number(eNettoDisplay) || 0) * multiplier : 0;
  const tEBrutto = energyBruttoKey ? (card[energyBruttoKey] != null ? Number(card[energyBruttoKey]) : Number(eBruttoDisplay) || 0) * multiplier : 0;

  const currentDiscountValue = card[discountValueKey] as number | null | undefined;
  const currentDiscountType = card[discountTypeKey] as 'percentage' | 'fixed' | undefined || 'percentage';

  let dNettoTotal = tNetto;
  if (currentDiscountValue && currentDiscountValue > 0) {
      if (currentDiscountType === 'percentage') {
          dNettoTotal = tNetto * (1 - currentDiscountValue/100);
      } else {
          const rawUnit = card[nettoKey] != null ? Number(card[nettoKey]) : Number(bNettoDisplay) || 0;
          const discountedUnit = Math.max(0, rawUnit - currentDiscountValue);
          dNettoTotal = discountedUnit * multiplier;
      }
  }

  const dBruttoTotal = dNettoTotal * (1 + (Number(card[mwstKey]) || 0) / 100);

  const nVal = card[nettoKey] === 0 ? '' : (card[nettoKey] != null ? card[nettoKey] : bNettoDisplay);
  const bVal = card[bruttoKey] === 0 ? '' : (card[bruttoKey] != null ? card[bruttoKey] : bBruttoDisplay);
  const enVal = energyNettoKey && card[energyNettoKey] === 0 ? '' : (card[energyNettoKey!] != null ? card[energyNettoKey!] : eNettoDisplay);
  const ebVal = energyBruttoKey && card[energyBruttoKey] === 0 ? '' : (card[energyBruttoKey!] != null ? card[energyBruttoKey!] : eBruttoDisplay);

  return (
    <div className={cn("flex items-start gap-4 flex-wrap", disabled && "opacity-50 pointer-events-none")}>
      
      {/* BASE PRICE GROUP */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-1 flex-nowrap">
          <div className="flex flex-col shrink-0 pr-1.5">
            <p className={lbl}>Netto (€)</p>
            <input type="number" min={0} step="0.01" value={nVal} onChange={e => updateNetto(e.target.value)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputClsBase, 'w-24', card[bruttoKey] != null && (dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'))} placeholder="Auto" />
            <div className={cn(sumLbl, "min-h-[16px]")}>
              {showSum && tNetto > 0 && <span>Σ {formatCurrency(tNetto)}</span>}
              {dNettoTotal !== tNetto && (
                 <span className={cn("ml-1 font-black flex items-center gap-0.5", dk ? "text-teal-400" : "text-teal-600")}>
                   ↳ {formatCurrency(dNettoTotal / multiplier)} {multiplier > 1 && <span className="text-[9px] opacity-70 font-bold">({formatCurrency(dNettoTotal)})</span>}
                 </span>
              )}
            </div>
          </div>
          
         {currentDiscountValue == null ? (
            <div className="mt-[22px] shrink-0">
              <button onClick={() => queueSave({ [discountValueKey]: 0, [discountTypeKey]: 'fixed' } as any)} className={cn("p-1.5 h-[38px] rounded-lg border flex items-center justify-center transition-all", dk ? "border-white/10 text-slate-400 hover:text-teal-400 bg-[#1E293B]" : "border-slate-200 text-slate-400 hover:text-teal-500 hover:bg-slate-50 bg-white")}>
                <Ticket size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col shrink-0">
              <p className={lbl}>{lang === 'de' ? 'Rabatt' : 'Disc.'}</p>
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center h-[38px] w-[95px]">
                  <input 
                    type="number" 
                    value={currentDiscountValue || ''} 
                    onChange={e => queueSave({ [discountValueKey]: e.target.value.replace(/^0+(?=\d)/, '') === '' ? null : normalizeNumberInput(e.target.value.replace(/^0+(?=\d)/, '')) } as any)} 
                    className={cn(inputClsBase, 'w-full pr-8 h-full text-sm font-black')} 
                    placeholder="0" 
                  />
                  <button 
                    onClick={() => queueSave({ [discountTypeKey]: currentDiscountType === 'percentage' ? 'fixed' : 'percentage'} as any)} 
                    className={cn("absolute right-1 w-7 h-7 rounded flex items-center justify-center text-[12px] font-black border transition-colors", dk ? "bg-white/10 border-white/10 text-white hover:bg-white/20" : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200")}
                  >
                    {currentDiscountType === 'percentage' ? '%' : '€'}
                  </button>
                </div>
                <button onClick={() => queueSave({ [discountValueKey]: null, [discountTypeKey]: 'percentage' } as any)} className={cn("p-1 transition-colors", dk ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500")}>
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col shrink-0">
        <p className={lbl}>MwSt (%)</p>
        <MwstInput value={card[mwstKey] as any} onChange={(v) => updateMwst(v || '')} isDarkMode={dk} disabled={disabled} />
        <div className={sumLbl}/>
      </div>

      <div className="flex flex-col shrink-0">
        <p className={lbl}>Brutto (€)</p>
        <input type="number" min={0} step="0.01" value={bVal} onChange={e => updateBrutto(e.target.value)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputClsBase, 'w-24 h-[38px]', card[nettoKey] != null && (dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'))} placeholder="Auto" />
        <div className={cn(sumLbl, "min-h-[16px]")}>
          {showSum && tBrutto > 0 && <span>Σ {formatCurrency(tBrutto)}</span>}
          {dNettoTotal !== tNetto && (
             <span className={cn("ml-1 font-black flex items-center gap-0.5", dk ? "text-teal-400" : "text-teal-600")}>
               ↳ {formatCurrency(dBruttoTotal / multiplier)} {multiplier > 1 && <span className="text-[9px] opacity-70 font-bold">({formatCurrency(dBruttoTotal)})</span>}
             </span>
          )}
        </div>
      </div>

      {/* ENERGY GROUP */}
      {energyNettoKey && (
        <div className={cn("flex items-start gap-4 px-4 py-2.5 rounded-xl border border-dashed ml-2 shrink-0", dk ? "border-yellow-500/30 bg-yellow-500/5" : "border-yellow-400/60 bg-yellow-50/50")}>
          <div className="flex flex-col shrink-0">
            <p className={cn(lbl, dk ? "text-yellow-600/80" : "text-yellow-600/70")}><Zap size={10} className="inline mr-1 text-yellow-500" />{lang === 'de' ? 'En. Netto' : 'En. Netto'}</p>
            <input type="number" min={0} step="0.01" value={enVal} onChange={e => updateEnergyNetto(e.target.value)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputClsBase, 'w-24 h-[38px]', card[energyBruttoKey!] != null && (dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'))} placeholder="Auto" />
            <div className={cn(sumLbl, dk ? "text-yellow-600/80" : "text-yellow-600/70")}>{showSum && tENetto > 0 && `Σ ${formatCurrency(tENetto)}`}</div>
          </div>
          <div className="flex flex-col shrink-0">
            <p className={lbl}>MwSt</p>
            <MwstInput value={card[energyMwstKey!] as any} onChange={(v) => updateEnergyMwst(v || '')} isDarkMode={dk} disabled={disabled} />
            <div className={sumLbl}/>
          </div>
          <div className="flex flex-col shrink-0">
            <p className={cn(lbl, dk ? "text-yellow-600/80" : "text-yellow-600/70")}>{lang === 'de' ? 'En. Brutto' : 'En. Brutto'}</p>
            <input type="number" min={0} step="0.01" value={ebVal} onChange={e => updateEnergyBrutto(e.target.value)} disabled={disabled} style={noSpinner} className={cn(disabled ? disabledInputCls : inputClsBase, 'w-24 h-[38px]', card[energyNettoKey!] != null && (dk ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'))} placeholder="Auto" />
            <div className={cn(sumLbl, dk ? "text-yellow-600/80" : "text-yellow-600/70")}>{showSum && tEBrutto > 0 && `Σ ${formatCurrency(tEBrutto)}`}</div>
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
  const activeTab: PricingTab = card.pricingTab ?? 'per_bed'
  const employees = card.employees ?? []

  // DATE BOUNDARY CLAMPING ENGINE
  useEffect(() => {
    if (!employees.length) return;
    let changed = false;
    const newEmp = employees.map(emp => {
       let inD = emp.checkIn || '';
       let outD = emp.checkOut || '';
       let modified = false;

       if (inD && outD) {
           if (outD <= durationStart || inD >= durationEnd) {
              inD = '';
              outD = '';
              modified = true;
           } else {
              if (inD < durationStart) { inD = durationStart; modified = true; }
              if (outD > durationEnd) { outD = durationEnd; modified = true; }
           }
       }
       if (modified) changed = true;
       return modified ? { ...emp, checkIn: inD, checkOut: outD } : emp;
    });

    if (changed) {
       onUpdate(card.id, { employees: newEmp });
       newEmp.forEach(emp => {
          enqueue({ type: 'updateEmployee', payload: { id: emp.id, checkIn: emp.checkIn, checkOut: emp.checkOut } });
       });
    }
  }, [durationStart, durationEnd]);

  const inputCls = cn('px-3 py-1.5 rounded-lg text-sm font-bold outline-none border transition-all h-[38px]', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')
  const labelCls = cn('text-[10px] font-black uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')
  const tabBtn = (active: boolean) => cn('px-5 py-2.5 rounded-lg text-sm font-black border transition-all shadow-sm', active ? 'bg-blue-600 text-white border-transparent' : dk ? 'bg-[#1E293B] text-slate-400 border-white/10 hover:bg-white/5 hover:text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    onUpdate(card.id, patch)
    saveTimer.current = setTimeout(async () => {
      try { await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...patch } }) }
      catch (e) { console.error(e) }
    }, 400)
  }

  const multiplier = activeTab === 'per_bed' ? (beds * nights) : activeTab === 'per_room' ? nights : 1;
  const calculatedFinalBrutto = calcRoomCardTotal(card, durationStart, durationEnd);
  
  let baseNetto = 0; let mwstRate = 0;
  let cEnergyNetto = 0; let eMwstRate = 0;
  let currentDiscountValue = 0; let currentDiscountType = 'percentage';

  if (activeTab === 'per_bed') {
     baseNetto = (Number(card.bedNetto) || 0) * multiplier;
     mwstRate = Number(card.bedMwst) || 0;
     cEnergyNetto = (Number(card.bedEnergyNetto) || 0) * multiplier;
     eMwstRate = Number(card.bedEnergyMwst) || 0;
     currentDiscountValue = Number(card.bedDiscountValue) || 0;
     currentDiscountType = card.bedDiscountType || 'percentage';
  } else if (activeTab === 'per_room') {
     baseNetto = (Number(card.roomNetto) || 0) * multiplier;
     mwstRate = Number(card.roomMwst) || 0;
     cEnergyNetto = (Number(card.roomEnergyNetto) || 0) * multiplier;
     eMwstRate = Number(card.roomEnergyMwst) || 0;
     currentDiscountValue = Number(card.roomDiscountValue) || 0;
     currentDiscountType = card.roomDiscountType || 'percentage';
  } else {
     baseNetto = Number(card.totalNetto) || 0;
     mwstRate = Number(card.totalMwst) || 0;
     cEnergyNetto = Number(card.totalEnergyNetto) || 0;
     eMwstRate = Number(card.totalEnergyMwst) || 0;
     currentDiscountValue = Number(card.totalDiscountValue) || 0;
     currentDiscountType = card.totalDiscountType || 'percentage';
  }

  let cRoomNetto = baseNetto;
  if (currentDiscountValue > 0) {
     if (currentDiscountType === 'percentage') {
         cRoomNetto = baseNetto * (1 - currentDiscountValue/100);
     } else {
         const baseUnit = (activeTab === 'per_bed' ? Number(card.bedNetto) : activeTab === 'per_room' ? Number(card.roomNetto) : Number(card.totalNetto)) || 0;
         const discountedUnit = Math.max(0, baseUnit - currentDiscountValue);
         cRoomNetto = discountedUnit * multiplier;
     }
  }

  const cRoomMwst = cRoomNetto * (mwstRate / 100);
  const cEnergyMwst = cEnergyNetto * (eMwstRate / 100);

  const pricePerBedPerNight = (beds > 0 && nights > 0) ? cRoomNetto / (beds * nights) : 0;
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
               
               <span className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/10 text-blue-500 font-black text-sm shrink-0">
                 <Moon size={18} /> <span className="text-[16px] lg:text-[18px]">{nights}</span> 
                 <div className="w-px h-4 bg-blue-500/30 mx-1.5" /> 
                 <Bed size={18} /> <span className="text-[16px] lg:text-[18px]">{beds}</span>
               </span>
             </div>
             
             <div className="flex-1 flex gap-2 items-center px-4 overflow-x-auto no-scrollbar">
                {Array.from({ length: beds }).flatMap((_, i) => {
                   const slotE = employees.filter(e => (e.slotIndex ?? 0) === i).sort((a,b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                   return slotE.map((emp, empIdx) => {
                     return <CompactEmployeePill key={emp.id} emp={emp} dk={dk} lang={lang} durationStart={durationStart} durationEnd={durationEnd} isSubstitute={empIdx > 0} />
                   });
                })}
                {(() => {
                  const occupiedSlots = new Set(employees.map(e => e.slotIndex ?? 0)).size;
                  const freeSlots = beds - occupiedSlots;
                  if (freeSlots > 0) {
                    return <div className={cn("flex items-center gap-2 px-5 py-2 rounded-full text-[14px] font-black whitespace-nowrap border-2 border-dashed", dk ? "border-amber-500/40 text-amber-500 bg-amber-500/5" : "border-amber-400 text-amber-600 bg-amber-50")}><Plus size={16} /> {freeSlots} {lang === 'de' ? 'Frei' : 'Empty'}</div>;
                  }
                  return null;
                })()}
             </div>
             
             <div className="flex flex-col items-end shrink-0 ml-4">
                {isMasterPricingActive ? <span className={cn("text-[10px] font-black uppercase tracking-widest", dk ? "text-slate-600" : "text-slate-400")}>{lang === 'de' ? 'Master Aktiv' : 'Master Active'}</span> : <span className="text-xl font-black tabular-nums">{roomTotalDisplay}</span>}
             </div>
             <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className={cn('p-2 rounded transition-all shrink-0 ml-4', dk ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}><Trash2 size={18} /></button>
           </>
        ) : (
           <div className="flex items-center gap-3 flex-1">
             <select value={card.roomType} onChange={e => { const rt = e.target.value as any; queueSave({ roomType: rt, bedCount: rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount }) }} className={cn(inputCls, 'w-20 text-center pr-0')}><option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option><option value="WG">WG</option></select>
             <div className="flex items-center gap-1.5"><span className={labelCls}>No:</span><input type="text" value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="101" className={cn(inputCls, 'w-44')} /></div>
             <div className="flex items-center gap-1.5"><span className={labelCls}>Etg:</span><input type="text" value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="1" className={cn(inputCls, 'w-16')} /></div>
             <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-500 font-black text-sm shrink-0 ml-2">
               <Moon size={16} /> <span className="text-[15px]">{nights}</span> 
               <div className="w-px h-3 bg-blue-500/30 mx-1" /> 
               <Bed size={16} /> <span className="text-[15px]">{beds}</span>
             </span>
             <div className="flex-1" />
             {!isMasterPricingActive && (
               <>
                 <button onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowPricing(!showPricing); 
                    if (!showPricing && !card.pricingTab) { queueSave({ pricingTab: 'per_bed' }); } 
                 }} className={tabBtn(showPricing)}>{lang === 'de' ? 'Preis' : 'Price'}</button>
                 <div className="flex flex-col items-end min-w-[120px] ml-2"><span className="text-xl font-black">{roomTotalDisplay}</span></div>
               </>
             )}
             <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
           </div>
        )}
      </div>

      {isOpen && (
        <div className={cn("p-6 border-t", dk ? "bg-black/20 border-white/5" : "bg-slate-50/50 border-slate-100")}>
           {showPricing && !isMasterPricingActive && (
             <div className={cn("mb-6 flex flex-col xl:flex-row shadow-sm rounded-xl border", dk ? "border-white/10 bg-[#0F172A]" : "border-slate-200 bg-white")}>
                
                {/* LEFT SIDE: PRICING INPUTS */}
                <div className={cn("flex-1 p-5 border-b xl:border-b-0 xl:border-r flex flex-col gap-5 rounded-t-xl xl:rounded-l-xl xl:rounded-tr-none", dk ? "border-white/10" : "border-slate-200")}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => queueSave({ pricingTab: 'per_bed' })} className={tabBtn(activeTab === 'per_bed')}>{lang === 'de' ? 'Preis/Bett' : 'Price/Bed'}</button>
                    <button onClick={() => queueSave({ pricingTab: 'per_room' })} className={tabBtn(activeTab === 'per_room')}>{lang === 'de' ? 'Preis/Zimmer' : 'Price/Room'}</button>
                    <button onClick={() => queueSave({ pricingTab: 'total_room' })} className={tabBtn(activeTab === 'total_room')}>{lang === 'de' ? 'Gesamt/Zimmer' : 'Total/Room'}</button>
                  </div>
                  
                  <div className="flex items-start gap-4 flex-wrap pb-2">
                    <InlineNMBRow 
                      nettoKey={activeTab === 'per_bed' ? "bedNetto" : activeTab === 'per_room' ? "roomNetto" : "totalNetto"} 
                      mwstKey={activeTab === 'per_bed' ? "bedMwst" : activeTab === 'per_room' ? "roomMwst" : "totalMwst"} 
                      bruttoKey={activeTab === 'per_bed' ? "bedBrutto" : activeTab === 'per_room' ? "roomBrutto" : "totalBrutto"} 
                      energyNettoKey={activeTab === 'per_bed' ? "bedEnergyNetto" : activeTab === 'per_room' ? "roomEnergyNetto" : "totalEnergyNetto"}
                      energyMwstKey={activeTab === 'per_bed' ? "bedEnergyMwst" : activeTab === 'per_room' ? "roomEnergyMwst" : "totalEnergyMwst"}
                      energyBruttoKey={activeTab === 'per_bed' ? "bedEnergyBrutto" : activeTab === 'per_room' ? "roomEnergyBrutto" : "totalEnergyBrutto"}
                      discountValueKey={activeTab === 'per_bed' ? "bedDiscountValue" : activeTab === 'per_room' ? "roomDiscountValue" : "totalDiscountValue"}
                      discountTypeKey={activeTab === 'per_bed' ? "bedDiscountType" : activeTab === 'per_room' ? "roomDiscountType" : "totalDiscountType"}
                      card={card} dk={dk} lang={lang} onPatch={queueSave} multiplier={multiplier} activeTab={activeTab} queueSave={queueSave}
                    />
                    
                    {allCardsOfSameType.length > 1 && (
                      <div className="flex items-start h-full pt-[22px]">
                        <button onClick={() => { onApplyToSameType(card); setApplyActive(true); setTimeout(()=>setApplyActive(false), 1000); }} className={cn('px-4 h-[38px] rounded-lg text-sm font-black border flex items-center gap-2 transition-all', isApplyActive ? 'bg-green-500 text-white border-transparent shadow-lg' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-blue-400 bg-[#1E293B]' : 'border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 bg-white')}>
                          {isApplyActive ? <Check size={14}/> : <Copy size={14}/>} All {card.roomType}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE: DETAILED SUMMARY COLUMN */}
                <div className={cn("w-full xl:w-[320px] shrink-0 p-5 flex flex-col justify-between rounded-b-xl xl:rounded-r-xl xl:rounded-bl-none", dk ? "bg-[#0B1224]" : "bg-slate-50")}>
                   <div className="space-y-2 mb-4 text-[13px] font-medium">
                      <div className="flex justify-between items-center"><span className={dk ? "text-slate-400" : "text-slate-500"}>{lang === 'de' ? 'Zimmer Netto' : 'Room Netto'}</span><span className={cn("font-bold", dk ? "text-white" : "text-slate-900")}>{formatCurrency(cRoomNetto)}</span></div>
                      {cEnergyNetto > 0 && <div className="flex justify-between items-center text-yellow-600 dark:text-yellow-500"><span className="opacity-80">{lang === 'de' ? 'Energie Netto' : 'Energy Netto'}</span><span>{formatCurrency(cEnergyNetto)}</span></div>}
                      
                      {(cRoomMwst > 0 || cEnergyMwst > 0) && <div className={cn("w-full h-px my-2", dk ? "bg-white/10" : "bg-slate-200")} />}
                      
                      {cRoomMwst > 0 && <div className="flex justify-between items-center text-slate-500 dark:text-slate-400"><span>{lang === 'de' ? 'MwSt (Zimmer)' : 'MwSt (Room)'}</span><span>{formatCurrency(cRoomMwst)}</span></div>}
                      {cEnergyMwst > 0 && <div className="flex justify-between items-center text-slate-500 dark:text-slate-400"><span>{lang === 'de' ? 'MwSt (Energie)' : 'MwSt (Energy)'}</span><span>{formatCurrency(cEnergyMwst)}</span></div>}
                   </div>
                   
                   <div className={cn("pt-3 border-t", dk ? "border-white/10" : "border-slate-200")}>
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-black uppercase text-slate-500">Brutto</span>
                         <span className="text-xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(calculatedFinalBrutto)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[11px] font-bold text-slate-400">
                         <span>{lang === 'de' ? 'Preis / Bett (Netto)' : 'Price / Bed (Netto)'}</span>
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
            <h3 className="text-xl font-black mb-3">{lang === 'de' ? 'Zimmer löschen?' : 'Delete Room?'}</h3><p className="text-sm mb-6 opacity-60">{lang === 'de' ? 'Das kann nicht rückgängig gemacht werden.' : 'This cannot be undone.'}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setConfirmDelete(false)} className={cn('px-5 py-2.5 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button><button onClick={async () => { await enqueue({ type: 'deleteRoomCard', payload: { id: card.id } }); onDelete(card.id); setConfirmDelete(false); }} className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">{lang === 'de' ? 'Löschen' : 'Delete'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
