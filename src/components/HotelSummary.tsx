// src/components/HotelSummary.tsx
import { formatCurrency } from '../lib/utils';

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
  const filterEnd = new Date(year, month + 1, 0);

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

  // Process Durations (Bookings)
  let bookingsHtml = '';
  const validDurations = (hotel.durations || []).filter((d: any) => {
    const { overlapNights } = getOverlap(d.startDate, d.endDate, selectedMonth, selectedYear);
    return selectedMonth === null || overlapNights > 0;
  });

  validDurations.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).forEach((d: any) => {
    const { totalNights, overlapNights, isPartial } = getOverlap(d.startDate, d.endDate, selectedMonth, selectedYear);
    const rooms = (d.roomCards || []).length;
    const beds = (d.roomCards || []).reduce((sum: number, rc: any) => sum + (rc.bedCount || 1), 0);
    
    let nightStr = isPartial 
      ? `<span style="color: #0284c7; font-weight: bold;">${overlapNights} in ${selectedMonth !== null ? monthNamesDe[selectedMonth] : ''}</span> (von ${totalNights})`
      : `${totalNights}`;

    bookingsHtml += `
      <tr>
        <td>${formatShortDate(d.startDate, lang)} - ${formatShortDate(d.endDate, lang)}</td>
        <td class="center">${nightStr}</td>
        <td class="center">${rooms}</td>
        <td class="center">${beds}</td>
      </tr>
    `;
  });
  if (!bookingsHtml) bookingsHtml = `<tr><td colspan="4" class="empty">${lang === 'de' ? 'Keine Buchungen in diesem Zeitraum.' : 'No bookings in this period.'}</td></tr>`;

  // Process Employees
  let empsHtml = '';
  const allEmps: any[] = [];
  validDurations.forEach((d: any) => {
    (d.roomCards || []).forEach((rc: any) => {
      (rc.employees || []).forEach((e: any) => {
        const { overlapNights, isPartial, totalNights } = getOverlap(e.checkIn, e.checkOut, selectedMonth, selectedYear);
        if (selectedMonth === null || overlapNights > 0) {
          allEmps.push({ ...e, overlapNights, isPartial, totalNights });
        }
      });
    });
  });

  allEmps.sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()).forEach((e: any) => {
    let nightStr = e.isPartial 
      ? `<span style="color: #0284c7; font-weight: bold;">${e.overlapNights} in ${selectedMonth !== null ? monthNamesDe[selectedMonth] : ''}</span> (von ${e.totalNights})`
      : `${e.totalNights}`;

    empsHtml += `
      <tr>
        <td><strong>${e.name || 'Unknown'}</strong></td>
        <td>${formatShortDate(e.checkIn, lang)} - ${formatShortDate(e.checkOut, lang)}</td>
        <td class="center">${nightStr}</td>
      </tr>
    `;
  });
  if (!empsHtml) empsHtml = `<tr><td colspan="3" class="empty">${lang === 'de' ? 'Keine Mitarbeiter in diesem Zeitraum.' : 'No employees in this period.'}</td></tr>`;

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
        
        /* Header Area */
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
        .header-left h1 { font-size: 24px; margin: 0; color: #0f172a; font-weight: 700; text-transform: uppercase; }
        .header-left p { margin: 2px 0 0 0; color: #64748b; font-size: 12px; }
        .header-right { text-align: right; }
        .badge { background: #0f172a; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block; }
        
        /* Top Grid */
        .top-grid { display: flex; gap: 20px; margin-bottom: 30px; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; flex: 1; }
        .box h3 { font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 15px; font-size: 12px; }
        .info-grid span { color: #64748b; font-size: 10px; text-transform: uppercase; display: block; margin-bottom: -2px; }
        .info-grid strong { color: #0f172a; font-weight: 600; }
        .notes-area { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-style: italic; color: #475569; }

        .fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .fin-item { display: flex; flex-direction: column; }
        .fin-label { font-size: 10px; text-transform: uppercase; color: #64748b; }
        .fin-val { font-size: 16px; font-weight: 700; color: #0f172a; }
        .val-green { color: #10b981; }
        .val-red { color: #ef4444; }

        /* Tables Grid */
        .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .table-section h2 { font-size: 14px; text-transform: uppercase; color: #0f172a; margin: 0 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569; }
        th.center, td.center { text-align: center; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        td.empty { text-align: center; font-style: italic; color: #94a3b8; padding: 20px; }

        .footer { position: fixed; bottom: 0; left: 0; width: 100%; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; background: white; }
        .page-number:after { content: "Page " counter(page); }
      </style>
    </head>
    <body>
      
      <div class="header">
        <div class="header-left">
          <h1>${lang === 'de' ? 'Hotelübersicht' : 'Hotel Summary'}</h1>
          <p>EUROPAS GmbH • Dokument generiert am ${formatShortDate(new Date().toISOString(), lang)}</p>
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
            <div><span>${lang === 'de' ? 'Adresse' : 'Address'}</span><strong>${hotel.address || '--'}, ${hotel.city || '--'}</strong></div>
            <div><span>${lang === 'de' ? 'Ansprechpartner' : 'Contact'}</span><strong>${hotel.contactPerson || '--'}</strong></div>
            <div><span>${lang === 'de' ? 'Telefon' : 'Phone'}</span><strong>${hotel.phone || '--'}</strong></div>
            <div><span>Email</span><strong>${hotel.email || '--'}</strong></div>
            <div>
              <span>${lang === 'de' ? 'Kaution / Rabatt' : 'Deposit / Discount'}</span>
              <strong>
                ${hotel.depositEnabled ? `Kaution: ${formatCurrency(parseFloat(hotel.depositAmount||'0'))}` : 'Keine Kaution'}
                ${hotel.has_global_discount ? ` | Rabatt: ${hotel.global_discount_value}${hotel.global_discount_type === 'percentage' ? '%' : '€'}` : ''}
              </strong>
            </div>
          </div>
          ${hotel.notes ? `<div class="notes-area"><strong>Notizen:</strong> ${hotel.notes}</div>` : ''}
        </div>

        <div class="box" style="flex: 0.8;">
          <h3>${lang === 'de' ? 'Finanzübersicht (Gefiltert)' : 'Financial Overview (Filtered)'}</h3>
          <div class="fin-grid">
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Gesamt Netto' : 'Total Netto'}</span><span class="fin-val">${formatCurrency(masterMath.displayNetto)}</span></div>
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Gesamt Brutto' : 'Total Brutto'}</span><span class="fin-val">${formatCurrency(masterMath.displayBrutto)}</span></div>
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Total Bezahlt' : 'Total Paid'}</span><span class="fin-val val-green">${formatCurrency(masterMath.totalPaid)}</span></div>
            <div class="fin-item"><span class="fin-label">${lang === 'de' ? 'Total Offen' : 'Total Unpaid'}</span><span class="fin-val val-red">${formatCurrency(masterMath.totalUnpaid)}</span></div>
          </div>
          <div style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
             <span class="fin-label">${lang === 'de' ? 'Bester Preis / Bett' : 'Lowest Price / Bed'}: </span>
             <strong style="font-size: 14px;">${formatCurrency(masterMath.pricePerBed)} / N</strong>
          </div>
        </div>
      </div>

      <div class="tables-grid">
        <div class="table-section">
          <h2>${lang === 'de' ? 'Buchungszeiträume' : 'Booking Periods'}</h2>
          <table>
            <thead>
              <tr>
                <th>${lang === 'de' ? 'Zeitraum' : 'Period'}</th>
                <th class="center">${lang === 'de' ? 'Nächte' : 'Nights'}</th>
                <th class="center">${lang === 'de' ? 'Zimmer' : 'Rooms'}</th>
                <th class="center">${lang === 'de' ? 'Betten' : 'Beds'}</th>
              </tr>
            </thead>
            <tbody>
              ${bookingsHtml}
            </tbody>
          </table>
        </div>

        <div class="table-section">
          <h2>${lang === 'de' ? 'Mitarbeiter Aufenthalte' : 'Employee Stays'}</h2>
          <table>
            <thead>
              <tr>
                <th>${lang === 'de' ? 'Mitarbeiter' : 'Employee'}</th>
                <th>${lang === 'de' ? 'Zeitraum' : 'Period'}</th>
                <th class="center">${lang === 'de' ? 'Nächte' : 'Nights'}</th>
              </tr>
            </thead>
            <tbody>
              ${empsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="footer">
        <div>EUROPAS GmbH Internal System</div>
        <div>Hotel ID: ${hotel.id}</div>
        <div class="page-number"></div>
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
