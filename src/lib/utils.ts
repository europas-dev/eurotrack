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
 * Calculates exactly how many nights of a booking fall within a specific boundary.
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
// UPGRADED MASTER MATH ENGINE (Unified with HotelRow logic)
// ─────────────────────────────────────────────────────────────────────────────

export function calcHotelTotalCost(hotel: any, selectedMonth?: number | null, selectedYear?: number | null): number {
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

  let totalNightsAll = 0;
  let overlapNightsAll = 0;
  let sumDurationBrutto = 0;
  let sumDurationNetto = 0;

  (hotel.durations || []).forEach((d: any) => {
    if (!d.startDate || !d.endDate) return;

    const dNights = calculateNights(d.startDate, d.endDate);
    if (dNights <= 0) return;

    totalNightsAll += dNights;

    if (filterStart && filterEnd) {
      overlapNightsAll += getOverlappingNights(d.startDate, d.endDate, filterStart, filterEnd);
    } else {
      overlapNightsAll += dNights;
    }

    const rCards = d.roomCards || [];
    sumDurationBrutto += rCards.reduce((s: number, c: any) => s + calcRoomCardTotal(c, d.startDate, d.endDate), 0);
    
    // Rough netto aggregation for percentage ratio scaling
    sumDurationNetto += rCards.reduce((s: number, c: any) => s + ((parseFloat(c.bedNetto) || 0) * dNights), 0); 
  });

  // 1. Base Costs (Master Invoice)
  const baseCosts = hotel.baseCosts || hotel.base_costs || [];
  let isMasterActive = baseCosts.some((bc: any) => bc.netto != null || bc.brutto != null);
  let bBruttoTotal = 0;
  let bNettoTotal = 0;

  baseCosts.forEach((bc: any) => {
    let bBrutto = 0;
    let bNetto = 0;
    let bMwSt = bc.mwst != null ? parseFloat(bc.mwst) : null;
    let isMwstValid = bMwSt !== null && !isNaN(bMwSt);

    if (bc.netto != null) {
        bNetto = parseFloat(bc.netto);
        let discountedNetto = bNetto;
        if (bc.discountValue) {
            const dVal = parseFloat(bc.discountValue);
            discountedNetto = bc.discountType === 'fixed' ? Math.max(0, bNetto - dVal) : Math.max(0, bNetto * (1 - dVal/100));
        }
        bBrutto = isMwstValid ? discountedNetto * (1 + bMwSt/100) : discountedNetto;
    } else if (bc.brutto != null) {
        bBrutto = parseFloat(bc.brutto);
        if (isMwstValid) bNetto = bBrutto / (1 + bMwSt/100);
    }
    bBruttoTotal += bBrutto;
    bNettoTotal += bNetto;
  });

  // 2. Extra Costs
  let eBruttoTotal = 0;
  let eNettoTotal = 0;
  const extraCosts = hotel.extraCosts || hotel.extra_costs || [];
  extraCosts.forEach((ec: any) => {
     if (ec.brutto != null) {
       eBruttoTotal += parseFloat(ec.brutto);
       let eMwst = ec.mwst != null ? parseFloat(ec.mwst) : 0;
       eNettoTotal += parseFloat(ec.brutto) / (1 + eMwst/100);
     } else if (ec.netto != null) {
       let eNetto = parseFloat(ec.netto);
       let eMwst = ec.mwst != null ? parseFloat(ec.mwst) : 0;
       eBruttoTotal += eNetto * (1 + eMwst/100);
       eNettoTotal += eNetto;
     }
  });

  // 3. Pre-Global Totals
  let preGlobalBrutto = (isMasterActive ? bBruttoTotal : sumDurationBrutto) + eBruttoTotal;
  let preGlobalNetto = (isMasterActive ? bNettoTotal : sumDurationNetto) + eNettoTotal;
  
  let finalBrutto = preGlobalBrutto;

  // 4. Global Discount
  const hasGD = hotel.has_global_discount ?? hotel.hasGlobalDiscount;
  if (hasGD) {
     const gVal = parseFloat(hotel.global_discount_value ?? hotel.globalDiscountValue);
     const isFixed = (hotel.global_discount_type ?? hotel.globalDiscountType) === 'fixed';
     const target = (hotel.global_discount_target ?? hotel.globalDiscountTarget) || 'netto';
     
     if (gVal) {
         if (target === 'netto') {
            let ratio = isFixed ? (gVal / (preGlobalNetto || 1)) : (gVal / 100);
            if (!isFinite(ratio)) ratio = 0;
            finalBrutto = Math.max(0, preGlobalBrutto * (1 - ratio));
         } else {
            finalBrutto = Math.max(0, preGlobalBrutto - (isFixed ? gVal : preGlobalBrutto * (gVal/100)));
         }
     }
  }

  // 5. Hard Brutto Override
  const override = hotel.override_total_brutto ?? hotel.overrideTotalBrutto;
  if (override != null) {
      finalBrutto = parseFloat(override);
  }

  // 6. Proportional scaling by overlapping dates (if filtering by Month/Timeline)
  if (filterStart && filterEnd) {
      if (totalNightsAll <= 0) return 0;
      return (finalBrutto / totalNightsAll) * overlapNightsAll;
  }

  return finalBrutto;
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
// EXPORT FUNCTIONS (Professional)
// ─────────────────────────────────────────────────────────────────────────────
// src/lib/utils.ts - Final Polished Export Section
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function fmtDateFull(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function buildReportData(hotels: any[], calcCost: (h: any) => number, lang: 'de' | 'en') {
  return hotels.map(h => {
    const isDe = lang === 'de';
    const dates = (h.durations || []).map((d: any) => 
      d.startDate && d.endDate ? `${fmtDateFull(d.startDate)} - ${fmtDateFull(d.endDate)}` : ''
    ).filter(Boolean).join(', '); 

    const employees = (h.durations || []).flatMap((d: any) => 
      (d.roomCards || []).flatMap((rc: any) => (rc.employees || []).map((e: any) => e.name))
    ).filter(Boolean).join(', ');

    return {
      hotel: h.name || '—',
      company: Array.isArray(h.companyTag) ? h.companyTag.join(', ') : (h.companyTag || '—'),
      city: h.city || '—',
      address: h.address || '—',
      contact: h.contactPerson || h.contactperson || '—',
      // FIX: Force phone number to string to preserve country codes (+49 etc.)
      phone: h.phone ? String(h.phone) : '—',
      invoice: h.rechnungNr || h.rechnung_nr || '—',
      dates: dates || '—',
      employees: employees || '—',
      cost: (calcCost(h) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
      status: (h.isPaid || h.is_paid) ? (isDe ? 'Bezahlt' : 'Paid') : (isDe ? 'Offen' : 'Unpaid'),
      deposit: h.depositEnabled ? (Number(h.depositAmount) > 0 ? (Number(h.depositAmount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })) : (isDe ? 'Ja' : 'Yes')) : (isDe ? 'Nein' : 'No')
    };
  });
}

export function generatePDF(data: any[], activeCols: string[], title: string, lang: 'de' | 'en', grandTotal: number) {
  const isDe = lang === 'de';
  const doc = new jsPDF('l', 'pt', 'a4');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Europas GmbH", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${isDe ? 'Zeitraum' : 'Period'}: ${title.replace('Period: ', '')}`, 40, 55);

  doc.setFont("helvetica", "bold");
  doc.text(isDe ? "Gesamtkosten" : "Total Cost", doc.internal.pageSize.width - 40, 40, { align: 'right' });
  doc.setFontSize(15);
  doc.text(grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), doc.internal.pageSize.width - 40, 58, { align: 'right' });

  const columns = [{ header: isDe ? 'Hotelname' : 'Hotel Name', dataKey: 'hotel' }];
  if (activeCols.includes('company')) columns.push({ header: isDe ? 'Firma' : 'Company', dataKey: 'company' });
  if (activeCols.includes('city')) columns.push({ header: isDe ? 'Stadt' : 'City', dataKey: 'city' });
  if (activeCols.includes('address')) columns.push({ header: isDe ? 'Adresse' : 'Address', dataKey: 'address' });
  if (activeCols.includes('contact')) columns.push({ header: isDe ? 'Kontakt' : 'Contact', dataKey: 'contact' });
  if (activeCols.includes('phone')) columns.push({ header: isDe ? 'Telefon' : 'Phone', dataKey: 'phone' });
  if (activeCols.includes('invoice')) columns.push({ header: isDe ? 'Rechnungsnr.' : 'Invoice No', dataKey: 'invoice' });
  if (activeCols.includes('durations')) columns.push({ header: isDe ? 'Zeitraum' : 'Durations', dataKey: 'dates' });
  if (activeCols.includes('employees')) columns.push({ header: isDe ? 'Mitarbeiter' : 'Employees', dataKey: 'employees' });
  columns.push({ header: isDe ? 'Kosten' : 'Cost', dataKey: 'cost' });
  if (activeCols.includes('status')) columns.push({ header: 'Status', dataKey: 'status' });
  if (activeCols.includes('deposit')) columns.push({ header: isDe ? 'Kaution' : 'Deposit', dataKey: 'deposit' });

  autoTable(doc, {
    columns,
    body: data,
    startY: 80,
    theme: 'grid',
    styles: { fontSize: 9, font: "helvetica", cellPadding: 4, overflow: 'linebreak', lineColor: [180,180,180], lineWidth: 0.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
    columnStyles: {
      hotel: { cellWidth: 90 },
      address: { cellWidth: 110 },   // FIX: Reduced address width slightly
      contact: { cellWidth: 85 },    // FIX: Increased contact width for better wrapping
      invoice: { cellWidth: 65 },
      dates: { cellWidth: 110 },
      employees: { cellWidth: 'auto' },
      cost: { fontStyle: 'bold', halign: 'right', cellWidth: 70 }
    },
    didDrawPage: (d) => {
      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
      doc.setFontSize(8);
      doc.text(`${isDe ? 'Erstellt am' : 'Generated on'}: ${timestamp}`, 40, doc.internal.pageSize.height - 20);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 20, { align: 'right' });
    }
  });
  return doc;
}

export function generateExcel(data: any[], activeCols: string[], lang: 'de' | 'en', period: string, grandTotal: number) {
  const isDe = lang === 'de';
  const now = new Date();
  const timestamp = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

  const rows = [
    ["Europas GmbH"],
    [`${isDe ? 'Zeitraum' : 'Period'}: ${period.replace('Period: ', '')}`],
    [`${isDe ? 'Erstellt am' : 'Generated on'}: ${timestamp}`],
    []
  ];

  const headers = [isDe ? 'Hotelname' : 'Hotel Name'];
  if (activeCols.includes('company')) headers.push(isDe ? 'Firma' : 'Company');
  if (activeCols.includes('city')) headers.push(isDe ? 'Stadt' : 'City');
  if (activeCols.includes('address')) headers.push(isDe ? 'Adresse' : 'Address');
  if (activeCols.includes('contact')) headers.push(isDe ? 'Kontakt' : 'Contact');
  if (activeCols.includes('phone')) headers.push(isDe ? 'Telefon' : 'Phone');
  if (activeCols.includes('invoice')) headers.push(isDe ? 'Rechnungsnr.' : 'Invoice No');
  if (activeCols.includes('durations')) headers.push(isDe ? 'Zeitraum' : 'Durations');
  if (activeCols.includes('employees')) headers.push(isDe ? 'Mitarbeiter' : 'Employees');
  headers.push(isDe ? 'Kosten' : 'Cost');
  if (activeCols.includes('status')) headers.push('Status');
  if (activeCols.includes('deposit')) headers.push(isDe ? 'Kaution' : 'Deposit');
  rows.push(headers);

  data.forEach(h => {
    const row = [h.hotel];
    if (activeCols.includes('company')) row.push(h.company);
    if (activeCols.includes('city')) row.push(h.city);
    if (activeCols.includes('address')) row.push(h.address);
    if (activeCols.includes('contact')) row.push(h.contact);
    if (activeCols.includes('phone')) row.push(h.phone);
    if (activeCols.includes('invoice')) row.push(h.invoice);
    if (activeCols.includes('durations')) row.push(h.dates);
    if (activeCols.includes('employees')) row.push(h.employees);
    row.push(h.cost);
    if (activeCols.includes('status')) row.push(h.status);
    if (activeCols.includes('deposit')) row.push(h.deposit);
    rows.push(row);
  });

  rows.push([]); 
  const totalRow = Array(headers.length).fill('');
  const costIdx = headers.indexOf(isDe ? 'Kosten' : 'Cost');
  totalRow[costIdx - 1] = isDe ? "GESAMTSUMME" : "GRAND TOTAL";
  totalRow[costIdx] = grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // FIX: Force column widths to prevent text cut-off
  ws['!cols'] = headers.map((h, i) => {
    let maxLen = h.length;
    rows.slice(4).forEach(row => {
      const cellValue = String(row[i] || '');
      if (cellValue.length > maxLen) maxLen = cellValue.length;
    });
    return { wch: Math.min(maxLen + 5, 55) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `Europas_Report_${timestamp.replace(/\./g, '_')}.xlsx`);
}
