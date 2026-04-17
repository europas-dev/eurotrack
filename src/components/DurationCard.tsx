// src/components/DurationCard.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  CalendarDays, Loader2, Minus, Plus, Trash2, 
  Moon, DoorClosed, Bed, CheckCircle, AlertCircle, History, ArrowRight
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

  const labelCls = cn('text-[10px] font-bold uppercase tracking-widest text-slate-500', dk && 'text-slate-400')
  const inputCls = cn('px-3 py-1.5 rounded-lg text-sm font-bold outline-none border transition-all h-[38px]', dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')

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
    <div className={cn(
      'rounded-b-2xl rounded-tr-2xl border relative -mt-[1px]', // -mt-1px "glues" it to the tabs above
      dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200 shadow-sm'
    )}>
      
      {/* HEADER CONTROL BAR (UPSCALED & FLATTENED) */}
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-4 p-4 pr-14">
        
        {/* Date Picker Group (UPSCALED) */}
        <div className={cn("flex items-center rounded-xl border h-[46px] px-3 transition-all", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
            <CalendarDays size={18} className={cn("mr-3", dk ? "text-slate-500" : "text-slate-400")} />
            <div className="relative w-[100px] h-full cursor-pointer" onClick={() => openPicker(inDateRef)}>
                <input ref={inDateRef} type="date" value={local.startDate || ''} onChange={e => patch({ startDate: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-[15px] font-black", local.startDate ? (dk ? 'text-white' : 'text-slate-900') : (dk ? 'text-slate-500' : 'text-slate-400'))}>{forceDMY(local.startDate)}</span>
                </div>
            </div>
            <ArrowRight size={16} className={cn("mx-3 opacity-30", dk ? "text-slate-400" : "text-slate-500")} />
            <div className="relative w-[100px] h-full cursor-pointer" onClick={() => openPicker(outDateRef)}>
                <input ref={outDateRef} type="date" value={local.endDate || ''} min={local.startDate || undefined} onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-[15px] font-black", local.endDate ? (dk ? 'text-white' : 'text-slate-900') : (dk ? 'text-slate-500' : 'text-slate-400'))}>{forceDMY(local.endDate)}</span>
                </div>
            </div>
        </div>

        {/* Preset Buttons */}
        {local.startDate && (
            <div className="flex items-center h-[46px]">
              {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                <div key={p.label} className="flex items-center h-full">
                  <button onClick={() => applyPreset(p.days)} className={cn('px-3 h-full text-xs font-black border-y border-l transition-all', checkoutOffset === p.days ? 'bg-teal-600 text-white border-teal-600' : dk ? 'border-white/10 text-slate-400 bg-[#1E293B]' : 'border-slate-200 text-slate-500 bg-white')}>{p.label}</button>
                  <div className="flex flex-col h-full border-y border-r rounded-r-xl mr-1.5 overflow-hidden" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                    <button onClick={() => applyPreset(p.days, 1)} className={cn('flex-1 px-2 text-[10px] font-black border-b transition-colors', dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50')}>+</button>
                    <button onClick={() => applyPreset(p.days, -1)} className={cn('flex-1 px-2 text-[10px] font-black transition-colors', dk ? 'hover:bg-white/5' : 'hover:bg-slate-50')}>−</button>
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* Room Adders (UPSCALED) */}
        {hasDates && (
            <div className="flex items-center gap-2 h-[46px]">
              {ROOM_TYPES.map(rt => {
                const count = typeCount[rt] ?? 0;
                if (count === 0) {
                  return (<button key={rt} onClick={() => handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-4 h-full rounded-xl text-sm font-black border transition-all flex items-center gap-2', dk ? 'border-white/10 text-slate-400 hover:border-white/20 bg-[#1E293B]' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white shadow-sm')}>
                    {addingType === rt ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />} {rt}
                  </button>);
                }
                return (
                  <div key={rt} className="flex items-center h-full shadow-sm rounded-xl overflow-hidden border" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                    <button onClick={() => handleRemoveLastOfType(rt)} className={cn('px-3 h-full font-black border-r transition-all', dk ? 'text-slate-400 hover:bg-red-900/20 hover:text-red-400 bg-[#1E293B]' : 'text-slate-500 hover:bg-red-50 hover:text-red-500 bg-white')}><Minus size={16} strokeWidth={3} /></button>
                    <button className={cn('px-4 h-full text-sm font-black transition-all', dk ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700')}>{rt} <span className={cn('ml-1.5 px-2 py-0.5 rounded-lg text-[12px] font-black bg-teal-500 text-white shadow-sm')}>{count}</span></button>
                    <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-3 h-full font-black border-l transition-all', dk ? 'text-slate-400 hover:bg-teal-900/20 hover:text-teal-400 bg-[#1E293B]' : 'text-slate-500 hover:bg-teal-50 hover:text-teal-500 bg-white')}><Plus size={16} strokeWidth={3} /></button>
                  </div>
                );
              })}
            </div>
        )}

        {/* ENHANCED INFO CHIP (STATUS INTELLIGENCE) */}
        {hasDates && (
            <div className={cn('ml-auto flex items-center gap-5 px-5 h-[46px] rounded-2xl border shrink-0 shadow-inner', dk ? 'bg-[#1E293B] border-white/5' : 'bg-slate-50 border-slate-200')}>
                <div className="flex items-center gap-4 opacity-50">
                    <span className="flex items-center gap-1.5 text-xs font-bold"><Moon size={14} /> {nights}</span>
                    {roomCards.length > 0 && <span className="flex items-center gap-1.5 text-xs font-bold"><DoorClosed size={14} /> {roomCards.length}</span>}
                </div>
                
                {roomCards.length > 0 && (
                    <>
                        <div className={cn("w-px h-5", dk ? "bg-white/10" : "bg-slate-300")}></div>
                        
                        <div className="flex items-center gap-3">
                            <span className={cn('flex items-center gap-2 text-sm font-black', dk ? 'text-slate-300' : 'text-slate-700')}>
                                <Bed size={18} /> {totalBeds} 
                            </span>
                            
                            {/* DYNAMIC STATUS LOGIC RESTORED */}
                            {freeBeds > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 text-[11px] font-black uppercase tracking-wider animate-pulse">
                                    {freeBeds} {lang === 'de' ? 'FREI' : 'FREE'}
                                </span>
                            ) : isExpired ? (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                                    <History size={12} className="inline mr-1" /> {lang === 'de' ? 'ABGELAUFEN' : 'EXPIRED'}
                                </span>
                            ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[11px] font-black uppercase tracking-wider">
                                    <CheckCircle size={12} className="inline mr-1" /> {lang === 'de' ? 'VOLL' : 'FULL'}
                                </span>
                            )}
                        </div>
                        
                        <div className={cn("w-px h-5", dk ? "bg-white/10" : "bg-slate-300")}></div>
                        
                        {isMasterPricingActive ? (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-500/10 px-2 py-1 rounded-md">
                                {lang === 'de' ? 'Gesamtrechnung' : 'Master Pricing'}
                            </span>
                        ) : (
                            <span className="text-lg font-black text-teal-600 dark:text-teal-400">
                                {formatCurrency(roomCardsTotal)}
                            </span>
                        )}
                    </>
                )}
            </div>
        )}

        {/* Global Action Column (Trash & Save) */}
        <div className="flex items-center gap-2">
            {saving && <Loader2 size={18} className="animate-spin text-teal-500" />}
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(true); }}
                className={cn('p-2.5 rounded-xl transition-all border cursor-pointer hover:scale-110 active:scale-95',
                dk ? 'border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/20' : 'border-red-100 text-red-500 bg-red-50 hover:bg-red-100'
            )}>
                <Trash2 size={18} />
            </button>
        </div>
      </div>

      {/* ROOM LISTING AREA */}
      {roomCards.length > 0 && (
        <div className={cn('border-t p-4', dk ? 'border-white/5' : 'border-slate-100 bg-slate-50/30')}>
          <div className="flex flex-col gap-2.5">
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
                isMasterPricingActive={isMasterPricingActive} 
              />
            ))}
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn('w-full max-w-md rounded-3xl border p-8 shadow-2xl animate-in zoom-in-95', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-2xl font-black mb-2">{lang === 'de' ? 'Dauer löschen?' : 'Delete duration?'}</h3>
            <p className={cn('text-sm font-bold opacity-60 mb-8', dk ? 'text-slate-400' : 'text-slate-600')}>{lang === 'de' ? 'Diese Buchungsdauer wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.' : 'This duration will be permanently deleted. This cannot be undone.'}</p>
            <div className="flex justify-end gap-3"><button onClick={() => setConfirm(false)} className={cn('px-6 py-2.5 rounded-xl border font-bold transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>Abbrechen</button><button onClick={async () => { setConfirm(false); await enqueue({ type: 'deleteDuration', payload: { id: local.id } }); onDelete(local.id); }} className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg">Löschen</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
