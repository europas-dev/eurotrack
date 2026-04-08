export type Theme = 'dark' | 'light';
export type Language = 'de' | 'en';
export type RoomType = 'EZ' | 'DZ' | 'TZ' | 'WG';
export type DiscountType = 'percentage' | 'fixed';
export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';

export interface Employee {
  id: string;
  durationId: string;
  slotIndex: number;
  name: string;
  checkIn: string | null;
  checkOut: string | null;
}

export interface RoomCard {
  id: string;
  durationId: string;
  roomType: RoomType;
  roomNumber: string;
  floor: string;
  beds: number; // only used for WG
}

export interface Duration {
  id: string;
  hotelId: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  numberOfRooms: number;
  pricePerNightPerRoom: number;
  totalPrice?: number | null;
  useManualPrices: boolean;
  nightlyPrices: Record<string, number>;
  hasDiscount: boolean;
  discountType: DiscountType;
  discountValue: number;
  isPaid: boolean;
  invoiceNumber: string;
  depositEnabled: boolean;
  depositAmount: number;
  bookingId: string;
  nettoPrice?: number | null;
  bruttoPrice?: number | null;
  mwst?: number | null;
  extensionNote: string;
  autoDistribute: boolean;
  employees: (Employee | null)[];
  roomCards: RoomCard[];
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  companyTag: string;
  address: string;
  contact: string;
  contactPerson: string;
  email: string;
  webLink: string;
  notes: string;
  durations: Duration[];
  updatedAt?: string;
  updatedBy?: string;
  createdAt?: string;
}
