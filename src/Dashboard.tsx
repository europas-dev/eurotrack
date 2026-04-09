// src/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  getHotels, signOut, deleteHotel, createHotel
} from './lib/supabase'
import {
  cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights,
  hotelHasFreeBedsToday, hotelHasFreeBedsTomorrow,
  hotelHasFreeBedsIn5Days, hotelHasFreeBedsIn7Days,
  hotelMatchesSearch, formatCurrency
} from './lib/utils'
import type { FilterPaid, FilterDeposit, FilterFree, GroupBy } from './lib/types'
import {
  Plus, Building2, Check, X, Loader2,
  Filter, ArrowUpDown, Download, Users, WifiOff, Wifi
} from 'lucide-react'
import Header     from './components/Header'
import Sidebar    from './components/Sidebar'
import HotelRow   from './components/HotelRow'
import ShareModal   from './components/ShareModal'
import ExportModal  from './components/ExportModal'

type SortBy   = 'name' | 'city' | 'cost' | 'nights'
type Theme    = 'dark' | 'light'
type Language = 'de' | 'en'

interface DashboardProps {
  theme: Theme
  lang: Language
  toggleTheme: () => void
  setLang: (l: Language) => void
  offlineMode?: boolean
  onToggleOfflineMode?: () => void
}

