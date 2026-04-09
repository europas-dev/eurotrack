// src/lib/types.ts

// ─── Primitive Types ───────────────────────────────────────────────────────────

export type RoomType = 'EZ' | 'DZ' | 'TZ' | 'WG'
// EZ = Einzelzimmer (single), DZ = Doppelzimmer (double),
// TZ = Tripple, WG = Wohngemeinschaft (shared flat, bed count = numberOfRooms)

export type UserRole = 'admin' | 'editor' | 'viewer'

export type EmployeeStatus = 'active' | 'ending-soon' | 'completed' | 'upcoming'

export type Language = 'de' | 'en'

export type Theme = 'dark' | 'light'

export type SortBy =
  | 'recent' | 'name'
  | 'max-duration' | 'min-duration'
  | 'max-cost' | 'min-cost'
  | 'most-booked' | 'least-booked'

export type GroupBy = 'none' | 'company' | 'city'

export type DiscountType = 'percentage' | 'fixed'

export type ExportFormat = 'excel' | 'csv' | 'pdf' | 'docx'

// ─── Employee ─────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  name: string
  checkIn: string   // ISO date string e.g. "2026-04-01"
  checkOut: string  // ISO date string e.g. "2026-04-15"
}

// ─── Duration ─────────────────────────────────────────────────────────────────
// One booking period inside a hotel. A hotel can have multiple durations.

export interface Duration {
  id: string
  hotelId: string

  // Dates
  startDate: string   // ISO date string
  endDate: string     // ISO date string

  // Room config
  roomType: RoomType
  numberOfRooms: number  // For WG: this is the total bed count, not room count

  // Pricing — simple path
  pricePerNightPerRoom: number   // Base nightly price per room (or per bed for WG)
  useManualPrices: boolean       // If true, nightlyPrices overrides uniform price
  nightlyPrices?: Record<string, number>  // { "2026-04-01": 90, "2026-04-02": 85 }
  autoDistribute: boolean        // Auto-distribute price across nights

  // Pricing — Brutto / Netto / MwSt
  // Rules:
  //   - If brutto + mwst known → netto = brutto / (1 + mwst/100)
  //   - If netto + mwst known  → brutto = netto * (1 + mwst/100)
  //   - If only brutto known   → netto stays undefined (never invented)
  brutto?: number       // Total gross price (Brutto)
  netto?: number        // Net price before tax (Netto) — may be undefined
  mwst?: number         // MwSt rate in % e.g. 19 or 7 — may be undefined
  useBruttoNetto: boolean  // Whether to use Brutto/Netto mode vs simple nightly

  // Discount
  hasDiscount: boolean
  discountType?: DiscountType
  discountValue?: number  // % or fixed EUR depending on discountType

  // Payment
  isPaid: boolean

  // Deposit
  depositEnabled: boolean   // Whether a deposit exists for this duration
  depositAmount?: number    // Amount in EUR — only relevant if depositEnabled

  // Invoice / booking reference
  rechnungNr?: string   // Invoice number (Rechnungsnummer)
  bookingId?: string    // Booking.com or other reference

  // Extension note
  extensionNote?: string

  // Employees — array length = total bed capacity
  // null slots = empty/free beds
  employees: (Employee | null)[]
}

// ─── Hotel ────────────────────────────────────────────────────────────────────
// Top-level entity. Has multiple durations.

export interface Hotel {
  id: string
  userId: string

  // Main fields — editable inline in the main row
  name: string
  city: string
  companyTag: string

  // Expanded panel fields
  address?: string
  contactPerson?: string   // Was 'contact' in old version — renamed for clarity
  phone?: string
  email?: string
  webLink?: string
  notes?: string

  // Audit
  createdAt: string
  updatedAt?: string
  lastUpdatedBy?: string   // Display name of last editor (for collaboration)
  lastUpdatedAt?: string   // ISO timestamp of last edit

  // Relations
  durations: Duration[]
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  createdAt: string
}

// ─── Workspace Collaborator ───────────────────────────────────────────────────
// Represents a person who has been invited to view or edit the workspace.

export interface WorkspaceShare {
  id: string
  ownerId: string
  sharedWithEmail: string   // Email used to invite
  sharedWithId?: string     // Filled once they accept / first login
  permission: UserRole      // 'viewer' | 'editor' | 'admin'
  createdAt: string
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  userId: string
  type: 'urgent' | 'warning' | 'info'
  category: 'checkout-soon' | 'gap-detected' | 'new-booking' | 'team-activity'
  message: string
  metadata?: any
  read: boolean
  createdAt: string
}

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface FilterState {
  groupBy: GroupBy
  companies: string[]
  cities: string[]
  roomTypes: RoomType[]
  freeBeds: {
    today: boolean
    tomorrow: boolean
    in5Days: boolean
    in7Days: boolean
  }
  payment: 'all' | 'paid' | 'unpaid'
  deposit: 'all' | 'paid' | 'none'
  costRange: { min: number; max: number }
  durationLength: { min: number; max: number }
  dateRange?: { from: string; to: string }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface HotelStats {
  totalNights: number
  totalCost: number
  freeBeds: number
  employeeTags: string[]
  allDurations: string[]
}

export interface GlobalStats {
  totalSpend: number
  freeBeds: number
  totalHotels: number
  activeEmployees: number
}

// ─── Gap Detection ────────────────────────────────────────────────────────────
// A gap is a period within a duration where a bed slot is empty.

export interface Gap {
  type: 'start' | 'end'
  availableFrom: string   // ISO date
  availableTo: string     // ISO date
  slotIndex: number
  durationId: string
  hotelId: string
  afterEmployeeId?: string
}

// ─── Export Options ───────────────────────────────────────────────────────────

export interface ExportOptions {
  format: ExportFormat
  includeFilters: boolean
  dateRange?: { from: string; to: string }
}

// ─── Pricing Calc Result ──────────────────────────────────────────────────────
// Returned by the pricing utility functions.

export interface PriceResult {
  brutto: number
  netto: number | undefined   // undefined if only brutto was provided with no MwSt
  mwst: number | undefined
  total: number               // = brutto if available, else netto, else raw calc
  nights: number
  perNight: number
}
