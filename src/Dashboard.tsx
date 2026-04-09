// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  getHotels, signOut, deleteHotel, createHotel
} from './lib/supabase'
import {
  cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights,
  calcHotelPaidCost, calcHotelUnpaidCost,
  hotelHasFreeBedsToday, hotelHasFreeBedsTomorrow,
  hotelHasFreeBedsIn5Days, hotelHasFreeBedsIn7Days,
  hotelMatchesSearch, formatCurrency
} from './lib/utils'
import type { Theme, Language, FilterPaid, FilterDeposit, FilterFree, GroupBy, SortBy } from './lib/types'
import {
  Plus, Building2, Check, X, Loader2,
  Filter, ArrowUpDown, Download, Users, Share2
} from 'lucide-react'
import { Header }   from './components/Header'
import { Sidebar }  from './components/Sidebar'
import { HotelRow } from './components/HotelRow'
import { ShareModal }  from './components/ShareModal'
import { ExportModal } from './components/ExportModal'

// ─── Props ────────────────────────────────────────────────────────────────────
interface DashboardProps {
  theme: Theme
  lang: Language
  toggleTheme: () => void
  setLang: (l: Language) => void
}

// ─── New hotel inline row ─────────────────────────────────────────────────────
function NewHotelRow({ isDarkMode, lang, onSave, onCancel }: {
  isDarkMode: boolean; lang: Language
  onSave: (hotel: any) => void; onCancel: () => void
}) {
  const dk = isDarkMode
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [tag,  setTag]  = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const canSave = name.trim().length > 0 && city.trim().length > 0 && tag.trim().length > 0

  async function handleSave() {
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
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  )

  return (
    <div className={cn('mb-2 rounded-xl border px-4 py-3 space-y-2', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-blue-400" />
        </div>
        <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()} className={cn(ic, 'w-52')} />
        <input type="text" value={city} onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()} className={cn(ic, 'w-36')} />
        <input type="text" value={tag} onChange={e => setTag(e.target.value)}
          placeholder={lang === 'de' ? 'Firma...' : 'Company...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()} className={cn(ic, 'w-36')} />
        <button onClick={handleSave} disabled={saving || !canSave}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button onClick={onCancel} className={cn('p-2 rounded-lg transition-all flex-shrink-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const dk = theme === 'dark'

  // Data
  const [hotels,  setHotels]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // Sidebar
  const [selectedYear,       setSelectedYear]       = useState(2026)
  const [selectedMonth,      setSelectedMonth]      = useState<number | null>(null)
  const [sidebarCollapsed,   setSidebarCollapsed]   = useState(false)

  // UI state
  const [addingHotel,     setAddingHotel]     = useState(false)
  const [showFilterMenu,  setShowFilterMenu]  = useState(false)
  const [showSortMenu,    setShowSortMenu]    = useState(false)
  const [showShareModal,  setShowShareModal]  = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Filters
  const [filterPaid,    setFilterPaid]    = useState<FilterPaid>('all')
  const [filterDeposit, setFilterDeposit] = useState<FilterDeposit>('all')
  const [filterFree,    setFilterFree]    = useState<FilterFree>('none')

  // Group by
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [activeGroupTab, setActiveGroupTab] = useState<string | null>(null)

  // Sort
  const [sortBy,  setSortBy]  = useState<SortBy>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December']

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => { loadHotels() }, [])

  async function loadHotels() {
    try {
      setLoading(true); setError('')
      const data = await getHotels()
      setHotels(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // ── Filter + Search + Sort ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = hotels.filter(h => {
      // Search
      if (!hotelMatchesSearch(h, searchQuery)) return false

      // Payment filter
      if (filterPaid === 'paid'   && !h.durations.every((d: any) => d.isPaid))  return false
      if (filterPaid === 'unpaid' &&  h.durations.every((d: any) => d.isPaid))  return false

      // Deposit filter
      if (filterDeposit === 'deposit'    && !h.durations.some((d: any) => d.depositEnabled)) return false
      if (filterDeposit === 'no-deposit' &&  h.durations.some((d: any) => d.depositEnabled)) return false

      // Free beds filter
      if (filterFree === 'today'    && !hotelHasFreeBedsToday(h))    return false
      if (filterFree === 'tomorrow' && !hotelHasFreeBedsTomorrow(h)) return false
      if (filterFree === 'in5days'  && !hotelHasFreeBedsIn5Days(h))  return false
      if (filterFree === 'in7days'  && !hotelHasFreeBedsIn7Days(h))  return false

      return true
    })

    // Sort
    list = [...list].sort((a, b) => {
      let va: any, vb: any
      if      (sortBy === 'name')   { va = (a.name ?? '').toLowerCase();    vb = (b.name ?? '').toLowerCase() }
      else if (sortBy === 'city')   { va = (a.city ?? '').toLowerCase();    vb = (b.city ?? '').toLowerCase() }
      else if (sortBy === 'cost')   { va = calcHotelTotalCost(a);           vb = calcHotelTotalCost(b) }
      else if (sortBy === 'nights') { va = calcHotelTotalNights(a);         vb = calcHotelTotalNights(b) }
      else { va = a.name ?? ''; vb = b.name ?? '' }
      const dir = sortDir === 'asc' ? 1 : -1
      return va < vb ? -dir : va > vb ? dir : 0
    })

    return list
  }, [hotels, searchQuery, filterPaid, filterDeposit, filterFree, sortBy, sortDir])

  // ── Group by tabs ────────────────────────────────────────────────────────────
  const groupTabs = useMemo(() => {
    if (groupBy === 'none') return []
    const key = groupBy === 'company' ? 'companyTag' : 'city'
    const vals = Array.from(new Set(filtered.map((h: any) => h[key] || '—'))).sort() as string[]
    return vals
  }, [filtered, groupBy])

  const visibleHotels = useMemo(() => {
    if (groupBy === 'none' || !activeGroupTab) return filtered
    const key = groupBy === 'company' ? 'companyTag' : 'city'
    return filtered.filter((h: any) => (h[key] || '—') === activeGroupTab)
  }, [filtered, groupBy, activeGroupTab])

  // Reset active tab when group changes
  useEffect(() => {
    setActiveGroupTab(groupTabs[0] ?? null)
  }, [groupBy, groupTabs.join(',')])

  // ── KPI totals ───────────────────────────────────────────────────────────────
  const totalSpend = hotels.reduce((s, h) => s + calcHotelTotalCost(h), 0)
  const freeBeds   = hotels.reduce((s, h) => s + calcHotelFreeBeds(h), 0)

  // ── Active filter count (for badge) ─────────────────────────────────────────
  const activeFilters = [
    filterPaid !== 'all', filterDeposit !== 'all', filterFree !== 'none'
  ].filter(Boolean).length

  // ── Autocomplete options ─────────────────────────────────────────────────────
  const cityOptions    = Array.from(new Set(hotels.map(h => h.city).filter(Boolean))) as string[]
  const companyOptions = Array.from(new Set(hotels.map(h => h.companyTag).filter(Boolean))) as string[]

  // ── Shared menu styles ───────────────────────────────────────────────────────
  const menuCls = cn(
    'absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[220px] space-y-1',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  )
  const menuLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2 block px-1', dk ? 'text-slate-500' : 'text-slate-400')
  const menuBtn = (active: boolean) => cn(
    'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
  )

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn('min-h-screen flex', dk ? 'bg-[#020617]' : 'bg-slate-50')}>

      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col min-w-0">

        <Header
          theme={theme} lang={lang}
          toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onExport={() => setShowExportModal(true)}
          onShare={() => setShowShareModal(true)}
          onSignOut={async () => { try { await signOut(); window.location.reload() } catch(e) {} }}
        />

        {/* ── KPI bar ───────────────────────────────────────────────────────── */}
        <div className={cn('px-8 py-3 border-b flex items-center gap-10', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          {[
            { label: lang === 'de' ? 'Freie Betten' : 'Free Beds',   value: String(freeBeds),  cls: freeBeds > 0 ? 'text-amber-400' : 'text-green-400' },
            { label: lang === 'de' ? 'Gesamt' : 'Total Spent',       value: formatCurrency(totalSpend), cls: 'text-blue-400' },
            { label: 'Hotels',                                         value: String(hotels.length), cls: dk ? 'text-white' : 'text-slate-900' },
          ].map(({ label, value, cls }) => (
            <div key={label}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
              <p className={cn('text-xl font-black', cls)}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth !== null ? `${monthNames[selectedMonth]} ${selectedYear}` : 'Dashboard'}
            </h2>

            <div className="flex items-center gap-2 flex-wrap">

              {/* Filter */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(v => !v); setShowSortMenu(false) }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    activeFilters > 0
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Filter size={15} />
                  {lang === 'de' ? 'Filter' : 'Filter'}
                  {activeFilters > 0 && (
                    <span className="bg-white/30 rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{activeFilters}</span>
                  )}
                </button>

                {showFilterMenu && (
                  <div className={menuCls}>
                    {/* Payment */}
                    <span className={menuLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</span>
                    {(['all', 'paid', 'unpaid'] as FilterPaid[]).map(v => (
                      <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                        {v === 'all' ? (lang === 'de' ? 'Alle Hotels' : 'All hotels')
                          : v === 'paid' ? (lang === 'de' ? 'Vollständig bezahlt' : 'Fully paid')
                          : (lang === 'de' ? 'Hat unbezahlt' : 'Has unpaid')}
                      </button>
                    ))}

                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />

                    {/* Deposit */}
                    <span className={menuLabel}>{lang === 'de' ? 'Kaution' : 'Deposit'}</span>
                    {(['all', 'deposit', 'no-deposit'] as FilterDeposit[]).map(v => (
                      <button key={v} onClick={() => setFilterDeposit(v)} className={menuBtn(filterDeposit === v)}>
                        {v === 'all' ? (lang === 'de' ? 'Alle' : 'All')
                          : v === 'deposit' ? (lang === 'de' ? 'Kaution bezahlt' : 'Deposit paid')
                          : (lang === 'de' ? 'Keine Kaution' : 'No deposit')}
                      </button>
                    ))}

                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />

                    {/* Availability */}
                    <span className={menuLabel}>{lang === 'de' ? 'Verfügbarkeit' : 'Availability'}</span>
                    {([
                      ['none',     lang === 'de' ? 'Alle'           : 'All'],
                      ['today',    lang === 'de' ? 'Frei heute'     : 'Free today'],
                      ['tomorrow', lang === 'de' ? 'Frei morgen'    : 'Free tomorrow'],
                      ['in5days',  lang === 'de' ? 'Frei in 5 Tagen' : 'Free in 5 days'],
                      ['in7days',  lang === 'de' ? 'Frei in 7 Tagen' : 'Free in 7 days'],
                    ] as [FilterFree, string][]).map(([v, label]) => (
                      <button key={v} onClick={() => setFilterFree(v)} className={menuBtn(filterFree === v)}>{label}</button>
                    ))}

                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />

                    {/* Group by */}
                    <span className={menuLabel}>{lang === 'de' ? 'Gruppieren nach' : 'Group by'}</span>
                    {([
                      ['none',    lang === 'de' ? 'Keine Gruppierung' : 'No grouping'],
                      ['company', lang === 'de' ? 'Nach Firma'        : 'By company'],
                      ['city',    lang === 'de' ? 'Nach Stadt'        : 'By city'],
                    ] as [GroupBy, string][]).map(([v, label]) => (
                      <button key={v} onClick={() => setGroupBy(v)} className={menuBtn(groupBy === v)}>{label}</button>
                    ))}

                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />

                    {/* Clear all */}
                    <button
                      onClick={() => { setFilterPaid('all'); setFilterDeposit('all'); setFilterFree('none'); setGroupBy('none'); setShowFilterMenu(false) }}
                      className={cn('w-full text-left px-3 py-1.5 rounded text-xs mt-1 transition-all', dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}
                    >
                      {lang === 'de' ? 'Alle Filter zurücksetzen' : 'Clear all filters'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false) }}
                  className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}
                >
                  <ArrowUpDown size={15} />
                  {lang === 'de' ? 'Sortieren' : 'Sort'}
                  <span className={cn('text-[10px] font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>{sortBy} {sortDir === 'asc' ? '↑' : '↓'}</span>
                </button>

                {showSortMenu && (
                  <div className={menuCls}>
                    <span className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</span>
                    {([['name','Name'],['city','City'],['cost','Total Cost'],['nights','Total Nights']] as [SortBy, string][]).map(([v, label]) => (
                      <button key={v} onClick={() => setSortBy(v)} className={menuBtn(sortBy === v)}>{label}</button>
                    ))}
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <span className={menuLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSortDir('asc')}  className={cn(menuBtn(sortDir === 'asc'),  'flex-1 text-center')}>Asc ↑</button>
                      <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>Desc ↓</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export */}
              <button
                onClick={() => setShowExportModal(true)}
                className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}
              >
                <Download size={15} />
                {lang === 'de' ? 'Export' : 'Export'}
              </button>

              {/* Share */}
              <button
                onClick={() => setShowShareModal(true)}
                className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all', dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}
              >
                <Users size={15} />
                {lang === 'de' ? 'Teilen' : 'Share'}
              </button>

              {/* Add Hotel */}
              <button
                onClick={() => setAddingHotel(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm"
              >
                <Plus size={16} />
                {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
              </button>
            </div>
          </div>

          {/* Close menus backdrop */}
          {(showFilterMenu || showSortMenu) && (
            <div className="fixed inset-0 z-40" onClick={() => { setShowFilterMenu(false); setShowSortMenu(false) }} />
          )}

          {/* Group by tabs */}
          {groupBy !== 'none' && groupTabs.length > 0 && (
            <div className={cn('flex gap-1 mb-4 border-b pb-0', dk ? 'border-white/10' : 'border-slate-200')}>
              {groupTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveGroupTab(tab)}
                  className={cn(
                    'px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-all whitespace-nowrap',
                    activeGroupTab === tab
                      ? 'border-blue-500 text-blue-500'
                      : dk ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm mb-1">{error}</p>
              <button onClick={loadHotels} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Retry</button>
            </div>
          )}

          {/* Hotel list */}
          {!loading && !error && (
            <div className="space-y-2">
              {addingHotel && (
                <NewHotelRow isDarkMode={dk} lang={lang}
                  onSave={h => { setHotels(p => [h, ...p]); setAddingHotel(false) }}
                  onCancel={() => setAddingHotel(false)}
                />
              )}

              {/* Empty state */}
              {visibleHotels.length === 0 && !addingHotel && (
                <div className={cn('text-center py-20 rounded-2xl border-2 border-dashed', dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}>
                  <div className={cn('w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center', dk ? 'bg-blue-600/20' : 'bg-blue-100')}>
                    <Building2 size={32} className="text-blue-500" />
                  </div>
                  <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                    {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
                  </h3>
                  <p className={cn('text-sm mb-6', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Klicken Sie auf „Hotel hinzufügen"' : 'Click Add Hotel to get started'}
                  </p>
                  <button onClick={() => setAddingHotel(true)}
                    className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm">
                    <Plus size={18} />
                    {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                  </button>
                </div>
              )}

              {visibleHotels.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  entry={hotel}
                  isDarkMode={dk}
                  lang={lang}
                  cityOptions={cityOptions}
                  companyOptions={companyOptions}
                  filterPaid={filterPaid}
                  onDelete={id => { deleteHotel(id); setHotels(p => p.filter(h => h.id !== id)) }}
                  onUpdate={(id, u) => setHotels(p => p.map(h => h.id === id ? { ...h, ...u } : h))}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showShareModal  && <ShareModal  isDarkMode={dk} lang={lang} onClose={() => setShowShareModal(false)} />}
      {showExportModal && <ExportModal isDarkMode={dk} lang={lang} hotels={visibleHotels} onClose={() => setShowExportModal(false)} />}
    </div>
  )
}
