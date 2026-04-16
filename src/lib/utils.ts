// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { calcRoomCardTotal } from './roomCardUtils'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateNights(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diffTime = e.getTime() - s.getTime();
  // Using Math.round prevents daylight saving time errors (23 or 25 hour days)
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * NEW: Calculates exactly how many nights of a booking fall within a specific boundary.
 */
export function getOverlappingNights(bookingStart: string, bookingEnd: string, filterStart: string, filterEnd: string): number {
  const bStart = new Date(bookingStart).getTime();
  const bEnd = new Date(bookingEnd).getTime();
  const fStart = new Date(filterStart).getTime();
  const fEnd = new Date(filterEnd).getTime();

  const overlapStart = Math.max(bStart, fStart);
  const overlapEnd = Math.min(bEnd, fEnd);

  if (overlapStart >= overlapEnd) return 0;
  return Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
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

export function formatLastUpdated(name?: string, dateIso?: string, lang: 'de' | 'en' = 'de'): string {
  const uName = name || 'Admin';
  if (!dateIso) return lang === 'de' ? `Zuletzt aktualisiert von ${uName}` : `Last updated by ${uName}`;
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return lang === 'de' ? `Zuletzt aktualisiert von ${uName}` : `Last updated by ${uName}`;
  const dateStr = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return lang === 'de' ? `Zuletzt aktualisiert von ${uName} am ${dateStr} um ${timeStr}` : `Last updated by ${uName} on ${dateStr} at ${timeStr}`;
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
      if (targetDate >= inDate && targetDate < outDate) {
        occupiedBeds += 1;
      }
    });
  });

  return Math.max(0, totalBeds - occupiedBeds);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADED MASTER MATH FUNCTIONS (Date-Boundary Aware)
// ─────────────────────────────────────────────────────────────────────────────

