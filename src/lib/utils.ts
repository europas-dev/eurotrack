// src/lib/utils.ts

export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function calculateNights(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function formatDateDisplay(input?: string, lang: 'de' | 'en' = 'de') {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateShort(input?: string, lang: 'de' | 'en' = 'de') {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const monthNamesDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = lang === 'de' ? monthNamesDe : monthNamesEn;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatDateRangeShort(startDate?: string, endDate?: string, lang: 'de' | 'en' = 'de') {
  if (!startDate || !endDate) return '';
  return `${formatDateShort(startDate, lang)} - ${formatDateShort(endDate, lang)}`;
}

export function formatCurrency(amount: number) {
  return '€' + Number(amount || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function normalizeNumberInput(value: string | number) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/^0+(?=\d)/, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function getBedsPerRoom(roomType?: string) {
  if (roomType === 'EZ') return 1;
  if (roomType === 'TZ') return 3;
  return 2;
}

export function getTotalBeds(roomType?: string, numberOfRooms?: number) {
  return getBedsPerRoom(roomType) * Math.max(1, numberOfRooms || 1);
}

export function getNightsBetween(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return [];
  const out: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    out.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return out;
}

export function getEmployeeStatus(checkIn?: string, checkOut?: string): '' | 'active' | 'ending-soon' | 'completed' | 'upcoming' {
  if (!checkIn || !checkOut) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ci = new Date(checkIn);
  const co = new Date(checkOut);

  if (today < ci) return 'upcoming';
  if (today > co) return 'completed';

  const daysLeft = Math.ceil((co.getTime() - today.getTime()) / 86400000);
  if (daysLeft <= 3) return 'ending-soon';
  return 'active';
}

export function getDurationTotal(duration: any) {
  const nights = calculateNights(duration.startDate, duration.endDate);
  const rooms = Math.max(1, duration.numberOfRooms || 1);
  const base = Number(duration.pricePerNightPerRoom || 0);
  const useManual = !!duration.useManualPrices;
  const nightlyPrices = duration.nightlyPrices || {};

  let subtotal = 0;

  if (useManual && duration.startDate && duration.endDate) {
    const nightsList = getNightsBetween(duration.startDate, duration.endDate);
    subtotal = nightsList.reduce((sum, night) => {
      return sum + Number(nightlyPrices[night] ?? base) * rooms;
    }, 0);
  } else {
    subtotal = nights * base * rooms;
  }

  let discount = 0;
  if (duration.hasDiscount) {
    if ((duration.discountType || 'percentage') === 'fixed') {
      discount = Number(duration.discountValue || 0);
    } else {
      discount = subtotal * (Number(duration.discountValue || 0) / 100);
    }
  }

  return Math.max(0, subtotal - discount);
}

export function getMonthOverlapNights(startDate?: string, endDate?: string, year?: number, month?: number) {
  if (!startDate || !endDate || year === undefined || month === undefined) return 0;

  const bookingStart = new Date(startDate);
  const bookingEnd = new Date(endDate);
  const monthStart = new Date(year, month, 1);
  const monthEndExclusive = new Date(year, month + 1, 1);

  const start = bookingStart > monthStart ? bookingStart : monthStart;
  const end = bookingEnd < monthEndExclusive ? bookingEnd : monthEndExclusive;

  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
}

export function getDurationCostForMonth(duration: any, year: number, month: number) {
  const overlapNights = getMonthOverlapNights(duration.startDate, duration.endDate, year, month);
  if (overlapNights === 0) return 0;

  const totalNights = calculateNights(duration.startDate, duration.endDate);
  const totalCost = getDurationTotal(duration);
  if (totalNights === 0) return 0;

  return (totalCost / totalNights) * overlapNights;
}

export function durationTouchesMonth(duration: any, year: number, month: number) {
  return getMonthOverlapNights(duration.startDate, duration.endDate, year, month) > 0;
}

export function getDurationTabLabel(duration: any, lang: 'de' | 'en' = 'de') {
  const rooms = Math.max(1, duration.numberOfRooms || 1);
  const roomType = duration.roomType || 'DZ';
  const nights = calculateNights(duration.startDate, duration.endDate);
  const dateRange = formatDateRangeShort(duration.startDate, duration.endDate, lang);

  if (!dateRange) return `${rooms} ${roomType} • ${nights}${lang === 'de' ? 'N' : 'N'}`;
  return `${dateRange} • ${rooms} ${roomType} • ${nights}${lang === 'de' ? 'N' : 'N'}`;
}

export function getDurationRowLabel(duration: any, lang: 'de' | 'en' = 'de') {
  const rooms = Math.max(1, duration.numberOfRooms || 1);
  const roomType = duration.roomType || 'DZ';
  const nights = calculateNights(duration.startDate, duration.endDate);
  const dateRange = formatDateRangeShort(duration.startDate, duration.endDate, lang);

  if (!dateRange) return `${rooms} ${roomType} • ${nights}${lang === 'de' ? 'N' : 'N'}`;
  return `${dateRange} • ${rooms} ${roomType} • ${nights}${lang === 'de' ? 'N' : 'N'}`;
}

export function getDurationGapInfo(duration: any) {
  const start = duration.startDate;
  const end = duration.endDate;
  const employees = duration.employees || [];
  const totalBeds = getTotalBeds(duration.roomType, duration.numberOfRooms);

  const gaps: Array<{
    slotIndex: number;
    availableFrom: string;
    availableTo: string;
    type: 'start' | 'end' | 'full';
  }> = [];

  for (let i = 0; i < totalBeds; i++) {
    const emp = employees[i];

    if (!emp) {
      if (start && end) {
        gaps.push({
          slotIndex: i,
          availableFrom: start,
          availableTo: end,
          type: 'full',
        });
      }
      continue;
    }

    if (start && emp.checkIn && emp.checkIn > start) {
      gaps.push({
        slotIndex: i,
        availableFrom: start,
        availableTo: emp.checkIn,
        type: 'start',
      });
    }

    if (end && emp.checkOut && emp.checkOut < end) {
      gaps.push({
        slotIndex: i,
        availableFrom: emp.checkOut,
        availableTo: end,
        type: 'end',
      });
    }
  }

  return gaps;
}

export function calcFreeBeds(duration: any) {
  return getDurationGapInfo(duration).length;
}

export function calcHotelFreeBeds(hotel: any) {
  return (hotel.durations || []).reduce((sum: number, d: any) => sum + calcFreeBeds(d), 0);
}

export function calcHotelTotalNights(hotel: any) {
  return (hotel.durations || []).reduce((sum: number, d: any) => sum + calculateNights(d.startDate, d.endDate), 0);
}

export function calcHotelTotalCost(hotel: any) {
  return (hotel.durations || []).reduce((sum: number, d: any) => sum + getDurationTotal(d), 0);
}

export function isFreeOnDate(duration: any, targetDate: string) {
  const date = new Date(targetDate);
  const start = new Date(duration.startDate);
  const end = new Date(duration.endDate);

  if (!(date >= start && date < end)) return false;

  const totalBeds = getTotalBeds(duration.roomType, duration.numberOfRooms);
  const employees = duration.employees || [];
  let occupied = 0;

  for (let i = 0; i < totalBeds; i++) {
    const emp = employees[i];
    if (!emp?.checkIn || !emp?.checkOut) continue;
    const ci = new Date(emp.checkIn);
    const co = new Date(emp.checkOut);
    if (date >= ci && date < co) occupied++;
  }

  return occupied < totalBeds;
}

export function hotelHasFreeOnDate(hotel: any, targetDate: string) {
  return (hotel.durations || []).some((d: any) => isFreeOnDate(d, targetDate));
}

export function getFreeBedFilterDate(mode: 'now' | 'in3' | 'in7' | 'custom', customDate?: string) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  if (mode === 'in3') base.setDate(base.getDate() + 3);
  if (mode === 'in7') base.setDate(base.getDate() + 7);
  if (mode === 'custom' && customDate) return customDate;
  return base.toISOString().split('T')[0];
}

export function sumGroupCost(hotels: any[], selectedYear: number, selectedMonth: number | null) {
  return hotels.reduce((sum, hotel) => {
    if (selectedMonth === null) return sum + calcHotelTotalCost(hotel);
    return sum + (hotel.durations || []).reduce((inner: number, d: any) => inner + getDurationCostForMonth(d, selectedYear, selectedMonth), 0);
  }, 0);
}
