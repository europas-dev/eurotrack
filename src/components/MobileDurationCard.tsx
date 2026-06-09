// src/components/MobileDurationCard.tsx

import React, { useEffect, useRef, useState, useMemo } from 'react'
import {
  CalendarDays, Loader2, Minus, Plus, Trash2, 
  Moon, DoorClosed, Bed, ArrowRight, X, Calendar
} from 'lucide-react'
import {
  cn, calculateNights, calcDurationFreeBeds
} from '../lib/utils'
import { enqueue } from '../lib/offlineSync'
import type { Duration, RoomCard } from '../lib/types'
import MobileRoomCard from './MobileRoomCard'

interface Props {
  duration: Duration
  isDarkMode: boolean
  lang?: 'de' | 'en'
  onUpdate: (id: string, updated: any) => void
  onDelete: (id: string) => void
  viewOnly?: boolean 
  employeeOptions?: string[]
}

function addDays(iso: string, days: number): string {
  if (!iso) return ''
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const ROOM_TYPES = ['EZ', 'DZ', 'TZ', 'WG'] as const

export default function MobileDurationCard({
  duration, isDarkMode, lang = 'de', onUpdate, onDelete, viewOnly, employeeOptions
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

  const nights = calculateNights(local.startDate, local.endDate);
  const hasDates = !!(local.startDate && local.endDate && nights > 0)

  const totalBeds = useMemo(() => {
    return hasDates ? roomCards.reduce(
      (s, c) => s + (c.roomType === 'EZ' ? 1 : c.roomType === 'DZ' ? 2 : c.roomType === 'TZ' ? 3 : (c.bedCount || 2)),
      0
    ) : 0
  }, [roomCards, hasDates])
  
  const today = new Date().toISOString().split('T')[0];
  const freeBeds = calcDurationFreeBeds({ ...local, roomCards }, today);
  const isPast = !!(local.endDate && today > local.endDate);

  function queueSave(next: Duration) {
    if (viewOnly) return; 
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
    if (viewOnly) return;
    let next = { ...local, ...changes } as Duration;

    if (changes.endDate && local.endDate && changes.endDate > local.endDate) {
      const oldEnd = local.endDate;
      const newEnd = changes.endDate;
      const updatedCards = (next.roomCards || []).map(card => ({
        ...card,
        employees: (card.employees || []).map(emp => {
          if (emp.checkOut === oldEnd) {
            const updatedEmp = { ...emp, checkOut: newEnd };
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
    if (local.endDate && newStart >= local.endDate) {
      updates.endDate = addDays(newStart, 1);
    }
    patch(updates);
  }

  function handleEndDateChange(newEnd: string) {
    if (viewOnly) return;
    if (newEnd === '') {
      patch({ endDate: '' });
      return;
    }
    if (local.startDate && newEnd <= local.startDate) return;
    patch({ endDate: newEnd });
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

  async function handleCardDelete(id: string) {
    if (viewOnly) return;
    try {
      await enqueue({ type: 'deleteRoomCard', payload: { id } });
      const n = roomCards.filter(c => c.id !== id);
      setRoomCards(n);
      syncRoomCardsToParent(n);
    } catch (e) { console.error("Failed to delete room card:", e); }
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
  
  function forceDMY(isoString: string | null | undefined) {
    if (!isoString) return 'TT.MM.JJJJ';
    const [y, m, d] = isoString.split('-');
    return `${d}.${m}.${y}`;
  }
  function openPicker(ref: React.RefObject<HTMLInputElement>) { 
    if (viewOnly) return; 
    try { ref.current?.showPicker() } catch (e) { ref.current?.focus() } 
  }

  return (
    <div className={cn('rounded-b-xl rounded-tr-xl border relative shadow-md transition-all mb-4', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      
      {/* 1. DATES & STATS */}
      <div className="flex flex-col gap-3 p-3 pb-2">
         
         {/* Row 1: Date Pickers */}
         <div className="flex items-center gap-2 w-full h-[46px]">
            <div className={cn("flex-1 h-full relative rounded-xl border flex items-center shadow-sm", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}>
               <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                  <span className={cn("text-[13px] font-black", !local.startDate && "opacity-50 font-normal")}>{local.startDate ? forceDMY(local.startDate) : (lang === 'de' ? 'Start...' : 'Start...')}</span>
                  <Calendar size={16} className="opacity-50" />
               </div>
               <input disabled={viewOnly} ref={inDateRef} type="date" value={local.startDate || ''} onChange={e => handleStartDateChange(e.target.value)} onClick={() => openPicker(inDateRef)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>
            
            <ArrowRight size={14} className="opacity-30 shrink-0" />
            
            <div className={cn("flex-1 h-full relative rounded-xl border flex items-center shadow-sm", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900", (!local.startDate || viewOnly) && "opacity-60")}>
               <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                  <span className={cn("text-[13px] font-black", !local.endDate && "opacity-50 font-normal")}>{local.endDate ? forceDMY(local.endDate) : (lang === 'de' ? 'Ende...' : 'End...')}</span>
                  <Calendar size={16} className="opacity-50" />
               </div>
               <input disabled={viewOnly || !local.startDate} ref={outDateRef} type="date" value={local.endDate || ''} min={local.startDate || undefined} onChange={e => handleEndDateChange(e.target.value)} onClick={() => openPicker(outDateRef)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>
         </div>

         {/* Row 2: Metrics & Status */}
         <div className="flex items-center justify-between pl-1">
            <div className="flex items-center gap-4">
               <span className={cn("flex items-center gap-1.5 text-[13px] font-black", dk ? "text-slate-300" : "text-slate-600")}><Moon size={14} className="opacity-70" /> {nights}</span>
               <span className={cn("flex items-center gap-1.5 text-[13px] font-black", dk ? "text-slate-300" : "text-slate-600")}><DoorClosed size={14} className="opacity-70" /> {roomCards.length}</span>
               <span className={cn("flex items-center gap-1.5 text-[13px] font-black", dk ? "text-slate-300" : "text-slate-600")}><Bed size={14} className="opacity-70" /> {totalBeds}</span>
            </div>
            
            <div className="flex items-center gap-2">
               {isPast ? (
                  <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">{lang === 'de' ? 'Abgelaufen' : 'Expired'}</span>
               ) : totalBeds > 0 ? (
                  freeBeds > 0 ? (
                     <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">{lang === 'de' ? 'FREI' : 'FREE'} {freeBeds}</span>
                  ) : (
                     <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{lang === 'de' ? 'VOLL' : 'FULL'}</span>
                  )
               ) : null}
               
               {!viewOnly && (
                  <button onClick={() => setConfirm(true)} className={cn("p-1.5 rounded-lg transition-colors ml-1", dk ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}>
                     <Trash2 size={16} />
                  </button>
               )}
            </div>
         </div>
      </div>

      {/* 2. ADD ROOM CONTROLS */}
      {hasDates && !viewOnly && (
         <div className="flex items-center gap-2 p-3 pt-2 border-t dark:border-white/10 border-slate-100 overflow-x-auto no-scrollbar">
            {ROOM_TYPES.map(rt => {
               const count = typeCount[rt] ?? 0;
               if (rt === 'WG' && isAddingWg) {
                  return (
                     <div key="wg-input" className={cn('flex items-center h-[36px] rounded-lg border overflow-hidden shrink-0 shadow-sm min-w-[160px]', dk ? 'border-white/10 bg-[#1E293B]' : 'border-slate-300 bg-white')}>
                       <button onClick={() => setWgBeds(Math.max(1, wgBeds - 1))} className={cn("px-3 h-full font-black text-lg transition-colors border-r", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}>-</button>
                       <div className="flex items-center justify-center flex-1 font-black text-sm">{wgBeds}</div>
                       <button onClick={() => setWgBeds(wgBeds + 1)} className={cn("px-3 h-full font-black text-lg transition-colors border-l", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}>+</button>
                       <button onClick={() => { handleAddRoomCard('WG', wgBeds); setIsAddingWg(false); }} className="px-3 h-full bg-blue-600 text-white font-black text-[11px] tracking-wider uppercase border-l border-blue-700">OK</button>
                       <button onClick={() => setIsAddingWg(false)} className={cn("px-2 h-full text-red-500 border-l transition-colors", dk ? "border-white/10 hover:bg-red-900/20" : "border-slate-200 hover:bg-red-50")}><X size={14}/></button>
                     </div>
                  )
               }
               if (count === 0) {
                  return (
                     <button key={rt} onClick={() => rt === 'WG' ? setIsAddingWg(true) : handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-4 h-[36px] rounded-lg text-[12px] font-black border transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0', dk ? 'border-white/10 text-slate-400 bg-[#1E293B] hover:bg-white/5 hover:text-white' : 'border-slate-300 text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-800')}>
                        <Plus size={14} strokeWidth={3} /> {rt}
                     </button>
                  );
               }
               return (
                  <div key={rt} className={cn("flex items-center h-[36px] shadow-sm rounded-lg overflow-hidden border shrink-0", dk ? "border-white/10 bg-[#1E293B]" : "border-slate-300 bg-white")}>
                     <button onClick={() => handleRemoveLastOfType(rt)} className={cn('px-3 h-full border-r transition-all', dk ? 'border-white/10 text-slate-400 hover:bg-red-900/20 hover:text-red-400' : 'border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600')}><Minus size={14} strokeWidth={3} /></button>
                     <div className="flex items-center justify-center px-3.5">
                        <span className={cn('text-[11px] font-bold mr-1.5', dk ? 'text-slate-400' : 'text-slate-500')}>{rt}</span>
                        <span className={cn('text-[14px] font-black', dk ? 'text-teal-400' : 'text-teal-600')}>{count}</span>
                     </div>
                     <button onClick={() => rt === 'WG' ? setIsAddingWg(true) : handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-3 h-full border-l transition-all', dk ? 'border-white/10 text-slate-400 hover:bg-teal-900/20 hover:text-teal-400' : 'border-slate-200 text-slate-400 hover:bg-teal-50 hover:text-teal-600')}><Plus size={14} strokeWidth={3} /></button>
                  </div>
               );
            })}
         </div>
      )}

      {/* 3. LIST OF MOBILE ROOM CARDS */}
      <div className={cn("flex flex-col p-2 gap-2 border-t", dk ? "border-white/10 bg-black/20" : "border-slate-100 bg-slate-50/50")}>
         {roomCards.map(card => (
            <MobileRoomCard 
               key={card.id} 
               card={card} 
               durationStart={local.startDate} 
               durationEnd={local.endDate} 
               dk={dk} 
               lang={lang} 
               allCardsOfSameType={roomCards.filter(c => c.roomType === card.roomType)} 
               onUpdate={handleCardUpdate} 
               onDelete={handleCardDelete} 
               viewOnly={viewOnly} 
               employeeOptions={employeeOptions}
            />
         ))}
         {roomCards.length === 0 && (
            <div className="text-center py-6 text-[11px] font-bold italic text-slate-400">
               {lang === 'de' ? 'Keine Zimmer zugewiesen' : 'No rooms assigned'}
            </div>
         )}
      </div>

      {/* DELETE CONFIRMATION OVERLAY */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={cn('w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-2">{lang === 'de' ? 'Zeitraum löschen?' : 'Delete Duration?'}</h3>
            <p className="text-xs font-bold text-slate-500 mb-6">{lang === 'de' ? 'Alle Zimmer und Zuweisungen werden entfernt.' : 'All rooms and assignments will be removed.'}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirm(false)} className={cn("px-5 py-2 text-xs font-bold rounded-lg border", dk ? "border-white/10 text-slate-300 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={() => { onDelete(local.id); setConfirm(false); }} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md">{lang === 'de' ? 'Löschen' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
