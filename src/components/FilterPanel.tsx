// src/components/FilterPanel.tsx
import React from 'react'
import { X, SlidersHorizontal, LayoutList } from 'lucide-react'
import { cn } from '../lib/utils'
import type { FilterPaid, FilterDeposit, FilterFree, GroupBy } from '../lib/types'

interface FilterPanelProps {
  isDarkMode: boolean
  lang?: 'de' | 'en'
  filterPaid: FilterPaid
  setFilterPaid: (v: FilterPaid) => void
  filterDeposit: FilterDeposit
  setFilterDeposit: (v: FilterDeposit) => void
  filterFree: FilterFree
  setFilterFree: (v: FilterFree) => void
  groupBy: GroupBy
  setGroupBy: (v: GroupBy) => void
  onClearAll: () => void
  activeFilterCount: number
}

function ChipGroup<T extends string>({
  options, value, onChange, dk,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  dk: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-bold border transition-all whitespace-nowrap',
            value === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : dk
                ? 'border-white/10 text-slate-300 hover:bg-white/10'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function FilterPanel({
  isDarkMode, lang = 'de',
  filterPaid, setFilterPaid,
  filterDeposit, setFilterDeposit,
  filterFree, setFilterFree,
  groupBy, setGroupBy,
  onClearAll, activeFilterCount,
}: FilterPanelProps) {
  const dk = isDarkMode

  const sectionLabel = cn(
    'text-[10px] font-bold uppercase tracking-widest mb-2',
    dk ? 'text-slate-500' : 'text-slate-400'
  )

  const divider = cn('border-t my-3', dk ? 'border-white/10' : 'border-slate-100')

  const paidOptions: { value: FilterPaid; label: string }[] = [
    { value: 'all',    label: lang === 'de' ? 'Alle'      : 'All' },
    { value: 'paid',   label: lang === 'de' ? 'Bezahlt'   : 'Paid' },
    { value: 'unpaid', label: lang === 'de' ? 'Unbezahlt' : 'Unpaid' },
  ]

  const depositOptions: { value: FilterDeposit; label: string }[] = [
    { value: 'all',        label: lang === 'de' ? 'Alle'        : 'All' },
    { value: 'deposit',    label: lang === 'de' ? 'Mit Kaution' : 'With deposit' },
    { value: 'no-deposit', label: lang === 'de' ? 'Ohne Kaution': 'No deposit' },
  ]

  const freeOptions: { value: FilterFree; label: string }[] = [
    { value: 'none',     label: lang === 'de' ? 'Alle'        : 'All' },
    { value: 'today',    label: lang === 'de' ? 'Heute frei'  : 'Free today' },
    { value: 'tomorrow', label: lang === 'de' ? 'Morgen frei' : 'Free tomorrow' },
    { value: 'in5days',  label: lang === 'de' ? 'In 5 Tagen'  : 'In 5 days' },
    { value: 'in7days',  label: lang === 'de' ? 'In 7 Tagen'  : 'In 7 days' },
  ]

  const groupOptions: { value: GroupBy; label: string }[] = [
    { value: 'none',    label: lang === 'de' ? 'Kein Gruppieren' : 'No grouping' },
    { value: 'company', label: lang === 'de' ? 'Nach Firma'      : 'By company' },
    { value: 'city',    label: lang === 'de' ? 'Nach Stadt'      : 'By city' },
  ]

  return (
    <div className={cn(
      'w-72 rounded-xl border shadow-2xl p-4 space-y-0',
      dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} className={dk ? 'text-slate-400' : 'text-slate-500'} />
          <span className={cn('text-xs font-black uppercase tracking-widest', dk ? 'text-white' : 'text-slate-900')}>
            {lang === 'de' ? 'Filter' : 'Filters'}
          </span>
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearAll}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-all',
              dk
                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'border-red-300 text-red-600 hover:bg-red-50'
            )}
          >
            <X size={11} />
            {lang === 'de' ? 'Alle zurücksetzen' : 'Clear all'}
          </button>
        )}
      </div>

      {/* Payment */}
      <div>
        <p className={sectionLabel}>{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
        <ChipGroup options={paidOptions} value={filterPaid} onChange={setFilterPaid} dk={dk} />
      </div>

      <div className={divider} />

      {/* Deposit */}
      <div>
        <p className={sectionLabel}>{lang === 'de' ? 'Kaution' : 'Deposit'}</p>
        <ChipGroup options={depositOptions} value={filterDeposit} onChange={setFilterDeposit} dk={dk} />
      </div>

      <div className={divider} />

      {/* Free beds availability */}
      <div>
        <p className={sectionLabel}>{lang === 'de' ? 'Freie Betten' : 'Free beds'}</p>
        <ChipGroup options={freeOptions} value={filterFree} onChange={setFilterFree} dk={dk} />
      </div>

      <div className={divider} />

      {/* Group by */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <LayoutList size={11} className={dk ? 'text-slate-500' : 'text-slate-400'} />
          <p className={sectionLabel} style={{ marginBottom: 0 }}>
            {lang === 'de' ? 'Gruppieren nach' : 'Group by'}
          </p>
        </div>
        <ChipGroup options={groupOptions} value={groupBy} onChange={setGroupBy} dk={dk} />
      </div>
    </div>
  )
}
