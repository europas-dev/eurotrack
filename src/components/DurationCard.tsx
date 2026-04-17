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
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 p-3 pr-14">
        
        {/* DATE PICKERS */}
        <div className={cn("flex items-center rounded-lg border h-[42px] px-2", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
            <CalendarDays size={16} className="mr-2 opacity-50" />
            <div className="relative w-[90px] h-full cursor-pointer" onClick={() => openPicker(inDateRef)}>
                <input ref={inDateRef} type="date" value={local.startDate || ''} onChange={e => patch({ startDate: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-sm font-bold", local.startDate ? (dk ? 'text-white' : 'text-slate-900') : 'text-slate-400')}>{forceDMY(local.startDate)}</span>
                </div>
            </div>
            <ArrowRight size={14} className="mx-2 opacity-30" />
            <div className="relative w-[90px] h-full cursor-pointer" onClick={() => openPicker(outDateRef)}>
                <input ref={outDateRef} type="date" value={local.endDate || ''} min={local.startDate || undefined} onChange={e => { setCheckoutOffset(null); patch({ endDate: e.target.value }) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className={cn("text-sm font-bold", local.endDate ? (dk ? 'text-white' : 'text-slate-900') : 'text-slate-400')}>{forceDMY(local.endDate)}</span>
                </div>
            </div>
        </div>

        {/* PRESETS */}
        {local.startDate && (
            <div className="flex items-center h-[42px]">
              {[{ label: '1W', days: 7 }, { label: '1M', days: 30 }].map(p => (
                <div key={p.label} className="flex items-center h-full">
                  <button onClick={() => applyPreset(p.days)} className={cn('px-2.5 h-full text-xs font-black border-y border-l transition-all', checkoutOffset === p.days ? 'bg-teal-600 text-white border-teal-600' : dk ? 'border-white/10 text-slate-400 bg-[#1E293B]' : 'border-slate-200 text-slate-500 bg-white')}>{p.label}</button>
                  <div className="flex flex-col h-full border-y border-r rounded-r-lg mr-1 overflow-hidden" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                    <button onClick={() => applyPreset(p.days, 1)} className="flex-1 px-1.5 text-[8px] font-black border-b hover:bg-black/10">+</button>
                    <button onClick={() => applyPreset(p.days, -1)} className="flex-1 px-1.5 text-[8px] font-black hover:bg-black/10">−</button>
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* ROOM ADDERS */}
        {hasDates && (
            <div className="flex items-center gap-1.5 h-[42px]">
              {ROOM_TYPES.map(rt => {
                const count = typeCount[rt] ?? 0;
                if (count === 0) {
                  return (<button key={rt} onClick={() => handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-3 h-full rounded-lg text-xs font-black border transition-all flex items-center gap-1.5', dk ? 'border-white/10 text-slate-400 bg-[#1E293B]' : 'border-slate-200 text-slate-500 bg-white shadow-sm')}><Plus size={14} strokeWidth={3} /> {rt}</button>);
                }
                return (
                  <div key={rt} className="flex items-center h-full shadow-sm rounded-lg overflow-hidden border" style={{ borderColor: dk ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                    <button onClick={() => handleRemoveLastOfType(rt)} className={cn('px-2.5 h-full border-r transition-all', dk ? 'text-slate-400 hover:bg-red-900/20' : 'text-slate-500 hover:bg-red-50')}><Minus size={14} /></button>
                    <button className={cn('px-3 h-full text-xs font-black', dk ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700')}>{rt} <span className="ml-1 px-1.5 rounded bg-teal-500 text-white text-[10px]">{count}</span></button>
                    <button onClick={() => handleAddRoomCard(rt)} disabled={!!addingType} className={cn('px-2.5 h-full border-l transition-all', dk ? 'text-slate-400 hover:bg-teal-900/20' : 'text-slate-500 hover:bg-teal-50')}><Plus size={14} /></button>
                  </div>
                );
              })}
            </div>
        )}

        {/* INFO CHIP */}
        {hasDates && (
            <div className={cn('ml-auto flex items-center gap-4 px-4 h-[42px] rounded-xl border shrink-0', dk ? 'bg-[#1E293B] border-white/5' : 'bg-slate-50 border-slate-100')}>
                <div className="flex items-center gap-3 opacity-40">
                    <span className="flex items-center gap-1 text-[11px] font-bold"><Moon size={12} /> {nights}</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold"><DoorClosed size={12} /> {roomCards.length}</span>
                </div>
                <div className={cn("w-px h-4", dk ? "bg-white/10" : "bg-slate-200")}></div>
                <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-black flex items-center gap-1.5', dk ? 'text-slate-300' : 'text-slate-700')}><Bed size={14} /> {totalBeds}</span>
                    {freeBeds > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-black">{freeBeds} {lang === 'de' ? 'FREI' : 'FREE'}</span>
                    ) : isExpired ? (
                        <span className="px-2 py-0.5 rounded bg-slate-500 text-white text-[10px] font-black">{lang === 'de' ? 'ABGELAUFEN' : 'EXPIRED'}</span>
                    ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-black">{lang === 'de' ? 'VOLL' : 'FULL'}</span>
                    )}
                </div>
                <div className={cn("w-px h-4", dk ? "bg-white/10" : "bg-slate-200")}></div>
                {isMasterPricingActive ? (
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master active</span>
                ) : (
                    <span className="text-sm font-black text-teal-600 dark:text-teal-400">{formatCurrency(roomCardsTotal)}</span>
                )}
            </div>
        )}

        <button onClick={() => setConfirm(true)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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
