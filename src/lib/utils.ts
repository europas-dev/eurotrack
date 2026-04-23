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
// EXPORT & PRINT FUNCTIONS (Professional PDF & CSV Engine)
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function buildReportData(hotels: any[], calcCost: (h: any) => number, lang: 'de' | 'en') {
  return hotels.map(h => {
    const company = Array.isArray(h.companyTag) ? h.companyTag.join(', ') : (h.companyTag || '—');
    const invoice = h.rechnungNr || h.rechnung_nr || '—';
    
    // Professional Full Dates: 05.04.2026 - 12.04.2026
    const dates = (h.durations || []).map((d: any) => 
      d.startDate && d.endDate ? `${fmtDateFull(d.startDate)} - ${fmtDateFull(d.endDate)}` : ''
    ).filter(Boolean).join('\n');

    const employees = (h.durations || []).flatMap((d: any) => 
      (d.roomCards || []).flatMap((rc: any) => (rc.employees || []).map((e: any) => e.name))
    ).filter(Boolean).join(', ');

    const cost = formatCurrency(calcCost(h));
    
    const isPaid = h.isPaid || h.is_paid;
    const status = isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Unpaid');

    const hasDeposit = h.depositEnabled || h.deposit_enabled;
    const depositAmount = Number(h.depositAmount || h.deposit_amount) || 0;
    const depositStr = hasDeposit 
        ? (depositAmount > 0 ? formatCurrency(depositAmount) : (lang === 'de' ? 'Ja' : 'Yes')) 
        : (lang === 'de' ? 'Nein' : 'No');

    return {
      hotel: h.name || '—',
      company,
      city: h.city || '—',
      address: h.address || '—',
      contact: h.contactPerson || h.contactperson || '—',
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

function fmtDateFull(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function exportToCSV(
  hotels: any[], 
  calcCost: (h: any) => number, 
  grandTotal: number, 
  reportTitle: string, 
  lang: 'de' | 'en',
  showStatus: boolean,
  showDeposit: boolean
) {
  const data = buildReportData(hotels, calcCost, lang);
  const isDe = lang === 'de';

  let headers = isDe 
    ? ['Hotelname', 'Firma', 'Stadt', 'Adresse', 'Ansprechpartner', 'Telefon', 'Rechnungsnr.', 'Zeitraum', 'Mitarbeiter', 'Gesamtkosten']
    : ['Hotel Name', 'Company', 'City', 'Address', 'Contact', 'Phone', 'Invoice No.', 'Durations', 'Employees', 'Total Cost'];
  
  if (showStatus) headers.splice(headers.length - 1, 0, 'Status');
  if (showDeposit) headers.push(isDe ? 'Kaution' : 'Deposit');

  const rows = data.map(d => {
    const row = [d.hotel, d.company, d.city, d.address, d.contact, d.phone, d.invoice, d.dates, d.employees];
    if (showStatus) row.push(d.status);
    row.push(d.cost);
    if (showDeposit) row.push(d.depositStr);
    return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const totalRow = Array(headers.length).fill('""');
  const costIndex = showDeposit ? headers.length - 2 : headers.length - 1;
  totalRow[costIndex - 1] = isDe ? `"GESAMTSUMME"` : `"GRAND TOTAL"`;
  totalRow[costIndex] = `"${formatCurrency(grandTotal)}"`;
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

export function printDocument(
  hotels: any[], 
  calcCost: (h: any) => number, 
  grandTotal: number, 
  reportTitle: string, 
  lang: 'de' | 'en',
  activeCols: string[] 
) {
  const isDe = lang === 'de';
  const doc = new jsPDF('l', 'pt', 'a4');

  // HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Europas GmbH", 40, 40);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(reportTitle, 40, 55);

  // TOP TOTAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(isDe ? "Gesamtkosten" : "Total Cost", doc.internal.pageSize.width - 40, 40, { align: 'right' });
  doc.setFontSize(15);
  doc.text(formatCurrency(grandTotal), doc.internal.pageSize.width - 40, 58, { align: 'right' });

  // COLUMNS
  const columns = [{ header: isDe ? 'Hotelname' : 'Hotel Name', dataKey: 'hotel' }];
  if (activeCols.includes('company')) columns.push({ header: isDe ? 'Firma' : 'Company', dataKey: 'company' });
  if (activeCols.includes('city')) columns.push({ header: isDe ? 'Stadt' : 'City', dataKey: 'city' });
  if (activeCols.includes('address')) columns.push({ header: isDe ? 'Adresse' : 'Address', dataKey: 'address' });
  if (activeCols.includes('contact')) columns.push({ header: isDe ? 'Ansprechpartner' : 'Contact', dataKey: 'contact' });
  if (activeCols.includes('phone')) columns.push({ header: isDe ? 'Telefon' : 'Phone', dataKey: 'phone' });
  if (activeCols.includes('invoice')) columns.push({ header: isDe ? 'Rechnungsnr.' : 'Invoice No.', dataKey: 'invoice' });
  if (activeCols.includes('durations')) columns.push({ header: isDe ? 'Zeitraum' : 'Durations', dataKey: 'dates' });
  if (activeCols.includes('employees')) columns.push({ header: isDe ? 'Mitarbeiter' : 'Employees', dataKey: 'employees' });
  columns.push({ header: isDe ? 'Kosten' : 'Cost', dataKey: 'cost' });
  if (activeCols.includes('status')) columns.push({ header: 'Status', dataKey: 'status' });
  if (activeCols.includes('deposit')) columns.push({ header: isDe ? 'Kaution' : 'Deposit', dataKey: 'deposit' });

  const body = buildReportData(hotels, calcCost, lang);

  autoTable(doc, {
    columns: columns,
    body: body,
    startY: 80,
    theme: 'grid',
    styles: { fontSize: 10, font: "helvetica", cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      hotel: { fontStyle: 'bold' },
      employees: { cellWidth: 'auto' },
      cost: { fontStyle: 'bold', halign: 'right' }
    },
    didDrawPage: (data) => {
      const footerY = doc.internal.pageSize.height - 20;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${isDe ? 'Erstellt am:' : 'Generated on:'} ${new Date().toLocaleString()}`, 40, footerY);
      
      const pageNumber = "Page " + doc.internal.getNumberOfPages();
      doc.text(pageNumber, doc.internal.pageSize.width - 40, footerY, { align: 'right' });
    }
  });

  window.open(doc.output('bloburl'), '_blank');
}
