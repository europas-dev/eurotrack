// src/components/StatisticsDashboard.tsx
import React, { useMemo } from 'react';
import { cn, formatCurrency, calculateNights, calcInvoiceItem } from '../lib/utils';
import { TrendingUp, CreditCard, AlertCircle, ShieldCheck, Clock, Trophy, BedDouble, Building2, MapPin, Building } from 'lucide-react';

interface Props {
  hotels: any[];
  selectedYear: number;
  selectedMonth: number | null;
  groupBy: 'none' | 'hotel' | 'company' | 'city' | 'country';
  lang: 'de' | 'en';
  dk: boolean;
}

export default function StatisticsDashboard({ hotels, selectedYear, selectedMonth, groupBy, lang, dk }: Props) {
  
  // Resolve active grouping tier automatically from the main dashboard filter toggle
  const currentGroupBy = groupBy === 'none' ? 'hotel' : groupBy;

  // --- RE-ENGINEERED SYNC MATHEMATICS ---
  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalOverdue = 0;
    let totalDeposits = 0;

    let months = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }));
    let groupedTotals: Record<string, number> = {};
    
    let mostBooked = { name: '-', count: 0 };
    let bedPriceSum = 0;
    let bedPriceCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    hotels.forEach(h => {
      let hotelBruttoBeforeDiscount = 0;
      let rawPaid = 0;
      let rawUnpaid = 0;
      let rawOverdue = 0;
      let hasInvoicesInContext = false;

      totalDeposits += h.depositEnabled && h.depositAmount ? parseFloat(h.depositAmount) : 0;
      mostBooked = (h.durations || []).length > mostBooked.count 
        ? { name: h.name || 'Unnamed', count: (h.durations || []).length } 
        : mostBooked;

      if (h.override_price_per_bed) {
        bedPriceSum += parseFloat(h.override_price_per_bed);
        bedPriceCount++;
      }

      (h.invoices || []).forEach((inv: any) => {
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
            invBrutto += calcInvoiceItem(item, defaultN).brutto;
            if (item.type === 'room' && item.method === 'per_bed' && item.netto && parseFloat(item.netto) > 0) {
               bedPriceSum += parseFloat(item.netto);
               bedPriceCount++;
            }
          });
        }

        // Fill dynamic month array matrix
        months[d.getMonth()].total += invBrutto;

        // Apply real-time month context check
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
      if (h.has_global_discount && h.global_discount_value) {
        const gVal = parseFloat(h.global_discount_value);
        discountedBrutto = Math.max(0, hotelBruttoBeforeDiscount - (h.global_discount_type === 'fixed' ? gVal : hotelBruttoBeforeDiscount * (gVal / 100)));
      }

      let finalTotal = discountedBrutto;
      if (h.override_total_brutto != null && selectedMonth === null) {
        finalTotal = parseFloat(h.override_total_brutto);
      }

      // Accumulate primary financials
      totalSpend += finalTotal;

      const rawTotal = rawPaid + rawUnpaid;
      if (rawTotal > 0) {
        totalPaid += finalTotal * (rawPaid / rawTotal);
        totalUnpaid += finalTotal * (rawUnpaid / rawTotal);
        totalOverdue += finalTotal * (rawOverdue / rawTotal);
      } else if (finalTotal > 0 && selectedMonth === null) {
        if (h.isPaid) totalPaid += finalTotal;
        else totalUnpaid += finalTotal;
      }

      // Group dynamic data keys based on active state criteria
      if (finalTotal > 0 || (selectedMonth === null && hasInvoicesInContext)) {
        let groupKey = 'Unknown';
        if (currentGroupBy === 'hotel') groupKey = h.name || 'Unnamed Hotel';
        else if (currentGroupBy === 'company') groupKey = (h.companyTag && h.companyTag.length > 0) ? h.companyTag[0] : (lang === 'de' ? 'Ohne Firma' : 'Unassigned');
        else if (currentGroupBy === 'city') groupKey = h.city || (lang === 'de' ? 'Unbekannte Stadt' : 'Unknown City');

        groupedTotals[groupKey] = (groupedTotals[groupKey] || 0) + finalTotal;
      }
    });

    const maxMonth = Math.max(...months.map(m => m.total), 1);
    const sortedGroups = Object.entries(groupedTotals).sort((a, b) => b[1] - a[1]);
    const maxGroupValue = sortedGroups.length > 0 ? sortedGroups[0][1] : 1;
    const avgBedPrice = bedPriceCount > 0 ? bedPriceSum / bedPriceCount : 0;

    return { totalSpend, totalPaid, totalUnpaid, totalOverdue, totalDeposits, months, maxMonth, sortedGroups, maxGroupValue, mostBooked, avgBedPrice };
  }, [hotels, selectedYear, selectedMonth, currentGroupBy, lang]);

  const monthLabelsDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthLabelsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = lang === 'de' ? monthLabelsDe : monthLabelsEn;

  const Card = ({ title, value, icon: Icon, colorCls, bgCls }: any) => (
    <div className={cn("p-5 rounded-2xl border flex flex-col gap-3 shadow-sm transition-all", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-lg", bgCls, colorCls)}><Icon size={16} strokeWidth={2.5} /></div>
        <span className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{title}</span>
      </div>
      <span className={cn("text-2xl lg:text-3xl font-black truncate", dk ? "text-white" : "text-slate-900")}>{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 fade-in duration-500 pb-10">
      
      {/* 5-COLUMN METRIC MATRIX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card title={lang === 'de' ? 'Gesamtkosten' : 'Total Spend'} value={formatCurrency(stats.totalSpend)} icon={TrendingUp} colorCls="text-blue-500" bgCls="bg-blue-500/10" />
        <Card title={lang === 'de' ? 'Total Bezahlt' : 'Total Paid'} value={formatCurrency(stats.totalPaid)} icon={ShieldCheck} colorCls="text-emerald-500" bgCls="bg-emerald-500/10" />
        <Card title={lang === 'de' ? 'Total Offen' : 'Total Due'} value={formatCurrency(stats.totalUnpaid)} icon={Clock} colorCls="text-amber-500" bgCls="bg-amber-500/10" />
        <Card title={lang === 'de' ? 'Überfällig' : 'Overdue'} value={formatCurrency(stats.totalOverdue)} icon={AlertCircle} colorCls="text-red-500" bgCls="bg-red-500/10" />
        <Card title={lang === 'de' ? 'Kautionen' : 'Deposits'} value={formatCurrency(stats.totalDeposits)} icon={CreditCard} colorCls="text-indigo-500" bgCls="bg-indigo-500/10" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* TIME SERIES ANALYSIS CHART */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <h3 className={cn("text-sm font-black uppercase tracking-widest mb-6", dk ? "text-slate-300" : "text-slate-700")}>
            {lang === 'de' ? 'Monatliche Ausgaben' : 'Monthly Breakdown'}
          </h3>
          <div className="flex-1 flex items-end gap-2 h-[280px] relative mt-4">
            {stats.months.map((m, i) => {
              const heightPct = (m.total / stats.maxMonth) * 100;
              const isMonthFiltered = selectedMonth !== null;
              const isTargetMonth = selectedMonth === i;
              
              return (
                <div key={i} className={cn("flex-1 flex flex-col items-center justify-end gap-3 group h-full relative transition-opacity duration-300", isMonthFiltered && !isTargetMonth ? "opacity-20" : "opacity-100")}>
                  <div className="w-full flex items-end justify-center h-full relative">
                     <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-lg pointer-events-none z-50 whitespace-nowrap shadow-xl">
                       {formatCurrency(m.total)}
                       <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-800"></div>
                     </div>
                     <div 
                       className={cn("w-full max-w-[40px] rounded-t-md transition-all duration-700 ease-out", 
                         isTargetMonth ? "bg-teal-600 shadow-[0_0_12px_rgba(20,184,166,0.4)]" : m.total > 0 ? "bg-teal-500 group-hover:bg-teal-400" : "bg-transparent"
                       )} 
                       style={{ height: `${Math.max(heightPct, 1)}%` }} 
                     />
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase", isTargetMonth ? "text-teal-500 font-black" : dk ? "text-slate-500" : "text-slate-400")}>{labels[i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* AUTONOMIC ALIGNED LEADERBOARD */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", dk ? "text-slate-300" : "text-slate-700")}>
              {currentGroupBy === 'hotel' && <Building size={16} className="text-blue-500" />}
              {currentGroupBy === 'company' && <Building2 size={16} className="text-blue-500" />}
              {currentGroupBy === 'city' && <MapPin size={16} className="text-blue-500" />}
              {lang === 'de' 
                ? `Top ${currentGroupBy === 'hotel' ? 'Hotels' : currentGroupBy === 'company' ? 'Firmen' : 'Städte'} nach Kosten` 
                : `Top ${currentGroupBy === 'hotel' ? 'Hotels' : currentGroupBy === 'company' ? 'Companies' : 'Cities'} by Cost`}
            </h3>
            <span className="text-[10px] font-black uppercase bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-md tracking-wider">
              {lang === 'de' ? 'Live Auto Sync' : 'Live Sync'}
            </span>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto pr-2" style={{ maxHeight: '280px' }}>
            {stats.sortedGroups.length === 0 ? (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold italic py-12">{lang === 'de' ? 'Keine Daten in dieser Ansicht verfügbar' : 'No data available in this view'}</div>
            ) : stats.sortedGroups.map(([name, total], i) => {
              const widthPct = (total / stats.maxGroupValue) * 100;
              return (
                <div key={i} className="flex flex-col gap-2 group">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span className={cn("truncate pr-4", dk ? "text-slate-300" : "text-slate-700")}>{name}</span>
                    <span className={dk ? "text-white" : "text-slate-900"}>{formatCurrency(total)}</span>
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
