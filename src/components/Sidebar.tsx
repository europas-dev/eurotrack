// In src/components/Sidebar.tsx
// Replace the hardcoded yearly total section with:

interface SidebarProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number | null;
  setSelectedMonth: (month: number | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  hotels: any[]; // Add this
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
  hotels // Add this
}: SidebarProps) {
  
  // Calculate real yearly total
  const calculateYearlyTotal = () => {
    let total = 0;
    hotels.forEach(hotel => {
      hotel.durations?.forEach((duration: any) => {
        const nights = calculateNights(duration.startDate, duration.endDate);
        const cost = nights * duration.pricePerNightPerRoom * duration.numberOfRooms;
        total += cost;
      });
    });
    return total;
  };

  const yearlyTotal = calculateYearlyTotal();

  // ... rest of your Sidebar code

  // Update the footer section:
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
        €{yearlyTotal.toLocaleString('de-DE')}
      </p>
    </div>
  )}
}
