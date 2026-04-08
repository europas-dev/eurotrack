// src/components/Dashboard.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, SlidersHorizontal, ArrowUpDown, Download, Plus, X,
  Wifi, WifiOff, Loader2, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import { cn, formatCurrency, getHotelFreeBeds, getDurationTotal } from '../lib/utils';
import { getHotels, createHotel } from '../lib/supabase';
import { offlineSync } from '../lib/offlineSync';
import HotelRow from './HotelRow';
import type { SyncStatus, GroupBy, SortBy, FreeBedFilter, PaidFilter, DepositFilter } from '../lib/types';

interface Props {
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  selectedMonth: number; // 1-12
  selectedYear: number;
}

export default function Dashboard({ isDarkMode: dk, lang = 'de', selectedMonth, selectedYear }: Props) {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Filter / Sort state ──────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [freeBedFilter, setFreeBedFilter] = useState<FreeBedFilter>('none');
  const [freeBedCustomDate, setFreeBedCustomDate] = useState('');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [depositFilter, setDepositFilter] = useState<DepositFilter>('all');
  const filterRef = useRef<HTMLDivElement>(null);

  const today     = new Date().toISOString().split('T')[0];
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const in5days   = new Date(Date.now() + 5*86400000).toISOString().split('T')[0];
  const in7days   = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];

  // ── Online/offline + sync status ─────────────────────────────────────────
  useEffect(() => {
    const unsub = offlineSync.subscribe(setSyncStatus);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { unsub(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // ── Load hotels ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getHotels();
        setHotels(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Close filter panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Hotel CRUD ────────────────────────────────────────────────────────────
  async function handleAddHotel() {
    try {
      const created = await createHotel({ name: '', city: '', companyTag: '' });
      setHotels(prev => [created, ...prev]);
    } catch {
      const temp = {
        id: `temp_${Date.now()}`, name: '', city: '', companyTag: '',
        durations: [], createdAt: new Date().toISOString(),
      };
      setHotels(prev => [temp, ...prev]);
      await offlineSync.enqueue({ type: 'createHotel', payload: temp });
    }
  }

  function handleHotelUpdate(id: string, data: any) {
    setHotels(prev => prev.map(h => h.id === id ? { ...h, ...data } : h));
  }

  function handleHotelDelete(id: string) {
    setHotels(prev => prev.filter(h => h.id !== id));
  }

  function handleDurationUpdate(hotelId: string, durId: string, data: any) {
    setHotels(prev => prev.map(h => h.id !== hotelId ? h : {
      ...h,
      durations: h.durations.map((d: any) => d.id === durId ? { ...d, ...data } : d),
    }));
  }

  function handleDurationDelete(hotelId: string, durId: string) {
    setHotels(prev => prev.map(h => h.id !== hotelId ? h : {
      ...h,
      durations: h.durations.filter((d: any) => d.id !== durId),
    }));
  }

  function handleDurationCreate(hotelId: string, dur: any) {
    setHotels(prev => prev.map(h => h.id !== hotelId ? h : {
      ...h,
      durations: [...h.durations, dur],
    }));
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const getFreeBedDate = (): string | undefined => {
    switch (freeBedFilter) {
      case 'today':   return today;
      case 'tomorrow':return tomorrow;
      case 'in5days': return in5days;
      case 'in7days': return in7days;
      case 'custom':  return freeBedCustomDate || undefined;
      default: return undefined;
    }
  };

  const searchFields = (h: any): string => [
    h.name, h.city, h.companyTag, h.contactPerson, h.contact,
    h.address, h.email, h.webLink, h.notes,
    ...(h.durations||[]).flatMap((d:any)=>[
      d.invoiceNo, d.bookingId, d.roomNo, d.floor,
      ...(d.employees||[]).map((e:any)=>e?.name),
    ]),
  ].filter(Boolean).join(' ').toLowerCase();

  let filtered = hotels.filter(h => {
    // Month/year filter: hotel must have at least one duration overlapping selected month
    const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01`;
    const monthEnd   = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
    const inMonth = h.durations.length === 0 || h.durations.some((d:any) => {
      if (!d.startDate || !d.endDate) return true;
      return d.startDate <= monthEnd && d.endDate >= monthStart;
    });
    if (!inMonth) return false;

    // Search
    if (search.trim() && !searchFields(h).includes(search.toLowerCase())) return false;

    // Free beds filter
    const freeBedDate = getFreeBedDate();
    if (freeBedDate) {
      const fb = getHotelFreeBeds(h, freeBedDate);
      if (fb <= 0) return false;
    }

    // Paid/Unpaid
    if (paidFilter === 'paid' && !h.durations.some((d:any)=>d.isPaid)) return false;
    if (paidFilter === 'unpaid' && !h.durations.some((d:any)=>!d.isPaid)) return false;

    // Deposit
    if (depositFilter === 'deposit-paid' && !h.durations.some((d:any)=>d.hasDeposit)) return false;
    if (depositFilter === 'no-deposit' && h.durations.some((d:any)=>d.hasDeposit)) return false;

    return true;
  });

  // ── Sorting ───────────────────────────────────────────────────────────────
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name||'').localeCompare(b.name||'');
      case 'city': return (a.city||'').localeCompare(b.city||'');
      case 'cost': return b.durations.reduce((s:number,d:any)=>s+getDurationTotal(d),0) - a.durations.reduce((s:number,d:any)=>s+getDurationTotal(d),0);
      case 'nights': return b.durations.reduce((s:number,d:any)=>s+(Math.max(0,Math.floor((new Date(d.endDate).getTime()-new Date(d.startDate).getTime())/86400000))||0),0) - a.durations.reduce((s:number,d:any)=>s+(Math.max(0,Math.floor((new Date(d.endDate).getTime()-new Date(d.startDate).getTime())/86400000))||0),0);
      default: return 0;
    }
  });

  // ── Grouping ──────────────────────────────────────────────────────────────
  const grouped: Record<string, any[]> = {};
  if (groupBy !== 'none') {
    filtered.forEach(h => {
      const key = (groupBy === 'company' ? h.companyTag : h.city) || (lang==='de'?'Unbekannt':'Unknown');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(h);
    });
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalHotels   = filtered.length;
  const totalFreeBeds = filtered.reduce((s,h)=>s+getHotelFreeBeds(h,today),0);
  const totalCost     = filtered.reduce((s,h)=>s+h.durations.reduce((ss:number,d:any)=>ss+getDurationTotal(d),0),0);

  const hasActiveFilters = search || freeBedFilter !== 'none' || paidFilter !== 'all' || depositFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setFreeBedFilter('none');
    setFreeBedCustomDate('');
    setPaidFilter('all');
    setDepositFilter('all');
  }

  // ── Sync status indicator ─────────────────────────────────────────────────
  function SyncIndicator() {
    const map: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      saved:   { icon: <CheckCircle size={12}/>, label: lang==='de'?'Gespeichert':'Saved',  color: 'text-green-500' },
      saving:  { icon: <Loader2 size={12} className="animate-spin"/>, label: lang==='de'?'Speichern...':'Saving...', color: 'text-blue-400' },
      pending: { icon: <Clock size={12}/>, label: lang==='de'?'Ausstehend':'Pending sync', color: 'text-yellow-500' },
      failed:  { icon: <AlertCircle size={12}/>, label: lang==='de'?'Fehler':'Sync failed', color: 'text-red-500' },
      offline: { icon: <WifiOff size={12}/>, label: lang==='de'?'Offline':'Offline', color: 'text-orange-400' },
    };
    const s = map[syncStatus] || map.saved;
    return (
      <div className={cn('flex items-center gap-1 text-[11px] font-semibold', s.color)}>
        {s.icon}{s.label}
      </div>
    );
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    const rows = filtered.map(h => ({
      Hotel: h.name, Stadt: h.city, Firma: h.companyTag,
      Kontakt: h.contactPerson||h.contact||'',
      Email: h.email||'', Tel: h.contact||'',
      Durations: h.durations.length,
      Gesamtkosten: filtered.reduce((s:number,x:any)=>s+x.durations.reduce((ss:number,d:any)=>ss+getDurationTotal(d),0),0),
    }));
    const csv = [Object.keys(rows[0]||{}).join(';'), ...rows.map(r=>Object.values(r).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eurotrack-${selectedYear}-${selectedMonth}.csv`;
    a.click();
  }

  const inputBase = cn('px-3 py-1.5 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400'
  );
  const btnBase = cn('px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0',
    dk ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  );

  return (
    <div className="flex flex-col h-full">

      {/* ══ STICKY TOP TOOLBAR ══════════════════════════════════════════════ */}
      <div className={cn('sticky top-0 z-20 px-4 py-2.5 border-b flex items-center gap-2 flex-wrap',
        dk ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-200'
      )}>

        {/* Summary metrics */}
        <div className={cn('flex items-center gap-1 text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg',
          dk?'bg-white/5 text-slate-300':'bg-white border border-slate-200 text-slate-700'
        )}>
          {totalHotels} {lang==='de'?'Hotels':'hotels'}
        </div>

        <div className={cn('flex items-center gap-1 text-xs font-bold shrink-0 px-2.5 py-1 rounded-lg',
          totalFreeBeds > 0
            ? 'bg-red-500/10 text-red-500'
            : dk?'bg-white/5 text-slate-500':'bg-white border border-slate-200 text-slate-400'
        )}>
          {totalFreeBeds} {lang==='de'?'frei':'free'}
        </div>

        <div className={cn('flex items-center gap-1 text-xs font-bold shrink-0 px-2.5 py-1 rounded-lg',
          dk?'bg-white/5 text-slate-300':'bg-white border border-slate-200 text-slate-700'
        )}>
          {formatCurrency(totalCost)}
        </div>

        <div className="w-px h-5 bg-slate-300/30 shrink-0"/>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
          <Search size={13} className={cn('absolute left-2.5 top-1/2 -translate-y-1/2', dk?'text-slate-500':'text-slate-400')}/>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder={lang==='de'?'Suchen...':'Search...'}
            className={cn(inputBase, 'pl-8 w-full')}
          />
          {search && (
            <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12}/>
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={()=>setShowFilters(!showFilters)}
            className={cn(btnBase, hasActiveFilters && 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700')}
          >
            <SlidersHorizontal size={13}/>
            {lang==='de'?'Filter':'Filter'}
            {hasActiveFilters && <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-black flex items-center justify-center">!</span>}
          </button>

          {showFilters && (
            <div className={cn('absolute top-full left-0 mt-2 w-72 rounded-xl border shadow-xl p-4 space-y-4 z-30',
              dk?'bg-slate-900 border-white/10':'bg-white border-slate-200'
            )}>
              <div className="flex items-center justify-between">
                <p className={cn('text-xs font-bold uppercase tracking-wide', dk?'text-slate-400':'text-slate-500')}>{lang==='de'?'Filter':'Filters'}</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-[11px] text-red-400 hover:text-red-500 font-semibold flex items-center gap-1">
                    <X size={10}/>{lang==='de'?'Alle löschen':'Clear all'}
                  </button>
                )}
              </div>

              {/* Free beds filter */}
              <div className="space-y-1.5">
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Freie Betten':'Free beds'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { val:'none',    label: lang==='de'?'Alle':'All' },
                    { val:'today',   label: lang==='de'?'Heute':'Today' },
                    { val:'tomorrow',label: lang==='de'?'Morgen':'Tomorrow' },
                    { val:'in5days', label: lang==='de'?'In 5 Tagen':'In 5 days' },
                    { val:'in7days', label: lang==='de'?'In 7 Tagen':'In 7 days' },
                    { val:'custom',  label: lang==='de'?'Datum':'Date' },
                  ].map(opt=>(
                    <button
                      key={opt.val}
                      onClick={()=>setFreeBedFilter(opt.val as FreeBedFilter)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        freeBedFilter===opt.val
                          ? 'bg-blue-600 text-white border-blue-600'
                          : dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}
                    >{opt.label}</button>
                  ))}
                </div>
                {freeBedFilter==='custom' && (
                  <input type="date" value={freeBedCustomDate} onChange={e=>setFreeBedCustomDate(e.target.value)}
                    className={cn(inputBase,'w-full mt-1')}/>
                )}
              </div>

              {/* Paid filter */}
              <div className="space-y-1.5">
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Zahlungsstatus':'Payment'}</p>
                <div className="flex gap-1.5">
                  {[
                    { val:'all',    label: lang==='de'?'Alle':'All' },
                    { val:'paid',   label: lang==='de'?'Bezahlt':'Paid' },
                    { val:'unpaid', label: lang==='de'?'Offen':'Unpaid' },
                  ].map(opt=>(
                    <button key={opt.val} onClick={()=>setPaidFilter(opt.val as PaidFilter)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        paidFilter===opt.val ? 'bg-green-600 text-white border-green-600' : dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Deposit filter */}
              <div className="space-y-1.5">
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dk?'text-slate-500':'text-slate-400')}>Kaution</p>
                <div className="flex gap-1.5">
                  {[
                    { val:'all',          label: lang==='de'?'Alle':'All' },
                    { val:'deposit-paid', label: lang==='de'?'Kaution hinterlegt':'Deposit paid' },
                    { val:'no-deposit',   label: lang==='de'?'Keine Kaution':'No deposit' },
                  ].map(opt=>(
                    <button key={opt.val} onClick={()=>setDepositFilter(opt.val as DepositFilter)}
                      className={cn('px-2 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        depositFilter===opt.val ? 'bg-blue-600 text-white border-blue-600' : dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Group by */}
              <div className="space-y-1.5">
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Gruppieren':'Group by'}</p>
                <div className="flex gap-1.5">
                  {[
                    { val:'none',    label: lang==='de'?'Keine':'None' },
                    { val:'company', label: lang==='de'?'Firma':'Company' },
                    { val:'city',    label: lang==='de'?'Stadt':'City' },
                  ].map(opt=>(
                    <button key={opt.val} onClick={()=>setGroupBy(opt.val as GroupBy)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        groupBy===opt.val ? 'bg-slate-700 text-white border-slate-700' : dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50'
                      )}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortBy)} className={cn(inputBase,'shrink-0')}>
          <option value="name">{lang==='de'?'Name':'Name'}</option>
          <option value="city">{lang==='de'?'Stadt':'City'}</option>
          <option value="cost">{lang==='de'?'Kosten':'Cost'}</option>
          <option value="nights">{lang==='de'?'Nächte':'Nights'}</option>
        </select>

        {/* Export */}
        <button onClick={handleExport} className={btnBase}>
          <Download size={13}/>{lang==='de'?'Export':'Export'}
        </button>

        {/* Add hotel */}
        <button
          onClick={handleAddHotel}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Plus size={13}/>{lang==='de'?'Hotel':'Hotel'}
        </button>

        {/* Sync status */}
        <div className="ml-auto shrink-0">
          <SyncIndicator />
        </div>
      </div>

      {/* ══ HOTEL LIST ══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className={cn('animate-spin', dk?'text-slate-500':'text-slate-400')}/>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className={cn('flex flex-col items-center justify-center py-16 text-center', dk?'text-slate-600':'text-slate-400')}>
            <p className="text-sm font-semibold mb-1">{lang==='de'?'Keine Hotels gefunden':'No hotels found'}</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-500 hover:text-blue-600 underline mt-1">
                {lang==='de'?'Filter löschen':'Clear filters'}
              </button>
            )}
          </div>
        )}

        {!loading && groupBy === 'none' && filtered.map(hotel => (
          <HotelRow
            key={hotel.id}
            hotel={hotel}
            isDarkMode={dk}
            lang={lang}
            highlightText={search}
            showPaidAmounts={paidFilter !== 'all'}
            onUpdate={handleHotelUpdate}
            onDelete={handleHotelDelete}
            onDurationUpdate={handleDurationUpdate}
            onDurationDelete={handleDurationDelete}
            onDurationCreate={handleDurationCreate}
          />
        ))}

        {!loading && groupBy !== 'none' && Object.entries(grouped).map(([groupName, groupHotels]) => (
          <div key={groupName} className="space-y-2">
            <div className="flex items-center gap-2">
              <p className={cn('text-xs font-bold uppercase tracking-widest', dk?'text-slate-500':'text-slate-400')}>{groupName}</p>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', dk?'bg-white/5 text-slate-500':'bg-slate-100 text-slate-500')}>{groupHotels.length}</span>
              <div className={cn('flex-1 h-px', dk?'bg-white/5':'bg-slate-200')}/>
            </div>
            {groupHotels.map(hotel => (
              <HotelRow
                key={hotel.id}
                hotel={hotel}
                isDarkMode={dk}
                lang={lang}
                highlightText={search}
                showPaidAmounts={paidFilter !== 'all'}
                onUpdate={handleHotelUpdate}
                onDelete={handleHotelDelete}
                onDurationUpdate={handleDurationUpdate}
                onDurationDelete={handleDurationDelete}
                onDurationCreate={handleDurationCreate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
