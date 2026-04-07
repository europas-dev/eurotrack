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
  Check,
  X,
  Building2,
  Users,
  Clock,
  Phone,
  Mail,
  MapPin,
  Zap,
  ArrowRight
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
}

interface BookingDuration {
  id: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  pricePerNight: number;
  employees: (Employee | null)[];
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

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDate = (ddmmyyyy: string): string => {
  const [day, month, year] = ddmmyyyy.split('/');
  return `${year}-${month}-${day}`;
};

const toInputDate = (isoDate: string): string => {
  return isoDate;
};

const fromInputDate = (inputDate: string): string => {
  return inputDate;
};

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
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-cyan-500',
  ];
  return colors[index % colors.length];
};

const getCalendarMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();
  
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];
  
  // Fill starting empty days (Monday-based)
  const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  for (let i = 0; i < adjustedStart; i++) {
    currentWeek.push(null);
  }
  
  // Fill in the days
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  // Fill remaining empty days
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [currentDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedHotels, setExpandedHotels] = useState<Set<string>>(new Set());
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [showCalendar, setShowCalendar] = useState<Set<string>>(new Set());
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [groupByCompany, setGroupByCompany] = useState(false);
  const [activeDuration, setActiveDuration] = useState<Record<string, string>>({});
  
  // Inline editing states
  const [editingHotel, setEditingHotel] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [addingHotel, setAddingHotel] = useState(false);
  const [addingDuration, setAddingDuration] = useState<string | null>(null);
  const [addingEmployee, setAddingEmployee] = useState<{ hotelId: string; durationId: string; slotIndex: number } | null>(null);
  const [extendingDuration, setExtendingDuration] = useState<string | null>(null);

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
        const nights = calculateTotalNights(duration.startDate, duration.endDate);
        
        // FIXED: Calculate total cost based on duration, not employees
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
      const nights = calculateTotalNights(duration.startDate, duration.endDate);
      const capacity = getRoomCapacity(duration.roomType);
      
      // FIXED: Calculate cost based on duration capacity
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

  // ============================================================================
  // COMPANY TABS
  // ============================================================================

  const companyTabs = useMemo(() => {
    const companies = new Set<string>();
    workspace.hotels.forEach(hotel => companies.add(hotel.companyTag));
    return ['All', ...Array.from(companies)];
  }, [workspace]);

  const filteredHotels = useMemo(() => {
    if (selectedCompany === 'All') return workspace.hotels;
    return workspace.hotels.filter(h => h.companyTag === selectedCompany);
  }, [workspace, selectedCompany]);

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
    if (confirm('Delete this hotel?')) {
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
    };

    setWorkspace(prev => ({
      ...prev,
      hotels: prev.hotels.map(h => 
        h.id === hotelId 
          ? { ...h, durations: [...h.durations, newDuration] }
          : h
      )
    }));

    // Set as active duration
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

  const handleExtendDuration = (hotelId: string, durationId: string, newEndDate: string) => {
    handleUpdateDuration(hotelId, durationId, 'endDate', newEndDate);
    setExtendingDuration(null);
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
    if (confirm('Delete this duration?')) {
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

  const handleAddEmployee = (hotelId: string, durationId: string, slotIndex: number) => {
    setAddingEmployee({ hotelId, durationId, slotIndex });
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

    // Find an empty slot in the same duration
    const emptySlot = duration.employees.findIndex((e, idx) => e === null && idx !== slotIndex);
    
    if (emptySlot !== -1) {
      setAddingEmployee({ 
        hotelId, 
        durationId, 
        slotIndex: emptySlot 
      });
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
    if (confirm('Remove this employee?')) {
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
          Calendar View - {monthNames[selectedMonth]} {selectedYear}
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
                              {activeDurations.map((duration, idx) => (
                                <div
                                  key={duration.id}
                                  className={`text-xs px-1 py-0.5 rounded ${generateDurationColor(hotel.durations.indexOf(duration))} bg-opacity-70 text-white font-semibold`}
                                  title={`${duration.roomType} - €${duration.pricePerNight}/night`}
                                >
                                  €{duration.pricePerNight}
                                </div>
                              ))}
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
              <div className={`w-4 h-4 rounded ${generateDurationColor(index)}`}></div>
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

    if (isAdding) {
      return (
        <form onSubmit={handleSaveNewEmployee} className="p-3 bg-gray-800 rounded border border-green-500">
          <div className="space-y-2">
            <input
              type="text"
              name="name"
              placeholder="Employee name"
              required
              autoFocus
              className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">Check-In</label>
                <input
                  type="date"
                  name="checkIn"
                  defaultValue={toInputDate(duration.startDate)}
                  required
                  min={toInputDate(duration.startDate)}
                  max={toInputDate(duration.endDate)}
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Check-Out</label>
                <input
                  type="date"
                  name="checkOut"
                  defaultValue={toInputDate(duration.endDate)}
                  required
                  min={toInputDate(duration.startDate)}
                  max={toInputDate(duration.endDate)}
                  className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                <Check className="w-3 h-3 inline" /> Save
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
            <span className="text-xs text-gray-400">Add Employee</span>
          </div>
        </div>
      );
    }

    const status = getEmployeeStatus(employee.checkIn, employee.checkOut, currentDate);
    const gap = hasGap(employee, duration.endDate);
    const nights = calculateTotalNights(employee.checkIn, employee.checkOut);

    if (isEditing) {
      return (
        <div className="p-3 bg-gray-800 rounded border border-blue-500">
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
                <Check className="w-3 h-3 inline" /> Done
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
      <div className={`p-3 rounded border-2 bg-gray-800 ${getStatusColor(status)} bg-opacity-10 border-opacity-50 group relative`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white">{employee.name}</span>
              {gap && (
                <button
                  onClick={() => handleFillGap(hotelId, duration.id, employee, slotIndex)}
                  className="p-1 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                  title="Fill gap - add new employee after checkout"
                >
                  <UserPlus className="w-3 h-3 text-white" />
                </button>
              )}
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
            <span>{nights} nights</span>
          </div>
        </div>

        {gap && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              Gap: {formatDate(employee.checkOut)} → {formatDate(duration.endDate)}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderDuration = (duration: BookingDuration, hotel: Hotel, index: number) => {
    const capacity = getRoomCapacity(duration.roomType);
    const slots = Array(capacity).fill(null).map((_, i) => duration.employees[i] || null);
    const nights = calculateTotalNights(duration.startDate, duration.endDate);
    
    // FIXED: Calculate total cost based on capacity, not filled employees
    const totalCost = nights * duration.pricePerNight * capacity;

    const isEditing = editingDuration === duration.id;
    const isExtending = extendingDuration === duration.id;

    return (
      <div key={duration.id} className="p-4 bg-gray-900 rounded-lg border border-gray-700">
        {/* Duration Card */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
          {isEditing ? (
            <div className="grid grid-cols-6 gap-3">
              <div>
                <label className="text-xs text-gray-400">Booking Start</label>
                <input
                  type="date"
                  value={toInputDate(duration.startDate)}
                  onChange={(e) => handleUpdateDuration(hotel.id, duration.id, 'startDate', fromInputDate(e.target.value))}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Booking End</label>
                <input
                  type="date"
                  value={toInputDate(duration.endDate)}
                  onChange={(e) => handleUpdateDuration(hotel.id, duration.id, 'endDate', fromInputDate(e.target.value))}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Room Type</label>
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
                <label className="text-xs text-gray-400">€/Night</label>
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
                <label className="text-xs text-gray-400">Total Cost</label>
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
                  <div className="text-xs text-gray-400 mb-1">Booking Start</div>
                  <div className="text-sm font-semibold text-white">{formatDate(duration.startDate)}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400 mb-1">Booking End</div>
                  <div className="text-sm font-semibold text-white">{formatDate(duration.endDate)}</div>
                  {isExtending ? (
                    <div className="mt-1">
                      <input
                        type="date"
                        defaultValue={toInputDate(duration.endDate)}
                        onChange={(e) => handleExtendDuration(hotel.id, duration.id, fromInputDate(e.target.value))}
                        className="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setExtendingDuration(duration.id)}
                      className="mt-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <ArrowRight className="w-3 h-3" />
                      Extend
                    </button>
                  )}
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">Room Type</div>
                  <div className="text-sm font-semibold text-white">{duration.roomType} ({capacity} beds)</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">Nightly Price</div>
                  <div className="text-sm font-semibold text-green-400">€{duration.pricePerNight}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">Total Nights</div>
                  <div className="text-sm font-semibold text-white">{nights}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">Duration Cost</div>
                  <div className="text-sm font-bold text-green-400">€{totalCost.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                <button
                  onClick={() => handleApplyPriceToAllDurations(hotel.id, duration.pricePerNight)}
                  className="p-2 bg-purple-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-colors"
                  title="Apply this price to all durations"
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
    const isContactExpanded = expandedContacts.has(hotel.id);
    const isCalendarVisible = showCalendar.has(hotel.id);
    const stats = getHotelStats(hotel);
    const isEditing = editingHotel === hotel.id;

    const activeTab = activeDuration[hotel.id] || hotel.durations[0]?.id;
    const activeDurationData = hotel.durations.find(d => d.id === activeTab);

    return (
      <div key={hotel.id} className="mb-3 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
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
                  <Check className="w-4 h-4 inline" /> Done
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
          <div className="p-4 hover:bg-gray-750 transition-colors group">
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
                <div className="text-xs text-gray-400">Durations</div>
                <div className="text-xs text-white font-medium">
                  {stats.allDurations.length > 0 ? `${stats.allDurations.length} bookings` : 'None'}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Total Nights</div>
                <div className="text-sm text-blue-400 font-semibold">{stats.totalNights}</div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Employees / Free</div>
                <div className="text-sm text-white font-medium">
                  {stats.employeeTags.length} / <span className="text-green-400">{stats.freeBeds}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400">Total Cost</div>
                  <div className="text-sm text-green-400 font-bold">€{stats.totalCost.toFixed(2)}</div>
                </div>
                
                <button
                  onClick={() => setEditingHotel(hotel.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 bg-blue-600 bg-opacity-20 hover:bg-opacity-40 rounded transition-all"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            </div>
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
                <span className="text-sm font-semibold text-gray-300">Contact Details (Optional)</span>
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
                        Address
                      </label>
                      <input
                        type="text"
                        value={hotel.address}
                        onChange={(e) => handleUpdateHotel(hotel.id, 'address', e.target.value)}
                        placeholder="Street address"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Phone className="w-3 h-3" />
                        Phone
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
                          Open website <ExternalLink className="w-3 h-3" />
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
                {isCalendarVisible ? 'Hide' : 'Show'} Calendar View
              </button>
            </div>

            {isCalendarVisible && renderCalendarView(hotel)}

            {/* Duration Tabs - FIXED: Horizontal Tabs */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 border-b border-gray-700">
                {hotel.durations.map((duration, index) => (
                  <button
                    key={duration.id}
                    onClick={() => setActiveTab(hotel.id, duration.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
                      activeTab === duration.id
                        ? `${generateDurationColor(index)} bg-opacity-30 border-b-2 border-opacity-100 font-semibold`
                        : 'bg-gray-800 hover:bg-gray-750'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${generateDurationColor(index)}`}></div>
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
                    Add Duration
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
                  <p className="text-gray-400 text-sm">No booking durations yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-20 shadow-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                🚀 EuroTrack
                <span className="text-sm font-normal text-gray-400 px-3 py-1 bg-gray-800 rounded-full">
                  Hotel Logistics
                </span>
              </h1>
            </div>

            {/* Global Stats - FIXED: Show Total Cost and Free Beds */}
            <div className="flex gap-4">
              <div className="px-5 py-3 bg-green-600 bg-opacity-20 rounded-lg border border-green-500">
                <div className="text-xs text-gray-400 mb-1">Total Cost</div>
                <div className="text-2xl font-bold text-green-400">€{stats.totalSpend.toFixed(2)}</div>
              </div>
              
              <div className="px-5 py-3 bg-blue-600 bg-opacity-20 rounded-lg border border-blue-500">
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Bed className="w-4 h-4" />
                  Free Beds
                </div>
                <div className="text-2xl font-bold text-blue-400">{stats.freeBeds}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Company Tabs */}
      {groupByCompany && (
        <div className="bg-gray-900 border-b border-gray-800 sticky top-[73px] z-10">
          <div className="container mx-auto px-6">
            <div className="flex gap-2 overflow-x-auto py-3">
              {companyTabs.map(company => (
                <button
                  key={company}
                  onClick={() => setSelectedCompany(company)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                    selectedCompany === company
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  {company}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
                onChange={(e) => {
                  setGroupByCompany(e.target.checked);
                  if (!e.target.checked) setSelectedCompany('All');
                }}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600"
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
                {groupByCompany && selectedCompany !== 'All' ? selectedCompany : 'All Hotels'}
              </h2>
              <p className="text-gray-400">
                {monthNames[selectedMonth]} {selectedYear}
              </p>
            </div>

            {addingHotel ? (
              <form onSubmit={handleSaveNewHotel} className="flex items-center gap-2">
                <input
                  type="text"
                  name="name"
                  placeholder="Hotel name"
                  required
                  autoFocus
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                />
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  required
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                />
                <input
                  type="text"
                  name="companyTag"
                  placeholder="Company"
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
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all text-white font-semibold flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Add Hotel
              </button>
            )}
          </div>

          {/* Hotel List */}
          {filteredHotels.length === 0 ? (
            <div className="text-center py-20 bg-gray-900 rounded-lg border border-gray-800">
              <Building2 className="w-20 h-20 text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No Hotels Yet</h3>
              <p className="text-gray-500 mb-6">Start by adding your first hotel</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHotels.map(hotel => renderHotel(hotel))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
