//src/components/StatisticsDashboard.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { cn, formatCurrency, calculateNights, calcInvoiceItem } from '../lib/utils';
import { TrendingUp, TrendingDown, CreditCard, AlertCircle, ShieldCheck, Clock, Trophy, BedDouble, Building2, MapPin,ReceiptEuro, Building, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';

interface Props {
  hotels: any[];
  selectedYear: number;
  selectedMonth: number | null;
  groupBy: 'none' | 'hotel' | 'company' | 'city' | 'country';
  parentSortBy?: string;           
  parentSortDir?: 'asc' | 'desc';  
  lang: 'de' | 'en';
  dk: boolean;
}

export default function StatisticsDashboard({ hotels, selectedYear, selectedMonth, groupBy, parentSortBy, parentSortDir, lang, dk }: Props) {
  
  const [localGroup, setLocalGroup] = useState<'hotel' | 'company' | 'city' | 'country' | 'employee'>(groupBy === 'none' ? 'hotel' : (groupBy as any));
  const [sortAsc, setSortAsc] = useState(false);
  const [chartTab, setChartTab] = useState<'all' | 'total' | 'paid' | 'unpaid'>('all'); 

  // Auto-sync with parent dashboard if the parent filter changes
  useEffect(() => {
    setLocalGroup(groupBy === 'none' ? 'hotel' : (groupBy as any));
  }, [groupBy]);

  // NEW: Auto-sync sort direction IF the parent is actively sorting by 'cost'
  useEffect(() => {
    if (parentSortBy === 'cost' && parentSortDir) {
      setSortAsc(parentSortDir === 'asc');
    }
  }, [parentSortBy, parentSortDir]);

  // --- RE-ENGINEERED INDESTRUCTIBLE METRICS ENGINE ---
  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalOverdue = 0;
    let totalDeposits = 0;

    let months = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0, paid: 0, unpaid: 0, pending: 0, overdue: 0 }));
    let groupedTotals: Record<string, number> = {};
    
    let mostBooked = { name: '-', count: 0 };
    let leastBooked = { name: '-', count: Infinity }; // Start with Infinity for finding the minimum
    
    let bedPriceSum = 0;
    let bedPriceCount = 0;
    let minBedPrice = { hotelName: '-', price: Infinity };
    let maxBedPrice = { hotelName: '-', price: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (hotels || []).forEach(h => {
      if (!h) return;
      
      let hotelBruttoBeforeDiscount = 0;
      let rawPaid = 0;
      let rawUnpaid = 0;
      let rawOverdue = 0;
      let hasInvoicesInContext = false;

      // Safe parse for deposits (checking both camelCase and snake_case)
      const isDepEnabled = h.depositEnabled ?? h.deposit_enabled;
      const depAmt = h.depositAmount ?? h.deposit_amount;
      if (isDepEnabled && depAmt) {
         totalDeposits += parseFloat(depAmt) || 0;
      }
      
      const dCount = (h.durations || []).length;
      if (dCount > mostBooked.count) {
        mostBooked = { name: h.name || 'Unnamed', count: dCount };
      }
      // NEW: Track least booked (ignore hotels with zero bookings)
      if (dCount > 0 && dCount < leastBooked.count) {
        leastBooked = { name: h.name || 'Unnamed', count: dCount };
      }

      const bedOverride = h.override_price_per_bed ?? h.overridePricePerBed;
      if (bedOverride != null) {
        const overrideP = parseFloat(bedOverride) || 0;
        bedPriceSum += overrideP;
        bedPriceCount++;
        
        // NEW: Track lowest and highest from overrides
        if (overrideP > 0 && overrideP < minBedPrice.price) {
          minBedPrice = { hotelName: h.name || 'Unnamed', price: overrideP };
        }
        if (overrideP > maxBedPrice.price) {
          maxBedPrice = { hotelName: h.name || 'Unnamed', price: overrideP };
        }
      }
      if (bedOverride != null) {
        bedPriceSum += parseFloat(bedOverride) || 0;
        bedPriceCount++;
      }

      (h.invoices || []).forEach((inv: any) => {
        if (!inv) return;
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        if (!dateStr) return;
        const d = new Date(dateStr);
        
        // Strict global year filter constraint
        if (d.getFullYear() !== selectedYear) return;
        
        let invBrutto = 0;
        if (inv.billingMode === 'total') {
          const baseN = parseFloat(inv.totalNetto) || 0;
          const m = parseFloat(inv.totalMwst) || 0;
          const disc = parseFloat(inv.discountValue) || 0;
          const isPct = inv.discountType === 'percentage';
          invBrutto = Math.max(0, baseN - (isPct ? baseN * (disc / 100) : disc)) * (1 + m / 100);
        } else {
          const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
          (inv.items || []).forEach((item: any) => {
            if (!item) return;
            invBrutto += calcInvoiceItem(item, defaultN)?.brutto || 0;
            if (item.type === 'room' && item.method === 'per_bed' && item.netto && parseFloat(item.netto) > 0) {
               const p = parseFloat(item.netto) || 0;
               bedPriceSum += p;
               bedPriceCount++;
               
               // NEW: Track lowest and highest from itemized bed prices
               if (p < minBedPrice.price) {
                 minBedPrice = { hotelName: h.name || 'Unnamed', price: p };
               }
               if (p > maxBedPrice.price) {
                 maxBedPrice = { hotelName: h.name || 'Unnamed', price: p };
               }
            }
          });
        }

        // Safeguard against NaN values poisoning the month matrix
        invBrutto = isNaN(invBrutto) ? 0 : invBrutto;
        
        // ALWAYS add to the month array so the whole year chart works
        const mIdx = d.getMonth();
        months[mIdx].total += invBrutto;
        if (inv.isPaid) {
          months[mIdx].paid += invBrutto;
        } else {
          months[mIdx].unpaid += invBrutto;
          if (inv.dueDate && new Date(inv.dueDate) < today) months[mIdx].overdue += invBrutto;
          else months[mIdx].pending += invBrutto;
        }

        // Apply specific month filter for top KPIs
        if (selectedMonth !== null && d.getMonth() !== selectedMonth) return;

        hasInvoicesInContext = true;
        hotelBruttoBeforeDiscount += invBrutto;

        if (inv.isPaid) {
          rawPaid += invBrutto;
        } else {
          rawUnpaid += invBrutto;
          if (inv.dueDate && new Date(inv.dueDate) < today) {
            rawOverdue += invBrutto;
          }
        }
      });

      // Mirror global discount evaluation architecture
      let discountedBrutto = hotelBruttoBeforeDiscount;
      const hasGlobDisc = h.has_global_discount ?? h.hasGlobalDiscount;
      if (hasGlobDisc) {
        const gVal = parseFloat(h.global_discount_value ?? h.globalDiscountValue) || 0;
        const gType = h.global_discount_type ?? h.globalDiscountType;
        discountedBrutto = Math.max(0, hotelBruttoBeforeDiscount - (gType === 'fixed' ? gVal : hotelBruttoBeforeDiscount * (gVal / 100)));
      }

      let finalTotal = discountedBrutto;
      const overrideTotal = h.override_total_brutto ?? h.overrideTotalBrutto;
      if (overrideTotal != null && selectedMonth === null) {
        finalTotal = parseFloat(overrideTotal) || 0;
      }

      // Final sanitize check before sums
      finalTotal = isNaN(finalTotal) ? 0 : finalTotal;
      totalSpend += finalTotal;

      const rawTotal = rawPaid + rawUnpaid;
      if (rawTotal > 0) {
        totalPaid += finalTotal * (rawPaid / rawTotal);
        totalUnpaid += finalTotal * (rawUnpaid / rawTotal);
        totalOverdue += finalTotal * (rawOverdue / rawTotal);
      } else if (finalTotal > 0 && selectedMonth === null) {
        const isHotelPaid = h.isPaid ?? h.is_paid;
        if (isHotelPaid) totalPaid += finalTotal;
        else totalUnpaid += finalTotal;
      }

      // Group dynamic data keys based on active state criteria (IGNORE FOR EMPLOYEES)
      if (localGroup !== 'employee') {
        if (finalTotal > 0 || (selectedMonth === null && hasInvoicesInContext)) {
          let groupKey = 'Unknown';
          if (localGroup === 'hotel') groupKey = h.name || 'Unnamed Hotel';
          else if (localGroup === 'company') groupKey = (h.companyTag && h.companyTag.length > 0) ? h.companyTag[0] : (lang === 'de' ? 'Ohne Firma' : 'Unassigned');
          else if (localGroup === 'city') groupKey = h.city || (lang === 'de' ? 'Unbekannte Stadt' : 'Unknown City');
          else if (localGroup === 'country') groupKey = h.country || (lang === 'de' ? 'Unbekanntes Land' : 'Unknown Country');

          groupedTotals[groupKey] = (groupedTotals[groupKey] || 0) + finalTotal;
        }
      }
    
      // --- NEW: SMART EMPLOYEE NIGHTS CALCULATOR ---
      if (localGroup === 'employee') {
        (h.durations || []).forEach((dur: any) => {
          (dur.roomCards || []).forEach((rc: any) => {
            (rc.employees || []).forEach((emp: any) => {
              if (!emp.name || (!emp.checkIn && !emp.checkin) || (!emp.checkOut && !emp.checkout)) return;
              
              let start = new Date(emp.checkIn || emp.checkin);
              let end = new Date(emp.checkOut || emp.checkout);
              
              // Constrain the dates strictly to the active Dashboard Filter
              if (selectedMonth !== null) {
                const mStart = new Date(selectedYear, selectedMonth, 1);
                const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
                if (start < mStart) start = mStart;
                if (end > mEnd) end = mEnd;
              } else {
                const yStart = new Date(selectedYear, 0, 1);
                const yEnd = new Date(selectedYear, 11, 31);
                if (start < yStart) start = yStart;
                if (end > yEnd) end = yEnd;
              }
              
              if (start < end) {
                const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                if (nights > 0) {
                  groupedTotals[emp.name] = (groupedTotals[emp.name] || 0) + nights;
                }
              }
            });
          });
        });
      }
    });

    const maxMonth = Math.max(...months.map(m => m.total), 1);
    const maxPaid = Math.max(...months.map(m => m.paid), 1);
    const maxUnpaid = Math.max(...months.map(m => m.unpaid), 1);
    
    // Support sorting both High-to-Low and Low-to-High
    const sortedGroups = Object.entries(groupedTotals).sort((a, b) => sortAsc ? a[1] - b[1] : b[1] - a[1]);
    
    // Find the actual maximum value for the visual bar scaling
    const maxGroupValue = Math.max(...sortedGroups.map(g => g[1]), 1);
    
    const avgBedPrice = bedPriceCount > 0 ? bedPriceSum / bedPriceCount : 0;

    // Cleanup if no bookings found or prices tracked
    if (leastBooked.count === Infinity) leastBooked.name = '-';
    if (minBedPrice.price === Infinity) minBedPrice.hotelName = '-';

    return { totalSpend, totalPaid, totalUnpaid, totalOverdue, totalDeposits, months, maxMonth, maxPaid, maxUnpaid, sortedGroups, maxGroupValue, mostBooked, leastBooked, avgBedPrice, minBedPrice, maxBedPrice };
  }, [hotels, selectedYear, selectedMonth, localGroup, sortAsc, lang]);

  const monthLabelsDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthLabelsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = lang === 'de' ? monthLabelsDe : monthLabelsEn;

  const Card = ({ title, value, icon: Icon, colorCls, bgCls }: any) => (
    <div className={cn("p-5 rounded-2xl border flex flex-col gap-3 shadow-sm transition-all hover:shadow-md", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-lg", bgCls, colorCls)}><Icon size={16} strokeWidth={2.5} /></div>
        <span className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{title}</span>
      </div>
      <span className={cn("text-2xl lg:text-3xl font-black truncate", dk ? "text-white" : "text-slate-900")}>{value}</span>
    </div>
  );

  // --- NEW HELPER COMPONENTS (Safely inside the room!) ---
  const HighlightChip = ({ text, colorCls, bgCls }: { text: string; colorCls: string; bgCls: string }) => (
    <div className={cn("w-fit self-start inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-lg mt-1.5 border shadow-sm backdrop-blur-md", colorCls, bgCls)}>
      {text}
    </div>
  );

  const BookingCard = ({ title, hotelName, count, icon: Icon, isMost }: any) => {
    // Explicitly define bright, high-contrast colors for both Light and Dark modes
    const colorCls = isMost ? "text-purple-600 dark:text-purple-400" : "text-slate-600 dark:text-slate-300";
    const bgCls = isMost ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20" : "bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600";
    
    return (
      <div className={cn("p-4 lg:p-5 rounded-2xl border flex items-center gap-4 shadow-sm transition-all hover:shadow-md", dk ? "bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-white/10" : "bg-gradient-to-br from-white to-slate-50 border-slate-200")}>
        <div className={cn("p-3.5 rounded-xl flex shrink-0 items-center justify-center border shadow-inner", bgCls, colorCls)}>
          <Icon size={24} strokeWidth={2.5}/>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
            <span className={cn("text-xs font-black uppercase tracking-widest truncate mb-0.5", dk ? "text-slate-400" : "text-slate-500")}>{title}</span>
            <span className={cn("text-lg sm:text-xl font-black truncate max-w-full", dk ? "text-white" : "text-slate-900")} title={hotelName}>{hotelName}</span>
            <HighlightChip text={`${count} ${lang === 'de' ? 'Buchungen' : 'Bookings'}`} colorCls={colorCls} bgCls={bgCls} />
        </div>
      </div>
    );
  };

  const PriceCard = ({ title, price, chipContent, icon: Icon, colorCls, bgCls }: any) => (
    <div className={cn("p-4 lg:p-5 rounded-2xl border flex items-center gap-3 lg:gap-4 shadow-sm transition-all hover:shadow-md", dk ? "bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-white/10" : "bg-gradient-to-br from-white to-slate-50 border-slate-200")}>
      <div className={cn("p-3.5 rounded-xl flex shrink-0 items-center justify-center border shadow-inner", bgCls, colorCls)}>
        <Icon size={24} strokeWidth={2.5}/>
      </div>
      <div className="flex flex-col min-w-0 flex-1">
          <span className={cn("text-xs font-black uppercase tracking-widest truncate mb-0.5", dk ? "text-slate-400" : "text-slate-500")} title={title}>{title}</span>
          <span className={cn("text-lg sm:text-xl font-black truncate max-w-full", dk ? "text-white" : "text-slate-900")}>{formatCurrency(price)}</span>
          <HighlightChip text={chipContent} colorCls={colorCls} bgCls={bgCls} />
      </div>
    </div>
  );

  return (
    // Added [zoom:85%] for standard screens (laptops/24"), and [zoom:100%] for ultra-wide 2xl screens (27"+)
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 fade-in duration-500 pb-10 xl:[zoom:85%] 2xl:[zoom:100%]">
      
      {/* 1. TOP KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title={lang === 'de' ? 'Gesamtkosten' : 'Total Cost'} value={formatCurrency(stats.totalSpend)} icon={ReceiptEuro} colorCls="text-blue-500" bgCls="bg-blue-500/10" />
        <Card title={lang === 'de' ? 'Total Bezahlt' : 'Total Paid'} value={formatCurrency(stats.totalPaid)} icon={ShieldCheck} colorCls="text-emerald-500" bgCls="bg-emerald-500/10" />
        
        {/* CUSTOM SPLIT CARD FOR TOTAL DUE */}
        <div className={cn("p-5 rounded-2xl border flex items-stretch justify-between gap-6 lg:gap-10 shadow-sm transition-all hover:shadow-md", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><Clock size={16} strokeWidth={2.5} /></div>
              <span className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{lang === 'de' ? 'Total Offen' : 'Total Due'}</span>
            </div>
            <span className={cn("text-2xl lg:text-3xl font-black truncate", dk ? "text-white" : "text-slate-900")}>{formatCurrency(stats.totalUnpaid)}</span>
          </div>
          
          {/* Right Side: Centered vertically to match the card height naturally */}
          <div className="flex flex-col justify-center gap-3 pl-6 lg:pl-8 border-l border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-amber-500 tracking-widest mb-0.5">{lang === 'de' ? 'Ausstehend' : 'Pending'}</span>
              <span className={cn("text-base lg:text-lg font-black truncate", dk ? "text-slate-200" : "text-slate-700")}>{formatCurrency(Math.max(0, stats.totalUnpaid - stats.totalOverdue))}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-red-500 tracking-widest mb-0.5">{lang === 'de' ? 'Überfällig' : 'Overdue'}</span>
              <span className={cn("text-base lg:text-lg font-black truncate", dk ? "text-slate-200" : "text-slate-700")}>{formatCurrency(stats.totalOverdue)}</span>
            </div>
          </div>
        </div>

        <Card title={lang === 'de' ? 'Kautionen' : 'Deposits'} value={formatCurrency(stats.totalDeposits)} icon={CreditCard} colorCls="text-indigo-500" bgCls="bg-indigo-500/10" />
      </div>

      {/* 2. CHARTS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* LEFT: CONDITIONAL CHART (MONTHLY BARS OR MONTH DONUT) */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col h-full", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          
          {/* HEADER & TABS IN ONE LINE */}
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn("text-sm font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>
              {selectedMonth === null 
                ? (lang === 'de' ? 'Monatliche Ausgaben' : 'Monthly Breakdown')
                : (lang === 'de' ? `Finanzstatus: ${labels[selectedMonth]}` : `Financial Status: ${labels[selectedMonth]}`)
              }
            </h3>
            
            {/* CHART TABS (Only show when looking at ALL months) */}
            {selectedMonth === null && (
              <div className={cn("flex p-0.5 rounded-lg", dk ? "bg-black/20" : "bg-slate-100")}>
                {[
                  { id: 'all', label: lang === 'de' ? 'Alle' : 'All', color: null },
                  { id: 'total', label: lang === 'de' ? 'Gesamt' : 'Total', color: 'bg-blue-500' },
                  { id: 'paid', label: lang === 'de' ? 'Bezahlt' : 'Paid', color: 'bg-emerald-500' },
                  { id: 'unpaid', label: lang === 'de' ? 'Offen' : 'Due', color: dk ? 'bg-slate-500' : 'bg-slate-400' }
                ].map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setChartTab(t.id as any)}
                    className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5", 
                      chartTab === t.id ? (dk ? "bg-slate-700 text-white shadow-sm" : "bg-white text-slate-800 shadow-sm") : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}
                  >
                    {/* Modern vertical line indicator matching the bar colors */}
                    {t.color && <div className={cn("w-1 h-2.5 rounded-full shrink-0", t.color)} />}
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {selectedMonth === null ? (
            // --- BAR CHART (ALL MONTHS) ---
            <div className="flex flex-col flex-1">
              

              {/* BARS CONTAINER */}
              <div className="flex-1 flex items-end gap-2 relative min-h-[260px]">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 dark:opacity-5">
                   <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
                   <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
                   <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
                   <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
                </div>
                {stats.months.map((m, i) => {
                  const activeMax = chartTab === 'paid' ? stats.maxPaid : chartTab === 'unpaid' ? stats.maxUnpaid : stats.maxMonth;
                  const pctTotal = `${Math.max((m.total / activeMax) * 100, 1)}%`;
                  const pctPaid = `${Math.max((m.paid / activeMax) * 100, 1)}%`;
                  const pctUnpaid = `${Math.max((m.unpaid / activeMax) * 100, 1)}%`;
                  const pctPending = `${Math.max((m.pending / activeMax) * 100, 1)}%`;
                  const pctOverdue = `${Math.max((m.overdue / activeMax) * 100, 1)}%`;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-3 group h-full relative z-10 cursor-crosshair">
                      
                      {/* SMART TOOLTIP */}
                      <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[11px] p-3 rounded-xl pointer-events-none z-50 whitespace-nowrap shadow-xl flex flex-col gap-1.5">
                        <span className="font-black text-slate-400 mb-1">{labels[i]}</span>
                        
                        {(chartTab === 'all' || chartTab === 'total') && (
                          <div className="flex justify-between gap-4"><span className="text-blue-400">{lang === 'de' ? 'Gesamt:' : 'Total:'}</span> <span className="font-bold">{formatCurrency(m.total)}</span></div>
                        )}
                        
                        {(chartTab === 'all' || chartTab === 'paid') && (
                          <div className="flex justify-between gap-4"><span className="text-emerald-400">{lang === 'de' ? 'Bezahlt:' : 'Paid:'}</span> <span className="font-bold">{formatCurrency(m.paid)}</span></div>
                        )}
                        
                        {chartTab === 'all' && <div className="w-full h-px bg-white/10 my-0.5"></div>}
                        
                        {(chartTab === 'all' || chartTab === 'unpaid') && (
                          <>
                            <div className="flex justify-between gap-4"><span className="text-slate-300">{lang === 'de' ? 'Total Offen:' : 'Total Due:'}</span> <span className="font-bold">{formatCurrency(m.unpaid)}</span></div>
                            <div className="flex justify-between gap-4 pl-2"><span className="text-amber-400 text-[10px]">{lang === 'de' ? '└ Ausstehend:' : '└ Pending:'}</span> <span className="font-bold text-[10px]">{formatCurrency(m.pending)}</span></div>
                            <div className="flex justify-between gap-4 pl-2"><span className="text-red-400 text-[10px]">{lang === 'de' ? '└ Überfällig:' : '└ Overdue:'}</span> <span className="font-bold text-[10px]">{formatCurrency(m.overdue)}</span></div>
                          </>
                        )}
                        
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                      </div>

                      {/* DYNAMIC BARS */}
                      <div className="w-full flex items-end justify-center h-full relative gap-0.5 lg:gap-1">
                         {chartTab === 'all' && (
                           <>
                             {m.total > 0 && <div style={{ height: pctTotal }} className="w-1/3 max-w-[12px] bg-blue-500 rounded-t-sm hover:brightness-110 transition-all duration-500" />}
                             {m.paid > 0 && <div style={{ height: pctPaid }} className="w-1/3 max-w-[12px] bg-emerald-500 rounded-t-sm hover:brightness-110 transition-all duration-500" />}
                             {m.unpaid > 0 && <div style={{ height: pctUnpaid }} className="w-1/3 max-w-[12px] bg-slate-300 dark:bg-slate-600 rounded-t-sm hover:brightness-110 transition-all duration-500" />}
                           </>
                         )}
                         {chartTab === 'total' && m.total > 0 && <div style={{ height: pctTotal }} className="w-full max-w-[32px] bg-blue-500 rounded-t-md hover:brightness-110 transition-all duration-500" />}
                         {chartTab === 'paid' && m.paid > 0 && <div style={{ height: pctPaid }} className="w-full max-w-[32px] bg-emerald-500 rounded-t-md hover:brightness-110 transition-all duration-500" />}
                         {chartTab === 'unpaid' && (
                           <>
                             {m.unpaid > 0 && <div style={{ height: pctUnpaid }} className="w-1/3 max-w-[12px] bg-slate-300 dark:bg-slate-600 rounded-t-sm hover:brightness-110 transition-all duration-500" title="Total Due" />}
                             {m.pending > 0 && <div style={{ height: pctPending }} className="w-1/3 max-w-[12px] bg-amber-500 rounded-t-sm hover:brightness-110 transition-all duration-500" title="Pending" />}
                             {m.overdue > 0 && <div style={{ height: pctOverdue }} className="w-1/3 max-w-[12px] bg-red-500 rounded-t-sm hover:brightness-110 transition-all duration-500" title="Overdue" />}
                           </>
                         )}
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase", dk ? "text-slate-500" : "text-slate-400")}>{labels[i]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            ) : (
            // --- NEW: GLOWING SINGLE-RING DONUT WITH NON-OVERLAPPING POINTERS ---
            <div className="flex-1 flex items-center justify-center min-h-[320px] mt-2 animate-in fade-in zoom-in-95 duration-500 w-full relative">
               {(() => {
                 const paidPct = stats.totalSpend > 0 ? (stats.totalPaid / stats.totalSpend) * 100 : 0;
                 const overduePct = stats.totalSpend > 0 ? (stats.totalOverdue / stats.totalSpend) * 100 : 0;
                 const pendingVal = Math.max(0, stats.totalUnpaid - stats.totalOverdue);
                 const pendingPct = stats.totalSpend > 0 ? (pendingVal / stats.totalSpend) * 100 : 0;
                 
                 // Canvas Math: Larger center, perfectly balanced
                 const cx = 350;
                 const cy = 160;
                 const r = 95; 
                 const circ = 2 * Math.PI * r;

                 const paidLen = (paidPct / 100) * circ;
                 const pendingLen = (pendingPct / 100) * circ;
                 const overdueLen = (overduePct / 100) * circ;

                 const midPaid = paidPct / 2;
                 const midPending = paidPct + (pendingPct / 2);
                 const midOverdue = paidPct + pendingPct + (overduePct / 2);

                 const getPt = (pct: number, radius: number) => {
                     const angle = (pct / 100) * 360 - 90;
                     const rads = angle * (Math.PI / 180);
                     return { x: cx + radius * Math.cos(rads), y: cy + radius * Math.sin(rads) };
                 };

                 const items = [
                     { id: 'paid', title: lang === 'de' ? 'Bezahlt' : 'Paid', val: paidPct, valStr: formatCurrency(stats.totalPaid), color: '#10b981', mid: midPaid },
                     { id: 'pending-due', title: lang === 'de' ? 'Ausstehend fällig' : 'Pending Due', val: pendingPct, valStr: formatCurrency(pendingVal), color: '#f59e0b', mid: midPending },
                     { id: 'overdue', title: lang === 'de' ? 'Überfällig' : 'Overdue', val: overduePct, valStr: formatCurrency(stats.totalOverdue), color: '#ef4444', mid: midOverdue },
                 ].filter(i => i.val > 0);

                 // Iterative separation to push points far away from each other on the ring
                 const MIN_PTR_GAP = 25; 
                 let midPointsSeparated = [...items].sort((a, b) => a.mid - b.mid);
                 for (let i = 0; i < 5; i++) {
                    midPointsSeparated.forEach((item, idx) => {
                       const next = midPointsSeparated[(idx + 1) % midPointsSeparated.length];
                       if (!next || item.id === next.id) return;
                       const currentAngle = item.mid * 3.6;
                       let nextAngle = next.mid * 3.6;
                       if (nextAngle < currentAngle) nextAngle += 360;
                       
                       if (Math.abs(nextAngle - currentAngle) < MIN_PTR_GAP) {
                         const adjust = (MIN_PTR_GAP - Math.abs(nextAngle - currentAngle)) / 2;
                         item.mid = (item.mid - adjust / 3.6 + 100) % 100;
                         next.mid = (next.mid + adjust / 3.6) % 100;
                       }
                    });
                 }

                 // Group labels left/right, STRICTLY sorted by Y coordinate so lines never cross
                 const finalItems = items.map(item => midPointsSeparated.find(m => m.id === item.id) || item);
                 const rightItems = finalItems.filter(i => getPt(i.mid, 100).x >= cx).sort((a, b) => getPt(a.mid, 100).y - getPt(b.mid, 100).y);
                 const leftItems = finalItems.filter(i => getPt(i.mid, 100).x < cx).sort((a, b) => getPt(a.mid, 100).y - getPt(b.mid, 100).y);

                 const mappedItems: any[] = [];
                 const assignLayout = (list: any[], isRight: boolean) => {
                     const gap = 85; 
                     const startY = cy - ((list.length - 1) * gap) / 2;
                     list.forEach((item, index) => {
                         const endX = isRight ? 530 : 170; // Placed firmly on sides
                         const endY = startY + (index * gap);
                         const start = getPt(item.mid, 106); // Point attaches slightly off donut
                         const sign = isRight ? 1 : -1;
                         
                         const elbow1X = start.x + sign * 15;
                         const elbow2X = endX - sign * 15;
                         const path = `M ${start.x},${start.y} L ${elbow1X},${start.y} L ${elbow2X},${endY} L ${endX},${endY}`;
                         
                         mappedItems.push({ ...item, start, endX, endY, isRight, path });
                     });
                 };

                 assignLayout(rightItems, true);
                 assignLayout(leftItems, false);
                 
                 return (
                   <div className="relative w-full max-w-[700px] aspect-[7/3] shrink-0 drop-shadow-xl">
                     
                     <svg viewBox="0 0 700 320" className="w-full h-full absolute inset-0 z-10 pointer-events-none">
                       {/* Subtle Glow Ring behind the donut */}
                       <circle cx={cx} cy={cy} r={r} fill="transparent" stroke={dk ? '#10b981' : '#10b981'} strokeWidth="40" className="opacity-10 blur-xl" />

                       {/* Background Track */}
                       <circle cx={cx} cy={cy} r={r} fill="transparent" stroke={dk ? '#1E293B' : '#f1f5f9'} strokeWidth="32" />

                       {/* Data Segments */}
                       {stats.totalSpend > 0 && (
                         <>
                           <circle cx={cx} cy={cy} r={r} transform={`rotate(-90 ${cx} ${cy})`} fill="transparent" stroke="#10b981" strokeWidth="32" strokeDasharray={`${paidLen} ${circ}`} strokeDashoffset={0} strokeLinecap="butt" className="transition-all duration-1000 ease-out" />
                           <circle cx={cx} cy={cy} r={r} transform={`rotate(-90 ${cx} ${cy})`} fill="transparent" stroke="#f59e0b" strokeWidth="32" strokeDasharray={`${pendingLen} ${circ}`} strokeDashoffset={-paidLen} strokeLinecap="butt" className="transition-all duration-1000 ease-out" />
                           <circle cx={cx} cy={cy} r={r} transform={`rotate(-90 ${cx} ${cy})`} fill="transparent" stroke="#ef4444" strokeWidth="32" strokeDasharray={`${overdueLen} ${circ}`} strokeDashoffset={-(paidLen + pendingLen)} strokeLinecap="butt" className="transition-all duration-1000 ease-out" />
                         </>
                       )}

                       {/* Connective Lines */}
                       {mappedItems.map(item => (
                          <path key={item.id} d={item.path} fill="none" stroke={item.color} strokeWidth="2.5" className={dk ? "opacity-70" : "opacity-40"} />
                       ))}
                     </svg>
                     
                     {/* HTML OVERLAYS: LABELS */}
                     {mappedItems.map(item => (
                        <div 
                           key={item.id} 
                           // FIX: Changed w-[150px] to w-max and min-w-[150px] so it expands for long German words
                           className={cn("absolute flex flex-col justify-center w-max min-w-[150px] px-3", item.isRight ? "items-start border-l-[4px] text-left" : "items-end border-r-[4px] text-right")}
                           style={{ 
                              top: `${(item.endY / 320) * 100}%`, 
                              left: item.isRight ? `${(item.endX / 700) * 100}%` : 'auto',
                              right: !item.isRight ? `${((700 - item.endX) / 700) * 100}%` : 'auto',
                              borderColor: item.color,
                              transform: 'translateY(-50%)'
                           }}
                        >
                           {/* FIX: Added whitespace-nowrap here and shrink-0 to the dots */}
                           <span className="text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1.5 drop-shadow-sm whitespace-nowrap">
                              {!item.isRight && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />}
                              <span style={{ color: item.color }}>{item.title}</span>
                              {item.isRight && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />}
                           </span>
                           <span className={cn("text-xl font-black truncate w-full", dk ? "text-white" : "text-slate-900")}>{item.valStr}</span>
                           <span className="text-sm font-bold opacity-90" style={{ color: item.color }}>{item.val.toFixed(0)}%</span>
                        </div>
                     ))}

                     {/* CENTER TOTALS: Perfectly centered within absolute inset */}
                     <div className={cn("absolute inset-0 m-auto flex flex-col items-center justify-center rounded-full shadow-inner border z-20", dk ? "bg-[#0F172A]/90 border-white/5 backdrop-blur-sm" : "bg-white/90 border-slate-100 backdrop-blur-sm")} style={{ width: '150px', height: '150px' }}>
                       <span className={cn("text-[11px] font-black uppercase tracking-widest mb-1", dk ? "text-slate-500" : "text-slate-400")}>{labels[selectedMonth]}</span>
                       <span className={cn("text-[20px] font-black tracking-tight px-2 text-center", dk ? "text-white" : "text-slate-900")}>
                           {formatCurrency(stats.totalSpend)}
                       </span>
                     </div>

                   </div>
                 );
               })()}
            </div>
          )}
        </div>

        {/* RIGHT: LEADERBOARD WIDGET */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          
          {/* COMPACT HEADER: Title Left, Controls Right */}
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn("text-sm font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>
              Leaderboard
            </h3>
            
            <div className="flex items-center gap-2">
              {/* COMPACT SWITCHING TABS */}
              <div className={cn("flex p-0.5 rounded-lg", dk ? "bg-black/20" : "bg-slate-100")}>
                {[
                  { id: 'hotel', label: lang === 'de' ? 'Hotel' : 'Hotel' },
                  { id: 'company', label: lang === 'de' ? 'Firma' : 'Company' },
                  { id: 'city', label: lang === 'de' ? 'Stadt' : 'City' },
                  { id: 'employee', label: lang === 'de' ? 'Mitarbeiter' : 'Employee' }
                ].map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => setLocalGroup(g.id as any)}
                    className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", 
                      localGroup === g.id 
                        ? (dk ? "bg-blue-600 text-white shadow-sm" : "bg-white text-blue-600 shadow-sm") 
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* SORT TOGGLE */}
              <button 
                onClick={() => setSortAsc(!sortAsc)} 
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400"
                title={lang === 'de' ? 'Sortierung ändern' : 'Toggle Sort'}
              >
                {sortAsc ? <ArrowUpNarrowWide size={16} strokeWidth={2.5} /> : <ArrowDownWideNarrow size={16} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* LIST WITH CUSTOM SCROLLBAR & EXTRA PADDING */}
          <div className="flex-1 min-h-0 flex flex-col gap-5 overflow-y-auto pr-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
          {stats.sortedGroups.length === 0 ? (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold italic py-12">{lang === 'de' ? 'Keine Daten in dieser Ansicht verfügbar' : 'No data available in this view'}</div>
            ) : stats.sortedGroups.map(([name, total], i) => {
              const widthPct = (total / stats.maxGroupValue) * 100;
              return (
                <div key={i} className="flex flex-col gap-2 group">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span className={cn("truncate pr-4", dk ? "text-slate-300" : "text-slate-700")}>{name}</span>
                    <span className={dk ? "text-white" : "text-slate-900"}>
                    {localGroup === 'employee' 
                      ? `${total} ${lang === 'de' ? 'Nächte' : 'Nights'}` 
                      : formatCurrency(total)}
                  </span>
                  </div>
                  <div className={cn("w-full h-2.5 rounded-full overflow-hidden", dk ? "bg-white/5" : "bg-slate-100")}>
                    <div 
                      className="h-full bg-blue-500 group-hover:bg-blue-400 rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${Math.max(widthPct, 1)}%` }} 
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- NEW: COMPREHENSIVE BOTTOM HIGHLIGHTS --- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* A. BOOKING COUNTS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BookingCard title={lang === 'de' ? 'Meistgebuchtes Hotel' : 'Most Booked Hotel'} hotelName={stats.mostBooked.name} count={stats.mostBooked.count} icon={Trophy} isMost={true} />
              <BookingCard title={lang === 'de' ? 'Am wenigsten gebucht' : 'Least Booked Hotel'} hotelName={stats.leastBooked.name} count={stats.leastBooked.count === Infinity ? 0 : stats.leastBooked.count} icon={AlertCircle} isMost={false} />
          </div>

          {/* B. BED PRICE ANALYSIS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PriceCard 
                title={lang === 'de' ? 'Ø Preis pro Bett' : 'Average Price/Bed'} 
                price={stats.avgBedPrice} 
                chipContent={lang === 'de' ? 'Nach Rechnungen' : 'Invoice Based'} 
                icon={BedDouble} 
                colorCls="text-blue-600 dark:text-blue-400" 
                bgCls="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" 
              />
              <PriceCard 
                title={lang === 'de' ? 'Niedrigster Preis' : 'Lowest Price/Bed'} 
                price={stats.minBedPrice.price === Infinity ? 0 : stats.minBedPrice.price} 
                chipContent={stats.minBedPrice.hotelName} 
                icon={TrendingDown} 
                colorCls="text-teal-600 dark:text-teal-400" 
                bgCls="bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20" 
              />
              <PriceCard 
                title={lang === 'de' ? 'Höchster Preis' : 'Highest Price/Bed'} 
                price={stats.maxBedPrice.price} 
                chipContent={stats.maxBedPrice.hotelName} 
                icon={TrendingUp} 
                colorCls="text-indigo-600 dark:text-indigo-400" 
                bgCls="bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20" 
              />
          </div>
      </div>
    </div>
  );
}
