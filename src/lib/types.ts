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
  phone?: string // Added phone since it's used in RoomCard
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
  bedBrutto?: number | null
  bedEnergyNetto?: number | null
  bedEnergyMwst?: number | null
  bedEnergyBrutto?: number | null
  bedDiscountType?: 'percentage' | 'fixed'
  bedDiscountValue?: number | null

  // per_room tab
  roomNetto?: number | null
  roomMwst?: number | null
  roomBrutto?: number | null
  roomEnergyNetto?: number | null
  roomEnergyMwst?: number | null
  roomEnergyBrutto?: number | null
  roomDiscountType?: 'percentage' | 'fixed'
  roomDiscountValue?: number | null

  // total_room tab
  totalNetto?: number | null
  totalMwst?: number | null
  totalBrutto?: number | null 
  totalEnergyNetto?: number | null
  totalEnergyMwst?: number | null
  totalEnergyBrutto?: number | null
  totalDiscountType?: 'percentage' | 'fixed'
  totalDiscountValue?: number | null

  // NOTE: The global hasDiscount, discountType, and discountValue have been REMOVED
  // in favor of the tab-specific fields above.

  // legacy fields (kept for backward compat)
  nightlyPrice?: number
  pricePerBed?: boolean
  pricePerBedAmount?: number
  useBruttoNetto?: boolean
  brutto?: number | null
  netto?: number | null
  mwst?: number | null
  useManualPrices?: boolean
  nightlyPrices?: Record<string, number>
  pricingSynced?: boolean
  pricingMode?: 'simple' | 'brutto_netto'

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
  roomType?: RoomType
  numberOfRooms?: number
  bedsPerRoom?: number
  pricePerNightPerRoom?: number
  useManualPrices?: boolean
  nightlyPrices?: Record<string, number>
  autoDistribute?: boolean
  useBruttoNetto?: boolean
  brutto?: number | null
  netto?: number | null
  mwst?: number | null
  hasDiscount?: boolean
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
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
