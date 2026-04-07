// src/components/EmployeeSlot.tsx
import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { createEmployee, updateEmployee, deleteEmployee } from '../lib/supabase';
import { User, X, Loader2 } from 'lucide-react';

interface EmployeeSlotProps {
  slotIndex: number;
  durationId: string;
  employee: any | null;
  durationStart: string;
  durationEnd: string;
  isDarkMode: boolean;
  onUpdate: (slotIndex: number, emp: any) => void;
}

export default function EmployeeSlot({
  slotIndex,
  durationId,
  employee,
  durationStart,
  durationEnd,
  isDarkMode,
  onUpdate,
}: EmployeeSlotProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(employee?.name || '');
  const [checkIn, setCheckIn] = useState(
    employee?.checkIn || employee?.check_in || durationStart
  );
  const [checkOut, setCheckOut] = useState(
    employee?.checkOut || employee?.check_out || durationEnd
  );
  const dk = isDarkMode;

  const today = new Date().toISOString().split('T')[0];
  const empCheckIn = employee?.checkIn || employee?.check_in || '';
  const empCheckOut = employee?.checkOut || employee?.check_out || '';

  let status = '';
  if (employee) {
    if (today >= empCheckIn && today <= empCheckOut) status = 'active';
    else if (today < empCheckIn) status = 'upcoming';
    else status = 'completed';
  }

  const statusCls: Record<string, string> = {
    active: 'text-green-400 border-green-500/30 bg-green-500/10',
    upcoming: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    completed: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      setSaving(true);
      if (employee?.id) {
        await updateEmployee(employee.id, { name: name.trim(), checkIn, checkOut });
        onUpdate(slotIndex, { ...employee, name: name.trim(), checkIn, checkOut });
      } else {
        const created = await createEmployee(durationId, slotIndex, {
          name: name.trim(),
          checkIn,
          checkOut,
        });
        onUpdate(slotIndex, { id: created.id, name: name.trim(), checkIn, checkOut });
      }
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!employee?.id) {
      onUpdate(slotIndex, null);
      return;
    }
    try {
      setSaving(true);
      await deleteEmployee(employee.id);
      onUpdate(slotIndex, null);
      setName('');
      setCheckIn(durationStart);
      setCheckOut(durationEnd);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const ic = cn(
    'w-full px-2 py-1.5 rounded-lg text-xs outline-none border transition-all',
    dk
      ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
      : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  );

  // Empty slot
  if (!employee && !editing) {
    return (
      <button
        onClick={() => {
          setName('');
          setCheckIn(durationStart);
          setCheckOut(durationEnd);
          setEditing(true);
        }}
        className={cn(
          'w-full py-3 px-3 rounded-xl border-2 border-dashed text-xs font-bold flex items-center gap-2 transition-all',
          dk
            ? 'border-white/10 text-slate-600 hover:border-blue-500/40 hover:text-blue-400'
            : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
        )}
      >
        <User size={13} />
        Bed {slotIndex + 1} — Click to assign
      </button>
    );
  }

  // Edit form
  if (editing) {
    return (
      <div
        className={cn(
          'p-3 rounded-xl border space-y-2',
          dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
        )}
      >
        <input
          autoFocus
          type="text"
          placeholder="Employee name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className={ic}
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label
              className={cn(
                'text-[9px] font-bold uppercase tracking-widest block mb-1',
                dk ? 'text-slate-500' : 'text-slate-400'
              )}
            >
              Check-in
            </label>
            <input
              type="date"
              value={checkIn}
              min={durationStart}
              max={durationEnd}
              onChange={(e) => setCheckIn(e.target.value)}
              className={ic}
            />
          </div>
          <div className="flex-1">
            <label
              className={cn(
                'text-[9px] font-bold uppercase tracking-widest block mb-1',
                dk ? 'text-slate-500' : 'text-slate-400'
              )}
            >
              Check-out
            </label>
            <input
              type="date"
              value={checkOut}
              min={durationStart}
              max={durationEnd}
              onChange={(e) => setCheckOut(e.target.value)}
              className={ic}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setEditing(false)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
              dk
                ? 'border-white/10 text-slate-400 hover:bg-white/5'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg flex items-center justify-center gap-1 disabled:opacity-50 transition-all"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  // Filled slot
  return (
    <div
      onClick={() => {
        setName(employee.name);
        setCheckIn(employee.checkIn || employee.check_in || durationStart);
        setCheckOut(employee.checkOut || employee.check_out || durationEnd);
        setEditing(true);
      }}
      className={cn(
        'p-3 rounded-xl border cursor-pointer group transition-all',
        dk ? 'bg-white/5 border-white/8 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0',
              dk ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'
            )}
          >
            {employee.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className={cn('text-xs font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
              {employee.name}
            </p>
            <p className={cn('text-[9px] truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
              {empCheckIn} → {empCheckOut}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {status && (
            <span
              className={cn(
                'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border',
                statusCls[status]
              )}
            >
              {status}
            </span>
          )}
          {saving ? (
            <Loader2 size={12} className="animate-spin text-blue-400" />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 text-red-400"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
