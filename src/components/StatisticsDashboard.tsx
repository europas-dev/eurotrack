// src/components/StatisticsDashboard.tsx
import React, { useMemo, useState } from 'react';
import { cn, formatCurrency, calculateNights, calcInvoiceItem } from '../lib/utils';
import { TrendingUp, CreditCard, AlertCircle, ShieldCheck, Trophy, BedDouble, Building2, MapPin, Building } from 'lucide-react';

interface Props {
  hotels: any[];
  selectedYear: number;
  lang: 'de' | 'en';
  dk: boolean;
}

export default function StatisticsDashboard({ hotels, selectedYear, lang, dk }: Props) {
  
  // Local state for the Leaderboard Chart
  const [chartGroupBy, setChartGroupBy] = useState<'hotel' | 'company' | 'city'>('hotel');

  // --- MASTER ANALYTICS ENGINE ---
  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let totalDeposits = 0;

    let months = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }));
    
    // Grouping Accumulators
    let groupedTotals: Record<string, number> = {};
    
    let mostBooked = { name: '-', count: 0 };
    let bedPriceSum = 0;
    let bedPriceCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    hotels.forEach(h => {
      // 1. Deposits & Bookings
      if (h.depositEnabled && h.depositAmount) totalDeposits += parseFloat(h.depositAmount);
      
      const dCount = (h.durations || []).length;
      if (dCount > mostBooked.count) {
        mostBooked = { name: h.name || 'Unnamed', count: dCount };
      }

      if (h.override_price_per_bed) {
        bedPriceSum += parseFloat(h.override_price_per_bed);
        bedPriceCount++;
      }

      // 2. Invoice Deep Dive
      let hotelBruttoBeforeDiscount = 0;
      let rawPaid = 0;
      let rawUnpaid = 0;
      let rawOverdue = 0;

      (h.invoices || []).forEach((inv: any) => {
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        if (!dateStr) return;
        const d = new Date(dateStr);
        
        // Strict Year Boundary for Stats
        if (d.getFullYear() !== selectedYear) return;
        const mIdx = d.getMonth();

        let invBrutto = 0;
        if (inv.billingMode === 'total') {
          const baseN = parseFloat(inv.totalNetto) || 0;
          const m = parseFloat(inv.totalMwst) || 0;
          const disc = parseFloat(inv.discountValue) || 0;
          const isPct = inv.discountType === 'percentage';
          const n = Math.max(0, baseN - (isPct ? baseN * (disc / 100) : disc));
          invBrutto = n * (1 + m / 100);
        } else {
          const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
          (inv.items || []).forEach((item: any) => {
            const { brutto: itemB } = calcInvoiceItem(item, defaultN);
            invBrutto += itemB;
            
            // Extract average bed prices from detailed items
            if (item.type === 'room' && item.method === 'per_bed' && item.netto && parseFloat(item.netto) > 0) {
               bedPriceSum += parseFloat(item.netto);
               bedPriceCount++;
            }
          });
        }

        hotelBruttoBeforeDiscount += invBrutto;
        months[mIdx].total += invBrutto;

        if (inv.isPaid) {
          rawPaid += invBrutto;
        } else {
          rawUnpaid += invBrutto;
          if (inv.dueDate && new Date(inv.dueDate) < today) {
            rawOverdue += invBrutto;
          }
        }
      });

      // 3. Global Discounts & Overrides
      let discountedBrutto = hotelBruttoBeforeDiscount;
      if (h.has_global_discount && h.global_discount_value) {
        const gVal = parseFloat(h.global_discount_value);
        const isFixed = h.global_discount_type === 'fixed';
        discountedBrutto = Math.max(0, hotelBruttoBeforeDiscount - (isFixed ? gVal : hotelBruttoBeforeDiscount * (gVal / 100)));
      }

      let finalTotal = discountedBrutto;
      if (h.override_total_brutto != null) {
        finalTotal = parseFloat(h.override_total_brutto);
      }

      totalSpend += finalTotal;

      // Grouping Logic for the Bar Chart
      if (finalTotal > 0) {
        let groupKey = 'Unknown';
        if (chartGroupBy === 'hotel') groupKey = h.name || 'Unnamed Hotel';
        if (chartGroupBy === 'company') groupKey = (h.companyTag && h.companyTag.length > 0) ? h.companyTag[0] : (lang === 'de' ? 'Ohne Firma' : 'Unassigned');
        if (chartGroupBy === 'city') groupKey = h.city || (lang === 'de' ? 'Unbekannte Stadt' : 'Unknown City');

        groupedTotals[groupKey] = (groupedTotals[groupKey] || 0) + finalTotal;
      }

      // Apportion health status
      const rawTotal = rawPaid + rawUnpaid;
      if (rawTotal > 0) {
        totalPaid += finalTotal * (rawPaid / rawTotal);
        totalOverdue += finalTotal * (rawOverdue / rawTotal);
      } else if (finalTotal > 0 && h.isPaid) {
        totalPaid += finalTotal;
      }
    });

    const maxMonth = Math.max(...months.map(m => m.total), 1); // Prevent div by 0
    const sortedGroups = Object.entries(groupedTotals).sort((a, b) => b[1] - a[1]).slice(0, 8); // Top 8 limit for visual scaling
    const maxGroupValue = sortedGroups.length > 0 ? sortedGroups[0][1] : 1;
    const avgBedPrice = bedPriceCount > 0 ? bedPriceSum / bedPriceCount : 0;

    return { totalSpend, totalPaid, totalOverdue, totalDeposits, months, maxMonth, sortedGroups, maxGroupValue, mostBooked, avgBedPrice };
  }, [hotels, selectedYear, chartGroupBy, lang]);

  // --- UI HELPERS ---
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

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 fade-in duration-500 pb-10">
      
      {/* 1. TOP KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title={lang === 'de' ? 'Gesamtkosten' : 'Total Spend'} value={formatCurrency(stats.totalSpend)} icon={TrendingUp} colorCls="text-blue-500" bgCls="bg-blue-500/10" />
        <Card title={lang === 'de' ? 'Total Bezahlt' : 'Total Paid'} value={formatCurrency(stats.totalPaid)} icon={ShieldCheck} colorCls="text-emerald-500" bgCls="bg-emerald-500/10" />
        <Card title={lang === 'de' ? 'Überfällig' : 'Overdue Balance'} value={formatCurrency(stats.totalOverdue)} icon={AlertCircle} colorCls="text-red-500" bgCls="bg-red-500/10" />
        <Card title={lang === 'de' ? 'Kautionen' : 'Pending Deposits'} value={formatCurrency(stats.totalDeposits)} icon={CreditCard} colorCls="text-amber-500" bgCls="bg-amber-500/10" />
      </div>

      {/* 2. CHARTS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* MONTHLY BREAKDOWN (Vertical Columns) */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={cn("text-sm font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Monatliche Ausgaben' : 'Monthly Breakdown'}</h3>
          </div>
          
          <div className="flex-1 flex items-end gap-2 h-[280px] relative mt-4">
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 dark:opacity-5">
               <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
               <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
               <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
               <div className="w-full h-px bg-slate-900 dark:bg-white"></div>
            </div>

            {stats.months.map((m, i) => {
              const heightPct = (m.total / stats.maxMonth) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-3 group h-full relative z-10">
                  <div className="w-full flex items-end justify-center h-full relative">
                     
                     {/* Floating Tooltip on Hover */}
                     <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-lg pointer-events-none z-50 whitespace-nowrap shadow-xl">
                       {formatCurrency(m.total)}
                       {/* Triangle pointer */}
                       <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-800"></div>
                     </div>
                     
                     {/* The Bar */}
                     <div 
                       className={cn("w-full max-w-[40px] rounded-t-md transition-all duration-700 ease-out", m.total > 0 ? "bg-teal-500 group-hover:bg-teal-400" : "bg-transparent")} 
                       style={{ height: `${Math.max(heightPct, 1)}%` }} 
                     />
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase", dk ? "text-slate-500" : "text-slate-400")}>{labels[i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* DYNAMIC LEADERBOARD (Horizontal Bars) */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h3 className={cn("text-sm font-black uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>
              {lang === 'de' ? 'Top Liste nach Kosten' : 'Top Costs Leaderboard'}
            </h3>
            
            {/* IN-CHART GROUP BY TOGGLE */}
            <div className={cn("flex items-center p-1 rounded-xl border transition-all h-[34px]", dk ? "bg-black/20 border-white/10" : "bg-slate-100 border-slate-200")}>
              {[
                { id: 'hotel', icon: Building, label: lang === 'de' ? 'Hotel' : 'Hotel' },
                { id: 'company', icon: Building2, label: lang === 'de' ? 'Firma' : 'Company' },
                { id: 'city', icon: MapPin, label: lang === 'de' ? 'Stadt' : 'City' }
              ].map(opt => (
                 <button 
                   key={opt.id}
                   onClick={() => setChartGroupBy(opt.id as any)} 
                   className={cn("flex items-center justify-center gap-1.5 h-full px-3 text-[10px] font-black uppercase rounded-lg transition-all", 
                     chartGroupBy === opt.id
                       ? (dk ? "bg-white/15 text-white shadow-sm" : "bg-white text-slate-800 shadow-sm border border-slate-200/60") 
                       : (dk ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")
                   )}
                 >
                   <opt.icon size={12} strokeWidth={2.5} /> <span className="hidden sm:inline">{opt.label}</span>
                 </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto pr-2" style={{ maxHeight: '256px' }}>
            {stats.sortedGroups.length === 0 ? (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold italic py-10">{lang === 'de' ? 'Keine Daten in dieser Ansicht verfügbar' : 'No data available in this view'}</div>
            ) : stats.sortedGroups.map(([name, total], i) => {
              const widthPct = (total / stats.maxGroupValue) * 100;
              return (
                <div key={i} className="flex flex-col gap-2 group">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span className={cn("truncate pr-4", dk ? "text-slate-300" : "text-slate-700")}>{name}</span>
                    <span className={dk ? "text-white" : "text-slate-900"}>{formatCurrency(total)}</span>
                  </div>
                  <div className={cn("w-full h-2.5 rounded-full overflow-hidden", dk ? "bg-white/5" : "bg-slate-100")}>
                    {/* Bar Fill */}
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

      {/* 3. BOTTOM HIGHLIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn("p-5 rounded-2xl border flex items-center gap-4 shadow-sm", dk ? "bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-white/10" : "bg-gradient-to-br from-white to-slate-50 border-slate-200")}>
           <div className="p-3.5 bg-purple-500/10 text-purple-500 rounded-xl"><Trophy size={28} strokeWidth={2}/></div>
           <div className="flex flex-col">
             <span className={cn("text-[10px] font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{lang === 'de' ? 'Meistgebuchtes Hotel' : 'Most Booked Hotel'}</span>
             <span className={cn("text-xl font-black truncate max-w-[300px]", dk ? "text-white" : "text-slate-900")}>{stats.mostBooked.name}</span>
             <span className="text-xs font-bold text-purple-500 mt-1">{stats.mostBooked.count} {lang === 'de' ? 'Buchungen' : 'Bookings'}</span>
           </div>
        </div>
        
        <div className={cn("p-5 rounded-2xl border flex items-center gap-4 shadow-sm", dk ? "bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-white/10" : "bg-gradient-to-br from-white to-slate-50 border-slate-200")}>
           <div className="p-3.5 bg-teal-500/10 text-teal-500 rounded-xl"><BedDouble size={28} strokeWidth={2}/></div>
           <div className="flex flex-col">
             <span className={cn("text-[10px] font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{lang === 'de' ? 'Ø Preis pro Bett' : 'Average Price per Bed'}</span>
             <span className={cn("text-xl font-black", dk ? "text-white" : "text-slate-900")}>{formatCurrency(stats.avgBedPrice)}</span>
             <span className="text-xs font-bold text-teal-500 mt-1">{lang === 'de' ? 'Basierend auf Rechnungen' : 'Based on itemized invoices'}</span>
           </div>
        </div>
      </div>

    </div>
  );
}
