// src/components/Sidebar.tsx
import React from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number | null;
  setSelectedMonth: (month: number | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  theme,
  lang,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  collapsed,
  onToggleCollapse
}: SidebarProps) {
  const monthNames = lang === 'de'
    ? ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const totalYearly = 45230; // Example data
  const totalMonthly = 12450; // Example data

  return (
    <aside className={cn(
      "sticky top-0 h-screen border-r transition-all duration-300 flex flex-col",
      theme === 'dark'
        ? "bg-[#0B1224] border-white/5"
        : "bg-white border-slate-200",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between" style={{
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'
      }}>
        {!collapsed && (
          <h3 className={cn(
            "text-sm font-bold uppercase tracking-widest",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>
            {lang === 'de' ? 'Navigation' : 'Navigation'}
          </h3>
        )}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            theme === 'dark'
              ? "hover:bg-white/10 text-slate-400 hover:text-white"
              : "hover:bg-slate-100 text-slate-600"
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Dashboard Button */}
        <button
          onClick={() => setSelectedMonth(null)}
          className={cn(
            "w-full px-4 py-3 rounded-lg flex items-center gap-3 font-bold text-sm transition-all",
            selectedMonth === null
              ? "bg-blue-600 text-white"
              : theme === 'dark'
              ? "bg-white/5 text-slate-400 hover:bg-white/10"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          <LayoutDashboard size={18} />
          {!collapsed && <span>{lang === 'de' ? 'Dashboard' : 'Dashboard'}</span>}
        </button>

        {/* Year Selector */}
        {!collapsed && (
          <div>
            <label className={cn(
              "text-xs font-bold uppercase tracking-widest mb-2 block",
              theme === 'dark' ? "text-slate-400" : "text-slate-600"
            )}>
              {lang === 'de' ? 'Jahr' : 'Year'}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm font-bold transition-all",
                theme === 'dark'
                  ? "bg-white/5 border-white/10 text-white focus:border-blue-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
              )}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}

        {/* Months */}
        <div>
          {!collapsed && (
            <label className={cn(
              "text-xs font-bold uppercase tracking-widest mb-2 block",
              theme === 'dark' ? "text-slate-400" : "text-slate-600"
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
                  "w-full px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-between",
                  selectedMonth === index
                    ? "bg-blue-600 text-white"
                    : theme === 'dark'
                    ? "text-slate-400 hover:bg-white/10"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {!collapsed && <span>{month}</span>}
                {!collapsed && index === selectedMonth && (
                  <span className="text-xs px-2 py-1 bg-blue-700 rounded">€{totalMonthly.toLocaleString()}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer - Yearly Total */}
      {!collapsed && (
        <div className={cn(
          "p-4 border-t",
          theme === 'dark'
            ? "bg-white/5 border-white/10"
            : "bg-slate-50 border-slate-200"
        )}>
          <p className={cn(
            "text-xs font-bold uppercase tracking-widest mb-2",
            theme === 'dark' ? "text-slate-400" : "text-slate-600"
          )}>
            {lang === 'de' ? 'Jahressumme' : 'Yearly Total'}
          </p>
          <p className="text-2xl font-black text-green-400">
            €{totalYearly.toLocaleString()}
          </p>
        </div>
      )}
    </aside>
  );
}
