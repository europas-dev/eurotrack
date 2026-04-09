// src/components/ExportModal.tsx
import React, { useState } from 'react'
import { X, FileText, FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import { cn, calcHotelTotalCost, calcHotelTotalNights, calcHotelFreeBeds, formatCurrency } from '../lib/utils'

interface ExportModalProps {
  isDarkMode: boolean
  lang?: 'de' | 'en'
  hotels: any[]
  onClose: () => void
}

type ExportFormat = 'csv' | 'pdf' | 'xlsx'

export default function ExportModal({ isDarkMode, lang = 'de', hotels, onClose }: ExportModalProps) {
  const dk = isDarkMode
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState('')

  const t = {
    title:     lang === 'de' ? 'Export' : 'Export',
    subtitle:  lang === 'de' ? `${hotels.length} Hotel(s) werden exportiert` : `Exporting ${hotels.length} hotel(s)`,
    choose:    lang === 'de' ? 'Format wählen' : 'Choose format',
    download:  lang === 'de' ? 'Herunterladen' : 'Download',
    cancel:    lang === 'de' ? 'Abbrechen' : 'Cancel',
    done:      lang === 'de' ? 'Download gestartet!' : 'Download started!',
  }

  const formats: { id: ExportFormat; label: string; desc: string; Icon: any }[] = [
    { id: 'xlsx', label: 'Excel (.xlsx)', desc: lang === 'de' ? 'Tabelle mit allen Daten' : 'Spreadsheet with all data', Icon: FileSpreadsheet },
    { id: 'csv',  label: 'CSV (.csv)',    desc: lang === 'de' ? 'Rohdaten für Import' : 'Raw data for import',        Icon: FileText },
    { id: 'pdf',  label: 'PDF (.pdf)',    desc: lang === 'de' ? 'Druckbares Dokument' : 'Printable document',          Icon: FileText },
  ]

  function buildCSV(): string {
    const header = ['Hotel','Stadt','Firma','Nächte','Kosten','Freie Betten','Status']
    const rows = hotels.map(h => [
      h.name, h.city, h.companyTag ?? '',
      calcHotelTotalNights(h),
      calcHotelTotalCost(h).toFixed(2),
      calcHotelFreeBeds(h),
      h.durations.every((d: any) => d.isPaid) ? 'Bezahlt' : 'Ausstehend',
    ])
    return [header, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function buildHTMLTable(): string {
    const rows = hotels.map(h => `
      <tr>
        <td>${h.name}</td><td>${h.city}</td><td>${h.companyTag ?? ''}</td>
        <td>${calcHotelTotalNights(h)}</td>
        <td>${formatCurrency(calcHotelTotalCost(h))}</td>
        <td>${calcHotelFreeBeds(h)}</td>
        <td>${h.durations.every((d: any) => d.isPaid) ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Ausstehend' : 'Pending')}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EuroTrack Export</title>
<style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:16px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
th{background:#f5f5f5;font-weight:700}</style></head>
<body><h1>EuroTrack — Hotel Export (${new Date().toLocaleDateString()})</h1>
<table><thead><tr><th>Hotel</th><th>${lang==='de'?'Stadt':'City'}</th><th>${lang==='de'?'Firma':'Company'}</th><th>${lang==='de'?'Nächte':'Nights'}</th><th>${lang==='de'?'Kosten':'Cost'}</th><th>${lang==='de'?'Freie Betten':'Free Beds'}</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`
  }

  async function handleExport() {
    setExporting(true)
    await new Promise(r => setTimeout(r, 400))
    try {
      if (format === 'csv') {
        downloadBlob(buildCSV(), `eurotrack-export-${Date.now()}.csv`, 'text/csv')
      } else if (format === 'pdf') {
        // Opens print dialog of HTML representation — best cross-browser PDF without a server
        const html = buildHTMLTable()
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close(); win.print() }
      } else if (format === 'xlsx') {
        // CSV-based fallback (real XLSX needs SheetJS on client)
        // Produces a UTF-8 CSV that Excel opens correctly
        downloadBlob('\uFEFF' + buildCSV(), `eurotrack-export-${Date.now()}.csv`, 'text/csv;charset=utf-8')
      }
      setDone(t.done)
      setTimeout(() => { setDone(''); onClose() }, 1800)
    } catch { /* ignore */ }
    finally { setExporting(false) }
  }

  const surface = dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn('w-full max-w-sm rounded-2xl border shadow-2xl', surface)}>

        {/* Header */}
        <div className={cn('flex items-center justify-between px-5 py-4 border-b', dk ? 'border-white/10' : 'border-slate-100')}>
          <div>
            <h2 className="text-base font-black">{t.title}</h2>
            <p className={cn('text-xs mt-0.5', dk ? 'text-slate-400' : 'text-slate-500')}>{t.subtitle}</p>
          </div>
          <button onClick={onClose} className={cn('p-2 rounded-lg transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className={cn('text-xs font-black uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>{t.choose}</p>

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
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  format === id ? 'bg-blue-600/20' : dk ? 'bg-white/5' : 'bg-slate-100'
                )}>
                  <Icon size={16} className={format === id ? 'text-blue-400' : dk ? 'text-slate-400' : 'text-slate-500'} />
                </div>
                <div>
                  <p className={cn('text-sm font-bold', format === id ? 'text-blue-400' : '')}>{label}</p>
                  <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>{desc}</p>
                </div>
                {format === id && <div className="ml-auto w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>}
              </button>
            ))}
          </div>

          {done && <p className="text-green-400 text-xs font-bold text-center">{done}</p>}
        </div>

        {/* Footer */}
        <div className={cn('px-5 pb-5 flex gap-2', dk ? '' : '')}>
          <button
            onClick={onClose}
            className={cn('flex-1 py-2 rounded-xl text-sm font-bold border transition-all',
              dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            {t.cancel}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {t.download}
          </button>
        </div>
      </div>
    </div>
  )
}
