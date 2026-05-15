// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { calcRoomCardTotal } from './roomCardUtils'
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateNights(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diffTime = e.getTime() - s.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

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
  
  const now = new Date();
  
  // Safely parse YYYY-MM-DD without UTC timezone shifting bugs
  const [inY, inM, inD] = checkIn.split('-');
  const inDateCutoff = new Date(parseInt(inY), parseInt(inM) - 1, parseInt(inD));
  // Set Check-In exact time to 1:00 PM (13:00) Local Time
  inDateCutoff.setHours(13, 0, 0, 0); 
  
  const [outY, outM, outD] = checkOut.split('-');
  const outDateCutoff = new Date(parseInt(outY), parseInt(outM) - 1, parseInt(outD));
  // Set Check-Out exact time to 12:00 PM (12:00) Local Time
  outDateCutoff.setHours(12, 0, 0, 0); 
  
  // 1. If it is past 12:00 PM on checkout day (or days later) -> Completed
  if (now >= outDateCutoff) return 'completed';
  
  // 2. If it is before 1:00 PM on check-in day (or days earlier) -> Upcoming
  if (now < inDateCutoff) return 'upcoming';
  
  // 3. If they are currently checked in, calculate if they leave within 48 hours
  const msUntilCheckout = outDateCutoff.getTime() - now.getTime();
  const hoursUntilCheckout = msUntilCheckout / (1000 * 60 * 60);
  
  if (hoursUntilCheckout <= 48) return 'ending-soon';
  
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
// MASTER MATH ENGINE - INVOICES ONLY
// ─────────────────────────────────────────────────────────────────────────────

export function calcHotelTotalCost(hotel: any, selectedMonth?: number | null, selectedYear?: number | null): number {
  let finalNetto = 0;
  let finalBrutto = 0;

  (hotel.invoices || []).forEach((inv: any) => {
    // Check month filter
    if (selectedMonth !== null && selectedYear !== null) {
       const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
       if (!dateStr) return;
       const d = new Date(dateStr);
       if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) return;
    }

    if (inv.billingMode === 'total') {
       const n = parseFloat(inv.totalNetto) || 0;
       const m = parseFloat(inv.totalMwst) || 0;
       finalNetto += n;
       finalBrutto += n * (1 + m / 100);
    } else {
       // Accurately calculate the default nights based on invoice dates
       const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
       
       (inv.items || []).forEach((item: any) => {
          const mwst = item.mwst != null ? parseFloat(item.mwst) : 0;
          let itemNetto = 0;

          if (item.brutto != null && item.brutto !== '') {
              itemNetto = parseFloat(item.brutto) / (1 + mwst / 100);
          } else {
              let baseNetto = parseFloat(item.netto) || 0;
              if (item.method === 'per_bed') {
                const beds = parseFloat(item.beds) || 1;
                const nights = parseFloat(item.nights) || defaultN; // Use actual nights
                baseNetto = baseNetto * beds * nights;
              }
              itemNetto = baseNetto;
              if (item.discountValue && parseFloat(item.discountValue) > 0) {
                const dVal = parseFloat(item.discountValue);
                itemNetto = item.discountType === 'percentage' ? baseNetto * (1 - dVal/100) : Math.max(0, baseNetto - dVal);
              }
          }
          finalNetto += itemNetto;
          finalBrutto += itemNetto * (1 + mwst / 100);
       });
    }
  });

  // Apply Global Discounts
  if (hotel.has_global_discount && hotel.global_discount_value) {
     const gVal = parseFloat(hotel.global_discount_value);
     const isFixed = hotel.global_discount_type === 'fixed';
     const target = hotel.global_discount_target || 'netto';

     if (target === 'netto') {
        let ratio = isFixed ? (gVal / finalNetto) : (gVal / 100);
        if (!isFinite(ratio)) ratio = 0;
        finalBrutto = Math.max(0, finalBrutto - (finalBrutto * ratio));
     } else {
        finalBrutto = Math.max(0, finalBrutto - (isFixed ? gVal : finalBrutto * (gVal/100)));
     }
  }

  // Hard Brutto Override (ONLY apply if we are looking at all months)
  const override = hotel.override_total_brutto ?? hotel.overrideTotalBrutto;
  if (override != null && selectedMonth === null) {
      return parseFloat(override);
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
  
  const s = scope.toLowerCase();

  if (s.includes('hotel') || s.includes('name')) {
    return (hotel.name?.toLowerCase() || '').includes(q);
  }

  if (s.includes('city') || s.includes('stadt')) {
    return (hotel.city?.toLowerCase() || '').includes(q);
  }

  if (s.includes('company') || s.includes('firma')) {
    const tags = Array.isArray(hotel.companyTag) ? hotel.companyTag.join(' ').toLowerCase() : (hotel.companyTag?.toLowerCase() || '');
    return tags.includes(q);
  }

  if (s.includes('invoice') || s.includes('rechnung')) {
    for (const d of (hotel.durations || [])) {
      if (d.rechnungNr?.toLowerCase().includes(q)) return true;
    }
    return false;
  }

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

function fmtDateFull(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function buildReportData(hotels: any[], calcCost: (h: any) => number, lang: 'de' | 'en') {
  return hotels.map(h => {
    const isDe = lang === 'de';
    const cCode = h.countryCode || h.country_code || '';
    const fullPhone = cCode && h.phone ? `${cCode}${h.phone}` : (h.phone || '—');
    
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
      phone: fullPhone,
      invoice: h.rechnungNr || h.rechnung_nr || '—',
      dates: dates || '—',
      employees: employees || '—',
      cost: (calcCost(h) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
      status: (h.isPaid || h.is_paid) ? (isDe ? 'Bezahlt' : 'Paid') : (isDe ? 'Offen' : 'Unpaid'),
      deposit: h.depositEnabled ? (Number(h.depositAmount) > 0 ? (Number(h.depositAmount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })) : (isDe ? 'Ja' : 'Yes')) : (isDe ? 'Nein' : 'No')
    };
  });
}

export function generatePDF(data: any[], activeCols: string[], title: string, lang: 'de' | 'en', grandTotal: number, shouldPrint = false) {
  const isDe = lang === 'de';
  const doc = new jsPDF('l', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const cleanTitle = title.replace('Period:', '').replace('Zeitraum:', '').trim();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Europas GmbH", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${isDe ? 'Zeitraum' : 'Period'}: ${cleanTitle}`, 40, 55);

  doc.setFont("helvetica", "bold");
  doc.text(isDe ? "Gesamtkosten" : "Total Cost", pageWidth - 40, 40, { align: 'right' });
  doc.setFontSize(15);
  doc.text(grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), pageWidth - 40, 58, { align: 'right' });

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
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 8, font: "helvetica", cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.5 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 
      phone: { cellWidth: 65 },
      dates: { cellWidth: 95 },
      employees: { cellWidth: 110 },
      cost: { fontStyle: 'bold', halign: 'right', cellWidth: 60 }
    },
    didDrawPage: (d) => {
      const now = new Date();
      const ts = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      doc.setFontSize(8);
      doc.text(`${isDe ? 'Erstellt am' : 'Generated on'}: ${ts}`, 40, doc.internal.pageSize.height - 20);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 40, doc.internal.pageSize.height - 20, { align: 'right' });
    }
  });
 
  const fileDate = `${new Date().getDate().toString().padStart(2, '0')}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getFullYear()}`;
  const fileName = `Europas GmbH_${isDe ? 'Bericht' : 'Report'}_${cleanTitle}_${fileDate}.pdf`;
  if (shouldPrint) { window.open(doc.output('bloburl'), '_blank'); } else { doc.save(fileName); }
}

