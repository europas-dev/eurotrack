import React from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { cn, getDurationCostForMonth } from '../lib/utils';

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
  theme,
  lang,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  collapsed,
  onToggleCollapse,
  hotels
}: SidebarProps) {
  const dk = theme === 'dark';

  const monthNames = lang === 'de'
    ? ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const monthlyTotals = monthNames.map((_, monthIndex) => {
    return hotels.reduce((sum, hotel) => {
      return sum + (hotel.durations || []).reduce((inner: number, d: any) => {
        return inner + getDurationCostForMonth(d, selectedYear, monthIndex);
      }, 0);
    }, 0);
  });

  const yearlyTotal = monthlyTotals.reduce((a, b) => a + b, 0);

  return (
    <aside className={cn(
      'sticky top-0 h-screen border-r transition-all duration-300 flex flex-col',
      dk ? 'bg-[#0B1224] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900',
      collapsed ? 'w-20' : 'w-64'
    )}>
      <div className={cn(
        'p-4 border-b flex items-center justify-between',
        dk ? 'border-white/5' : 'border-slate-200'
      )}>
        {!collapsed && (
          <h3 className={cn(
            'text-sm font-bold uppercase tracking-widest',
            dk ? 'text-white' : 'text-slate-900'
          )}>
            {lang === 'de' ? 'Navigation' : 'Navigation'}
          </h3>
        )}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <button
          onClick={() => setSelectedMonth(null)}
          className={cn(
            'w-full px-4 py-3 rounded-lg flex items-center gap-3 font-bold text-sm transition-all',
            selectedMonth === null
              ? 'bg-blue-600 text-white'
              : dk ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          )}
        >
          <LayoutDashboard size={18} />
          {!collapsed && <span>{lang === 'de' ? 'Dashboard' : 'Dashboard'}</span>}
        </button>

        {!collapsed && (
          <div>
            <label className={cn(
              'text-xs font-bold uppercase tracking-widest mb-2 block',
              dk ? 'text-slate-400' : 'text-slate-600'
            )}>
              {lang === 'de' ? 'Jahr' : 'Year'}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm font-bold transition-all outline-none',
                dk ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
              )}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          {!collapsed && (
            <label className={cn(
              'text-xs font-bold uppercase tracking-widest mb-2 block',
              dk ? 'text-slate-400' : 'text-slate-600'
            )}>
              {lang === 'de' ? 'Monate' : 'Months'}
            </label>
          )}

          <div className="space-y-1">
            {monthNames.map((month, index) => (
              <button
                key={index}
                onClick={() => setSelectedMonth(index)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm font-bold transition-all text-left flex items-center justify-between gap-2',
                  selectedMonth === index
                    ? 'bg-blue-600 text-white'
                    : dk ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <span>{collapsed ? month.slice(0, 3) : month}</span>
                {!collapsed && monthlyTotals[index] > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold',
                    selectedMonth === index
                      ? 'text-blue-100'
                      : dk ? 'text-slate-500' : 'text-slate-400'
                  )}>
                    €{monthlyTotals[index].toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className={cn(
          'p-4 border-t',
          dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
        )}>
          <p className={cn(
            'text-xs font-bold uppercase tracking-widest mb-2',
            dk ? 'text-slate-400' : 'text-slate-600'
          )}>
            {lang === 'de' ? 'Jahressumme' : 'Yearly Total'}
          </p>
          <p className="text-2xl font-black text-green-400">
            €{yearlyTotal.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
          </p>
        </div>
      )}
    </aside>
  );
}
