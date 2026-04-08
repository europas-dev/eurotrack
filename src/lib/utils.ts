// src/lib/utils.ts
import type { Duration, RoomType, EmployeeStatus, Employee } from './types';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatDateDisplay(date: string | null | undefined, lang: 'de' | 'en' = 'de'): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return lang === 'de' ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
}

export function calculateNights(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function getNightsBetween(startDate?: string, endDate?: string): string[] {
  if (!startDate || !endDate) return [];
  const nights: string[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur < end) {
    nights.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

export function getTotalBeds(roomType: RoomType, numberOfRooms: number, wgBeds?: number): number {
  const rooms = Math.max(1, numberOfRooms);
  switch (roomType) {
    case 'EZ': return rooms * 1;
    case 'DZ': return rooms * 2;
    case 'TZ': return rooms * 3;
    case 'WG': return Math.max(1, wgBeds ?? 1);
    default:   return rooms;
  }
}

export function normalizeNumberInput(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
export function getDurationTotal(d: Duration): number {
  const nights = calculateNights(d.startDate, d.endDate);
  const rooms  = Math.max(1, d.numberOfRooms || 1);
  let base = 0;

  if (d.totalPriceOverride && d.totalPriceOverride > 0) {
    base = d.totalPriceOverride;
  } else if (d.useManualPrices && d.nightlyPrices) {
    const allNights = getNightsBetween(d.startDate, d.endDate);
    const sum = allNights.reduce((acc, n) => acc + (d.nightlyPrices![n] ?? d.pricePerNightPerRoom ?? 0), 0);
    base = sum * rooms;
  } else {
    base = nights * (d.pricePerNightPerRoom || 0) * rooms;
  }

  if (d.hasDiscount && d.discountValue && d.discountValue > 0) {
    base = d.discountType === 'percentage'
      ? base * (1 - d.discountValue / 100)
      : base - d.discountValue;
  }

  return Math.max(0, base);
}

export function getImpliedNightlyPrice(d: Duration): number | null {
  if (!d.totalPriceOverride || d.totalPriceOverride <= 0) return null;
  const nights = calculateNights(d.startDate, d.endDate);
  const rooms  = Math.max(1, d.numberOfRooms || 1);
  if (nights === 0 || rooms === 0) return null;
  return d.totalPriceOverride / nights / rooms;
}

export function getBruttoFromNetto(netto: number, mwst: number): number {
  return netto * (1 + mwst / 100);
}

export function getNettoFromBrutto(brutto: number, mwst: number): number {
  return brutto / (1 + mwst / 100);
}

// ─── FREE BEDS ────────────────────────────────────────────────────────────────
export function getFreeBeds(d: Duration, onDate?: string): number {
  const totalBeds = getTotalBeds(d.roomType, d.numberOfRooms, d.wgBeds);
  const checkDate = onDate || new Date().toISOString().split('T')[0];
  if (!d.startDate || !d.endDate) return 0;
  if (checkDate < d.startDate || checkDate >= d.endDate) return 0;
  const occupied = (d.employees || []).filter(e => {
    if (!e) return false;
    const cin  = e.checkIn  || d.startDate;
    const cout = e.checkOut || d.endDate;
    return cin <= checkDate && cout > checkDate;
  }).length;
  return Math.max(0, totalBeds - occupied);
}

export function getHotelFreeBeds(hotel: { durations: Duration[] }, onDate?: string): number {
  return hotel.durations.reduce((sum, d) => sum + getFreeBeds(d, onDate), 0);
}

// ─── HOTEL AGGREGATES ─────────────────────────────────────────────────────────
export function calcHotelTotalNights(hotel: any): number {
  return (hotel.durations || []).reduce((sum: number, d: any) =>
    sum + calculateNights(d?.startDate, d?.endDate), 0);
}

export function calcHotelTotalCost(hotel: any): number {
  return (hotel.durations || []).reduce((sum: number, d: any) =>
    sum + getDurationTotal(d), 0);
}

export function calcHotelFreeBeds(hotel: any): number {
  const today = new Date().toISOString().split('T')[0];
  return (hotel.durations || []).reduce((sum: number, d: any) =>
    sum + getFreeBeds(d, today), 0);
}

// ─── EMPLOYEE STATUS ──────────────────────────────────────────────────────────
export function getEmployeeStatus(e: Employee, today?: string): EmployeeStatus {
  const now = today || new Date().toISOString().split('T')[0];
  if (!e.checkIn || !e.checkOut) return 'unknown';
  if (e.checkOut <= now) return 'completed';
  if (e.checkIn  >  now) return 'upcoming';
  const daysLeft = Math.ceil((new Date(e.checkOut).getTime() - new Date(now).getTime()) / 86400000);
  return daysLeft <= 7 ? 'ending-soon' : 'active';
}

export function getEmployeeStatusColor(status: EmployeeStatus): string {
  switch (status) {
    case 'active':      return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300';
    case 'ending-soon': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'completed':   return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'upcoming':    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:            return 'bg-slate-100 text-slate-500';
  }
}

// ─── DURATION LABELS ──────────────────────────────────────────────────────────
export function getDurationTagLabel(d: Duration): string {
  if (!d.startDate) return 'No date';
  const nights = calculateNights(d.startDate, d.endDate);
  const [, m, day] = d.startDate.split('-');
  return `${day}.${m} · ${nights}N`;
}

export function getDurationRowLabel(d: any, lang: 'de' | 'en' = 'de'): string {
  if (!d?.startDate) return lang === 'de' ? 'Kein Datum' : 'No date';
  const nights = calculateNights(d.startDate, d.endDate);
  const [, m, day] = d.startDate.split('-');
  return `${day}.${m} · ${nights}N`;
}

export function getDurationTabLabel(d: any, lang: 'de' | 'en' = 'de'): string {
  return getDurationRowLabel(d, lang);
}

// ─── GAP DETECTION ────────────────────────────────────────────────────────────
export function getDurationGapInfo(d: Duration) {
  const totalBeds = getTotalBeds(d.roomType, d.numberOfRooms, d.wgBeds);
  const gaps: Array<{ slotIndex: number; type: 'full' | 'partial'; availableFrom: string; availableTo: string }> = [];
  for (let i = 0; i < totalBeds; i++) {
    const emp = d.employees?.[i];
    if (!emp) {
      gaps.push({ slotIndex: i, type: 'full', availableFrom: d.startDate, availableTo: d.endDate });
    } else {
      if (emp.checkIn  && emp.checkIn  > d.startDate)
        gaps.push({ slotIndex: i, type: 'partial', availableFrom: d.startDate, availableTo: emp.checkIn });
      if (emp.checkOut && emp.checkOut < d.endDate)
        gaps.push({ slotIndex: i, type: 'partial', availableFrom: emp.checkOut, availableTo: d.endDate });
    }
  }
  return gaps;
}