export function generateExcel(data: any[], activeCols: string[], lang: 'de' | 'en', period: string, grandTotal: number) {
  const isDe = lang === 'de';
  const now = new Date();
  const cleanPeriod = period.replace('Period:', '').replace('Zeitraum:', '').trim();
  const ts = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

  const rows: any[] = [
    ["Europas GmbH"],
    [`${isDe ? 'Zeitraum' : 'Period'}: ${cleanPeriod}`],
    [`${isDe ? 'Erstellt am' : 'Generated on'}: ${ts}`],
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
    const row: any[] = [h.hotel];
    if (activeCols.includes('company')) row.push(h.company);
    if (activeCols.includes('city')) row.push(h.city);
    if (activeCols.includes('address')) row.push(h.address);
    if (activeCols.includes('contact')) row.push(h.contact);
    if (activeCols.includes('phone')) row.push(h.phone.startsWith('+') ? { f: `"${h.phone}"` } : h.phone);
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

  ws['!cols'] = headers.map((h, i) => {
    if (h === (isDe ? 'Mitarbeiter' : 'Employees')) return { wch: 45 };
    if (h === (isDe ? 'Telefon' : 'Phone')) return { wch: 20 };
    return { wch: 22 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const fileDate = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
  XLSX.writeFile(wb, `Europas GmbH_${isDe ? 'Bericht' : 'Report'}_${cleanPeriod}_${fileDate}.xlsx`);
}

export function calcInvoiceItem(item: any, defaultNights: number = 1) {
  const mwst = item.mwst != null ? parseFloat(item.mwst) : 0;
  let finalNetto = 0;
  let brutto = 0;

  if (item.brutto != null && item.brutto !== '') {
      brutto = parseFloat(item.brutto);
      finalNetto = brutto / (1 + mwst / 100);
  } else {
      let baseNetto = parseFloat(item.netto) || 0;
      if (item.method === 'per_bed') {
        const beds = parseFloat(item.beds) || 1;
        const nights = parseFloat(item.nights) || defaultNights;
        baseNetto = baseNetto * beds * nights;
      }
      finalNetto = baseNetto;
      if (item.discountValue && parseFloat(item.discountValue) > 0) {
        const dVal = parseFloat(item.discountValue);
        finalNetto = item.discountType === 'percentage' ? baseNetto * (1 - dVal/100) : Math.max(0, baseNetto - dVal);
      }
      brutto = finalNetto * (1 + mwst / 100);
  }
  return { finalNetto, mwst, brutto };
}