export function calcHotelTotalCost(hotel: any, selectedMonth?: number | null, selectedYear?: number | null): number {
  let tCost = 0;
  let filterStart: string | null = null;
  let filterEnd: string | null = null;

  // Build strict UTC timezone-safe date strings for boundaries
  if (selectedYear !== null && selectedYear !== undefined) {
    if (selectedMonth !== null && selectedMonth !== undefined) {
      const y = selectedYear;
      const m = selectedMonth + 1; // JS months are 0-indexed
      const lastDay = new Date(y, m, 0).getDate();
      filterStart = `${y}-${String(m).padStart(2, '0')}-01`;
      filterEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      filterStart = `${selectedYear}-01-01`;
      filterEnd = `${selectedYear}-12-31`;
    }
  }

  (hotel.durations || []).forEach((d: any) => {
    if (!d.startDate || !d.endDate) return;

    const totalDurationNights = calculateNights(d.startDate, d.endDate);
    if (totalDurationNights <= 0) return;

    let overlapNights = totalDurationNights;
    
    if (filterStart && filterEnd) {
      overlapNights = getOverlappingNights(d.startDate, d.endDate, filterStart, filterEnd);
    }

    if (overlapNights <= 0) return;

    const rCards = d.roomCards || [];
    const extraTotal = (d.extraCosts || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    
    let bruttoBase = d.useBruttoNetto ? (d.brutto || 0) : rCards.reduce((s: number, c: any) => {
      return s + calcRoomCardTotal(c, d.startDate, d.endDate);
    }, 0);
    
    bruttoBase += extraTotal;
    
    if (!d.useBruttoNetto && d.hasDiscount && d.discountValue) {
      bruttoBase = d.discountType === 'fixed' ? bruttoBase - d.discountValue : bruttoBase * (1 - d.discountValue / 100);
    }

    // Apply strict proportional cost if filters are active, otherwise add whole duration cost
    if (filterStart && filterEnd) {
      const dailyRate = bruttoBase / totalDurationNights;
      tCost += Math.max(0, dailyRate * overlapNights);
    } else {
      tCost += Math.max(0, bruttoBase);
    }
  });

  return tCost;
}

export function calcHotelFreeBedsToday(hotel: any): number {
  const today = new Date().toISOString().split('T')[0];
  return (hotel.durations || []).reduce((total: number, d: any) => {
    return total + calcDurationFreeBeds(d, today);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────

export function hotelMatchesSearch(hotel: any, query: string, scope: string = 'all'): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  
  // Normalize scope to avoid exact-match errors
  const s = scope.toLowerCase();

  // 1. MATCH: HOTEL NAME
  if (s.includes('hotel') || s.includes('name')) {
    return (hotel.name?.toLowerCase() || '').includes(q);
  }

  // 2. MATCH: CITY
  if (s.includes('city') || s.includes('stadt')) {
    return (hotel.city?.toLowerCase() || '').includes(q);
  }

  // 3. MATCH: COMPANY
  if (s.includes('company') || s.includes('firma')) {
    const tags = Array.isArray(hotel.companyTag) ? hotel.companyTag.join(' ').toLowerCase() : (hotel.companyTag?.toLowerCase() || '');
    return tags.includes(q);
  }

  // 4. MATCH: INVOICE NO
  if (s.includes('invoice') || s.includes('rechnung')) {
    for (const d of (hotel.durations || [])) {
      if (d.rechnungNr?.toLowerCase().includes(q)) return true;
    }
    return false;
  }

  // 5. MATCH: EMPLOYEES
  if (s.includes('employee') || s.includes('mitarbeiter')) {
    for (const d of (hotel.durations || [])) {
      for (const rc of (d.roomCards || [])) {
        for (const emp of (rc.employees || [])) {
          if (emp.name?.toLowerCase().includes(q)) return true;
        }
      }
    }
    return false;
  }

  // DEFAULT: 'ALL' SCOPE (If no specific scope matched, check everything)
  const hName = hotel.name?.toLowerCase() || '';
  const hCity = hotel.city?.toLowerCase() || '';
  const tags = Array.isArray(hotel.companyTag) ? hotel.companyTag.join(' ').toLowerCase() : (hotel.companyTag?.toLowerCase() || '');
  
  if (hName.includes(q) || hCity.includes(q) || tags.includes(q)) return true;

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
  
  const y = targetYear;
  const m = targetMonthIndex + 1;
  const lastDay = new Date(y, m, 0).getDate();
  const mStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const mEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const totalNights = calculateNights(d.startDate, d.endDate);
  if (totalNights <= 0) return 0;
  
  const overlapNights = getOverlappingNights(d.startDate, d.endDate, mStart, mEnd);
  if (overlapNights <= 0) return 0;

  const rCards = d.roomCards || [];
  const extraTotal = (d.extraCosts || []).reduce((sum: number, ex: any) => sum + (Number(ex.amount) || 0), 0);
  
  let bruttoBase = d.useBruttoNetto ? (d.brutto || 0) : rCards.reduce((s: number, c: any) => {
    return s + calcRoomCardTotal(c, d.startDate, d.endDate);
  }, 0);
  
  bruttoBase += extraTotal;
  
  if (!d.useBruttoNetto && d.hasDiscount && d.discountValue) {
    bruttoBase = d.discountType === 'fixed' ? bruttoBase - d.discountValue : bruttoBase * (1 - d.discountValue / 100);
  }
  
  return (bruttoBase / totalNights) * overlapNights;
}

export function getDurationTabLabel(d: any, lang: 'de' | 'en'): string {
  if (d.startDate && d.endDate) return `${formatDateChip(d.startDate)} – ${formatDateChip(d.endDate)}`;
  return lang === 'de' ? 'Neue Dauer' : 'New Duration';
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT & PRINT FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function buildReportData(hotels: any[], calcCost: (h: any) => number, lang: 'de' | 'en') {
  return hotels.map(h => {
    const company = Array.isArray(h.companyTag) ? h.companyTag.join(', ') : (h.companyTag || '—');
    const invoice = (h.durations || []).map((d: any) => d.rechnungNr).filter(Boolean).join(', ') || '—';
    const dates = (h.durations || []).map((d: any) => d.startDate && d.endDate ? `${formatDateChip(d.startDate)} - ${formatDateChip(d.endDate)}` : '').filter(Boolean).join(', ') || '—';
    const employees = (h.durations || []).flatMap((d: any) => (d.roomCards || []).flatMap((rc: any) => (rc.employees || []).map((e: any) => e.name))).filter(Boolean).join(', ') || '—';
    const cost = formatCurrency(calcCost(h));
    
    const isFullyPaid = h.durations?.length > 0 && h.durations.every((d: any) => d.isPaid);
    const hasUnpaid = h.durations?.some((d: any) => !d.isPaid);
    const status = isFullyPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : hasUnpaid ? (lang === 'de' ? 'Offen' : 'Unpaid') : '—';

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
  const isDe = lang === 'de';

  let headers = isDe 
    ? ['Hotelname', 'Stadt', 'Firma', 'Kontakt', 'Adresse', 'Telefon', 'Rechnungsnr.', 'Zeitraum', 'Mitarbeiter', 'Status', 'Gesamtkosten']
    : ['Hotel Name', 'City', 'Company', 'Contact', 'Address', 'Phone', 'Invoice No.', 'Durations', 'Employees', 'Status', 'Total Cost'];
  
  if (showDeposit) headers.push(isDe ? 'Kaution' : 'Deposit');

  const rows = data.map(d => {
    const row = [d.hotel, d.city, d.company, d.contact, d.address, d.phone, d.invoice, d.dates, d.employees, d.status, d.cost];
    if (showDeposit) row.push(d.depositStr);
    return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const totalRow = Array(headers.length).fill('""');
  totalRow[headers.length - 2] = isDe ? `"GESAMTSUMME"` : `"GRAND TOTAL"`;
  totalRow[headers.length - 1] = `"${formatCurrency(grandTotal)}"`;
  rows.push(totalRow.join(','));

  const csvContent = headers.map(h => `"${h}"`).join(',') + '\n' + rows.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
  const isDe = lang === 'de';

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
          <p class="subtitle">${isDe ? 'Erstellt am:' : 'Generated on:'} ${dateStr}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">${isDe ? 'Hotelname' : 'Hotel Name'}</th>
              <th style="width: 8%;">${isDe ? 'Stadt' : 'City'}</th>
              <th style="width: 8%;">${isDe ? 'Firma' : 'Company'}</th>
              <th style="width: 10%;">${isDe ? 'Kontakt' : 'Contact'}</th>
              <th style="width: 10%;">${isDe ? 'Telefon' : 'Phone'}</th>
              <th style="width: 12%;">${isDe ? 'Rechnungsnr.' : 'Invoice No.'}</th>
              <th style="width: 10%;">${isDe ? 'Zeitraum' : 'Durations'}</th>
              <th style="width: 15%;">${isDe ? 'Mitarbeiter' : 'Employees'}</th>
              <th style="width: 7%;">Status</th>
              <th style="width: 8%;">${isDe ? 'Kosten' : 'Cost'}</th>
              ${showDeposit ? `<th style="width: 8%;">${isDe ? 'Kaution' : 'Deposit'}</th>` : ''}
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
          ${isDe ? 'GESAMTSUMME' : 'GRAND TOTAL'}: ${formatCurrency(grandTotal)}
        </div>
        <div class="footer">
          ${isDe ? 'Bericht sicher generiert von der Europas GmbH Management Software.' : 'Report securely generated by Europas GmbH Management System.'}
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
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  }
}
