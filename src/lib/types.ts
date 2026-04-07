// src/lib/types.ts

export type RoomType = 'EZ' | 'DZ' | 'TZ';
export type UserRole = 'admin' | 'editor' | 'viewer';
export type EmployeeStatus = 'active' | 'ending-soon' | 'completed' | 'upcoming';
export type Language = 'de' | 'en';
export type Theme = 'dark' | 'light';
export type SortBy = 'recent' | 'name' | 'max-duration' | 'min-duration' | 'max-cost' | 'min-cost' | 'most-booked' | 'least-booked';
export type GroupBy = 'none' | 'company' | 'city';

// Employee
export interface Employee {
  id: string;
  name: string;
  checkIn: string;  // ISO date string
  checkOut: string; // ISO date string
}

// Duration
export interface Duration {
  id: string;
  hotelId: string;
  bookingId?: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  numberOfRooms: number;
  pricePerNightPerRoom: number;
  autoDistribute: boolean;
  nightlyPrices?: Record<string, number>; // { '2026-04-01': 90, '2026-04-02': 85, ... }
  hasDiscount: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  isPaid: boolean;
  extensionNote?: string;
  employees: (Employee | null)[]; // Array based on total beds (numberOfRooms × capacity)
}

// Hotel
export interface Hotel {
  id: string;
  userId: string;
  name: string;
  city: string;
  address?: string;
  contact?: string;
  email?: string;
  webLink?: string;
  companyTag: string;
  durations: Duration[];
  createdAt: string;
  updatedAt?: string;
}

// User Profile
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  type: 'urgent' | 'warning' | 'info';
  category: 'checkout-soon' | 'gap-detected' | 'new-booking' | 'team-activity';
  message: string;
  metadata?: any;
  read: boolean;
  createdAt: string;
}

// Workspace Share
export interface WorkspaceShare {
  id: string;
  ownerId: string;
  sharedWithId: string;
  permission: UserRole;
  createdAt: string;
}

// Filter State
export interface FilterState {
  groupBy: GroupBy;
  companies: string[];
  cities: string[];
  roomTypes: RoomType[];
  freeBeds: {
    today: boolean;
    in3Days: boolean;
    in7Days: boolean;
    customDate?: string;
  };
  employeeStatus: EmployeeStatus[];
  costRange: { min: number; max: number };
  durationLength: { min: number; max: number };
  dateRange?: { from: string; to: string };
}

// Stats
export interface HotelStats {
  totalNights: number;
  totalCost: number;
  freeBeds: number;
  employeeTags: string[];
  allDurations: string[];
}

export interface GlobalStats {
  totalSpend: number;
  freeBeds: number;
  totalHotels: number;
  activeEmployees: number;
}

// Gap Detection
export interface Gap {
  type: 'start' | 'end';
  availableFrom: string;
  availableTo: string;
  slotIndex: number;
  durationId: string;
  hotelId: string;
  afterEmployeeId?: string;
}

// Export Options
export interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf' | 'docx';
  includeFilters: boolean;
  dateRange?: { from: string; to: string };
}
