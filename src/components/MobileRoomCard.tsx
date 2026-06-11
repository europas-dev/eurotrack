// src/components/MobileRoomCard.tsx

import React, { useEffect, useState } from 'react'
import {
  Bed, ChevronDown, ChevronUp, Loader2, Phone,
  Minus, Plus, Trash2, CornerDownRight, Moon, Check, Calendar, X
} from 'lucide-react'
import { cn, calculateNights, getEmployeeStatus } from '../lib/utils'
import { bedsForType } from '../lib/roomCardUtils'
import { enqueue } from '../lib/offlineSync'
import type { Employee, RoomCard as RoomCardType } from '../lib/types'

function fmtDateDe(iso: string | null | undefined) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function empBorderColor(emp: Employee | null, dk: boolean): string {
  if (!emp) return dk ? 'border-white/10' : 'border-slate-200'
  const s = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '')
  if (s === 'active') return dk ? 'border-emerald-500' : 'border-emerald-500'
  if (s === 'ending-soon') return dk ? 'border-red-500' : 'border-red-500'
  if (s === 'completed') return dk ? 'border-slate-600' : 'border-slate-400'
  if (s === 'upcoming') return dk ? 'border-blue-500' : 'border-blue-500'
  return dk ? 'border-white/10' : 'border-slate-200'
}

