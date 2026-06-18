// src/Dashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, deleteHotel, createHotel, updateHotel } from './lib/supabase';
import { cn, formatCurrency, hotelMatchesSearch, calcHotelTotalCost, calcHotelFreeBedsToday, calculateNights, calcInvoiceItem, getEmployeeStatus } from './lib/utils';
import { calcRoomCardNettoSum, calcRoomCardTotal } from './lib/roomCardUtils';
import type { AccessLevel } from './lib/supabase';
import { Plus, Check, X, Loader2, Filter, ArrowUpDown, Star, Calendar, MapPin, Building, Building2, CloudOff, Globe, Trash2, Copy, Eye, EyeOff, ChevronDown, ChevronUp, Bed, Coins, Users, ArrowDownNarrowWide, ArrowDownWideNarrow } from 'lucide-react';
import Header from './components/Header';
import { HotelRow, ModernDropdown, CompanyMultiSelect, getCountryOptions } from './components/HotelRow';
import ExportStudio from './components/ExportStudio';
import StatisticsDashboard from './components/StatisticsDashboard';

// --- SYSTEM COMPANIES API ---
async function getSystemCompanies(): Promise<string[]> {
  const { data, error } = await supabase.from('global_companies').select('name').order('name');
  if (error) { console.error("Global Companies Fetch Error:", error); return []; }
  return (data || []).map(c => c.name);
}

async function addSystemCompany(name: string): Promise<void> {
  const { error } = await supabase.from('global_companies').insert({ name });
  if (error) console.error("Global Companies Insert Error:", error);
}

async function deleteSystemCompany(name: string): Promise<void> {
  await supabase.from('global_companies').delete().eq('name', name);
}

interface DashboardProps {
  theme: 'dark' | 'light'; lang: 'de' | 'en';
  toggleTheme: () => void; setLang: (l: 'de' | 'en') => void;
  offlineMode?: boolean; onToggleOfflineMode?: () => void;
  viewOnly?: boolean; accessLevel?: AccessLevel | null; onSignOut?: () => void;
}

