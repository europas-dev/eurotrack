// src/components/StatisticsDashboard.tsx
import React, { useMemo } from 'react';
import { cn, formatCurrency, calculateNights, calcInvoiceItem } from '../lib/utils';
import { TrendingUp, Clock, AlertCircle, ShieldCheck, CreditCard, Trophy, BedDouble } from 'lucide-react';

interface Props {
  hotels: any[]; // This is finalFiltered from Dashboard
  selectedYear: number;
  selectedMonth: number | null;
  groupBy: 'none' | 'hotel' | 'company' | 'city' | 'country';
  lang: 'de' | 'en';
  dk: boolean;
}

export default function StatisticsDashboard({ hotels, selectedYear, selectedMonth, groupBy, lang, dk }: Props) {
  
  const stats = useMemo(() => {
    // 1. Core Totals (Matches Dashboard top-bar exactly)
    let totalSpend = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalOverdue = 0;
    let totalDeposits = 0;

    // 2. Chart Accumulators
    let months = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }));
    let leaderboard: Record<string, number> = {};
    
    // 3. Highlight Helpers
    let mostBooked = { name: '-', count: 0 };
    let bedPriceSum = 0;
    let bedPriceCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    hotels.forEach(h => {
      // --- REPLICATING DASHBOARD.TSX MATH LOGIC ---
      let hotelFinalNetto = 0;
      let hotelFinalBrutto = 0;
      let hotelRawPaid = 0;
      let hotelRawUnpaid = 0;
      let hotelRawOverdue = 0;

      // Track deposits only for hotels currently in the filtered list
      totalDeposits += (h.depositEnabled && h.depositAmount) ? (parseFloat(h.depositAmount) || 0) : 0;
      
      // Most Booked Logic
      const dCount = (h.durations || []).length;
      if (dCount > mostBooked.count) mostBooked = { name: h.name, count: dCount };

      (h.invoices || []).forEach((inv: any) => {
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        if (!dateStr) return;
        const d = new Date(dateStr);
        
        // Match Global Year Filter
        if (d.getFullYear() !== selectedYear) return;

        // Calculate Invoice Value
        let invBrutto = 0;
        if (inv.billingMode === 'total') {
          const baseN = parseFloat(inv.totalNetto) || 0;
          const m = parseFloat(inv.totalMwst) || 0;
          const disc = parseFloat(inv.discountValue) || 0;
          const isPct = inv.discountType === 'percentage';
          const n = Math.max(0, baseN - (isPct ? baseN * (disc / 100) : disc));
          invBrutto = n * (1 + m / 100);
          hotelFinalNetto += n;
        } else {
          const defN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
          (inv.items || []).forEach((item: any) => {
            const { finalNetto: itemN, brutto: itemB } = calcInvoiceItem(item, defN);
            invBrutto += itemB;
            hotelFinalNetto += itemN;

            if (item.type === 'room' && item.method === 'per_bed' && item.netto && parseFloat(item.netto) > 0) {
               bedPriceSum += parseFloat(item.netto);
               bedPriceCount++;
            }
          });
        }

        // Add to month breakdown (This shows the whole year regardless of month filter)
        months[d.getMonth()].total += invBrutto;

        // Apply Month Filter for the 5 Top KPI Cards
        if (selectedMonth !== null && d.getMonth() !== selectedMonth) return;

        hotelFinalBrutto += invBrutto;
        if (inv.isPaid) hotelRawPaid += invBrutto;
        else {
          hotelRawUnpaid += invBrutto;
          if (inv.dueDate && new Date(inv.dueDate) < today) hotelRawOverdue += invBrutto;
        }
      });

      // Handle Global Discounts
      let discountedBrutto = hotelFinalBrutto;
      if (h.has_global_discount && h.global_discount_value) {
        const gVal = parseFloat(h.global_discount_value);
        const isFixed = h.global_discount_type === 'fixed';
        const target = h.global_discount_target || 'netto';
        if (target === 'netto') {
          let ratio = isFixed ? (gVal / hotelFinalNetto) : (gVal / 100);
          if (!isFinite(ratio)) ratio = 0;
          discountedBrutto = Math.max(0, hotelFinalBrutto - (hotelFinalBrutto * ratio));
        } else {
          discountedBrutto = Math.max(0, hotelFinalBrutto - (isFixed ? gVal : hotelFinalBrutto * (gVal / 100)));
        }
      }

      // Apply Override (Only if no month is selected, matching Dashboard behavior)
      let finalTotal = discountedBrutto;
      if (h.override_total_brutto != null && selectedMonth === null) {
        finalTotal = parseFloat(h.override_total_brutto);
      }

      // Final Aggregation
      totalSpend += finalTotal;
      const rawSum = hotelRawPaid + hotelRawUnpaid;
      if (rawSum > 0) {
        totalPaid += finalTotal * (hotelRawPaid / rawSum);
        totalUnpaid += finalTotal * (hotelRawUnpaid / rawSum);
        totalOverdue += finalTotal * (hotelRawOverdue / rawSum);
      } else if (finalTotal > 0 && selectedMonth === null) {
        if (h.isPaid) totalPaid += finalTotal; else totalUnpaid += finalTotal;
      }

      // Leaderboard Key Mapping
      let key = h.name || 'Unknown';
      if (groupBy === 'company') key = h.companyTag?.[0] || (lang === 'de' ? 'Nicht zugeordnet' : 'Unassigned');
      else if (groupBy === 'city') key = h.city || 'Other';
      else if (groupBy === 'country') key = h.country || 'Other';
      
      leaderboard[key] = (leaderboard[key] || 0) + finalTotal;
    });

    const maxMonth = Math.max(...months.map(m => m.total), 1);
    const sortedLeaderboard = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxLeader = sortedLeaderboard.length > 0 ? sortedLeaderboard[0][1] : 1;

    return { 
      totalSpend, totalPaid, totalUnpaid, totalOverdue, totalDeposits, 
      months, maxMonth, sortedLeaderboard, maxLeader, mostBooked, 
      avgBedPrice: bedPriceCount > 0 ? bedPriceSum / bedPriceCount : 0 
    };
  }, [hotels, selectedYear, selectedMonth, groupBy, lang]);

  const Card = ({ title, value, icon: Icon, colorCls, bgCls }: any) => (
    <div className={cn("p-5 rounded-2xl border flex flex-col gap-3 shadow-sm", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-lg", bgCls, colorCls)}><Icon size={16} strokeWidth={2.5} /></div>
        <span className={cn("text-[10px] font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>{title}</span>
      </div>
      <span className={cn("text-2xl font-black", dk ? "text-white" : "text-slate-900")}>{value}</span>
    </div>
  );

  const monthLabels = lang === 'de' ? ['JAN','FEB','MÄR','APR','MAI','JUN','JUL','AUG','SEP','OKT','NOV','DEZ'] : ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      
      {/* 1. TOP KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card title={lang === 'de' ? 'Gesamtkosten' : 'Total Spend'} value={formatCurrency(stats.totalSpend)} icon={TrendingUp} colorCls="text-blue-500" bgCls="bg-blue-500/10" />
        <Card title={lang === 'de' ? 'Total Bezahlt' : 'Total Paid'} value={formatCurrency(stats.totalPaid)} icon={ShieldCheck} colorCls="text-emerald-500" bgCls="bg-emerald-500/10" />
        <Card title={lang === 'de' ? 'Total Offen' : 'Total Due'} value={formatCurrency(stats.totalUnpaid)} icon={Clock} colorCls="text-amber-500" bgCls="bg-amber-500/10" />
        <Card title={lang === 'de' ? 'Überfällig' : 'Overdue'} value={formatCurrency(stats.totalOverdue)} icon={AlertCircle} colorCls="text-red-500" bgCls="bg-red-500/10" />
        <Card title={lang === 'de' ? 'Kautionen' : 'Deposits'} value={formatCurrency(stats.totalDeposits)} icon={CreditCard} colorCls="text-indigo-500" bgCls="bg-indigo-500/10" />
      </div>

      {/* 2. CHARTS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* LEFT: MONTHLY BREAKDOWN */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <h3 className={cn("text-xs font-black uppercase tracking-widest mb-8", dk ? "text-slate-400" : "text-slate-500")}>{lang === 'de' ? 'Monatliche Ausgaben' : 'Monthly Breakdown'}</h3>
          <div className="flex-1 flex items-end gap-2 h-64 relative">
            {stats.months.map((m, i) => {
              const height = (m.total / stats.maxMonth) * 100;
              const isSelected = selectedMonth === i;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-3 h-full">
                  <div className="w-full flex items-end justify-center h-full group relative">
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap z-50">{formatCurrency(m.total)}</div>
                    <div className={cn("w-full max-w-[32px] rounded-t-sm transition-all duration-500", isSelected ? "bg-teal-500" : m.total > 0 ? "bg-teal-500/30 group-hover:bg-teal-500/50" : "bg-transparent")} style={{ height: `${Math.max(height, 2)}%` }} />
                  </div>
                  <span className={cn("text-[9px] font-bold", isSelected ? "text-teal-500" : "text-slate-400")}>{monthLabels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: LEADERBOARD */}
        <div className={cn("p-6 rounded-2xl border shadow-sm flex flex-col", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
          <div className="flex items-center justify-between mb-8">
            <h3 className={cn("text-xs font-black uppercase tracking-widest", dk ? "text-slate-400" : "text-slate-500")}>
               {lang === 'de' ? `Top ${groupBy === 'city' ? 'Städte' : groupBy === 'company' ? 'Firmen' : 'Hotels'}` : `Top ${groupBy === 'city' ? 'Cities' : groupBy === 'company' ? 'Companies' : 'Hotels'}`}
            </h3>
            <div className="text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded tracking-tighter">Live Auto Sync</div>
          </div>
          <div className="flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '256px' }}>
            {stats.sortedLeaderboard.length === 0 ? (
              <div className="h-40 flex items-center justify-center italic text-slate-400 text-sm">No data in this view</div>
            ) : stats.sortedLeaderboard.map(([name, val], i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={cn("truncate pr-4", dk ? "text-slate-300" : "text-slate-700")}>{name}</span>
                  <span className={dk ? "text-white" : "text-slate-900"}>{formatCurrency(val)}</span>
                </div>
                <div className={cn("w-full h-1.5 rounded-full overflow-hidden", dk ? "bg-white/5" : "bg-slate-100")}>
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${(val / stats.maxLeader) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn("p-5 rounded-2xl border flex items-center gap-4 shadow-sm", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
           <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl"><Trophy size={22} /></div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{lang === 'de' ? 'Meistgebuchtes Hotel' : 'Most Booked Hotel'}</span>
              <span className={cn("text-lg font-black truncate max-w-[300px]", dk ? "text-white" : "text-slate-900")}>{stats.mostBooked.name}</span>
           </div>
        </div>
        <div className={cn("p-5 rounded-2xl border flex items-center gap-4 shadow-sm", dk ? "bg-[#1E293B] border-white/10" : "bg-white border-slate-200")}>
           <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl"><BedDouble size={22} /></div>
           <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{lang === 'de' ? 'Ø Preis pro Bett' : 'Average Price per Bed'}</span>
              <span className={cn("text-lg font-black", dk ? "text-white" : "text-slate-900")}>{formatCurrency(stats.avgBedPrice)}</span>
           </div>
        </div>
      </div>
    </div>
  );
}
