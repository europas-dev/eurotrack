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
  Bed
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type RoomType = 'EZ' | 'DZ' | 'TZ';

interface Employee {
  id: string;
  name: string;
  checkIn: string; // ISO date string
  checkOut: string; // ISO date string
  costPerNight: number;
}

interface BookingDuration {
  id: string;
  startDate: string;
  endDate: string;
  roomType: RoomType;
  employees: (Employee | null)[]; // Array length matches room capacity
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
  const capacities: Record<RoomType, number> = {
    'EZ': 1,
    'DZ': 2,
    'TZ': 3,
  };
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
// MOCK DATA
// ============================================================================

const MOCK_DATA: Workspace = {
  hotels: [
    {
      id: 'h1',
      name: 'Hotel Adlon Berlin',
      city: 'Berlin',
      address: 'Unter den Linden 77, 10117 Berlin',
      contact: '+49 30 2261 0',
      webLink: 'https://www.hotel-adlon.de',
      companyTag: 'Siemens',
      durations: [
        {
          id: 'd1',
          startDate: '2024-04-01',
          endDate: '2024-04-14',
          roomType: 'DZ',
          employees: [
            {
              id: 'e1',
              name: 'Max Müller',
              checkIn: '2024-04-01',
              checkOut: '2024-04-10',
              costPerNight: 120,
            },
            {
              id: 'e2',
              name: 'Anna Schmidt',
              checkIn: '2024-04-01',
              checkOut: '2024-04-14',
              costPerNight: 120,
            },
          ],
        },
        {
          id: 'd2',
          startDate: '2024-04-15',
          endDate: '2024-04-30',
          roomType: 'TZ',
          employees: [
            {
              id: 'e3',
              name: 'Hans Weber',
              checkIn: '2024-04-15',
              checkOut: '2024-04-30',
              costPerNight: 100,
            },
            null,
            null,
          ],
        },
      ],
    },
    {
      id: 'h2',
      name: 'Maritim Hotel Munich',
      city: 'Munich',
      address: 'Goethestraße 7, 80336 München',
      contact: '+49 89 5521 70',
      webLink: 'https://www.maritim.de',
      companyTag: 'Siemens',
      durations: [
        {
          id: 'd3',
          startDate: '2024-04-25',
          endDate: '2024-05-05',
          roomType: 'EZ',
          employees: [
            {
              id: 'e4',
              name: 'Lisa Bauer',
              checkIn: '2024-04-25',
              checkOut: '2024-05-05',
              costPerNight: 150,
            },
          ],
        },
      ],
    },
    {
      id: 'h3',
      name: 'Steigenberger Frankfurt',
      city: 'Frankfurt',
      address: 'Am Kaiserplatz, 60311 Frankfurt',
      contact: '+49 69 2156 0',
      webLink: 'https://www.steigenberger.com',
      companyTag: 'Bosch',
      durations: [
        {
          id: 'd4',
          startDate: '2024-04-01',
          endDate: '2024-04-30',
          roomType: 'DZ',
          employees: [
            {
              id: 'e5',
              name: 'Thomas Klein',
              checkIn: '2024-04-01',
              checkOut: '2024-04-30',
              costPerNight: 130,
            },
            {
              id: 'e6',
              name: 'Sarah Wagner',
              checkIn: '2024-04-05',
              checkOut: '2024-04-20',
              costPerNight: 130,
            },
          ],
        },
      ],
    },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EuroTrackApp() {
  const [workspace] = useState<Workspace>(MOCK_DATA);
  const [selectedMonth, setSelectedMonth] = useState(3); // April (0-indexed)
  const [selectedYear] = useState(2024);
  const [currentDate] = useState('2024-04-08'); // Simulated current date
  const [expandedHotels, setExpandedHotels] = useState<Set<string>>(new Set());
  const [groupByCompany, setGroupByCompany] = useState(true);

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

            // Check if employee is active on current date
            const status = getEmployeeStatus(employee.checkIn, employee.checkOut, currentDate);
            if (status === 'active' || status === 'ending-soon') {
              occupiedBeds++;
            }
          }
        });

