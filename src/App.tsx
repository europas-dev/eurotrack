'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  UserPlus, 
  ExternalLink,
  Calendar,
  DollarSign,
  Bed,
  Edit2,
  Trash2,
  Check,
  X,
  Building2,
  Users,
  Clock,
  Phone,
  Mail,
  MapPin,
  Zap,
  ArrowRight,
  Search,
  Filter,
  ArrowUpDown,
  Share2,
  Globe,
  Bell,
  Settings,
  Moon,
  Sun,
  LogOut,
  User,
  Type,
  Palette,
  ChevronLeft,
  Download,
  Eye,
  Edit,
  LayoutDashboard,
  Euro,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type RoomType = 'EZ' | 'DZ' | 'TZ';
type ViewMode = 'dashboard' | 'month';
type Theme = 'dark' | 'light';
type SortBy = 'recent' | 'max-duration' | 'min-duration' | 'max-cost' | 'min-cost' | 'name';
type GroupBy = 'none' | 'company' | 'city';

interface Employee {
  id: string;
  name: string;
  checkIn: string;
  checkOut: string;
}

interface BookingDuration {
  id: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  pricePerNight: number;
  employees: (Employee | null)[];
  isPaid: boolean;
  extensionNote?: string;
}

interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  contact: string;
  email: string;
  webLink: string;
  companyTag: string;
  durations: BookingDuration[];
  createdAt: string;
}

interface Workspace {
  hotels: Hotel[];
}

interface Notification {
  id: string;
  type: 'checkout-soon' | 'gap-available' | 'error' | 'info';
  message: string;
  timestamp: string;
  read: boolean;
}

interface User {
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getRoomCapacity = (roomType: RoomType): number => {
  const capacities: Record<RoomType, number> = { 'EZ': 1, 'DZ': 2, 'TZ': 3 };
  return capacities[roomType];
};

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toInputDate = (isoDate: string): string => isoDate;
const fromInputDate = (inputDate: string): string => inputDate;

const getMonthDates = (year: number, month: number): { start: string; end: string } => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

const calculateTotalNights = (checkIn: string, checkOut: string): number => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const getEmployeeStatus = (checkIn: string, checkOut: string, currentDate: string): 
  'upcoming' | 'active' | 'ending-soon' | 'completed' => {
  const current = new Date(currentDate);
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  
  if (current < inDate) return 'upcoming';
  if (current > outDate) return 'completed';
  
  const daysUntilCheckout = Math.ceil((outDate.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilCheckout <= 3) return 'ending-soon';
  
  return 'active';
};

const hasGap = (employee: Employee, durationEndDate: string): boolean => {
  return new Date(employee.checkOut) < new Date(durationEndDate);
};

const generateDurationColor = (index: number): string => {
  const colors = [
    'border-blue-500',
    'border-purple-500',
    'border-pink-500',
    'border-green-500',
    'border-yellow-500',
    'border-red-500',
    'border-indigo-500',
    'border-cyan-500',
  ];
  return colors[index % colors.length];
};

const getCalendarMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];
  
  const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  for (let i = 0; i < adjustedStart; i++) {
    currentWeek.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }
  
  return weeks;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EuroTrackApp() {
  const [workspace, setWorkspace] = useState<Workspace>({ hotels: [] });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [currentDate] = useState(new Date().toISOString().split('T')[0]);
  
  // UI States
  const [expandedHotels, setExpandedHotels] = useState<Set<string>>(new Set());
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [showCalendar, setShowCalendar] = useState<Set<string>>(new Set());
  const [activeDuration, setActiveDuration] = useState<Record<string, string>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null);
  
  // Theme & Settings
  const [theme, setTheme] = useState<Theme>('dark');
  const [language, setLanguage] = useState<'en' | 'de'>('en');
  const [fontSize, setFontSize] = useState(14);
  const [user, setUser] = useState<User>({ 
    name: 'Admin User', 
    email: 'admin@eurotrack.com', 
    role: 'admin' 
  });
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  
  // Editing States
  const [editingHotel, setEditingHotel] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [addingHotel, setAddingHotel] = useState(false);
  const [addingDuration, setAddingDuration] = useState<string | null>(null);
  const [addingEmployee, setAddingEmployee] = useState<{ hotelId: string; durationId: string; slotIndex: number; isGapFill?: boolean; afterEmployeeId?: string } | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNamesDE = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  const months = language === 'de' ? monthNamesDE : monthNames;

  // Generate notifications
  useEffect(() => {
    const newNotifications: Notification[] = [];
    
    workspace.hotels.forEach(hotel => {
      hotel.durations.forEach(duration => {
        duration.employees.forEach(employee => {
          if (employee) {
            const status = getEmployeeStatus(employee.checkIn, employee.checkOut, currentDate);
            if (status === 'ending-soon') {
              newNotifications.push({
                id: `checkout-${employee.id}`,
                type: 'checkout-soon',
                message: `${employee.name} checking out in 3 days from ${hotel.name}`,
                timestamp: new Date().toISOString(),
                read: false
              });
            }
            
            if (hasGap(employee, duration.endDate)) {
              newNotifications.push({
                id: `gap-${employee.id}`,
                type: 'gap-available',
                message: `Gap available after ${employee.name} in ${hotel.name}`,
                timestamp: new Date().toISOString(),
                read: false
              });
            }
          }
        });
      });
    });
    
    setNotifications(newNotifications);
  }, [workspace, currentDate]);

  // ============================================================================
  // COMPUTED STATS
  // ============================================================================

  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;

    workspace.hotels.forEach(hotel => {
      hotel.durations.forEach(duration => {
        const capacity = getRoomCapacity(duration.roomType);
        const nights = calculateTotalNights(duration.startDate, duration.endDate);
        totalSpend += nights * duration.pricePerNight * capacity;

        duration.employees.forEach(employee => {
          if (employee) {
            const status = getEmployeeStatus(employee.checkIn, employee.checkOut, currentDate);
            if (status === 'active' || status === 'ending-soon') {
              occupiedBeds++;
            }
          }
        });

        const durationStart = new Date(duration.startDate);
        const durationEnd = new Date(duration.endDate);
        const current = new Date(currentDate);
        
        if (current >= durationStart && current <= durationEnd) {
          totalBeds += capacity;
        }
      });
    });

