// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { getHotels, signOut, createHotel, deleteHotel } from './lib/supabase';
import { HotelRow } from './components/HotelRow';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import type { Hotel, Theme, Language } from './lib/types';
import { cn, calculateNights, getRoomCapacity } from './lib/utils';
import { Plus, Building2 } from 'lucide-react';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHotelForm, setShowAddHotelForm] = useState(false);

  useEffect(() => {
    loadHotels();
  }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      const data = await getHotels();
      setHotels(data);
    } catch (error) {
      console.error('Failed to load hotels:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  async function handleDeleteHotel(id: string) {
    try {
      await deleteHotel(id);
      await loadHotels(); // Reload the list
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete hotel');
    }
  }

  async function handleCreateHotel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await createHotel({
        name: formData.get('name') as string,
        city: formData.get('city') as string,
        companyTag: formData.get('companyTag') as string,
      });
      
      setShowAddHotelForm(false);
      await loadHotels(); // Reload the list
    } catch (error) {
      console.error('Create hotel failed:', error);
      alert('Failed to create hotel');
    }
  }

  // Calculate real stats
  const calculateStats = () => {
    let totalSpend = 0;
    let freeBeds = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;

    hotels.forEach(hotel => {
      hotel.durations?.forEach(duration => {
        const nights = calculateNights(duration.startDate, duration.endDate);
        const capacity = getRoomCapacity(duration.roomType);
        const beds = capacity * duration.numberOfRooms;
        
        // Calculate cost
        const baseCost = nights * duration.pricePerNightPerRoom * duration.numberOfRooms;
        totalSpend += baseCost;

        // Count beds
        totalBeds += beds;
        
        // Count occupied
        const occupied = duration.employees?.filter(e => e !== null).length || 0;
        occupiedBeds += occupied;
      });
    });

    freeBeds = totalBeds - occupiedBeds;

    return { totalSpend, freeBeds };
  };

  const stats = calculateStats();

  // Filter hotels based on search
  const filteredHotels = hotels.filter(hotel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      hotel.name.toLowerCase().includes(query) ||
      hotel.city.toLowerCase().includes(query) ||
      hotel.companyTag.toLowerCase().includes(query)
    );
  });

  return (
    <div className={cn(
      "min-h-screen flex",
      theme === 'dark' ? "bg-[#020617]" : "bg-slate-50"
    )}>
      {/* Sidebar */}
      <Sidebar
        theme={theme}
        lang={lang}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        hotels={hotels}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          theme={theme}
          lang={lang}
          toggleTheme={toggleTheme}
          setLang={setLang}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSignOut={handleSignOut}
        />

        {/* Stats Bar */}
        <div className={cn(
          "px-8 py-4 border-b",
          theme === 'dark' 
            ? "bg-[#0F172A] border-white/5" 
            : "bg-white border-slate-200"
        )}>
          <div className="flex items-center gap-8">
            <div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>
                {lang === 'de' ? 'Freie Betten' : 'Free Beds'}
              </p>
              <p className="text-2xl font-black text-green-400">
                {stats.freeBeds}
              </p>
            </div>

            <div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>
                {lang === 'de' ? 'Gesamtausgaben' : 'Total Spent'}
              </p>
              <p className="text-2xl font-black text-blue-400">
                €{stats.totalSpend.toLocaleString('de-DE')}
              </p>
            </div>

            <div>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mb-1",
                theme === 'dark' ? "text-slate-500" : "text-slate-400"
              )}>
                {lang === 'de' ? 'Hotels' : 'Hotels'}
              </p>
              <p className="text-2xl font-black text-white">
                {hotels.length}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Header with Add Button */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn(
              "text-2xl font-black",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>
              {selectedMonth === null 
                ? (lang === 'de' ? 'Dashboard' : 'Dashboard')
                : `${lang === 'de' ? 'Januar' : 'January'} ${selectedYear}`
              }
            </h2>

            <button
              onClick={() => setShowAddHotelForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
              <Plus size={20} />
              {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
            </button>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className={cn(
                "mt-4 text-sm font-bold",
                theme === 'dark' ? "text-slate-400" : "text-slate-600"
              )}>
                {lang === 'de' ? 'Lade Hotels...' : 'Loading hotels...'}
              </p>
            </div>
          ) : filteredHotels.length === 0 ? (
            /* Empty State */
            <div className={cn(
              "text-center py-20 px-6 rounded-2xl border-2 border-dashed",
              theme === 'dark' 
                ? "border-white/10 bg-white/5" 
                : "border-slate-200 bg-slate-50"
            )}>
              <div className={cn(
                "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
                theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100"
              )}>
                <Building2 size={40} className="text-blue-600" />
              </div>
              <h3 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>
                {lang === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
              </h3>
              <p className={cn(
                "text-sm mb-6",
                theme === 'dark' ? "text-slate-400" : "text-slate-600"
              )}>
                {lang === 'de' 
                  ? 'Beginnen Sie mit dem Hinzufügen Ihres ersten Hotels' 
                  : 'Start by adding your first hotel'}
              </p>
              <button
                onClick={() => setShowAddHotelForm(true)}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl inline-flex items-center gap-2 transition-all shadow-lg"
              >
                <Plus size={20} />
                {lang === 'de' ? 'Erstes Hotel hinzufügen' : 'Add First Hotel'}
              </button>
            </div>
          ) : (
            /* Hotel List */
            <div className="space-y-3">
              {filteredHotels.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  entry={{
                    id: hotel.id,
                    name: hotel.name,
                    city: hotel.city,
                    address: hotel.address,
                    contact: hotel.contact,
                    email: hotel.email,
                    webLink: hotel.webLink,
                    companyTag: hotel.companyTag,
                    durations: hotel.durations?.map(d => ({
                      start: d.startDate,
                      end: d.endDate,
                      roomType: d.roomType,
                    })) || [],
                    totalNights: hotel.durations?.reduce((sum, d) => 
                      sum + calculateNights(d.startDate, d.endDate), 0
                    ) || 0,
                    freeBeds: 0, // Calculate this properly
                    assignedEmployees: hotel.durations?.flatMap(d => 
                      d.employees?.filter(e => e !== null).map(e => e!.name) || []
                    ) || [],
                    totalCost: hotel.durations?.reduce((sum, d) => {
                      const nights = calculateNights(d.startDate, d.endDate);
                      return sum + (nights * d.pricePerNightPerRoom * d.numberOfRooms);
                    }, 0) || 0,
                  }}
                  isDarkMode={theme === 'dark'}
                  onDelete={handleDeleteHotel}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Add Hotel Modal */}
      {showAddHotelForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn(
            "p-8 rounded-2xl max-w-md w-full shadow-2xl border",
            theme === 'dark' 
              ? "bg-[#0F172A] border-white/10" 
              : "bg-white border-slate-200"
          )}>
            <h3 className={cn(
              "text-2xl font-bold mb-6",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>
              {lang === 'de' ? 'Neues Hotel hinzufügen' : 'Add New Hotel'}
            </h3>

            <form onSubmit={handleCreateHotel} className="space-y-4">
              <div>
                <label className={cn(
                  "block text-sm font-bold mb-2",
                  theme === 'dark' ? "text-slate-400" : "text-slate-600"
                )}>
                  {lang === 'de' ? 'Hotelname' : 'Hotel Name'} *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder={lang === 'de' ? 'z.B. Hotel Adlon Berlin' : 'e.g., Hotel Adlon Berlin'}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl outline-none border transition-all",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                      : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                  )}
                />
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-bold mb-2",
                  theme === 'dark' ? "text-slate-400" : "text-slate-600"
                )}>
                  {lang === 'de' ? 'Stadt' : 'City'} *
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  placeholder={lang === 'de' ? 'z.B. Berlin' : 'e.g., Berlin'}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl outline-none border transition-all",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                      : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                  )}
                />
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-bold mb-2",
                  theme === 'dark' ? "text-slate-400" : "text-slate-600"
                )}>
                  {lang === 'de' ? 'Firma' : 'Company'} *
                </label>
                <input
                  type="text"
                  name="companyTag"
                  required
                  placeholder={lang === 'de' ? 'z.B. Siemens' : 'e.g., Siemens'}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl outline-none border transition-all",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                      : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                  )}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddHotelForm(false)}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold transition-all",
                    theme === 'dark'
                      ? "bg-white/5 hover:bg-white/10 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                  )}
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
                >
                  {lang === 'de' ? 'Hotel erstellen' : 'Create Hotel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
