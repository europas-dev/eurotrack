// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Duration, GapInfo, Hotel, PriceResult } from './types'
import { calcRoomCardTotal, bedsForType, deriveB } from './roomCardUtils'

// ─── Class merge ─────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function calculateNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime()
  return Math.max(0, Math.ceil(diff / 86400000))
}

export function getNightsBetween(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return []
  const nights: string[] = []
  const cur = new Date(startDate)
  const end = new Date(endDate)
  while (cur < end) {
    nights.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return nights
}

export function formatDateDisplay(iso: string, lang: 'de' | 'en' = 'de'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  if (lang === 'de') {
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(iso: string, lang: 'de' | 'en' = 'de'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  if (lang === 'de') {
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateChip(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export function formatDateDMY(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value)
}

// ─── Number input ─────────────────────────────────────────────────────────────
export function normalizeNumberInput(raw: string | number): number {
  if (raw === '' || raw == null) return 0
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw
  let s = String(raw).trim()
  if (s === '') return 0
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// ─── Room type label ──────────────────────────────────────────────────────────
export function getRoomTypeLabel(roomType: string, lang: 'de' | 'en' = 'de'): string {
  if (lang === 'de') {
    if (roomType === 'EZ') return 'EZ – Einzelzimmer'
    if (roomType === 'DZ') return 'DZ – Doppelzimmer'
    if (roomType === 'TZ') return 'TZ – Dreibettzimmer'
    if (roomType === 'WG') return 'WG – Wohngemeinschaft'
    return roomType
  }
  if (roomType === 'EZ') return 'EZ – Single room'
  if (roomType === 'DZ') return 'DZ – Double room'
  if (roomType === 'TZ') return 'TZ – Triple room'
  if (roomType === 'WG') return 'WG – Shared flat'
  return roomType
}

export function getTotalBeds(roomType: string, numberOfRooms: number, bedsPerRoom?: number): number {
  const n = Math.max(1, numberOfRooms || 1)
  if (roomType === 'EZ') return n * 1
  if (roomType === 'DZ') return n * 2
  if (roomType === 'TZ') return n * 3
  if (roomType === 'WG') return n * Math.max(1, bedsPerRoom || 1)
  return n * 2
}

export function getDurationTotalBeds(d: Pick<Duration, 'roomType' | 'numberOfRooms' | 'bedsPerRoom'>): number {
  return getTotalBeds(d.roomType, d.numberOfRooms, d.bedsPerRoom)
}

// ─── Pricing ───────────────────────────────────────────────────
export function getDurationTotal(d: Duration): number {
  const roomCards = d.roomCards || [];
  const extraTotal = (d.extraCosts || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  let bruttoBase = 0;

  if (d.useBruttoNetto) {
    bruttoBase = deriveB(d.brutto, d.netto, d.mwst) + extraTotal;
  } else {
    const rcTotal = roomCards.reduce((s, c) => s + calcRoomCardTotal(c, d.startDate, d.endDate), 0);
    bruttoBase = rcTotal + extraTotal;
  }

  let discountedTotal = bruttoBase;
  if (!d.useBruttoNetto && d.hasDiscount && d.discountValue && d.discountValue > 0) {
    discountedTotal = d.discountType === 'fixed'
      ? bruttoBase - d.discountValue
      : bruttoBase * (1 - d.discountValue / 100);
  }
  
  return Math.max(0, discountedTotal);
}

export function calcDurationPrice(d: Duration): PriceResult {
  const total = getDurationTotal(d);
  const nights = calculateNights(d.startDate, d.endDate);
  return {
    total,
    perNight: nights > 0 ? total / nights : 0,
    nights,
  }
}

export function getDurationCostForMonth(d: Duration, year: number, month: number): number {
  if (!d.startDate || !d.endDate) return 0

  const monthStart = new Date(Date.UTC(year, month, 1))
  const monthEnd   = new Date(Date.UTC(year, month + 1, 1))

  const dStart = new Date(d.startDate)
  const dEnd   = new Date(d.endDate)

  if (dEnd <= monthStart || dStart >= monthEnd) return 0

  const overlapStart = dStart > monthStart ? dStart : monthStart
  const overlapEnd   = dEnd   < monthEnd   ? dEnd   : monthEnd

  const overlapNights = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / 86400000)
  const totalNights   = calculateNights(d.startDate, d.endDate)
  if (totalNights === 0) return 0

  const total = getDurationTotal(d)
  return (overlapNights / totalNights) * total
}

export function calcHotelTotalNights(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((s, d) => s + calculateNights(d.startDate, d.endDate), 0)
}

export function calcHotelTotalCost(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((s, d) => s + getDurationTotal(d as Duration), 0)
}

export function calcHotelPaidCost(hotel: Hotel): number {
  return (hotel.durations ?? []).filter(d => d.isPaid).reduce((s, d) => s + getDurationTotal(d as Duration), 0)
}

export function calcHotelUnpaidCost(hotel: Hotel): number {
  return (hotel.durations ?? []).filter(d => !d.isPaid).reduce((s, d) => s + getDurationTotal(d as Duration), 0)
}

// ─── THE FIX: Free Beds now correctly measures unique slots occupied ───
export function calcHotelFreeBeds(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((s, d) => {
    const rCards = d.roomCards || [];
    let tBeds = 0;
    let tAssigned = 0;
    
    if (rCards.length > 0) {
      rCards.forEach((c: any) => {
        tBeds += bedsForType(c.roomType, c.bedCount);
        // Only count unique bed slots!
        const uniqueSlots = new Set((c.employees || []).map((e: any) => e.slotIndex || 0));
        tAssigned += uniqueSlots.size;
      });
    } else {
      tBeds = getTotalBeds(d.roomType, d.numberOfRooms, d.bedsPerRoom);
      const uniqueSlots = new Set((d.employees || []).filter(Boolean).map((e: any) => e.slotIndex || 0));
      tAssigned += uniqueSlots.size;
    }
    
    return s + Math.max(0, tBeds - tAssigned);
  }, 0);
}

export function calcHotelFreeBedsOnDate(hotel: Hotel, date: Date): number {
  return (hotel.durations ?? []).reduce((s, d) => {
    if (!d.startDate || !d.endDate) return s
    const start = new Date(d.startDate)
    const end   = new Date(d.endDate)
    if (date < start || date >= end) return s
    
    const rCards = d.roomCards || [];
    let tBeds = 0;
    let tAssigned = 0;
    
    if (rCards.length > 0) {
      rCards.forEach((c: any) => {
        tBeds += bedsForType(c.roomType, c.bedCount);
        const uniqueSlots = new Set((c.employees || []).map((e: any) => e.slotIndex || 0));
        tAssigned += uniqueSlots.size;
      });
    } else {
      tBeds = getTotalBeds(d.roomType, d.numberOfRooms, d.bedsPerRoom);
      const uniqueSlots = new Set((d.employees || []).filter(Boolean).map((e: any) => e.slotIndex || 0));
      tAssigned += uniqueSlots.size;
    }
    return s + Math.max(0, tBeds - tAssigned);
  }, 0)
}

function daysFromNow(days: number): Date {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + days); return d
}
export function hotelHasFreeBedsToday(h: Hotel)    { return calcHotelFreeBedsOnDate(h, daysFromNow(0)) > 0 }
export function hotelHasFreeBedsTomorrow(h: Hotel)  { return calcHotelFreeBedsOnDate(h, daysFromNow(1)) > 0 }
export function hotelHasFreeBedsIn5Days(h: Hotel)   { return calcHotelFreeBedsOnDate(h, daysFromNow(5)) > 0 }
export function hotelHasFreeBedsIn7Days(h: Hotel)   { return calcHotelFreeBedsOnDate(h, daysFromNow(7)) > 0 }

export function getEmployeeStatus(checkIn: string, checkOut: string): 'active' | 'ending-soon' | 'completed' | 'upcoming' {
  if (!checkIn || !checkOut) return 'upcoming'
  const now     = new Date(); now.setHours(0,0,0,0)
  const inDate  = new Date(checkIn)
  const outDate = new Date(checkOut)
  const diffDays = Math.ceil((outDate.getTime() - now.getTime()) / 86400000)
  if (outDate < now)   return 'completed'
  if (inDate  > now)   return 'upcoming'
  if (diffDays <= 3)   return 'ending-soon'
  return 'active'
}

export function getDurationTabLabel(d: Duration, lang: 'de' | 'en' = 'de'): string {
  if (!d.startDate || !d.endDate) return lang === 'de' ? 'Neue Dauer' : 'New duration'
  return `${formatDateShort(d.startDate, lang)} – ${formatDateShort(d.endDate, lang)}`
}

export function getDurationRowLabel(d: Duration, lang: 'de' | 'en' = 'de'): string {
  if (!d.startDate || !d.endDate) return lang === 'de' ? 'Neue Dauer' : 'New duration'
  return `${formatDateChip(d.startDate)} – ${formatDateChip(d.endDate)}`
}

export function getDurationGapInfo(d: Duration): GapInfo[] {
  if (!d.startDate || !d.endDate) return []
  const totalBeds = getTotalBeds(d.roomType, d.numberOfRooms, d.bedsPerRoom)
  const gaps: GapInfo[] = []

  for (let i = 0; i < totalBeds; i++) {
    const emp = (d.employees ?? [])[i]
    if (!emp) {
      gaps.push({ slotIndex: i, type: 'full', availableFrom: d.startDate, availableTo: d.endDate })
    } else {
      if (emp.checkIn > d.startDate)
        gaps.push({ slotIndex: i, type: 'start', availableFrom: d.startDate, availableTo: emp.checkIn })
      if (emp.checkOut < d.endDate)
        gaps.push({ slotIndex: i, type: 'end', availableFrom: emp.checkOut, availableTo: d.endDate })
    }
  }
  return gaps
}

export function hotelMatchesSearch(hotel: Hotel, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const fields = [
    hotel.name, hotel.city, hotel.companyTag,
    hotel.address, hotel.contactPerson, hotel.phone,
    hotel.email, hotel.webLink, hotel.notes,
    ...(hotel.durations ?? []).flatMap(d => [
      d.rechnungNr, d.bookingId, d.extensionNote,
      ...(d.employees ?? []).filter(Boolean).map(e => e!.name),
    ]),
  ]
  return fields.some(f => f && f.toLowerCase().includes(q))
}
