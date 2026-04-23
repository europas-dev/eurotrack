// src/lib/utils.ts - Final Polished Export Section
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// FIX: Force DD.MM.YYYY format
function fmtDateFull(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function buildReportData(hotels: any[], calcCost: (h: any) => number, lang: 'de' | 'en') {
  return hotels.map(h => {
    const isDe = lang === 'de';
    // FIX: Added space after comma for readability
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
      phone: h.phone || '—',
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
  // FIX: Fixed redundant "Period:" text
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
      hotel: { cellWidth: 85 },
      dates: { cellWidth: 110 },
      employees: { cellWidth: 120 },
      cost: { fontStyle: 'bold', halign: 'right', cellWidth: 70 }
    },
    didDrawPage: (d) => {
      // FIX: Force German date format in PDF footer
      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
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

  // 1. Header rows
  const rows = [
    ["Europas GmbH"],
    [`${isDe ? 'Zeitraum' : 'Period'}: ${period.replace('Period: ', '')}`],
    [`${isDe ? 'Erstellt am' : 'Generated on'}: ${timestamp}`],
    [] // Spacer
  ];

  // 2. Build Column Headers
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

  // 3. Map Data
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

  // 4. Add Grand Total Row
  rows.push([]); // Spacer before total
  const totalRow = Array(headers.length).fill('');
  totalRow[0] = isDe ? "GESAMTSUMME" : "GRAND TOTAL";
  totalRow[headers.indexOf(isDe ? 'Kosten' : 'Cost')] = grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 5. AUTO-WIDTH LOGIC (Set widths based on content)
  const colWidths = headers.map((h, i) => {
    let maxLen = h.length;
    rows.slice(4).forEach(row => {
      const cellValue = String(row[i] || '');
      if (cellValue.length > maxLen) maxLen = cellValue.length;
    });
    return { wch: Math.min(maxLen + 5, 50) }; // Cap width at 50 chars
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `Europas_Report_${timestamp.replace(/\./g, '_')}.xlsx`);
}
