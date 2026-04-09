// src/lib/types.ts

export type FilterPaid    = 'all' | 'paid' | 'unpaid'
export type FilterDeposit = 'all' | 'deposit' | 'no-deposit'
export type FilterFree    = 'none' | 'today' | 'tomorrow' | 'in5days' | 'in7days'
export type GroupBy       = 'none' | 'company' | 'city'

export type RoomType = 'EZ' | 'DZ' | 'TZ' | 'WG'

export interface Employee {
  id: string
  durationId: string
  roomCardId?: string | null
  slotIndex: number
  name: string
  checkIn?: string
  checkOut?: string
}

export interface RoomCard {
  id: string
  durationId: string
  roomNo: string
  floor: string
  roomType: RoomType
  bedCount: number          // 1=EZ 2=DZ 3=TZ N=WG
  // pricing
  nightlyPrice: number      // price/night/room (simple)
  pricePerBed: boolean      // WG: use price/bed/night
  pricePerBedAmount: number // WG price per bed
  useBruttoNetto: boolean
  brutto?: number | null
  netto?: number | null
  mwst?: number | null
  useManualPrices: boolean
  nightlyPrices: Record<string, number>
  hasDiscount: boolean
  discountType: 'percentage' | 'fixed'
  discountValue: number
  pricingSynced: boolean    // apply-to-same-type shortcut
  pricingMode: 'simple' | 'brutto_netto'
  sortOrder: number
  employees: Employee[]
}

export interface GapInfo {
  slotIndex: number
  type: 'full' | 'start' | 'end'
  availableFrom: string
  availableTo: string
}

export interface PriceResult {
  total: number
  perNight: number
  nights: number
  brutto?: number
  netto?: number
  mwst?: number
  rawBeforeDiscount?: number
}

export interface Duration {
  id: string
  hotelId: string
  startDate: string
  endDate: string
  // legacy flat fields (kept for backward compat)
  roomType: RoomType
  numberOfRooms: number
  bedsPerRoom?: number
  pricePerNightPerRoom: number
  useManualPrices: boolean
  nightlyPrices: Record<string, number>
  autoDistribute: boolean
  useBruttoNetto: boolean
  brutto?: number | null
  netto?: number | null
  mwst?: number | null
  hasDiscount: boolean
  discountType: 'percentage' | 'fixed'
  discountValue: number
  isPaid: boolean
  rechnungNr?: string | null
  bookingId?: string | null
  depositEnabled: boolean
  depositAmount?: number | null
  extensionNote?: string | null
  employees: Employee[]
  // new
  roomCards: RoomCard[]
}

export interface Hotel {
  id: string
  name: string
  city: string
  companyTag: string | string[]
  address?: string
  contactPerson?: string
  phone?: string
  email?: string
  webLink?: string
  notes?: string
  lastUpdatedBy?: string
  lastUpdatedAt?: string
  durations: Duration[]
}
