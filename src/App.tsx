'use client';

import React, { useState, useMemo } from 'react';
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
  X,
  Save,
  Building2,
  Users,
  Clock
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type RoomType = 'EZ' | 'DZ' | 'TZ';

interface Employee {
  id: string;
  name: string;
  checkIn: string;
  checkOut: string;
  costPerNight: number;
}

interface BookingDuration {
  id: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  employees: (Employee | null)[];
}

interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string;
  contact: string;
  webLink: string;
  companyTag: string;
  durations: BookingDuration[];
}

interface Workspace {
  hotels: Hotel[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getRoomCapacity = (roomType: RoomType): number => {
  const capacities: Record<RoomType, number> = { 'EZ': 1, 'DZ': 2, 'TZ': 3 };
  return capacities[roomType];
};

const getMonthDates = (year: number, month: number): { start: string; end: string } => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

const calculateDaysInMonth = (
  checkIn: string,
  checkOut: string,
  monthStart: string,
  monthEnd: string
): number => {
  const start = new Date(Math.max(new Date(checkIn).getTime(), new Date(monthStart).getTime()));
  const end = new Date(Math.min(new Date(checkOut).getTime(), new Date(monthEnd).getTime()));
  
  if (start > end) return 0;
  
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, days);
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EuroTrackApp() {
  const [workspace, setWorkspace] = useState<Workspace>({ hotels: [] });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [currentDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedHotels, setExpandedHotels] = useState<Set<string>>(new Set());
  const [groupByCompany, setGroupByCompany] = useState(true);
  
  // Modal states
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showGapModal, setShowGapModal] = useState(false);
  
  // Form states
  const [currentHotelId, setCurrentHotelId] = useState<string | null>(null);
  const [currentDurationId, setCurrentDurationId] = useState<string | null>(null);
  const [currentSlotIndex, setCurrentSlotIndex] = useState<number | null>(null);
  const [gapEmployee, setGapEmployee] = useState<Employee | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const { start: monthStart, end: monthEnd } = getMonthDates(selectedYear, selectedMonth);

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
        
        duration.employees.forEach(employee => {
          if (employee) {
            const daysInMonth = calculateDaysInMonth(
              employee.checkIn,
              employee.checkOut,
              monthStart,
              monthEnd
            );
            totalSpend += daysInMonth * employee.costPerNight;

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
  }, [workspace, monthStart, monthEnd, currentDate]);

  // ============================================================================
  // HOTEL STATS
  // ============================================================================

  const getHotelStats = (hotel: Hotel) => {
    let totalNights = 0;
    let totalCost = 0;
    let freeBeds = 0;
    const employeeTags = new Set<string>();
    const allDurations: string[] = [];

    hotel.durations.forEach(duration => {
      allDurations.push(`${duration.startDate} → ${duration.endDate}`);
      const capacity = getRoomCapacity(duration.roomType);
      let filledSlots = 0;

      duration.employees.forEach(employee => {
        if (employee) {
          filledSlots++;
          employeeTags.add(employee.name);
          const nights = calculateTotalNights(employee.checkIn, employee.checkOut);
          totalNights += nights;
          
          const daysInMonth = calculateDaysInMonth(
            employee.checkIn,
            employee.checkOut,
            monthStart,
            monthEnd
          );
          totalCost += daysInMonth * employee.costPerNight;
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

  // ============================================================================
  // GROUPED HOTELS
  // ============================================================================

  const groupedHotels = useMemo(() => {
    if (!groupByCompany) {
      return [{ company: 'All Hotels', hotels: workspace.hotels }];
    }

    const groups: Record<string, Hotel[]> = {};
    workspace.hotels.forEach(hotel => {
      if (!groups[hotel.companyTag]) {
        groups[hotel.companyTag] = [];
      }
      groups[hotel.companyTag].push(hotel);
    });

    return Object.entries(groups).map(([company, hotels]) => ({
      company,
      hotels,
    }));
  }, [workspace, groupByCompany]);

  // ============================================================================
  // HANDLERS - HOTEL
  // ============================================================================

  const handleAddHotel = () => {
    setCurrentHotelId(null);
    setShowHotelModal(true);
  };

  const handleEditHotel = (hotelId: string) => {
    setCurrentHotelId(hotelId);
    setShowHotelModal(true);
  };

  const handleSaveHotel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newHotel: Hotel = {
      id: currentHotelId || `h${Date.now()}`,
      name: formData.get('name') as string,
      city: formData.get('city') as string,
      address: formData.get('address') as string,
      contact: formData.get('contact') as string,
      webLink: formData.get('webLink') as string,
      companyTag: formData.get('companyTag') as string,
      durations: currentHotelId 
        ? workspace.hotels.find(h => h.id === currentHotelId)?.durations || []
        : [],
    };

    setWorkspace(prev => {
      if (currentHotelId) {
        return {
          ...prev,
          hotels: prev.hotels.map(h => h.id === currentHotelId ? newHotel : h)
        };
      }
      return {
        ...prev,
        hotels: [...prev.hotels, newHotel]
      };
    });

    setShowHotelModal(false);
    setCurrentHotelId(null);
  };

  const handleDeleteHotel = (hotelId: string) => {
    if (confirm('Are you sure you want to delete this hotel?')) {
      setWorkspace(prev => ({
        ...prev,
        hotels: prev.hotels.filter(h => h.id !== hotelId)
      }));
    }
  };

  // ============================================================================
  // HANDLERS - DURATION
  // ============================================================================

  const handleAddDuration = (hotelId: string) => {
    setCurrentHotelId(hotelId);
    setCurrentDurationId(null);
    setShowDurationModal(true);
  };

  const handleSaveDuration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const roomType = formData.get('roomType') as RoomType;
    const capacity = getRoomCapacity(roomType);

    const newDuration: BookingDuration = {
      id: currentDurationId || `d${Date.now()}`,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      roomType,
      employees: Array(capacity).fill(null),
    };

    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id === currentHotelId) {
          if (currentDurationId) {
            return {
              ...h,
              durations: h.durations.map(d => d.id === currentDurationId ? newDuration : d)
            };
          }
          return {
            ...h,
            durations: [...h.durations, newDuration]
          };
        }
        return h;
      })
    }));

    setShowDurationModal(false);
    setCurrentDurationId(null);
  };

