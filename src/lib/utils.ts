// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Duration, GapInfo, Hotel, PriceResult } from './types'

// ─── Class merge ──────────────────────────────────────────────────────────────
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

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value)
}

// ─── Number input ─────────────────────────────────────────────────────────────
export function normalizeNumberInput(raw: string): number {
  if (!raw) return 0
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// ─── Bed capacity ─────────────────────────────────────────────────────────────
export function getTotalBeds(roomType: string, numberOfRooms: number): number {
  const n = Math.max(1, numberOfRooms || 1)
  if (roomType === 'EZ') return n * 1
  if (roomType === 'DZ') return n * 2
  if (roomType === 'TZ') return n * 3
  if (roomType === 'WG') return n   // WG: numberOfRooms = beds directly
  return n * 2
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
export function calcDurationPrice(d: Duration): PriceResult {
  const nights = calculateNights(d.startDate, d.endDate)
  const rooms  = Math.max(1, d.numberOfRooms || 1)

  if (d.useBruttoNetto) {
    const hasBrutto = d.brutto != null && d.brutto > 0
    const hasNetto  = d.netto  != null && d.netto  > 0
    const hasMwst   = d.mwst   != null && d.mwst   >= 0

    if (hasNetto && hasMwst && !hasBrutto) {
      const brutto = d.netto! * (1 + d.mwst! / 100)
      return { brutto, netto: d.netto, mwst: d.mwst, total: brutto, nights, perNight: nights > 0 ? brutto / nights : 0 }
    }
    if (hasBrutto && hasMwst) {
      const netto = d.brutto! / (1 + d.mwst! / 100)
      return { brutto: d.brutto, netto, mwst: d.mwst, total: d.brutto!, nights, perNight: nights > 0 ? d.brutto! / nights : 0 }
    }
    if (hasBrutto) {
      // Only Brutto known — never invent Netto
      return { brutto: d.brutto, netto: undefined, mwst: d.mwst, total: d.brutto!, nights, perNight: nights > 0 ? d.brutto! / nights : 0 }
    }
    if (hasNetto) {
      return { brutto: undefined, netto: d.netto, mwst: d.mwst, total: d.netto!, nights, perNight: nights > 0 ? d.netto! / nights : 0 }
    }
    return { total: 0, perNight: 0, nights }
  }

  // Simple mode
  const perNight = d.pricePerNightPerRoom ?? 0
  let raw = 0

  if (d.useManualPrices && d.nightlyPrices && Object.keys(d.nightlyPrices).length > 0) {
    const allNights = getNightsBetween(d.startDate, d.endDate)
    raw = allNights.reduce((sum, date) => sum + ((d.nightlyPrices[date] ?? perNight) * rooms), 0)
  } else {
    raw = perNight * rooms * nights
  }

  // Apply discount
  let total = raw
  if (d.hasDiscount && d.discountValue) {
    total = d.discountType === 'percentage'
      ? raw * (1 - d.discountValue / 100)
      : Math.max(0, raw - d.discountValue)
  }

  return { total, perNight: nights > 0 ? total / nights : 0, nights }
}

export function getDurationTotal(d: Duration): number {
  return calcDurationPrice(d).total
}

// ─── Hotel aggregates ─────────────────────────────────────────────────────────
export function calcHotelTotalNights(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((s, d) => s + calculateNights(d.startDate, d.endDate), 0)
}

export function calcHotelTotalCost(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((s, d) => s + getDurationTotal(d), 0)
}

export function calcHotelPaidCost(hotel: Hotel): number {
  return (hotel.durations ?? []).filter(d => d.isPaid).reduce((s, d) => s + getDurationTotal(d), 0)
}

export function calcHotelUnpaidCost(hotel: Hotel): number {
  return (hotel.durations ?? []).filter(d => !d.isPaid).reduce((s, d) => s + getDurationTotal(d), 0)
}

export function calcHotelFreeBeds(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((s, d) => {
    const cap = getTotalBeds(d.roomType, d.numberOfRooms)
    const occ = (d.employees ?? []).filter(Boolean).length
    return s + Math.max(0, cap - occ)
  }, 0)
}

export function calcHotelFreeBedsOnDate(hotel: Hotel, date: Date): number {
  return (hotel.durations ?? []).reduce((s, d) => {
    if (!d.startDate || !d.endDate) return s
    const start = new Date(d.startDate)
    const end   = new Date(d.endDate)
    if (date < start || date >= end) return s
    const cap = getTotalBeds(d.roomType, d.numberOfRooms)
    const occ = (d.employees ?? []).filter(Boolean).length
    return s + Math.max(0, cap - occ)
  }, 0)
}

// ─── Availability filters ─────────────────────────────────────────────────────
function daysFromNow(days: number): Date {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + days); return d
}
export function hotelHasFreeBedsToday(h: Hotel)    { return calcHotelFreeBedsOnDate(h, daysFromNow(0)) > 0 }
export function hotelHasFreeBedsTomorrow(h: Hotel)  { return calcHotelFreeBedsOnDate(h, daysFromNow(1)) > 0 }
export function hotelHasFreeBedsIn5Days(h: Hotel)   { return calcHotelFreeBedsOnDate(h, daysFromNow(5)) > 0 }
export function hotelHasFreeBedsIn7Days(h: Hotel)   { return calcHotelFreeBedsOnDate(h, daysFromNow(7)) > 0 }

// ─── Employee status ──────────────────────────────────────────────────────────
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

// ─── Duration labels ──────────────────────────────────────────────────────────
export function getDurationTabLabel(d: Duration, lang: 'de' | 'en' = 'de'): string {
  if (!d.startDate || !d.endDate) return lang === 'de' ? 'Neue Dauer' : 'New duration'
  return `${formatDateShort(d.startDate, lang)} – ${formatDateShort(d.endDate, lang)}`
}

export function getDurationRowLabel(d: Duration, lang: 'de' | 'en' = 'de'): string {
  return getDurationTabLabel(d, lang)
}

// ─── Gap detection ────────────────────────────────────────────────────────────
export function getDurationGapInfo(d: Duration): GapInfo[] {
  if (!d.startDate || !d.endDate) return []
  const totalBeds = getTotalBeds(d.roomType, d.numberOfRooms)
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

// ─── Search ───────────────────────────────────────────────────────────────────
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
