// src/components/ExportModal.tsx
// Exports hotels to CSV, real XLSX (SheetJS), or PDF (html→print→save)
// All three formats include: hotel, city, company, address, contact, phone,
// email, website, notes, duration dates, room type, rooms, nights,
// price/night, brutto, netto, mwst, is_paid, deposit, employees

import React, { useState } from 'react'
import { X, FileText, FileSpreadsheet, Download, Loader2, File } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  cn,
  calcHotelTotalCost,
  calcHotelTotalNights,
  calcHotelFreeBeds,
  formatCurrency,
} from '../lib/utils'

interface ExportModalProps {
  isDarkMode: boolean
  lang?: 'de' | 'en'
  hotels: any[]
  onClose: () => void
}

type ExportFormat = 'csv' | 'pdf' | 'xlsx'

// ── helpers ───────────────────────────────────────────────────────────────────

function calcNights(d: any): number {
  if (!d.startDate || !d.endDate) return 0
  return Math.max(
    0,
    Math.ceil(
      (new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86_400_000,
    ),
  )
}

function deriveBrutto(d: any): number | null {
  if (!d.useBruttoNetto) return null
  if (d.brutto != null) return d.brutto
  if (d.netto != null && d.mwst != null) return d.netto * (1 + d.mwst / 100)
  return null
}

function deriveNetto(d: any): number | null {
  if (!d.useBruttoNetto) return null
  if (d.netto != null) return d.netto
  if (d.brutto != null && d.mwst != null) return d.brutto / (1 + d.mwst / 100)
  return null
}

function calcDurationCost(d: any): number {
  const br = deriveBrutto(d)
  if (br != null) return br
  const n = calcNights(d)
  return n * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1)
}

