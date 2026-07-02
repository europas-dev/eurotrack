// src/components/HotelSummary.tsx
import { formatCurrency, calculateNights, calcInvoiceItem } from '../lib/utils';

// Helper to format dates reliably
function formatShortDate(isoString?: string | null, lang: string = 'de'): string {
  if (!isoString) return '';
  const cleanDate = isoString.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return cleanDate;
}

// Helper to calculate overlap days for the specific filtered month
function getOverlap(startDate: string, endDate: string, month: number | null, year: number) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalNights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  if (month === null) {
    return { totalNights, overlapNights: totalNights, isPartial: false };
  }

  const filterStart = new Date(year, month, 1);
  const filterEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const actualStart = start > filterStart ? start : filterStart;
  const actualEnd = end < filterEnd ? end : filterEnd;

  const overlapNights = Math.max(0, Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)));
  const isPartial = overlapNights > 0 && overlapNights < totalNights;

  return { totalNights, overlapNights, isPartial };
}

export const printHotelSummary = (hotel: any, masterMath: any, selectedMonth: number | null, selectedYear: number, lang: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert(lang === 'de' ? 'Bitte Pop-ups zulassen.' : 'Please allow pop-ups.');
    return;
  }

  const monthNamesDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const periodStr = selectedMonth !== null 
    ? `${lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth]} ${selectedYear}`
    : `${lang === 'de' ? 'Gesamte Zeit' : 'All Time'} (${selectedYear})`;

  // ==========================================
  // 1. PROCESS INVOICES
  // ==========================================
  let invoicesHtml = '';
  const validInvoices = (hotel.invoices || []).filter((inv: any) => {
    if (selectedMonth === null) return true;
    
    const fStart = new Date(selectedYear, selectedMonth, 1);
    const fEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    if (inv.startDate && inv.endDate) {
        const dStart = new Date(inv.startDate);
        const dEnd = new Date(inv.endDate);
        if (dStart <= fEnd && dEnd >= fStart) return true;
    }
    
    const checkDates = [inv.created_at, inv.paymentDate, inv.dueDate].filter(Boolean);
    return checkDates.some(dStr => {
        const d = new Date(dStr);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  });

  validInvoices.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).forEach((inv: any) => {
    const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
    let invBrutto = 0;

    if (inv.billingMode === 'total') {
        const base = parseFloat(inv.totalNetto) || 0;
        const m = parseFloat(inv.totalMwst) || 0;
        const disc = parseFloat(inv.discountValue) || 0;
        const isPct = inv.discountType === 'percentage';
        const invNetto = Math.max(0, base - (isPct ? base * (disc / 100) : disc));
        invBrutto = invNetto * (1 + m / 100);
    } else {
        (inv.items || []).forEach((it: any) => {
            const res = calcInvoiceItem(it, defaultN);
            invBrutto += res.brutto;
        });
    }

    const isOverdue = !inv.isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
    const statusColor = inv.isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#f59e0b';
    const statusLabel = inv.isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : isOverdue ? (lang === 'de' ? 'Überfällig' : 'Overdue') : (lang === 'de' ? 'Offen' : 'Unpaid');
    const dateLabel = inv.isPaid 
        ? `${lang === 'de' ? 'Bezahlt am' : 'Paid on'}: ${formatShortDate(inv.paymentDate, lang)}` 
        : (inv.dueDate ? `${lang === 'de' ? 'Fällig am' : 'Due'}: ${formatShortDate(inv.dueDate, lang)}` : '--');

    invoicesHtml += `
      <tr>
        <td style="border-left: 4px solid ${statusColor}; padding-left: 10px;"><strong>${inv.number || 'Entwurf'}</strong></td>
        <td>${inv.startDate && inv.endDate ? `${formatShortDate(inv.startDate, lang)} - ${formatShortDate(inv.endDate, lang)}` : '--'}</td>
        <td>
           <span style="color:${statusColor}; font-weight:700;">${statusLabel}</span><br>
           <span style="font-size:9px; color:#64748b;">${dateLabel}</span>
        </td>
        <td class="right"><strong>${formatCurrency(invBrutto)}</strong></td>
      </tr>
    `;
  });

  if (!invoicesHtml) invoicesHtml = `<tr><td colspan="4" class="empty">${lang === 'de' ? 'Keine Rechnungen in diesem Zeitraum.' : 'No invoices in this period.'}</td></tr>`;


  // ==========================================
  // 2. PROCESS BOOKINGS & EMPLOYEES (Nested)
  // ==========================================
  let bookingsHtml = '';
  const validDurations = (hotel.durations || []).filter((d: any) => {
    const { overlapNights } = getOverlap(d.startDate, d.endDate, selectedMonth, selectedYear);
    return selectedMonth === null || overlapNights > 0;
  });

  validDurations.sort((a: any, b: any) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()).forEach((d: any) => {
    const { totalNights, overlapNights, isPartial } = getOverlap(d.startDate, d.endDate, selectedMonth, selectedYear);
    const roomCount = (d.roomCards || []).length;
    const totalBeds = (d.roomCards || []).reduce((sum: number, rc: any) => sum + (rc.bedCount || 1), 0);
    
    let nightStr = isPartial 
      ? `<span style="color: #0284c7; font-weight: bold;">${overlapNights}</span> / ${totalNights}`
      : `${totalNights}`;

    // 1. Duration Header (Grey Left Border)
    bookingsHtml += `
      <tr style="border-left: 4px solid #94a3b8; background: #f8fafc; border-top: 1px solid #cbd5e1;">
        <td class="center font-semibold" style="color: #0f172a;">${roomCount}</td>
        <td class="center font-semibold" style="color: #0f172a;">${totalBeds}</td>
        <td><strong style="color: #0f172a;">${lang === 'de' ? 'Buchung' : 'Booking'}</strong></td>
        <td style="font-size: 10px; color: #475569;">${formatShortDate(d.startDate, lang)} - ${formatShortDate(d.endDate, lang)}</td>
        <td class="center font-semibold" style="color: #0f172a;">${nightStr}</td>
      </tr>
    `;

    // 2. Rooms & Beds Loop
    (d.roomCards || []).forEach((rc: any) => {
      const rType = rc.roomType || 'Zimmer';
      const rNo = rc.roomNo ? ` ${rc.roomNo}` : '';
      const bCount = rc.bedCount || 1;

      for (let i = 0; i < bCount; i++) {
        const empsInSlot = (rc.employees || []).filter((e: any) => e.slotIndex === i);
        empsInSlot.sort((a: any, b: any) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

        const validEmps = empsInSlot.filter((e:any) => {
            const eOverlap = getOverlap(e.checkIn, e.checkOut, selectedMonth, selectedYear);
            return selectedMonth === null || eOverlap.overlapNights > 0;
        });

        if (validEmps.length === 0) {
          // Empty Bed Row
          bookingsHtml += `
            <tr style="border-left: 4px solid #cbd5e1; border-bottom: 1px dashed #e2e8f0;">
              <td class="center" style="color: #64748b; font-size: 10px;"><strong>${i===0 ? `${rType}${rNo}` : ''}</strong></td>
              <td class="center" style="color: #64748b; font-size: 10px;">${lang === 'de' ? 'Bett' : 'Bed'} ${i + 1}</td>
              <td style="color: #94a3b8; font-style: italic;">${lang === 'de' ? 'Leer' : 'Empty'}</td>
              <td></td>
              <td></td>
            </tr>
          `;
        } else {
          // Filled Bed Rows (Includes Substitute handling)
          validEmps.forEach((e: any, empIndex: number) => {
            const { overlapNights: eOverlap, isPartial: ePartial, totalNights: eTotal } = getOverlap(e.checkIn, e.checkOut, selectedMonth, selectedYear);
            let eNightStr = ePartial 
              ? `<span style="color: #0284c7; font-weight: 600;">${eOverlap}</span> / ${eTotal}`
              : `${eTotal}`;

            const isSubstitute = empIndex > 0;
            const prefix = isSubstitute ? '<span style="color: #64748b; margin-right: 4px; font-size: 14px;">↳</span>' : '';
            
            // Only show Room & Bed labels on the first row of that specific bed
            const roomLabel = (empIndex === 0 && i === 0) ? `<strong>${rType}${rNo}</strong>` : '';
            const bedLabel = empIndex === 0 ? `${lang === 'de' ? 'Bett' : 'Bed'} ${i + 1}` : '';

            bookingsHtml += `
              <tr style="border-left: 4px solid #cbd5e1; border-bottom: 1px dashed #e2e8f0;">
                <td class="center" style="color: #64748b; font-size: 10px;">${roomLabel}</td>
                <td class="center" style="color: #64748b; font-size: 10px;">${bedLabel}</td>
                <td>${prefix}<strong style="color: #0f172a;">${e.name || 'Unknown'}</strong></td>
                <td style="color: #475569; font-size: 10px;">${formatShortDate(e.checkIn, lang)} - ${formatShortDate(e.checkOut, lang)}</td>
                <td class="center" style="color: #475569;">${eNightStr}</td>
              </tr>
            `;
          });
        }
      }
    });
  });

  if (!bookingsHtml) bookingsHtml = `<tr><td colspan="5" class="empty">${lang === 'de' ? 'Keine Buchungen in diesem Zeitraum.' : 'No bookings in this period.'}</td></tr>`;


  // ==========================================
  // 3. GENERATE HTML
  // ==========================================
  const html = `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <title>${lang === 'de' ? 'Hotelübersicht' : 'Hotel Summary'} - ${hotel.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: 'Poppins', Arial, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.4; margin: 0; padding: 0; padding-bottom: 20mm; }
        
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
        .header-left h1 { font-size: 24px; margin: 0; color: #0f172a; font-weight: 700; text-transform: uppercase; }
        .header-right { text-align: right; }
        .badge { background: #0f172a; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block; }
        
        .top-grid { display: flex; gap: 20px; margin-bottom: 30px; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; flex: 1; }
        .box h3 { font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 15px; font-size: 12px; }
        .info-grid span { color: #64748b; font-size: 10px; text-transform: uppercase; display: block; margin-bottom: -2px; }
        .info-grid strong { color: #0f172a; font-weight: 600; }
        
        .fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .fin-item { display: flex; flex-direction: column; }
        .fin-label { font-size: 10px; text-transform: uppercase; color: #64748b; }
        .fin-val { font-size: 16px; font-weight: 700; color: #0f172a; }
        .val-green { color: #10b981; }
        .val-red { color: #ef4444; }

        .section-title { font-size: 14px; text-transform: uppercase; color: #0f172a; margin: 0 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569; }
        th.center, td.center { text-align: center; }
        th.right, td.right { text-align: right; }
        td { padding: 8px 10px; font-size: 11px; vertical-align: middle; }
        
        td.empty { text-align: center; font-style: italic; color: #94a3b8; padding: 20px; }

        .footer { position: fixed; bottom: 0; left: 0; width: 100%; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; background: white; }
      </style>
    </head>
    <body>
      
      <div class="header">
        <div class="header-left">
          <h1>${lang === 'de' ? 'Hotelübersicht' : 'Hotel Summary'}</h1>
        </div>
        <div class="header-right">
          <div class="badge">${periodStr}</div>
        </div>
      </div>

      <div class="top-grid">
        <div class="box" style="flex: 1.2;">
          <h3>${lang === 'de' ? 'Stammdaten' : 'Master Data'}</h3>
          <div class="info-grid">
            <div><span>${lang === 'de' ? 'Hotelname' : 'Hotel Name'}</span><strong>${hotel.name || '--'}</strong></div>
            <div><span>${lang === 'de' ? 'Adresse' : 'Address'}</span><strong>${hotel.address || ''}, ${hotel.city || ''} ${hotel.country && hotel.country !== 'Germany' ? `(${hotel.country})` : ''}</strong></div>
            <div><span>${lang === 'de' ? 'Ansprechpartner' : 'Contact'}</span><strong>${hotel.contactPerson || '--'}</strong></div>
            <div><span>${lang === 'de' ? 'Telefon' : 'Phone'}</span><strong>${hotel.phone || '--'}</strong></div>
            <div><span>Email</span><strong>${hotel.email || '--'}</strong></div>
            <div><span>Webseite</span><strong>${hotel.website || '--'}</strong></div>
          </div>
          <div style="margin-top: 10px; font-size: 11px;">
              <strong>${lang === 'de' ? 'Kaution / Rabatt:' : 'Deposit / Discount:'}</strong> 
              ${hotel.depositEnabled ? `Kaution ${formatCurrency(parseFloat(hotel.depositAmount||'0'))}` : 'Keine Kaution'}
              ${hotel.has_global_discount ? ` | Rabatt: ${hotel.global_discount_value}${hotel.global_discount_type === 'percentage' ? '%' : '€'}` : ''}
          </div>
        </div>

        <div class="box" style="flex: 0.8;">
          <h3>${lang === 'de' ? 'Finanzübersicht (Gefiltert)' : 'Financial Overview (Filtered)'}</h3>
          <div class="fin-grid">
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Gesamt Netto' : 'Total Netto'}</span><span class="fin-val">${formatCurrency(masterMath.displayNetto)}</span></div>
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Gesamtkosten' : 'Total Cost'}</span><span class="fin-val">${formatCurrency(masterMath.displayBrutto)}</span></div>
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Total Bezahlt' : 'Total Paid'}</span><span class="fin-val val-green">${formatCurrency(masterMath.totalPaid)}</span></div>
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Total Offen' : 'Total Unpaid'}</span><span class="fin-val val-red">${formatCurrency(masterMath.totalUnpaid)}</span></div>
          </div>
          <div style="margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
             <span class="fin-label">${lang === 'de' ? 'Bester Preis / Bett' : 'Lowest Price / Bed'}: </span>
             <strong style="font-size: 14px;">${formatCurrency(masterMath.pricePerBed)} / N</strong>
          </div>
        </div>
      </div>

      <div class="section-title">${lang === 'de' ? 'Rechnungshistorie' : 'Invoice History'}</div>
      <table style="border-bottom: 1px solid #e2e8f0;">
        <thead>
          <tr>
            <th style="padding-left: 10px;">${lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice No.'}</th>
            <th>${lang === 'de' ? 'Leistungszeitraum' : 'Billing Period'}</th>
            <th>Status</th>
            <th class="right">${lang === 'de' ? 'Gesamtkosten' : 'Total Cost'}</th>
          </tr>
        </thead>
        <tbody>
          ${invoicesHtml}
        </tbody>
      </table>

      <div class="section-title" style="margin-top: 40px;">${lang === 'de' ? 'Buchungen & Mitarbeiter' : 'Bookings & Employees'}</div>
      <table>
        <thead>
          <tr>
            <th class="center" style="width: 80px;">${lang === 'de' ? 'Zimmer' : 'Rooms'}</th>
            <th class="center" style="width: 80px;">${lang === 'de' ? 'Betten' : 'Beds'}</th>
            <th>${lang === 'de' ? 'Name / Buchung' : 'Name / Booking'}</th>
            <th>${lang === 'de' ? 'Zeitraum' : 'Period'}</th>
            <th class="center">${lang === 'de' ? 'Nächte' : 'Nights'}</th>
          </tr>
        </thead>
        <tbody>
          ${bookingsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div>EUROPAS GmbH Internal System</div>
        <div style="text-align: center;">${lang === 'de' ? 'Dokument generiert am' : 'Document generated on'}: ${formatShortDate(new Date().toISOString(), lang)}</div>
        <div style="text-align: right;">Hotel ID: ${hotel.id}</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
