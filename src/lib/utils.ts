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
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function normalizeNumberInput(val: string): number {
  return parseFloat(val.replace(',', '.')) || 0;
}

export function getTotalBeds(roomType: RoomType, numberOfRooms: number, wgBeds?: number): number {
  if (roomType === 'WG') return wgBeds ?? 0;
  const bedsPerRoom = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : roomType === 'TZ' ? 3 : 1;
  return bedsPerRoom * numberOfRooms;
}

export function getDurationTotal(d: Duration): number {
  const nights = calculateNights(d.startDate, d.endDate);
  if (!nights) return 0;
  let base = 0;
  if (d.useManualPrices && Object.keys(d.nightlyPrices).length > 0) {
    base = Object.values(d.nightlyPrices).reduce((a, b) => a + b, 0) * (d.numberOfRooms || 1);
  } else {
    base = nights * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1);
  }
  if (d.hasDiscount) {
    if (d.discountType === 'percentage') base *= 1 - (d.discountValue || 0) / 100;
    else base -= d.discountValue || 0;
  }
  return Math.max(0, base);
}

export function calcHotelTotalCost(hotel: Hotel): number {
  return hotel.durations.reduce((s, d) => s + getDurationTotal(d), 0);
}

export function calcHotelTotalNights(hotel: Hotel): number {
  return hotel.durations.reduce((s, d) => s + calculateNights(d.startDate, d.endDate), 0);
}

export function calcHotelFreeBeds(hotel: Hotel): number {
  return hotel.durations.reduce((s, d) => {
    const total = getTotalBeds(d.roomType as RoomType, d.numberOfRooms);
    const filled = d.employees.filter(Boolean).length;
    return s + Math.max(0, total - filled);
  }, 0);
}

export function calcHotelPaidTotal(hotel: Hotel): number {
  return hotel.durations.filter(d => d.isPaid).reduce((s, d) => s + getDurationTotal(d), 0);
}

export function calcHotelUnpaidTotal(hotel: Hotel): number {
  return hotel.durations.filter(d => !d.isPaid).reduce((s, d) => s + getDurationTotal(d), 0);
}

export function getEmployeeStatus(checkIn?: string | null, checkOut?: string | null): 'active' | 'ending-soon' | 'completed' | 'upcoming' | 'unknown' {
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

export function getDurationTabLabel(d: Duration, lang: 'de' | 'en'): string {
  if (!d.startDate && !d.endDate) return lang === 'de' ? 'Neue Dauer' : 'New Duration';
  const nights = calculateNights(d.startDate, d.endDate);
  const start = formatDateDisplay(d.startDate, lang);
  return `${start} · ${nights}N`;
}

export function getDurationRowLabel(d: Duration, lang: 'de' | 'en'): string {
  return getDurationTabLabel(d, lang);
}

export function getNightsBetween(startDate: string, endDate: string, _s?: string, _e?: string): string[] {
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

export function getDurationGapInfo(d: Duration): Array<{ slotIndex: number; type: 'full'; availableFrom: string; availableTo: string }> {
  const totalBeds = getTotalBeds(d.roomType as RoomType, d.numberOfRooms);
  const gaps: Array<{ slotIndex: number; type: 'full'; availableFrom: string; availableTo: string }> = [];
  for (let i = 0; i < totalBeds; i++) {
    if (!d.employees[i]) {
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

export function isFreeBedToday(hotel: Hotel): boolean {
  const today = new Date().toISOString().split('T')[0];
  return hotel.durations.some(d => {
    if (d.startDate > today || d.endDate <= today) return false;
    const total = getTotalBeds(d.roomType as RoomType, d.numberOfRooms);
    const filled = d.employees.filter(Boolean).length;
    return filled < total;
  });
}

export function isFreeBedOnDay(hotel: Hotel, targetDate: string): boolean {
  return hotel.durations.some(d => {
    if (!d.startDate || !d.endDate) return false;
    if (d.startDate > targetDate || d.endDate <= targetDate) return false;
    const total = getTotalBeds(d.roomType as RoomType, d.numberOfRooms);
    const filled = d.employees.filter(Boolean).length;
    return filled < total;
  });
}

export function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
export function getDurationCostForMonth(hotel: any, year: number, month: number): number {
  return hotel.durations
    .filter((d: any) => {
      if (!d.startDate && !d.endDate) return false;
      const start = new Date(d.startDate);
      const end = new Date(d.endDate);
      return (
        (start.getFullYear() === year && start.getMonth() === month) ||
        (end.getFullYear() === year && end.getMonth() === month)
      );
    })
    .reduce((sum: number, d: any) => sum + getDurationTotal(d), 0);
}
