// src/lib/types.ts

export type RoomType = 'EZ' | 'DZ' | 'TZ';
export type UserRole = 'admin' | 'editor' | 'viewer';
export type CollaboratorPermission = 'viewer' | 'editor';
export type EmployeeStatus = 'active' | 'ending-soon' | 'completed' | 'upcoming';
export type Language = 'de' | 'en';
export type Theme = 'dark' | 'light';
export type ThemePreference = 'light' | 'dark' | 'system';
export type GroupBy = 'none' | 'company' | 'city';

export interface Employee {
  id: string;
  durationId?: string;
  slotIndex?: number;
  name: string;
  checkIn: string;
  checkOut: string;
}

export interface Duration {
  id: string;
  hotelId: string;
  bookingId?: string | null;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  numberOfRooms: number;
  pricePerNightPerRoom: number;
  autoDistribute?: boolean;
  useManualPrices?: boolean;
  nightlyPrices?: Record<string, number>;
  hasDiscount: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  isPaid: boolean;
  extensionNote?: string;
  employees: (Employee | null)[];
}

export interface HotelCollaborator {
  id: string;
  hotelId: string;
  ownerId: string;
  sharedWithId: string;
  permission: CollaboratorPermission;
  createdAt: string;
  profile?: UserProfile | null;
}

export interface Hotel {
  id: string;
  userId: string;
  name: string;
  city: string;
  address?: string | null;
  contact?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  webLink?: string | null;
  notes?: string | null;
  companyTag: string;
  durations: Duration[];
  collaborators?: HotelCollaborator[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  fullName?: string | null;
  role?: UserRole;
  fontFamily?: string;
  fontScale?: number;
  themePreference?: ThemePreference;
  createdAt?: string;
}

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

export interface WorkspaceShare {
  id: string;
  ownerId: string;
  sharedWithId: string;
  permission: CollaboratorPermission;
  createdAt: string;
}

export interface Gap {
  type: 'start' | 'end';
  availableFrom: string;
  availableTo: string;
  slotIndex: number;
  durationId: string;
  hotelId: string;
  afterEmployeeId?: string;
}

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

export interface AppSettings {
  themePreference: ThemePreference;
  fontFamily: string;
  fontScale: number;
}
