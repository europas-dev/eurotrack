// src/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { HotelRow } from './components/HotelRow';
import { getHotels } from './lib/supabase';
import { cn } from './lib/utils';
import type { Theme, Language } from './lib/types';

interface DashboardProps {
  theme: Theme;
  lang: Language;
  toggleTheme: () => void;
  setLang: (l: Language) => void;
}

export default function Dashboard({ theme, lang, toggleTheme, setLang }: DashboardProps) {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHotels();
  }, []);

  async function loadHotels() {
    try {
      setLoading(true);
      setError('');
      const data = await getHotels();
      console.log('Loaded hotels:', data); // Check console
      setHotels(data || []);
    } catch (err) {
      console.error('Load hotels error:', err);
      setError('Failed to load hotels. Check console.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    window.location.reload(); // Simple reload for now
  }

  const handleDeleteHotel = () => {
    // Temporary - no delete yet
    console.log('Delete clicked');
  };

  const filteredHotels = hotels.filter(hotel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      hotel.name?.toLowerCase().includes(query) ||
      hotel.city?.toLowerCase().includes(query) ||
      hotel.companyTag?.toLowerCase().includes(query)
    );
  });

  // Calculate stats
  const stats = {
    totalSpend: hotels.reduce((sum: number, hotel: any) => {
      return sum + (hotel.totalCost || 0);
    }, 0),
    freeBeds: hotels.reduce((sum: number, hotel: any) => {
      return sum + (hotel.freeBeds || 0);
    }, 0)
  };

  if (error) {
    return (
      <div className={cn("min-h-screen p-6", theme === 'dark' ? "bg-[#020617]" : "bg-slate-50")}>
        <div className="max-w-md mx-auto p-8 border rounded-2xl text-center">
          <p className="text-red-500 font-bold mb-4">Error: {error}</p>
          <button 
            onClick={loadHotels}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex", theme === 'dark' ? "bg-[#020617]" : "bg-slate-50")}>
      {/* Sidebar */}
      <Sidebar
        theme={theme}
        lang={lang}
        selectedYear={
