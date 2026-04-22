// src/components/EmployeeSlot.tsx
import React, { useState, useRef } from 'react';
import { Loader2, User, X, CornerDownRight } from 'lucide-react';
import { cn, formatDateDisplay, getEmployeeStatus } from '../lib/utils';
import { enqueue } from '../lib/offlineSync'; // FIX: Imported the sync engine

interface EmployeeSlotProps {
  roomCardId: string; // FIX: Added roomCardId so the database knows where this employee belongs
  durationId: string;
  slotIndex: number;
  employee: any | null;
  durationStart: string;
  durationEnd: string;
  isDarkMode: boolean;
  lang: 'de' | 'en';
  onUpdated: (slotIndex: number, employee: any | null) => void;
  substituteWindow?: { from: string; to: string } | null;
}

export function EmployeeSlot({
  roomCardId, durationId, slotIndex, employee, durationStart, durationEnd,
  isDarkMode: dk, lang, onUpdated, substituteWindow,
}: EmployeeSlotProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee?.name ?? '');
  const [checkIn, setCheckIn] = useState(employee?.checkIn ?? durationStart);
  const [checkOut, setCheckOut] = useState(employee?.checkOut ?? durationEnd);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const status = getEmployeeStatus(employee?.checkIn, employee?.checkOut);
  const statusColor = {
    'ending-soon': dk ? 'text-red-400' : 'text-red-600',
    'completed': dk ? 'text-green-400' : 'text-green-600',
    'upcoming': dk ? 'text-blue-400' : 'text-blue-600',
    'active': dk ? 'text-emerald-400' : 'text-emerald-600',
    'unknown': dk ? 'text-slate-400' : 'text-slate-500',
  }[status];

  const inputCls = cn(
    'px-2 py-1.5 rounded-lg text-xs outline-none border transition-all w-full',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
  );

  const isSubstitute = substituteWindow || (employee && employee.checkIn > durationStart);
  const IconToUse = isSubstitute ? CornerDownRight : User;

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (employee?.id) {
        // FIX: Using enqueue for updates
        const payload = { id: employee.id, name: name.trim(), checkIn, checkOut, phone: employee.phone || '' };
        await enqueue({ type: 'updateEmployee', payload });
        onUpdated(slotIndex, { ...employee, ...payload });
      } else {
        // FIX: Using enqueue for creation, generating a safe offline ID, and passing roomCardId
        const newId = crypto.randomUUID();
        const payload = { id: newId, durationId, roomCardId, slotIndex, name: name.trim(), checkIn, checkOut, phone: '' };
        await enqueue({ type: 'createEmployee', payload });
        onUpdated(slotIndex, payload);
      }
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!employee?.id) { onUpdated(slotIndex, null); return; }
    setSaving(true);
    try {
      // FIX: Using enqueue for deletions
      await enqueue({ type: 'deleteEmployee', payload: { id: employee.id } });
      onUpdated(slotIndex, null);
      setName(''); setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  // EMPTY STATE
  if (!editing && !employee) {
    return (
      <button
        onClick={() => { setEditing(true); setCheckIn(substituteWindow?.from ?? durationStart); setCheckOut(substituteWindow?.to ?? durationEnd); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-xs font-bold transition-all',
          dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400'
             : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500',
          substituteWindow && (dk ? 'border-amber-500/20 text-amber-500/70 hover:text-amber-400' : 'border-amber-200 text-amber-600 hover:text-amber-700')
        )}
      >
        <IconToUse size={12} className={substituteWindow ? "opacity-80" : ""} />
        {substituteWindow
          ? `${lang === 'de' ? 'Vertreter' : 'Substitute'} ${formatDateDisplay(substituteWindow.from, lang)}–${formatDateDisplay(substituteWindow.to, lang)}`
          : lang === 'de' ? 'Mitarbeiter zuweisen' : 'Assign employee'}
      </button>
    );
  }

  // FILLED STATE
  if (!editing && employee) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer group',
        dk ? 'bg-white/3 border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300',
        isSubstitute && (dk ? 'ml-4 border-l-amber-500/50 border-l-2' : 'ml-4 border-l-amber-400 border-l-2')
      )} onClick={() => { setName(employee.name ?? ''); setCheckIn(employee.checkIn ?? durationStart); setCheckOut(employee.checkOut ?? durationEnd); setEditing(true); }}>
        <IconToUse size={12} className={statusColor} />
        <span className={cn('text-xs font-bold flex-1 truncate', dk ? 'text-white' : 'text-slate-900')}>{employee.name}</span>
        <span className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
          {formatDateDisplay(employee.checkIn, lang)} – {formatDateDisplay(employee.checkOut, lang)}
        </span>
        {saving && <Loader2 size={11} className="animate-spin text-blue-400" />}
      </div>
    );
  }

  // EDITING STATE
  return (
    <div className={cn('rounded-xl border p-3 space-y-2', 
      dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200',
      isSubstitute && 'ml-4'
    )}>
      <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder={lang === 'de' ? 'Name...' : 'Name...'}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        className={inputCls} />
      <div className="flex gap-2">
        <div className="flex-1">
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>
            {lang === 'de' ? 'Check-in' : 'Check-in'}
          </p>
          <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={inputCls} />
        </div>
        <div className="flex-1">
          <p className={cn('text-[9px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>
            {lang === 'de' ? 'Check-out' : 'Check-out'}
          </p>
          <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          {lang === 'de' ? 'Speichern' : 'Save'}
        </button>
        {employee?.id && (
          <button onClick={handleDelete} className="px-3 py-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 text-xs font-bold">
            {lang === 'de' ? 'Löschen' : 'Del'}
          </button>
        )}
        <button onClick={() => setEditing(false)}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-bold', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
          ✕
        </button>
      </div>
    </div>
  );
}