export default function Dashboard({ theme, lang, toggleTheme, setLang, viewOnly = false, accessLevel, onSignOut, offlineMode, onToggleOfflineMode }: DashboardProps) {
  const dk = theme === 'dark';
  const isStrictViewer = viewOnly || accessLevel?.role === 'viewer' || accessLevel?.role === 'pending';

  const [hotels, setHotels] = useState<any[]>([]);
  const [systemCompanies, setSystemCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [showStudio, setShowStudio] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');

  // --- UI TOGGLES ---
  const [showGlobalFinancials, setShowGlobalFinancials] = useState(false);
  const [showYearMenu, setShowYearMenu] = useState(false);
  const [showMonthMenu, setShowMonthMenu] = useState(false);
  const [yearOffset, setYearOffset] = useState(0);
  
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const monthMenuRef = useRef<HTMLDivElement>(null);

  // --- SELECTION SYSTEM STATE ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null);  // ADD THIS LINE
  const [activeEmpFilters, setActiveEmpFilters] = useState<string[]>([]);
  const [showEmpMenu, setShowEmpMenu] = useState(false);
  const empMenuRef = useRef<HTMLDivElement>(null);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  // --- ADD THIS LISTENER ---
  useEffect(() => {
    const handleOpen = () => setIsAnyModalOpen(true);
    const handleClose = () => setIsAnyModalOpen(false);
    window.addEventListener('child-modal-open', handleOpen);
    window.addEventListener('child-modal-closed', handleClose);
    return () => {
      window.removeEventListener('child-modal-open', handleOpen);
      window.removeEventListener('child-modal-closed', handleClose);
    };
  }, []);

  // MENU VISIBILITY
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // OPERATIONAL STATE
  const [tlType, setTlType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [tlStart, setTlStart] = useState('');
  const [tlEnd, setTlEnd] = useState('');
  
  const [fbType, setFbType] = useState<'all'|'today'|'tomorrow'|'3days'|'7days'|'range'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterDue, setFilterDue] = useState<'all' | 'today' | '3days' | '5days'>('all');
  const [filterDeposit, setFilterDeposit] = useState<'all' | 'yes' | 'no'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'hotel' | 'company' | 'city' | 'country'>('none');
  const [activeGroupTab, setActiveGroupTab] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'bed_price' | 'free_beds' | 'payment_due' | 'total_paid' | 'created_at' | 'updated_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [showBookmarks, setShowBookmarks] = useState(false);
  
  // --- USER SPECIFIC BOOKMARKS ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user);
        try { setBookmarks(JSON.parse(localStorage.getItem(`eurotrack_bookmarks_${user.id}`) || '[]')); } catch {}
      }
    });
  }, []);
  
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [addingHotel, setAddingHotel] = useState(false);
  
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelCity, setNewHotelCity] = useState('');
  const [newHotelCompanyTags, setNewHotelCompanyTags] = useState<string[]>([]);
  const [newHotelCountry, setNewHotelCountry] = useState('Germany'); 
  const [newHotelSaving, setNewHotelSaving] = useState(false);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  // Dynamic Title Logic
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const displayTitle = selectedMonth !== null 
    ? `${lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth]} ${selectedYear}`
    : `${lang === 'de' ? 'Dashboard' : 'Dashboard'} ${selectedYear}`;

  useEffect(() => {
    const hO = () => setIsOnline(true);
    const hOff = () => setIsOnline(false);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hOff);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hOff); };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const key = `eurotrack_bookmarks_${currentUser.id}`;
    const handleStorage = () => {
      try { setBookmarks(JSON.parse(localStorage.getItem(key) || '[]')); } catch {}
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 1000); 
    return () => { window.removeEventListener('storage', handleStorage); clearInterval(interval); };
  }, [currentUser]);

  const toggleBookmark = (hotelId: string) => {
    if (!currentUser) return;
    const key = `eurotrack_bookmarks_${currentUser.id}`;
    setBookmarks(prev => {
      const next = prev.includes(hotelId) ? prev.filter(id => id !== hotelId) : [...prev, hotelId];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  // Dropdown dismiss logic
  useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) {
      setShowYearMenu(false);
      setYearOffset(0);
    }
    if (monthMenuRef.current && !monthMenuRef.current.contains(event.target as Node)) {
      setShowMonthMenu(false);
    }
  }
  
  if (showYearMenu || showMonthMenu) {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }
  
  return () => {};
}, [showYearMenu, showMonthMenu]);

  useEffect(() => {
    let isMounted = true;
    const channel = supabase.channel('dashboard_presence', { config: { presence: { key: 'user' } } });
    
    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      const state = channel.presenceState();
      const users = Object.values(state).flat().map((p: any) => p.user);
      
      const ghostIds = new Set(users.filter((u: any) => u.invisible === true || u.is_ghost === true).map((u: any) => u.id));
      const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.id, u])).values());
      const filteredUsers = uniqueUsers.filter((u: any) => !ghostIds.has(u.id));
      setActiveUsers(filteredUsers);
    });

    // FIX: Reusable sync function that always grabs the freshest data directly from the profiles table!
    const syncMyPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && isMounted) {
         const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
         
         // Prioritize the database 'full_name' over the auth token
         const freshName = profile?.full_name || profile?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
         const isGhost = profile?.invisible === true || profile?.is_ghost === true;

         await channel.track({ user: { id: user.id, name: freshName, email: user.email, invisible: isGhost } });
      }
    };

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isMounted) {
        await syncMyPresence();
      }
    });

    // We can just call syncMyPresence for any update now!
    window.addEventListener('ghost-mode-changed', syncMyPresence);
    window.addEventListener('profile-updated', syncMyPresence);

    return () => { 
      isMounted = false; 
      window.removeEventListener('ghost-mode-changed', syncMyPresence); 
      window.removeEventListener('profile-updated', syncMyPresence); 
      channel.unsubscribe(); 
      supabase.removeChannel(channel); 
    };
  }, []);

  // --- DATA FETCHING LOGIC ---
  useEffect(() => { 
    let isMounted = true;
    setLoading(true);
    setError(''); 
    
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 5000);

    async function fetchAllData() {
      try {
        const companies = await getSystemCompanies();
        const { data, error } = await supabase
          .from('hotels')
          .select('*, durations(*, room_cards(*, employees(*)), employees(*))')
          .order('created_at', { ascending: false });

        if (error) throw error; 

        const normalized = (data || []).map((h: any) => ({
          ...h, 
          companyTag: h.company_tag ?? [],
          isPaid: h.is_paid ?? false,
          rechnungNr: h.rechnung_nr ?? '',
          bookingId: h.booking_id ?? '',
          depositEnabled: h.deposit_enabled ?? false,
          depositAmount: h.deposit_amount ?? 0,
          useBruttoNetto: h.use_brutto_netto ?? true,
          hasDiscount: h.has_discount ?? false,
          discountType: h.discount_type ?? 'percentage',
          discountValue: h.discount_value ?? 0,

          durations: (h.durations || []).map((d: any) => ({
            ...d, hotelId: d.hotel_id, startDate: d.start_date, endDate: d.end_date, roomType: d.room_type, numberOfRooms: d.number_of_rooms,
            pricePerNightPerRoom: d.price_per_night_per_room, useManualPrices: d.use_manual_prices, nightlyPrices: d.nightly_prices, useBruttoNetto: d.use_brutto_netto,
            hasDiscount: d.has_discount, discountType: d.discount_type, discountValue: d.discount_value, isPaid: d.is_paid, rechnungNr: d.rechnung_nr,
            bookingId: d.booking_id, depositEnabled: d.deposit_enabled, depositAmount: d.deposit_amount,
            roomCards: (d.room_cards || []).map((rc: any) => ({
              ...rc, durationId: rc.duration_id, roomNo: rc.room_no, roomType: rc.room_type, bedCount: rc.bed_count, pricingTab: rc.pricing_tab ?? 'per_room',
              roomNetto: rc.room_netto, roomMwst: rc.room_mwst, roomBrutto: rc.room_brutto, bedNetto: rc.bed_netto, bedMwst: rc.bed_mwst, bedBrutto: rc.bed_brutto, totalNetto: rc.total_netto, totalMwst: rc.total_mwst, totalBrutto: rc.total_brutto,
              roomEnergyNetto: rc.room_energy_netto, roomEnergyMwst: rc.room_energy_mwst, roomEnergyBrutto: rc.room_energy_brutto, bedEnergyNetto: rc.bed_energy_netto, bedEnergyMwst: rc.bed_energy_mwst, bedEnergyBrutto: rc.bed_energy_brutto, totalEnergyNetto: rc.total_energy_netto, totalEnergyMwst: rc.total_energy_mwst, totalEnergyBrutto: rc.total_energy_brutto,
              hasDiscount: rc.has_discount, discountType: rc.discount_type, discountValue: rc.discount_value,
              basePrice: rc.base_price, baseRoomPrice: rc.base_room_price, baseEnergyPrice: rc.base_energy_price, baseNights: rc.base_nights, lastSyncedEndDate: rc.last_synced_end_date,
              employees: (rc.employees || []).map((e: any) => ({ ...e, slotIndex: e.slot_index ?? 0, checkIn: e.checkin, checkOut: e.checkout }))
            }))
          }))
        }));

        if (isMounted) { 
          setSystemCompanies(companies);
          setHotels(normalized); 
          setHistory([normalized]); 
          setHistoryIndex(0); 
        }
      } catch (err: any) { 
        console.error("Dashboard Load Error:", err);
        if (isMounted) setError(err.message || "Failed to load dashboard data."); 
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) setLoading(false);
      }
    }
    
    fetchAllData(); 
    return () => { 
        isMounted = false; 
        clearTimeout(safetyTimer);
    };
  }, [selectedYear]);

  const allCompanyOptions = useMemo(() => {
    const localTags = hotels.flatMap(h => h.companyTag || []).filter(Boolean);
    return Array.from(new Set([...systemCompanies, ...localTags]));
  }, [hotels, systemCompanies]);

  const uniqueCities = useMemo(() => Array.from(new Set(hotels.map(h => h.city).filter(Boolean))), [hotels]);
  const uniqueHotelNames = useMemo(() => Array.from(new Set(hotels.map(h => h.name).filter(Boolean))), [hotels]);
  const uniqueEmployeeNames = useMemo(() => {
    const names = new Set<string>();
    hotels.forEach(h => h.durations?.forEach((d:any) => d.roomCards?.forEach((rc:any) => rc.employees?.forEach((e:any) => { if (e.name) names.add(e.name); }))));
    return Array.from(names);
  }, [hotels]);

  const handleAddGlobalCompany = async (name: string) => {
    try { await addSystemCompany(name); setSystemCompanies(prev => Array.from(new Set([...prev, name]))); } 
    catch (err) { console.error("Failed to add company globally", err); }
  };

  const handleRenameGlobalCompany = async (oldName: string, newName: string) => {
    try {
      await deleteSystemCompany(oldName);
      await addSystemCompany(newName);
      setSystemCompanies(prev => [...prev.filter(c => c !== oldName), newName].sort());
      
      setNewHotelCompanyTags(prev => prev.map(t => t === oldName ? newName : t));
      
      setHotels(prevHotels => {
        const updated = prevHotels.map(h => {
          if (h.companyTag?.includes(oldName)) {
             const newTags = h.companyTag.map((t: string) => t === oldName ? newName : t);
             updateHotel(h.id, { company_tag: newTags }); // Fire silent background DB save
             return { ...h, companyTag: newTags };
          }
          return h;
        });
        pushToHistory(updated);
        return updated;
      });
    } catch (err) { console.error("Failed to rename company", err); }
  };

  const handleDeleteGlobalCompany = async (name: string) => {
    try { 
      await deleteSystemCompany(name); 
      setSystemCompanies(prev => prev.filter(c => c !== name)); 
      
      setHotels(prevHotels => {
        const updated = prevHotels.map(h => {
          if (h.companyTag?.includes(name)) {
             const newTags = h.companyTag.filter((t: string) => t !== name);
             updateHotel(h.id, { company_tag: newTags }); // Fire silent background DB save
             return { ...h, companyTag: newTags };
          }
          return h;
        });
        pushToHistory(updated);
        return updated;
      });
    } catch (err) { console.error("Failed to delete company from system", err); }
  };

  function pushToHistory(next: any[]) { 
    const nH = history.slice(0, historyIndex + 1); 
    nH.push(next); setHistory(nH); setHistoryIndex(nH.length - 1); 
  }

  async function handleSaveNewHotel() {
    if (!newHotelName.trim()) return; 
    setNewHotelSaving(true);
    try {
      const h = await createHotel({ 
        name: newHotelName.trim(), 
        city: newHotelCity.trim() || null, 
        companyTag: newHotelCompanyTags,  
        company_tag: newHotelCompanyTags, 
        country: newHotelCountry, 
        year: selectedYear 
      });
      
      const next = [{ 
        ...h, 
        companyTag: newHotelCompanyTags, 
        durations: [], isPaid: false, rechnungNr: '', bookingId: '', depositEnabled: false, depositAmount: 0, useBruttoNetto: true, hasDiscount: false, discountType: 'percentage', discountValue: 0
      }, ...hotels]; 
      
      setHotels(next); 
      pushToHistory(next); 
      setAddingHotel(false); 
      setNewHotelName(''); setNewHotelCity(''); setNewHotelCompanyTags([]); setNewHotelCountry('Germany');
    } catch (e: any) { alert(e.message); } finally { setNewHotelSaving(false); }
  }

  const getBedsCount = (daysOffset: number) => {
     const d = new Date(); d.setDate(d.getDate() + daysOffset);
     const dStr = d.toISOString().split('T')[0];
     let total = 0;
     hotels.forEach(h => {
        (h.durations || []).forEach((dur: any) => {
           if (dur.startDate <= dStr && dur.endDate >= dStr) {
              (dur.roomCards || []).forEach((rc: any) => {
                 const emps = (rc.employees || []).filter((e: any) => e.checkIn <= dStr && e.checkOut > dStr);
                 total += Math.max(0, (rc.bedCount || 0) - emps.length);
              });
           }
        });
     });
     return total;
  };

  const fbCountToday = useMemo(() => getBedsCount(0), [hotels]);
  const fbCountTomorrow = useMemo(() => getBedsCount(1), [hotels]);
  const fbCount3 = useMemo(() => getBedsCount(3), [hotels]);
  const fbCount7 = useMemo(() => getBedsCount(7), [hotels]);

  const finalFiltered = useMemo(() => {
    return hotels.filter(h => {
      // --- FINANCIAL OVERLAP ENGINE: Does this hotel belong in this year? ---
      const durationInYear = (h.durations || []).some((d: any) => {
        if (!d.startDate || !d.endDate) return false;
        return new Date(d.startDate).getFullYear() <= selectedYear && new Date(d.endDate).getFullYear() >= selectedYear;
      });
      
      const invoiceInYear = (h.invoices || []).some((inv: any) => {
        const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
        return dateStr && new Date(dateStr).getFullYear() === selectedYear;
      });

      // THE ANCHOR YEAR: The year dashboard where this hotel was originally created
      const isAnchorYear = h.year === selectedYear;

      // Show if it physically overlaps, financially overlaps, OR is in its home creation year!
      if (!durationInYear && !invoiceInYear && !isAnchorYear) return false;

      if (showBookmarks && !bookmarks.includes(h.id)) return false;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (searchScope === 'hotel') { 
              if (!h.name?.toLowerCase().includes(q)) return false; 
          } else if (searchScope === 'city') { 
              if (!h.city?.toLowerCase().includes(q)) return false; 
          } else if (searchScope === 'company') { 
              if (!h.companyTag?.some((t:any) => t.toLowerCase().includes(q))) return false; 
          } else if (searchScope === 'invoice') { 
              const hotelInvMatch = h.rechnungNr?.toLowerCase().includes(q) || (h.invoices || []).some((inv: any) => inv.number?.toLowerCase().includes(q));
              const durationInvMatch = (h.durations || []).some((d:any) => d.rechnungNr?.toLowerCase().includes(q));
              if (!hotelInvMatch && !durationInvMatch) return false;
          } else if (searchScope === 'employee') {
              const hasEmp = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
              if (!hasEmp) return false;
          } else { 
              const matchAll = hotelMatchesSearch(h, searchQuery, 'all');
              const deepInvoiceMatch = h.rechnungNr?.toLowerCase().includes(q) || (h.invoices || []).some((inv: any) => inv.number?.toLowerCase().includes(q)) || (h.durations || []).some((d:any) => d.rechnungNr?.toLowerCase().includes(q));
              const deepEmployeeMatch = (h.durations || []).some((d:any) => (d.roomCards || []).some((rc:any) => (rc.employees || []).some((e:any) => e.name?.toLowerCase().includes(q))));
              if (!matchAll && !deepInvoiceMatch && !deepEmployeeMatch) return false;
          }
      }

      if (selectedMonth !== null) {
        // Check if bookings overlap the month
        const durationOverlap = (h.durations || []).some((d: any) => {
          if (!d.startDate || !d.endDate) return false;
          const dStart = new Date(d.startDate); const dEnd = new Date(d.endDate);
          const mStart = new Date(selectedYear, selectedMonth, 1);
          const mEnd = new Date(selectedYear, selectedMonth + 1, 0);
          return dStart <= mEnd && dEnd >= mStart;
        });

        // Check if any invoice belongs to this month
        const invoiceOverlap = (h.invoices || []).some((inv: any) => {
          const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });

        if (!durationOverlap && !invoiceOverlap) return false;
      }
      

      // PAYMENT STATUS
      if (filterPaid === 'paid' && !h.isPaid) return false;
      if (filterPaid === 'unpaid' && h.isPaid) return false;

      // NEW: PAYMENT DUE LOGIC
      if (filterDue !== 'all') {
          const today = new Date();
          today.setHours(0,0,0,0);
          let maxDate = new Date(today);
          if (filterDue === 'today') maxDate.setDate(today.getDate() + 0);
          else if (filterDue === '3days') maxDate.setDate(today.getDate() + 3);
          else if (filterDue === '5days') maxDate.setDate(today.getDate() + 5);
          maxDate.setHours(23,59,59,999);

          const hasDueInvoice = (h.invoices || []).some((inv: any) => {
              if (inv.isPaid || !inv.dueDate) return false;
              const d = new Date(inv.dueDate);
              return d >= today && d <= maxDate;
          });
          if (!hasDueInvoice) return false;
      }
      
      if (filterDeposit === 'yes' && !h.depositEnabled) return false;
      if (filterDeposit === 'no' && h.depositEnabled) return false;

      // FIX: TIMELINE OVERLAP ENGINE
      if (tlType !== 'all' && tlStart && tlEnd) {
          const hasTimelineOverlap = (h.durations || []).some((dur: any) => {
              if (!dur.startDate || !dur.endDate) return false;
              // A duration overlaps if it starts BEFORE/ON the timeline end, AND ends AFTER/ON the timeline start.
              return dur.startDate <= tlEnd && dur.endDate >= tlStart;
          });
          if (!hasTimelineOverlap) return false;
      }
      // --- ADD THIS BLOCK HERE ---
      // EMPLOYEE STATUS FILTER
      if (activeEmpFilters.length > 0) {
        const hasMatch = (h.durations || []).some((d: any) => 
            (d.roomCards || []).some((rc: any) => 
                (rc.employees || []).some((e: any) => {
                    const status = getEmployeeStatus(e.checkIn, e.checkOut);
                    return activeEmpFilters.includes(status);
                })
            )
        );
        if (!hasMatch) return false;
      }
      if (fbType !== 'all') {
         let targetDate = new Date().toISOString().split('T')[0];
         if (fbType === 'tomorrow') { const d = new Date(); d.setDate(d.getDate()+1); targetDate = d.toISOString().split('T')[0]; }
         if (fbType === '3days') { const d = new Date(); d.setDate(d.getDate()+3); targetDate = d.toISOString().split('T')[0]; }
         if (fbType === '7days') { const d = new Date(); d.setDate(d.getDate()+7); targetDate = d.toISOString().split('T')[0]; }
         
         let hasFree = false;
         (h.durations || []).forEach((dur: any) => {
            if (dur.startDate <= targetDate && dur.endDate >= targetDate) {
               (dur.roomCards || []).forEach((rc: any) => {
                  const emps = (rc.employees || []).filter((e: any) => e.checkIn <= targetDate && e.checkOut > targetDate);
                  if ((rc.bedCount || 0) > emps.length) hasFree = true;
               });
            }
         });
         if (!hasFree) return false;
      }

    // EMPLOYEE STATUS FILTER
      if (activeEmpFilters.length > 0) {
        const hasMatch = (h.durations || []).some((d: any) => 
            (d.roomCards || []).some((rc: any) => 
                (rc.employees || []).some((e: any) => {
                    const status = getEmployeeStatus(e.checkIn, e.checkOut);
                    return activeEmpFilters.includes(status);
                })
            )
        );
        if (!hasMatch) return false;
      }
      
     return true;
    }).sort((a, b) => {
      let va: any; let vb: any;
      
      if (sortBy === 'bed_price') {
          const getMinPrice = (hotel: any) => {
              let minPricePerBed: number | null = null;
              
              // 1. Scan invoices for room bed prices (Exactly matches HotelRow UI logic)
              const invoicesToScan = hotel.invoices || [];
              invoicesToScan.forEach((inv: any) => {
                  const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
                  if (!dateStr) return;
                  const d = new Date(dateStr);
                  if (d.getFullYear() !== selectedYear) return;
                  if (selectedMonth !== null && d.getMonth() !== selectedMonth) return;

                  if (inv.billingMode !== 'total') {
                      (inv.items || []).forEach((item: any) => {
                          if (item.type === 'room' && item.method === 'per_bed' && item.netto && parseFloat(item.netto) > 0) {
                              const bedPrice = parseFloat(item.netto);
                              if (minPricePerBed === null || bedPrice < minPricePerBed) minPricePerBed = bedPrice;
                          }
                      });
                  }
              });

              let finalPrice = minPricePerBed !== null ? minPricePerBed : Infinity;

              // 2. Prioritize Manual Override if valid
              if (hotel.override_price_per_bed != null) {
                  const overrideVal = parseFloat(hotel.override_price_per_bed);
                  if (minPricePerBed !== null && minPricePerBed < overrideVal) {
                      finalPrice = minPricePerBed; 
                  } else {
                      finalPrice = overrideVal;
                  }
              }
              
              // If it's exactly 0, treat it as Infinity so it safely drops to the bottom
              return (finalPrice === 0) ? Infinity : finalPrice;
          };
          
          va = getMinPrice(a); 
          vb = getMinPrice(b);
      }
      else if (sortBy === 'cost') { va = calcHotelTotalCost(a, selectedMonth !== null ? selectedMonth : null, selectedYear); vb = calcHotelTotalCost(b, selectedMonth !== null ? selectedMonth : null, selectedYear); }
      else if (sortBy === 'free_beds') { va = calcHotelFreeBedsToday(a); vb = calcHotelFreeBedsToday(b); }
      else if (sortBy === 'created_at') { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); }
      else if (sortBy === 'updated_at') { va = new Date(a.last_updated_at || a.lastUpdatedAt || 0).getTime(); vb = new Date(b.last_updated_at || b.lastUpdatedAt || 0).getTime(); }
      else if (sortBy === 'payment_due') {
          const getNextDue = (hotel: any) => {
             const unpaids = (hotel.invoices || []).filter((i:any) => !i.isPaid && i.dueDate).map((i:any) => new Date(i.dueDate).getTime());
             return unpaids.length > 0 ? Math.min(...unpaids) : Infinity;
          };
          va = getNextDue(a); vb = getNextDue(b);
      }
      else if (sortBy === 'total_paid') {
          const getPaid = (hotel: any) => {
              let p = 0;
              (hotel.invoices || []).filter((i:any) => i.isPaid).forEach((inv: any) => {
                  if (inv.billingMode === 'total') {
                     const baseN = parseFloat(inv.totalNetto) || 0;
                     const m = parseFloat(inv.totalMwst) || 0;
                     const disc = parseFloat(inv.discountValue) || 0;
                     const isPct = inv.discountType === 'percentage';
                     const finalN = Math.max(0, baseN - (isPct ? baseN * (disc/100) : disc));
                     p += finalN * (1 + m / 100);
                  } else {
                     const defN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
                     p += (inv.items || []).reduce((s:number, it:any) => s + (calcInvoiceItem(it, defN)?.brutto || 0), 0);
                  }
              });
              return p;
          };
          va = getPaid(a); vb = getPaid(b);
      }
      else { va = a.name?.toLowerCase() || ''; vb = b.name?.toLowerCase() || ''; }
      
      // UX FIX: Force any Infinity/Empty values to the absolute bottom, regardless of ASC/DESC
      if (va === Infinity && vb === Infinity) return 0;
      if (va === Infinity) return 1;
      if (vb === Infinity) return -1;
      
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [hotels, searchQuery, searchScope, showBookmarks, bookmarks, sortBy, sortDir, tlType, tlStart, tlEnd, fbType, filterPaid, filterDue, filterDeposit, selectedMonth, selectedYear]);
  const groupData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: Record<string, any[]> = {};
    finalFiltered.forEach(h => {
      const key = groupBy === 'company' 
        ? (h.companyTag?.[0] || (lang === 'de' ? 'Nicht zugeordnet' : 'Unassigned')) 
        : groupBy === 'city' ? (h.city || 'Other') : groupBy === 'country' ? (h.country || 'Other') : h.name;
      if (!groups[key]) groups[key] = []; 
      groups[key].push(h);
    });
    return groups;
  }, [finalFiltered, groupBy, lang]);

    const isAllSelected = useMemo(() => {
    const visible = groupBy !== 'none' && activeGroupTab && groupData ? (groupData[activeGroupTab] || []) : finalFiltered;
    return visible.length > 0 && visible.every(h => selectedIds.has(h.id));
  }, [selectedIds, finalFiltered, groupData, activeGroupTab, groupBy]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const visible = groupBy !== 'none' && activeGroupTab && groupData ? (groupData[activeGroupTab] || []) : finalFiltered;
    const next = new Set(selectedIds);
    if (isAllSelected) visible.forEach(h => next.delete(h.id)); else visible.forEach(h => next.add(h.id));
    setSelectedIds(next);
  };


  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    const confirmMsg = lang === 'de' ? `Sind Sie sicher, dass Sie ${count} Hotels löschen möchten?` : `Are you sure you want to delete ${count} hotels?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const idsArray = Array.from(selectedIds);
      const { bulkDeleteHotels } = await import('./lib/supabase');
      await bulkDeleteHotels(idsArray);
      
      const nextHotels = hotels.filter(h => !selectedIds.has(h.id));
      setHotels(nextHotels); pushToHistory(nextHotels); setSelectedIds(new Set());
    } catch (err: any) { alert("Delete failed: " + err.message); } finally { setLoading(false); }
  };

  const handleBulkDuplicate = async () => {
    try {
      setLoading(true);
      const toClone = hotels.filter(h => selectedIds.has(h.id));
      const { duplicateHotelsMetadata } = await import('./lib/supabase');
      const newEntries = await duplicateHotelsMetadata(toClone);
      
      const normalizedNew = newEntries.map((h: any) => ({ ...h, companyTag: h.company_tag ?? [], durations: [] }));
      const nextHotels = [...normalizedNew, ...hotels];
      setHotels(nextHotels); pushToHistory(nextHotels); setSelectedIds(new Set());
    } catch (err: any) { alert("Duplicate failed: " + err.message); } finally { setLoading(false); }
  };

  // --- DASHBOARD MATH FOR TOP BAR (INVOICES ONLY) ---
let totalSpend = 0;
let totalPaidGlobal = 0;
let totalUnpaidGlobal = 0;

finalFiltered.forEach(h => {
  let finalNetto = 0;
  let finalBrutto = 0;
  let rawPaid = 0;
  let rawUnpaid = 0;

  (h.invoices || []).forEach((inv: any) => {
    const dateStr = inv.isPaid ? inv.paymentDate : (inv.dueDate || inv.created_at || new Date().toISOString());
    if (!dateStr) return;
    const d = new Date(dateStr);
    
    // STRICT FINANCIAL BOUNDARY: Must belong to the selected year
    if (d.getFullYear() !== selectedYear) return;
    // Strict month boundary (if active)
    if (selectedMonth !== null && d.getMonth() !== selectedMonth) return;

    let invBrutto = 0;
        if (inv.billingMode === 'total') {
          const baseN = parseFloat(inv.totalNetto) || 0;
          const m = parseFloat(inv.totalMwst) || 0;
          const disc = parseFloat(inv.discountValue) || 0;
          const isPct = inv.discountType === 'percentage';
          const n = Math.max(0, baseN - (isPct ? baseN * (disc/100) : disc));
          const b = n * (1 + m / 100);
          finalNetto += n;
          finalBrutto += b;
          invBrutto += b;
        } else {
      const defaultN = inv.startDate && inv.endDate ? calculateNights(inv.startDate, inv.endDate) : 1;
      (inv.items || []).forEach((item: any) => {
        const { finalNetto: itemNetto, brutto: itemB } = calcInvoiceItem(item, defaultN);
        finalNetto += itemNetto;
        finalBrutto += itemB;
        invBrutto += itemB;
      });
    }

    if (inv.isPaid) rawPaid += invBrutto;
    else rawUnpaid += invBrutto;
  });

  let discountedBrutto = finalBrutto;
  if (h.has_global_discount && h.global_discount_value) {
     const gVal = parseFloat(h.global_discount_value);
     const isFixed = h.global_discount_type === 'fixed';
     const target = h.global_discount_target || 'netto';
     if (target === 'netto') {
        let ratio = isFixed ? (gVal / finalNetto) : (gVal / 100);
        if (!isFinite(ratio)) ratio = 0;
        discountedBrutto = Math.max(0, finalBrutto - (finalBrutto * ratio));
     } else {
        discountedBrutto = Math.max(0, finalBrutto - (isFixed ? gVal : finalBrutto * (gVal/100)));
     }
  }

  let total = discountedBrutto;
  const override = h.override_total_brutto ?? h.overrideTotalBrutto;
  if (override != null && selectedMonth === null) {
      total = parseFloat(override);
  }

  totalSpend += total;

  const rawTotal = rawPaid + rawUnpaid;
  if (rawTotal > 0) {
     totalPaidGlobal += total * (rawPaid / rawTotal);
     totalUnpaidGlobal += total * (rawUnpaid / rawTotal);
  } else if (total > 0 && selectedMonth === null) {
     if (h.isPaid) totalPaidGlobal += total;
     else totalUnpaidGlobal += total;
  }
});


  const freeBedsTotal = finalFiltered.reduce((s, h) => s + calcHotelFreeBedsToday(h), 0);
  
  const closeMenu = () => { 
      setShowFilterMenu(false); setShowTimelineMenu(false); setShowSortMenu(false); 
      setShowYearMenu(false); setShowMonthMenu(false);
  };

  const activeFilters = useMemo(() => {
    const badges = [];
    const fmt = (iso:string) => { if(!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}.${m}.${y}`; };
    
    // Translation Maps
    const timeLabels: any = { today: lang === 'de' ? 'Heute' : 'Today', tomorrow: lang === 'de' ? 'Morgen' : 'Tomorrow', '3days': lang === 'de' ? 'in 3 Tagen' : 'in 3 Days', '7days': lang === 'de' ? 'in 7 Tagen' : 'in 7 Days' };
    const grpLabels: any = { hotel: 'Hotel', company: lang === 'de' ? 'Firma' : 'Company', city: lang === 'de' ? 'Stadt' : 'City', country: lang === 'de' ? 'Land' : 'Country' };
    
    if (tlType !== 'all') badges.push({ id: 'tl', label: lang === 'de' ? 'Zeitraum' : 'Timeline', val: tlType === 'range' ? `${fmt(tlStart)} ➔ ${fmt(tlEnd)}` : timeLabels[tlType], clear: () => { setTlType('all'); setTlStart(''); setTlEnd(''); } });
    if (fbType !== 'all') badges.push({ id: 'fb', label: lang === 'de' ? 'Freie Betten' : 'Free Beds', val: timeLabels[fbType] || fbType, clear: () => setFbType('all') });
    if (filterPaid !== 'all') badges.push({ id: 'paid', label: lang === 'de' ? 'Zahlung' : 'Payment', val: lang === 'de' ? (filterPaid === 'paid' ? 'Bezahlt' : 'Offen') : filterPaid, clear: () => setFilterPaid('all') });
    
    if (filterDue !== 'all') {
        const dueVal = filterDue === 'today' ? (lang === 'de' ? 'Heute' : 'Today') : (filterDue === '3days' ? (lang === 'de' ? 'In 3 Tagen' : 'In 3 Days') : (lang === 'de' ? 'In 5 Tagen' : 'In 5 Days'));
        badges.push({ id: 'due', label: lang === 'de' ? 'Fälligkeit' : 'Payment Due', val: dueVal, clear: () => setFilterDue('all') });
    }
    
    if (filterDeposit !== 'all') badges.push({ id: 'dep', label: lang === 'de' ? 'Kaution' : 'Deposit', val: filterDeposit === 'yes' ? (lang === 'de' ? 'Ja' : 'Yes') : (lang === 'de' ? 'Nein' : 'No'), clear: () => setFilterDeposit('all') });
    if (groupBy !== 'none') badges.push({ id: 'grp', label: lang === 'de' ? 'Gruppe' : 'Group', val: grpLabels[groupBy] || groupBy, clear: () => setGroupBy('none') });
    
    if (sortBy !== 'created_at' || sortDir !== 'desc') {
        let label = sortBy.replace('_', ' ').toUpperCase();
        if (lang === 'de') {
          if (sortBy === 'bed_price') label = 'BETTPREIS';
          else if (sortBy === 'cost') label = 'GESAMTKOSTEN';
          else if (sortBy === 'name') label = 'HOTELNAME';
          else if (sortBy === 'free_beds') label = 'FREIE BETTEN';
          else if (sortBy === 'payment_due') label = 'FÄLLIGKEIT';
          else if (sortBy === 'total_paid') label = 'TOTAL BEZAHLT';
          else if (sortBy === 'updated_at') label = 'ZULETZT AKTUALISIERT';
          else if (sortBy === 'created_at') label = 'ZULETZT HINZUGEFÜGT';
        }
        badges.push({ id: 'srt', label: lang === 'de' ? 'Sortierung' : 'Sort', val: `${label} (${sortDir === 'asc' ? (lang === 'de' ? 'AUF' : 'ASC') : (lang === 'de' ? 'AB' : 'DESC')})`, clear: () => { setSortBy('created_at'); setSortDir('desc'); } });
    }
    return badges;
  }, [tlType, tlStart, tlEnd, fbType, filterPaid, filterDue, filterDeposit, groupBy, sortBy, sortDir, lang]);

  const btnActive = dk ? 'bg-teal-600 text-white border-transparent' : 'bg-white border-teal-600 text-teal-700 shadow-sm';
  const btnInactive = dk ? 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';
  const popupCls = cn('absolute z-[1000] mt-3 p-5 rounded-2xl border shadow-2xl w-[420px] text-sm animate-in fade-in slide-in-from-top-2 duration-200 right-0 lg:-right-10', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900');
  const popupHeader = "flex items-center justify-between mb-5";
  const popupTitle = "text-lg font-bold";
  const sectionTitle = "text-sm text-slate-400 mb-2";
  const segmentContainer = cn("flex p-1 rounded-xl", dk ? "bg-black/20" : "bg-slate-100");
  const segmentBtn = (active: boolean) => cn("flex-1 py-1.5 text-sm font-medium rounded-lg transition-all", active ? (dk ? "bg-teal-600 text-white shadow-sm" : "bg-white text-teal-700 shadow-sm") : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300");
  const actionPrimary = cn("px-5 py-2 rounded-lg font-bold transition-all", dk ? "bg-teal-600 text-white hover:bg-teal-500" : "bg-teal-700 text-white hover:bg-teal-800");
  const actionSecondary = "text-teal-600 dark:text-teal-400 text-sm font-medium hover:underline";

  return (
    <div className={cn('flex h-screen overflow-hidden', dk ? 'bg-[#0F172A]' : 'bg-slate-50')}>
      
      <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden relative", isStrictViewer ? "pt-4" : "")}>
        {/* MEGA-ROW: APP HEADER + STATS */}
       <div className={cn("flex items-center w-full border-b shrink-0 h-[64px] pl-6 pr-2 transition-colors", isAnyModalOpen ? "z-0" : "z-[60] hover:z-[999999] focus-within:z-[999999]", dk ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
       
        {/* Stats Block (Icons only, pushed to absolute far left) */}
           <div className="flex items-center gap-8 shrink-0">
             
             {/* Freie Betten */}
             <button 
               onClick={() => setFbType(prev => prev === 'today' ? 'all' : 'today')}
               className="flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80 outline-none" 
               title={lang === 'de' ? 'Nur Hotels mit freien Betten anzeigen' : 'Show only hotels with free beds'}
             >
               <Bed size={22} className={fbType === 'today' ? "text-red-500" : (dk ? "text-slate-500" : "text-slate-400")} strokeWidth={2.5} />
               <span className={cn('text-[22px] font-black leading-none mt-0.5', freeBedsTotal > 0 ? 'text-red-500' : 'text-slate-400')}>{freeBedsTotal}</span>
             </button>

             {/* Hotels */}
             <div className="flex items-center gap-2.5" title="Hotels">
               <Building size={20} className={dk ? "text-slate-500" : "text-slate-400"} strokeWidth={2.5} />
               <span className={cn('text-[22px] font-black leading-none mt-0.5', dk ? 'text-white' : 'text-slate-900')}>{finalFiltered.length}</span>
             </div>

                           {/* Kosten (Clickable Icon + Number to toggle financials) */}
             <button 
                onClick={() => setShowGlobalFinancials(!showGlobalFinancials)} 
                className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80 outline-none" 
                title={lang === 'de' ? 'Gesamtkosten (Klicken für Details)' : 'Total Spent (Click for Details)'}
             >
                <Coins 
                  size={22} 
                  className={cn("transition-colors duration-200", showGlobalFinancials ? "text-teal-500" : (dk ? "text-slate-500" : "text-slate-400"))} 
                  strokeWidth={2.5} 
                />
                <span className="text-[22px] font-black text-teal-600 dark:text-teal-400 leading-none mt-0.5">
                  {formatCurrency(totalSpend)}
                </span>
             </button>


             
             {/* Expanded Financials safely tucked next to total */}
             {showGlobalFinancials && (
                <div className={cn("flex flex-col justify-center h-8 pl-4 ml-2 border-l animate-in fade-in slide-in-from-left-2", dk ? "border-white/10" : "border-slate-200")}>
                    <span className="text-emerald-500 text-[11.5px] font-bold leading-tight">{formatCurrency(totalPaidGlobal)}</span>
                    <span className="text-red-500 text-[11.5px] font-bold leading-tight">{formatCurrency(totalUnpaidGlobal)}</span>
                </div>
             )}
           </div>

           {/* Divider */}
           <div className={cn("w-px h-8 mx-6 shrink-0", dk ? "bg-white/10" : "bg-slate-200")} />

           {/* 3. Search & Icons (Header Component) */}
           <div className="flex-1 min-w-0 h-full">
           <Header 
               theme={theme} lang={lang} toggleTheme={toggleTheme} setLang={setLang} 
               viewMode={viewMode} setViewMode={setViewMode}
               searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
               searchScope={searchScope} setSearchScope={setSearchScope} 
               onSignOut={onSignOut} onPrint={() => setShowStudio(true)}
               viewOnly={isStrictViewer} userRole={accessLevel?.role ?? 'viewer'} 
               offlineMode={offlineMode} onToggleOfflineMode={onToggleOfflineMode} isOnline={isOnline} 
            >
              {/* Live Dabei passed as children so it anchors right next to Icons */}
              {activeUsers.length > 0 && (
                <div className={cn("flex items-center gap-2 mr-2 border-r pr-4 isolate relative z-[999999]", dk ? "border-white/10" : "border-slate-200")}>
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-50 hidden xl:block">{lang === 'de' ? 'Live:' : 'Live:'}</span>
                  <div className="flex -space-x-2">
                    {activeUsers.map((u: any, i: number) => (
                      <div key={i} className="relative group cursor-pointer">
                        <div className={cn("w-7 h-7 rounded-full border-2 flex items-center justify-center text-white text-[10px] font-bold shadow-sm z-10 relative", dk ? "bg-teal-600 border-[#0F172A]" : "bg-teal-600 border-white")}>{u.name.substring(0, 2).toUpperCase()}</div>
                        {/* FIX: Handled extreme depth layer layering via z-[999999] explicitly on the popup box */}
                        <div className="absolute top-full right-0 mt-2 w-max px-3 py-2 bg-slate-800 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-[999999] pointer-events-none shadow-xl">
                          {u.name} <br/> <span className="text-slate-400 text-[10px]">{u.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Header>
        </div>
      </div>

        {/* BULK ACTIONS & OFFLINE ALERTS */}
        {selectedIds.size > 0 && (
          <div className={cn("sticky top-0 w-full border-b flex items-center justify-between px-8 py-3 animate-in slide-in-from-top duration-300", isAnyModalOpen ? "z-0" : "z-[1000]", dk ? "bg-[#1E293B]/95 border-teal-500/30 text-white backdrop-blur-md" : "bg-teal-600 border-teal-700 text-white shadow-lg")}>
         <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="w-5 h-5 rounded border-white/20 accent-white cursor-pointer" />
                <span className="font-black text-sm uppercase tracking-widest">{selectedIds.size} {lang === 'de' ? 'Ausgewählt' : 'Selected'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleBulkDuplicate} className="p-2.5 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 font-bold text-sm"><Copy size={18} /> {lang === 'de' ? 'Duplizieren' : 'Duplicate'}</button>
              <button onClick={handleBulkDelete} className="p-2.5 rounded-xl hover:bg-red-500 bg-red-500/20 transition-all flex items-center gap-2 font-bold text-sm"><Trash2 size={18} /> {lang === 'de' ? 'Löschen' : 'Delete'}</button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-4 p-2 hover:bg-white/10 rounded-full transition-all"><X size={20} /></button>
            </div>
          </div>
        )}
        {(!isOnline || offlineMode) && (
          <div className="bg-amber-500 border-b border-amber-600 text-white px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 z-[1000] relative">
            <CloudOff size={16} strokeWidth={2.5} /> {lang === 'de' ? 'Offline Modus Aktiv' : 'Offline Mode Active'}
          </div>
        )}

        {error && (
           <div className="bg-red-500 text-white px-6 py-2 text-sm font-bold flex items-center justify-center gap-2 z-[60] relative">
             Error: {error}
             <button onClick={() => setError('')} className="ml-4 underline hover:text-red-200">Dismiss</button>
           </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
             <Loader2 size={48} className="animate-spin text-teal-500 opacity-50" />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto px-8 pb-64 relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            
            {/* STICKY CONTROL STACK */}
            <div 
              className={cn("sticky top-0 pt-4 pb-3 -mx-8 px-8 mb-4 border-b-2 shadow-sm", dk ? "bg-[#0F172A]/95 border-white/10 backdrop-blur-md" : "bg-slate-50/95 border-slate-300 backdrop-blur-md")}
              style={{ zIndex: isAnyModalOpen ? 0 : (showYearMenu || showMonthMenu || showFilterMenu || showTimelineMenu || showSortMenu) ? 999999 : 1000 }}
            ><div className="flex items-center justify-between mb-4 gap-4 flex-wrap relative" style={{ zIndex: isAnyModalOpen ? 0 : 999998 }}>
              <h2 className="text-xl font-black tracking-tight">{displayTitle}</h2>
              
              <div className="flex items-center gap-2">
                
                {/* MODERN YEAR SELECTOR */}
<div className="relative" ref={yearMenuRef}>
  <button 
    onClick={() => { 
      setShowYearMenu(!showYearMenu); 
      setShowMonthMenu(false); 
    }} 
    className={cn("px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all shadow-sm", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}
  >
    {selectedYear} <ChevronDown size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} />
  </button>
  {showYearMenu && (
    <div className={cn(popupCls, "w-[200px] p-3")} onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={() => setYearOffset(prev => prev - 10)} 
        className="w-full py-1.5 mb-2 rounded border border-dashed text-xs font-bold text-slate-500 hover:text-teal-500 flex items-center justify-center gap-1"
      >
        <ChevronUp size={12}/> 10 {lang === 'de' ? 'Jahre' : 'Years'}
      </button>
      <div className="grid grid-cols-2 gap-1">
        {Array.from({ length: 10 }, (_, i) => selectedYear + yearOffset - 4 + i).map(y => (
          <button 
            key={y} 
            onClick={() => { 
              setSelectedYear(y); 
              setShowYearMenu(false); 
              setYearOffset(0); 
            }} 
            className={cn("py-2 rounded-lg text-sm font-bold transition-all", selectedYear === y ? btnActive : btnInactive)}
          >
            {y}
          </button>
        ))}
      </div>
      <button 
        onClick={() => setYearOffset(prev => prev + 10)} 
        className="w-full py-1.5 mt-2 rounded border border-dashed text-xs font-bold text-slate-500 hover:text-teal-500 flex items-center justify-center gap-1"
      >
        10 {lang === 'de' ? 'Jahre' : 'Years'} <ChevronDown size={12}/>
      </button>
    </div>
  )}
</div>

{/* MODERN MONTH SELECTOR (3x4 Grid) */}
<div className="relative" ref={monthMenuRef}>
  <button 
    onClick={() => { 
      setShowMonthMenu(!showMonthMenu); 
      setShowYearMenu(false); 
    }} 
    className={cn("px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all shadow-sm", dk ? "bg-[#1E293B] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}
  >
    {selectedMonth === null 
      ? (lang === 'de' ? 'Alle Monate' : 'All Months') 
      : (lang === 'de' ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][selectedMonth] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][selectedMonth])
    } <ChevronDown size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} />
  </button>
  {showMonthMenu && (
    <div className={cn(popupCls, "w-[220px] p-2")} onClick={(e) => e.stopPropagation()}>
       <div className="flex flex-col gap-1">
         <button 
            onClick={() => { setSelectedMonth(null); setShowMonthMenu(false); }} 
            className={cn("w-full text-center px-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", selectedMonth === null ? (dk ? "bg-teal-500/20 text-teal-400" : "bg-teal-50 text-teal-600") : (dk ? "bg-white/5 text-slate-300 hover:bg-white/10" : "bg-slate-100 text-slate-700 hover:bg-slate-200"))}
         >
            {lang === 'de' ? 'Alle Monate' : 'All Months'}
         </button>
         <div className="grid grid-cols-3 gap-1 mt-1">
           {(lang === 'de' ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']).map((m, i) => (
             <button 
                key={i} 
                onClick={() => { setSelectedMonth(i); setShowMonthMenu(false); }} 
                className={cn("w-full text-center py-2.5 rounded-xl text-[11px] font-black uppercase transition-all border", selectedMonth === i ? (dk ? "bg-teal-500/20 border-teal-500/30 text-teal-400 shadow-inner" : "bg-teal-50 border-teal-200 text-teal-600 shadow-inner") : (dk ? "border-transparent bg-transparent text-slate-400 hover:bg-white/5 hover:text-white" : "border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"))}
             >
                {m}
             </button>
           ))}
         </div>
       </div>
    </div>
  )}
</div>



                {/* TIMELINE */}
                <div className="relative">
                  <button onClick={() => { closeMenu(); setShowTimelineMenu(!showTimelineMenu); setShowYearMenu(false); setShowMonthMenu(false); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", tlType !== 'all' ? btnActive : btnInactive)}><Calendar size={16} /> {lang === 'de' ? 'Zeitraum' : 'Timeline'}</button>
                  {showTimelineMenu && (
                    <div className={cn(popupCls, 'right-0 w-[400px]')}>
                      <div className={popupHeader}>
                        <h3 className={popupTitle}>{lang === 'de' ? 'Zeitraum' : 'Timeline Card (Stay Overlap)'}</h3>
                        <button onClick={closeMenu} className="text-slate-400 hover:text-white"><X size={20}/></button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[
                          { id: 'today', lEn: 'Today', lDe: 'Heute', off: 0 }, 
                          { id: 'tomorrow', lEn: 'Tomorrow', lDe: 'Morgen', off: 1 },
                          { id: '3days', lEn: '3 Days', lDe: '3 Tage', off: 3 }, 
                          { id: '7days', lEn: '7 Days', lDe: '7 Tage', off: 7 }
                        ].map(t => (
                          <button key={t.id} onClick={() => {
                            const s = new Date(); if (t.off > 0 && t.id !== '3days' && t.id !== '7days') s.setDate(s.getDate() + t.off);
                            const e = new Date(); e.setDate(e.getDate() + t.off);
                            setTlStart(s.toISOString().split('T')[0]); setTlEnd(e.toISOString().split('T')[0]); setTlType(t.id as any);
                          }} className={cn("py-2 rounded-lg text-xs font-medium border transition-all", tlType === t.id ? btnActive : btnInactive)}>
                            {lang === 'de' ? t.lDe : t.lEn}
                          </button>
                        ))}
                      </div>
                      <div className={cn("p-4 rounded-xl border mb-4", dk ? "bg-black/20 border-white/5" : "bg-slate-50 border-slate-200")}>
                        <div className="flex items-center gap-3">
                           <div className={cn("relative flex-1 h-[38px] rounded-lg border transition-all focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 overflow-hidden", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                              <div className={cn("absolute inset-0 flex items-center px-3 text-sm font-medium pointer-events-none", dk ? "text-white" : "text-slate-900")}>
                                 {tlStart ? tlStart.split('-').reverse().join('.') : <span className="opacity-40">{lang === 'de' ? 'TT.MM.JJJJ' : 'DD.MM.YYYY'}</span>}
                              </div>
                              <input type="date" value={tlStart} onClick={(e: any) => e.target.showPicker && e.target.showPicker()} onChange={e => {setTlStart(e.target.value); setTlType('range');}} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                           </div>
                           <span className="text-slate-400">➔</span>
                           <div className={cn("relative flex-1 h-[38px] rounded-lg border transition-all focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 overflow-hidden", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                              <div className={cn("absolute inset-0 flex items-center px-3 text-sm font-medium pointer-events-none", dk ? "text-white" : "text-slate-900")}>
                                 {tlEnd ? tlEnd.split('-').reverse().join('.') : <span className="opacity-40">{lang === 'de' ? 'TT.MM.JJJJ' : 'DD.MM.YYYY'}</span>}
                              </div>
                              <input type="date" min={tlStart} value={tlEnd} onClick={(e: any) => e.target.showPicker && e.target.showPicker()} onChange={e => {if(tlStart && e.target.value < tlStart) return; setTlEnd(e.target.value); setTlType('range');}} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                           </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-6">{lang === 'de' ? 'Blendet alle Hotels ohne Buchungen im gewählten Zeitraum aus.' : 'Hides any hotel that has zero bookings/durations overlapping your chosen range.'}</p>
                      <div className="flex justify-center border-t border-slate-200 dark:border-white/10 pt-4">
                        <button onClick={() => {setTlType('all'); setTlStart(''); setTlEnd(''); closeMenu();}} className={cn("w-full py-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium", dk ? "border-teal-600 text-teal-500 hover:bg-teal-600/10" : "border-teal-600 text-teal-700 hover:bg-teal-50")}>
                          <Trash2 size={16}/> {lang === 'de' ? 'Zeitraum zurücksetzen' : 'Clear Timeline'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* FILTER */}
                <div className="relative">
                  <button onClick={() => { setShowTimelineMenu(false); setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); setShowYearMenu(false); setShowMonthMenu(false); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", (fbType !== 'all' || filterPaid !== 'all' || filterDue !== 'all' || filterDeposit !== 'all' || groupBy !== 'none') ? btnActive : btnInactive)}><Filter size={16} /> Filter</button>
                  {showFilterMenu && (
                    <div className={popupCls}>
                      <div className={popupHeader}>
                        <h3 className={popupTitle}>Filter</h3>
                        <button onClick={closeMenu} className="text-slate-400"><X size={20}/></button>
                      </div>
                      <div className="space-y-5">
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Verfügbare freie Betten' : 'Free Beds Availability'}</p>
                           <div className="grid grid-cols-2 gap-2 mb-2">
                             {[ { id: 'today', lEn: `Today (${fbCountToday})`, lDe: `Heute (${fbCountToday})` }, { id: 'tomorrow', lEn: `Tomorrow (${fbCountTomorrow})`, lDe: `Morgen (${fbCountTomorrow})` }, { id: '3days', lEn: `in 3 days (${fbCount3})`, lDe: `in 3 Tagen (${fbCount3})` }, { id: '7days', lEn: `in 7 days (${fbCount7})`, lDe: `in 7 Tagen (${fbCount7})` }
                             ].map(f => <button key={f.id} onClick={() => setFbType(f.id as any)} className={cn("py-2 rounded-lg text-sm font-medium transition-all border", fbType === f.id ? btnActive : btnInactive)}>{lang === 'de' ? f.lDe : f.lEn}</button>)}
                           </div>
                         </div>
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Zahlung' : 'Payment'}</p>
                           <div className={segmentContainer}>
                             {[{id:'all', lEn:'All', lDe:'Alle'}, {id:'paid', lEn:'Paid', lDe:'Bezahlt'}, {id:'unpaid', lEn:'Unpaid', lDe:'Unbezahlt'}].map(p => (
                               <button key={p.id} onClick={() => setFilterPaid(p.id as any)} className={segmentBtn(filterPaid === p.id)}>{lang === 'de' ? p.lDe : p.lEn}</button>
                             ))}
                           </div>
                         </div>
                         {/* NEW: PAYMENT DUE */}
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Fälligkeit' : 'Payment Due'}</p>
                           <div className={segmentContainer}>
                             {[{id:'all', lEn:'All', lDe:'Alle'}, {id:'today', lEn:'Today', lDe:'Heute'}, {id:'3days', lEn:'In 3 Days', lDe:'In 3 Tagen'}, {id:'5days', lEn:'In 5 Days', lDe:'In 5 Tagen'}].map(p => (
                               <button key={p.id} onClick={() => setFilterDue(p.id as any)} className={segmentBtn(filterDue === p.id)}>{lang === 'de' ? p.lDe : p.lEn}</button>
                             ))}
                           </div>
                         </div>
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Kaution' : 'Deposit'}</p>
                           <div className={segmentContainer}>
                             {[{id:'all', lEn:'All', lDe:'Alle'}, {id:'yes', lEn:'Yes', lDe:'Ja'}, {id:'no', lEn:'No', lDe:'Nein'}].map(d => (
                               <button key={d.id} onClick={() => setFilterDeposit(d.id as any)} className={segmentBtn(filterDeposit === d.id)}>{lang === 'de' ? d.lDe : d.lEn}</button>
                             ))}
                           </div>
                         </div>
                         <div>
                           <p className={sectionTitle}>{lang === 'de' ? 'Gruppieren nach' : 'Group by'}</p>
                           <div className={segmentContainer}>
                             {[{id:'none', lEn:'None', lDe:'Keine'}, {id:'hotel', lEn:'Hotel', lDe:'Hotel'}, {id:'company', lEn:'Company', lDe:'Firma'}, {id:'city', lEn:'City', lDe:'Stadt'}].map(g => (
                               <button key={g.id} onClick={() => setGroupBy(g.id as any)} className={segmentBtn(groupBy === g.id)}>{lang === 'de' ? g.lDe : g.lEn}</button>
                             ))}
                           </div>
                         </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 mt-6 pt-4">
                        <button onClick={() => { setFilterPaid('all'); setFilterDue('all'); setFilterDeposit('all'); setGroupBy('none'); setFbType('all'); }} className={actionSecondary}>{lang === 'de' ? 'Alle Filter löschen' : 'Clear All filters'}</button>
                        <button onClick={closeMenu} className={actionPrimary}>{lang === 'de' ? 'Filter anwenden' : 'Apply Filters'}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SORT */}
                <div className="relative">
                  <button onClick={() => { setShowTimelineMenu(false); setShowFilterMenu(false); setShowSortMenu(!showSortMenu); setShowYearMenu(false); setShowMonthMenu(false); }} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", (sortBy !== 'created_at' || sortDir !== 'desc') ? btnActive : btnInactive)}><ArrowUpDown size={16} /> {lang === 'de' ? 'Sortieren' : 'Sort'}</button>
                  {showSortMenu && (
                    <div className={cn(popupCls, 'w-[420px]')}>
                      <div className={popupHeader}>
                        <h3 className={popupTitle}>{lang === 'de' ? 'Sortieren' : 'Sort'}</h3>
                        <button onClick={closeMenu} className="text-slate-400"><X size={20}/></button>
                      </div>
                      <p className={sectionTitle}>{lang === 'de' ? 'Sortieren nach' : 'Sort By'}</p>
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {[ { id: 'name', lEn: 'Hotel Name', lDe: 'Hotelname' }, { id: 'cost', lEn: 'Total Cost', lDe: 'Gesamtkosten' }, { id: 'bed_price', lEn: 'Price/Bed', lDe: 'Preis/Bett' }, { id: 'free_beds', lEn: 'Free Beds', lDe: 'Freie Betten' }, { id: 'payment_due', lEn: 'Payment Due', lDe: 'Fälligkeit' }, { id: 'total_paid', lEn: 'Total Paid', lDe: 'Total Bezahlt' }, { id: 'created_at', lEn: 'Last Added', lDe: 'Zuletzt Hinzugefügt' }, { id: 'updated_at', lEn: 'Last Updated', lDe: 'Zuletzt Aktualisiert' }
                        ].map(s => (
                          <button key={s.id} onClick={() => setSortBy(s.id as any)} className={cn("py-3 rounded-lg text-sm font-medium border transition-all", sortBy === s.id ? btnActive : btnInactive)}>
                            {lang === 'de' ? s.lDe : s.lEn}
                          </button>
                        ))}
                      </div>
                      <p className={sectionTitle}>{lang === 'de' ? 'Sortierreihenfolge' : 'Sort Direction'}</p>
                      
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <button onClick={() => setSortDir('asc')} className={cn("py-3 px-4 rounded-lg border text-left transition-all", sortDir === 'asc' ? btnActive : btnInactive)}>
                          <span className="block text-sm font-bold"> {lang === 'de' ? 'Aufsteigend' : 'Ascending'} <ArrowDownNarrowWide size={16} className="inline mr-1"/> </span>
                          <span className={cn("block text-[10px] mt-1 font-normal", sortDir === 'asc' ? 'opacity-90' : 'opacity-50')}>
                            {lang === 'de' ? 'Low to High, A-Z, Günstigste' : 'Low to High, A-Z, Oldest'}
                          </span>
                        </button>
                        <button onClick={() => setSortDir('desc')} className={cn("py-3 px-4 rounded-lg border text-left transition-all", sortDir === 'desc' ? btnActive : btnInactive)}>
                          <span className="block text-sm font-bold">{lang === 'de' ? 'Absteigend' : 'Descending'} <ArrowDownWideNarrow size={16} className="inline mr-1"/> </span>
                          <span className={cn("block text-[10px] mt-1 font-normal", sortDir === 'desc' ? 'opacity-90' : 'opacity-50')}>
                            {lang === 'de' ? 'High to Low, Z-A, Neueste' : 'High to Low, Z-A, Newest'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-4">
                        <button onClick={() => { setSortBy('created_at'); setSortDir('desc'); }} className={actionSecondary}>{lang === 'de' ? 'Sortierung zurücksetzen' : 'Reset Sorting'}</button>
                        <button onClick={closeMenu} className={actionPrimary}>{lang === 'de' ? 'Sortierung anwenden' : 'Apply Sorting'}</button>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => setShowBookmarks(!showBookmarks)} className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", showBookmarks ? btnActive : btnInactive)}>
                  <Star size={16} className={showBookmarks ? 'fill-white' : ''} /> {lang === 'de' ? 'Lesezeichen' : 'Bookmarks'}
                </button>

                {/* EMPLOYEE STATUS FILTER */}
                <div className="relative" ref={empMenuRef}>
                  <button 
                    onClick={() => { closeMenu(); setShowEmpMenu(!showEmpMenu); }} 
                    className={cn("px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2", activeEmpFilters.length > 0 ? btnActive : btnInactive)}
                  >
                    <Users size={16} /> 
                  </button>
                  {showEmpMenu && (
                    <div className={cn(popupCls, 'w-[175px] p-3 right-0 lg:right-0')}>
                      <p className={sectionTitle}>{lang === 'de' ? 'Mitarbeiter Status' : 'Emp. Status'}</p>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: 'active', label: lang === 'de' ? 'Aktiv' : 'Active', color: 'bg-emerald-500' },
                          { id: 'upcoming', label: lang === 'de' ? 'Bevorstehend' : 'Upcoming', color: 'bg-blue-500' },
                          { id: 'ending-soon', label: lang === 'de' ? 'Endet bald' : 'Ending Soon', color: 'bg-red-500' },
                          { id: 'completed', label: lang === 'de' ? 'Abgeschlossen' : 'Completed', color: 'bg-slate-400' }
                        ].map(s => {
                          const isSelected = activeEmpFilters.includes(s.id);
                          return (
                            <button 
                              key={s.id} 
                              onClick={() => setActiveEmpFilters(prev => isSelected ? prev.filter(i => i !== s.id) : [...prev, s.id])} 
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all border", 
                                isSelected 
                                  ? (dk ? "bg-teal-500/20 border-teal-500/30 text-teal-400" : "bg-teal-50 border-teal-200 text-teal-700")
                                  : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                              )}
                            >
                              <div className={cn("w-3 h-3 rounded-full", s.color)} />
                              <span className={cn("text-sm font-bold", isSelected ? "" : (dk ? "text-slate-300" : "text-slate-700"))}>{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={() => setActiveEmpFilters([])} className="w-full mt-3 text-xs font-bold text-slate-400 hover:text-teal-500">{lang === 'de' ? 'Filter zurücksetzen' : 'Reset'}</button>
                    </div>
                  )}
                </div>
                
                {/* ACTION BUTTONS */}
                {!isStrictViewer && (
                  <div className="flex items-center gap-3 ml-4 border-l pl-4 dark:border-white/10 border-slate-200">
                      <button onClick={() => setAddingHotel(true)} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center gap-2 text-sm transition-all shadow-md active:scale-95">
                          <Plus size={18} strokeWidth={2.5} /> {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                      </button>
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVE FILTERS ROW */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6 animate-in fade-in duration-200">
                <span className="text-xs font-bold text-slate-500 mr-2">{lang === 'de' ? 'Aktive Filter:' : 'Active Filters:'}</span>
                {activeFilters.map(af => (
                  <span key={af.id} className={cn("px-3 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-bold border", dk ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : "bg-teal-50 border-teal-200 text-teal-700")}>
                    {af.label}: <span className="opacity-70 uppercase">{af.val}</span>
                    <button onClick={af.clear} className="hover:text-red-500 ml-1 transition-colors"><X size={12} strokeWidth={3} /></button>
                  </span>
                ))}
                <button onClick={() => { setTlType('all'); setFbType('all'); setFilterPaid('all'); setFilterDue('all'); setFilterDeposit('all'); setGroupBy('none'); setSortBy('created_at'); setSortDir('desc'); setShowBookmarks(false); setActiveEmpFilters([]); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white ml-2 transition-all hover:underline">
                {lang === 'de' ? 'Alle löschen' : 'Clear All'}
                </button>
              </div>
            )}

            {/* HORIZONTAL GROUP TABS */}
            {groupBy !== 'none' && groupData && viewMode !== 'stats' && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200 dark:border-white/10">
                {Object.keys(groupData).map(g => (
                  <button 
                    key={g} 
                    onClick={() => setActiveGroupTab(g === activeGroupTab ? null : g)} 
                    className={cn(
                      "px-5 py-2.5 rounded-t-xl text-sm font-bold border transition-all whitespace-nowrap", 
                      activeGroupTab === g ? "bg-teal-600 text-white border-teal-600" : "bg-white dark:bg-white/5 text-slate-500 border-transparent hover:bg-slate-100"
                    )}
                  >
                    {g} ({groupData[g].length})
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
                {/* ADD HOTEL FORM */}
                {addingHotel && !isStrictViewer && (
                  <div className={cn('rounded-2xl border p-5 shadow-xl mb-4 animate-in slide-in-from-top duration-300 relative z-[99999]', dk ? 'bg-[#1E293B] border-teal-500/30' : 'bg-white border-teal-500/30')}>
                    <div className="flex flex-wrap lg:flex-nowrap items-end gap-4 w-full">
                      
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block"><Building size={10} className="inline mr-1"/>{lang === 'de' ? 'Hotelname' : 'Hotel Name'}</label>
                        <input autoFocus list="hotel-suggestions" className={cn('w-full h-[38px] px-3 rounded-lg border outline-none text-sm font-bold transition-all focus:border-teal-500', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelName} onChange={e => setNewHotelName(e.target.value)} placeholder="Riveria..." />
                        <datalist id="hotel-suggestions">
                           {newHotelName.trim().length > 0 && uniqueHotelNames.map(n => <option key={n} value={n} />)}
                        </datalist>
                      </div>
                      
                      <div className="flex-[0.8] min-w-[140px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block"><MapPin size={10} className="inline mr-1"/> {lang === 'de' ? 'Stadt' : 'City'}</label>
                        <input list="city-suggestions" className={cn('w-full h-[38px] px-3 rounded-lg border outline-none text-sm font-bold transition-all focus:border-teal-500', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200')} value={newHotelCity} onChange={e => setNewHotelCity(e.target.value)} placeholder="Essen..." />
                        <datalist id="city-suggestions">
                           {newHotelCity.trim().length > 0 && uniqueCities.map(c => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                      
                     <div className="flex-1 min-w-[160px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block"><Building2 size={10} className="inline mr-1"/> {lang === 'de' ? 'Firma' : 'Company'}</label>
                        <div className={cn('w-full min-h-[38px] rounded-lg border px-2 flex items-center transition-all', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-slate-50 border-slate-200')}>
                          <CompanyMultiSelect selected={newHotelCompanyTags} options={allCompanyOptions} onChange={(v: string[]) => setNewHotelCompanyTags(v)} isDarkMode={dk} lang={lang} onDeleteOption={handleDeleteGlobalCompany} onRenameOption={handleRenameGlobalCompany} onAddOption={handleAddGlobalCompany} />
                        </div>
                      </div>

                      <div className="flex-[0.8] min-w-[120px]">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block"><Globe size={10} className="inline mr-1"/> {lang === 'de' ? 'Land' : 'Country'}</label>
                        <ModernDropdown value={newHotelCountry} options={getCountryOptions()} onChange={(v: string) => setNewHotelCountry(v)} isDarkMode={dk} lang={lang} />
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <button onClick={handleSaveNewHotel} disabled={newHotelSaving || !newHotelName.trim()} className="px-5 h-[38px] bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm disabled:opacity-50 font-bold">
                          {newHotelSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                        </button>
                        <button onClick={() => setAddingHotel(false)} className={cn("px-4 h-[38px] rounded-lg flex items-center justify-center transition-all border", dk ? "border-white/10 hover:bg-white/10 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600")}>
                          <X size={18} />
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              
            {/* DESKTOP HEADER ROW */}
                {!loading && finalFiltered.length > 0 && viewMode !== 'stats' && (
                  <div 
                    className={cn(
                      "hidden lg:flex items-center px-8 py-2.5 text-[10px] font-black uppercase tracking-widest",
                      dk ? "bg-white/5 text-slate-400" : "bg-slate-200/60 text-slate-500"
                    )} 
                    style={{ marginLeft: '-32px', marginRight: '-32px', marginBottom: '-12px' }}
                  >
                    <div className="w-14 shrink-0"></div>
                    <div className="w-[200px] shrink-0 pr-4">{lang === 'de' ? 'Hotel' : 'Hotel'}</div>
                    <div className="w-[140px] shrink-0 pr-6">{lang === 'de' ? 'Firma' : 'Company'}</div>
                    <div className="w-[380px] shrink-0 pr-6">{lang === 'de' ? 'Buchungen' : 'Bookings'}</div>
                    <div className="flex-1 min-w-[200px] pr-4">{lang === 'de' ? 'Mitarbeiter' : 'Employees'}</div>
                    <div className="w-16 shrink-0 text-right pr-4">{lang === 'de' ? 'Frei' : 'Free'}</div>
                    <div className="w-16 shrink-0 text-right pr-4">{lang === 'de' ? 'Betten' : 'Beds'}</div>
                    <div className="w-[120px] shrink-0 pr-4 text-right">{lang === 'de' ? 'Kosten' : 'Cost'}</div>
                    <div className="w-8 shrink-0"></div>
                  </div>
                )}
              </div>
            </div> {/* END OF STICKY CONTROL STACK */}

            {/* --- SAFELY INJECTED STATISTICS VIEW --- */}
            {viewMode === 'stats' && (
              <StatisticsDashboard 
                hotels={finalFiltered} 
                selectedYear={selectedYear} 
                selectedMonth={selectedMonth}
                groupBy={groupBy}
                parentSortBy={sortBy}         
                parentSortDir={sortDir}
                lang={lang} 
                dk={dk} 
              />
            )}

            {/* --- EXISTING: LIST VIEW --- */}
            <div style={{ display: viewMode === 'list' ? 'block' : 'none' }}>
            

              {/* THE DATA ROWS */}
            {groupBy !== 'none' && groupData ? (
              (activeGroupTab && groupData[activeGroupTab]) ? (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  
                  {/* GROUP TOTALS BLOCK */}

                  <div className={cn("px-6 py-4 rounded-xl border flex items-center justify-between mb-2", dk ? "bg-black/20 border-white/10" : "bg-white border-slate-200 shadow-sm")}>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{lang === 'de' ? 'Gruppe' : 'Group'}: {lang === 'de' && groupBy === 'company' ? 'Firma' : groupBy.toUpperCase()}</span>
                      <h3 className="text-xl font-bold">{activeGroupTab}</h3>
                      <span className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-600 text-xs font-bold">{groupData[activeGroupTab].length} Hotels</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{lang === 'de' ? 'Gesamtwert' : 'Total Value'}</p>
                      <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{formatCurrency(groupData[activeGroupTab].reduce((s,h)=>s+calcHotelTotalCost(h, selectedMonth !== null ? selectedMonth : null, selectedYear),0))}</p>
                    </div>
                  </div>

                  {/* Wrapping rows in gap-3 */}
                  <div className="flex flex-col gap-3">
                    {groupData[activeGroupTab].map((h, i) => (
                      <HotelRow 
                        key={h.id}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        isOpen={expandedHotelId === h.id}
                        isModalOpen={isAnyModalOpen}
                        setIsModalOpen={setIsAnyModalOpen}
                        onToggle={() => setExpandedHotelId(prev => prev === h.id ? null : h.id)}
                        showGlobalFinancials={showGlobalFinancials}
                        activeSort={sortBy}
                        activeFilterDue={filterDue}
                        activeFilterDeposit={filterDeposit}
                        isSelected={selectedIds.has(h.id)}
                        onSelect={() => toggleSelect(h.id)}
                        isBulkActive={selectedIds.size > 0}
                        entry={h} 
                        index={i} 
                        isDarkMode={dk} 
                        lang={lang} 
                        searchQuery={searchQuery} 
                        searchScope={searchScope} 
                        companyOptions={allCompanyOptions} 
                        cityOptions={uniqueCities} 
                        onDelete={hId => setHotels(prev => prev.filter(ho=>ho.id!==hId))} 
                        onUpdate={(hId, up) => setHotels(prev => prev.map(ho=>ho.id===hId?{...ho,...up}:ho))}
                        onDeleteCompanyOption={handleDeleteGlobalCompany} 
                        onRenameCompanyOption={handleRenameGlobalCompany}
                        onAddOption={handleAddGlobalCompany} 
                        hotelOptions={uniqueHotelNames}
                        employeeOptions={uniqueEmployeeNames}
                        isBookmarked={bookmarks.includes(h.id)} // For the second map use hotel.id instead of h.id
                        onToggleBookmark={() => toggleBookmark(h.id)} // For the second map use hotel.id instead of h.id
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 font-medium">
                  {lang === 'de' ? 'Wählen Sie einen Tab oben aus' : 'Select a tab above to view entries'}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-3">
                {finalFiltered.map((hotel, index) => (
                  <HotelRow 
                    key={hotel.id}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    isOpen={expandedHotelId === hotel.id}
                    isModalOpen={isAnyModalOpen}
                    setIsModalOpen={setIsAnyModalOpen}
                    onToggle={() => setExpandedHotelId(prev => prev === hotel.id ? null : hotel.id)}
                    showGlobalFinancials={showGlobalFinancials}
                    activeSort={sortBy}
                    activeFilterDue={filterDue}
                    activeFilterDeposit={filterDeposit}
                    isSelected={selectedIds.has(hotel.id)}
                    onSelect={() => toggleSelect(hotel.id)}
                    isBulkActive={selectedIds.size > 0}
                    entry={hotel} 
                    viewOnly={accessLevel?.role === 'viewer'} 
                    index={index} 
                    isDarkMode={dk} 
                    lang={lang} 
                    searchQuery={searchQuery} 
                    searchScope={searchScope} 
                    companyOptions={allCompanyOptions} 
                    cityOptions={uniqueCities} 
                    onDelete={hId => setHotels(hotels.filter(h=>h.id!==hId))} 
                    onUpdate={(hId, up) => setHotels(hotels.map(h=>h.id===hId?{...h,...up}:h))} 
                    onDeleteCompanyOption={handleDeleteGlobalCompany} 
                    onRenameCompanyOption={handleRenameGlobalCompany}
                    onAddOption={handleAddGlobalCompany} 
                    hotelOptions={uniqueHotelNames}
                    employeeOptions={uniqueEmployeeNames}
                    isBookmarked={bookmarks.includes(hotel.id)}
                    onToggleBookmark={() => toggleBookmark(hotel.id)}
                  />
                ))}
              </div>
            )}
            
            {!loading && finalFiltered.length === 0 && (
              <div className="text-center py-20 opacity-50 flex flex-col items-center">
                <Building size={48} className="mb-4 text-slate-400" />
                <p className="text-lg font-bold">{lang === 'de' ? 'Keine Hotels gefunden' : 'No hotels found'}</p>
                <p className="text-sm">{lang === 'de' ? 'Versuchen Sie, Ihre Filter anzupassen oder ein neues hinzuzufügen.' : 'Try adjusting your filters or adding a new one.'}</p>
              </div>
            )}
            </div>
          </main>
        )}

        {/* --- THE EXPORT STUDIO --- */}
        {showStudio && (
          <ExportStudio 
            hotels={finalFiltered} 
            calcCost={calcHotelTotalCost} 
            lang={lang} 
            total={totalSpend}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            title={selectedMonth !== null 
              ? `Period: ${lang === 'de' ? monthNamesDe[selectedMonth] : monthNamesEn[selectedMonth]} ${selectedYear}` 
              : `Period: ${selectedYear}`}
            onClose={() => setShowStudio(false)}
            dk={dk}
          />
        )}
      </div>
    </div>
  );
}
