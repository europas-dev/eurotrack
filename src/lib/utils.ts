import { Duration, Hotel, RoomType } from './types';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function calculateNights(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function formatCurrency(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function formatDateDisplay(date: string | null, lang: 'de' | 'en' = 'de'): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

export function normalizeNumberInput(val: string): number {
  return parseFloat(val.replace(',', '.')) || 0;
}

export function getTotalBeds(roomType: RoomType | string, numberOfRooms: number, wgBeds?: number): number {
  if (roomType === 'WG') return wgBeds ?? 0;
  const bedsPerRoom = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 1;
  return bedsPerRoom * (numberOfRooms || 1);
}

export function getDurationTotal(d: any): number {
  if (!d) return 0;
  const nights = calculateNights(d.startDate, d.endDate);
  if (!nights) return 0;
  const rooms = d.numberOfRooms || 1;
  let base = 0;
  if (d.useManualPrices && d.nightlyPrices && Object.keys(d.nightlyPrices).length > 0) {
    base = Object.values(d.nightlyPrices as Record<string, number>).reduce((a, b) => a + b, 0) * rooms;
  } else {
    base = nights * (d.pricePerNightPerRoom || 0) * rooms;
  }
  if (d.hasDiscount) {
    if (d.discountType === 'percentage') base *= 1 - (d.discountValue || 0) / 100;
    else base -= d.discountValue || 0;
  }
  return Math.max(0, base);
}

export function calcHotelTotalCost(hotel: any): number {
  return (hotel.durations || []).reduce((s: number, d: any) => s + getDurationTotal(d), 0);
}

export function calcHotelTotalNights(hotel: any): number {
  return (hotel.durations || []).reduce((s: number, d: any) => s + calculateNights(d.startDate, d.endDate), 0);
}

export function calcHotelFreeBeds(hotel: any): number {
  return (hotel.durations || []).reduce((s: number, d: any) => {
    const total = getTotalBeds(d.roomType, d.numberOfRooms, d.wgBeds);
    const filled = (d.employees || []).filter(Boolean).length;
    return s + Math.max(0, total - filled);
  }, 0);
}

export function calcHotelPaidTotal(hotel: any): number {
  return (hotel.durations || []).filter((d: any) => d.isPaid).reduce((s: number, d: any) => s + getDurationTotal(d), 0);
}

export function calcHotelUnpaidTotal(hotel: any): number {
  return (hotel.durations || []).filter((d: any) => !d.isPaid).reduce((s: number, d: any) => s + getDurationTotal(d), 0);
}

export function getEmployeeStatus(
  checkIn?: string | null,
  checkOut?: string | null
): 'active' | 'ending-soon' | 'completed' | 'upcoming' | 'unknown' {
  const now = new Date();
  const ci = checkIn ? new Date(checkIn) : null;
  const co = checkOut ? new Date(checkOut) : null;
  if (!ci && !co) return 'unknown';
  if (co && co < now) return 'completed';
  if (ci && ci > now) return 'upcoming';
  if (co) {
    const daysLeft = (co.getTime() - now.getTime()) / 86400000;
    if (daysLeft <= 7) return 'ending-soon';
  }
  return 'active';
}

export function getDurationTabLabel(d: any, lang: 'de' | 'en'): string {
  if (!d.startDate && !d.endDate) return lang === 'de' ? 'Neue Dauer' : 'New Duration';
  const nights = calculateNights(d.startDate, d.endDate);
  const start = formatDateDisplay(d.startDate, lang);
  return `${start} · ${nights}N`;
}

export function getDurationRowLabel(d: any, lang: 'de' | 'en'): string {
  return getDurationTabLabel(d, lang);
}

export function getNightsBetween(startDate: string, endDate: string): string[] {
  const nights: string[] = [];
  if (!startDate || !endDate) return nights;
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur < end) {
    nights.push(cur.toISOString().split('T')[0]);
    cur = new Date(cur.getTime() + 86400000);
  }
  return nights;
}

export function getDurationGapInfo(d: any): Array<{
  slotIndex: number;
  type: 'full';
  availableFrom: string;
  availableTo: string;
}> {
  const totalBeds = getTotalBeds(d.roomType, d.numberOfRooms, d.wgBeds);
  const gaps: Array<{ slotIndex: number; type: 'full'; availableFrom: string; availableTo: string }> = [];
  for (let i = 0; i < totalBeds; i++) {
    if (!(d.employees || [])[i]) {
      gaps.push({ slotIndex: i, type: 'full', availableFrom: d.startDate, availableTo: d.endDate });
    }
  }
  return gaps;
}

export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-highlight">$1</mark>');
}

export function isFreeBedToday(hotel: any): boolean {
  const today = new Date().toISOString().split('T')[0];
  return isFreeBedOnDay(hotel, today);
}

export function isFreeBedOnDay(hotel: any, targetDate: string): boolean {
  return (hotel.durations || []).some((d: any) => {
    if (!d.startDate || !d.endDate) return false;
    if (d.startDate > targetDate || d.endDate <= targetDate) return false;
    const total = getTotalBeds(d.roomType, d.numberOfRooms, d.wgBeds);
    const filled = (d.employees || []).filter(Boolean).length;
    return filled < total;
  });
}

export function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Used by Sidebar — receives a single duration, not a hotel
export function getDurationCostForMonth(duration: any, year: number, month: number): number {
  if (!duration?.startDate && !duration?.endDate) return 0;
  const start = new Date(duration.startDate);
  const end = new Date(duration.endDate);
  const matches =
    (start.getFullYear() === year && start.getMonth() === month) ||
    (end.getFullYear() === year && end.getMonth() === month);
  if (!matches) return 0;
  return getDurationTotal(duration);
}
