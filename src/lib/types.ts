// src/lib/types.ts

// ─── Primitives ───────────────────────────────────────────────────────────────
export type RoomType      = 'EZ' | 'DZ' | 'TZ' | 'WG'
export type UserRole      = 'admin' | 'editor' | 'viewer'
export type EmployeeStatus = 'active' | 'ending-soon' | 'completed' | 'upcoming'
export type Language      = 'de' | 'en'
export type Theme         = 'dark' | 'light'
export type SortBy        = 'name' | 'city' | 'cost' | 'nights'
export type GroupBy       = 'none' | 'company' | 'city'
export type DiscountType  = 'percentage' | 'fixed'
export type FilterPaid    = 'all' | 'paid' | 'unpaid'
export type FilterDeposit = 'all' | 'deposit' | 'no-deposit'
export type FilterFree    = 'none' | 'today' | 'tomorrow' | 'in5days' | 'in7days'

// ─── Employee ─────────────────────────────────────────────────────────────────
export interface Employee {
  id: string
  durationId: string
  slotIndex: number
  name: string
  checkIn: string   // ISO date
  checkOut: string  // ISO date
}

// ─── Duration ─────────────────────────────────────────────────────────────────
export interface Duration {
  id: string
  hotelId: string

  // Dates & room
  startDate: string
  endDate: string
  roomType: RoomType
  numberOfRooms: number

  // Simple pricing
  pricePerNightPerRoom: number
  useManualPrices: boolean
  nightlyPrices: Record<string, number>  // { '2026-04-01': 90 }
  autoDistribute: boolean

  // Brutto / Netto / MwSt pricing
  useBruttoNetto: boolean
  brutto?: number
  netto?: number
  mwst?: number

  // Discount
  hasDiscount: boolean
  discountType: DiscountType
  discountValue: number

  // Invoice & payment
  isPaid: boolean
  rechnungNr?: string
  bookingId?: string

  // Deposit
  depositEnabled: boolean
  depositAmount?: number

  // Notes
  extensionNote?: string

  // Bed assignments
  employees: (Employee | null)[]
}

// ─── Hotel ────────────────────────────────────────────────────────────────────
export interface Hotel {
  id: string
  userId: string

  // Main row fields — inline editable
  name: string
  city: string
  companyTag: string

  // Expanded panel fields
  address?: string
  contactPerson?: string
  phone?: string
  email?: string
  webLink?: string
  notes?: string

  // Audit
  lastUpdatedBy?: string
  lastUpdatedAt?: string
  createdAt: string
  updatedAt?: string

  durations: Duration[]
}

// ─── Pricing result (returned by calcDurationPrice in utils.ts) ───────────────
export interface PriceResult {
  total: number
  perNight: number
  nights: number
  brutto?: number
  netto?: number
  mwst?: number
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  createdAt: string
}

// ─── Workspace Share ──────────────────────────────────────────────────────────
export interface WorkspaceShare {
  id: string
  ownerId: string
  sharedWithEmail: string
  permission: 'view' | 'edit'
  createdAt: string
}

// ─── Export ───────────────────────────────────────────────────────────────────
export interface ExportOptions {
  format: 'pdf' | 'docx' | 'xlsx' | 'csv'
  includeFilters: boolean
}

// ─── Gap detection (used in utils.ts getDurationGapInfo) ─────────────────────
export interface GapInfo {
  slotIndex: number
  type: 'full' | 'start' | 'end'
  availableFrom: string
  availableTo: string
}
