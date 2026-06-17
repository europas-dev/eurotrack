// src/components/StatisticsDashboard.tsx
import React, { useMemo } from 'react';
import { cn, formatCurrency, calculateNights, calcInvoiceItem } from '../lib/utils';
import { TrendingUp, CreditCard, AlertCircle, ShieldCheck, Trophy, BedDouble } from 'lucide-react';

interface Props {
  hotels: any[];
  selectedYear: number;
  lang: 'de' | 'en';
  dk: boolean;
}

export default function StatisticsDashboard({ hotels, selectedYear, lang, dk }: Props) {
  
  // --- MASTER ANALYTICS ENGINE ---
  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let totalDeposits = 0;

    let months = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }));
    let hotelTotals: Record<string, number> = {};
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
        
        // Strict Year Boundary
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
      if (finalTotal > 0) {
        hotelTotals[h.name || 'Unnamed'] = (hotelTotals[h.name || 'Unnamed'] || 0) + finalTotal;
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
    const sortedHotels = Object.entries(hotelTotals).sort((a, b) => b[1] - a[1]).slice(0, 8); // Top 8
    const maxHotel = sortedHotels.length > 0 ? sortedHotels[0][1] : 1;
    const avgBedPrice = bedPriceCount > 0 ? bedPriceSum / bedPriceCount : 0;

    return { totalSpend, totalPaid, totalOverdue, totalDeposits, months, maxMonth, sortedHotels, maxHotel, mostBooked, avgBedPrice };
  }, [hotels, selectedYear]);

  // --- UI HELPERS ---
  const monthLabelsDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthLabelsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = lang === 'de' ? monthLabelsDe : monthLabelsEn;

  const Card = ({ title, value, icon: Icon, colorCls, bgCls }: any) => (
    <div className={cn("p-5 rounded-2xl border flex flex-col gap-3 shadow-sm", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-lg", bgCls, colorCls)}><Icon size={16} strokeWidth={2.5} /></div>
        <span className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{title}</span>
      </div>
      <span className={cn("text-2xl font-black", dk ? "text-white" : "text-slate-900")}>{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300 pb-10">
      
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
          <h3 className={cn("text-sm font-black mb-6 uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Monatliche Ausgaben' : 'Monthly Breakdown'}</h3>
          <div className="flex-1 flex items-end gap-2 h-64 relative">
            {stats.months.map((m, i) => {
              const heightPct = (m.total / stats.maxMonth) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group h-full">
                  <div className="w-full flex items-end justify-center h-full relative">
                     {/* Tooltip */}
                     <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded pointer-events-none z-10 whitespace-nowrap">
                       {formatCurrency(m.total)}
                     </div>
                     {/* Bar */}
                     <div 
                       className={cn("w-full max-w-[40px] rounded-t-md transition-all duration-500", m.total > 0 ? "bg-teal-500 group-hover:bg-teal-400" : "bg-transparent")} 
                       style={{ height: `${Math.max(heightPct, 1)}%` }} 
                     />
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase", dk ? "text-slate-500" : "text-slate-400")}>{labels[i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* HOTEL LEADERBOARD (Horizontal Bars) */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <h3 className={cn("text-sm font-black mb-6 uppercase tracking-widest", dk ? "text-slate-300" : "text-slate-700")}>{lang === 'de' ? 'Top Hotels nach Kosten' : 'Top Hotels by Cost'}</h3>
          <div className="flex flex-col gap-4 overflow-y-auto pr-2" style={{ maxHeight: '256px' }}>
            {stats.sortedHotels.length === 0 ? (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold italic">{lang === 'de' ? 'Keine Daten verfügbar' : 'No data available'}</div>
            ) : stats.sortedHotels.map(([name, total], i) => {
              const widthPct = (total / stats.maxHotel) * 100;
              return (
                <div key={i} className="flex flex-col gap-1.5 group">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={cn("truncate pr-4", dk ? "text-slate-300" : "text-slate-700")}>{name}</span>
                    <span className={dk ? "text-slate-400" : "text-slate-500"}>{formatCurrency(total)}</span>
                  </div>
                  <div className={cn("w-full h-2 rounded-full overflow-hidden", dk ? "bg-white/5" : "bg-slate-100")}>
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(widthPct, 2)}%` }} />
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
           <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl"><Trophy size={24} strokeWidth={2.5}/></div>
           <div className="flex flex-col">
             <span className={cn("text-[10px] font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{lang === 'de' ? 'Meistgebuchtes Hotel' : 'Most Booked Hotel'}</span>
             <span className={cn("text-lg font-black truncate max-w-[250px]", dk ? "text-white" : "text-slate-900")}>{stats.mostBooked.name}</span>
             <span className="text-xs font-bold text-purple-500 mt-0.5">{stats.mostBooked.count} {lang === 'de' ? 'Buchungen' : 'Bookings'}</span>
           </div>
        </div>
        
        <div className={cn("p-5 rounded-2xl border flex items-center gap-4 shadow-sm", dk ? "bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-white/10" : "bg-gradient-to-br from-white to-slate-50 border-slate-200")}>
           <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl"><BedDouble size={24} strokeWidth={2.5}/></div>
           <div className="flex flex-col">
             <span className={cn("text-[10px] font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{lang === 'de' ? 'Ø Preis pro Bett' : 'Average Price per Bed'}</span>
             <span className={cn("text-lg font-black", dk ? "text-white" : "text-slate-900")}>{formatCurrency(stats.avgBedPrice)}</span>
             <span className="text-xs font-bold text-teal-500 mt-0.5">{lang === 'de' ? 'Basierend auf aktuellen Rechnungen' : 'Based on current invoices'}</span>
           </div>
        </div>
      </div>

    </div>
  );
}
