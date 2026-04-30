// src/components/DurationCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, Loader2, Minus, Plus, Trash2, 
  Moon, DoorClosed, Bed, ArrowRight, X
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, calcDurationFreeBeds
} from '../lib/utils'
import { calcRoomCardTotal } from '../lib/roomCardUtils'
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
  viewOnly?: boolean // ADDED: View-only flag
  employeeOptions?: string[]
}

function addDays(iso: string, days: number): string {
  if (!iso) return ''
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const ROOM_TYPES = ['EZ', 'DZ', 'TZ', 'WG'] as const

export default function DurationCard({
  duration, isDarkMode, lang = 'de', isMasterPricingActive, onUpdate, onDelete, viewOnly, employeeOptions // ADDED
}: Props) {
  const dk = isDarkMode
  const [local, setLocal]           = useState<Duration>(duration)
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirm] = useState(false)
  const [roomCards, setRoomCards]   = useState<RoomCard[]>(duration.roomCards ?? [])
  
  const [addingType, setAddingType] = useState<string | null>(null)
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
  // Teal color stays if nights are exactly 7 or 30
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
  
  // NEW LOGIC: It is EXPIRED if the end date is strictly in the past, regardless of beds.
  const isPast = !!(local.endDate && today > local.endDate);

  function queueSave(next: Duration) {
    if (viewOnly) return; // SURGICAL LOCK
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

  // --- NEW: THE AUTO-EXTEND ENGINE ---
  function patch(changes: Partial<Duration>) {
    if (viewOnly) return;
    
    let next = { ...local, ...changes } as Duration;

    // Check for Extension: If the endDate moved forward
    if (changes.endDate && local.endDate && changes.endDate > local.endDate) {
      const oldEnd = local.endDate;
      const newEnd = changes.endDate;

      // Identify employees booked for the FULL duration and extend them
      const updatedCards = (next.roomCards || []).map(card => ({
        ...card,
        employees: (card.employees || []).map(emp => {
          if (emp.checkOut === oldEnd) {
            // Extension match found!
            const updatedEmp = { ...emp, checkOut: newEnd };
            // Sync to DB immediately
            enqueue({ type: 'updateEmployee', payload: { id: emp.id, checkOut: newEnd } });
            return updatedEmp;
          }
          return emp;
        })
      }));
      next.roomCards = updatedCards;
      setRoomCards(updatedCards);
    }

    setLocal(next); 
    queueSave(next);
  }

  function handleStartDateChange(newStart: string) {
    if (viewOnly) return;
    let updates: Partial<Duration> = { startDate: newStart };
    
    // GUARD: If new Check-in >= current Check-out, push Check-out forward by 1 night
    if (local.endDate && newStart >= local.endDate) {
      updates.endDate = addDays(newStart, 1);
    }
    
    patch(updates);
  }

  function handleEndDateChange(newEnd: string) {
    if (viewOnly) return;

    // ALLOW CLEARING: If the user clicks "Clear" in the calendar, newEnd is ""
    if (newEnd === '') {
      patch({ endDate: '' });
      return;
    }

    // GUARD: Prevent Check-out from being earlier than Check-in
    if (local.startDate && newEnd <= local.startDate) return;

    patch({ endDate: newEnd });
  }

  // --- [FIX: LABEL ONLY WORKS IF END DATE IS EMPTY] ---
  function togglePreset(days: number) {
    // Only proceed if we have a start date AND the end date is currently empty
    if (!local.startDate || local.endDate || viewOnly) return;
    
    patch({ endDate: addDays(local.startDate, days) });
  }

  // --- [FIX: RELATIVE STEPPER MATH] ---
  function shiftEndDate(delta: number, unit: number) {
    if (!local.endDate || viewOnly) return;
    
    // Take the CURRENT end date and move it relative
    const shifted = addDays(local.endDate, delta * unit);
    
    if (local.startDate && shifted < local.startDate) return;
    
    patch({ endDate: shifted });
  }
 

  function syncRoomCardsToParent(newCards: RoomCard[]) {
    const nextLocal = { ...local, roomCards: newCards } as Duration;
    setLocal(nextLocal);
    onUpdate(local.id, nextLocal);
  }

  const typeCount: Record<string, number> = {}
  roomCards.forEach(c => { typeCount[c.roomType] = (typeCount[c.roomType] ?? 0) + 1 })

  async function handleAddRoomCard(roomType: string, customBedCount?: number) {
    if (!hasDates || viewOnly) return 
    setAddingType(roomType)
    try {
      const bedCount = customBedCount ? customBedCount : (roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 2)
      const cardId = crypto.randomUUID();
      const payload = { id: cardId, durationId: local.id, roomType, bedCount };
      await enqueue({ type: 'createRoomCard', payload });
      const newCard: any = { ...payload, employees: [], pricingTab: 'per_bed' }; 
      const n = [...roomCards, newCard];
      setRoomCards(n);
      syncRoomCardsToParent(n);
    } catch (e) { console.error(e) }
    finally { setAddingType(null) }
  }

  async function handleRemoveLastOfType(roomType: string) {
    if (viewOnly) return;
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
    if (viewOnly) return;
    const n = roomCards.map(c => c.id === id ? { ...c, ...p } : c);
    setRoomCards(n);
    syncRoomCardsToParent(n);
  }
  function handleCardDelete(id: string) {
    if (viewOnly) return;
    const n = roomCards.filter(c => c.id !== id);
    setRoomCards(n);
    syncRoomCardsToParent(n);
  }

  function forceDMY(isoString: string | null | undefined) {
    if (!isoString) return 'dd/mm/yyyy';
    const [y, m, d] = isoString.split('-');
    return `${d}/${m}/${y}`;
  }
  function openPicker(ref: React.RefObject<HTMLInputElement>) { 
    if (viewOnly) return; 
    try { ref.current?.showPicker() } catch (e) { ref.current?.focus() } 
  }

  return (
    <div className={cn(
      'rounded-b-2xl rounded-tr-2xl border relative -mt-[1px]',
      dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200'
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        
        {/* LEFT: DATES, PRESETS, COMPACT ROOM CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* DATE PICKERS */}
          <div className={cn("flex items-center rounded-lg border h-[42px] px-2 shrink-0 shadow-sm", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
              <CalendarDays size={16} className="mr-2 opacity-50" />
              <div className={cn("relative w-[90px] h-full", viewOnly ? "cursor-default" : "cursor-pointer")} onClick={() => openPicker(inDateRef)}>
                  <input disabled={viewOnly} ref={inDateRef} type="date" value={local.startDate || ''} onChange={e => handleStartDateChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                  <div className="absolute inset-0 flex items-center pointer-events-none">
                      <span className={cn("text-[15px] font-bold", local.startDate ? (dk ? 'text-white' : 'text-slate-900') : 'text-slate-400')}>{forceDMY(local.startDate)}</span>
                  </div>
              </div>
              {/* Arrow and Check-out Picker */}
              <ArrowRight size={14} className="mx-2 opacity-30" />
              <div 
                className={cn(
                  "relative w-[90px] h-full", 
                  (viewOnly || !local.startDate) ? "cursor-default opacity-50" : "cursor-pointer" // Visual cue that it's locked
                )} 
                onClick={() => local.startDate && openPicker(outDateRef)} // Only open if start date exists
              >
                  <input 
                    disabled={viewOnly || !local.startDate} // HARD LOCK: Cannot click or tab into it without Check-in
                    ref={outDateRef} 
                    type="date" 
                    value={local.endDate || ''} 
                    min={local.startDate || undefined} 
                    onChange={e => handleEndDateChange(e.target.value)} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <div className="absolute inset-0 flex items-center pointer-events-none">
                      <span className={cn("text-[15px] font-bold", local.endDate ? (dk ? 'text-white' : 'text-slate-900') : 'text-slate-400')}>
                        {forceDMY(local.endDate)}
                      </span>
                  </div>
              </div>

          {/* SMART PRESETS */}
          {/* SMART PRESETS WITH UNIT-SPECIFIC STEPPERS */}

          {!viewOnly && local.startDate && (
          <div className="flex items-center h-[42px] shrink-0">
            {[
              { label: '1W', days: 7 }, 
              { label: '1M', days: 30 }
            ].map(p => (
              <div key={p.label} className="flex items-center h-full">
                {/* The Label: Only clickable if endDate is empty */}
                  <button 
                    onClick={() => togglePreset(p.days)} 
                    disabled={!!local.endDate} // Visual and functional lock
                    className={cn(
                      'px-2.5 h-full text-sm font-black border-y border-l transition-all shadow-sm', 
                      local.endDate 
                        ? (dk ? 'text-slate-600 bg-white/5' : 'text-slate-300 bg-slate-50 cursor-default') 
                        : (dk ? 'border-white/10 text-slate-300 hover:bg-white/5 bg-[#1E293B]' : 'border-slate-200 text-slate-600 hover:bg-slate-50 bg-white')
                    )}
                  >
                    {p.label}
                  </button>
                
                {/* The Steppers: Relative +/- shifters */}
                <div className="flex flex-col h-full border-y border-r rounded-r-lg mr-1 overflow-hidden shadow-sm" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                  <button 
                    disabled={!local.endDate} // Guard remains active
                    onClick={() => shiftEndDate(1, p.days)} 
                    className={cn("flex-1 px-2 text-[9px] font-black border-b transition-colors", dk ? "hover:bg-white/10 text-slate-300 border-white/10" : "hover:bg-slate-100 text-slate-600 border-slate-200", !local.endDate && "opacity-30")}
                  >+</button>
                  <button 
                    disabled={!local.endDate}
                    onClick={() => shiftEndDate(-1, p.days)} 
                    className={cn("flex-1 px-2 text-[9px] font-black transition-colors", dk ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600", !local.endDate && "opacity-30")}
                  >−</button>
                </div>
              </div>
            ))}
          </div>
      )}

          {/* ULTRA-COMPACT ROOM ADDERS */}
          {hasDates && (
              <div className="flex items-center gap-1.5 h-[42px] overflow-x-auto no-scrollbar flex-nowrap ml-1">
                {ROOM_TYPES.map(rt => {
                  const count = typeCount[rt] ?? 0;
                  if (rt === 'WG' && isAddingWg && !viewOnly) {
                    return (
                      <div key="wg-input" className={cn('flex items-center h-full rounded-lg border overflow-hidden shrink-0 shadow-sm', dk ? 'border-white/10 bg-[#1E293B]' : 'border-slate-300 bg-white')}>
                        <button onClick={() => setWgBeds(Math.max(1, wgBeds - 1))} className={cn("px-3 h-full font-black text-lg transition-colors border-r", dk ? "hover:bg-white/10 border-white/10" : "hover:bg-slate-100 border-slate-200")}>-</button>
                        <div className="flex items-center justify-center w-8 h-full font-black text-sm">{wgBeds}</div>
                        <button onClick={() => setWgBeds(wgBeds + 1)} className={cn("px-3 h-full font-black text-lg transition-colors border-l", dk ? "hover:bg-white/10 border-white/10" : "hover:bg-slate-100 border-slate-200")}>+</button>
                        <button onClick={() => { handleAddRoomCard('WG', wgBeds); setIsAddingWg(false); }} className="px-3 h-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-colors border-l border-blue-700">{lang === 'de' ? '+ Hinzufügen' : '+ Add'}</button>
                        <button onClick={() => setIsAddingWg(false)} className={cn("px-2 h-full text-red-500 transition-colors border-l", dk ? "hover:bg-red-900/20 border-white/10" : "hover:bg-red-50 border-slate-200")}><X size={14}/></button>
                      </div>
                    )
                  }
                  if (count === 0) {
                    return !viewOnly ? (
                      <button key={rt} onClick={() => rt === 'WG' ? setIsAddingWg(true) : handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-3 h-full rounded-lg text-sm font-black border transition-all flex items-center gap-1 shrink-0 shadow-sm', dk ? 'border-white/10 text-slate-400 bg-[#1E293B] hover:bg-white/5 hover:text-slate-300' : 'border-slate-300 text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-700')}>
                        <Plus size={14} strokeWidth={3} /> {rt}
                      </button>
                    ) : null;
                  }
                  return (
                    <div key={rt} className="flex items-center h-full shadow-sm rounded-lg overflow-hidden border shrink-0" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#cbd5e1' }}>
                      {!viewOnly && <button onClick={() => handleRemoveLastOfType(rt)} className={cn('px-2.5 h-full border-r transition-all', dk ? 'text-slate-400 hover:bg-red-900/20 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600')}><Minus size={14} strokeWidth={3} /></button>}
                      <div className={cn("flex items-center h-full px-2.5", dk ? "bg-[#1E293B]" : "bg-white")}>
                         <span className={cn('text-[13px] font-bold mr-1.5', dk ? 'text-slate-400' : 'text-slate-500')}>{rt}</span>
                         <span className={cn('text-[15px] font-black', dk ? 'text-teal-400' : 'text-teal-600')}>{count}</span>
                      </div>
                      {!viewOnly && <button onClick={() => rt === 'WG' ? setIsAddingWg(true) : handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-2.5 h-full border-l transition-all', dk ? 'text-slate-400 hover:bg-teal-900/20 hover:text-teal-400' : 'text-slate-400 hover:bg-teal-50 hover:text-teal-600')}><Plus size={14} strokeWidth={3} /></button>}
                    </div>
                  );
                })}
              </div>
          )}
        </div>

        {/* RIGHT: CLEAN, LARGE INFO DISPLAY & TRASH */}
        {/* SURGICAL FIX: Removed hasDates guard to ensure TRASH is always visible for NEW durations */}
        <div className="flex items-center gap-4 shrink-0 ml-auto">
          {hasDates && (
            <>
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1.5 text-lg font-bold"><Moon size={18} /> {nights}</span>
                <span className="flex items-center gap-1.5 text-lg font-bold"><DoorClosed size={18} /> {roomCards.length}</span>
                <span className="flex items-center gap-1.5 text-lg font-bold"><Bed size={18} /> {totalBeds}</span>
              </div>
              <div className={cn("w-px h-6 mx-1", dk ? "bg-white/10" : "bg-slate-300")}></div>
              {isPast ? (
                  <>
                    <span className="text-slate-500 font-bold text-base tracking-wide">{lang === 'de' ? 'Abgelaufen' : 'Expired'}</span>
                    <div className={cn("w-px h-6 mx-1", dk ? "bg-white/10" : "bg-slate-300")}></div>
                  </>
              ) : totalBeds > 0 ? (
                  <>
                    {freeBeds > 0 ? (
                        <span className="text-red-500 font-black text-lg uppercase tracking-wider">{lang === 'de' ? 'FREI' : 'FREE'} <span className="ml-1">{freeBeds}</span></span>
                    ) : (
                        <span className="text-emerald-500 dark:text-emerald-400 font-black text-lg uppercase tracking-wider">{lang === 'de' ? 'VOLL' : 'FULL'}</span>
                    )}
                    <div className={cn("w-px h-6 mx-1", dk ? "bg-white/10" : "bg-slate-300")}></div>
                  </>
              ) : null}
              {isMasterPricingActive ? (
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Master active</span>
              ) : (
                  <span className="text-xl font-black text-teal-600 dark:text-teal-400">{formatCurrency(roomCardsTotal)}</span>
              )}
            </>
          )}
          
          {!viewOnly && (
            <button onClick={() => setConfirm(true)} className={cn("p-2 rounded-xl flex items-center justify-center transition-colors shrink-0", dk ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}>
              <Trash2 size={20} />
            </button>
          )}
        </div>
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
            viewOnly={viewOnly} 
            employeeOptions={employeeOptions}
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
