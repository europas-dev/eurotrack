import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getHotels, signOut, deleteHotel, createHotel } from './lib/supabase';
import { cn, calcHotelFreeBeds, calcHotelTotalCost, calcHotelTotalNights } from './lib/utils';
import { type Theme, type Language } from './lib/types';
import { Plus, Building2, Check, X, Loader2, Filter, ArrowUpDown, Download, Search } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

function NewHotelRow({ isDarkMode, lang, onSave, onCancel }: {
  isDarkMode: boolean; lang: Language;
  onSave: (hotel: any) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [tag, setTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const dk = isDarkMode;

  useEffect(() => { nameRef.current?.focus(); }, []);

  const ic = cn('px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');

  async function handleSave() {
    if (!name.trim()) return;
    setErr('');
    try {
      setSaving(true);
      const newHotel = await createHotel({ name: name.trim(), city: city.trim(), companyTag: tag.trim() });
      onSave({ ...newHotel, durations: [] });
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    }
    setSaving(false);
  }

  return (
    <div className={cn('mb-2 rounded-xl border px-4 py-3 space-y-2',
      dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400')}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn('w-8 h-8 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0')}>
          <Building2 size={16} className="text-blue-400" />
        </div>
        <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={lang === 'de' ? 'Hotelname...' : 'Hotel name...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-52')} />
        <input type="text" value={city} onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')} />
        <input type="text" value={tag} onChange={e => setTag(e.target.value)}
          placeholder={lang === 'de' ? 'Firma...' : 'Company...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')} />
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all flex-shrink-0">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button onClick={onCancel}
          className={cn('p-2 rounded-lg transition-all flex-shrink-0',
            dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
          <X size={16} />
        </button>
      </div>
      {err && <p className="text-red-400 text-xs font-bold px-1">{err}</p>}
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
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterFreeBeds, setFilterFreeBeds] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'nights' | 'city'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const dk = theme === 'dark';

  useEffect(() => { loadHotels(); }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      setError('');
      const data = await getHotels();
      setHotels(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  // Filter by selected month/year
  const monthFiltered = useMemo(() => {
    if (selectedMonth === null) return hotels;
    return hotels.filter(h =>
      (h.durations || []).some((d: any) => {
        if (!d.startDate && !d.endDate) return false;
        const s = new Date(d.startDate);
        const e = new Date(d.endDate);
        return (
          (s.getFullYear() === selectedYear && s.getMonth() === selectedMonth) ||
          (e.getFullYear() === selectedYear && e.getMonth() === selectedMonth) ||
          (s <= new Date(selectedYear, selectedMonth, 1) && e >= new Date(selectedYear, selectedMonth + 1, 0))
        );
      })
    );
  }, [hotels, selectedYear, selectedMonth]);

  const filtered = useMemo(() => {
    let list = monthFiltered.filter(h => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchFields = [
          h.name, h.city, h.companyTag, h.address, h.contact, h.contactPerson, h.email, h.webLink, h.notes,
          ...(h.durations || []).flatMap((d: any) => (d.employees || []).filter(Boolean).map((e: any) => e.name)),
        ].filter(Boolean).map((s: string) => s.toLowerCase());
        if (!searchFields.some(f => f.includes(q))) return false;
      }
      if (filterFreeBeds && calcHotelFreeBeds(h) === 0) return false;
      if (filterPaid === 'paid' && !(h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && (h.durations || []).every((d: any) => d.isPaid)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortBy === 'city') { va = a.city?.toLowerCase(); vb = b.city?.toLowerCase(); }
      else if (sortBy === 'cost') { va = calcHotelTotalCost(a); vb = calcHotelTotalCost(b); }
      else { va = calcHotelTotalNights(a); vb = calcHotelTotalNights(b); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [monthFiltered, searchQuery, filterFreeBeds, filterPaid, sortBy, sortDir]);

  const totalCost = monthFiltered.reduce((s, h) => s + calcHotelTotalCost(h), 0);
  const totalFreeBeds = monthFiltered.reduce((s, h) => s + calcHotelFreeBeds(h), 0);
  const totalHotels = monthFiltered.length;

  const companyOptions = [...new Set(hotels.map(h => h.companyTag).filter(Boolean))];
  const cityOptions = [...new Set(hotels.map(h => h.city).filter(Boolean))];

  const activeFilters = (filterPaid !== 'all' ? 1 : 0) + (filterFreeBeds ? 1 : 0);

  function handleExport() {
    const rows = [
      ['Hotel', 'City', 'Company', 'Durations', 'Total Nights', 'Free Beds', 'Total Cost EUR'],
      ...filtered.map(h => [
        h.name, h.city, h.companyTag,
        (h.durations || []).length,
        calcHotelTotalNights(h),
        calcHotelFreeBeds(h),
        calcHotelTotalCost(h).toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eurotrack-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const menuCls = cn('absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[220px] space-y-1',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200');
  const menuLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2 block px-1',
    dk ? 'text-slate-500' : 'text-slate-400');
  const menuBtn = (active: boolean) => cn('w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700');
  const toolBtn = cn('px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all flex-shrink-0',
    dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100');

  const pageTitle = selectedMonth === null
    ? `${lang === 'de' ? 'Alle' : 'All'} ${selectedYear}`
    : `${monthNames[selectedMonth]} ${selectedYear}`;

  return (
    <div className={cn('min-h-screen flex', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Sidebar
        theme={theme} lang={lang}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          theme={theme} lang={lang}
          toggleTheme={toggleTheme} setLang={setLang}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onExport={handleExport}
          onSignOut={async () => { try { await signOut(); window.location.reload(); } catch (e) {} }}
        />

        {/* Single sticky top toolbar row */}
        <div className={cn('sticky top-[57px] z-30 px-6 py-3 border-b flex items-center gap-3 flex-wrap',
          dk ? 'bg-[#0B1224] border-white/10' : 'bg-white border-slate-200')}>

          {/* Summary metrics */}
          <div className="flex items-center gap-6 mr-2">
            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-widest block', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Hotels' : 'Hotels'}
              </span>
              <span className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>{totalHotels}</span>
            </div>
            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-widest block', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Freie Betten' : 'Free Beds'}
              </span>
              <span className={cn('text-sm font-black', totalFreeBeds > 0 ? 'text-red-400' : dk ? 'text-green-400' : 'text-green-600')}>
                {totalFreeBeds}
              </span>
            </div>
            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-widest block', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Gesamt' : 'Total Cost'}
              </span>
              <span className="text-sm font-black text-blue-400">
                €{totalCost.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className={cn('w-px h-8 flex-shrink-0', dk ? 'bg-white/10' : 'bg-slate-200')} />

          {/* Search */}
          <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[160px] max-w-xs',
            dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
            <Search size={14} className="opacity-40 flex-shrink-0" />
            <input type="text"
              placeholder={lang === 'de' ? 'Suchen...' : 'Search...'}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className={cn('flex-1 outline-none bg-transparent text-sm',
                dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className={cn('p-0.5 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter */}
          <div className="relative">
            <button onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
              className={cn(toolBtn, activeFilters > 0 ? '!bg-blue-600 !text-white !border-blue-600' : '')}>
              <Filter size={14} />
              {lang === 'de' ? 'Filter' : 'Filter'}
              {activeFilters > 0 && (
                <span className="bg-white/30 rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{activeFilters}</span>
              )}
            </button>
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                <div className={cn(menuCls, 'z-50')}>
                  <span className={menuLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</span>
                  {(['all', 'paid', 'unpaid'] as const).map(v => (
                    <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                      {v === 'all' ? (lang === 'de' ? 'Alle Hotels' : 'All hotels')
                        : v === 'paid' ? (lang === 'de' ? 'Bezahlt' : 'Paid')
                        : (lang === 'de' ? 'Unbezahlt' : 'Unpaid')}
                    </button>
                  ))}
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <button onClick={() => setFilterFreeBeds(!filterFreeBeds)} className={menuBtn(filterFreeBeds)}>
                    {lang === 'de' ? 'Hat freie Betten' : 'Has free beds'}
                  </button>
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <button onClick={() => { setFilterPaid('all'); setFilterFreeBeds(false); setShowFilterMenu(false); }}
                    className={cn('w-full text-left px-3 py-1.5 rounded text-xs mt-1 transition-all',
                      dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}>
                    {lang === 'de' ? 'Filter zurücksetzen' : 'Clear filters'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }} className={toolBtn}>
              <ArrowUpDown size={14} />
              {lang === 'de' ? 'Sortieren' : 'Sort'}
              <span className={cn('text-[10px] font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>
                {sortBy} {sortDir === 'asc' ? '↑' : '↓'}
              </span>
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className={cn(menuCls, 'z-50')}>
                  <span className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</span>
                  {(['name', 'Name'] as const[]).length && (
                    [['name','Name'],['city','City'],['cost','Total Cost'],['nights','Total Nights']].map(([v, label]) => (
                      <button key={v} onClick={() => setSortBy(v as any)} className={menuBtn(sortBy === v)}>{label}</button>
                    ))
                  )}
                  <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                  <span className={menuLabel}>{lang === 'de' ? 'Richtung' : 'Direction'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSortDir('asc')} className={cn(menuBtn(sortDir === 'asc'), 'flex-1 text-center')}>↑ Asc</button>
                    <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>↓ Desc</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Export */}
          <button onClick={handleExport} className={toolBtn}>
            <Download size={14} />
            {lang === 'de' ? 'Export' : 'Export'}
          </button>

          {/* Add Hotel */}
          <button onClick={() => setAddingHotel(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm flex-shrink-0 ml-auto">
            <Plus size={16} />
            {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
          </button>
        </div>

        {/* Page title */}
        <div className={cn('px-6 pt-5 pb-2 flex items-center justify-between')}>
          <h2 className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>{pageTitle}</h2>
          <span className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
            {filtered.length} {lang === 'de' ? 'Hotels' : 'hotels'}
          </span>
        </div>

        <main className="flex-1 px-6 pb-6 overflow-y-auto">
          <div className="space-y-2">
            {addingHotel && (
              <NewHotelRow isDarkMode={dk} lang={lang}
                onSave={h => { setHotels(p => [h, ...p]); setAddingHotel(false); }}
                onCancel={() => setAddingHotel(false)} />
            )}

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
                <p className={dk ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
              </div>
            ) : error ? (
              <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
                <p className="text-red-400 font-bold text-sm mb-1">{error}</p>
                <button onClick={loadHotels} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Retry</button>
              </div>
            ) : filtered.length === 0 && !addingHotel ? (
              <div className={cn('text-center py-20 rounded-2xl border-2 border-dashed',
                dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}>
                <div className={cn('w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center',
                  dk ? 'bg-blue-600/20' : 'bg-blue-100')}>
                  <Building2 size={32} className="text-blue-500" />
                </div>
                <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                  {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
                </h3>
                <p className={cn('text-sm mb-6', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Klicken Sie auf Hotel hinzufügen' : 'Click Add Hotel to get started'}
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
                  onDelete={id => { deleteHotel(id); setHotels(p => p.filter(h => h.id !== id)); }}
                  onUpdate={(id, u) => setHotels(p => p.map(h => h.id === id ? { ...h, ...u } : h))}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
