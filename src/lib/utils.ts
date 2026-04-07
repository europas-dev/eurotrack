export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function calculateNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return Math.max(0, diff);
}

export function getTotalBeds(roomType: string, numberOfRooms: number): number {
  const bedsPerRoom = roomType === 'EZ' ? 1 : roomType === 'DZ' ? 2 : 3;
  return bedsPerRoom * (numberOfRooms || 1);
}

export function getEmployeeStatus(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return '';
  const today = new Date().toISOString().split('T')[0];
  if (today >= checkIn && today <= checkOut) return 'active';
  if (today < checkIn) return 'upcoming';
  return 'completed';
}

export function formatCurrency(amount: number): string {
  return '€' + amount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
