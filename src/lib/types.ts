// src/lib/types.ts

export type FilterPaid    = 'all' | 'paid' | 'unpaid'
export type FilterDeposit = 'all' | 'deposit' | 'no-deposit'
export type FilterFree    = 'none' | 'today' | 'tomorrow' | 'in5days' | 'in7days'
export type GroupBy       = 'none' | 'company' | 'city'

export type RoomType = 'EZ' | 'DZ' | 'TZ' | 'WG'

// Which pricing tab is active on a room card
export type PricingTab = 'per_bed' | 'per_room' | 'total_room'

export interface Employee {
  id: string
  durationId: string
  roomCardId?: string | null
  slotIndex: number
  name: string
  checkIn?: string
  checkOut?: string
}

export interface ExtraCost {
  id: string        // local uuid
  note: string
  amount: number
}

export interface RoomCard {
  id: string
  durationId: string
  roomNo: string
  floor: string
  roomType: RoomType
  bedCount: number          // 1=EZ 2=DZ 3=TZ N=WG

  // ── New 3-tab pricing model ──
  pricingTab: PricingTab    // which tab is active
  // per_bed tab
  bedNetto?: number | null
  bedMwst?: number | null
  bedBrutto?: number | null   // per bed per night
  bedEnergy?: number | null   // extra per bed per night (same unit)
  // per_room tab
  roomNetto?: number | null
  roomMwst?: number | null
  roomBrutto?: number | null  // per room per night
  roomEnergy?: number | null  // extra per room per night
  // total_room tab
  totalNetto?: number | null
  totalMwst?: number | null
  totalBrutto?: number | null // total brutto for whole room
  totalEnergy?: number | null // flat extra on top of total

  // discount (applies to room total after energy)
  hasDiscount: boolean
  discountType: 'percentage' | 'fixed'
  discountValue: number

  // legacy fields (kept for backward compat)
  nightlyPrice: number
  pricePerBed: boolean
  pricePerBedAmount: number
  useBruttoNetto: boolean
  brutto?: number | null
  netto?: number | null
  mwst?: number | null
  useManualPrices: boolean
  nightlyPrices: Record<string, number>
  pricingSynced: boolean
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
  // extra costs (informational items added to total)
  extraCosts?: ExtraCost[]
  // room cards
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