    return {
      totalSpend,
      freeBeds: totalBeds - occupiedBeds,
      totalHotels: workspace.hotels.length,
    };
  }, [workspace, currentDate]);

  const monthlyStats = useMemo(() => {
    const stats: Record<number, number> = {};
    
    for (let m = 0; m < 12; m++) {
      const { start: monthStart, end: monthEnd } = getMonthDates(selectedYear, m);
      let monthCost = 0;
      
      workspace.hotels.forEach(hotel => {
        hotel.durations.forEach(duration => {
          const capacity = getRoomCapacity(duration.roomType);
          const dStart = new Date(duration.startDate);
          const dEnd = new Date(duration.endDate);
          const mStart = new Date(monthStart);
          const mEnd = new Date(monthEnd);
          
          if (dStart <= mEnd && dEnd >= mStart) {
            const overlapStart = new Date(Math.max(dStart.getTime(), mStart.getTime()));
            const overlapEnd = new Date(Math.min(dEnd.getTime(), mEnd.getTime()));
            const nights = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            if (nights > 0) {
              monthCost += nights * duration.pricePerNight * capacity;
            }
          }
        });
      });
      
      stats[m] = monthCost;
    }
    
    return stats;
  }, [workspace, selectedYear]);

  const yearlyTotal = useMemo(() => {
    return Object.values(monthlyStats).reduce((sum, cost) => sum + cost, 0);
  }, [monthlyStats]);

  // ============================================================================
  // HOTEL STATS & FILTERING
  // ============================================================================

  const getHotelStats = (hotel: Hotel) => {
    let totalNights = 0;
    let totalCost = 0;
    let freeBeds = 0;
    const employeeTags = new Set<string>();
    const allDurations: string[] = [];

    hotel.durations.forEach(duration => {
      const nights = calculateTotalNights(duration.startDate, duration.endDate);
      const capacity = getRoomCapacity(duration.roomType);
      totalCost += nights * duration.pricePerNight * capacity;
      totalNights += nights;
      allDurations.push(`${formatDate(duration.startDate)} → ${formatDate(duration.endDate)} (${duration.roomType})`);
      
      let filledSlots = 0;
      duration.employees.forEach(employee => {
        if (employee) {
          filledSlots++;
          employeeTags.add(employee.name);
        }
      });

      freeBeds += capacity - filledSlots;
    });

    return {
      totalNights,
      totalCost,
      freeBeds,
      employeeTags: Array.from(employeeTags),
      allDurations,
    };
  };

  const filteredAndSortedHotels = useMemo(() => {
    let hotels = [...workspace.hotels];

    // Search
    if (searchQuery) {
      hotels = hotels.filter(hotel => 
        hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hotel.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hotel.companyTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hotel.durations.some(d => 
          d.employees.some(e => e?.name.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      );
    }

    // Sort
    hotels.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'max-duration':
          return getHotelStats(b).totalNights - getHotelStats(a).totalNights;
        case 'min-duration':
          return getHotelStats(a).totalNights - getHotelStats(b).totalNights;
        case 'max-cost':
          return getHotelStats(b).totalCost - getHotelStats(a).totalCost;
        case 'min-cost':
          return getHotelStats(a).totalCost - getHotelStats(b).totalCost;
        default:
          return 0;
      }
    });

    return hotels;
  }, [workspace.hotels, searchQuery, sortBy]);

  const groupedHotels = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'All', hotels: filteredAndSortedHotels }];
    }

    const groups: Record<string, Hotel[]> = {};
    filteredAndSortedHotels.forEach(hotel => {
      const key = groupBy === 'company' ? hotel.companyTag : hotel.city;
      if (!groups[key]) groups[key] = [];
      groups[key].push(hotel);
    });

    return Object.entries(groups).map(([key, hotels]) => ({ key, hotels }));
  }, [filteredAndSortedHotels, groupBy]);

  // ============================================================================
  // HANDLERS - HOTEL
  // ============================================================================

  const handleAddHotelRow = () => {
    setAddingHotel(true);
  };

  const handleSaveNewHotel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newHotel: Hotel = {
      id: `h${Date.now()}`,
      name: formData.get('name') as string,
      city: formData.get('city') as string,
      address: '',
      contact: '',
      email: '',
      webLink: '',
      companyTag: formData.get('companyTag') as string,
      durations: [],
      createdAt: new Date().toISOString(),
    };

    setWorkspace(prev => ({
      ...prev,
      hotels: [...prev.hotels, newHotel]
    }));

    setAddingHotel(false);
  };

  const handleUpdateHotel = (hotelId: string, field: string, value: string) => {
    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => 
        h.id === hotelId ? { ...h, [field]: value } : h
      )
    }));
  };

  const handleDeleteHotel = (hotelId: string) => {
    setDeleteConfirmOpen(hotelId);
  };

  const confirmDelete = () => {
    if (deleteConfirmOpen) {
      setWorkspace(prev => ({
        ...prev,
        hotels: prev.hotels.filter(h => h.id !== deleteConfirmOpen)
      }));
      setDeleteConfirmOpen(null);
    }
  };

  // ============================================================================
  // HANDLERS - DURATION
  // ============================================================================

  const handleAddDuration = (hotelId: string) => {
    setAddingDuration(hotelId);
  };

  const handleSaveNewDuration = (e: React.FormEvent<HTMLFormElement>, hotelId: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const roomType = formData.get('roomType') as RoomType;
    const capacity = getRoomCapacity(roomType);

    const newDuration: BookingDuration = {
      id: `d${Date.now()}`,
      startDate: fromInputDate(formData.get('startDate') as string),
      endDate: fromInputDate(formData.get('endDate') as string),
      roomType,
      pricePerNight: parseFloat(formData.get('pricePerNight') as string),
      employees: Array(capacity).fill(null),
      isPaid: false,
    };

    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => 
        h.id === hotelId 
          ? { ...h, durations: [...h.durations, newDuration] }
          : h
      )
    }));

    setActiveDuration(prev => ({ ...prev, [hotelId]: newDuration.id }));
    setAddingDuration(null);
  };

  const handleUpdateDuration = (hotelId: string, durationId: string, field: string, value: any) => {
    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id === hotelId) {
          return {
            ...h,
            durations: h.durations.map(d => {
              if (d.id === durationId) {
                const updated = { ...d, [field]: value };
                if (field === 'roomType') {
                  const newCapacity = getRoomCapacity(value as RoomType);
                  const currentEmployees = d.employees.slice(0, newCapacity);
                  while (currentEmployees.length < newCapacity) {
                    currentEmployees.push(null);
                  }
                  updated.employees = currentEmployees;
                }
                return updated;
              }
              return d;
            })
          };
        }
        return h;
      })
    }));
  };

  const handleApplyPriceToAllDurations = (hotelId: string, price: number) => {
    if (confirm(`Apply €${price}/night to all durations in this hotel?`)) {
      setWorkspace(prev => ({
        ...prev,
        hotels: prev.hotels.map(h => {
          if (h.id === hotelId) {
            return {
              ...h,
              durations: h.durations.map(d => ({ ...d, pricePerNight: price }))
            };
          }
          return h;
        })
      }));
    }
  };

  const handleDeleteDuration = (hotelId: string, durationId: string) => {
    if (confirm('All data will be lost. Do you really want to delete this duration?')) {
      setWorkspace(prev => ({
        ...prev,
        hotels: prev.hotels.map(h => 
          h.id === hotelId 
            ? { ...h, durations: h.durations.filter(d => d.id !== durationId) }
            : h
        )
      }));
    }
  };

  // ============================================================================
  // HANDLERS - EMPLOYEE
  // ============================================================================

  const handleAddEmployee = (hotelId: string, durationId: string, slotIndex: number, isGapFill: boolean = false, afterEmployeeId?: string) => {
    setAddingEmployee({ hotelId, durationId, slotIndex, isGapFill, afterEmployeeId });
  };

  const handleSaveNewEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addingEmployee) return;

    const formData = new FormData(e.currentTarget);

    const newEmployee: Employee = {
      id: `e${Date.now()}`,
      name: formData.get('name') as string,
      checkIn: fromInputDate(formData.get('checkIn') as string),
      checkOut: fromInputDate(formData.get('checkOut') as string),
    };

    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id === addingEmployee.hotelId) {
          return {
            ...h,
            durations: h.durations.map(d => {
              if (d.id === addingEmployee.durationId) {
                const newEmployees = [...d.employees];
                newEmployees[addingEmployee.slotIndex] = newEmployee;
                return { ...d, employees: newEmployees };
              }
              return d;
            })
          };
        }
        return h;
      })
    }));

    setAddingEmployee(null);
  };

  const handleFillGap = (hotelId: string, durationId: string, afterEmployee: Employee, slotIndex: number) => {
    const hotel = workspace.hotels.find(h => h.id === hotelId);
    const duration = hotel?.durations.find(d => d.id === durationId);
    
    if (!duration) return;

    const emptySlot = duration.employees.findIndex((e, idx) => e === null);
    
    if (emptySlot !== -1) {
      handleAddEmployee(hotelId, durationId, emptySlot, true, afterEmployee.id);
    } else {
      alert('No available slots in this duration to fill the gap.');
    }
  };

  const handleUpdateEmployee = (
    hotelId: string, 
    durationId: string, 
    slotIndex: number, 
    field: string, 
    value: string
  ) => {
    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id === hotelId) {
          return {
            ...h,
            durations: h.durations.map(d => {
              if (d.id === durationId) {
                const newEmployees = [...d.employees];
                if (newEmployees[slotIndex]) {
                  newEmployees[slotIndex] = {
                    ...newEmployees[slotIndex]!,
                    [field]: value
                  };
                }
                return { ...d, employees: newEmployees };
              }
              return d;
            })
          };
        }
        return h;
      })
    }));
  };

  const handleDeleteEmployee = (hotelId: string, durationId: string, slotIndex: number) => {
    if (confirm('All data will be lost. Do you really want to remove this employee?')) {
      setWorkspace(prev => ({
        ...prev,
        hotels: prev.hotels.map(h => {
          if (h.id === hotelId) {
            return {
              ...h,
              durations: h.durations.map(d => {
                if (d.id === durationId) {
                  const newEmployees = [...d.employees];
                  newEmployees[slotIndex] = null;
                  return { ...d, employees: newEmployees };
                }
                return d;
              })
            };
          }
          return h;
        })
      }));
    }
  };

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  const toggleHotel = (hotelId: string) => {
    setExpandedHotels(prev => {
      const next = new Set(prev);
      if (next.has(hotelId)) {
        next.delete(hotelId);
      } else {
        next.add(hotelId);
      }
      return next;
    });
  };

  const toggleContact = (hotelId: string) => {
    setExpandedContacts(prev => {
      const next = new Set(prev);
      if (next.has(hotelId)) {
        next.delete(hotelId);
      } else {
        next.add(hotelId);
      }
      return next;
    });
  };

  const toggleCalendar = (hotelId: string) => {
    setShowCalendar(prev => {
      const next = new Set(prev);
      if (next.has(hotelId)) {
        next.delete(hotelId);
      } else {
        next.add(hotelId);
      }
      return next;
    });
  };

  const setActiveTab = (hotelId: string, durationId: string) => {
    setActiveDuration(prev => ({ ...prev, [hotelId]: durationId }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      case 'ending-soon': return 'bg-orange-500';
      case 'completed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getDurationBorderColor = (hotelId: string, durationId: string): string => {
    const hotel = workspace.hotels.find(h => h.id === hotelId);
    if (!hotel) return 'border-gray-500';
    const index = hotel.durations.findIndex(d => d.id === durationId);
    return generateDurationColor(index);
  };

  // ============================================================================
  // CALENDAR VIEW
  // ============================================================================

  const renderCalendarView = (hotel: Hotel) => {
    const weeks = getCalendarMonth(selectedYear, selectedMonth);
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const isDayInDuration = (day: number | null, duration: BookingDuration): boolean => {
      if (!day) return false;
      const checkDate = new Date(selectedYear, selectedMonth, day);
      const startDate = new Date(duration.startDate);
      const endDate = new Date(duration.endDate);
      return checkDate >= startDate && checkDate <= endDate;
    };

    return (
      <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {language === 'de' ? 'Kalenderansicht' : 'Calendar View'} - {months[selectedMonth]} {selectedYear}
        </h4>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {weekDays.map(day => (
                  <th key={day} className="p-2 text-xs font-semibold text-gray-400 border border-gray-700">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIdx) => (
                <tr key={weekIdx}>
                  {week.map((day, dayIdx) => {
                    const activeDurations = hotel.durations.filter(d => isDayInDuration(day, d));
                    
                    return (
                      <td 
                        key={dayIdx} 
                        className={`border border-gray-700 p-1 h-20 align-top ${
                          day ? 'bg-gray-800' : 'bg-gray-900'
                        }`}
                      >
                        {day && (
                          <>
                            <div className="text-xs text-gray-400 mb-1">{day}</div>
                            <div className="space-y-1">
                              {activeDurations.map((duration) => {
                                const index = hotel.durations.indexOf(duration);
                                const colorClass = generateDurationColor(index).replace('border-', 'bg-');
                                return (
                                  <div
                                    key={duration.id}
                                    className={`text-xs px-1 py-0.5 rounded ${colorClass} bg-opacity-70 text-white font-semibold`}
                                    title={`${duration.roomType} - €${duration.pricePerNight}/night`}
                                  >
                                    €{duration.pricePerNight}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {hotel.durations.map((duration, index) => (
            <div key={duration.id} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-2 ${generateDurationColor(index)}`}></div>
              <span className="text-xs text-gray-300">
                {duration.roomType} - €{duration.pricePerNight}/night
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER COMPONENTS
  // ============================================================================

  const renderEmployeeSlot = (
    employee: Employee | null,
    duration: BookingDuration,
    slotIndex: number,
    hotelId: string
  ) => {
    const isEditing = editingEmployee === `${hotelId}-${duration.id}-${slotIndex}`;
    const isAdding = addingEmployee?.hotelId === hotelId && 
                     addingEmployee?.durationId === duration.id && 
                     addingEmployee?.slotIndex === slotIndex;

    const borderColor = getDurationBorderColor(hotelId, duration.id);

    if (isAdding) {
      const afterEmployee = addingEmployee.isGapFill 
        ? duration.employees.find(e => e?.id === addingEmployee.afterEmployeeId)
        : null;

      return (
        <form onSubmit={handleSaveNewEmployee} className="p-3 bg-gray-800 rounded border-2 border-green-500">
          {addingEmployee.isGapFill && afterEmployee && (
            <div className="mb-2 p-2 bg-yellow-600 bg-opacity-20 rounded border border-yellow-500">
              <p className="text-xs text-yellow-300">
                {language === 'de' ? 'Lücke ausfüllen nach' : 'Filling gap after'}: <strong>{afterEmployee.name}</strong>
              </p>
              <p className="text-xs text-yellow-300">
                {language === 'de' ? 'Verfügbar ab' : 'Available from'}: {formatDate(afterEmployee.checkOut)}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <input
              type="text"
              name="name"
              placeholder={language === 'de' ? 'Mitarbeitername' : 'Employee name'}
              required
              autoFocus
              className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">{language === 'de' ? 'Check-In' : 'Check-In'}</label>
                <input
                  type="date"
                  name="checkIn"
                  defaultValue={afterEmployee ? toInputDate(afterEmployee.checkOut) : toInputDate(duration.startDate)}
                  required
                  min={afterEmployee ? toInputDate(afterEmployee.checkOut) : toInputDate(duration.startDate)}
                  max={toInputDate(duration.endDate)}
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">{language === 'de' ? 'Check-Out' : 'Check-Out'}</label>
                <input
                  type="date"
                  name="checkOut"
                  defaultValue={toInputDate(duration.endDate)}
                  required
                  min={afterEmployee ? toInputDate(afterEmployee.checkOut) : toInputDate(duration.startDate)}
                  max={toInputDate(duration.endDate)}
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                <Check className="w-3 h-3 inline" /> {language === 'de' ? 'Speichern' : 'Save'}
              </button>
              <button 
                type="button" 
                onClick={() => setAddingEmployee(null)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </form>
      );
    }

    if (!employee) {
      return (
        <div
          className="flex items-center justify-center p-4 bg-gray-800 rounded border-2 border-dashed border-gray-600 hover:border-green-500 transition-all cursor-pointer min-h-[80px]"
          onClick={() => handleAddEmployee(hotelId, duration.id, slotIndex)}
        >
          <div className="text-center">
            <Plus className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <span className="text-xs text-gray-400">{language === 'de' ? 'Mitarbeiter hinzufügen' : 'Add Employee'}</span>
          </div>
        </div>
      );
    }

    const status = getEmployeeStatus(employee.checkIn, employee.checkOut, currentDate);
    const gap = hasGap(employee, duration.endDate);
    const nights = calculateTotalNights(employee.checkIn, employee.checkOut);

    if (isEditing) {
      return (
        <div className={`p-3 bg-gray-800 rounded border-2 ${borderColor}`}>
          <div className="space-y-2">
            <input
              type="text"
              value={employee.name}
              onChange={(e) => handleUpdateEmployee(hotelId, duration.id, slotIndex, 'name', e.target.value)}
              className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">Check-In</label>
                <input
                  type="date"
                  value={toInputDate(employee.checkIn)}
                  onChange={(e) => handleUpdateEmployee(hotelId, duration.id, slotIndex, 'checkIn', fromInputDate(e.target.value))}
                  min={toInputDate(duration.startDate)}
                  max={toInputDate(duration.endDate)}
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Check-Out</label>
                <input
                  type="date"
                  value={toInputDate(employee.checkOut)}
                  onChange={(e) => handleUpdateEmployee(hotelId, duration.id, slotIndex, 'checkOut', fromInputDate(e.target.value))}
                  min={toInputDate(duration.startDate)}
                  max={toInputDate(duration.endDate)}
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setEditingEmployee(null)}
                className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
              >
                <Check className="w-3 h-3 inline" /> {language === 'de' ? 'Fertig' : 'Done'}
              </button>
              <button 
                onClick={() => handleDeleteEmployee(hotelId, duration.id, slotIndex)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`p-3 rounded border-2 ${borderColor} bg-gray-800 bg-opacity-50 group relative`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white">{employee.name}</span>
            </div>
            
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(status)}`}>
              {status.replace('-', ' ').toUpperCase()}
            </div>
          </div>

          <button
            onClick={() => setEditingEmployee(`${hotelId}-${duration.id}-${slotIndex}`)}
            className="opacity-0 group-hover:opacity-100 p-1 bg-blue-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-all"
          >
            <Edit2 className="w-3 h-3 text-blue-400" />
          </button>
        </div>

        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(employee.checkIn)} → {formatDate(employee.checkOut)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{nights} {language === 'de' ? 'Nächte' : 'nights'}</span>
          </div>
        </div>

        {gap && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <p className="text-xs text-yellow-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                {language === 'de' ? 'Lücke' : 'Gap'}: {formatDate(employee.checkOut)} → {formatDate(duration.endDate)}
              </p>
              <button
                onClick={() => handleFillGap(hotelId, duration.id, employee, slotIndex)}
                className="p-1 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                title={language === 'de' ? 'Lücke ausfüllen' : 'Fill gap'}
              >
                <UserPlus className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDuration = (duration: BookingDuration, hotel: Hotel, index: number) => {
    const capacity = getRoomCapacity(duration.roomType);
    const slots = Array(capacity).fill(null).map((_, i) => duration.employees[i] || null);
    const nights = calculateTotalNights(duration.startDate, duration.endDate);
    const totalCost = nights * duration.pricePerNight * capacity;
    const isEditing = editingDuration === duration.id;

    return (
      <div key={duration.id} className="p-4 bg-gray-900 rounded-lg border border-gray-700">
        {/* Duration Card */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
          {isEditing ? (
            <div className="grid grid-cols-6 gap-3">
              <div>
                <label className="text-xs text-gray-400">{language === 'de' ? 'Buchungsbeginn' : 'Booking Start'}</label>
                <input
                  type="date"
                  value={toInputDate(duration.startDate)}
                  onChange={(e) => handleUpdateDuration(hotel.id, duration.id, 'startDate', fromInputDate(e.target.value))}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">{language === 'de' ? 'Buchungsende' : 'Booking End'}</label>
                <input
                  type="date"
                  value={toInputDate(duration.endDate)}
                  onChange={(e) => handleUpdateDuration(hotel.id, duration.id, 'endDate', fromInputDate(e.target.value))}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">{language === 'de' ? 'Zimmertyp' : 'Room Type'}</label>
                <select
                  value={duration.roomType}
                  onChange={(e) => handleUpdateDuration(hotel.id, duration.id, 'roomType', e.target.value)}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                >
                  <option value="EZ">EZ (1 bed)</option>
                  <option value="DZ">DZ (2 beds)</option>
                  <option value="TZ">TZ (3 beds)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">€/{language === 'de' ? 'Nacht' : 'Night'}</label>
                <input
                  type="number"
                  value={duration.pricePerNight}
                  onChange={(e) => handleUpdateDuration(hotel.id, duration.id, 'pricePerNight', parseFloat(e.target.value))}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">{language === 'de' ? 'Gesamtkosten' : 'Total Cost'}</label>
                <div className="px-2 py-1 text-sm font-bold text-green-400">
                  €{totalCost.toFixed(2)}
                </div>
              </div>
              <div className="flex gap-1 items-end">
                <button
                  onClick={() => setEditingDuration(null)}
                  className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                >
                  <Check className="w-3 h-3 inline" />
                </button>
                <button
                  onClick={() => handleDeleteDuration(hotel.id, duration.id)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between group">
              <div className="grid grid-cols-6 gap-4 flex-1">
                <div>
                  <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Buchungsbeginn' : 'Booking Start'}</div>
                  <div className="text-sm font-semibold text-white">{formatDate(duration.startDate)}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Buchungsende' : 'Booking End'}</div>
                  <div className="text-sm font-semibold text-white">{formatDate(duration.endDate)}</div>
                  {duration.isPaid && duration.extensionNote && (
                    <div className="mt-1 text-xs text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {duration.extensionNote}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Zimmertyp' : 'Room Type'}</div>
                  <div className="text-sm font-semibold text-white">{duration.roomType} ({capacity} beds)</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Nachtpreis' : 'Nightly Price'}</div>
                  <div className="text-sm font-semibold text-green-400">€{duration.pricePerNight}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Gesamtnächte' : 'Total Nights'}</div>
                  <div className="text-sm font-semibold text-white">{nights}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Dauerkosten' : 'Duration Cost'}</div>
                  <div className="text-sm font-bold text-green-400">€{totalCost.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                <button
                  onClick={() => handleApplyPriceToAllDurations(hotel.id, duration.pricePerNight)}
                  className="p-2 bg-purple-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors"
                  title={language === 'de' ? 'Preis auf alle Dauern anwenden' : 'Apply price to all durations'}
                >
                  <Zap className="w-4 h-4 text-purple-400" />
                </button>
                <button
                  onClick={() => setEditingDuration(duration.id)}
                  className="p-2 bg-blue-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Employee List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {slots.map((employee, idx) => (
            <div key={idx}>
              {renderEmployeeSlot(employee, duration, idx, hotel.id)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHotel = (hotel: Hotel, showAddButton: boolean = true) => {
    const isExpanded = expandedHotels.has(hotel.id);
    const isContactExpanded = expandedContacts.has(hotel.id);
    const isCalendarVisible = showCalendar.has(hotel.id);
    const stats = getHotelStats(hotel);
    const isEditing = editingHotel === hotel.id;

    const activeTab = activeDuration[hotel.id] || hotel.durations[0]?.id;
    const activeDurationData = hotel.durations.find(d => d.id === activeTab);

    const getEmployeeNamesWithColors = () => {
      return hotel.durations.flatMap((duration, durationIdx) => 
        duration.employees
          .filter(e => e !== null)
          .map(e => ({
            name: e!.name,
            color: getDurationBorderColor(hotel.id, duration.id)
          }))
      );
    };

    const employeesWithColors = getEmployeeNamesWithColors();

    return (
      <div key={hotel.id} className="mb-3 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden group">
        {/* Hotel Main Row */}
        {isEditing ? (
          <div className="p-4 bg-gray-850 border-b border-gray-700">
            <div className="grid grid-cols-6 gap-3">
              <input
                type="text"
                value={hotel.name}
                onChange={(e) => handleUpdateHotel(hotel.id, 'name', e.target.value)}
                placeholder="Hotel name"
                className="col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-semibold"
              />
              <input
                type="text"
                value={hotel.city}
                onChange={(e) => handleUpdateHotel(hotel.id, 'city', e.target.value)}
                placeholder="City"
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
              />
              <input
                type="text"
                value={hotel.companyTag}
                onChange={(e) => handleUpdateHotel(hotel.id, 'companyTag', e.target.value)}
                placeholder="Company"
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
              />
              <div className="col-span-2 flex gap-2">
                <button
                  onClick={() => setEditingHotel(null)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                >
                  <Check className="w-4 h-4 inline" /> {language === 'de' ? 'Fertig' : 'Done'}
                </button>
                <button
                  onClick={() => handleDeleteHotel(hotel.id)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 hover:bg-gray-750 transition-colors">
            <div className="grid grid-cols-7 gap-4 items-center">
              <div className="col-span-2 flex items-center gap-3">
                <button
                  onClick={() => toggleHotel(hotel.id)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                <div className="flex-1">
                  <div className="font-semibold text-white">{hotel.name}</div>
                  <div className="text-xs text-gray-400">{hotel.city}</div>
                </div>
              </div>

              <div>
                <span className="px-2 py-1 bg-purple-600 bg-opacity-30 rounded text-xs font-semibold text-purple-300">
                  {hotel.companyTag}
                </span>
              </div>

              <div>
                <div className="text-xs text-gray-400">{language === 'de' ? 'Dauern' : 'Durations'}</div>
                <div className="text-xs text-white font-medium">
                  {stats.allDurations.length > 0 ? `${stats.allDurations.length} ${language === 'de' ? 'Buchungen' : 'bookings'}` : language === 'de' ? 'Keine' : 'None'}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">{language === 'de' ? 'Gesamtnächte' : 'Total Nights'}</div>
                <div className="text-sm text-blue-400 font-semibold">{stats.totalNights}</div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">{language === 'de' ? 'Freie Betten / Mitarbeiter' : 'Free Beds / Employees'}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-sm text-green-400 font-semibold">{stats.freeBeds}</span>
                  <span className="text-xs text-gray-400">/</span>
                  {employeesWithColors.map((emp, idx) => (
                    <span 
                      key={idx}
                      className={`text-xs px-1.5 py-0.5 rounded border-2 ${emp.color} bg-gray-900 text-white`}
                    >
                      {emp.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400">{language === 'de' ? 'Gesamtkosten' : 'Total Cost'}</div>
                  <div className="text-sm text-green-400 font-bold">€{stats.totalCost.toFixed(2)}</div>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingHotel(hotel.id)}
                    className="p-2 bg-blue-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-all"
                  >
                    <Edit2 className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteHotel(hotel.id)}
                    className="p-2 bg-red-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subtle Add Button Below Row */}
        {showAddButton && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-1 bg-gray-850 border-t border-gray-700">
            <button
              onClick={handleAddHotelRow}
              className="text-gray-500 hover:text-green-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 bg-gray-850 border-t border-gray-700">
            {/* Contact Details */}
            <div className="mb-4">
              <button
                onClick={() => toggleContact(hotel.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-300">
                  {language === 'de' ? 'Kontaktdaten (Optional)' : 'Contact Details (Optional)'}
                </span>
                {isContactExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isContactExpanded && (
                <div className="mt-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <MapPin className="w-3 h-3" />
                        {language === 'de' ? 'Adresse' : 'Address'}
                      </label>
                      <input
                        type="text"
                        value={hotel.address}
                        onChange={(e) => handleUpdateHotel(hotel.id, 'address', e.target.value)}
                        placeholder={language === 'de' ? 'Straßenadresse' : 'Street address'}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Phone className="w-3 h-3" />
                        {language === 'de' ? 'Telefon' : 'Phone'}
                      </label>
                      <input
                        type="text"
                        value={hotel.contact}
                        onChange={(e) => handleUpdateHotel(hotel.id, 'contact', e.target.value)}
                        placeholder="+49 123 456 789"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Mail className="w-3 h-3" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={hotel.email}
                        onChange={(e) => handleUpdateHotel(hotel.id, 'email', e.target.value)}
                        placeholder="hotel@example.com"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <ExternalLink className="w-3 h-3" />
                        Website
                      </label>
                      <input
                        type="url"
                        value={hotel.webLink}
                        onChange={(e) => handleUpdateHotel(hotel.id, 'webLink', e.target.value)}
                        placeholder="https://hotel.com"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      />
                      {hotel.webLink && (
                        <a
                          href={hotel.webLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-flex items-center gap-1"
                        >
                          {language === 'de' ? 'Website öffnen' : 'Open website'} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Calendar View Toggle */}
            <div className="mb-4">
              <button
                onClick={() => toggleCalendar(hotel.id)}
                className="px-4 py-2 bg-blue-600 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-blue-400 text-sm flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {isCalendarVisible 
                  ? (language === 'de' ? 'Kalender ausblenden' : 'Hide Calendar') 
                  : (language === 'de' ? 'Kalender anzeigen' : 'Show Calendar')}
              </button>
            </div>

            {isCalendarVisible && renderCalendarView(hotel)}

            {/* Duration Tabs */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 border-b border-gray-700">
                {hotel.durations.map((duration, index) => (
                  <button
                    key={duration.id}
                    onClick={() => setActiveTab(hotel.id, duration.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
                      activeTab === duration.id
                        ? `bg-gray-800 border-b-2 ${getDurationBorderColor(hotel.id, duration.id)} font-semibold`
                        : 'bg-gray-900 hover:bg-gray-850'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full border-2 ${getDurationBorderColor(hotel.id, duration.id)}`}></div>
                    <span className="text-sm text-white">
                      {formatDate(duration.startDate)} - {formatDate(duration.endDate)} ({duration.roomType})
                    </span>
                  </button>
                ))}
                
                {addingDuration === hotel.id ? (
                  <form onSubmit={(e) => handleSaveNewDuration(e, hotel.id)} className="flex items-center gap-2 px-2">
                    <input
                      type="date"
                      name="startDate"
                      required
                      className="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                    />
                    <input
                      type="date"
                      name="endDate"
                      required
                      className="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                    />
                    <select
                      name="roomType"
                      required
                      className="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                    >
                      <option value="EZ">EZ</option>
                      <option value="DZ">DZ</option>
                      <option value="TZ">TZ</option>
                    </select>
                    <input
                      type="number"
                      name="pricePerNight"
                      placeholder="€/night"
                      required
                      min="0"
                      step="0.01"
                      className="w-24 px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                    />
                    <button type="submit" className="p-1 bg-green-600 hover:bg-green-700 rounded text-white">
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAddingDuration(null)}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => handleAddDuration(hotel.id)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-t-lg transition-colors text-white text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'de' ? 'Dauer hinzufügen' : 'Add Duration'}
                  </button>
                )}
              </div>
            </div>

            {/* Show Only Active Duration */}
            <div className="space-y-3">
              {activeDurationData ? (
                renderDuration(
                  activeDurationData, 
                  hotel, 
                  hotel.durations.indexOf(activeDurationData)
                )
              ) : (
                <div className="text-center py-8 bg-gray-900 rounded-lg border border-dashed border-gray-700">
                  <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">
                    {language === 'de' ? 'Noch keine Buchungsdauern' : 'No booking durations yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // SETTINGS PANEL
  // ============================================================================

  const SettingsPanel = () => (
    <div className={`fixed top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform z-30 ${
      settingsOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {language === 'de' ? 'Einstellungen' : 'Settings'}
          </h2>
          <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* User Info */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-white">{user.name}</div>
              <div className="text-sm text-gray-400">{user.email}</div>
              <div className="text-xs text-purple-400 mt-1 capitalize">{user.role}</div>
            </div>
          </div>
        </div>

        {/* Font Size */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Type className="w-4 h-4" />
            {language === 'de' ? 'Schriftgröße' : 'Font Size'}
          </label>
          <input
            type="range"
            min="12"
            max="18"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500 mt-1">{fontSize}px</div>
        </div>

        {/* Theme */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Palette className="w-4 h-4" />
            {language === 'de' ? 'Thema' : 'Theme'}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 px-3 py-2 rounded flex items-center justify-center gap-2 ${
                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Moon className="w-4 h-4" />
              {language === 'de' ? 'Dunkel' : 'Dark'}
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 px-3 py-2 rounded flex items-center justify-center gap-2 ${
                theme === 'light' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Sun className="w-4 h-4" />
              {language === 'de' ? 'Hell' : 'Light'}
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Globe className="w-4 h-4" />
            {language === 'de' ? 'Sprache' : 'Language'}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* Sign Out */}
        <button
          onClick={() => alert('Sign out clicked')}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          {language === 'de' ? 'Abmelden' : 'Sign Out'}
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // SHARE MODAL
  // ============================================================================

  const ShareModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            {language === 'de' ? 'Teilen & Berechtigungen' : 'Share & Permissions'}
          </h2>
          <button onClick={() => setShareModalOpen(false)} className="p-2 hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              {language === 'de' ? 'Benutzer einladen' : 'Invite User'}
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
              />
              <select className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white">
                <option value="viewer">{language === 'de' ? 'Betrachter' : 'Viewer'}</option>
                <option value="editor">{language === 'de' ? 'Bearbeiter' : 'Editor'}</option>
              </select>
            </div>
          </div>

          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold">
            {language === 'de' ? 'Einladung senden' : 'Send Invite'}
          </button>

          <div className="pt-4 border-t border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded" />
              <span className="text-sm text-gray-300">
                {language === 'de' ? 'Öffentliche Ansicht erstellen' : 'Create public view'}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // NOTIFICATIONS PANEL
  // ============================================================================

  const NotificationsPanel = () => (
    <div className={`absolute top-full right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl z-30 ${
      notificationsOpen ? 'block' : 'hidden'
    }`}>
      <div className="p-4 border-b border-gray-800">
        <h3 className="font-semibold text-white">
          {language === 'de' ? 'Benachrichtigungen' : 'Notifications'}
        </h3>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            {language === 'de' ? 'Keine Benachrichtigungen' : 'No notifications'}
          </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className="p-4 border-b border-gray-800 hover:bg-gray-850">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  notif.type === 'checkout-soon' ? 'bg-orange-600 bg-opacity-20' :
                  notif.type === 'gap-available' ? 'bg-yellow-600 bg-opacity-20' :
                  notif.type === 'error' ? 'bg-red-600 bg-opacity-20' :
                  'bg-blue-600 bg-opacity-20'
                }`}>
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notif.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ============================================================================
  // DELETE CONFIRMATION MODAL
  // ============================================================================

  const DeleteConfirmModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4 text-red-400">
          <AlertCircle className="w-8 h-8" />
          <h2 className="text-xl font-bold">
            {language === 'de' ? 'Löschen bestätigen' : 'Confirm Delete'}
          </h2>
        </div>
        <p className="text-gray-300 mb-6">
          {language === 'de' 
            ? 'Alle Daten gehen verloren. Möchten Sie wirklich löschen?' 
            : 'All data will be lost. Do you really want to delete?'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirmOpen(null)}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white font-semibold"
          >
            {language === 'de' ? 'Abbrechen' : 'Cancel'}
          </button>
          <button
            onClick={confirmDelete}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-semibold"
          >
            {language === 'de' ? 'Löschen' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontSize: `${fontSize}px` }}>
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-20 shadow-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  EuroTrack
                </span>
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShareModalOpen(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {language === 'de' ? 'Teilen' : 'Share'}
              </button>

              <button
                onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? 'DE' : 'EN'}
              </button>

              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 relative"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"></span>
                  )}
                </button>
                <NotificationsPanel />
              </div>

              <button
                onClick={() => alert('Export functionality')}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
              >
                <Download className="w-5 h-5" />
              </button>

              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search, Filter, Sort Bar */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-[73px] z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'de' ? 'Suchen...' : 'Search...'}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {language === 'de' ? 'Filter' : 'Filter'}
              </button>
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
              >
                <option value="recent">{language === 'de' ? 'Kürzlich hinzugefügt' : 'Recently Added'}</option>
                <option value="name">{language === 'de' ? 'Name' : 'Name'}</option>
                <option value="max-duration">{language === 'de' ? 'Max. Dauer' : 'Max Duration'}</option>
                <option value="min-duration">{language === 'de' ? 'Min. Dauer' : 'Min Duration'}</option>
                <option value="max-cost">{language === 'de' ? 'Max. Kosten' : 'Max Cost'}</option>
                <option value="min-cost">{language === 'de' ? 'Min. Kosten' : 'Min Cost'}</option>
              </select>
              <ArrowUpDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Group By */}
            <div className="relative">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">{language === 'de' ? 'Keine Gruppierung' : 'No Grouping'}</option>
                <option value="company">{language === 'de' ? 'Nach Firma' : 'Group by Company'}</option>
                <option value="city">{language === 'de' ? 'Nach Stadt' : 'Group by City'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-900 border-r border-gray-800 min-h-screen sticky top-[73px] self-start transition-all`}>
          <div className="p-4">
            {/* Collapse Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full mb-4 p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
            >
              <ChevronLeft className={`w-5 h-5 mx-auto transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>

            {!sidebarCollapsed && (
              <>
                {/* Year Selector */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider">
                    {language === 'de' ? 'Jahr' : 'Year'}
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  >
                    {[2023, 2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Dashboard Button */}
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`w-full mb-2 px-4 py-3 rounded-lg transition-all flex items-center gap-2 ${
                    viewMode === 'dashboard'
                      ? 'bg-blue-600 text-white font-semibold shadow-lg'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {language === 'de' ? 'Dashboard' : 'Dashboard'}
                </button>

                {/* Months */}
                <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider mt-6">
                  {language === 'de' ? 'Monate' : 'Months'}
                </h2>
                <div className="space-y-1">
                  {months.map((month, index) => (
                    <button
                      key={month}
                      onClick={() => {
                        setSelectedMonth(index);
                        setViewMode('month');
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                        selectedMonth === index && viewMode === 'month'
                          ? 'bg-blue-600 text-white font-semibold shadow-lg'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{month}</span>
                        {monthlyStats[index] > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-green-600 bg-opacity-30 rounded text-green-300">
                            €{(monthlyStats[index] / 1000).toFixed(1)}k
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Yearly Total */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="text-xs text-gray-400 mb-1">
                    {language === 'de' ? 'Jahressumme' : 'Yearly Total'}
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    €{yearlyTotal.toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {viewMode === 'dashboard' 
                ? (language === 'de' ? 'Dashboard' : 'Dashboard')
                : `${months[selectedMonth]} ${selectedYear}`}
            </h2>
          </div>

          {/* Hotel List */}
          {filteredAndSortedHotels.length === 0 ? (
            <div className="text-center py-20 bg-gray-900 rounded-lg border border-gray-800">
              <Building2 className="w-20 h-20 text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                {language === 'de' ? 'Noch keine Hotels' : 'No Hotels Yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {language === 'de' ? 'Beginnen Sie mit dem Hinzufügen Ihres ersten Hotels' : 'Start by adding your first hotel'}
              </p>
              {addingHotel ? (
                <form onSubmit={handleSaveNewHotel} className="flex items-center gap-2 justify-center">
                  <input
                    type="text"
                    name="name"
                    placeholder={language === 'de' ? 'Hotelname' : 'Hotel name'}
                    required
                    autoFocus
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                  />
                  <input
                    type="text"
                    name="city"
                    placeholder={language === 'de' ? 'Stadt' : 'City'}
                    required
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                  />
                  <input
                    type="text"
                    name="companyTag"
                    placeholder={language === 'de' ? 'Firma' : 'Company'}
                    required
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                  />
                  <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white">
                    <Check className="w-5 h-5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setAddingHotel(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={handleAddHotelRow}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all text-white font-semibold inline-flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  {language === 'de' ? 'Erstes Hotel hinzufügen' : 'Add First Hotel'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {addingHotel && (
                <form onSubmit={handleSaveNewHotel} className="mb-3 p-4 bg-gray-800 rounded-lg border-2 border-green-500">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="name"
                      placeholder={language === 'de' ? 'Hotelname' : 'Hotel name'}
                      required
                      autoFocus
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                    />
                    <input
                      type="text"
                      name="city"
                      placeholder={language === 'de' ? 'Stadt' : 'City'}
                      required
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                    />
                    <input
                      type="text"
                      name="companyTag"
                      placeholder={language === 'de' ? 'Firma' : 'Company'}
                      required
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                    />
                    <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white">
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAddingHotel(false)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              )}

              {groupedHotels.map(group => (
                <div key={group.key}>
                  {groupBy !== 'none' && (
                    <div className="mb-4 pb-3 border-b-2 border-purple-600 flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
                        <Building2 className="w-6 h-6" />
                        {group.key}
                      </h3>
                      <span className="text-sm text-gray-400">
                        {group.hotels.length} {group.hotels.length === 1 ? (language === 'de' ? 'Hotel' : 'hotel') : (language === 'de' ? 'Hotels' : 'hotels')}
                      </span>
                    </div>
                  )}
                  
                  {group.hotels.map((hotel, idx) => renderHotel(hotel, idx === group.hotels.length - 1))}

                  {groupBy !== 'none' && group.hotels.length > 0 && (
                    <div className="mt-3 p-4 bg-purple-600 bg-opacity-10 rounded-lg border border-purple-500 flex items-center justify-between">
                      <span className="text-sm text-gray-400 font-medium">
                        {group.key} {language === 'de' ? 'Zwischensumme' : 'Subtotal'}:
                      </span>
                      <span className="text-2xl font-bold text-purple-400">
                        €{group.hotels.reduce((sum, h) => sum + getHotelStats(h).totalCost, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Settings Panel */}
      <SettingsPanel />

      {/* Share Modal */}
      {shareModalOpen && <ShareModal />}

      {/* Delete Confirmation */}
      {deleteConfirmOpen && <DeleteConfirmModal />}

      {/* Overlay for settings */}
      {settingsOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
