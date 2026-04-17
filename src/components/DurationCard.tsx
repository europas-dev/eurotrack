// src/components/DurationCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, Copy, Loader2, Minus, Plus, Trash2, 
  Moon, DoorClosed, Bed, CheckCircle, AlertCircle, History, ArrowRight
} from 'lucide-react'
import {
  cn, calculateNights, formatCurrency, normalizeNumberInput, calcDurationFreeBeds
} from '../lib/utils'
import { calcRoomCardTotal, extractPricingFields } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Duration, RoomCard } from '../lib/types'
import RoomCardComponent from './RoomCard'

interface Props {
  duration: Duration
  isDarkMode: boolean
  lang?: 'de' | 'en'
  isMasterPricingActive?: boolean // Added explicit Master Pricing signal
  onUpdate: (id: string, updated: any) => void
  onDelete: (id: string) => void
}

function addDays(iso: string, days: number): string {
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
  const [addingType, setAddingType] = useState<string | null>(null)
  const [checkoutOffset, setCheckoutOffset] = useState<number | null>(null)
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
    (s, c) => s + calcRoomCardTotal(c, local.startDate, local.endDate), 0
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
    let updatedRoomCards = roomCards;
    
    if (changes.endDate) {
      updatedRoomCards = roomCards.map(card => ({
        ...card,
        employees: (card.employees || []).map(emp => {
          if (emp.checkOut && emp.checkOut > changes.endDate!) {
            enqueue({ type: 'updateEmployee', payload: { id: emp.id, checkOut: changes.endDate } }).catch(console.error);
            return { ...emp, checkOut: changes.endDate };
          }
          return emp;
        })
      }));
      setRoomCards(updatedRoomCards);
    }

    const next = { ...local, roomCards: updatedRoomCards, ...changes } as Duration
    setLocal(next); 
    queueSave(next);
  }

  function applyPreset(days: number, delta = 0) {
    if (!local.startDate) return
    const d = days + delta
    setCheckoutOffset(d)
    patch({ endDate: addDays(local.startDate, d) })
  }

  function syncRoomCardsToParent(newCards: RoomCard[]) {
    const nextLocal = { ...local, roomCards: newCards } as Duration;
    setLocal(nextLocal);
    onUpdate(local.id, nextLocal);
  }

  const typeCount: Record<string, number> = {}
  roomCards.forEach(c => { typeCount[c.roomType] = (typeCount[c.roomType] ?? 0) + 1 })

  async function handleAddRoomCard(roomType: string) {
    if (!hasDates) return
    setAddingType(roomType)
    try {
      const bedCount = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 2
      const cardId = crypto.randomUUID();
      const payload = { id: cardId, durationId: local.id, roomType, bedCount };
      await enqueue({ type: 'createRoomCard', payload });
      const newCard: any = { ...payload, employees: [], pricingTab: 'per_room' };
      setRoomCards(prev => { const n = [...prev, newCard]; syncRoomCardsToParent(n); return n; })
    } catch (e) { console.error(e) }
    finally { setAddingType(null) }
  }

  async function handleRemoveLastOfType(roomType: string) {
    const cards = roomCards.filter(c => c.roomType === roomType)
    if (!cards.length) return
    const last = cards[cards.length - 1]
    try {
      await enqueue({ type: 'deleteRoomCard', payload: { id: last.id } });
      setRoomCards(prev => { const n = prev.filter(c => c.id !== last.id); syncRoomCardsToParent(n); return n; })
    } catch (e) { console.error(e) }
  }

  function handleCardUpdate(id: string, p: Partial<RoomCard>) {
    setRoomCards(prev => { const n = prev.map(c => c.id === id ? { ...c, ...p } : c); syncRoomCardsToParent(n); return n; })
  }
  function handleCardDelete(id: string) {
    setRoomCards(prev => { const n = prev.filter(c => c.id !== id); syncRoomCardsToParent(n); return n; })
  }
  function handleApplyToSameType(source: RoomCard) {
    const pricingFields = extractPricingFields(source)
    setRoomCards(prev => {
      const n = prev.map(c => {
        if (c.id === source.id || c.roomType !== source.roomType) return c
        enqueue({ type: 'updateRoomCard', payload: { id: c.id, ...pricingFields } }).catch(console.error);
        return { ...c, ...pricingFields }
      })
      syncRoomCardsToParent(n)
      return n
    })
  }

  function forceDMY(isoString: string | null | undefined) {
    if (!isoString) return 'dd/mm/yyyy';
    const [y, m, d] = isoString.split('-');
    return `${d}/${m}/${y}`;
  }
  function openPicker(ref: React.RefObject<HTMLInputElement>) { try { ref.current?.showPicker() } catch (e) { ref.current?.focus() } }

  return (
    <div className={cn('rounded-2xl border relative mt-2', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(true); }}
        className={cn('absolute top-3 right-3 p-2 rounded-lg transition-all border z-20 cursor-pointer hover:scale-105 active:scale-95',
          dk ? 'border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/20' : 'border-red-200 text-red-500 bg-red-50 hover:bg-red-100'
        )}>
        <Trash2 size={14} />
      </button>

      {/* THE NEW SINGLE-LINE CONTROL BAR */}
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 p-3 pr-14">
        
        {/* Merged Date Picker */}
        <div className={cn("flex items-center rounded-lg border h-[38px] px-2 transition-all", dk ? "bg-[#1E293B] border-white/10 hover:border-white/20" : "bg-white border-slate-200 hover:border-slate-300")}>
            <CalendarDays size={14} className={cn("mr-2", dk ? "text-slate-500" : "text-slate-400")} />
            <div className="relative w-[85px] h-full cursor-pointer" onClick={() => openPicker(inDateRef)}>
                <input ref={inDateRef} type="date" value={local.startDate || ''} onChange={e => patch({ startDate: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-sm font-bold", local.startDate ? (dk ? 'text-white' : 'text-slate-900') : (dk ? 'text-slate-500' : 'text-slate-400'))}>{forceDMY(local.startDate)}</span>
                </div>
            </div>
            <ArrowRight size={14} className={cn("mx-2 opacity-50", dk ? "text-slate-400" : "text-slate-500")} />
            <div className="relative w-[85px] h-full cursor-pointer" onClick={() => openPicker(outDateRef)}>
                <input ref={outDateRef} type="date" value={local.endDate || ''} min={local.startDate || undefined} onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-sm font-bold", local.endDate ? (dk ? 'text-white' : 'text-slate-900') : (dk ? 'text-slate-500' : 'text-slate-400'))}>{forceDMY(local.endDate)}</span>
                </div>
            </div>
        </div>

        {/* 1W / 1M Presets */}
        {local.startDate && (
            <div className="flex items-center h-[38px]">
              {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                <div key={p.label} className="flex items-center h-full">
                  <button onClick={() => applyPreset(p.days)} className={cn('px-2.5 h-full text-sm font-bold border-y border-l transition-all', checkoutOffset === p.days ? 'bg-teal-600 text-white border-teal-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5 bg-[#1E293B]' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white')}>{p.label}</button>
                  <div className="flex flex-col h-full border-y border-r rounded-r-lg mr-1 overflow-hidden" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                    <button onClick={() => applyPreset(p.days, 1)} className={cn('flex-1 px-1.5 text-[9px] font-black border-b transition-colors', dk ? 'border-white/10 text-slate-400 hover:bg-white/5 bg-[#1E293B]' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white')}>+</button>
                    <button onClick={() => applyPreset(p.days, -1)} className={cn('flex-1 px-1.5 text-[9px] font-black transition-colors', dk ? 'text-slate-400 hover:bg-white/5 bg-[#1E293B]' : 'text-slate-500 hover:bg-slate-50 bg-white')}>−</button>
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* Room Adders */}
        {hasDates && (
            <div className="flex items-center gap-1.5 h-[38px] ml-1">
              {ROOM_TYPES.map(rt => {
                const count = typeCount[rt] ?? 0;
                if (count === 0) {
                  return (<button key={rt} onClick={() => handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-3 h-full rounded-lg text-sm font-bold border transition-all flex items-center gap-1.5', dk ? 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white bg-[#1E293B]' : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 bg-white')}><Plus size={14} strokeWidth={3} /> {rt}</button>);
                }
                return (
                  <div key={rt} className="flex items-center h-full shadow-sm rounded-lg overflow-hidden">
                    <button onClick={() => handleRemoveLastOfType(rt)} className={cn('px-2.5 h-full text-sm font-bold border-y border-l transition-all', dk ? 'border-white/10 text-slate-400 hover:bg-red-900/20 hover:text-red-400 bg-[#1E293B]' : 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500 bg-white')}><Minus size={14} strokeWidth={3} /></button>
                    <button className={cn('px-3 h-full text-sm font-bold border-y transition-all', dk ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-teal-400 bg-teal-50 text-teal-700')}>{rt} <span className={cn('ml-1 px-1.5 rounded-md text-[11px] font-black', dk ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-800')}>{count}</span></button>
                    <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-2.5 h-full text-sm font-bold border-y border-r transition-all', dk ? 'border-white/10 text-slate-400 hover:bg-teal-900/20 hover:text-teal-400 bg-[#1E293B]' : 'border-slate-200 text-slate-500 hover:bg-teal-50 hover:text-teal-500 bg-white')}><Plus size={14} strokeWidth={3} /></button>
                  </div>
                );
              })}
            </div>
        )}

        {/* The New Fixed Info Chip */}
        {hasDates && (
            <div className={cn('ml-auto flex items-center gap-4 px-4 h-[38px] rounded-xl border text-sm font-bold shrink-0', dk ? 'bg-[#1E293B] border-white/10' : 'bg-slate-50 border-slate-200')}>
                <div className="flex items-center gap-3 opacity-60">
                    <span className="flex items-center gap-1.5 text-[11px]"><Moon size={12} /> {nights}</span>
                    {roomCards.length > 0 && <span className="flex items-center gap-1.5 text-[11px]"><DoorClosed size={12} /> {roomCards.length}</span>}
                </div>
                
                {roomCards.length > 0 && (
                    <>
                        <div className={cn("w-px h-4", dk ? "bg-white/10" : "bg-slate-300")}></div>
                        <span className={cn('flex items-center gap-1.5 text-sm font-black', freeBeds > 0 ? 'text-red-500' : (dk ? 'text-slate-300' : 'text-slate-700'))}>
                            <Bed size={14} /> {totalBeds} 
                            {freeBeds > 0 && <span className="text-[10px] ml-0.5 text-red-500 uppercase tracking-wider font-black">({freeBeds} {lang === 'de' ? 'Frei' : 'Free'})</span>}
                        </span>
                        
                        <div className={cn("w-px h-4", dk ? "bg-white/10" : "bg-slate-300")}></div>
                        
                        {/* Cost Display changes if Master Pricing is ON */}
                        {isMasterPricingActive ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {lang === 'de' ? 'Gesamtrechnung' : 'Master Pricing'}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-base font-black text-teal-600 dark:text-teal-400">
                                {formatCurrency(roomCardsTotal)}
                            </span>
                        )}
                    </>
                )}
            </div>
        )}
      </div>

      {roomCards.length > 0 && (
        <div className={cn('border-t px-3 py-3', dk ? 'border-white/10' : 'border-slate-100')}>
          <div className="flex flex-col gap-2">
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
                onApplyToSameType={handleApplyToSameType} 
                isMasterPricingActive={isMasterPricingActive} // Passing the signal down!
              />
            ))}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className={cn('w-full max-w-md rounded-2xl border p-6 shadow-xl', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-3">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-base mb-6', dk ? 'text-slate-400' : 'text-slate-600')}>{lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.' : 'This duration will be permanently deleted. This cannot be undone.'}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setConfirm(false)} className={cn('px-5 py-2.5 rounded-xl border text-sm font-bold', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button><button onClick={async () => { setConfirm(false); await enqueue({ type: 'deleteDuration', payload: { id: local.id } }); onDelete(local.id); }} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-900/20">{lang === 'de' ? 'Löschen' : 'Delete'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
