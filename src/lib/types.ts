// src/lib/types.ts

export type RoomType = 'EZ' | 'DZ' | 'TZ' | 'WG';
export type UserRole = 'admin' | 'editor' | 'viewer';
export type EmployeeStatus = 'active' | 'ending-soon' | 'completed' | 'upcoming' | 'unknown';
export type Language = 'de' | 'en';
export type Theme = 'dark' | 'light';
export type GroupBy = 'none' | 'company' | 'city';
export type SortBy = 'name' | 'city' | 'cost' | 'nights';
export type FreeBedFilter = 'none' | 'today' | 'tomorrow' | 'in5days' | 'in7days' | 'custom';
export type PaidFilter = 'all' | 'paid' | 'unpaid';
export type DepositFilter = 'all' | 'deposit-paid' | 'no-deposit';
export type SyncStatus = 'saved' | 'saving' | 'pending' | 'failed' | 'offline';

export interface Employee {
  id: string;
  name: string;
  checkIn: string;
  checkOut: string;
  durationId?: string;
  slotIndex?: number;
}

export interface Duration {
  id: string;
  hotelId: string;
  invoiceNo?: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  numberOfRooms: number;
  wgBeds?: number;
  pricePerNightPerRoom: number;
  totalPriceOverride?: number;
  useManualPrices?: boolean;
  nightlyPrices?: Record<string, number>;
  nettoPrice?: number;
  bruttoPrice?: number;
  mwst?: number;
  hasDiscount: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  isPaid: boolean;
  hasDeposit?: boolean;
  depositAmount?: number;
  bookingId?: string;
  roomNo?: string;
  floor?: string;
  employees: (Employee | null)[];
}

export interface Hotel {
  id: string;
  userId?: string;
  name: string;
  city: string;
  companyTag: string;
  address?: string;
  contactPerson?: string;
  contact?: string;
  email?: string;
  webLink?: string;
  notes?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  durations: Duration[];
  createdAt?: string;
}

export interface OfflineQueueItem {
  id: string;
  type:
    | 'updateHotel' | 'createHotel' | 'deleteHotel'
    | 'updateDuration' | 'createDuration' | 'deleteDuration'
    | 'createEmployee' | 'updateEmployee' | 'deleteEmployee';
  payload: any;
  timestamp: number;
}