        // Count total beds for durations that overlap with current date
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
    };
  }, [workspace, monthStart, monthEnd, currentDate]);

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
  // HANDLERS
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

  const handleAddEmployee = (hotelId: string, durationId: string, slotIndex: number) => {
    alert(`Add employee to Hotel ${hotelId}, Duration ${durationId}, Slot ${slotIndex}`);
    // Implement modal/form logic here
  };

  const handleFillGap = (hotelId: string, durationId: string, employeeId: string) => {
    alert(`Fill gap for Employee ${employeeId} in Hotel ${hotelId}, Duration ${durationId}`);
    // Implement gap-filling logic here
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      case 'ending-soon': return 'bg-orange-500';
      case 'completed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const calculateHotelMonthCost = (hotel: Hotel): number => {
    let total = 0;
    hotel.durations.forEach(duration => {
      duration.employees.forEach(employee => {
        if (employee) {
          const days = calculateDaysInMonth(
            employee.checkIn,
            employee.checkOut,
            monthStart,
            monthEnd
          );
          total += days * employee.costPerNight;
        }
      });
    });
    return total;
  };

  const renderEmployeeSlot = (
    employee: Employee | null,
    duration: BookingDuration,
    slotIndex: number,
    hotelId: string
  ) => {
    if (!employee) {
      return (
        <div
          className="flex items-center justify-center p-3 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 hover:border-green-500 transition-all cursor-pointer"
          onClick={() => handleAddEmployee(hotelId, duration.id, slotIndex)}
        >
          <Plus className="w-5 h-5 text-green-500" />
          <span className="ml-2 text-sm text-gray-400">Add Employee</span>
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

    return (
      <div className={`p-3 rounded-lg border-2 ${getStatusColor(status)} border-opacity-50 bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{employee.name}</span>
              {gap && (
                <button
                  onClick={() => handleFillGap(hotelId, duration.id, employee.id)}
                  className="p-1 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                  title="Fill gap"
                >
                  <UserPlus className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {employee.checkIn} → {employee.checkOut}
            </div>
            <div className="text-xs text-gray-300 mt-1">
              €{employee.costPerNight}/night × {daysInMonth} days = €{employee.costPerNight * daysInMonth}
            </div>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(status)}`}>
            {status.replace('-', ' ').toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  const renderDuration = (duration: BookingDuration, hotel: Hotel) => {
    const capacity = getRoomCapacity(duration.roomType);
    const slots = Array(capacity).fill(null).map((_, i) => duration.employees[i] || null);

    return (
      <div key={duration.id} className="mb-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-white">
              {duration.startDate} → {duration.endDate}
            </span>
            <span className="px-2 py-1 bg-blue-600 rounded text-xs font-semibold text-white">
              {duration.roomType}
            </span>
            <span className="text-sm text-gray-400">
              ({capacity} {capacity === 1 ? 'bed' : 'beds'})
            </span>
          </div>
        </div>
        
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
    const monthlyCost = calculateHotelMonthCost(hotel);

    return (
      <div key={hotel.id} className="mb-4 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {/* Hotel Header */}
        <div
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750 transition-colors"
          onClick={() => toggleHotel(hotel.id)}
        >
          <div className="flex items-center gap-4 flex-1">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{hotel.name}</h3>
              <p className="text-sm text-gray-400">{hotel.city}</p>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 bg-purple-600 bg-opacity-20 rounded-full">
              <span className="text-sm font-medium text-purple-300">{hotel.companyTag}</span>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-lg font-bold text-green-400">
                €{monthlyCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 pt-0 border-t border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-900 rounded-lg">
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

            <div className="space-y-2">
              {hotel.durations.map(duration => renderDuration(duration, hotel))}
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
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                🚀 EuroTrack
                <span className="text-sm font-normal text-gray-400">Hotel Logistics</span>
              </h1>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="px-6 py-3 bg-green-600 bg-opacity-20 rounded-lg border border-green-500">
                <div className="text-xs text-gray-400 mb-1">Total Spend ({monthNames[selectedMonth]})</div>
                <div className="text-2xl font-bold text-green-400">
                  €{stats.totalSpend.toLocaleString()}
                </div>
              </div>
              
              <div className="px-6 py-3 bg-blue-600 bg-opacity-20 rounded-lg border border-blue-500">
                <div className="text-xs text-gray-400 mb-1">Free Beds (Today)</div>
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
        {/* Sidebar - Month Selector */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen p-4 sticky top-[73px] self-start">
          <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
            Select Month
          </h2>
          <div className="space-y-1">
            {monthNames.map((month, index) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(index)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  selectedMonth === index
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                }`}
              >
                {month} {selectedYear}
              </button>
            ))}
          </div>

          {/* Group Toggle */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={groupByCompany}
                onChange={(e) => setGroupByCompany(e.target.checked)}
                className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Group by Company</span>
            </label>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {monthNames[selectedMonth]} {selectedYear}
            </h2>
            <p className="text-gray-400">
              Showing bookings for {monthStart} to {monthEnd}
            </p>
          </div>

          {/* Hotel List */}
          <div className="space-y-6">
            {groupedHotels.map(group => (
              <div key={group.company}>
                {groupByCompany && (
                  <div className="mb-4 pb-2 border-b-2 border-purple-600">
                    <h3 className="text-xl font-bold text-purple-400">{group.company}</h3>
                  </div>
                )}
                
                {group.hotels.map(hotel => renderHotel(hotel))}

                {groupByCompany && (
                  <div className="mt-2 text-right">
                    <span className="text-sm text-gray-400">Subtotal: </span>
                    <span className="text-lg font-bold text-purple-400">
                      €{group.hotels.reduce((sum, h) => sum + calculateHotelMonthCost(h), 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