  const handleDeleteDuration = (hotelId: string, durationId: string) => {
    if (confirm('Are you sure you want to delete this booking duration?')) {
      setWorkspace(prev => ({
        ...prev,
        hotels: prev.hotels.map(h => {
          if (h.id === hotelId) {
            return {
              ...h,
              durations: h.durations.filter(d => d.id !== durationId)
            };
          }
          return h;
        })
      }));
    }
  };

  // ============================================================================
  // HANDLERS - EMPLOYEE
  // ============================================================================

  const handleAddEmployee = (hotelId: string, durationId: string, slotIndex: number) => {
    setCurrentHotelId(hotelId);
    setCurrentDurationId(durationId);
    setCurrentSlotIndex(slotIndex);
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newEmployee: Employee = {
      id: `e${Date.now()}`,
      name: formData.get('name') as string,
      checkIn: formData.get('checkIn') as string,
      checkOut: formData.get('checkOut') as string,
      costPerNight: parseFloat(formData.get('costPerNight') as string),
    };

    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id === currentHotelId) {
          return {
            ...h,
            durations: h.durations.map(d => {
              if (d.id === currentDurationId) {
                const newEmployees = [...d.employees];
                newEmployees[currentSlotIndex!] = newEmployee;
                return { ...d, employees: newEmployees };
              }
              return d;
            })
          };
        }
        return h;
      })
    }));

    setShowEmployeeModal(false);
    setCurrentSlotIndex(null);
  };

  const handleDeleteEmployee = (hotelId: string, durationId: string, slotIndex: number) => {
    if (confirm('Are you sure you want to remove this employee?')) {
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
  // HANDLERS - GAP FILLING
  // ============================================================================

  const handleFillGap = (hotelId: string, durationId: string, employee: Employee) => {
    setCurrentHotelId(hotelId);
    setCurrentDurationId(durationId);
    setGapEmployee(employee);
    setShowGapModal(true);
  };

  const handleSaveGapEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newEmployee: Employee = {
      id: `e${Date.now()}`,
      name: formData.get('name') as string,
      checkIn: formData.get('checkIn') as string,
      checkOut: formData.get('checkOut') as string,
      costPerNight: parseFloat(formData.get('costPerNight') as string),
    };

    // Find an empty slot or add to the same duration
    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id === currentHotelId) {
          return {
            ...h,
            durations: h.durations.map(d => {
              if (d.id === currentDurationId) {
                // Try to find empty slot
                const emptyIndex = d.employees.findIndex(e => e === null);
                if (emptyIndex !== -1) {
                  const newEmployees = [...d.employees];
                  newEmployees[emptyIndex] = newEmployee;
                  return { ...d, employees: newEmployees };
                }
              }
              return d;
            })
          };
        }
        return h;
      })
    }));

    setShowGapModal(false);
    setGapEmployee(null);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      case 'ending-soon': return 'bg-orange-500';
      case 'completed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500 bg-opacity-20 text-blue-300 border-blue-500';
      case 'active': return 'bg-green-500 bg-opacity-20 text-green-300 border-green-500';
      case 'ending-soon': return 'bg-orange-500 bg-opacity-20 text-orange-300 border-orange-500';
      case 'completed': return 'bg-red-500 bg-opacity-20 text-red-300 border-red-500';
      default: return 'bg-gray-500 bg-opacity-20 text-gray-300 border-gray-500';
    }
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
    if (!employee) {
      return (
        <div
          className="flex items-center justify-center p-4 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-green-500 transition-all cursor-pointer min-h-[120px]"
          onClick={() => handleAddEmployee(hotelId, duration.id, slotIndex)}
        >
          <div className="text-center">
            <Plus className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <span className="text-sm text-gray-400">Add Employee</span>
          </div>
        </div>
      );
    }

    const status = getEmployeeStatus(employee.checkIn, employee.checkOut, currentDate);
    const gap = hasGap(employee, duration.endDate);
    const daysInMonth = calculateDaysInMonth(
      employee.checkIn,
      employee.checkOut,
      monthStart,
      monthEnd
    );
    const totalNights = calculateTotalNights(employee.checkIn, employee.checkOut);

    return (
      <div className={`p-4 rounded-lg border-2 bg-gray-800 ${getStatusColor(status)} bg-opacity-10 border-opacity-50`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-white text-lg">{employee.name}</span>
              {gap && (
                <button
                  onClick={() => handleFillGap(hotelId, duration.id, employee)}
                  className="p-1.5 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                  title="Fill gap - Add new employee after checkout"
                >
                  <UserPlus className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${getStatusBadgeColor(status)}`}>
              {status.replace('-', ' ').toUpperCase()}
            </div>
          </div>

          <button
            onClick={() => handleDeleteEmployee(hotelId, duration.id, slotIndex)}
            className="p-1.5 bg-red-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors"
            title="Remove employee"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="w-3.5 h-3.5" />
            <span>{employee.checkIn} → {employee.checkOut}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-3.5 h-3.5" />
            <span>{totalNights} total nights</span>
          </div>

          <div className="flex items-center gap-2 text-green-400 font-semibold mt-2">
            <DollarSign className="w-3.5 h-3.5" />
            <span>€{employee.costPerNight}/night × {daysInMonth} days = €{(employee.costPerNight * daysInMonth).toLocaleString()}</span>
          </div>
        </div>

        {gap && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              Gap detected: Available from {employee.checkOut} to {duration.endDate}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderDuration = (duration: BookingDuration, hotel: Hotel) => {
    const capacity = getRoomCapacity(duration.roomType);
    const slots = Array(capacity).fill(null).map((_, i) => duration.employees[i] || null);

    return (
      <div key={duration.id} className="mb-4 p-5 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white text-lg">
              {duration.startDate} → {duration.endDate}
            </span>
            <span className="px-3 py-1 bg-blue-600 rounded-full text-sm font-bold text-white">
              {duration.roomType}
            </span>
            <span className="text-sm text-gray-400">
              ({capacity} {capacity === 1 ? 'bed' : 'beds'})
            </span>
          </div>

          <button
            onClick={() => handleDeleteDuration(hotel.id, duration.id)}
            className="px-3 py-1.5 bg-red-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors text-red-400 text-sm flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Duration
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slots.map((employee, index) => (
            <div key={index}>
              {renderEmployeeSlot(employee, duration, index, hotel.id)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHotel = (hotel: Hotel) => {
    const isExpanded = expandedHotels.has(hotel.id);
    const stats = getHotelStats(hotel);

    return (
      <div key={hotel.id} className="mb-4 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
        {/* Hotel Header - Main Row */}
        <div className="p-5 bg-gradient-to-r from-gray-800 to-gray-850">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => toggleHotel(hotel.id)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">{hotel.name}</h3>
                  <span className="px-3 py-1 bg-purple-600 bg-opacity-30 rounded-full text-sm font-semibold text-purple-300 border border-purple-500">
                    {hotel.companyTag}
                  </span>
                </div>
                <p className="text-sm text-gray-400 ml-8">{hotel.city}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEditHotel(hotel.id)}
                  className="p-2 bg-blue-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors"
                  title="Edit hotel"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
                <button
                  onClick={() => handleDeleteHotel(hotel.id)}
                  className="p-2 bg-red-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors"
                  title="Delete hotel"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4 ml-14">
            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">All Durations</div>
              <div className="text-sm font-semibold text-white">
                {stats.allDurations.length > 0 ? stats.allDurations.join(', ') : 'No bookings'}
              </div>
            </div>

            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Total Nights</div>
              <div className="text-lg font-bold text-blue-400">{stats.totalNights}</div>
            </div>

            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Bed className="w-3 h-3" />
                Free Beds
              </div>
              <div className="text-lg font-bold text-green-400">{stats.freeBeds}</div>
            </div>

            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Employees
              </div>
              <div className="text-sm font-semibold text-white">
                {stats.employeeTags.length > 0 ? stats.employeeTags.join(', ') : 'None'}
              </div>
            </div>

            <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Total Cost</div>
              <div className="text-lg font-bold text-green-400">€{stats.totalCost.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Expanded Content - Breakdown */}
        {isExpanded && (
          <div className="p-5 pt-4 bg-gray-850 border-t border-gray-700">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Breakdown Details</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Address</p>
                  <p className="text-sm text-white">{hotel.address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Contact</p>
                  <p className="text-sm text-white">{hotel.contact}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Website</p>
                  <a
                    href={hotel.webLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Visit Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Booking Durations</h4>
              <button
                onClick={() => handleAddDuration(hotel.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white text-sm flex items-center gap-2 font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Duration
              </button>
            </div>

            <div className="space-y-3">
              {hotel.durations.length > 0 ? (
                hotel.durations.map(duration => renderDuration(duration, hotel))
              ) : (
                <div className="text-center py-12 bg-gray-900 rounded-lg border border-dashed border-gray-700">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No booking durations yet</p>
                  <button
                    onClick={() => handleAddDuration(hotel.id)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white text-sm"
                  >
                    Add First Duration
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MODALS
  // ============================================================================

  const HotelModal = () => {
    const hotel = currentHotelId ? workspace.hotels.find(h => h.id === currentHotelId) : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
            <h2 className="text-2xl font-bold text-white">
              {currentHotelId ? 'Edit Hotel' : 'Add New Hotel'}
            </h2>
            <button
              onClick={() => setShowHotelModal(false)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSaveHotel} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Hotel Name *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={hotel?.name}
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Hotel Adlon Berlin"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={hotel?.city}
                    required
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Berlin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Tag *
                  </label>
                  <input
                    type="text"
                    name="companyTag"
                    defaultValue={hotel?.companyTag}
                    required
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Siemens"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={hotel?.address}
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Unter den Linden 77, 10117 Berlin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contact *
                </label>
                <input
                  type="text"
                  name="contact"
                  defaultValue={hotel?.contact}
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., +49 30 2261 0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website URL *
                </label>
                <input
                  type="url"
                  name="webLink"
                  defaultValue={hotel?.webLink}
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., https://www.hotel-adlon.de"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {currentHotelId ? 'Update Hotel' : 'Create Hotel'}
              </button>
              <button
                type="button"
                onClick={() => setShowHotelModal(false)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const DurationModal = () => {
    const hotel = workspace.hotels.find(h => h.id === currentHotelId);
    const duration = currentDurationId ? hotel?.durations.find(d => d.id === currentDurationId) : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-lg w-full">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {currentDurationId ? 'Edit Duration' : 'Add Booking Duration'}
            </h2>
            <button
              onClick={() => setShowDurationModal(false)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSaveDuration} className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={duration?.startDate}
                    required
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={duration?.endDate}
                    required
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Room Type *
                </label>
                <select
                  name="roomType"
                  defaultValue={duration?.roomType || 'DZ'}
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="EZ">EZ - Single Room (1 bed)</option>
                  <option value="DZ">DZ - Double Room (2 beds)</option>
                  <option value="TZ">TZ - Triple Room (3 beds)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {currentDurationId ? 'Update Duration' : 'Create Duration'}
              </button>
              <button
                type="button"
                onClick={() => setShowDurationModal(false)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const EmployeeModal = () => {
    const hotel = workspace.hotels.find(h => h.id === currentHotelId);
    const duration = hotel?.durations.find(d => d.id === currentDurationId);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-lg w-full">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Add Employee</h2>
            <button
              onClick={() => setShowEmployeeModal(false)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSaveEmployee} className="p-6">
            <div className="mb-4 p-3 bg-blue-600 bg-opacity-20 rounded-lg border border-blue-500">
              <p className="text-sm text-blue-300">
                Duration: <strong>{duration?.startDate} → {duration?.endDate}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Employee Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Max Müller"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Check-In Date *
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    defaultValue={duration?.startDate}
                    required
                    min={duration?.startDate}
                    max={duration?.endDate}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Check-Out Date *
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    defaultValue={duration?.endDate}
                    required
                    min={duration?.startDate}
                    max={duration?.endDate}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cost Per Night (€) *
                </label>
                <input
                  type="number"
                  name="costPerNight"
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 120"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-white font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Add Employee
              </button>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const GapFillerModal = () => {
    const hotel = workspace.hotels.find(h => h.id === currentHotelId);
    const duration = hotel?.durations.find(d => d.id === currentDurationId);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-lg w-full">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Fill Gap - Add New Employee</h2>
            <button
              onClick={() => setShowGapModal(false)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSaveGapEmployee} className="p-6">
            <div className="mb-4 p-4 bg-yellow-600 bg-opacity-20 rounded-lg border border-yellow-500">
              <p className="text-sm text-yellow-300 mb-2">
                <strong>{gapEmployee?.name}</strong> checks out on <strong>{gapEmployee?.checkOut}</strong>
              </p>
              <p className="text-sm text-yellow-300">
                Available gap: <strong>{gapEmployee?.checkOut} → {duration?.endDate}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Employee Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Anna Schmidt"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Check-In Date *
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    defaultValue={gapEmployee?.checkOut}
                    required
                    min={gapEmployee?.checkOut}
                    max={duration?.endDate}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Check-Out Date *
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    defaultValue={duration?.endDate}
                    required
                    min={gapEmployee?.checkOut}
                    max={duration?.endDate}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cost Per Night (€) *
                </label>
                <input
                  type="number"
                  name="costPerNight"
                  required
                  min="0"
                  step="0.01"
                  defaultValue={gapEmployee?.costPerNight}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 120"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-white font-semibold flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Fill Gap
              </button>
              <button
                type="button"
                onClick={() => setShowGapModal(false)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10 shadow-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                🚀 EuroTrack
                <span className="text-sm font-normal text-gray-400 px-3 py-1 bg-gray-800 rounded-full">
                  Hotel Logistics Management
                </span>
              </h1>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="px-5 py-3 bg-purple-600 bg-opacity-20 rounded-lg border border-purple-500">
                <div className="text-xs text-gray-400 mb-1">Total Hotels</div>
                <div className="text-2xl font-bold text-purple-400">
                  {stats.totalHotels}
                </div>
              </div>

              <div className="px-5 py-3 bg-green-600 bg-opacity-20 rounded-lg border border-green-500">
                <div className="text-xs text-gray-400 mb-1">Monthly Spend</div>
                <div className="text-2xl font-bold text-green-400">
                  €{stats.totalSpend.toLocaleString()}
                </div>
              </div>
              
              <div className="px-5 py-3 bg-blue-600 bg-opacity-20 rounded-lg border border-blue-500">
                <div className="text-xs text-gray-400 mb-1">Free Beds</div>
                <div className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                  <Bed className="w-6 h-6" />
                  {stats.freeBeds}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen p-4 sticky top-[73px] self-start">
          <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
            Filter by Month
          </h2>
          <div className="space-y-1">
            {monthNames.map((month, index) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(index)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  selectedMonth === index
                    ? 'bg-blue-600 text-white font-semibold shadow-lg'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                }`}
              >
                {month} {selectedYear}
              </button>
            ))}
          </div>

          {/* Group Toggle */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-800 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={groupByCompany}
                onChange={(e) => setGroupByCompany(e.target.checked)}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300 font-medium">Group by Company</span>
            </label>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {monthNames[selectedMonth]} {selectedYear}
              </h2>
              <p className="text-gray-400">
                Viewing bookings from {monthStart} to {monthEnd}
              </p>
            </div>

            <button
              onClick={handleAddHotel}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all text-white font-semibold flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add New Hotel
            </button>
          </div>

          {/* Hotel List */}
          {workspace.hotels.length === 0 ? (
            <div className="text-center py-20 bg-gray-900 rounded-lg border border-gray-800">
              <Building2 className="w-20 h-20 text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No Hotels Yet</h3>
              <p className="text-gray-500 mb-6">Start by adding your first hotel to the workspace</p>
              <button
                onClick={handleAddHotel}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Your First Hotel
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHotels.map(group => (
                <div key={group.company}>
                  {groupByCompany && (
                    <div className="mb-4 pb-3 border-b-2 border-purple-600 flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
                        <Building2 className="w-6 h-6" />
                        {group.company}
                      </h3>
                      <span className="text-sm text-gray-400">
                        {group.hotels.length} {group.hotels.length === 1 ? 'hotel' : 'hotels'}
                      </span>
                    </div>
                  )}
                  
                  {group.hotels.map(hotel => renderHotel(hotel))}

                  {groupByCompany && group.hotels.length > 0 && (
                    <div className="mt-3 p-4 bg-purple-600 bg-opacity-10 rounded-lg border border-purple-500 flex items-center justify-between">
                      <span className="text-sm text-gray-400 font-medium">
                        {group.company} Subtotal:
                      </span>
                      <span className="text-2xl font-bold text-purple-400">
                        €{group.hotels.reduce((sum, h) => sum + getHotelStats(h).totalCost, 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showHotelModal && <HotelModal />}
      {showDurationModal && <DurationModal />}
      {showEmployeeModal && <EmployeeModal />}
      {showGapModal && <GapFillerModal />}
    </div>
  );
}
