import React, { useState, useMemo } from 'react';
import { Plus, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';

// --- THE LOGIC ENGINE ---
export default function EuroTrackApp() {
  const [activeMonth, setActiveMonth] = useState(3); // April
  const [hotels, setHotels] = useState([
    {
      id: 'h1',
      name: 'Hotel Essen',
      company: 'Siemens',
      roomType: 'DZ', // 2 Beds
      durations: [
        { 
          id: 'd1', 
          start: '2026-04-06', 
          end: '2026-04-23', 
          price: 88,
          employees: [
            { id: 'e1', name: 'Karim', in: '2026-04-06', out: '2026-04-15' }, // Leaves early!
            { id: 'e2', name: 'Rahim', in: '2026-04-06', out: '2026-04-23' }
          ]
        }
      ]
    }
  ]);

  // --- 1. GLOBAL CALCULATIONS ---
  const stats = useMemo(() => {
    let totalSpend = 0;
    let totalFreeBeds = 0;

    hotels.forEach(hotel => {
      hotel.durations.forEach(dur => {
        // Only calculate for active month
        const nights = 17; // Use date-fns to get actual nights in this month
        totalSpend += nights * dur.price;
        
        // Bed Logic
        const capacity = hotel.roomType === 'TZ' ? 3 : hotel.roomType === 'DZ' ? 2 : 1;
        const activeNow = dur.employees.filter(e => new Date(e.out) > new Date()).length;
        totalFreeBeds += (capacity - activeNow);
      });
    });

    return { totalSpend, totalFreeBeds };
  }, [hotels, activeMonth]);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-8">
      {/* TOP HEADER STATS */}
      <div className="flex gap-12 mb-12 border-b border-white/10 pb-8">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-40">Monthly Spend</p>
          <p className="text-3xl font-black">{stats.totalSpend.toLocaleString()} €</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-40">Available Beds</p>
          <p className="text-3xl font-black text-emerald-400">{stats.totalFreeBeds}</p>
        </div>
      </div>

      {/* RENDER THE ROWS */}
      {hotels.map(hotel => (
        <HotelRow key={hotel.id} hotel={hotel} />
      ))}
    </div>
  );
}

// --- THE COMPONENT THAT HANDLES THE "PLUS" ICON ---
function HotelRow({ hotel }) {
  const capacity = hotel.roomType === 'TZ' ? 3 : hotel.roomType === 'DZ' ? 2 : 1;

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{hotel.name} <span className="text-blue-500 text-sm ml-2">{hotel.company}</span></h2>
        <div className="px-4 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs font-bold">{hotel.roomType} Room</div>
      </div>

      {hotel.durations.map(dur => (
        <div key={dur.id} className="grid grid-cols-4 gap-4 bg-black/20 p-4 rounded-xl">
          {/* We create slots based on CAPACITY (e.g. 2 slots for DZ) */}
          {[...Array(capacity)].map((_, index) => {
            const employee = dur.employees[index];
            const hasGap = employee && new Date(employee.out) < new Date(dur.end);

            return (
              <div key={index} className="relative group p-4 border border-white/5 rounded-lg bg-white/5">
                {employee ? (
                  <div>
                    <p className="font-bold">{employee.name}</p>
                    <p className="text-[10px] opacity-40">{employee.in} - {employee.out}</p>
                    
                    {/* THE SMART PLUS ICON: Shows up if employee leaves before duration ends */}
                    {hasGap && (
                      <button className="absolute -right-2 -top-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform">
                        <UserPlus size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full border-2 border-dashed border-white/10 opacity-20 hover:opacity-100 cursor-pointer">
                    <Plus size={20} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
