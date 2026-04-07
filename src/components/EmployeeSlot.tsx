import React, { useState } from 'react';
import { Loader2, User, X } from 'lucide-react';
import { cn, calculateNights, getEmployeeStatus } from '../lib/utils';
import { createEmployee, updateEmployee, deleteEmployee } from '../lib/supabase';

interface EmployeeSlotProps {
  durationId: string;
  slotIndex: number;
  employee: any | null;
  durationStart: string;
  durationEnd: string;
  isDarkMode: boolean;
  onUpdated: (slotIndex: number, employee: any | null) => void;
  substituteWindow?: { from: string; to: string } | null;
}

export default function EmployeeSlot({
  durationId,
  slotIndex,
  employee,
  durationStart,
  durationEnd,
  isDarkMode,
  onUpdated,
  substituteWindow = null,
}: EmployeeSlotProps) {
  const dk = isDarkMode;
  const [editing, setEditing] = useState(!employee && !!substituteWindow);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(employee?.name || '');
  const [checkIn, setCheckIn] = useState(employee?.checkIn || substituteWindow?.from || durationStart || '');
  const [checkOut, setCheckOut] = useState(employee?.checkOut || substituteWindow?.to || durationEnd || '');

  const status = employee ? getEmployeeStatus(employee.checkIn, employee.checkOut) : '';

  const statusBorder =
    status === 'ending-soon' ? 'border-red-500' :
    status === 'completed' ? 'border-green-500' :
    status === 'upcoming' ? 'border-blue-500' :
    'border-white/30';

  const statusBadge =
    status === 'ending-soon' ? 'bg-red-500/20 text-red-300' :
    status === 'completed' ? 'bg-green-500/20 text-green-300' :
    status === 'upcoming' ? 'bg-blue-500/20 text-blue-300' :
    'bg-white/10 text-white';

  const inputCls = cn(
    'w-full px-2.5 py-2 rounded-lg text-xs outline-none border',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  );

  async function save() {
    if (!name.trim()) return;
    try {
      setSaving(true);
      if (employee?.id) {
        await updateEmployee(employee.id, {
          name: name.trim(),
          checkIn,
          checkOut,
        });
        onUpdated(slotIndex, { ...employee, name: name.trim(), checkIn, checkOut });
      } else {
        const created = await createEmployee(durationId, slotIndex, {
          name: name.trim(),
          checkIn,
          checkOut,
        });
        onUpdated(slotIndex, created);
      }
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!employee?.id) {
      onUpdated(slotIndex, null);
      setEditing(false);
      setName('');
      return;
    }

    try {
      setSaving(true);
      await deleteEmployee(employee.id);
      onUpdated(slotIndex, null);
      setEditing(false);
      setName('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className={cn(
        'p-3 rounded-xl border space-y-2',
        dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
      )}>
        <div className="flex items-center justify-between">
          <p className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
            {substituteWindow ? 'Substitute slot' : `Bed ${slotIndex + 1}`}
          </p>
          {!substituteWindow && (
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-red-400">
              <X size={12} />
            </button>
          )}
        </div>

        <input
          className={inputCls}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Employee name..."
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className={inputCls}
            value={checkIn}
            min={durationStart || undefined}
            max={durationEnd || undefined}
            onChange={e => setCheckIn(e.target.value)}
          />
          <input
            type="date"
            className={inputCls}
            value={checkOut}
            min={durationStart || undefined}
            max={durationEnd || undefined}
            onChange={e => setCheckOut(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={remove}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-bold border',
              dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            Clear
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn(
          'w-full p-3 rounded-xl border-2 border-dashed text-left transition-all',
          substituteWindow
            ? 'border-blue-500/40 text-blue-400 hover:bg-blue-500/5'
            : dk ? 'border-white/10 text-slate-500 hover:border-blue-500/40 hover:text-blue-400'
              : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
        )}
      >
        <div className="flex items-center gap-2">
          <User size={13} />
          <span className="text-xs font-bold">
            {substituteWindow
              ? `Add substitute ${substituteWindow.from} → ${substituteWindow.to}`
              : `Assign bed ${slotIndex + 1}`}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        'w-full p-3 rounded-xl border-2 text-left transition-all',
        statusBorder,
        dk ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-white hover:bg-slate-50 text-slate-900'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{employee.name}</p>
          <p className={cn('text-[11px]', dk ? 'text-slate-400' : 'text-slate-500')}>
            {employee.checkIn} → {employee.checkOut}
          </p>
          <p className={cn('text-[11px]', dk ? 'text-slate-500' : 'text-slate-400')}>
            {calculateNights(employee.checkIn, employee.checkOut)} nights
          </p>
        </div>
        <span className={cn('text-[10px] px-2 py-1 rounded-full font-bold', statusBadge)}>
          {status || 'active'}
        </span>
      </div>
    </button>
  );
}
