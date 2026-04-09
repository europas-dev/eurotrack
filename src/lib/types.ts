// src/lib/types.ts

export type FilterPaid    = 'all' | 'paid' | 'unpaid'
export type FilterDeposit = 'all' | 'deposit' | 'no-deposit'
export type FilterFree    = 'none' | 'today' | 'tomorrow' | 'in5days' | 'in7days'
export type GroupBy       = 'none' | 'company' | 'city'

export type RoomType = 'EZ' | 'DZ' | 'MBZ' | 'WG'

export interface Employee {
  id: string
  durationId: string
  slotIndex: number
  name: string
  checkIn?: string
  checkOut?: string
}

export interface Duration {
  id: string
  hotelId: string
  startDate: string
  endDate: string
  roomType: RoomType
  numberOfRooms: number
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
}

export interface Hotel {
  id: string
  name: string
  city: string
  companyTag: string
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
