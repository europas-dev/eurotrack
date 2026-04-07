
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind class merger - THIS WAS MISSING!
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add any other utility functions you had below...

// src/utils.ts
import { RoomType, Employee, Duration } from './types';

// Date utilities
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  return `${day} ${month}`;
}

export function calculateNights(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function getRoomCapacity(roomType: RoomType): number {
  return { EZ: 1, DZ: 2, TZ: 3 }[roomType];
}

// Employee status
export function getEmployeeStatus(checkIn: string, checkOut: string, today: string) {
  const current = new Date(today);
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  
  if (current < inDate) return 'upcoming';
  if (current > outDate) return 'completed';
  
  const daysUntilCheckout = Math.ceil((outDate.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilCheckout <= 5) return 'ending-soon';
  
  return 'active';
}

export function hasGap(employee: Employee, durationEnd: string): boolean {
  return new Date(employee.checkOut) < new Date(durationEnd);
}

// Duration color
export function getDurationColor(index: number): string {
  const colors = ['blue', 'purple', 'pink', 'green', 'yellow', 'red', 'indigo', 'cyan'];
  return colors[index % colors.length];
}

// Export functions (we'll add Excel, PDF, etc. libraries later)
export async function exportToExcel(data: any) {
  // TODO: Implement with xlsx library
  console.log('Export to Excel:', data);
}

export async function exportToPDF(data: any) {
  // TODO: Implement with jspdf library
  console.log('Export to PDF:', data);
}

export async function exportToCSV(data: any) {
  // TODO: Implement CSV export
  console.log('Export to CSV:', data);
}
