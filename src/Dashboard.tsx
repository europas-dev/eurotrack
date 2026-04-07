// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { getHotels, signOut } from './lib/supabase';
import { HotelRow } from './components/HotelRow';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import type { Hotel, Theme, Language } from './lib/types';
import { cn } from './lib/utils';

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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = dashboard view
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleDeleteHotel = async (id: string) => {
    // We'll implement this later
    console.log('Delete hotel:', id);
  };

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
      />

      {/* Main Content */}
      <div className="flex-1">
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

        {/* Hotel List */}
        <main className="p-6">
          {loading ? (
            <div className="text-center py-20">
              <p className={theme === 'dark' ? "text-white" : "text-slate-900"}>
                Loading hotels...
              </p>
            </div>
          ) : hotels.length === 0 ? (
            <div className="text-center py-20">
              <p className={theme === 'dark' ? "text-white" : "text-slate-900"}>
                No hotels yet. Add your first hotel!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {hotels.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  entry={hotel}
                  isDarkMode={theme === 'dark'}
                  onDelete={() => handleDeleteHotel(hotel.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
