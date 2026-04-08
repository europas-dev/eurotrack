import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getHotels, signOut, deleteHotel, createHotel, syncOfflineQueue, hasQueuedOps } from './lib/supabase';
import { cn, calcHotelFreeBeds, calcHotelTotalCost, isFreeBedToday, isFreeBedOnDay, addDays, highlightText } from './lib/utils';
import { type Theme, type Language } from './lib/types';
import { Plus, Building2, Check, X, Loader2, Filter, ArrowUpDown, Download } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

interface DashboardProps { theme: Theme; lang: Language; toggleTheme: () => void; setLang: (l: Language) => void; }

type FilterPaid = 'all' | 'paid' | 'unpaid';
type FilterFree = 'none' | 'today' | 'tomorrow' | 'in5' | 'in7' | 'any';
type FilterDeposit = 'all' | 'deposit' | 'nodeposit';
type SortBy = 'name' | 'city' | 'cost' | 'nights';
type SortDir = 'asc' | 'desc';

function NewHotelRow({ isDarkMode, lang, onSave, onCancel }: { isDarkMode: boolean; lang: Language; onSave: (hotel: any) => void; onCancel: () => void; }) {
  const dk = isDarkMode;
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [tag, setTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const ic = cn('px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');

  async function handleSave() {
    setErr('');
    try {
      setSaving(true);
      const newHotel = await createHotel({ name: name.trim() || 'New Hotel', city: city.trim(), companyTag: tag.trim() });
      onSave({ ...newHotel, durations: [] });
    } catch (e: any) { setErr(e?.message || 'Failed to save'); setSaving(false); }
  }

  return (
    <div className={cn('mb-2 rounded-xl border px-4 py-3 space-y-2', dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-blue-400" />
        </div>
        <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'} onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-52')} />
        <input type="text" value={city} onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'} onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')} />
        <input type="text" value={tag} onChange={e => setTag(e.target.value)}
          placeholder={lang === 'de' ? 'Firma...' : 'Company...'} onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')} />
        <button onClick={handleSave} disabled={saving}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button onClick={onCancel}
          className={cn('p-2 rounded-lg transition-all flex-shrink-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
          <X size={16} />
        </button>
      </div>
      {err && <p className="text-red-400 text-xs font-bold px-1">{err}</p>}
      <p className={cn('text-xs px-1', dk ? 'text-slate-500' : 'text-slate-400')}>
        {lang === 'de' ? 'Name ist optional – Hotel kann später befüllt werden' : 'Name is optional — can be filled in later'}
      </p>
    </div>
  );
}

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingHotel, setAddingHotel] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filterPaid, setFilterPaid] = useState<FilterPaid>('all');
  const [filterFree, setFilterFree] = useState<FilterFree>('none');
  const [filterDeposit, setFilterDeposit] = useState<FilterDeposit>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);

  const dk = theme === 'dark';

  useEffect(() => {
    loadHotels();
    const onOnline = () => { setOffline(false); syncOfflineQueue().catch(console.error).then(() => setPendingSync(hasQueuedOps())); };
    const onOffline = () => { setOffline(true); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  async function loadHotels() {
    try { setLoading(true); setError(''); const data = await getHotels(); setHotels(data); }
    catch (err: any) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  const in5 = addDays(today, 5);
  const in7 = addDays(today, 7);

  // Global search across all meaningful fields
  function hotelMatchesSearch(h: any): boolean {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fields = [
      h.name, h.city, h.companyTag, h.address, h.contactPerson,
      h.contact, h.email, h.webLink, h.notes,
      ...h.durations.map((d: any) => d.invoiceNumber),
      ...h.durations.map((d: any) => d.bookingId),
      ...h.durations.flatMap((d: any) => d.employees.filter(Boolean).map((e: any) => e?.name)),
    ].filter(Boolean);
    return fields.some(f => String(f).toLowerCase().includes(q));
  }

  const filtered = useMemo(() => {
    let list = hotels.filter(h => {
      if (!hotelMatchesSearch(h)) return false;
      if (filterFree === 'today' && !isFreeBedToday(h)) return false;
      if (filterFree === 'tomorrow' && !isFreeBedOnDay(h, tomorrow)) return false;
      if (filterFree === 'in5' && !isFreeBedOnDay(h, in5)) return false;
      if (filterFree === 'in7' && !isFreeBedOnDay(h, in7)) return false;
      if (filterFree === 'any' && calcHotelFreeBeds(h) === 0) return false;
      if (filterPaid === 'paid' && !h.durations.every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && h.durations.every((d: any) => d.isPaid)) return false;
      if (filterDeposit === 'deposit' && !h.durations.some((d: any) => d.depositEnabled)) return false;
      if (filterDeposit === 'nodeposit' && h.durations.some((d: any) => d.depositEnabled)) return false;
      if (selectedMonth !== null) {
        const hasMonth = h.durations.some((d: any) => {
          if (!d.startDate && !d.endDate) return false;
          const start = new Date(d.startDate); const end = new Date(d.endDate);
          return (start.getFullYear() === selectedYear && start.getMonth() === selectedMonth) ||
                 (end.getFullYear() === selectedYear && end.getMonth() === selectedMonth);
        });
        if (!hasMonth) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name')   { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'city') { va = a.city?.toLowerCase(); vb = b.city?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      else { va = 0; vb = 0; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, filterFree, filterPaid, filterDeposit, selectedMonth, selectedYear, sortBy, sortDir]);

  const totalSpend = hotels.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const totalFree  = hotels.reduce((s, h) => s + calcHotelFreeBeds(h), 0);
  const companyOptions = [...new Set(hotels.map(h => h.companyTag).filter(Boolean))];
  const cityOptions    = [...new Set(hotels.map(h => h.city).filter(Boolean))];
  const showPaidTotals = filterPaid !== 'all';

  const activeFiltersCount = [
    filterPaid !== 'all', filterFree !== 'none', filterDeposit !== 'all'
  ].filter(Boolean).length;

  async function handleExport() {
    const rows = [
      ['Hotel', 'City', 'Company', 'Contact', 'Phone', 'Email', 'Durations', 'Free Beds', 'Total Cost EUR'],
      ...filtered.map(h => [
        h.name, h.city, h.companyTag, h.contactPerson, h.contact, h.email,
        h.durations.length, calcHotelFreeBeds(h), calcHotelTotalCost(h).toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map((v: any) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `eurotrack-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const menuCls = cn(
    'absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[200px] space-y-1',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  );
  const menuLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2 block px-1', dk ? 'text-slate-500' : 'text-slate-400');
  const menuBtn = (active: boolean) => cn(
    'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
  );

  return (
    <div className={cn('min-h-screen flex', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onExport={handleExport}
          onSignOut={async () => { try { await signOut(); window.location.reload(); } catch(e) {} }} />

        {/* Offline indicator */}
        {(offline || pendingSync) && (
          <div className={cn('px-6 py-2 text-xs font-bold flex items-center gap-2',
            offline ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400')}>
            <div className={cn('w-2 h-2 rounded-full', offline ? 'bg-amber-400' : 'bg-blue-400')} />
            {offline
              ? (lang === 'de' ? 'Offline – Änderungen werden lokal gespeichert' : 'Offline — changes saved locally')
              : (lang === 'de' ? 'Synchronisiere ausstehende Änderungen...' : 'Syncing pending changes...')}
          </div>
        )}

        {/* ── STICKY TOP TOOLBAR ─────────────────────────────────── */}
        <div className={cn('sticky top-[57px] z-30 border-b px-6 py-3', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-3 flex-wrap">

            {/* Summary metrics */}
            <div className="flex items-center gap-6 mr-2">
              <div>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>Hotels</p>
                <p className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{hotels.length}</p>
              </div>
              <div>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Freie Betten' : 'Free Beds'}</p>
                <p className={cn('text-lg font-black', totalFree > 0 ? 'text-red-400' : 'text-green-400')}>{totalFree}</p>
              </div>
              <div>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Gesamt' : 'Total Cost'}</p>
                <p className="text-lg font-black text-blue-400">
                  {totalSpend.toLocaleString('de-DE', { minimumFractionDigits: 0 })} €
                </p>
              </div>
            </div>

            <div className={cn('w-px h-8 self-center flex-shrink-0', dk ? 'bg-white/10' : 'bg-slate-200')} />

            {/* Search */}
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[160px] max-w-[260px]',
              dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40 flex-shrink-0">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" placeholder={lang === 'de' ? 'Suchen...' : 'Search...'}
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={cn('flex-1 outline-none bg-transparent text-sm', dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className={cn('p-0.5 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter */}
            <div className="relative">
              <button onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                  activeFiltersCount > 0 ? 'bg-blue-600 text-white border-blue-600'
                    : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                <Filter size={14} />
                {lang === 'de' ? 'Filter' : 'Filter'}
                {activeFiltersCount > 0 && (
                  <span className="bg-white/30 rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">{activeFiltersCount}</span>
                )}
              </button>
              {showFilterMenu && (
                <div className={menuCls}>
                  <span className={menuLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</span>
                  {(['all','paid','unpaid'] as const).map(v => (
                    <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                      {v === 'all' ? (lang === 'de' ? 'Alle Hotels' : 'All hotels') : v === 'paid' ? (lang === 'de' ? 'Vollständig bezahlt' : 'Fully paid') : (lang === 'de' ? 'Hat Unbezahltes' : 'Has unpaid')}
                    </button>
                  ))}
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <span className={menuLabel}>{lang === 'de' ? 'Kaution' : 'Deposit'}</span>
                  {(['all','deposit','nodeposit'] as const).map(v => (
                    <button key={v} onClick={() => setFilterDeposit(v)} className={menuBtn(filterDeposit === v)}>
                      {v === 'all' ? (lang === 'de' ? 'Alle' : 'All') : v === 'deposit' ? (lang === 'de' ? 'Kaution bezahlt' : 'Deposit paid') : (lang === 'de' ? 'Keine Kaution' : 'No deposit')}
                    </button>
                  ))}
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <span className={menuLabel}>{lang === 'de' ? 'Freie Betten' : 'Free beds'}</span>
                  {([
                    ['none',     lang === 'de' ? 'Alle'        : 'All'],
                    ['any',      lang === 'de' ? 'Hat freie Betten' : 'Has free beds'],
                    ['today',    lang === 'de' ? 'Frei heute'  : 'Free today'],
                    ['tomorrow', lang === 'de' ? 'Frei morgen' : 'Free tomorrow'],
                    ['in5',      lang === 'de' ? 'Frei in 5 Tagen' : 'Free in 5 days'],
                    ['in7',      lang === 'de' ? 'Frei in 7 Tagen' : 'Free in 7 days'],
                  ] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setFilterFree(v as FilterFree)} className={menuBtn(filterFree === v)}>{label}</button>
                  ))}
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <button onClick={() => { setFilterPaid('all'); setFilterFree('none'); setFilterDeposit('all'); setShowFilterMenu(false); }}
                    className={cn('w-full text-left px-3 py-1.5 rounded text-xs mt-1 transition-all', dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}>
                    {lang === 'de' ? 'Filter zurücksetzen' : 'Clear filters'}
                  </button>
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
                <ArrowUpDown size={14} />
                {lang === 'de' ? 'Sortieren' : 'Sort'}
                <span className={cn('text-[10px] font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>{sortBy} {sortDir}</span>
              </button>
              {showSortMenu && (
                <div className={menuCls}>
                  <span className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</span>
                  {([['name','Name'],['city','City'],['cost','Total Cost'],['nights','Total Nights']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setSortBy(v as SortBy)} className={menuBtn(sortBy === v)}>{label}</button>
                  ))}
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <span className={menuLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSortDir('asc')} className={cn(menuBtn(sortDir === 'asc'), 'flex-1 text-center')}>Asc</button>
                    <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>Desc</button>
                  </div>
                </div>
              )}
            </div>

            {/* Export */}
            <button onClick={handleExport}
              className={cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}>
              <Download size={14} /> {lang === 'de' ? 'Export' : 'Export'}
            </button>

            {/* Month label */}
            {selectedMonth !== null && (
              <span className={cn('text-xs font-bold px-2 py-1 rounded-lg', dk ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')}>
                {monthNames[selectedMonth]} {selectedYear}
              </span>
            )}

            {/* Add hotel */}
            <button onClick={() => setAddingHotel(true)}
              className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm whitespace-nowrap">
              <Plus size={16} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
            </button>
          </div>
        </div>

        {/* Close dropdowns on outside click */}
        {(showFilterMenu || showSortMenu) && (
          <div className="fixed inset-0 z-40" onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); }} />
        )}

        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm mb-1">Error</p>
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={loadHotels} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Retry</button>
            </div>
          ) : (
            <div className="space-y-2">
              {addingHotel && (
                <NewHotelRow isDarkMode={dk} lang={lang}
                  onSave={h => { setHotels(p => [h, ...p]); setAddingHotel(false); }}
                  onCancel={() => setAddingHotel(false)} />
              )}
              {filtered.length === 0 && !addingHotel ? (
                <div className={cn('text-center py-20 rounded-2xl border-2 border-dashed', dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}>
                  <div className={cn('w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center', dk ? 'bg-blue-600/20' : 'bg-blue-100')}>
                    <Building2 size={32} className="text-blue-500" />
                  </div>
                  <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                    {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
                  </h3>
                  <p className={cn('text-sm mb-6', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Klicken Sie auf "Hotel hinzufügen"' : 'Click Add Hotel to get started'}
                  </p>
                  <button onClick={() => setAddingHotel(true)}
                    className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm">
                    <Plus size={18} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                  </button>
                </div>
              ) : (
                filtered.map(hotel => (
                  <HotelRow key={hotel.id} entry={hotel} isDarkMode={dk} lang={lang}
                    companyOptions={companyOptions} cityOptions={cityOptions}
                    showPaidTotals={showPaidTotals}
                    searchQuery={searchQuery}
                    onDelete={id => { deleteHotel(id); setHotels(p => p.filter(h => h.id !== id)); }}
                    onUpdate={(id, u) => setHotels(p => p.map(h => h.id === id ? { ...h, ...u } : h))} />
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
