import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getHotels, signOut, deleteHotel, createHotel, getHotelCollaborators } from './lib/supabase';
import {
  cn,
  calcHotelFreeBeds,
  calcHotelTotalCost,
  calcHotelTotalNights,
  durationTouchesMonth,
  getDurationCostForMonth,
  getFreeBedFilterDate,
  hotelHasFreeOnDate,
  sumGroupCost,
} from './lib/utils';
import type { Theme, Language, GroupBy } from './lib/types';
import { Plus, Building2, Check, X, Loader2, Filter, ArrowUpDown, Download } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

function NewHotelRow({
  isDarkMode,
  lang,
  companyOptions,
  cityOptions,
  onSave,
  onCancel
}: {
  isDarkMode: boolean;
  lang: Language;
  companyOptions: string[];
  cityOptions: string[];
  onSave: (hotel: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [tag, setTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const dk = isDarkMode;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && city.trim().length > 0 && tag.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setErr('');
    try {
      setSaving(true);
      const newHotel = await createHotel({
        name: name.trim(),
        city: city.trim(),
        companyTag: tag.trim(),
      });
      onSave({ ...newHotel, durations: [], collaborators: [] });
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
      setSaving(false);
    }
  };

  const ic = cn(
    'px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
      : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  );

  return (
    <div className={cn(
      'mb-2 rounded-xl border px-4 py-3 space-y-2',
      dk ? 'bg-[#0B1224] border-blue-500/40' : 'bg-white border-blue-400'
    )}>
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
          list="city-options-global"
          type="text"
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder={lang === 'de' ? 'Stadt...' : 'City...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-36')}
        />
        <datalist id="city-options-global">
          {cityOptions.map((x) => <option key={x} value={x} />)}
        </datalist>

        <input
          list="company-options-global"
          type="text"
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder={lang === 'de' ? 'Firma / Tag...' : 'Company / tag...'}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={cn(ic, 'w-40')}
        />
        <datalist id="company-options-global">
          {companyOptions.map((x) => <option key={x} value={x} />)}
        </datalist>

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
    </div>
  );
}

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingHotel, setAddingHotel] = useState(false);
  const [insertAfterHotelId, setInsertAfterHotelId] = useState<string | null>(null);

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [freeBedMode, setFreeBedMode] = useState<'off' | 'now' | 'in3' | 'in7' | 'custom'>('off');
  const [customFreeDate, setCustomFreeDate] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'nights' | 'city'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [activeGroupTab, setActiveGroupTab] = useState<string>('all');

  const [activeShareHotelId, setActiveShareHotelId] = useState<string | null>(null);
  const [activeShareHotelName, setActiveShareHotelName] = useState<string | null>(null);
  const [activeCollaborators, setActiveCollaborators] = useState<any[]>([]);

  const monthNames = lang === 'de'
    ? ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dk = theme === 'dark';

  useEffect(() => {
    loadHotels();
  }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      setError('');
      const data = await getHotels();
      setHotels(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const companyOptions = useMemo(() => {
    return Array.from(new Set(hotels.map(h => h.companyTag).filter(Boolean))).sort();
  }, [hotels]);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(hotels.map(h => h.city).filter(Boolean))).sort();
  }, [hotels]);

  const calcHotelCostForView = (hotel: any) => {
    if (selectedMonth === null) return calcHotelTotalCost(hotel);
    return (hotel.durations || []).reduce((sum: number, d: any) => sum + getDurationCostForMonth(d, selectedYear, selectedMonth), 0);
  };

  const hotelsForMonth = useMemo(() => {
    if (selectedMonth === null) return hotels;
    return hotels
      .map(hotel => ({
        ...hotel,
        durations: (hotel.durations || []).filter((d: any) => durationTouchesMonth(d, selectedYear, selectedMonth)),
      }))
      .filter(hotel => hotel.durations.length > 0);
  }, [hotels, selectedMonth, selectedYear]);

  const filtered = useMemo(() => {
    let list = hotelsForMonth.filter(h => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!h.name?.toLowerCase().includes(q) && !h.city?.toLowerCase().includes(q) && !h.companyTag?.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (filterPaid === 'paid' && !(h.durations || []).every((d: any) => d.isPaid)) return false;
      if (filterPaid === 'unpaid' && (h.durations || []).every((d: any) => d.isPaid)) return false;

      if (freeBedMode !== 'off') {
        const targetDate = getFreeBedFilterDate(freeBedMode === 'custom' ? 'custom' : freeBedMode as any, customFreeDate);
        if (!hotelHasFreeOnDate(h, targetDate)) return false;
      }

      return true;
    });

    list = [...list].sort((a, b) => {
      let va: any;
      let vb: any;

      if (sortBy === 'name') {
        va = a.name?.toLowerCase();
        vb = b.name?.toLowerCase();
      } else if (sortBy === 'city') {
        va = a.city?.toLowerCase();
        vb = b.city?.toLowerCase();
      } else if (sortBy === 'cost') {
        va = calcHotelCostForView(a);
        vb = calcHotelCostForView(b);
      } else {
        va = calcHotelTotalNights(a);
        vb = calcHotelTotalNights(b);
      }

      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });

    return list;
  }, [hotelsForMonth, searchQuery, filterPaid, freeBedMode, customFreeDate, sortBy, sortDir, selectedMonth, selectedYear]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { all: filtered };
    return filtered.reduce((acc: Record<string, any[]>, hotel: any) => {
      const key = groupBy === 'company' ? (hotel.companyTag || 'Unknown') : (hotel.city || 'Unknown');
      if (!acc[key]) acc[key] = [];
      acc[key].push(hotel);
      return acc;
    }, {});
  }, [filtered, groupBy]);

  const groupKeys = ['all', ...Object.keys(grouped).filter(k => k !== 'all')];
  const displayHotels = activeGroupTab === 'all' ? filtered : (grouped[activeGroupTab] || []);

  const totalSpend = hotelsForMonth.reduce((sum, hotel) => sum + calcHotelCostForView(hotel), 0);
  const freeBeds = hotelsForMonth.reduce((sum, hotel) => sum + calcHotelFreeBeds(hotel), 0);

  const menuCls = cn(
    'absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-xl p-3 min-w-[240px] space-y-1',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  );

  const menuLabel = cn('text-[10px] font-bold uppercase tracking-widest mb-2 block px-1', dk ? 'text-slate-500' : 'text-slate-400');

  const menuBtn = (active: boolean) => cn(
    'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all',
    active ? 'bg-blue-600 text-white' : dk ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
  );

  const handleExport = () => {
    const rows = [
      ['Hotel', 'City', 'Company', 'Bookings', 'Total Nights', 'Free Beds', 'Total Cost (EUR)'],
      ...displayHotels.map(h => [
        h.name,
        h.city,
        h.companyTag,
        (h.durations || []).length,
        calcHotelTotalNights(h),
        calcHotelFreeBeds(h),
        calcHotelCostForView(h).toFixed(2),
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
  };

  async function activateShareForHotel(hotel: any) {
    setActiveShareHotelId(hotel.id);
    setActiveShareHotelName(hotel.name);
    try {
      const list = await getHotelCollaborators(hotel.id);
      setActiveCollaborators(list);
    } catch {
      setActiveCollaborators(hotel.collaborators || []);
    }
  }

  const groupCost = activeGroupTab === 'all'
    ? sumGroupCost(displayHotels, selectedYear, selectedMonth)
    : sumGroupCost(grouped[activeGroupTab] || [], selectedYear, selectedMonth);

  return (
    <div className={cn('min-h-screen flex', dk ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900')}>
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
        <Header
          theme={theme}
          lang={lang}
          toggleTheme={toggleTheme}
          setLang={setLang}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onExport={handleExport}
          onSignOut={async () => { try { await signOut(); window.location.reload(); } catch {} }}
          activeHotelIdForShare={activeShareHotelId}
          activeHotelNameForShare={activeShareHotelName}
          collaborators={activeCollaborators}
          onCollaboratorsChanged={setActiveCollaborators}
        />

        <div className={cn('px-8 py-4 border-b', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
          <div className="flex items-center gap-10 flex-wrap">
            {[
              { label: lang === 'de' ? 'Freie Betten' : 'Free Beds', value: String(freeBeds), cls: freeBeds > 0 ? 'text-amber-400' : 'text-green-400' },
              { label: lang === 'de' ? 'Gesamt' : 'Total Spent', value: '€' + totalSpend.toLocaleString('de-DE', { maximumFractionDigits: 0 }), cls: 'text-blue-400' },
              { label: lang === 'de' ? 'Hotels' : 'Hotels', value: String(hotelsForMonth.length), cls: dk ? 'text-white' : 'text-slate-900' },
              { label: groupBy !== 'none' ? (lang === 'de' ? 'Gruppenkosten' : 'Group Cost') : (lang === 'de' ? 'Ansichtskosten' : 'View Cost'), value: '€' + groupCost.toLocaleString('de-DE', { maximumFractionDigits: 0 }), cls: 'text-purple-400' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-500' : 'text-slate-400')}>{label}</p>
                <p className={cn('text-2xl font-black', cls)}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <h2 className={cn('text-xl font-black', dk ? 'text-white' : 'text-slate-900')}>
              {selectedMonth === null ? (lang === 'de' ? 'Dashboard' : 'Dashboard') : `${monthNames[selectedMonth]} ${selectedYear}`}
            </h2>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    (filterPaid !== 'all' || freeBedMode !== 'off' || groupBy !== 'none')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Filter size={15} />
                  {lang === 'de' ? 'Filter' : 'Filter'}
                </button>

                {showFilterMenu && (
                  <div className={menuCls}>
                    <label className={menuLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</label>
                    {(['all', 'paid', 'unpaid'] as const).map(v => (
                      <button key={v} onClick={() => setFilterPaid(v)} className={menuBtn(filterPaid === v)}>
                        {v === 'all' ? (lang === 'de' ? 'Alle Hotels' : 'All hotels') : v === 'paid' ? (lang === 'de' ? 'Voll bezahlt' : 'Fully paid') : (lang === 'de' ? 'Mit offenen Zahlungen' : 'Has unpaid')}
                      </button>
                    ))}

                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <label className={menuLabel}>{lang === 'de' ? 'Freie Betten' : 'Free beds'}</label>
                    {([
                      ['off', lang === 'de' ? 'Aus' : 'Off'],
                      ['now', lang === 'de' ? 'Jetzt frei' : 'Free now'],
                      ['in3', lang === 'de' ? 'Frei in 3 Tagen' : 'Free in 3 days'],
                      ['in7', lang === 'de' ? 'Frei in 7 Tagen' : 'Free in 7 days'],
                      ['custom', lang === 'de' ? 'Frei am Datum' : 'Free on date'],
                    ] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setFreeBedMode(v as any)} className={menuBtn(freeBedMode === v)}>
                        {label}
                      </button>
                    ))}

                    {freeBedMode === 'custom' && (
                      <input
                        type="date"
                        value={customFreeDate}
                        onChange={e => setCustomFreeDate(e.target.value)}
                        className={cn(
                          'mt-2 w-full px-3 py-2 rounded-lg text-sm outline-none border',
                          dk ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        )}
                      />
                    )}

                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <label className={menuLabel}>{lang === 'de' ? 'Gruppieren nach' : 'Group by'}</label>
                    {(['none', 'company', 'city'] as const).map(v => (
                      <button key={v} onClick={() => { setGroupBy(v); setActiveGroupTab('all'); }} className={menuBtn(groupBy === v)}>
                        {v === 'none' ? (lang === 'de' ? 'Keine Gruppierung' : 'No grouping') : v === 'company' ? (lang === 'de' ? 'Firma' : 'Company') : (lang === 'de' ? 'Stadt' : 'City')}
                      </button>
                    ))}

                    <button
                      onClick={() => {
                        setFilterPaid('all');
                        setFreeBedMode('off');
                        setCustomFreeDate('');
                        setGroupBy('none');
                        setShowFilterMenu(false);
                      }}
                      className={cn('w-full text-left px-3 py-1.5 rounded text-xs mt-1 transition-all', dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}
                    >
                      {lang === 'de' ? 'Filter zurücksetzen' : 'Clear filters'}
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                    dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <ArrowUpDown size={15} />
                  {lang === 'de' ? 'Sortieren' : 'Sort'}
                </button>

                {showSortMenu && (
                  <div className={menuCls}>
                    <label className={menuLabel}>{lang === 'de' ? 'Sortieren nach' : 'Sort by'}</label>
                    {([['name', lang === 'de' ? 'Name' : 'Name'], ['city', lang === 'de' ? 'Stadt' : 'City'], ['cost', lang === 'de' ? 'Kosten' : 'Total Cost'], ['nights', lang === 'de' ? 'Nächte' : 'Total Nights']] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setSortBy(v)} className={menuBtn(sortBy === v)}>{label}</button>
                    ))}
                    <div className={cn('border-t my-2', dk ? 'border-white/10' : 'border-slate-100')} />
                    <div className="flex gap-2">
                      <button onClick={() => setSortDir('asc')} className={cn(menuBtn(sortDir === 'asc'), 'flex-1 text-center')}>↑ Asc</button>
                      <button onClick={() => setSortDir('desc')} className={cn(menuBtn(sortDir === 'desc'), 'flex-1 text-center')}>↓ Desc</button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleExport}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all',
                  dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                )}
              >
                <Download size={15} />
                Export CSV
              </button>

              <button
                onClick={() => { setAddingHotel(true); setInsertAfterHotelId(null); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm"
              >
                <Plus size={16} />
                {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
              </button>
            </div>
          </div>

          {groupBy !== 'none' && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {groupKeys.map(key => {
                const value = key === 'all' ? filtered : (grouped[key] || []);
                const label = key === 'all' ? (lang === 'de' ? 'Alle' : 'All') : key;
                const cost = sumGroupCost(value as any[], selectedYear, selectedMonth);

                return (
                  <button
                    key={key}
                    onClick={() => setActiveGroupTab(key)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-bold border transition-all',
                      activeGroupTab === key ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {label} • €{cost.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </button>
                );
              })}
            </div>
          )}

          {(showFilterMenu || showSortMenu) && (
            <div className="fixed inset-0 z-40" onClick={() => { setShowFilterMenu(false); setShowSortMenu(false); }} />
          )}

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
              <p className={dk ? 'text-slate-400' : 'text-slate-600'}>{lang === 'de' ? 'Lädt...' : 'Loading...'}</p>
            </div>
          ) : error ? (
            <div className="p-5 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 font-bold text-sm mb-1">Error: {error}</p>
              <button onClick={loadHotels} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {addingHotel && !insertAfterHotelId && (
                <NewHotelRow
                  isDarkMode={dk}
                  lang={lang}
                  companyOptions={companyOptions}
                  cityOptions={cityOptions}
                  onSave={h => { setHotels(prev => [h, ...prev]); setAddingHotel(false); }}
                  onCancel={() => setAddingHotel(false)}
                />
              )}

              {displayHotels.length === 0 && !addingHotel ? (
                <div className={cn(
                  'text-center py-20 rounded-2xl border-2 border-dashed',
                  dk ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                )}>
                  <div className={cn('w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center', dk ? 'bg-blue-600/20' : 'bg-blue-100')}>
                    <Building2 size={32} className="text-blue-500" />
                  </div>
                  <h3 className={cn('text-xl font-bold mb-2', dk ? 'text-white' : 'text-slate-900')}>
                    {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
                  </h3>
                  <button onClick={() => setAddingHotel(true)} className="px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl inline-flex items-center gap-2 text-sm">
                    <Plus size={18} />
                    {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                  </button>
                </div>
              ) : (
                displayHotels.map((hotel) => {
                  const showInsertRow = insertAfterHotelId === hotel.id;

                  return (
                    <div key={hotel.id} className="space-y-2" onMouseEnter={() => activateShareForHotel(hotel)}>
                      <HotelRow
                        entry={hotel}
                        isDarkMode={dk}
                        lang={lang}
                        companyOptions={companyOptions}
                        cityOptions={cityOptions}
                        onAddBelow={(afterHotelId) => {
                          setInsertAfterHotelId(afterHotelId);
                          setAddingHotel(true);
                        }}
                        onDelete={async (id) => {
                          try {
                            await deleteHotel(id);
                            setHotels(prev => prev.filter(h => h.id !== id));
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        onUpdate={(id, updated) => {
                          setHotels(prev => prev.map(h => h.id === id ? { ...h, ...updated } : h));
                          if (activeShareHotelId === id) {
                            setActiveShareHotelName(updated.name || hotel.name);
                            setActiveCollaborators(updated.collaborators || hotel.collaborators || []);
                          }
                        }}
                      />

                      {showInsertRow && (
                        <NewHotelRow
                          isDarkMode={dk}
                          lang={lang}
                          companyOptions={companyOptions}
                          cityOptions={cityOptions}
                          onSave={(newHotel) => {
                            setHotels(prev => {
                              const idx = prev.findIndex(h => h.id === hotel.id);
                              if (idx === -1) return [...prev, newHotel];
                              const next = [...prev];
                              next.splice(idx + 1, 0, newHotel);
                              return next;
                            });
                            setAddingHotel(false);
                            setInsertAfterHotelId(null);
                          }}
                          onCancel={() => {
                            setAddingHotel(false);
                            setInsertAfterHotelId(null);
                          }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