// ── flat rows: one row per duration ─────────────────────────────────────────
function buildRows(hotels: any[], lang: 'de' | 'en') {
  const isDE = lang === 'de'
  const rows: Record<string, any>[] = []

  for (const h of hotels) {
    const durations = h.durations ?? []
    if (durations.length === 0) {
      // hotel without durations – still include one row
      rows.push({
        [isDE ? 'Hotel'            : 'Hotel']:            h.name ?? '',
        [isDE ? 'Stadt'            : 'City']:             h.city ?? '',
        [isDE ? 'Firma'            : 'Company']:          h.companyTag ?? '',
        [isDE ? 'Adresse'          : 'Address']:          h.address ?? '',
        [isDE ? 'Ansprechpartner'  : 'Contact']:          h.contactPerson ?? '',
        [isDE ? 'Telefon'          : 'Phone']:            h.phone ?? '',
        [isDE ? 'E-Mail'           : 'Email']:            h.email ?? '',
        [isDE ? 'Webseite'         : 'Website']:          h.webLink ?? '',
        [isDE ? 'Notizen'          : 'Notes']:            h.notes ?? '',
        [isDE ? 'Von'              : 'From']:             '',
        [isDE ? 'Bis'              : 'To']:               '',
        [isDE ? 'Zimmertyp'        : 'Room type']:        '',
        [isDE ? 'Zimmer'           : 'Rooms']:            '',
        [isDE ? 'Nächte'           : 'Nights']:           0,
        [isDE ? 'Preis/Nacht'      : 'Price/night']:      '',
        [isDE ? 'Brutto'           : 'Gross']:            '',
        [isDE ? 'Netto'            : 'Net']:              '',
        [isDE ? 'MwSt %'           : 'VAT %']:            '',
        [isDE ? 'Kosten gesamt'    : 'Total cost']:       0,
        [isDE ? 'Bezahlt'          : 'Paid']:             isDE ? 'Nein' : 'No',
        [isDE ? 'Kaution'          : 'Deposit']:          '',
        [isDE ? 'Mitarbeiter'      : 'Employees']:        '',
      })
      continue
    }

    for (const d of durations) {
      const nights = calcNights(d)
      const brutto = deriveBrutto(d)
      const netto  = deriveNetto(d)
      const cost   = calcDurationCost(d)
      const emps   = (d.employees ?? []).filter(Boolean).map((e: any) => e.name).join(', ')
      rows.push({
        [isDE ? 'Hotel'            : 'Hotel']:            h.name ?? '',
        [isDE ? 'Stadt'            : 'City']:             h.city ?? '',
        [isDE ? 'Firma'            : 'Company']:          h.companyTag ?? '',
        [isDE ? 'Adresse'          : 'Address']:          h.address ?? '',
        [isDE ? 'Ansprechpartner'  : 'Contact']:          h.contactPerson ?? '',
        [isDE ? 'Telefon'          : 'Phone']:            h.phone ?? '',
        [isDE ? 'E-Mail'           : 'Email']:            h.email ?? '',
        [isDE ? 'Webseite'         : 'Website']:          h.webLink ?? '',
        [isDE ? 'Notizen'          : 'Notes']:            h.notes ?? '',
        [isDE ? 'Von'              : 'From']:             d.startDate ?? '',
        [isDE ? 'Bis'              : 'To']:               d.endDate ?? '',
        [isDE ? 'Zimmertyp'        : 'Room type']:        d.roomType ?? '',
        [isDE ? 'Zimmer'           : 'Rooms']:            d.numberOfRooms ?? '',
        [isDE ? 'Nächte'           : 'Nights']:           nights,
        [isDE ? 'Preis/Nacht'      : 'Price/night']:      d.useBruttoNetto ? '' : (d.pricePerNightPerRoom ?? ''),
        [isDE ? 'Brutto'           : 'Gross']:            brutto != null ? brutto : '',
        [isDE ? 'Netto'            : 'Net']:              netto  != null ? netto  : '',
        [isDE ? 'MwSt %'           : 'VAT %']:            d.useBruttoNetto ? (d.mwst ?? '') : '',
        [isDE ? 'Kosten gesamt'    : 'Total cost']:       cost,
        [isDE ? 'Bezahlt'          : 'Paid']:             d.isPaid ? (isDE ? 'Ja' : 'Yes') : (isDE ? 'Nein' : 'No'),
        [isDE ? 'Kaution'          : 'Deposit']:          d.depositEnabled ? (d.depositAmount ?? '') : '',
        [isDE ? 'Mitarbeiter'      : 'Employees']:        emps,
      })
    }
  }
  return rows
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function buildCSV(hotels: any[], lang: 'de' | 'en'): string {
  const rows = buildRows(hotels, lang)
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape  = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [
    headers.map(escape).join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n')
}

// ── XLSX (SheetJS) ────────────────────────────────────────────────────────────
function buildXLSX(hotels: any[], lang: 'de' | 'en'): Uint8Array {
  const rows = buildRows(hotels, lang)
  const ws   = XLSX.utils.json_to_sheet(rows)

  // Column widths
  const cols = Object.keys(rows[0] ?? {})
  ws['!cols'] = cols.map(k => {
    const maxLen = Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, lang === 'de' ? 'Hotels' : 'Hotels')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}

// ── PDF (html→print window) ───────────────────────────────────────────────────
function buildPDFHtml(hotels: any[], lang: 'de' | 'en'): string {
  const isDE = lang === 'de'
  const rows = buildRows(hotels, lang)
  if (rows.length === 0) return '<p>No data</p>'
  const headers = Object.keys(rows[0])

  const headerRow = headers.map(h => `<th>${h}</th>`).join('')
  const dataRows  = rows.map(r =>
    `<tr>${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`
  ).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>EuroTrack Export</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:9pt;padding:16px;color:#111}
  h1{font-size:13pt;font-weight:700;margin-bottom:4px}
  p.sub{font-size:8pt;color:#666;margin-bottom:12px}
  table{border-collapse:collapse;width:100%;table-layout:auto}
  th,td{border:1px solid #d0d0d0;padding:3px 6px;text-align:left;white-space:nowrap}
  th{background:#1e3a5f;color:#fff;font-weight:700;font-size:8pt}
  tr:nth-child(even){background:#f5f7fa}
  @media print{
    @page{size:A4 landscape;margin:10mm}
    body{padding:0}
    .no-print{display:none}
  }
</style></head><body>
<h1>EuroTrack — ${isDE ? 'Hotel Export' : 'Hotel Export'}</h1>
<p class="sub">${new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB')} &nbsp;·&nbsp; ${hotels.length} ${isDE ? 'Hotel(s)' : 'hotel(s)'}, ${rows.length} ${isDE ? 'Buchung(en)' : 'booking(s)'}</p>
<table>
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${dataRows}</tbody>
</table>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`
}

// ── download helpers ──────────────────────────────────────────────────────────
function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportModal({ isDarkMode, lang = 'de', hotels, onClose }: ExportModalProps) {
  const dk = isDarkMode
  const [format, setFormat]     = useState<ExportFormat>('xlsx')
  const [exporting, setExporting] = useState(false)
  const [done, setDone]         = useState('')

  const t = {
    title:    lang === 'de' ? 'Export' : 'Export',
    subtitle: lang === 'de'
      ? `${hotels.length} Hotel(s) · ${(hotels.flatMap(h => h.durations ?? [])).length} Buchung(en) werden exportiert`
      : `${hotels.length} hotel(s) · ${(hotels.flatMap(h => h.durations ?? [])).length} booking(s) will be exported`,
    choose:   lang === 'de' ? 'Format wählen' : 'Choose format',
    download: lang === 'de' ? 'Herunterladen' : 'Download',
    cancel:   lang === 'de' ? 'Abbrechen' : 'Cancel',
    done:     lang === 'de' ? '✓ Download gestartet!' : '✓ Download started!',
    pdfNote:  lang === 'de'
      ? 'PDF öffnet Druckansicht — als PDF speichern wählen'
      : 'PDF opens print view — choose Save as PDF',
  }

  const formats: { id: ExportFormat; label: string; desc: string; Icon: any }[] = [
    {
      id: 'xlsx',
      label: 'Excel (.xlsx)',
      desc: lang === 'de' ? 'Tabelle mit allen Feldern und Buchungen' : 'Spreadsheet with all fields & bookings',
      Icon: FileSpreadsheet,
    },
    {
      id: 'csv',
      label: 'CSV (.csv)',
      desc: lang === 'de' ? 'Rohdaten für Import in andere Tools' : 'Raw data for import into other tools',
      Icon: FileText,
    },
    {
      id: 'pdf',
      label: 'PDF (.pdf)',
      desc: lang === 'de' ? 'Druckbares Dokument (A4 Querformat)' : 'Printable document (A4 landscape)',
      Icon: File,
    },
  ]

  async function handleExport() {
    setExporting(true)
    // Tiny delay so spinner shows
    await new Promise(r => setTimeout(r, 200))
    try {
      const stamp = new Date().toISOString().slice(0, 10)

      if (format === 'csv') {
        // UTF-8 BOM so Excel opens it correctly
        downloadBlob(
          '\uFEFF' + buildCSV(hotels, lang),
          `eurotrack-${stamp}.csv`,
          'text/csv;charset=utf-8',
        )
      } else if (format === 'xlsx') {
        const buf = buildXLSX(hotels, lang)
        downloadBlob(
          buf,
          `eurotrack-${stamp}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
      } else if (format === 'pdf') {
        const html = buildPDFHtml(hotels, lang)
        const win  = window.open('', '_blank', 'width=1100,height=750')
        if (win) {
          win.document.write(html)
          win.document.close()
          // print() is called by window.onload inside the HTML
        } else {
          // Fallback: download the HTML with print CSS so user can open + print
          downloadBlob(html, `eurotrack-${stamp}.html`, 'text/html;charset=utf-8')
        }
      }

      setDone(t.done)
      setTimeout(() => { setDone(''); onClose() }, 2000)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const surface = dk
    ? 'bg-[#0F172A] border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn('w-full max-w-sm rounded-2xl border shadow-2xl', surface)}>

        {/* ── Header ── */}
        <div className={cn('flex items-center justify-between px-5 py-4 border-b', dk ? 'border-white/10' : 'border-slate-100')}>
          <div>
            <h2 className="text-base font-black">{t.title}</h2>
            <p className={cn('text-xs mt-0.5', dk ? 'text-slate-400' : 'text-slate-500')}>{t.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Format picker ── */}
        <div className="px-5 py-4 space-y-3">
          <p className={cn('text-[10px] font-black uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
            {t.choose}
          </p>

          <div className="space-y-2">
            {formats.map(({ id, label, desc, Icon }) => (
              <button
                key={id}
                onClick={() => setFormat(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                  format === id
                    ? 'border-blue-500 bg-blue-600/10'
                    : dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  format === id ? 'bg-blue-600/20' : dk ? 'bg-white/5' : 'bg-slate-100'
                )}>
                  <Icon size={16} className={format === id ? 'text-blue-400' : dk ? 'text-slate-400' : 'text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold', format === id ? 'text-blue-400' : '')}>{label}</p>
                  <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{desc}</p>
                </div>
                {format === id && (
                  <div className="ml-auto w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* PDF note */}
          {format === 'pdf' && (
            <p className={cn('text-[11px] leading-relaxed rounded-lg px-3 py-2 border', dk ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700')}>
              ℹ️ {t.pdfNote}
            </p>
          )}

          {/* Done message */}
          {done && (
            <p className="text-green-400 text-xs font-bold text-center animate-pulse">{done}</p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-bold border transition-all',
              dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            {t.cancel}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {t.download}
          </button>
        </div>
      </div>
    </div>
  )
}
