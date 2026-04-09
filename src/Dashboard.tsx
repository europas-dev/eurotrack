import React, { useState, useEffect, useRef, useMemo } from 'react'
import { getHotels, signOut, deleteHotel, createHotel } from './lib/supabase'
import { cn } from './lib/utils'
import type { Theme, Language } from './lib/types'
import {
  Plus, Building2, Check, X, Loader2, Filter, ArrowUpDown,
  Download, Users, ChevronDown
} from 'lucide-react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { HotelRow } from './components/HotelRow'

interface DashboardProps {
  theme: Theme
  lang: Language
  toggleTheme: () => void
  setLang: (l: Language) => void
}

// ─── New Hotel Quick-Add Row ───────────────────────────────────────────────────
function NewHotelRow({
  isDarkMode, lang, onSave, onCancel
}: {
  isDarkMode: boolean
  lang: Language
  onSave: (hotel: any) => void
  onCancel: () => void
}) {
  const dk = isDarkMode
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [tag, setTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const canSave = name.trim().length > 0 && city.trim().length > 0 && tag.trim().length > 0

  const handleSave = async () => {
    if (!canSave) return
    setErr('')
    try {
      setSaving(true)
      const newHotel = await createHotel({ name: name.trim(), city: city.trim(), companyTag: tag.trim() })
      onSave({ ...newHotel, durations: [] })
    } catch (e: any) {
      setErr(e?.message || 'Failed to save')
      setSaving(false)
    }
  }

  const ic = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk
      ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
      : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  )

  return (
    <div className={cn('mb-2 rounded-xl border px-4 py-3 space-y-2', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-blue-400" />
        </div>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-52')}
        />
        <input
          type="text"
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')}
        />
        <input
          type="text"
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder="Company..."
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')}
        />
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button
          onClick={onCancel}
          className={cn('p-2 rounded-lg transition-all flex-shrink-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}
        >
          <X size={16} />
        </button>
      </div>
      {err && <p className="text-red-400 text-xs font-bold px-1">{err}</p>}
      {!canSave && (name || city || tag) && (
        <p className={cn('text-xs px-1', dk ? 'text-slate-500' : 'text-slate-400')}>
          {lang === 'de' ? 'Alle 3 Felder ausfüllen, dann ↵ drücken' : 'Fill all 3 fields then press ↵'}
        </p>
      )}
    </div>
  )
}

// ─── Calc Helpers ─────────────────────────────────────────────────────────────
function calcCost(h: any): number {
  return h.durations?.reduce((s: number, d: any) => {
    const n = Math.max(0, Math.ceil(
      (new Date(d.endDate || 0).getTime() - new Date(d.startDate || 0).getTime()) / 86400000
    ))
    return s + n * (d.pricePerNightPerRoom || 0) * (d.numberOfRooms || 1)
  }, 0) ?? 0
}

function calcNights(h: any): number {
  return h.durations?.reduce((s: number, d: any) =>
    s + Math.max(0, Math.ceil(
      (new Date(d.endDate || 0).getTime() - new Date(d.startDate || 0).getTime()) / 86400000
    )), 0) ?? 0
}

function calcFreeBeds(h: any): number {
  return h.durations?.reduce((s: number, d: any) => {
    const roomType = d.roomType || 'DZ'
    const rooms = d.numberOfRooms || 1
    const capacity =
      roomType === 'EZ' ? rooms * 1 :
      roomType === 'DZ' ? rooms * 2 :
      roomType === 'TZ' ? rooms * 3 :
      rooms // WG = manual bed count stored in numberOfRooms
    const occupied = (d.employees || []).filter((e: any) => e != null).length
    return s + Math.max(0, capacity - occupied)
  }, 0) ?? 0
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Check if a hotel has any free bed slot on a specific target date
function hasFreeBedOnDate(h: any, targetDate: Date): boolean {
  return h.durations?.some((d: any) => {
    if (!d.startDate || !d.endDate) return false
    const start = new Date(d.startDate)
    const end = new Date(d.endDate)
    if (targetDate < start || targetDate >= end) return false
    const roomType = d.roomType || 'DZ'
    const rooms = d.numberOfRooms || 1
    const capacity =
      roomType === 'EZ' ? rooms * 1 :
      roomType === 'DZ' ? rooms * 2 :
      roomType === 'TZ' ? rooms * 3 :
      rooms
    const occupied = (d.employees || []).filter((e: any) => {
      if (!e) return false
      const ci = e.checkIn ? new Date(e.checkIn) : new Date(d.startDate)
      const co = e.checkOut ? new Date(e.checkOut) : new Date(d.endDate)
      return targetDate >= ci && targetDate < co
    }).length
    return capacity > occupied
  }) ?? false
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addingHotel, setAddingHotel] = useState(false)

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'paid' | 'none'>('all')
  const [filterHasFreeBeds, setFilterHasFreeBeds] = useState(false)
  const [filterFreeToday, setFilterFreeToday] = useState(false)
  const [filterFreeTomorrow, setFilterFreeTomorrow] = useState(false)
  const [filterFreeIn5, setFilterFreeIn5] = useState(false)
  const [filterFreeIn7, setFilterFreeIn7] = useState(false)
  const [groupBy, setGroupBy] = useState<'none' | 'company' | 'city'>('none')
  const [activeGroupTab, setActiveGroupTab] = useState<string>('all')

  // ── Sort state ──────────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<'name' | 'city' | 'cost' | 'nights'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── Menu open state ─────────────────────────────────────────────────────────
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December']

  useEffect(() => { loadHotels() }, [])

  async function loadHotels() {
    try {
      setLoading(true)
      setError(null)
      const data = await getHotels()
      setHotels(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // ── Export handlers ─────────────────────────────────────────────────────────
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportCSV() {
    const rows = [
      ['Hotel','City','Company','Durations','Total Nights','Free Beds','Total Cost (EUR)'],
      ...filtered.map((h: any) => [
        h.name ?? '', h.city ?? '', h.companyTag ?? '',
        h.durations?.length ?? 0,
        calcNights(h), calcFreeBeds(h),
        calcCost(h).toFixed(2)
      ])
    ]
    const csv = rows.map((r: any[]) =>
      r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('
')
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `eurotrack-${new Date().toISOString().split('T')[0]}.csv`)
    setShowExportMenu(false)
  }

  function handleExportXLSX() {
    // Stub — replace with SheetJS when installed
    handleExportCSV()
  }

  function handleExportPDF() {
    window.print()
    setShowExportMenu(false)
  }

  function handleExportDOCX() {
    alert('DOCX export coming soon. Use XLSX or PDF for now.')
    setShowExportMenu(false)
  }

  // ── Today reference ─────────────────────────────────────────────────────────
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // ── Filtered + sorted list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = hotels.filter((h: any) => {
      // Global search across all relevant fields
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const employeeNames = h.durations?.flatMap((d: any) =>
          (d.employees || []).filter(Boolean).map((e: any) => e.name || '')
        ).join(' ') ?? ''
        const invoiceNrs = h.durations?.map((d: any) =>
          [d.rechnungNr, d.bookingId].filter(Boolean).join(' ')
        ).join(' ') ?? ''
        const text = [
          h.name, h.city, h.companyTag, h.address,
          h.contact, h.phone, h.email, h.webLink, h.notes,
          employeeNames, invoiceNrs
        ].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(q)) return false
      }

      // Month filter
      if (selectedMonth !== null) {
        const hasMonth = h.durations?.some((d: any) => {
          if (!d.startDate) return false
          const m = new Date(d.startDate).getMonth()
          const y = new Date(d.startDate).getFullYear()
          return m === selectedMonth && y === selectedYear
        })
        if (!hasMonth) return false
      }

      // Payment filters
      if (filterPaid === 'paid' && !h.durations?.every((d: any) => d.isPaid)) return false
      if (filterPaid === 'unpaid' && !h.durations?.some((d: any) => !d.isPaid)) return false

      // Deposit filters
      if (filterDeposit === 'paid' && !h.durations?.some((d: any) => d.depositEnabled && (d.depositAmount || 0) > 0)) return false
      if (filterDeposit === 'none' && !h.durations?.every((d: any) => !d.depositEnabled)) return false

      // Availability filters
      if (filterHasFreeBeds && calcFreeBeds(h) === 0) return false
      if (filterFreeToday && !hasFreeBedOnDate(h, today)) return false
      if (filterFreeTomorrow && !hasFreeBedOnDate(h, addDays(today, 1))) return false
      if (filterFreeIn5 && !hasFreeBedOnDate(h, addDays(today, 5))) return false
      if (filterFreeIn7 && !hasFreeBedOnDate(h, addDays(today, 7))) return false

      // Group by tab filter
      if (groupBy === 'company' && activeGroupTab !== 'all' && h.companyTag !== activeGroupTab) return false
      if (groupBy === 'city' && activeGroupTab !== 'all' && h.city !== activeGroupTab) return false

      return true
    })

    return [...list].sort((a: any, b: any) => {
      let va: any, vb: any
      if (sortBy === 'name') { va = a.name?.toLowerCase() ?? ''; vb = b.name?.toLowerCase() ?? '' }
      else if (sortBy === 'city') { va = a.city?.toLowerCase() ?? ''; vb = b.city?.toLowerCase() ?? '' }
      else if (sortBy === 'cost') { va = calcCost(a); vb = calcCost(b) }
      else { va = calcNights(a); vb = calcNights(b) }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1)
    })
  }, [
    hotels, searchQuery, selectedMonth, selectedYear,
    filterPaid, filterDeposit,
    filterHasFreeBeds, filterFreeToday, filterFreeTomorrow, filterFreeIn5, filterFreeIn7,
    groupBy, activeGroupTab, sortBy, sortDir, today
  ])

  // ── KPI totals (always from full hotel list, not filtered) ──────────────────
  const totalSpend = hotels.reduce((s: number, h: any) => s + calcCost(h), 0)
  const totalFreeBeds = hotels.reduce((s: number, h: any) => s + calcFreeBeds(h), 0)

  // ── Group-by tab list ───────────────────────────────────────────────────────
  const groupTabs = useMemo(() => {
    if (groupBy === 'none') return []
    const vals = new Set<string>()
    hotels.forEach((h: any) => {
      const v = groupBy === 'company' ? h.companyTag : h.city
      if (v) vals.add(v)
    })
    return Array.from(vals).sort()
  }, [hotels, groupBy])

  // ── Active filter count for badge ───────────────────────────────────────────
  const activeFilterCount = [
    filterPaid !== 'all',
    filterDeposit !== 'all',
    filterHasFreeBeds,
    filterFreeToday,
    filterFreeTomorrow,
    filterFreeIn5,
    filterFreeIn7,
    groupBy !== 'none',
  ].filter(Boolean).length

  function clearFilters() {
    setFilterPaid('all')
    setFilterDeposit('all')
    setFilterHasFreeBeds(false)
    setFilterFreeToday(false)
    setFilterFreeTomorrow(false)
    setFilterFreeIn5(false)
    setFilterFreeIn7(false)
    setGroupBy('none')
    setActiveGroupTab('all')
    setShowFilterMenu(false)
  }

  const dk = theme === 'dark'

  // ── Style helpers ───────────────────────────────────────────────────────────
  const menuCls = cn(
    'absolute top-full mt-2 right-0 z-50 rounded-xl border shadow-2xl p-3 w-64',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  )
  const menuLabel = cn(
    'text-[10px] font-bold uppercase tracking-widest mb-1 mt-2 block px-1',
    dk ? 'text-slate-500' : 'text-slate-400'
  )
  const menuBtn = (active: boolean) => cn(
    'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active
      ? 'bg-blue-600 text-white'
      : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
  )
  const divider = cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')
  const toolBtn = cn(
    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
    dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn('min-h-screen flex', dk ? 'bg-[#020617]' : 'bg-slate-50')}>

      {/* Sidebar */}
      <Sidebar
        theme={theme}
        lang={lang}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <Header
          theme={theme}
          lang={lang}
          toggleTheme={toggleTheme}
          setLang={setLang}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onExport={handleExportCSV}
          onSignOut={async () => {
            try { await signOut(); window.location.reload() } catch (e) {}
          }}
        />

        {/* ── KPI Bar ──────────────────────────────────────────────────────── */}
        <div className={cn(
          'px-6 py-4 border-b sticky top-0 z-30',
          dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200'
        )}>
          <div className="flex items-center gap-4">
            {[
              {
                label: 'Hotels',
                value: String(hotels.length),
                cls: dk ? 'text-white' : 'text-slate-900'
              },
              {
                label: lang === 'de' ? 'Freie Betten' : 'Free Beds',
                value: String(totalFreeBeds),
                cls: totalFreeBeds > 0 ? 'text-red-400' : 'text-green-400'
              },
              {
                label: lang === 'de' ? 'Gesamtkosten' : 'Total Cost',
                value: `€${totalSpend.toLocaleString('de-DE', { minimumFractionDigits: 0 })}`,
                cls: 'text-blue-400'
              },
            ].map(({ label, value, cls }) => (
              <div
                key={label}
                className={cn(
                  'flex flex-col px-5 py-3 rounded-xl border',
                  dk ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                )}
              >
                <span className={cn(
                  'text-[11px] font-bold uppercase tracking-widest mb-1',
                  dk ? 'text-slate-500' : 'text-slate-400'
                )}>
                  {label}
                </span>
                <span className={cn('text-2xl font-black leading-none', cls)}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* Toolbar row */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth !== null
                ? `${monthNames[selectedMonth]} ${selectedYear}`
                : lang === 'de' ? 'Alle Hotels' : 'All Hotels'}
            </h2>

            <div className="flex items-center gap-2 flex-wrap">

              {/* ── Filter button ── */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); setShowExportMenu(false) }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    activeFilterCount > 0
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Filter size={15} />
                  {lang === 'de' ? 'Filter' : 'Filter'}
                  {activeFilterCount > 0 && (
                    <span className="bg-white/30 rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-black">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showFilterMenu && (
                  <div className={menuCls} style={{ zIndex: 51 }}>

                    {/* Payment */}
                    <span className={menuLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</span>
                    {(['all', 'paid', 'unpaid'] as const).map(v => (
                      <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                        {v === 'all'
                          ? (lang === 'de' ? 'Alle Hotels' : 'All hotels')
                          : v === 'paid'
                            ? (lang === 'de' ? 'Bezahlt' : 'Paid')
                            : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
                      </button>
                    ))}

                    <div className={divider} />

                    {/* Deposit */}
                    <span className={menuLabel}>{lang === 'de' ? 'Kaution' : 'Deposit'}</span>
                    {([
                      { v: 'all', de: 'Alle', en: 'All' },
                      { v: 'paid', de: 'Kaution bezahlt', en: 'Deposit paid' },
                      { v: 'none', de: 'Keine Kaution', en: 'No deposit' },
                    ] as const).map(({ v, de, en }) => (
                      <button key={v} onClick={() => setFilterDeposit(v as any)} className={menuBtn(filterDeposit === v)}>
                        {lang === 'de' ? de : en}
                      </button>
                    ))}

                    <div className={divider} />

                    {/* Availability */}
                    <span className={menuLabel}>{lang === 'de' ? 'Verfügbarkeit' : 'Availability'}</span>
                    {[
                      { key: 'hasFreeBeds', de: 'Hat freie Betten', en: 'Has free beds', val: filterHasFreeBeds, set: setFilterHasFreeBeds },
                      { key: 'today', de: 'Frei heute', en: 'Free today', val: filterFreeToday, set: setFilterFreeToday },
                      { key: 'tomorrow', de: 'Frei morgen', en: 'Free tomorrow', val: filterFreeTomorrow, set: setFilterFreeTomorrow },
                      { key: 'in5', de: 'Frei in 5 Tagen', en: 'Free in 5 days', val: filterFreeIn5, set: setFilterFreeIn5 },
                      { key: 'in7', de: 'Frei in 7 Tagen', en: 'Free in 7 days', val: filterFreeIn7, set: setFilterFreeIn7 },
                    ].map(({ key, de, en, val, set }) => (
                      <button key={key} onClick={() => set(!val)} className={menuBtn(val)}>
                        {lang === 'de' ? de : en}
                      </button>
                    ))}

                    <div className={divider} />

                    {/* Group by */}
                    <span className={menuLabel}>{lang === 'de' ? 'Gruppieren nach' : 'Group by'}</span>
                    {([
                      { v: 'none', de: 'Keine Gruppierung', en: 'No grouping' },
                      { v: 'company', de: 'Nach Firma', en: 'By Company' },
                      { v: 'city', de: 'Nach Stadt', en: 'By City' },
                    ] as const).map(({ v, de, en }) => (
                      <button key={v} onClick={() => { setGroupBy(v); setActiveGroupTab('all') }} className={menuBtn(groupBy === v)}>
                        {lang === 'de' ? de : en}
                      </button>
                    ))}

                    <div className={divider} />

                    {/* Clear all */}
                    <button
                      onClick={clearFilters}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded text-xs font-bold transition-all',
                        dk ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-500'
                      )}
                    >
                      {lang === 'de' ? '✕ Filter zurücksetzen' : '✕ Clear all filters'}
                    </button>
                  </div>
                )}
              </div>

              {/* ── Sort button ── */}
              <div className="relative">
                <button
                  onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); setShowExportMenu(false) }}
                  className={toolBtn}
                >
                  <ArrowUpDown size={15} />
                  {lang === 'de' ? 'Sortieren' : 'Sort'}
                  <span className={cn('text-[10px] font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {sortBy} {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                </button>

                {showSortMenu && (
                  <div className={menuCls}>
                    <span className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</span>
                    {([
                      { v: 'name', de: 'Name', en: 'Name' },
                      { v: 'city', de: 'Stadt', en: 'City' },
                      { v: 'cost', de: 'Gesamtkosten', en: 'Total Cost' },
                      { v: 'nights', de: 'Nächte', en: 'Total Nights' },
                    ] as const).map(({ v, de, en }) => (
                      <button key={v} onClick={() => setSortBy(v)} className={menuBtn(sortBy === v)}>
                        {lang === 'de' ? de : en}
                      </button>
                    ))}
                    <div className={divider} />
                    <span className={menuLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSortDir('asc')} className={cn(menuBtn(sortDir === 'asc'), 'flex-1 text-center')}>
                        {lang === 'de' ? 'Aufsteigend ↑' : 'Asc ↑'}
                      </button>
                      <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>
                        {lang === 'de' ? 'Absteigend ↓' : 'Desc ↓'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Export button ── */}
              <div className="relative">
                <button
                  onClick={() => { setShowExportMenu(!showExportMenu); setShowFilterMenu(false); setShowSortMenu(false) }}
                  className={toolBtn}
                >
                  <Download size={15} />
                  {lang === 'de' ? 'Export' : 'Export'}
                  <ChevronDown size={13} />
                </button>

                {showExportMenu && (
                  <div className={menuCls}>
                    <span className={menuLabel}>{lang === 'de' ? 'Format wählen' : 'Choose format'}</span>
                    <button onClick={handleExportXLSX} className={menuBtn(false)}>📊 Excel / XLSX</button>
                    <button onClick={handleExportPDF} className={menuBtn(false)}>📄 PDF</button>
                    <button onClick={handleExportDOCX} className={menuBtn(false)}>📝 DOCX</button>
                    <button onClick={handleExportCSV} className={menuBtn(false)}>📋 CSV</button>
                  </div>
                )}
              </div>

              {/* ── Share button ── */}
              <button
                onClick={() => alert('Share / collaborator invite — coming soon')}
                className={toolBtn}
              >
                <Users size={15} />
                {lang === 'de' ? 'Teilen' : 'Share'}
              </button>

              {/* ── Add Hotel button ── */}
              <button
                onClick={() => setAddingHotel(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm transition-all"
              >
                <Plus size={16} />
                {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
              </button>
            </div>
          </div>

          {/* ── Group-by horizontal tab strip ──────────────────────────────── */}
          {groupBy !== 'none' && groupTabs.length > 0 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveGroupTab('all')}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 border transition-all',
                  activeGroupTab === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                )}
              >
                {lang === 'de' ? 'Alle' : 'All'}
              </button>
              {groupTabs.map((tab: string) => (
                <button
                  key={tab}
                  onClick={() => setActiveGroupTab(tab)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 border transition-all',
                    activeGroupTab === tab
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* ── Backdrop to close menus ─────────────────────────────────────── */}
          {(showFilterMenu || showSortMenu || showExportMenu) && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); setShowExportMenu(false) }}
            />
          )}

          {/* ── Loading state ───────────────────────────────────────────────── */}
          {loading && (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
            </div>
          )}

          {/* ── Error state ─────────────────────────────────────────────────── */}
          {error && (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm mb-1">Error: {error}</p>
              <button
                onClick={loadHotels}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm"
              >
                {lang === 'de' ? 'Erneut versuchen' : 'Retry'}
              </button>
            </div>
          )}

          {/* ── Hotel list ──────────────────────────────────────────────────── */}
          {!loading && !error && (
            <div className="space-y-2">

              {/* New hotel quick-add form */}
              {addingHotel && (
                <NewHotelRow
                  isDarkMode={dk}
                  lang={lang}
                  onSave={h => { setHotels(p => [h, ...p]); setAddingHotel(false) }}
                  onCancel={() => setAddingHotel(false)}
                />
              )}

              {/* Empty state */}
              {filtered.length === 0 && !addingHotel && (
                <div className={cn(
                  'text-center py-20 rounded-2xl border-2 border-dashed',
                  dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                )}>
                  <div className={cn(
                    'w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center',
                    dk ? 'bg-blue-600/20' : 'bg-blue-100'
                  )}>
                    <Building2 size={32} className="text-blue-500" />
                  </div>
                  <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                    {lang === 'de' ? 'Keine Hotels gefunden' : 'No Hotels Found'}
                  </h3>
                  <p className={cn('text-sm mb-6', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {activeFilterCount > 0
                      ? lang === 'de' ? 'Versuchen Sie, die Filter zurückzusetzen' : 'Try clearing the filters'
                      : lang === 'de' ? 'Klicken Sie auf „Hotel hinzufügen"' : 'Click Add Hotel to get started'}
                  </p>
                  {activeFilterCount > 0 ? (
                    <button
                      onClick={clearFilters}
                      className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm"
                    >
                      {lang === 'de' ? 'Filter zurücksetzen' : 'Clear filters'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setAddingHotel(true)}
                      className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm"
                    >
                      <Plus size={18} />
                      {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                    </button>
                  )}
                </div>
              )}

              {/* Hotel rows */}
              {filtered.map((hotel: any) => (
                <HotelRow
                  key={hotel.id}
                  entry={hotel}
                  isDarkMode={dk}
                  lang={lang}
                  showPaymentTotals={filterPaid !== 'all'}
                  companyOptions={[...new Set(hotels.map((h: any) => h.companyTag).filter(Boolean))] as string[]}
                  cityOptions={[...new Set(hotels.map((h: any) => h.city).filter(Boolean))] as string[]}
                  onDelete={id => { deleteHotel(id); setHotels(p => p.filter((h: any) => h.id !== id)) }}
                  onUpdate={(id, u) => setHotels(p => p.map((h: any) => h.id === id ? { ...h, ...u } : h))}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
