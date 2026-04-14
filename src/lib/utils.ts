// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateNights(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diffTime = e.getTime() - s.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function normalizeNumberInput(val: string): number {
  const parsed = parseFloat(val.replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDateDisplay(isoString?: string | null, lang: 'de' | 'en' = 'de'): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatDateChip(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function getEmployeeStatus(checkIn?: string | null, checkOut?: string | null): 'upcoming' | 'active' | 'ending-soon' | 'completed' | 'none' {
  if (!checkIn || !checkOut) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  
  if (outDate < today) return 'completed';
  if (inDate > today) return 'upcoming';
  
  const diffDays = Math.ceil((outDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'ending-soon';
  return 'active';
}

export function calcDurationFreeBeds(duration: any, targetDateIso: string): number {
  if (!duration.startDate || !duration.endDate || !duration.roomCards) return 0;
  const targetDate = new Date(targetDateIso);
  const durEnd = new Date(duration.endDate);
  
  // If the duration is already expired, there are no "free beds" for today/future
  if (targetDate > durEnd) return 0;

  let totalBeds = 0;
  let occupiedBeds = 0;

  duration.roomCards.forEach((rc: any) => {
    const bedCount = rc.roomType === 'EZ' ? 1 : rc.roomType === 'DZ' ? 2 : rc.roomType === 'TZ' ? 3 : (rc.bedCount || 2);
    totalBeds += bedCount;
    
    const emps = rc.employees || [];
    emps.forEach((emp: any) => {
      if (!emp.checkIn || !emp.checkOut) return;
      const inDate = new Date(emp.checkIn);
      const outDate = new Date(emp.checkOut);
      // Occupied if target date is within checkIn and checkOut
      if (targetDate >= inDate && targetDate < outDate) {
        occupiedBeds += 1;
      }
    });
  });

  return Math.max(0, totalBeds - occupiedBeds);
}

export function hotelMatchesSearch(hotel: any, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  
  const hName = hotel.name?.toLowerCase() || '';
  const hCity = hotel.city?.toLowerCase() || '';
  const tags = Array.isArray(hotel.companyTag) ? hotel.companyTag.join(' ').toLowerCase() : (hotel.companyTag?.toLowerCase() || '');
  
  let match = hName.includes(q) || hCity.includes(q) || tags.includes(q);
  if (match) return true;

  for (const d of (hotel.durations || [])) {
    if (d.rechnungNr?.toLowerCase().includes(q)) return true;
    if (d.bookingId?.toLowerCase().includes(q)) return true;
    for (const rc of (d.roomCards || [])) {
      for (const emp of (rc.employees || [])) {
        if (emp.name?.toLowerCase().includes(q)) return true;
      }
    }
  }
  return false;
}

export function getDurationCostForMonth(d: any, targetYear: number, targetMonthIndex: number): number {
  if (!d.startDate || !d.endDate) return 0;
  const s = new Date(d.startDate);
  const e = new Date(d.endDate);
  const mStart = new Date(targetYear, targetMonthIndex, 1);
  const mEnd = new Date(targetYear, targetMonthIndex + 1, 0);

  if (e < mStart || s > mEnd) return 0;

  const overlapStart = s < mStart ? mStart : s;
  const overlapEnd = e > mEnd ? mEnd : e;
  
  const totalNights = calculateNights(d.startDate, d.endDate);
  if (totalNights <= 0) return 0;
  
  const overlapNights = calculateNights(overlapStart.toISOString().split('T')[0], overlapEnd.toISOString().split('T')[0]);
  if (overlapNights <= 0) return 0;

  // Calculate full cost of duration
  const rcTotal = (d.roomCards || []).reduce((sum: number, c: any) => sum + (c.roomBrutto || c.totalBrutto || 0), 0);
  const exTotal = (d.extraCosts || []).reduce((sum: number, ex: any) => sum + (Number(ex.amount) || 0), 0);
  let total = d.useBruttoNetto ? (d.brutto || 0) : rcTotal;
  total += exTotal;
  if (!d.useBruttoNetto && d.hasDiscount && d.discountValue) {
    total = d.discountType === 'fixed' ? total - d.discountValue : total * (1 - d.discountValue / 100);
  }
  
  // Pro-rate the cost based on nights overlapping this month
  return (total / totalNights) * overlapNights;
}

export function getDurationTabLabel(d: any, lang: 'de' | 'en'): string {
  if (d.startDate && d.endDate) return `${formatDateChip(d.startDate)} – ${formatDateChip(d.endDate)}`;
  return lang === 'de' ? 'Neue Dauer' : 'New Duration';
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT & PRINT FUNCTIONS (WYSIWYG)
// ─────────────────────────────────────────────────────────────────────────────

function buildReportData(hotels: any[], calcCost: (h: any) => number, lang: 'de' | 'en') {
  return hotels.map(h => {
    const company = Array.isArray(h.companyTag) ? h.companyTag.join(', ') : (h.companyTag || '—');
    const invoice = (h.durations || []).map((d: any) => d.rechnungNr).filter(Boolean).join(', ') || '—';
    const dates = (h.durations || []).map((d: any) => d.startDate && d.endDate ? `${formatDateChip(d.startDate)} - ${formatDateChip(d.endDate)}` : '').filter(Boolean).join(', ') || '—';
    const employees = (h.durations || []).flatMap((d: any) => (d.roomCards || []).flatMap((rc: any) => (rc.employees || []).map((e: any) => e.name))).filter(Boolean).join(', ') || '—';
    const cost = formatCurrency(calcCost(h));
    
    // Status Logic
    const isFullyPaid = h.durations?.length > 0 && h.durations.every((d: any) => d.isPaid);
    const hasUnpaid = h.durations?.some((d: any) => !d.isPaid);
    const status = isFullyPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : hasUnpaid ? (lang === 'de' ? 'Offen' : 'Unpaid') : '—';

    // Deposit Logic
    const hasDeposit = h.durations?.some((d: any) => d.depositEnabled);
    const depositAmount = (h.durations || []).reduce((sum: number, d: any) => sum + (d.depositEnabled ? (Number(d.depositAmount) || 0) : 0), 0);
    const depositStr = hasDeposit ? formatCurrency(depositAmount) : '—';

    return {
      hotel: h.name || '—',
      city: h.city || '—',
      company,
      contact: h.contactPerson || '—',
      address: h.address || '—',
      phone: h.phone || '—',
      invoice,
      dates,
      employees,
      cost,
      status,
      depositStr,
      hasDeposit
    };
  });
}

export function exportToCSV(hotels: any[], calcCost: (h: any) => number, grandTotal: number, reportTitle: string, lang: 'de' | 'en') {
  const data = buildReportData(hotels, calcCost, lang);
  const showDeposit = data.some(d => d.hasDeposit);

  let headers = ['Hotel', 'City', 'Company', 'Contact', 'Address', 'Phone', 'Invoice No.', 'Durations', 'Employees', 'Status', 'Total Cost'];
  if (showDeposit) headers.push('Deposit');

  const rows = data.map(d => {
    const row = [d.hotel, d.city, d.company, d.contact, d.address, d.phone, d.invoice, d.dates, d.employees, d.status, d.cost];
    if (showDeposit) row.push(d.depositStr);
    return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  // Grand Total Row
  const totalRow = Array(headers.length).fill('""');
  totalRow[headers.length - 2] = `"GRAND TOTAL"`;
  totalRow[headers.length - 1] = `"${formatCurrency(grandTotal)}"`;
  rows.push(totalRow.join(','));

  const csvContent = headers.map(h => `"${h}"`).join(',') + '\n' + rows.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF ensures UTF-8 BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Europas_GmbH_Report_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printDocument(hotels: any[], calcCost: (h: any) => number, grandTotal: number, reportTitle: string, lang: 'de' | 'en') {
  const data = buildReportData(hotels, calcCost, lang);
  const showDeposit = data.some(d => d.hasDeposit);
  const dateStr = new Date().toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  let html = `
    <html>
      <head>
        <title>Europas GmbH Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; padding: 20px; font-size: 11px; }
          .header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: 900; margin: 0 0 5px 0; }
          .subtitle { font-size: 12px; color: #4B5563; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
          th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; vertical-align: top; word-wrap: break-word; }
          th { background-color: #F9FAFB; font-weight: bold; text-transform: uppercase; font-size: 10px; }
          .grand-total { font-size: 14px; font-weight: 900; text-align: right; margin-top: 20px; border-top: 2px solid #111827; padding-top: 10px; }
          .footer { margin-top: 40px; font-size: 9px; color: #6B7280; text-align: center; }
          @media print { body { padding: 0; } @page { size: landscape; margin: 1cm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Europas GmbH</h1>
          <p class="subtitle">${reportTitle}</p>
          <p class="subtitle">Generated on: ${dateStr}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Hotel Name</th>
              <th style="width: 8%;">City</th>
              <th style="width: 8%;">Company</th>
              <th style="width: 10%;">Contact</th>
              <th style="width: 10%;">Phone</th>
              <th style="width: 12%;">Invoice No.</th>
              <th style="width: 10%;">Durations</th>
              <th style="width: 15%;">Employees</th>
              <th style="width: 7%;">Status</th>
              <th style="width: 8%;">Cost</th>
              ${showDeposit ? '<th style="width: 8%;">Deposit</th>' : ''}
            </tr>
          </thead>
          <tbody>
  `;

  data.forEach(d => {
    html += `<tr>
      <td><strong>${d.hotel}</strong></td>
      <td>${d.city}</td>
      <td>${d.company}</td>
      <td>${d.contact}<br><span style="font-size:9px; color:#6B7280">${d.address}</span></td>
      <td>${d.phone}</td>
      <td>${d.invoice}</td>
      <td>${d.dates}</td>
      <td>${d.employees}</td>
      <td><strong>${d.status}</strong></td>
      <td><strong>${d.cost}</strong></td>
      ${showDeposit ? `<td>${d.depositStr}</td>` : ''}
    </tr>`;
  });

  html += `
          </tbody>
        </table>
        <div class="grand-total">
          GRAND TOTAL: ${formatCurrency(grandTotal)}
        </div>
        <div class="footer">
          Report securely generated by Europas GmbH Management System.
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // Tiny delay ensures styles load before print dialog opens
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  }
}
