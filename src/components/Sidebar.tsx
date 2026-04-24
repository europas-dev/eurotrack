import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard, ChevronUp, ChevronDown } from 'lucide-react';
import { cn, formatCurrency, calcHotelTotalCost } from '../lib/utils';

interface SidebarProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number | null;
  setSelectedMonth: (month: number | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  hotels: any[];
}

export default function Sidebar({
  theme, lang, selectedYear, setSelectedYear,
  selectedMonth, setSelectedMonth, collapsed, onToggleCollapse, hotels,
}: SidebarProps) {
  const dk = theme === 'dark';

  const [showYearMenu, setShowYearMenu] = useState(false);
  const [yearOffset, setYearOffset] = useState(0); 
  const yearMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) {
        setShowYearMenu(false);
        setYearOffset(0); 
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = lang === 'de'
    ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const centerYear = selectedYear + yearOffset;
  const currentDecade = Array.from({ length: 10 }, (_, i) => centerYear - 4 + i);

  // FIX: Monthly totals now use the EXACT same logic as the dashboard top bar
  const monthlyTotals = monthNames.map((_, i) =>
    hotels.reduce((sum, hotel) => sum + calcHotelTotalCost(hotel, i, selectedYear), 0)
  );

  const yearlyTotal = hotels.reduce((sum, hotel) => 
    sum + calcHotelTotalCost(hotel, null, selectedYear), 0
  );

  return (
    <aside className={cn(
      'sticky top-0 h-screen border-r transition-all duration-300 flex flex-col shrink-0 z-[999]',
      dk ? 'bg-[#0B1224] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900',
      collapsed ? 'w-20' : 'w-64'
    )}>
      <div className={cn('p-4 border-b flex items-center justify-between', dk ? 'border-white/5' : 'border-slate-200')}>
        {!collapsed && (
          <div className="text-xl font-black italic whitespace-nowrap select-none">
            Euro<span className="text-yellow-400">Track.</span>
          </div>
        )}
        <button onClick={onToggleCollapse}
          className={cn('p-1.5 rounded-lg transition-all mx-auto lg:mx-0', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-600')}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        <button
          onClick={() => setSelectedMonth(null)}
          className={cn(
            'w-full px-4 py-3 rounded-lg flex items-center gap-3 font-bold text-sm transition-all',
            selectedMonth === null
              ? 'bg-teal-600 text-white shadow-md'
              : dk ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          )}>
          <LayoutDashboard size={18} />
          {!collapsed && <span>{lang === 'de' ? 'Alle Monate' : 'All Months'}</span>}
        </button>

        {!collapsed && (
          <div className="relative" ref={yearMenuRef}>
            <label className={cn('text-[10px] font-bold uppercase tracking-widest mb-2 block', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Jahr' : 'Year'}
            </label>
            <button 
              onClick={() => setShowYearMenu(!showYearMenu)}
              className={cn('w-full px-4 py-2 rounded-lg border text-sm font-bold flex justify-between items-center transition-all',
                dk ? 'bg-[#1E293B] border-white/10 text-white hover:border-teal-500' 
                   : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-teal-500')}
            >
              {selectedYear}
              <ChevronDown size={14} className={dk ? 'text-slate-400' : 'text-slate-500'} />
            </button>

            {showYearMenu && (
              <div className={cn("absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border shadow-xl overflow-hidden", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                <button 
                  onClick={() => setYearOffset(prev => prev - 10)}
                  className={cn("w-full py-2 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all", dk ? "bg-white/5 hover:bg-white/10 text-slate-400" : "bg-slate-50 hover:bg-slate-100 text-slate-500")}
                >
                  <ChevronUp size={12} /> {lang === 'de' ? 'Vorherige 10' : 'Previous 10'}
                </button>
                
                <div className="flex flex-col">
                  {currentDecade.map(y => (
                    <button 
                      key={y} 
                      onClick={() => { setSelectedYear(y); setShowYearMenu(false); setYearOffset(0); }}
                      className={cn("w-full px-4 py-1.5 text-sm font-bold transition-all text-left", 
                        selectedYear === y ? "bg-teal-600 text-white" : dk ? "text-slate-300 hover:bg-white/5" : "text-slate-700 hover:bg-slate-50")}
                    >
                      {y}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setYearOffset(prev => prev + 10)}
                  className={cn("w-full py-2 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all", dk ? "bg-white/5 hover:bg-white/10 text-slate-400" : "bg-slate-50 hover:bg-slate-100 text-slate-500")}
                >
                  {lang === 'de' ? 'Nächste 10' : 'Next 10'} <ChevronDown size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          {!collapsed && (
            <label className={cn('text-[10px] font-bold uppercase tracking-widest mb-2 block', dk ? 'text-slate-400' : 'text-slate-600')}>
              {lang === 'de' ? 'Monate' : 'Months'}
            </label>
          )}
          <div className="space-y-1">
            {monthNames.map((month, index) => (
              <button key={index} onClick={() => setSelectedMonth(index)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg transition-all text-left flex items-center justify-between gap-2',
                  selectedMonth === index
                    ? 'bg-teal-600 text-white shadow-md'
                    : dk ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
                )}>
                {/* Notion-style sizing: 13px font-medium */}
                <span className="text-[13px] font-medium">{collapsed ? month.slice(0, 3) : month}</span>
                {!collapsed && monthlyTotals[index] > 0 && (
                  /* Notion-style: Muted color for secondary data */
                  <span className={cn('text-[12px] font-medium transition-colors',
                    selectedMonth === index ? 'text-teal-100' : dk ? 'text-[#bcbab6]' : 'text-slate-400')}>
                    {formatCurrency(monthlyTotals[index])}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className={cn('p-6 border-t', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
          <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', dk ? 'text-slate-400' : 'text-slate-600')}>
            {lang === 'de' ? 'Jahressumme' : 'Yearly Total'}
          </p>
          <p className="text-2xl font-black text-teal-500">
            {formatCurrency(yearlyTotal)}
          </p>
        </div>
      )}
    </aside>
  );
}