// ✅ NEW: Get occupied date ranges for a specific slot (excluding current employee)
function getOccupiedRanges(
  slotIndex: number, 
  employees: Employee[], 
  currentEmployeeId?: string
): { checkIn: string; checkOut: string }[] {
  return employees
    .filter(e => 
      e.slotIndex === slotIndex && 
      e.id !== currentEmployeeId && 
      e.checkIn && 
      e.checkOut
    )
    .map(e => ({ checkIn: e.checkIn!, checkOut: e.checkOut! }))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

// ✅ NEW: Check if a date range overlaps with any occupied ranges
function hasOverlap(
  newCheckIn: string, 
  newCheckOut: string, 
  occupiedRanges: { checkIn: string; checkOut: string }[]
): boolean {
  return occupiedRanges.some(range => {
    // Overlap if: new starts before existing ends AND new ends after existing starts
    return newCheckIn < range.checkOut && newCheckOut > range.checkIn;
  });
}

// ✅ UPDATED: Get valid date range dynamically
function getValidDateRange(
  slotIndex: number,
  employees: Employee[],
  durationStart: string,
  durationEnd: string,
  currentEmployeeId?: string,
  gapStart?: string,
  gapEnd?: string,
  currentCheckIn?: string, // ✅ NEW: Current checkIn to find available range after this date
  isCheckOut?: boolean // ✅ NEW: Whether we're calculating range for checkout
): { minDate: string; maxDate: string } {
  // If it's a gap fill, use gap boundaries strictly
  if (gapStart && gapEnd) {
    return { minDate: gapStart, maxDate: gapEnd };
  }
  
  const occupied = getOccupiedRanges(slotIndex, employees, currentEmployeeId);
  
  // For check-out calculation with existing check-in
  if (isCheckOut && currentCheckIn) {
    let maxDate = durationEnd;
    
    // Find the next occupied range after currentCheckIn
    const nextOccupied = occupied.find(range => range.checkIn >= currentCheckIn);
    if (nextOccupied) {
      maxDate = nextOccupied.checkIn;
    }
    
    return { minDate: currentCheckIn, maxDate };
  }
  
  // For check-in calculation or new employee
  let minDate = durationStart;
  let maxDate = durationEnd;
  
  if (occupied.length === 0) {
    return { minDate: durationStart, maxDate: durationEnd };
  }
  
  // If editing existing employee, allow their current range
  if (currentEmployeeId) {
    return { minDate: durationStart, maxDate: durationEnd };
  }
  
  // For NEW employees, find the first available gap
  const sortedOccupied = [...occupied].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  
  // Check space before first occupied
  if (durationStart < sortedOccupied[0].checkIn) {
    return { minDate: durationStart, maxDate: sortedOccupied[0].checkIn };
  }
  
  // Find first gap between occupied ranges
  for (let i = 0; i < sortedOccupied.length - 1; i++) {
    const current = sortedOccupied[i];
    const next = sortedOccupied[i + 1];
    
    if (current.checkOut < next.checkIn) {
      return { minDate: current.checkOut, maxDate: next.checkIn };
    }
  }
  
  // Space after last occupied
  const last = sortedOccupied[sortedOccupied.length - 1];
  return { minDate: last.checkOut, maxDate: durationEnd };
}

// ✅ NEW: Custom Date Picker Component with Mobile-Safe Positioning
function CustomDatePicker({
  value,
  minDate,
  maxDate,
  onChange,
  disabled,
  dk,
  lang,
  label
}: {
  value: string;
  minDate: string;
  maxDate: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  dk: boolean;
  lang: string;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) return new Date(value);
    if (minDate) return new Date(minDate);
    return new Date();
  });

  // Generate calendar days
  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const isDateDisabled = (day: number | null) => {
    if (!day) return true;
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return dateStr < minDate || dateStr > maxDate;
  };

  const handleDateClick = (day: number | null) => {
    if (!day || isDateDisabled(day)) return;
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    onChange(dateStr);
    setIsOpen(false);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthNames = lang === 'de' 
    ? ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const weekDays = lang === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const days = generateCalendar();
  const selectedDay = value ? new Date(value).getDate() : null;
  const selectedMonth = value ? new Date(value).getMonth() : null;
  const selectedYear = value ? new Date(value).getFullYear() : null;

  if (disabled) {
    return (
      <div className={cn('px-3 py-2 rounded-lg text-sm outline-none border transition-all font-bold w-full h-[42px] flex items-center opacity-60', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
        <span className="text-[12px]">{fmtDateDe(value)}</span>
      </div>
    );
  }

  return (
    <>
      {/* Date Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn('px-3 py-2 rounded-lg text-sm outline-none border transition-all font-bold w-full h-[42px] flex items-center justify-between', dk ? 'bg-[#1E293B] border-white/10 text-white hover:border-teal-500' : 'bg-white border-slate-200 text-slate-900 hover:border-teal-500')}
      >
        <span className="text-[12px]">{fmtDateDe(value)}</span>
        <Calendar size={14} className="opacity-50" />
      </button>

      {/* ✅ FIXED: Full-Screen Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" 
          onClick={() => setIsOpen(false)}
        >
          {/* ✅ Calendar Card - Centered & Mobile-Safe */}
          <div 
            className={cn('rounded-xl border shadow-2xl p-4 w-full max-w-[320px] animate-in zoom-in-95', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className={cn('p-1.5 rounded-lg transition-colors', dk ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <span className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className={cn('p-1.5 rounded-lg transition-colors', dk ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}
              >
                <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className={cn('text-center text-[10px] font-black', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const disabled = isDateDisabled(day);
                const isSelected = day === selectedDay && 
                                   currentMonth.getMonth() === selectedMonth && 
                                   currentMonth.getFullYear() === selectedYear;
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    disabled={disabled}
                    className={cn(
                      'h-8 rounded-lg text-xs font-bold transition-all',
                      disabled && 'opacity-30 cursor-not-allowed',
                      !disabled && !isSelected && (dk ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700'),
                      isSelected && 'bg-teal-600 text-white shadow-md'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={cn('w-full mt-3 py-2 rounded-lg text-xs font-bold transition-colors', dk ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}
            >
              {lang === 'de' ? 'Schließen' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// --- VERTICAL MOBILE BED SLOT ---
function MobileBedSlot({
  slotIndex, employee, durationStart, durationEnd, gapStart, gapEnd,
  roomCardId, durationId, dk, lang, isSubstitute, onUpdated, viewOnly, employeeOptions,
  allSlotEmployees
}: any) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(employee?.name ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '+49 ')
  const [checkIn, setCheckIn] = useState(employee?.checkIn ?? gapStart ?? durationStart)
  const [checkOut, setCheckOut] = useState(employee?.checkOut ?? gapEnd ?? durationEnd)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // ✅ Sync gap dates when they change
  useEffect(() => {
    if (!employee && gapStart) {
      setCheckIn(gapStart);
    }
  }, [gapStart, employee]);

  useEffect(() => {
    if (!employee && gapEnd) {
      setCheckOut(gapEnd);
    }
  }, [gapEnd, employee]);

  // ✅ UPDATED: Recalculate valid ranges dynamically when checkIn or allSlotEmployees change
  const checkInRange = getValidDateRange(
    slotIndex,
    allSlotEmployees || [],
    durationStart,
    durationEnd,
    employee?.id,
    gapStart,
    gapEnd,
    undefined,
    false
  );

  const checkOutRange = getValidDateRange(
    slotIndex,
    allSlotEmployees || [],
    durationStart,
    durationEnd,
    employee?.id,
    gapStart,
    gapEnd,
    checkIn, // ✅ Pass current checkIn
    true // ✅ Indicate this is for checkout
  );

  const nights = calculateNights(checkIn, checkOut)
  const status = employee ? getEmployeeStatus(employee.checkIn ?? '', employee.checkOut ?? '') : null
  const borderCls = empBorderColor(employee, dk)
  const isPartial = employee && (employee.checkIn > durationStart || employee.checkOut < durationEnd);

  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all font-bold w-full h-[42px]',
    dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-teal-500 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500 placeholder-slate-400'
  )

  async function save() {
    if (viewOnly) return; 
    if (!name.trim()) return;

    // ✅ Validate no overlap before saving
    const occupied = getOccupiedRanges(slotIndex, allSlotEmployees || [], employee?.id);
    if (checkIn && checkOut && hasOverlap(checkIn, checkOut, occupied)) {
      alert(lang === 'de' 
        ? 'Dieser Zeitraum überschneidet sich mit einem anderen Mitarbeiter in diesem Bett!' 
        : 'This period overlaps with another employee in this bed!');
      return;
    }

    // ✅ Validate dates are within valid range
    if (checkIn < checkInRange.minDate || checkIn > checkInRange.maxDate) {
      alert(lang === 'de'
        ? `Check-in muss zwischen ${fmtDateDe(checkInRange.minDate)} und ${fmtDateDe(checkInRange.maxDate)} liegen!`
        : `Check-in must be between ${fmtDateDe(checkInRange.minDate)} and ${fmtDateDe(checkInRange.maxDate)}!`);
      return;
    }

    if (checkOut < checkOutRange.minDate || checkOut > checkOutRange.maxDate) {
      alert(lang === 'de'
        ? `Check-out muss zwischen ${fmtDateDe(checkOutRange.minDate)} und ${fmtDateDe(checkOutRange.maxDate)} liegen!`
        : `Check-out must be between ${fmtDateDe(checkOutRange.minDate)} and ${fmtDateDe(checkOutRange.maxDate)}!`);
      return;
    }

    setSaving(true)
    const cleanPhone = phone.trim() === '+49' ? '' : phone.trim();
    const finalIn = checkIn === '' ? null : checkIn;
    const finalOut = checkOut === '' ? null : checkOut;

    try {
      if (employee?.id) {
        const payload = { id: employee.id, name: name.trim(), phone: cleanPhone, checkIn: finalIn, checkOut: finalOut };
        await enqueue({ type: 'updateEmployee', payload });
        onUpdated(slotIndex, { ...employee, ...payload });
      } else {
        const isGapFill = !!(gapStart || gapEnd)
        const newId = crypto.randomUUID();
        const payload = { id: newId, durationId, roomCardId, slotIndex, name: name.trim(), phone: cleanPhone, checkIn: finalIn, checkOut: finalOut };
        await enqueue({ type: 'createEmployee', payload });
        onUpdated(slotIndex, payload as any, isGapFill);
      }
      setEditing(false)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function remove() {
    if (viewOnly) return; 
    if (!employee?.id) { onUpdated(slotIndex, null); return }
    setSaving(true)
    try {
      await enqueue({ type: 'deleteEmployee', payload: { id: employee.id } });
      onUpdated(slotIndex, null, false, employee.id)
      setName(''); setPhone('+49 '); setEditing(false)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const IconToUse = isSubstitute ? CornerDownRight : Bed;

  if (confirmDel) {
    return (
      <div className={cn('flex flex-col gap-3 p-4 rounded-xl border shadow-sm h-full justify-center', dk ? 'bg-red-950/20 border-red-500/30' : 'bg-red-50 border-red-200')}>
        <span className={cn('text-sm font-black text-center', dk ? 'text-red-400' : 'text-red-700')}>{lang === 'de' ? 'Mitarbeiter löschen?' : 'Delete Employee?'}</span>
        <div className="flex gap-2 w-full">
          <button onClick={() => setConfirmDel(false)} className={cn('flex-1 py-2 rounded-lg text-sm font-bold border', dk ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700')}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
          <button onClick={remove} disabled={saving || viewOnly} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold shadow-sm">{lang === 'de' ? 'Ja, Löschen' : 'Yes, Delete'}</button>
        </div>
      </div>
    )
  }

  // --- EDIT MODE with Custom Date Pickers ---
  if (editing || (!employee && editing)) {
    return (
      <div className={cn('flex flex-col gap-3 p-3 rounded-xl border shadow-md', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <input disabled={viewOnly} autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'de' ? 'Name...' : 'Name...'} className={inputCls} list={`emp-list-${roomCardId}-${slotIndex}`} />
        <datalist id={`emp-list-${roomCardId}-${slotIndex}`}>
            {name.trim().length > 0 && employeeOptions?.map((opt: string) => <option key={opt} value={opt} />)}
        </datalist>
        
        <div className="relative flex items-center w-full">
          <Phone size={14} className={cn("absolute left-3 z-10", dk ? "text-slate-500" : "text-slate-400")} />
          <input disabled={viewOnly} type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49" className={cn(inputCls, 'pl-9')} />
        </div>

        {/* ✅ CUSTOM DATE PICKERS */}
        <div className="flex items-center gap-2 w-full">
          <CustomDatePicker
            value={checkIn}
            minDate={checkInRange.minDate}
            maxDate={checkInRange.maxDate}
            onChange={(date) => {
              setCheckIn(date);
              // Auto-adjust checkout if it becomes invalid
              if (checkOut < date) {
                setCheckOut(date);
              }
            }}
            disabled={viewOnly}
            dk={dk}
            lang={lang}
            label="Check-in"
          />
          
          <span className="text-slate-400 text-xs shrink-0">➔</span>
          
          <CustomDatePicker
            value={checkOut}
            minDate={checkOutRange.minDate}
            maxDate={checkOutRange.maxDate}
            onChange={setCheckOut}
            disabled={viewOnly}
            dk={dk}
            lang={lang}
            label="Check-out"
          />
        </div>

        <div className="flex gap-2 w-full pt-1">
           <button onClick={() => setEditing(false)} className={cn('flex-1 py-2.5 rounded-lg font-bold border transition-all text-sm', dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}>
              {lang === 'de' ? 'Abbrechen' : 'Cancel'}
           </button>
           <button onClick={save} disabled={saving || !name.trim()} className="flex-1 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />} {lang === 'de' ? 'Speichern' : 'Save'}
           </button>
        </div>
      </div>
    )
  }

  // --- VIEW MODE (Mobile Vertical Layout) ---
  if (!editing && employee) {
    return (
      <div id={`emp-slot-${employee.id}`} className={cn('flex flex-col gap-2 p-3 rounded-xl transition-all relative shadow-sm border-2 h-full', borderCls, isPartial ? 'border-dashed' : 'border-solid', dk ? 'bg-[#0F172A]' : 'bg-white')}>
         <div className="flex items-start justify-between w-full">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <IconToUse size={18} className={cn("shrink-0", status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400')} />
              <span onClick={() => { if(!viewOnly) setEditing(true) }} className={cn('text-[15px] font-black truncate flex-1', !viewOnly ? "cursor-pointer" : "cursor-default", dk ? 'text-white' : 'text-slate-900')}>{employee.name}</span>
            </div>
            {!viewOnly && (
              <button onClick={() => setConfirmDel(true)} className={cn('p-1.5 rounded-lg shrink-0 transition-colors', dk ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50')}><Trash2 size={16} /></button>
            )}
         </div>
         
         <div className="flex flex-col gap-1.5 pl-7 mt-auto">
            {employee.phone && employee.phone !== '+49' && employee.phone.trim() !== '' && (
              <a href={`tel:${employee.phone.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className={cn("flex items-center gap-1.5 text-[12px] font-bold w-max", dk ? "text-blue-400" : "text-blue-600")}>
                <Phone size={12} /> <span>{employee.phone}</span>
              </a>
            )}
            <div className="flex items-center justify-between w-full mt-1">
               <span className={cn('text-[12px] font-bold tabular-nums', dk ? 'text-slate-400' : 'text-slate-500')}>{fmtDateDe(employee.checkIn ?? '')} ➔ {fmtDateDe(employee.checkOut ?? '')}</span>
               <span className={cn('text-[13px] font-black shrink-0 px-2 py-0.5 rounded-md', dk ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600')}>{nights}N</span>
            </div>
         </div>
      </div>
    )
  }

  // --- EMPTY GAP SLOT ---
  const isGap = !!(gapStart || gapEnd)
  const effectiveIn = gapStart ?? checkInRange.minDate;
  const effectiveOut = gapEnd ?? checkOutRange.maxDate;
  
  return (
    <button disabled={viewOnly} onClick={() => { if(!viewOnly) setEditing(true) }} className={cn('w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-bold transition-all h-full min-h-[50px]', isGap ? (dk ? 'border-amber-500/40 text-amber-400 bg-amber-500/5' : 'border-amber-400 text-amber-600 bg-amber-50') : (dk ? 'border-white/10 text-slate-500 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-slate-700'), viewOnly && "opacity-60 cursor-default hover:bg-transparent pointer-events-none")}>
      {!viewOnly && <Plus size={16} />} {isGap ? `${lang === 'de' ? 'Lücke füllen' : 'Fill gap'} (${fmtDateDe(effectiveIn)} ➔ ${fmtDateDe(effectiveOut)})` : (lang === 'de' ? 'Bett zuweisen' : 'Assign bed')}
    </button>
  )
}

function getGapSlots(beds: number, employees: Employee[], durationStart: string, durationEnd: string): { slotIndex: number; gapStart: string; gapEnd: string }[] {
  const gaps: { slotIndex: number; gapStart: string; gapEnd: string }[] = []
  const occupied: Record<number, Employee[]> = {}
  employees.forEach(e => {
    const si = e.slotIndex ?? 0
    occupied[si] = occupied[si] ?? []
    occupied[si].push(e)
  })
  for (let i = 0; i < beds; i++) {
    const occs = (occupied[i] ?? []).sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? ''))
    if (occs.length === 0) continue
    const first = occs[0]
    if (first.checkIn && first.checkIn > durationStart) gaps.push({ slotIndex: i, gapStart: durationStart, gapEnd: first.checkIn })
    for (let j = 0; j < occs.length - 1; j++) {
      const curr = occs[j]; const next = occs[j + 1]
      if (curr.checkOut && next.checkIn && curr.checkOut < next.checkIn) gaps.push({ slotIndex: i, gapStart: curr.checkOut, gapEnd: next.checkIn })
    }
    const last = occs[occs.length - 1]
    if (last.checkOut && last.checkOut < durationEnd) gaps.push({ slotIndex: i, gapStart: last.checkOut, gapEnd: durationEnd })
  }
  return gaps
}

// --- MAIN MOBILE ROOM CARD COMPONENT ---
export default function MobileRoomCard({
  card, durationStart, durationEnd, dk, lang, allCardsOfSameType, isMasterPricingActive = false,
  onUpdate, onDelete, onApplyToSameType, viewOnly, employeeOptions
}: any) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const beds = bedsForType(card.roomType, card.bedCount)
  const nights = calculateNights(durationStart, durationEnd)
  const employees = card.employees ?? []

  // Ensure employees are clamped to duration
  useEffect(() => {
    if (viewOnly) return; 
    const currentEmps = card.employees ?? [];
    if (!currentEmps.length) return;
    
    let changed = false;
    const changedEmployees: any[] = [];
    
    const newEmp = currentEmps.map((emp: any) => {
       let inD = emp.checkIn || '';
       let outD = emp.checkOut || '';
       let modified = false;

       if (inD && outD) {
           if (outD <= durationStart || inD >= durationEnd) {
              inD = ''; outD = ''; modified = true;
           } else {
              if (inD < durationStart) { inD = durationStart; modified = true; }
              if (outD > durationEnd) { outD = durationEnd; modified = true; }
           }
       }
       
       if (modified) {
           changed = true;
           const updatedEmp = { ...emp, checkIn: inD === '' ? null : inD, checkOut: outD === '' ? null : outD };
           changedEmployees.push(updatedEmp);
           return updatedEmp;
       }
       return emp;
    });

    if (changed) {
       onUpdate(card.id, { employees: newEmp });
       changedEmployees.forEach(emp => {
         enqueue({ type: 'updateEmployee', payload: { id: emp.id, checkIn: emp.checkIn, checkOut: emp.checkOut } });
       });
    }
  }, [durationStart, durationEnd, JSON.stringify(card.employees)]);

  // --- RESTORED NAVIGATION ENGINE FOR MOBILE ---
  useEffect(() => {
    const handleOpenSlot = (e: any) => {
      const targetId = e.detail;
      const hasEmp = employees.some((emp: any) => emp.id === targetId);
      if (!hasEmp) return;

      setIsOpen(true);

      setTimeout(() => {
          const el = document.getElementById(`emp-slot-${targetId}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-teal-500', 'bg-teal-500/10');
              setTimeout(() => el.classList.remove('ring-2', 'ring-teal-500', 'bg-teal-500/10'), 2500);
          }
      }, 350);
    };

    window.addEventListener('open-emp-slot', handleOpenSlot);
    return () => window.removeEventListener('open-emp-slot', handleOpenSlot);
  }, [employees]);

  const inputCls = cn('px-2 py-1.5 rounded-lg text-sm font-bold outline-none border transition-all h-[42px] w-full', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900', viewOnly && "opacity-60 cursor-default")
  const labelCls = cn('text-[10px] font-black uppercase tracking-widest mb-1 block', dk ? 'text-slate-500' : 'text-slate-400')

  function queueSave(patch: Partial<RoomCardType>) {
    if (viewOnly) return;
    onUpdate(card.id, patch)
    setTimeout(async () => {
      try { await enqueue({ type: 'updateRoomCard', payload: { id: card.id, ...patch } }) }
      catch (e) { console.error(e) }
    }, 400)
  }

  // --- SMART EMPLOYEE PREVIEW CALCULATION ---
  const activeEmps = employees.filter(e => getEmployeeStatus(e.checkIn||'', e.checkOut||'') !== 'completed');
  const expiredEmps = employees.filter(e => getEmployeeStatus(e.checkIn||'', e.checkOut||'') === 'completed');
  activeEmps.sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
  expiredEmps.sort((a, b) => (b.checkOut || '').localeCompare(a.checkOut || ''));
  
  const allOrdered = [...activeEmps, ...expiredEmps];
  let displayEmps = allOrdered;
  let overflowCount = 0;
  
  if (allOrdered.length > 12) {
      displayEmps = activeEmps.slice(0, 12); 
      overflowCount = allOrdered.length - displayEmps.length;
  }

  return (
    <div className={cn('rounded-xl border transition-all shadow-sm flex flex-col w-full', dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>
      
      {/* 1. HEADER & COLLAPSED PREVIEW */}
      <div className={cn("flex flex-col w-full cursor-pointer", isOpen && (dk ? "border-b border-white/10 bg-black/20" : "border-b border-slate-100 bg-slate-50/50"))} onClick={() => setIsOpen(!isOpen)}>
         
         <div className="flex items-center justify-between p-3 pb-2">
            <div className="flex items-center gap-3">
               <button className={cn("p-1 rounded-md transition-all shrink-0", dk ? "text-slate-400" : "text-slate-500")}>
                  {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
               </button>
               <div className="flex items-center gap-2">
                  <span className={cn("font-black text-sm", dk ? "text-white" : "text-slate-900")}>{card.roomType}</span>
                  <span className={cn("font-bold text-sm", dk ? "text-slate-300" : "text-slate-700")}>{card.roomNo || '---'}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
               <div className={cn("flex items-center gap-2 px-2 py-1 rounded-lg border", dk ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600")}>
                  <span className="flex items-center gap-1 font-black text-xs"><Moon size={12} /> {nights}</span>
                  <div className={cn("w-px h-3", dk ? "bg-blue-500/30" : "bg-blue-300")} /> 
                  <span className="flex items-center gap-1 font-black text-xs"><Bed size={12} /> {beds}</span>
               </div>
               
               {!viewOnly && (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className={cn("p-1.5 rounded-lg transition-colors shrink-0", dk ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}>
                     <Trash2 size={16} />
                  </button>
               )}
            </div>
         </div>

         {!isOpen && displayEmps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 ml-8">
               {displayEmps.map(emp => {
                  const bColor = empBorderColor(emp, dk);
                  const isPart = emp.checkIn > durationStart || emp.checkOut < durationEnd;
                  const lastName = emp.name ? emp.name.trim().split(' ').pop() : '---';
                  
                  const slotMates = employees.filter((e:any) => e.slotIndex === emp.slotIndex).sort((a:any,b:any) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                  const isSub = slotMates.length > 1 && slotMates[0].id !== emp.id;
                  
                  const status = getEmployeeStatus(emp.checkIn ?? '', emp.checkOut ?? '');
                  const dotColor = status === 'active' ? 'bg-emerald-500' : status === 'upcoming' ? 'bg-blue-500' : status === 'ending-soon' ? 'bg-red-500' : 'bg-slate-400';
                  const textColor = status === 'active' ? 'text-emerald-500' : status === 'upcoming' ? 'text-blue-500' : status === 'ending-soon' ? 'text-red-500' : 'text-slate-400';

                  return (
                     <button key={emp.id} onClick={(e) => { 
                         e.stopPropagation(); 
                         setIsOpen(true); 
                         setTimeout(() => window.dispatchEvent(new CustomEvent('open-emp-slot', { detail: emp.id })), 50); 
                     }} className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors border shadow-sm", !viewOnly ? "hover:opacity-80" : "cursor-default", isPart ? "border-dashed" : "border-solid", bColor, dk ? "bg-[#1E293B] text-slate-200" : "bg-white text-slate-700")}>
                        {isSub ? <CornerDownRight size={11} className={textColor} /> : <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />}
                        <span className="truncate max-w-[90px]">{lastName}</span>
                     </button>
                  )
               })}
               {overflowCount > 0 && (
                  <span className="text-[10px] font-black text-teal-500 ml-1">+ {overflowCount}</span>
               )}
            </div>
         )}
      </div>

      {isOpen && (
        <div className="flex flex-col p-4 gap-6">
           
           <div className="flex items-center gap-2 w-full">
              <div className="flex flex-col w-[60px] shrink-0">
                 <label className={labelCls}>{lang === 'de' ? 'Typ' : 'Type'}</label>
                 <select disabled={viewOnly} value={card.roomType} onChange={e => { const rt = e.target.value as any; queueSave({ roomType: rt, bedCount: rt === 'EZ' ? 1 : rt === 'DZ' ? 2 : rt === 'TZ' ? 3 : card.bedCount }) }} className={cn(inputCls, "px-1 text-center")}>
                    <option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option><option value="WG">WG</option>
                 </select>
              </div>
              
              <div className="flex flex-col w-[80px] shrink-0">
                 <label className={labelCls}>{lang === 'de' ? 'Betten' : 'Beds'}</label>
                 <div className={cn("flex items-center h-[42px] rounded-lg border overflow-hidden", dk ? "border-white/10 bg-[#1E293B]" : "border-slate-200 bg-white")}>
                    {card.roomType === 'WG' && (
                        <button disabled={viewOnly} onClick={() => queueSave({ bedCount: Math.max(1, (card.bedCount || 1) - 1) })} className={cn("w-8 shrink-0 h-full font-black text-lg transition-colors border-r", dk ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100", viewOnly && "opacity-50 cursor-not-allowed text-slate-500")}>−</button>
                    )}
                    <div className={cn("flex-1 h-full flex items-center justify-center font-black text-sm", dk ? "text-white" : "text-slate-900")}>{card.bedCount || 1}</div>
                    {card.roomType === 'WG' && (
                        <button disabled={viewOnly} onClick={() => queueSave({ bedCount: (card.bedCount || 1) + 1 })} className={cn("w-8 shrink-0 h-full font-black text-lg transition-colors border-l", dk ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100", viewOnly && "opacity-50 cursor-not-allowed text-slate-500")}>+</button>
                    )}
                 </div>
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                 <label className={labelCls}>{lang === 'de' ? 'Zimmer Nr.' : 'Room No.'}</label>
                 <input disabled={viewOnly} type="text" value={card.roomNo || ''} onChange={e => queueSave({ roomNo: e.target.value })} placeholder="..." className={inputCls} />
              </div>
              <div className="flex flex-col w-[50px] shrink-0">
                 <label className={labelCls}>{lang === 'de' ? 'Etage' : 'Floor'}</label>
                 <input disabled={viewOnly} type="text" value={card.floor || ''} onChange={e => queueSave({ floor: e.target.value })} placeholder="..." className={cn(inputCls, "px-1 text-center")} />
              </div>
           </div>

           <div className="flex flex-col gap-3 pt-4 border-t dark:border-white/10 border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {Array.from({ length: beds }).map((_, i) => {
                    const slotE = employees.filter(e => (e.slotIndex ?? 0) === i).sort((a,b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                    const allSlotEmployees = employees.filter(e => (e.slotIndex ?? 0) === i);
                    
                    return (
                      <div key={i} className="flex flex-col gap-2 relative">
                         <div className="flex items-center gap-2 mb-1">
                            <Bed size={14} className={dk ? "text-slate-500" : "text-slate-400"}/>
                            <span className={cn("text-[10px] font-black uppercase", dk ? "text-slate-500" : "text-slate-400")}>Bed {i + 1}</span>
                         </div>
                         
                         {slotE.length === 0 ? (
                           <MobileBedSlot 
                             viewOnly={viewOnly} 
                             employeeOptions={employeeOptions} 
                             slotIndex={i} 
                             employee={null} 
                             durationStart={durationStart} 
                             durationEnd={durationEnd} 
                             roomCardId={card.id} 
                             durationId={card.durationId} 
                             dk={dk} 
                             lang={lang} 
                             allSlotEmployees={allSlotEmployees}
                             onUpdated={(idx:any, emp:any) => { 
                               const next = emp === null ? employees.filter(e => e.slotIndex !== idx) : employees.some(e => e.id === emp.id) ? employees.map(e => e.id === emp.id ? emp : e) : [...employees, emp]; 
                               onUpdate(card.id, { employees: next }); 
                             }} 
                           />
                         ) : (
                           slotE.map((emp, empIdx) => (
                             <MobileBedSlot 
                               viewOnly={viewOnly} 
                               employeeOptions={employeeOptions} 
                               key={emp.id} 
                               slotIndex={i} 
                               employee={emp} 
                               durationStart={durationStart} 
                               durationEnd={durationEnd} 
                               roomCardId={card.id} 
                               durationId={card.durationId} 
                               dk={dk} 
                               lang={lang} 
                               isSubstitute={empIdx > 0} 
                               allSlotEmployees={allSlotEmployees}
                               onUpdated={(idx:any, e:any) => { 
                                 const next = e === null ? employees.filter(empItem => empItem.id !== emp.id) : employees.map(empItem => empItem.id === e.id ? e : empItem); 
                                 onUpdate(card.id, { employees: next }); 
                               }} 
                             />
                           ))
                         )}
                         {getGapSlots(beds, employees, durationStart, durationEnd).filter(g => g.slotIndex === i).map((gap, gi) => (
                           <MobileBedSlot 
                             viewOnly={viewOnly} 
                             employeeOptions={employeeOptions} 
                             key={`gap-${i}-${gi}`} 
                             slotIndex={i} 
                             employee={null} 
                             durationStart={durationStart} 
                             durationEnd={durationEnd} 
                             gapStart={gap.gapStart} 
                             gapEnd={gap.gapEnd} 
                             roomCardId={card.id} 
                             durationId={card.durationId} 
                             dk={dk} 
                             lang={lang} 
                             allSlotEmployees={allSlotEmployees}
                             onUpdated={(idx:any, emp:any) => { 
                               const next = emp === null ? employees : [...employees, emp]; 
                               onUpdate(card.id, { employees: next }); 
                             }} 
                           />
                         ))}
                      </div>
                    )
                 })}
              </div>
           </div>

        </div>
      )}
      
      {confirmDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={cn('w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>
            <h3 className="text-xl font-black mb-2">{lang === 'de' ? 'Zimmer löschen?' : 'Delete Room?'}</h3>
            <p className="text-xs font-bold text-slate-500 mb-6">{lang === 'de' ? 'Alle Mitarbeiter in diesem Zimmer werden entfernt.' : 'All employees in this room will be removed.'}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className={cn("px-5 py-2.5 text-xs font-bold rounded-lg border", dk ? "border-white/10 text-slate-300 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100")}>{lang === 'de' ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={() => { onDelete(card.id); setConfirmDelete(false); }} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md">{lang === 'de' ? 'Löschen' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
