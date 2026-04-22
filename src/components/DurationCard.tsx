// src/components/DurationCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, Loader2, Minus, Plus, Trash2, 
  Moon, DoorClosed, Bed, CheckCircle, AlertCircle, History, ArrowRight, X
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, calcDurationFreeBeds
} from '../lib/utils'
import { calcRoomCardTotal, extractPricingFields } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Duration, RoomCard } from '../lib/types'
import RoomCardComponent from './RoomCard'

interface Props {
  duration: Duration
  isDarkMode: boolean
  lang?: 'de' | 'en'
  isMasterPricingActive?: boolean
  onUpdate: (id: string, updated: any) => void
  onDelete: (id: string) => void
}

function addDays(iso: string, days: number): string {
  if (!iso) return ''
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const ROOM_TYPES = ['EZ', 'DZ', 'TZ', 'WG'] as const

export default function DurationCard({
  duration, isDarkMode, lang = 'de', isMasterPricingActive, onUpdate, onDelete,
}: Props) {
  const dk = isDarkMode
  const [local, setLocal]           = useState<Duration>(duration)
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirm] = useState(false)
  const [roomCards, setRoomCards]   = useState<RoomCard[]>(duration.roomCards ?? [])
  
  // New States for precise controls
  const [addingType, setAddingType] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<'1W' | '1M' | null>(null)
  const [isAddingWg, setIsAddingWg] = useState(false)
  const [wgBeds, setWgBeds]         = useState(4)
  
  const saveTimer = useRef<any>(null)

  const inDateRef = useRef<HTMLInputElement>(null)
  const outDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocal(duration)
    setRoomCards(duration.roomCards ?? [])
  }, [duration])

  const nights   = calculateNights(local.startDate, local.endDate)
  const hasDates = !!(local.startDate && local.endDate && nights > 0)

  const roomCardsTotal = roomCards.reduce(
    (s, c) => s + (parseFloat(calcRoomCardTotal(c, local.startDate, local.endDate).toString()) || 0), 0
  )
  const totalBeds = hasDates ? roomCards.reduce(
    (s, c) => s + (c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2)),
    0
  ) : 0
  
  const today = new Date().toISOString().split('T')[0];
  const freeBeds = calcDurationFreeBeds({ ...local, roomCards }, today);
  const isExpired = local.endDate && today >= local.endDate;

  function queueSave(next: Duration) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try { 
        setSaving(true); 
        const { roomCards: _discard, ...dbPayload } = next; 
        await enqueue({ type: 'updateDuration', payload: { id: local.id, ...dbPayload } }); 
        onUpdate(local.id, next); 
      }
      catch (e) { console.error(e) }
      finally { setSaving(false) }
    }, 400)
  }

  function patch(changes: Partial<Duration>) {
    const next = { ...local, ...changes } as Duration
    setLocal(next); 
    queueSave(next);
  }

  // --- SMART DATE LOGIC ---
  function handleStartDateChange(newStart: string) {
    let updates: Partial<Duration> = { startDate: newStart };
    // If a preset is locked, slide the checkout date automatically
    if (activePreset === '1W') updates.endDate = addDays(newStart, 7);
    if (activePreset === '1M') updates.endDate = addDays(newStart, 30);
    patch(updates);
  }

  function handleEndDateChange(newEnd: string) {
    setActivePreset(null); // User manually changed it, break the preset lock
    patch({ endDate: newEnd });
  }

  function togglePreset(preset: '1W' | '1M', days: number) {
    if (!local.startDate) return
    if (activePreset === preset) {
      setActivePreset(null) // Turn off
    } else {
      setActivePreset(preset) // Turn on
      patch({ endDate: addDays(local.startDate, days) })
    }
  }

  function shiftEndDate(delta: number) {
    if (!local.endDate) return
    setActivePreset(null) // Break preset lock because we are fine-tuning
    patch({ endDate: addDays(local.endDate, delta) })
  }
  // ------------------------

  function syncRoomCardsToParent(newCards: RoomCard[]) {
    const nextLocal = { ...local, roomCards: newCards } as Duration;
    setLocal(nextLocal);
    onUpdate(local.id, nextLocal);
  }

  const typeCount: Record<string, number> = {}
  roomCards.forEach(c => { typeCount[c.roomType] = (typeCount[c.roomType] ?? 0) + 1 })

  async function handleAddRoomCard(roomType: string, customBedCount?: number) {
    if (!hasDates) return
    setAddingType(roomType)
    try {
      const bedCount = customBedCount ? customBedCount : (roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 2)
      const cardId = crypto.randomUUID();
      const payload = { id: cardId, durationId: local.id, roomType, bedCount };
      await enqueue({ type: 'createRoomCard', payload });
      const newCard: any = { ...payload, employees: [], pricingTab: 'per_bed' }; // Default to per_bed as requested previously
      const n = [...roomCards, newCard];
      setRoomCards(n);
      syncRoomCardsToParent(n);
    } catch (e) { console.error(e) }
    finally { setAddingType(null) }
  }

  async function handleRemoveLastOfType(roomType: string) {
    const cards = roomCards.filter(c => c.roomType === roomType)
    if (!cards.length) return
    const last = cards[cards.length - 1]
    try {
      await enqueue({ type: 'deleteRoomCard', payload: { id: last.id } });
      const n = roomCards.filter(c => c.id !== last.id);
      setRoomCards(n);
      syncRoomCardsToParent(n);
    } catch (e) { console.error(e) }
  }

  function handleCardUpdate(id: string, p: Partial<RoomCard>) {
    const n = roomCards.map(c => c.id === id ? { ...c, ...p } : c);
    setRoomCards(n);
    syncRoomCardsToParent(n);
  }
  function handleCardDelete(id: string) {
    const n = roomCards.filter(c => c.id !== id);
    setRoomCards(n);
    syncRoomCardsToParent(n);
  }

  function forceDMY(isoString: string | null | undefined) {
    if (!isoString) return 'dd/mm/yyyy';
    const [y, m, d] = isoString.split('-');
    return `${d}/${m}/${y}`;
  }
  function openPicker(ref: React.RefObject<HTMLInputElement>) { try { ref.current?.showPicker() } catch (e) { ref.current?.focus() } }

  return (
    <div className={cn(
      'rounded-b-2xl rounded-tr-2xl border relative -mt-[1px]',
      dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
    )}>
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 p-3">
        
        {/* DATE PICKERS */}
        <div className={cn("flex items-center rounded-lg border h-[42px] px-2 shrink-0", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
            <CalendarDays size={16} className="mr-2 opacity-50" />
            <div className="relative w-[90px] h-full cursor-pointer" onClick={() => openPicker(inDateRef)}>
                <input ref={inDateRef} type="date" value={local.startDate || ''} onChange={e => handleStartDateChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-[15px] font-bold", local.startDate ? (dk ? 'text-white' : 'text-slate-900') : 'text-slate-400')}>{forceDMY(local.startDate)}</span>
                </div>
            </div>
            <ArrowRight size={14} className="mx-2 opacity-30" />
            <div className="relative w-[90px] h-full cursor-pointer" onClick={() => openPicker(outDateRef)}>
                <input ref={outDateRef} type="date" value={local.endDate || ''} min={local.startDate || undefined} onChange={e => handleEndDateChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-[15px] font-bold", local.endDate ? (dk ? 'text-white' : 'text-slate-900') : 'text-slate-400')}>{forceDMY(local.endDate)}</span>
                </div>
            </div>
        </div>

        {/* SMART PRESETS & FINE TUNING */}
        {local.startDate && (
            <div className="flex items-center h-[42px] shrink-0">
              {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                <div key={p.label} className="flex items-center h-full">
                  <button onClick={() => togglePreset(p.label as any, p.days)} className={cn('px-3 h-full text-sm font-black border-y border-l transition-all', activePreset === p.label ? 'bg-teal-600 text-white border-teal-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5 bg-[#1E293B]' : 'border-slate-200 text-slate-600 hover:bg-slate-50 bg-white')}>{p.label}</button>
                  <div className="flex flex-col h-full border-y border-r rounded-r-lg mr-1.5 overflow-hidden" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                    <button onClick={() => shiftEndDate(1)} className={cn("flex-1 px-2.5 text-[10px] font-black border-b transition-colors", dk ? "hover:bg-white/10 text-slate-300 border-white/10" : "hover:bg-slate-100 text-slate-600 border-slate-200")}>+</button>
                    <button onClick={() => shiftEndDate(-1)} className={cn("flex-1 px-2.5 text-[10px] font-black transition-colors", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600")}>−</button>
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* ROOM ADDERS */}
        {hasDates && (
            <div className="flex items-center gap-2 h-[42px] overflow-x-auto no-scrollbar flex-nowrap">
              {ROOM_TYPES.map(rt => {
                const count = typeCount[rt] ?? 0;
                
                // Special Dynamic WG Input
                if (rt === 'WG' && isAddingWg) {
                  return (
                    <div key="wg-input" className={cn('flex items-center h-full rounded-lg border overflow-hidden shrink-0 shadow-sm', dk ? 'border-white/10 bg-[#1E293B]' : 'border-slate-300 bg-white')}>
                      <button onClick={() => setWgBeds(Math.max(1, wgBeds - 1))} className={cn("px-3 h-full font-black text-lg transition-colors border-r", dk ? "hover:bg-white/10 border-white/10" : "hover:bg-slate-100 border-slate-200")}>-</button>
                      <div className="flex items-center justify-center w-10 h-full font-black text-sm">{wgBeds}</div>
                      <button onClick={() => setWgBeds(wgBeds + 1)} className={cn("px-3 h-full font-black text-lg transition-colors border-l", dk ? "hover:bg-white/10 border-white/10" : "hover:bg-slate-100 border-slate-200")}>+</button>
                      <button onClick={() => { handleAddRoomCard('WG', wgBeds); setIsAddingWg(false); }} className="px-4 h-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition-colors border-l border-blue-700">Add WG</button>
                      <button onClick={() => setIsAddingWg(false)} className={cn("px-3 h-full text-red-500 transition-colors border-l", dk ? "hover:bg-red-900/20 border-white/10" : "hover:bg-red-50 border-slate-200")}><X size={16}/></button>
                    </div>
                  )
                }

                if (count === 0) {
                  return (
                    <button key={rt} onClick={() => rt === 'WG' ? setIsAddingWg(true) : handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-4 h-full rounded-lg text-sm font-black border transition-all flex items-center gap-1.5 shrink-0', dk ? 'border-white/10 text-slate-300 bg-[#1E293B] hover:bg-white/5' : 'border-slate-300 text-slate-700 bg-white shadow-sm hover:bg-slate-50')}>
                      <Plus size={16} strokeWidth={3} /> {rt}
                    </button>
                  );
                }
                
                return (
                  <div key={rt} className="flex items-center h-full shadow-sm rounded-lg overflow-hidden border shrink-0" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#cbd5e1' }}>
                    <button onClick={() => handleRemoveLastOfType(rt)} className={cn('px-3 h-full border-r transition-all', dk ? 'text-slate-300 hover:bg-red-900/20 hover:text-red-400' : 'text-slate-600 hover:bg-red-50 hover:text-red-600')}><Minus size={16} strokeWidth={3} /></button>
                    <button className={cn('px-4 h-full text-sm font-black', dk ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700')}>{rt} <span className="ml-1.5 px-2 py-0.5 rounded bg-teal-500 text-white text-[11px]">{count}</span></button>
                    <button onClick={() => rt === 'WG' ? setIsAddingWg(true) : handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-3 h-full border-l transition-all', dk ? 'text-slate-300 hover:bg-teal-900/20 hover:text-teal-400' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-600')}><Plus size={16} strokeWidth={3} /></button>
                  </div>
                );
              })}
            </div>
        )}

        {/* ALIGNED FAR RIGHT: INFO CHIP & TRASH */}
        {hasDates && (
            <div className="ml-auto flex items-center gap-2">
              <div className={cn('flex items-center gap-4 px-5 h-[42px] rounded-xl border shrink-0', dk ? 'bg-[#1E293B] border-white/10' : 'bg-slate-50 border-slate-200')}>
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 text-[13px] font-black"><Moon size={14} /> {nights}</span>
                      <span className="flex items-center gap-1 text-[13px] font-black"><DoorClosed size={14} /> {roomCards.length}</span>
                  </div>
                  <div className={cn("w-px h-5", dk ? "bg-white/10" : "bg-slate-300")}></div>
                  <div className="flex items-center gap-2">
                      <span className={cn('text-[15px] font-black flex items-center gap-1.5', dk ? 'text-slate-200' : 'text-slate-800')}><Bed size={16} /> {totalBeds}</span>
                      {freeBeds > 0 ? (
                          <span className="px-2.5 py-1 rounded bg-red-600 text-white text-[11px] font-black">{freeBeds} {lang === 'de' ? 'FREI' : 'FREE'}</span>
                      ) : isExpired ? (
                          <span className="px-2.5 py-1 rounded bg-slate-600 text-white text-[11px] font-black tracking-wide">{lang === 'de' ? 'ABGELAUFEN' : 'EXPIRED'}</span>
                      ) : (
                          <span className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-black tracking-wide">{lang === 'de' ? 'VOLL' : 'FULL'}</span>
                      )}
                  </div>
                  <div className={cn("w-px h-5", dk ? "bg-white/10" : "bg-slate-300")}></div>
                  {isMasterPricingActive ? (
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Master active</span>
                  ) : (
                      <span className="text-[17px] font-black text-teal-600 dark:text-teal-400">{formatCurrency(roomCardsTotal)}</span>
                  )}
              </div>
              <button onClick={() => setConfirm(true)} className={cn("p-2.5 h-[42px] w-[42px] rounded-xl border flex items-center justify-center transition-colors shrink-0", dk ? "border-white/10 hover:border-red-500/50 text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 hover:bg-red-50")}>
                <Trash2 size={18} />
              </button>
            </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5 space-y-2">
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
            isMasterPricingActive={isMasterPricingActive} 
          />
        ))}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-6', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-4">Löschen?</h3>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirm(false)} className="px-4 py-2 font-bold opacity-50">Abbrechen</button>
              <button onClick={() => { onDelete(local.id); setConfirm(false); }} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold">Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