// ─── Inline new-hotel row ─────────────────────────────────────────────────────
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
      if (!newHotel || !newHotel.id) throw new Error('Hotel creation returned no data')
      onSave(newHotel)
    } catch (e: any) {
      setErr(e?.message || 'Failed to create hotel')
      setSaving(false)
    }
  }

  const ic = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  )

  return (
    <div className={cn('mb-2 rounded-xl border px-4 py-3 space-y-2',
      dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-blue-400" />
        </div>
        <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
          placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()} className={cn(ic, 'w-52')} />
        <input value={city} onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()} className={cn(ic, 'w-36')} />
        <input value={tag} onChange={e => setTag(e.target.value)}
          placeholder={lang === 'de' ? 'Firma...' : 'Company...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()} className={cn(ic, 'w-36')} />
        <button onClick={handleSave} disabled={saving || !canSave}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button onClick={onCancel}
          className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
          <X size={16} />
        </button>
      </div>
      {err && <p className="text-red-400 text-xs font-bold px-1">{err}</p>}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ theme, lang, toggleTheme, setLang, offlineMode = false, onToggleOfflineMode }: DashboardProps) {
  const dk = theme === 'dark'

  const [hotels,  setHotels]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [addingHotel,     setAddingHotel]     = useState(false)
  const [showFilterMenu,  setShowFilterMenu]  = useState(false)
  const [showSortMenu,    setShowSortMenu]    = useState(false)
  const [showShareModal,  setShowShareModal]  = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [filterPaid,    setFilterPaid]    = useState<FilterPaid>('all')
  const [filterDeposit, setFilterDeposit] = useState<FilterDeposit>('all')
  const [filterFree,    setFilterFree]    = useState<FilterFree>('none')
  const [groupBy,       setGroupBy]       = useState<GroupBy>('none')
  const [activeGroupTab, setActiveGroupTab] = useState<string | null>(null)
  const [sortBy,  setSortBy]  = useState<SortBy>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December']

  useEffect(() => { loadHotels() }, [])

  async function loadHotels() {
    try { setLoading(true); setError(''); setHotels(await getHotels()) }
    catch (e: any) { setError(e.message || 'Failed to load') }
    finally { setLoading(false) }
  }

  // Derived: unique company/city lists for autocomplete
  const companyOptions = useMemo(() => Array.from(new Set(hotels.map((h: any) => h.companyTag).filter(Boolean))).sort() as string[], [hotels])
  const cityOptions    = useMemo(() => Array.from(new Set(hotels.map((h: any) => h.city).filter(Boolean))).sort() as string[], [hotels])

  const filtered = useMemo(() => {
    let list = (hotels ?? []).filter(h => {
      if (!h || !h.id) return false
      if (!hotelMatchesSearch(h, searchQuery)) return false
      if (filterPaid    === 'paid'       && !(h.durations ?? []).every((d: any) => d?.isPaid))          return false
      if (filterPaid    === 'unpaid'     &&  (h.durations ?? []).every((d: any) => d?.isPaid))          return false
      if (filterDeposit === 'deposit'    && !(h.durations ?? []).some((d: any) => d?.depositEnabled))   return false
      if (filterDeposit === 'no-deposit' &&  (h.durations ?? []).some((d: any) => d?.depositEnabled))   return false
      if (filterFree    === 'today'      && !hotelHasFreeBedsToday(h))    return false
      if (filterFree    === 'tomorrow'   && !hotelHasFreeBedsTomorrow(h)) return false
      if (filterFree    === 'in5days'    && !hotelHasFreeBedsIn5Days(h))  return false
      if (filterFree    === 'in7days'    && !hotelHasFreeBedsIn7Days(h))  return false
      return true
    })
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      let va: any, vb: any
      if      (sortBy === 'name')   { va = (a.name ?? '').toLowerCase(); vb = (b.name ?? '').toLowerCase() }
      else if (sortBy === 'city')   { va = (a.city ?? '').toLowerCase(); vb = (b.city ?? '').toLowerCase() }
      else if (sortBy === 'cost')   { va = calcHotelTotalCost(a);        vb = calcHotelTotalCost(b) }
      else if (sortBy === 'nights') { va = calcHotelTotalNights(a);      vb = calcHotelTotalNights(b) }
      else                          { va = a.name ?? '';                  vb = b.name ?? '' }
      return va < vb ? -dir : va > vb ? dir : 0
    })
  }, [hotels, searchQuery, filterPaid, filterDeposit, filterFree, sortBy, sortDir])

  const groupTabs = useMemo(() => {
    if (groupBy === 'none') return []
    const key = groupBy === 'company' ? 'companyTag' : 'city'
    return Array.from(new Set(filtered.map((h: any) => h[key] || '—'))).sort() as string[]
  }, [filtered, groupBy])

  const visibleHotels = useMemo(() => {
    if (groupBy === 'none' || !activeGroupTab) return filtered
    const key = groupBy === 'company' ? 'companyTag' : 'city'
    return filtered.filter((h: any) => (h[key] || '—') === activeGroupTab)
  }, [filtered, groupBy, activeGroupTab])

  useEffect(() => { setActiveGroupTab(groupTabs[0] ?? null) }, [groupBy, groupTabs.length])

  const totalSpend = (hotels ?? []).reduce((s, h) => s + calcHotelTotalCost(h), 0)
  const freeBeds   = (hotels ?? []).reduce((s, h) => s + calcHotelFreeBeds(h), 0)
  const activeFilters = [filterPaid !== 'all', filterDeposit !== 'all', filterFree !== 'none'].filter(Boolean).length

  const menuCls = cn(
    'absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[240px]',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  )
  const sectionLabel = cn('text-[10px] font-bold uppercase tracking-widest block px-1 mb-1 mt-2', dk ? 'text-slate-500' : 'text-slate-400')
  const menuBtn = (active: boolean) => cn(
    'w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
  )
  const toolbarBtn = cn(
    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
    dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
  )

  return (
    <div className={cn('h-full flex', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          theme={theme} lang={lang}
          toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onExport={() => setShowExportModal(true)}
          onShare={() => setShowShareModal(true)}
          onSignOut={async () => { try { await signOut(); window.location.reload() } catch(e){} }}
        />

        {/* KPI bar */}
        <div className={cn('px-8 py-3 border-b flex items-center gap-10', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          {[
            { label: lang === 'de' ? 'Freie Betten' : 'Free Beds', value: String(freeBeds), cls: freeBeds > 0 ? 'text-amber-400' : 'text-green-400' },
            { label: lang === 'de' ? 'Gesamt'       : 'Total',     value: formatCurrency(totalSpend), cls: 'text-blue-400' },
            { label: 'Hotels',                                       value: String(hotels.length), cls: dk ? 'text-white' : 'text-slate-900' },
          ].map(({ label, value, cls }) => (
            <div key={label}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
              <p className={cn('text-xl font-black', cls)}>{value}</p>
            </div>
          ))}

          <div className="ml-auto">
            <button
              onClick={onToggleOfflineMode}
              title={offlineMode
                ? (lang === 'de' ? 'Online gehen' : 'Go online')
                : (lang === 'de' ? 'Offline-Modus aktivieren' : 'Enable offline mode')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                offlineMode
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                  : dk ? 'border-white/10 text-slate-500 hover:bg-white/5 hover:text-slate-300'
                       : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              {offlineMode
                ? <><WifiOff size={13} /> {lang === 'de' ? 'Offline' : 'Offline'}</>
                : <><Wifi    size={13} /> {lang === 'de' ? 'Offline-Modus' : 'Offline Mode'}</>
              }
            </button>
          </div>
        </div>

        {/* Main */}
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
                    activeFilters > 0 || groupBy !== 'none'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Filter size={15} />
                  Filter
                  {(activeFilters > 0 || groupBy !== 'none') && (
                    <span className="bg-white/30 rounded-full w-5 h-5 text-[9px] font-black flex items-center justify-center">
                      {activeFilters + (groupBy !== 'none' ? 1 : 0)}
                    </span>
                  )}
                </button>

                {showFilterMenu && (
                  <div className={menuCls}>
                    <span className={sectionLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</span>
                    {(['all','paid','unpaid'] as FilterPaid[]).map(v => (
                      <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                        {{ all: lang==='de'?'Alle':'All', paid: lang==='de'?'Bezahlt':'Paid', unpaid: lang==='de'?'Unbezahlt':'Unpaid' }[v]}
                      </button>
                    ))}

                    <span className={sectionLabel}>{lang === 'de' ? 'Kaution' : 'Deposit'}</span>
                    {(['all','deposit','no-deposit'] as FilterDeposit[]).map(v => (
                      <button key={v} onClick={() => setFilterDeposit(v)} className={menuBtn(filterDeposit === v)}>
                        {{ all: lang==='de'?'Alle':'All', deposit: lang==='de'?'Mit Kaution':'With deposit', 'no-deposit': lang==='de'?'Ohne Kaution':'No deposit' }[v]}
                      </button>
                    ))}

                    <span className={sectionLabel}>{lang === 'de' ? 'Freie Betten' : 'Availability'}</span>
                    {([
                      ['none',    lang==='de'?'Alle':'All'],
                      ['today',   lang==='de'?'Heute frei':'Free today'],
                      ['tomorrow',lang==='de'?'Morgen frei':'Free tomorrow'],
                      ['in5days', lang==='de'?'In 5 Tagen':'In 5 days'],
                      ['in7days', lang==='de'?'In 7 Tagen':'In 7 days'],
                    ] as [FilterFree,string][]).map(([v,label]) => (
                      <button key={v} onClick={() => setFilterFree(v as FilterFree)} className={menuBtn(filterFree === v)}>{label}</button>
                    ))}

                    <div className={cn('border-t mt-3 mb-2', dk ? 'border-white/10' : 'border-slate-100')} />

                    <span className={sectionLabel}>{lang === 'de' ? 'Gruppieren nach' : 'Group by'}</span>
                    {([
                      ['none',    lang==='de'?'Kein Gruppieren':'No grouping'],
                      ['company', lang==='de'?'Nach Firma':'By company'],
                      ['city',    lang==='de'?'Nach Stadt':'By city'],
                    ] as [GroupBy,string][]).map(([v,label]) => (
                      <button key={v} onClick={() => setGroupBy(v as GroupBy)} className={menuBtn(groupBy === v)}>{label}</button>
                    ))}

                    <div className={cn('border-t mt-3 mb-1', dk ? 'border-white/10' : 'border-slate-100')} />
                    <button
                      onClick={() => { setFilterPaid('all'); setFilterDeposit('all'); setFilterFree('none'); setGroupBy('none'); setShowFilterMenu(false) }}
                      className={cn('w-full text-left px-3 py-1 rounded text-xs font-bold transition-all mt-1',
                        dk ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500')}
                    >
                      {lang === 'de' ? '✕  Alle Filter zurücksetzen' : '✕  Clear all filters'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <button onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false) }} className={toolbarBtn}>
                  <ArrowUpDown size={15} />
                  {lang === 'de' ? 'Sortieren' : 'Sort'}
                  <span className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                </button>
                {showSortMenu && (
                  <div className={menuCls}>
                    <span className={sectionLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</span>
                    {([['name','Name'],['city','City'],['cost',lang==='de'?'Kosten':'Cost'],['nights',lang==='de'?'Nächte':'Nights']] as [SortBy,string][]).map(([v,label]) => (
                      <button key={v} onClick={() => setSortBy(v)} className={menuBtn(sortBy === v)}>{label}</button>
                    ))}
                    <span className={sectionLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setSortDir('asc')}  className={cn(menuBtn(sortDir === 'asc'),  'flex-1 text-center')}>↑ {lang==='de'?'Aufst.':'Asc'}</button>
                      <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>↓ {lang==='de'?'Abst.':'Desc'}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export */}
              <button onClick={() => setShowExportModal(true)} className={toolbarBtn}>
                <Download size={15} />
                {lang === 'de' ? 'Export' : 'Export'}
              </button>

              {/* Share */}
              <button onClick={() => setShowShareModal(true)} className={toolbarBtn}>
                <Users size={15} />
                {lang === 'de' ? 'Teilen' : 'Share'}
              </button>

              {/* Add Hotel */}
              <button onClick={() => setAddingHotel(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm">
                <Plus size={16} />
                {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
              </button>
            </div>
          </div>

          {/* Group tabs */}
          {groupBy !== 'none' && groupTabs.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {groupTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveGroupTab(tab)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-bold border transition-all',
                    activeGroupTab === tab
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-4">
              <p className="text-red-400 text-sm font-bold mb-2">{error}</p>
              <button onClick={loadHotels} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg">Retry</button>
            </div>
          )}

          {/* Loading */}
          {loading && !error && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
          )}

          {/* New hotel inline row */}
          {addingHotel && (
            <NewHotelRow
              isDarkMode={dk} lang={lang}
              onSave={h => { setHotels(prev => [h, ...prev]); setAddingHotel(false) }}
              onCancel={() => setAddingHotel(false)}
            />
          )}

          {/* Hotel list */}
          {!loading && !error && (
            <div className="space-y-2">
              {visibleHotels.length === 0 && !addingHotel && (
                <div className={cn('text-center py-16', dk ? 'text-slate-500' : 'text-slate-400')}>
                  <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">{lang === 'de' ? 'Keine Hotels gefunden' : 'No hotels found'}</p>
                  <p className="text-sm mt-1">{lang === 'de' ? 'Hotel hinzufügen oder Filter zurücksetzen' : 'Add a hotel or clear filters'}</p>
                </div>
              )}
              {visibleHotels.filter(h => h && h.id).map(hotel => (
                <HotelRow
                  key={hotel.id}
                  hotel={hotel}
                  isDarkMode={dk}
                  lang={lang}
                  companyOptions={companyOptions}
                  cityOptions={cityOptions}
                  onUpdate={(id, updated) => setHotels(prev => prev.map(h => h.id === id ? updated : h))}
                  onDelete={id => {
                    deleteHotel(id).catch(console.error)
                    setHotels(prev => prev.filter(h => h.id !== id))
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {showShareModal  && <ShareModal  theme={theme} lang={lang} onClose={() => setShowShareModal(false)}  />}
      {showExportModal && <ExportModal theme={theme} lang={lang} hotels={visibleHotels} onClose={() => setShowExportModal(false)} />}
    </div>
  )
}
