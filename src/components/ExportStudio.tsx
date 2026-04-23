import React from 'react';
import { X, Printer, FileText, Download, Check, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { generatePDF, generateExcel, buildReportData } from '../lib/utils';

export default function ExportStudio({ hotels, calcCost, lang, title, total, onClose, dk }: any) {
  const [activeCols, setActiveCols] = React.useState<string[]>(['company', 'address', 'contact', 'phone', 'invoice', 'durations', 'employees']);
  const isDe = lang === 'de';

  const reportData = React.useMemo(() => buildReportData(hotels, calcCost, lang), [hotels, lang]);

  const toggleCol = (id: string) => {
    setActiveCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  // Inside ExportStudio.tsx, update colLabels:
  const colLabels: any = {
    company: isDe ? 'Firma' : 'Company',
    city: isDe ? 'Stadt' : 'City',
    address: isDe ? 'Adresse' : 'Address',
    contact: isDe ? 'Kontakt' : 'Contact', // FIXED: Back to Kontakt
    phone: isDe ? 'Telefon' : 'Phone',
    invoice: isDe ? 'Rechnungsnr.' : 'Invoice No',
    durations: isDe ? 'Zeitraum' : 'Durations',
    employees: isDe ? 'Mitarbeiter' : 'Employees',
    status: 'Status',
    deposit: isDe ? 'Kaution' : 'Deposit'
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* TOP NAV */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"><X size={20}/></button>
          <h2 className="text-white font-black text-lg">Export Studio</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => generateExcel(reportData, activeCols, lang, title, total)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm"> <Download size={16}/> Excel </button>
          <button onClick={() => { const doc = generatePDF(reportData, activeCols, title, lang, total); doc.save('Report.pdf'); }} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-sm transition-all"><FileText size={16}/> PDF</button>
          <button onClick={() => { const doc = generatePDF(reportData, activeCols, title, lang, total); window.open(doc.output('bloburl'), '_blank'); }} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-bold text-sm transition-all"><Printer size={16}/> {isDe ? 'Drucken' : 'Print'}</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
    {/* LEFT: PREVIEW */}
    <div className="flex-1 overflow-auto p-12 bg-slate-800/50 flex justify-center">
      {/* This container acts as the 'A4' Paper */}
      <div className="w-[1122px] min-h-[793px] bg-white shadow-2xl p-[40pt] flex flex-col text-slate-900 origin-top">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
          <div>
            <h1 className="text-xl font-bold m-0">Europas GmbH</h1>
            <p className="text-sm text-slate-500">{title}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 font-bold m-0">{isDe ? 'Gesamtkosten' : 'Total Cost'}</p>
            <p className="text-2xl font-black">{total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
          </div>
        </div>
  
        {/* TABLE WRAPPER: Fixed for horizontal overflow */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[9pt] min-w-max">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '85pt' }}>{isDe ? 'Hotelname' : 'Hotel Name'}</th>
                {activeCols.includes('company') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '80pt' }}>{colLabels.company}</th>}
                {activeCols.includes('city') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '70pt' }}>{colLabels.city}</th>}
                {activeCols.includes('address') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '85pt' }}>{colLabels.address}</th>}
                {activeCols.includes('contact') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '80pt' }}>{colLabels.contact}</th>}
                {activeCols.includes('phone') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '85pt' }}>{colLabels.phone}</th>}
                {activeCols.includes('invoice') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '65pt' }}>{colLabels.invoice}</th>}
                {activeCols.includes('durations') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '120pt' }}>{colLabels.durations}</th>}
                {activeCols.includes('employees') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '130pt' }}>{colLabels.employees}</th>}
                <th className="border border-slate-300 bg-slate-100 p-2 text-right font-bold" style={{ width: '70pt' }}>{isDe ? 'Kosten' : 'Cost'}</th>
                {activeCols.includes('status') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '60pt' }}>Status</th>}
                {activeCols.includes('deposit') && <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold" style={{ width: '60pt' }}>{colLabels.deposit}</th>}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-300 p-2 align-top">{row.hotel}</td>
                  {activeCols.includes('company') && <td className="border border-slate-300 p-2 align-top">{row.company}</td>}
                  {activeCols.includes('city') && <td className="border border-slate-300 p-2 align-top">{row.city}</td>}
                  {activeCols.includes('address') && <td className="border border-slate-300 p-2 align-top">{row.address}</td>}
                  {activeCols.includes('contact') && <td className="border border-slate-300 p-2 align-top">{row.contact}</td>}
                  {activeCols.includes('phone') && <td className="border border-slate-300 p-2 align-top">{row.phone}</td>}
                  {activeCols.includes('invoice') && <td className="border border-slate-300 p-2 align-top">{row.invoice}</td>}
                  {activeCols.includes('durations') && <td className="border border-slate-300 p-2 align-top whitespace-pre-line">{row.dates}</td>}
                  {activeCols.includes('employees') && <td className="border border-slate-300 p-2 align-top">{row.employees}</td>}
                  <td className="border border-slate-300 p-2 align-top font-bold text-right">{row.cost}</td>
                  {activeCols.includes('status') && <td className="border border-slate-300 p-2 align-top font-bold">{row.status}</td>}
                  {activeCols.includes('deposit') && <td className="border border-slate-300 p-2 align-top">{row.deposit}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* FOOTER SECTION: Restore generated-on timestamp */}
      <div className="mt-auto pt-8 flex justify-between items-center text-[8pt] text-slate-400 border-t border-slate-100">
        <p>{isDe ? 'Erstellt am' : 'Generated on'}: {new Date().toLocaleDateString('de-DE')} {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
        <p>Page 1</p>
      </div>
    </div>
  </div>
</div>

        {/* RIGHT: CUSTOMIZE */}
        <div className="w-[320px] bg-slate-900 border-l border-white/10 p-8 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 mb-8 text-teal-400 font-black uppercase tracking-widest text-xs">
            <Settings2 size={16}/> {isDe ? 'Anpassen' : 'Customize'}
          </div>
          <div className="space-y-3">
            {Object.keys(colLabels).map(id => (
              <button key={id} onClick={() => toggleCol(id)} className={cn("w-full p-4 rounded-xl border flex items-center justify-between font-bold text-sm transition-all", activeCols.includes(id) ? "border-teal-500/50 bg-teal-500/10 text-white" : "border-white/5 bg-white/5 text-slate-500 hover:text-white")}>
                {colLabels[id]}
                {activeCols.includes(id) && <Check size={16} className="text-teal-500"/>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
