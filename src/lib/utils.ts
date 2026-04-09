// src/lib/utils.ts

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Duration, Hotel, PriceResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// CN — Tailwind class merge utility
// ─────────────────────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Returns number of nights between two ISO date strings.
// Returns 0 if either date is missing or invalid.
export function calculateNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime()
  return Math.max(0, Math.ceil(diff / 86400000))
}

// Returns array of ISO date strings for every night between two dates (inclusive of start, exclusive of end).
// Used to render the night calendar grid in DurationCard.
export function getNightsBetween(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return []
  const nights: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const cur = new Date(start)
  while (cur < end) {
    nights.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return nights
}

// Format ISO date string for display.
// de: "01.04.2026"  |  en: "Apr 1, 2026"
export function formatDateDisplay(iso: string, lang: 'de' | 'en' = 'de'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  if (lang === 'de') {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}.${d.getFullYear()}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Format short date: de "01.04."  |  en "Apr 1"
export function formatDateShort(iso: string, lang: 'de' | 'en' = 'de'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  if (lang === 'de') {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}.`
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY
// ─────────────────────────────────────────────────────────────────────────────

// Format a number as EUR currency string.
// Always uses de-DE locale for € formatting.
export function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER INPUT NORMALIZATION
// Converts user-typed number strings (comma or dot decimal) to JS numbers.
// Handles both "1.234,56" (German) and "1234.56" (English) formats.
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeNumberInput(raw: string): number {
  if (!raw) return 0
  // Remove thousands separators (dots or spaces), replace comma decimal with dot
  const normalized = raw.replace(/./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : n
}

// ─────────────────────────────────────────────────────────────────────────────
// BED CAPACITY
// ─────────────────────────────────────────────────────────────────────────────

// Returns total bed capacity for a duration based on room type and room count.
// WG: numberOfRooms IS the bed count (shared flat, user sets beds directly).
export function getTotalBeds(roomType: string, numberOfRooms: number): number {
  const n = Math.max(1, numberOfRooms)
  if (roomType === 'EZ') return n * 1
  if (roomType === 'DZ') return n * 2
  if (roomType === 'TZ') return n * 3
  if (roomType === 'WG') return n  // WG: numberOfRooms = beds
  return n * 2 // fallback DZ
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING LOGIC
// ─────────────────────────────────────────────────────────────────────────────
// Rules (from spec):
//   1. Forward:  nights × pricePerNightPerRoom × numberOfRooms = total
//   2. Reverse:  if total known and nights known → pricePerNightPerRoom = total / nights / rooms
//   3. Brutto + MwSt known → Netto = Brutto / (1 + mwst/100)
//   4. Netto + MwSt known  → Brutto = Netto * (1 + mwst/100)
//   5. Only Brutto known   → Netto stays UNDEFINED — never invented
//   6. useBruttoNetto mode → use brutto as the visible total if available

export function calcDurationPrice(d: Duration): PriceResult {
  const nights = calculateNights(d.startDate, d.endDate)
  const rooms = Math.max(1, d.numberOfRooms)

  // ── Brutto / Netto mode ────────────────────────────────────────────────────
  if (d.useBruttoNetto) {
    const hasBrutto = d.brutto != null && d.brutto > 0
    const hasNetto  = d.netto  != null && d.netto  > 0
    const hasMwst   = d.mwst   != null && d.mwst   >= 0

    // Case: Netto + MwSt → derive Brutto
    if (hasNetto && hasMwst && !hasBrutto) {
      const netto  = d.netto!
      const mwst   = d.mwst!
      const brutto = netto * (1 + mwst / 100)
      return { brutto, netto, mwst, total: brutto, nights, perNight: nights > 0 ? brutto / nights : 0 }
    }

    // Case: Brutto + MwSt → derive Netto
    if (hasBrutto && hasMwst) {
      const brutto = d.brutto!
      const mwst   = d.mwst!
      const netto  = brutto / (1 + mwst / 100)
      return { brutto, netto, mwst, total: brutto, nights, perNight: nights > 0 ? brutto / nights : 0 }
    }

    // Case: Only Brutto known → Netto stays undefined
    if (hasBrutto) {
      const brutto = d.brutto!
      return { brutto, netto: undefined, mwst: d.mwst, total: brutto, nights, perNight: nights > 0 ? brutto / nights : 0 }
    }

    // Case: Only Netto known → show Netto as total, Brutto unknown
    if (hasNetto) {
      const netto = d.netto!
      return { brutto: undefined as any, netto, mwst: d.mwst, total: netto, nights, perNight: nights > 0 ? netto / nights : 0 }
    }

    // Nothing filled yet
    return { brutto: 0, netto: undefined, mwst: d.mwst, total: 0, nights, perNight: 0 }
  }

  // ── Simple nightly pricing mode ────────────────────────────────────────────
  let perNight = d.pricePerNightPerRoom ?? 0

  // Manual nightly prices: sum each night individually
  if (d.useManualPrices && d.nightlyPrices && Object.keys(d.nightlyPrices).length > 0) {
    const allNights = getNightsBetween(d.startDate, d.endDate)
    const manualTotal = allNights.reduce((sum, date) => {
      return sum + (d.nightlyPrices![date] ?? perNight) * rooms
    }, 0)
    // Apply discount
    const total = applyDiscount(manualTotal, d)
    return { brutto: total, netto: undefined, mwst: undefined, total, nights, perNight: nights > 0 ? total / nights : 0 }
  }

  // Uniform nightly price
  const rawTotal = perNight * rooms * nights
  const total = applyDiscount(rawTotal, d)
  return { brutto: total, netto: undefined, mwst: undefined, total, nights, perNight: nights > 0 ? total / nights : 0 }
}

// Apply discount to a total amount based on duration discount settings
function applyDiscount(amount: number, d: Duration): number {
  if (!d.hasDiscount || !d.discountValue) return amount
  if (d.discountType === 'percentage') {
    return amount * (1 - d.discountValue / 100)
  }
  // Fixed EUR discount
  return Math.max(0, amount - d.discountValue)
}

// Convenience: get just the total number for a duration
export function getDurationTotal(d: Duration): number {
  return calcDurationPrice(d).total
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTEL-LEVEL AGGREGATES
// Used in HotelRow main row and Dashboard KPI bar
// ─────────────────────────────────────────────────────────────────────────────

export function calcHotelTotalNights(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((sum, d) => sum + calculateNights(d.startDate, d.endDate), 0)
}

export function calcHotelTotalCost(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((sum, d) => sum + getDurationTotal(d), 0)
}

export function calcHotelPaidCost(hotel: Hotel): number {
  return (hotel.durations ?? [])
    .filter(d => d.isPaid)
    .reduce((sum, d) => sum + getDurationTotal(d), 0)
}

export function calcHotelUnpaidCost(hotel: Hotel): number {
  return (hotel.durations ?? [])
    .filter(d => !d.isPaid)
    .reduce((sum, d) => sum + getDurationTotal(d), 0)
}

// Free beds: total capacity minus filled employee slots, across ALL durations
export function calcHotelFreeBeds(hotel: Hotel): number {
  return (hotel.durations ?? []).reduce((sum, d) => {
    const cap = getTotalBeds(d.roomType, d.numberOfRooms)
    const occ = (d.employees ?? []).filter(e => e != null).length
    return sum + Math.max(0, cap - occ)
  }, 0)
}

// Free beds on a specific date — used by availability filters
export function calcHotelFreeBedsOnDate(hotel: Hotel, date: Date): number {
  return (hotel.durations ?? []).reduce((sum, d) => {
    if (!d.startDate || !d.endDate) return sum
    const start = new Date(d.startDate)
    const end = new Date(d.endDate)
    // Check if the date falls within this duration
    if (date < start || date >= end) return sum
    const cap = getTotalBeds(d.roomType, d.numberOfRooms)
    const occ = (d.employees ?? []).filter(e => e != null).length
    return sum + Math.max(0, cap - occ)
  }, 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY FILTERS — used in Dashboard filtering
// ─────────────────────────────────────────────────────────────────────────────

export function hotelHasFreeBedsToday(hotel: Hotel): boolean {
  return calcHotelFreeBedsOnDate(hotel, new Date()) > 0
}

export function hotelHasFreeBedsTomorrow(hotel: Hotel): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return calcHotelFreeBedsOnDate(hotel, tomorrow) > 0
}

export function hotelHasFreeBedsInDays(hotel: Hotel, days: number): boolean {
  const target = new Date()
  target.setDate(target.getDate() + days)
  return calcHotelFreeBedsOnDate(hotel, target) > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE STATUS
// ─────────────────────────────────────────────────────────────────────────────
// ending-soon: checkout within 3 days from today
// completed:   checkout already passed
// upcoming:    checkin is in the future
// active:      currently checked in

export function getEmployeeStatus(
  checkIn: string,
  checkOut: string
): 'active' | 'ending-soon' | 'completed' | 'upcoming' {
  if (!checkIn || !checkOut) return 'upcoming'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const inDate  = new Date(checkIn)
  const outDate = new Date(checkOut)
  const diffDays = Math.ceil((outDate.getTime() - now.getTime()) / 86400000)

  if (outDate < now)        return 'completed'
  if (inDate > now)         return 'upcoming'
  if (diffDays <= 3)        return 'ending-soon'
  return 'active'
}

// ─────────────────────────────────────────────────────────────────────────────
// LABEL HELPERS — ALL bilingual (de / en)
// ─────────────────────────────────────────────────────────────────────────────

// Duration tab label shown on the tab button inside expanded panel
// e.g. "01.04. – 15.04." or "Neue Dauer"
export function getDurationTabLabel(d: Duration, lang: 'de' | 'en' = 'de'): string {
  if (!d.startDate || !d.endDate) {
    return lang === 'de' ? 'Neue Dauer' : 'New duration'
  }
  return `${formatDateShort(d.startDate, lang)} – ${formatDateShort(d.endDate, lang)}`
}

// Duration row label shown on compact duration tag chips in main row
export function getDurationRowLabel(d: Duration, lang: 'de' | 'en' = 'de'): string {
  return getDurationTabLabel(d, lang)
}

// Room type label — bilingual
export function getRoomTypeLabel(roomType: string, lang: 'de' | 'en' = 'de'): string {
  const map: Record<string, { de: string; en: string }> = {
    EZ: { de: 'Einzelzimmer', en: 'Single room' },
    DZ: { de: 'Doppelzimmer', en: 'Double room' },
    TZ: { de: 'Dreibettzimmer', en: 'Triple room' },
    WG: { de: 'Wohngemeinschaft', en: 'Shared flat' },
  }
  return map[roomType]?.[lang] ?? roomType
}

// Employee status label — bilingual
export function getEmployeeStatusLabel(
  status: 'active' | 'ending-soon' | 'completed' | 'upcoming',
  lang: 'de' | 'en' = 'de'
): string {
  const map = {
    'active':       { de: 'Aktiv',         en: 'Active' },
    'ending-soon':  { de: 'Endet bald',    en: 'Ending soon' },
    'completed':    { de: 'Abgereist',     en: 'Checked out' },
    'upcoming':     { de: 'Bevorstehend',  en: 'Upcoming' },
  }
  return map[status][lang]
}

// Payment status label — bilingual
export function getPaymentLabel(isPaid: boolean, lang: 'de' | 'en' = 'de'): string {
  return isPaid
    ? (lang === 'de' ? 'Bezahlt' : 'Paid')
    : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')
}

// Sync status label — bilingual (used in offline mode indicator)
export function getSyncStatusLabel(
  status: 'saved' | 'saving' | 'pending' | 'error',
  lang: 'de' | 'en' = 'de'
): string {
  const map = {
    saved:   { de: 'Gespeichert',              en: 'Saved' },
    saving:  { de: 'Wird gespeichert...',      en: 'Saving...' },
    pending: { de: 'Offline – wird synchronisiert', en: 'Offline – pending sync' },
    error:   { de: 'Fehler beim Speichern',    en: 'Save failed' },
  }
  return map[status][lang]
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP DETECTION
// A "gap" is a period inside a duration where a bed slot has no employee.
// Used in DurationCard to show available sub-windows for substitute placement.
// ─────────────────────────────────────────────────────────────────────────────

export interface GapInfo {
  slotIndex: number
  type: 'full' | 'start' | 'end' | 'middle'
  availableFrom: string
  availableTo: string
}

export function getDurationGapInfo(d: Duration): GapInfo[] {
  if (!d.startDate || !d.endDate) return []
  const totalBeds = getTotalBeds(d.roomType, d.numberOfRooms)
  const gaps: GapInfo[] = []

  for (let i = 0; i < totalBeds; i++) {
    const emp = d.employees?.[i]
    if (emp == null) {
      // Whole slot is empty — full gap = entire duration window
      gaps.push({
        slotIndex: i,
        type: 'full',
        availableFrom: d.startDate,
        availableTo: d.endDate,
      })
    } else {
      // Slot has employee — check for gaps before checkIn or after checkOut
      if (emp.checkIn && emp.checkIn > d.startDate) {
        gaps.push({
          slotIndex: i,
          type: 'start',
          availableFrom: d.startDate,
          availableTo: emp.checkIn,
        })
      }
      if (emp.checkOut && emp.checkOut < d.endDate) {
        gaps.push({
          slotIndex: i,
          type: 'end',
          availableFrom: emp.checkOut,
          availableTo: d.endDate,
        })
      }
    }
  }

  return gaps
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Returns true if any searchable field in the hotel matches the query.
// Searches: name, city, company, address, contactPerson, phone, email,
//           webLink, notes, all employee names, all rechnungNr, bookingId
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

// Highlight matched text — returns HTML string with <mark> tags
// Use dangerouslySetInnerHTML or a safe renderer
export function highlightMatch(text: string, query: string): string {
  if (!query || !text) return text ?? ''
  const escaped = query.replace(/[.*+?^${}()|[]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

// ─────────────────────────────────────────────────────────────────────────────
// SORT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function sortHotels(
  hotels: Hotel[],
  sortBy: string,
  sortDir: 'asc' | 'desc'
): Hotel[] {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...hotels].sort((a, b) => {
    let va: any, vb: any
    if (sortBy === 'name')          { va = (a.name ?? '').toLowerCase(); vb = (b.name ?? '').toLowerCase() }
    else if (sortBy === 'city')     { va = (a.city ?? '').toLowerCase(); vb = (b.city ?? '').toLowerCase() }
    else if (sortBy === 'company')  { va = (a.companyTag ?? '').toLowerCase(); vb = (b.companyTag ?? '').toLowerCase() }
    else if (sortBy === 'cost')     { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b) }
    else if (sortBy === 'nights')   { va = calcHotelTotalNights(a); vb = calcHotelTotalNights(b) }
    else if (sortBy === 'freeBeds') { va = calcHotelFreeBeds(a); vb = calcHotelFreeBeds(b) }
    else if (sortBy === 'recent')   { va = a.createdAt ?? ''; vb = b.createdAt ?? '' }
    else { va = a.name ?? ''; vb = b.name ?? '' }
    return va < vb ? -dir : va > vb ? dir : 0
  })
}
