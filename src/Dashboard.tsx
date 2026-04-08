// src/components/Dashboard.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Search, SlidersHorizontal, Download, Plus, X,
  WifiOff, Loader2, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import { cn, formatCurrency, getHotelFreeBeds, getDurationTotal, calculateNights } from '../lib/utils';
import { getHotels, createHotel } from '../lib/supabase';
import { offlineSync } from '../lib/offlineSync';
import HotelRow from './HotelRow';
import type { SyncStatus, GroupBy, SortBy, FreeBedFilter, PaidFilter, DepositFilter } from '../lib/types';

interface Props {
  isDarkMode: boolean;
  lang?: 'de' | 'en';
  selectedMonth: number;
  selectedYear: number;
}

export default function Dashboard({ isDarkMode: dk, lang = 'de', selectedMonth, selectedYear }: Props) {
  const [hotels, setHotels]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('saved');
  const [search, setSearch]           = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [groupBy, setGroupBy]         = useState<GroupBy>('none');
  const [sortBy, setSortBy]           = useState<SortBy>('name');
  const [freeBedFilter, setFreeBedFilter]         = useState<FreeBedFilter>('none');
  const [freeBedCustomDate, setFreeBedCustomDate] = useState('');
  const [paidFilter, setPaidFilter]               = useState<PaidFilter>('all');
  const [depositFilter, setDepositFilter]         = useState<DepositFilter>('all');
  const filterRef = useRef<HTMLDivElement>(null);

  const today   = new Date().toISOString().split('T')[0];
  const tomorrow= new Date(Date.now()+86400000).toISOString().split('T')[0];
  const in5days = new Date(Date.now()+5*86400000).toISOString().split('T')[0];
  const in7days = new Date(Date.now()+7*86400000).toISOString().split('T')[0];

  useEffect(() => {
    const unsub = offlineSync.subscribe(setSyncStatus);
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      try { setLoading(true); setHotels(await getHotels()); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function handleAddHotel() {
    try {
      const created = await createHotel({ name:'', city:'', companyTag:'' });
      setHotels(p => [created, ...p]);
    } catch {
      const temp = { id:`temp_${Date.now()}`, name:'', city:'', companyTag:'', durations:[], createdAt: new Date().toISOString() };
      setHotels(p => [temp, ...p]);
      await offlineSync.enqueue({ type:'createHotel', payload:temp });
    }
  }

  const handleHotelUpdate  = (id: string, data: any) => setHotels(p => p.map(h => h.id===id ? {...h,...data} : h));
  const handleHotelDelete  = (id: string)            => setHotels(p => p.filter(h => h.id!==id));
  const handleDurUpdate    = (hid: string, did: string, data: any) =>
    setHotels(p => p.map(h => h.id!==hid ? h : {...h, durations: h.durations.map((d:any) => d.id===did ? {...d,...data} : d)}));
  const handleDurDelete    = (hid: string, did: string) =>
    setHotels(p => p.map(h => h.id!==hid ? h : {...h, durations: h.durations.filter((d:any) => d.id!==did)}));
  const handleDurCreate    = (hid: string, dur: any)   =>
    setHotels(p => p.map(h => h.id!==hid ? h : {...h, durations: [...h.durations, dur]}));

  function getFreeBedDate(): string | undefined {
    switch (freeBedFilter) {
      case 'today':    return today;
      case 'tomorrow': return tomorrow;
      case 'in5days':  return in5days;
      case 'in7days':  return in7days;
      case 'custom':   return freeBedCustomDate || undefined;
      default:         return undefined;
    }
  }

  function searchFields(h: any) {
    return [
      h.name, h.city, h.companyTag, h.contactPerson, h.contact,
      h.address, h.email, h.webLink, h.notes,
      ...(h.durations||[]).flatMap((d:any)=>[
        d.invoiceNo, d.bookingId, d.roomNo, d.floor,
        ...(d.employees||[]).map((e:any)=>e?.name),
      ]),
    ].filter(Boolean).join(' ').toLowerCase();
  }

  let filtered = hotels.filter(h => {
    const ms = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01`;
    const me = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(new Date(selectedYear,selectedMonth,0).getDate()).padStart(2,'0')}`;
    const inMonth = h.durations.length===0 || h.durations.some((d:any)=>
      !d.startDate || !d.endDate || (d.startDate<=me && d.endDate>=ms)
    );
    if (!inMonth) return false;
    if (search.trim() && !searchFields(h).includes(search.trim().toLowerCase())) return false;
    const fbd = getFreeBedDate();
    if (fbd && getHotelFreeBeds(h, fbd) <= 0) return false;
    if (paidFilter==='paid'   && !h.durations.some((d:any)=> d.isPaid))  return false;
    if (paidFilter==='unpaid' && !h.durations.some((d:any)=>!d.isPaid))  return false;
    if (depositFilter==='deposit-paid' && !h.durations.some((d:any)=> d.hasDeposit)) return false;
    if (depositFilter==='no-deposit'   &&  h.durations.some((d:any)=> d.hasDeposit)) return false;
    return true;
  });

  filtered = [...filtered].sort((a,b) => {
    switch (sortBy) {
      case 'name':   return (a.name||'').localeCompare(b.name||'');
      case 'city':   return (a.city||'').localeCompare(b.city||'');
      case 'cost':   return b.durations.reduce((s:number,d:any)=>s+getDurationTotal(d),0) - a.durations.reduce((s:number,d:any)=>s+getDurationTotal(d),0);
      case 'nights': return b.durations.reduce((s:number,d:any)=>s+calculateNights(d.startDate,d.endDate),0) - a.durations.reduce((s:number,d:any)=>s+calculateNights(d.startDate,d.endDate),0);
      default: return 0;
    }
  });

  const grouped: Record<string,any[]> = {};
  if (groupBy!=='none') {
    filtered.forEach(h => {
      const key=(groupBy==='company'?h.companyTag:h.city)||(lang==='de'?'Unbekannt':'Unknown');
      if (!grouped[key]) grouped[key]=[];
      grouped[key].push(h);
    });
  }

  const totalHotels   = filtered.length;
  const totalFreeBeds = filtered.reduce((s,h)=>s+getHotelFreeBeds(h,today),0);
  const totalCost     = filtered.reduce((s,h)=>s+h.durations.reduce((ss:number,d:any)=>ss+getDurationTotal(d),0),0);
  const hasFilters    = !!(search || freeBedFilter!=='none' || paidFilter!=='all' || depositFilter!=='all');

  function clearFilters() {
    setSearch(''); setFreeBedFilter('none'); setFreeBedCustomDate('');
    setPaidFilter('all'); setDepositFilter('all');
  }

  function handleExport() {
    const rows = filtered.map(h=>[
      h.name, h.city, h.companyTag, h.contactPerson||h.contact||'', h.email||'',
      h.durations.length,
      h.durations.reduce((s:number,d:any)=>s+getDurationTotal(d),0).toFixed(2),
    ]);
    const csv=[['Hotel','Stadt','Firma','Kontakt','Email','Aufenthalte','Kosten'],...rows].map(r=>r.join(';')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download=`eurotrack-${selectedYear}-${String(selectedMonth).padStart(2,'0')}.csv`;
    a.click();
  }

  const syncMap: Record<string,{icon:React.ReactNode;label:string;color:string}> = {
    saved:   {icon:<CheckCircle size={12}/>,                      label:lang==='de'?'Gespeichert':'Saved',    color:'text-green-500'},
    saving:  {icon:<Loader2 size={12} className="animate-spin"/>, label:lang==='de'?'Speichern...':'Saving...', color:'text-blue-400'},
    pending: {icon:<Clock size={12}/>,                            label:lang==='de'?'Ausstehend':'Pending',  color:'text-yellow-500'},
    failed:  {icon:<AlertCircle size={12}/>,                      label:lang==='de'?'Fehler':'Failed',       color:'text-red-500'},
    offline: {icon:<WifiOff size={12}/>,                          label:'Offline',                            color:'text-orange-400'},
  };
  const si = syncMap[syncStatus] || syncMap.saved;

  const inputBase = cn('px-3 py-1.5 rounded-lg border text-sm outline-none transition-all',
    dk?'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500'
      :'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400');
  const btn = cn('px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0',
    dk?'border-white/10 text-slate-300 hover:bg-white/10':'border-slate-200 text-slate-600 hover:bg-slate-50');

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ══ STICKY TOOLBAR ══════════════════════════════════════════════════ */}
      <div className={cn('sticky top-0 z-20 px-4 py-2 border-b flex items-center gap-2 flex-wrap',
        dk?'bg-slate-950 border-white/10':'bg-slate-50 border-slate-200')}>

        {/* Metrics */}
        <div className={cn('text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg',
          dk?'bg-white/5 text-slate-300':'bg-white border border-slate-200 text-slate-700')}>
          {totalHotels} {lang==='de'?'Hotels':'hotels'}
        </div>
        <div className={cn('text-xs font-bold shrink-0 px-2.5 py-1 rounded-lg',
          totalFreeBeds>0?'bg-red-500/10 text-red-500':dk?'bg-white/5 text-slate-600':'bg-white border border-slate-200 text-slate-400')}>
          {totalFreeBeds} {lang==='de'?'frei':'free'}
        </div>
        <div className={cn('text-xs font-bold shrink-0 px-2.5 py-1 rounded-lg',
          dk?'bg-white/5 text-slate-300':'bg-white border border-slate-200 text-slate-700')}>
          {formatCurrency(totalCost)}
        </div>

        <div className="w-px h-5 shrink-0 bg-slate-300/30"/>

        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-[260px]">
          <Search size={13} className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none',dk?'text-slate-500':'text-slate-400')}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={lang==='de'?'Suchen...':'Search...'}
            className={cn(inputBase,'pl-8 w-full pr-7')}/>
          {search && (
            <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12}/>
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button onClick={()=>setShowFilters(!showFilters)}
            className={cn(btn, hasFilters&&'bg-blue-600 border-blue-600 text-white hover:bg-blue-700')}>
            <SlidersHorizontal size={13}/>
            {lang==='de'?'Filter':'Filter'}
            {hasFilters&&<span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-black flex items-center justify-center">!</span>}
          </button>

          {showFilters && (
            <div className={cn('absolute top-full left-0 mt-2 w-80 rounded-xl border shadow-2xl p-4 space-y-4 z-40',
              dk?'bg-slate-900 border-white/10':'bg-white border-slate-200')}>
              <div className="flex items-center justify-between">
                <p className={cn('text-xs font-bold uppercase tracking-wide',dk?'text-slate-400':'text-slate-500')}>{lang==='de'?'Filter':'Filters'}</p>
                {hasFilters&&<button onClick={clearFilters} className="text-[11px] text-red-400 hover:text-red-500 font-semibold flex items-center gap-1"><X size={10}/>{lang==='de'?'Alle löschen':'Clear all'}</button>}
              </div>

              {/* Free beds */}
              <div className="space-y-2">
                <p className={cn('text-[10px] font-bold uppercase tracking-wide',dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Freie Betten':'Free beds'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {([['none',lang==='de'?'Alle':'All'],['today',lang==='de'?'Heute':'Today'],['tomorrow',lang==='de'?'Morgen':'Tomorrow'],['in5days',lang==='de'?'In 5 Tagen':'In 5 days'],['in7days',lang==='de'?'In 7 Tagen':'In 7 days'],['custom',lang==='de'?'Datum':'Date']] as [FreeBedFilter,string][]).map(([val,label])=>(
                    <button key={val} onClick={()=>setFreeBedFilter(val)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        freeBedFilter===val?'bg-blue-600 text-white border-blue-600':dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                      {label}
                    </button>
                  ))}
                </div>
                {freeBedFilter==='custom'&&<input type="date" value={freeBedCustomDate} onChange={e=>setFreeBedCustomDate(e.target.value)} className={cn(inputBase,'w-full')}/>}
              </div>

              {/* Paid */}
              <div className="space-y-2">
                <p className={cn('text-[10px] font-bold uppercase tracking-wide',dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Zahlungsstatus':'Payment'}</p>
                <div className="flex gap-1.5">
                  {([['all',lang==='de'?'Alle':'All'],['paid',lang==='de'?'Bezahlt':'Paid'],['unpaid',lang==='de'?'Offen':'Unpaid']] as [PaidFilter,string][]).map(([val,label])=>(
                    <button key={val} onClick={()=>setPaidFilter(val)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        paidFilter===val?'bg-green-600 text-white border-green-600':dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deposit */}
              <div className="space-y-2">
                <p className={cn('text-[10px] font-bold uppercase tracking-wide',dk?'text-slate-500':'text-slate-400')}>Kaution</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([['all',lang==='de'?'Alle':'All'],['deposit-paid',lang==='de'?'Kaution hinterlegt':'Deposit paid'],['no-deposit',lang==='de'?'Keine Kaution':'No deposit']] as [DepositFilter,string][]).map(([val,label])=>(
                    <button key={val} onClick={()=>setDepositFilter(val)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        depositFilter===val?'bg-blue-600 text-white border-blue-600':dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group by */}
              <div className="space-y-2">
                <p className={cn('text-[10px] font-bold uppercase tracking-wide',dk?'text-slate-500':'text-slate-400')}>{lang==='de'?'Gruppieren nach':'Group by'}</p>
                <div className="flex gap-1.5">
                  {([['none',lang==='de'?'Keine':'None'],['company',lang==='de'?'Firma':'Company'],['city',lang==='de'?'Stadt':'City']] as [GroupBy,string][]).map(([val,label])=>(
                    <button key={val} onClick={()=>setGroupBy(val)}
                      className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        groupBy===val?dk?'bg-white/20 text-white border-white/20':'bg-slate-700 text-white border-slate-700':dk?'border-white/10 text-slate-400 hover:bg-white/5':'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
