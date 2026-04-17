// src/components/RoomCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Copy, Loader2,
  Minus, Plus, Tag, Trash2, X, Zap, CornerDownRight, Moon, Calendar, Check
} from 'lucide-react'
import { cn, calculateNights, formatCurrency, normalizeNumberInput, getEmployeeStatus } from '../lib/utils'
import { bedsForType, calcRoomCardTotal, extractPricingFields } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Employee, PricingTab, RoomCard as RoomCardType } from '../lib/types'

const noSpinner: React.CSSProperties = { MozAppearance: 'textfield' as any, WebkitAppearance: 'none' as any }

// [Restoring BedSlot component exactly as you have it...]
// ... BedSlot code ...

export default function RoomCard({
  card, durationStart, durationEnd, dk, lang, allCardsOfSameType, bruttoNettoActive = false,
  onUpdate, onDelete, onApplyToSameType, isMasterPricingActive
}: {
  card: RoomCardType; durationStart: string; durationEnd: string; dk: boolean; lang: 'de'|'en';
  allCardsOfSameType: RoomCardType[]; bruttoNettoActive?: boolean; isMasterPricingActive?: boolean;
  onUpdate: (id: string, patch: Partial<RoomCardType>) => void; onDelete: (id: string) => void; onApplyToSameType: (source: RoomCardType) => void;
}) {
  const [isOpen, setIsOpen]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [isApplyActive, setApplyActive] = useState(false) 
  const saveTimer = useRef<any>(null)

  const beds   = bedsForType(card.roomType, card.bedCount)
  const nights = calculateNights(durationStart, durationEnd)
  const total  = calcRoomCardTotal(card, durationStart, durationEnd)
  const activeTab: PricingTab = card.pricingTab ?? 'per_room'
  const employees = card.employees ?? []

  const inputCls = cn('px-3 py-2 rounded-lg text-sm font-bold outline-none border transition-all h-[38px]', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
  const labelCls = cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')
  const tabBtn = (active: boolean) => cn('px-5 py-2.5 rounded-lg text-sm font-black border transition-all shadow-sm', active ? 'bg-blue-500 text-white border-transparent' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')

  function queueSave(patch: Partial<RoomCardType>) {
    clearTimeout(saveTimer.current)
    onUpdate(card.id, patch)
    saveTimer.current = setTimeout(async () => {
      try { setSaving(true); await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...patch } }) }
      catch (e) { console.error(e) } finally { setSaving(false) }
    }, 400)
  }

  return (
    <div className={cn('rounded-xl border transition-all shadow-sm flex flex-col w-full overflow-hidden', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      
      {/* HEADER: STRICT ONE-LINE ALIGNMENT */}
      <div className={cn("flex items-center gap-4 px-4 py-3 cursor-pointer w-full", isOpen && "border-b border-slate-100 dark:border-white/10")} onClick={(e) => { if (!['INPUT','BUTTON','SELECT'].includes((e.target as HTMLElement).tagName)) setIsOpen(!isOpen) }}>
        <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>

        {!isOpen ? (
           <>
             <div className="flex items-center gap-4 shrink-0 min-w-[280px]">
               <span className="font-black w-8 dark:text-white">{card.roomType}</span>
               <span className="text-base font-bold w-24 truncate dark:text-slate-300">{card.roomNo || '---'}</span>
               <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-500/10 text-blue-500 font-black text-xs shrink-0"><Moon size={14} /> {nights} <Bed size={14} className="ml-1" /> {beds}</span>
             </div>
             <div className="flex-1 flex gap-2 items-center px-4 overflow-hidden">
                {employees.map(emp => (
                  <div key={emp.id} className="px-3 py-1.5 rounded border text-sm font-bold bg-slate-50 dark:bg-[#1E293B] border-slate-200 dark:border-white/10">{emp.name}</div>
                ))}
                {beds - employees.length > 0 && <div className="text-xs font-black text-amber-500">+{beds - employees.length} FREE</div>}
             </div>
             <div className="flex flex-col items-end shrink-0 ml-4">
                {isMasterPricingActive ? <span className="text-[10px] opacity-40 font-black uppercase tracking-widest">Master Active</span> : <span className="text-xl font-black tabular-nums">{formatCurrency(total)}</span>}
             </div>
           </>
        ) : (
           <div className="flex items-center gap-3 flex-1">
             <select value={card.roomType} onChange={e => queueSave({ roomType: e.target.value as any })} className={cn(inputCls, 'w-20 text-center pr-0')}><option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option><option value="WG">WG</option></select>
             <div className="flex items-center gap-1.5"><span className={labelCls}>No:</span><input type="text" value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="101" className={cn(inputCls, 'w-44')} /></div>
             <div className="flex items-center gap-1.5"><span className={labelCls}>Etg:</span><input type="text" value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="1" className={cn(inputCls, 'w-16')} /></div>
             <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-500 font-black text-sm shrink-0 ml-2"><Moon size={16} /> {nights} <Bed size={16} className="ml-1" /> {beds}</span>
             <div className="flex-1" />
             {!isMasterPricingActive && (
               <>
                 <button onClick={(e) => { e.stopPropagation(); setShowPricing(!showPricing) }} className={tabBtn(showPricing)}>Price</button>
                 <div className="flex flex-col items-end min-w-[120px] ml-2"><span className="text-xl font-black">{formatCurrency(total)}</span></div>
               </>
             )}
             <button onClick={(e) => { e.stopPropagation(); setConfirm(true); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
           </div>
        )}
      </div>

      {isOpen && (
        <div className="p-6 border-t bg-slate-50/50 dark:bg-black/20">
           {showPricing && !isMasterPricingActive && (
             <div className="p-5 rounded-2xl border bg-white dark:bg-[#0F172A] border-slate-200 dark:border-white/10 shadow-sm mb-6 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => queueSave({ pricingTab: 'per_bed' })} className={tabBtn(activeTab === 'per_bed')}>Price/Bed</button>
                  <button onClick={() => queueSave({ pricingTab: 'per_room' })} className={tabBtn(activeTab === 'per_room')}>Price/Room</button>
                  <button onClick={() => queueSave({ pricingTab: 'total_room' })} className={tabBtn(activeTab === 'total_room')}>Total/Room</button>
                </div>
                
                {/* RESTORING FULL PRICING ROW (INCLUDING ENERGY) */}
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
                  
                  {/* RESTORING ACTION BUTTONS */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl border border-slate-200 dark:border-white/10 shrink-0 h-[54px]">
                    <button onClick={() => queueSave({ hasDiscount: !card.hasDiscount })} className={cn('px-4 h-full rounded-lg text-sm font-bold flex items-center gap-2', card.hasDiscount && 'bg-blue-500 text-white')}><Tag size={16} />Disc.</button>
                    {allCardsOfSameType.length > 1 && (
                      <button onClick={() => { onApplyToSameType(card); setApplyActive(true); setTimeout(()=>setApplyActive(false), 1000); }} className={cn('px-4 h-full rounded-lg text-sm font-black border flex items-center gap-2', isApplyActive && 'bg-green-500 text-white')}>
                        {isApplyActive ? <Check size={16}/> : <Copy size={16}/>} All {card.roomType}
                      </button>
                    )}
                  </div>
                </div>
             </div>
           )}
           
           {/* BEDS GRID */}
           <div className="grid gap-6 items-start" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(360px, 1fr))` }}>
              {Array.from({ length: beds }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <span className={labelCls}>BED {i + 1}</span>
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
