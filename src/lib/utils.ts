// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format ISO date to DD Mon format
 * @example "2026-04-15" → "15 Apr"
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  return `${day} ${month}`;
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, nights);
}

/**
 * Get room capacity for room type
 */
export function getRoomCapacity(roomType: 'EZ' | 'DZ' | 'TZ'): number {
  const capacities = { EZ: 1, DZ: 2, TZ: 3 };
  return capacities[roomType] || 1;
}

/**
 * Get total beds for a duration
 */
export function getTotalBeds(roomType: 'EZ' | 'DZ' | 'TZ', numberOfRooms: number): number {
  return getRoomCapacity(roomType) * numberOfRooms;
}

/**
 * Get employee status based on dates
 */
export function getEmployeeStatus(
  checkIn: string,
  checkOut: string,
  currentDate: string = new Date().toISOString().split('T')[0]
): 'upcoming' | 'active' | 'ending-soon' | 'completed' {
  const current = new Date(currentDate);
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);

  if (current < inDate) return 'upcoming';
  if (current > outDate) return 'completed';

  const daysUntilCheckout = Math.ceil((outDate.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilCheckout <= 5 && daysUntilCheckout >= 0) return 'ending-soon';

  return 'active';
}

/**
 * Get status color classes
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'upcoming':
      return 'border-blue-500 text-blue-400';
    case 'active':
      return 'border-gray-400 text-gray-300';
    case 'ending-soon':
      return 'border-red-500 text-red-400';
    case 'completed':
      return 'border-green-500 text-green-400';
    default:
      return 'border-gray-500 text-gray-300';
  }
}

/**
 * Check if employee has start gap (late check-in)
 */
export function hasStartGap(checkIn: string, durationStart: string): boolean {
  return new Date(checkIn) > new Date(durationStart);
}

/**
 * Check if employee has end gap (early check-out)
 */
export function hasEndGap(checkOut: string, durationEnd: string): boolean {
  return new Date(checkOut) < new Date(durationEnd);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `€${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get duration color based on index
 */
export function getDurationColor(index: number): string {
  const colors = ['blue', 'purple', 'pink', 'green', 'yellow', 'red', 'indigo', 'cyan'];
  return colors[index % colors.length];
}

/**
 * Get Tailwind border color class
 */
export function getDurationBorderColor(index: number): string {
  return `border-${getDurationColor(index)}-500`;
}
