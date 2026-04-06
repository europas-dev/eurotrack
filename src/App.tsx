import React, { useState, useMemo } from 'react';
import { Plus, UserPlus, Globe, ChevronDown, Calendar, Bell, Settings, Search } from 'lucide-react';
import { format, isWithinInterval, parseISO, endOfMonth, startOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

// --- TYPE DEFINITIONS ---
type RoomType = 'EZ' | 'DZ' | 'TZ';
interface Mitarbeiter { id: string; name: string; checkIn: string; checkOut: string; }
interface Duration { id: string; start: string; end: string; roomType: RoomType; price: number; discount: number; guests: Mitarbeiter[]; }
interface Hotel { id: string; name: string; city: string; company: string; web: string; durations: Duration[]; }

export default function App() {
  const [activeMonth, setActiveMonth] = useState(new Date(2026, 3, 1)); // April 2026
  const [hotels, setHotels] = useState<Hotel[]>([
    {
      id: '1', name: 'Hotel Essen', city: 'Essen', company: 'Siemens', web: 'https://hotel-essen.de',
      durations: [{
        id: 'd1', start: '2026-04-06', end: '2026-04-23', roomType: 'DZ', price: 88, discount: 0,
        guests: [
          { id: 'g1', name: 'Karim', checkIn: '2026-04-06', checkOut: '2026-04-15' }, // Leaves early
          { id: 'g2', name: 'Rahim', checkIn: '2026-04-06', checkOut: '2026-04-23' }
        ]
      }]
    }
  ]);

  // --- GLOBAL LOGIC ---
  const stats = useMemo(() => {
    const monthStart = startOfMonth(activeMonth);
    const monthEnd = endOfMonth(activeMonth);
    let totalSpend = 0;
    let freeBeds = 0;

    hotels.forEach(h => {
      h.durations.forEach(d => {
        // 1. Calculate Monthly Spend (Only nights within this month)
        const overlapNights = eachDayOfInterval({ start: parseISO(d.start), end: parseISO(d.end) })
          .filter(day => isWithinInterval(day, { start: monthStart, end: monthEnd })).length;
        totalSpend += (overlapNights * d.price);

        // 2. Calculate Free Beds (based on Today)
        const capacity = d.roomType === 'TZ' ? 3 : d.roomType === 'DZ' ? 2 : 1;
        const activeGuests = d.guests.filter(g => isWithinInterval(new Date(), { start: parseISO(g.checkIn), end: parseISO(g.checkOut) })).length;
        freeBeds += Math.max(0, capacity - activeGuests);
      });
    });
    return { totalSpend, freeBeds };
  }, [hotels, activeMonth]);

  return (
    <div className="flex h-screen bg-[#020617] text-white font-sans overflow-hidden">
      {/* LEFT NAVIGATION (Vertical Tabs) */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 bg-[#0F172A]">
        <div className="text-2xl font-black italic mb-10 text-blue-500">EURO<span className="text-yellow-500">TRACK.</span></div>
        <nav className="flex-1 space-y-2">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => (
            <button 
              key={m} 
              onClick={() => setActiveMonth(new Date(2026, i, 1))}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeMonth.getMonth() === i ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'opacity-40 hover:opacity-100'}`}
            >
              {m} 2026
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col">
        <header className="h-20 border-b border-white/5 px-10 flex justify-between items-center bg-[#0F172A]">
          <div className="flex gap-10">
            <div><p className="text-[10px] uppercase opacity-40 font-black">Monthly Spend</p><p className="text-xl font-bold">{stats.totalSpend} €</p></div>
            <div><p className="text-[10px] uppercase opacity-40 font-black">Available Beds</p><p className="text-xl font-bold text-emerald-400">{stats.totalFreeBeds}</p></div>
          </div>
          <div className="flex gap-4"><Calendar /><Bell /><Settings /></div>
        </header>

        <div className="p-10 overflow-y-auto space-y-6">
          {/* GROUP BY COMPANY (Siemens) */}
          <div className="space-y-4">
            <h2 className="text-xs font-black opacity-30 uppercase tracking-[0.3em]">Siemens AG</h2>
            {hotels.filter(h => h.company === 'Siemens').map(hotel => (
              <HotelRow key={hotel.id} hotel={hotel} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function HotelRow({ hotel }: { hotel: Hotel }) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden transition-all">
      {/* MAIN ROW */}
      <div className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex gap-6 items-center">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold">H</div>
          <div>
            <h3 className="text-xl font-bold leading-none">{hotel.name}</h3>
            <p className="text-xs opacity-40 mt-1">{hotel.city}</p>
          </div>
        </div>
        <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="p-8 pt-0 border-t border-white/5 animate-in slide-in-from-top-2">
          {/* HORIZONTAL DURATION TABS */}
          <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
            {hotel.durations.map((d, i) => (
              <button key={d.id} onClick={() => setActiveTab(i)} className={`px-4 py-2 rounded-t-lg text-xs font-bold ${activeTab === i ? 'bg-blue-600' : 'opacity-40'}`}>
                {format(parseISO(d.start), 'dd.MM')} - {format(parseISO(d.end), 'dd.MM')} ({d.roomType})
              </button>
            ))}
            <button className="px-3 opacity-40 hover:opacity-100"><Plus size={16}/></button>
          </div>

          {/* GUEST SLOTS WITH GAP DETECTION */}
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: hotel.durations[activeTab].roomType === 'TZ' ? 3 : hotel.durations[activeTab].roomType === 'DZ' ? 2 : 1 }).map((_, i) => {
              const guest = hotel.durations[activeTab].guests[i];
              const isFullDuration = guest && isSameDay(parseISO(guest.checkOut), parseISO(hotel.durations[activeTab].end));

              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 relative min-h-[80px]">
                  {guest ? (
                    <>
                      <div className="flex justify-between items-start">
                        <span className="font-bold">{guest.name}</span>
                        {!isFullDuration && (
                          <div className="group relative">
                            <UserPlus size={16} className="text-emerald-400 cursor-pointer animate-pulse" />
                            <span className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-[10px] p-2 rounded whitespace-nowrap">Fill remaining nights?</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] opacity-40 mt-1">{guest.checkIn} - {guest.checkOut}</p>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-20 border-2 border-dashed border-white/10 rounded-xl">
                      <Plus size={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* HOTEL DETAILS DROPDOWN SECTION */}
          <div className="mt-8 grid grid-cols-4 gap-8 pt-8 border-t border-white/5 text-[10px] font-bold uppercase tracking-widest opacity-40">
            <div><p>Address</p><p className="text-white normal-case mt-1">{hotel.city}, Germany</p></div>
            <div><p>Contact</p><p className="text-white normal-case mt-1">Max Mustermann</p></div>
            <div><p>Web</p><a href={hotel.web} target="_blank" className="text-blue-400 flex items-center gap-1 mt-1 normal-case hover:underline"><Globe size={12}/> Visit Site</a></div>
          </div>
        </div>
      )}
    </div>
  );
}
