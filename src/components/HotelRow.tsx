import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { 
  MapPin, User, Phone, Mail, Globe, Calendar, Plus, Moon, 
  Trash2, ChevronDown, Building2, UserPlus, AlertCircle 
} from 'lucide-react';

interface HotelRowProps {
  entry: any;
  t: any;
  isDarkMode: boolean;
}

export const HotelRow: React.FC<HotelRowProps> = ({ entry, t, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(true);
  
  // Mock state for multiple durations - In a real sync, this comes from a 'durations' table
  const [durations, setDurations] = useState([
    { id: 1, checkIn: entry.check_in, checkOut: entry.check_out, roomType: entry.room_type || 'DZ', price: 0 }
  ]);

  const addDuration = () => {
    const last = durations[durations.length - 1];
    setDurations([...durations, { ...last, id: Date.now() }]);
  };

  return (
    <div className={cn(
      "border-b last:border-0 transition-all",
      isDarkMode ? "border-white/5 bg-[#0F172A]/50" : "border-slate-100 bg-white"
    )}>
      {/* MAIN HOTEL ROW */}
      <div className="grid grid-cols-6 items-center px-10 py-8 cursor-pointer hover:bg-blue-600/5 transition-colors" onClick={() => setIsOpen(!isOpen)}>
        <div className="col-span-2 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 size={24} />
          </div>
          <div>
            <p className="font-black text-lg leading-tight">{entry.hotel_name}</p>
            <p className="text-[10px] font-bold opacity-40 flex items-center gap-1 uppercase tracking-widest mt-1">
              <MapPin size={10} /> {entry.city}
            </p>
          </div>
        </div>
        
        <div className="flex gap-1 flex-wrap">
          {durations.map((d, i) => (
            <span key={i} className="px-3 py-1 bg-blue-600/10 text-blue-500 text-[10px] font-black rounded-full whitespace-nowrap">
              {d.checkIn.split('-').reverse().join('.').slice(0, 5)} - {d.checkOut.split('-').reverse().join('.').slice(0, 5)}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5 font-black">
          {durations.length * 7} <Moon size={14} className="opacity-30" />
        </div>

        <div>
          <p className="font-black text-lg text-blue-500">{entry.free_beds || 3}</p>
          <p className="text-[9px] font-black opacity-40 uppercase tracking-tighter">Free Beds</p>
        </div>

        <div className="flex items-center justify-end gap-6">
          <div className="text-right">
            <p className="font-black text-xl">{(entry.total_price || 0).toLocaleString('de-DE')} €</p>
          </div>
          <ChevronDown size={20} className={cn("opacity-30 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* DROPDOWN AREA */}
      {isOpen && (
        <div className="px-10 pb-10 space-y-6 animate-in fade-in slide-in-from-top-2">
          
          {/* CONTACT DETAILS */}
          <div className={cn("p-8 rounded-[2rem] border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
            <div className="flex items-center gap-2 mb-6 font-black text-[11px] uppercase tracking-widest opacity-60">
              <User size={14} /> Contact Details
            </div>
            <div className="grid grid-cols-5 gap-6">
              {['Address', 'Contact Person', 'Phone', 'Email', 'Website'].map((label) => (
                <div key={label}>
                  <p className="text-[8px] font-black uppercase opacity-40 mb-2 tracking-widest">{label}</p>
                  <input className={cn("w-full p-3 rounded-xl outline-none text-xs font-bold border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200")} placeholder="..." />
                </div>
              ))}
            </div>
          </div>

          {/* DURATION SLOTS & SUBSTITUTION ENGINE */}
          <div className={cn("p-8 rounded-[2rem] border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 font-black text-[11px] uppercase tracking-widest opacity-60">
                <Calendar size={14} /> Booking Durations
              </div>
              <button onClick={addDuration} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-700 transition-all">
                <Plus size={14} /> Add Booking Duration
              </button>
            </div>

            <div className="space-y-4">
              {durations.map((slot) => (
                <div key={slot.id} className={cn("p-6 rounded-2xl border relative group", isDarkMode ? "bg-slate-900 border-white/10" : "bg-white border-slate-200")}>
                  <div className="grid grid-cols-6 gap-6 items-end mb-6">
                    <div><p className="text-[8px] font-black opacity-40 mb-2 uppercase">Check In</p><input type="date" value={slot.checkIn} className="w-full p-2.5 border rounded-lg text-xs font-bold bg-transparent" /></div>
                    <div><p className="text-[8px] font-black opacity-40 mb-2 uppercase">Check Out</p><input type="date" value={slot.checkOut} className="w-full p-2.5 border rounded-lg text-xs font-bold bg-transparent" /></div>
                    <div><p className="text-[8px] font-black opacity-40 mb-2 uppercase">Nights</p><p className="font-black text-xs py-2">7</p></div>
                    <div>
                      <p className="text-[8px] font-black opacity-40 mb-2 uppercase">Room Type</p>
                      <select className="w-full p-2.5 border rounded-lg text-xs font-bold bg-transparent outline-none">
                        <option>EZ</option><option selected>DZ</option><option>TZ</option>
                      </select>
                    </div>
                    <div><p className="text-[8px] font-black opacity-40 mb-2 uppercase">Price/Night</p><input className="w-full p-2.5 border rounded-lg text-xs font-bold bg-transparent" placeholder="0 €" /></div>
                    <div className="text-right"><p className="text-[8px] font-black opacity-40 mb-2 uppercase text-blue-500">Total</p><p className="font-black text-sm py-2">0,00 €</p></div>
                  </div>

                  {/* EMPLOYEES & SUBSTITUTION LOGIC */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Employee 1: Regular Stay */}
                    <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-between group/emp">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold">JD</div>
                          <div><p className="text-[10px] font-black uppercase">John Doe</p><p className="text-[8px] opacity-50">Regular Stay</p></div>
                       </div>
                       <Trash2 size={14} className="opacity-0 group-hover/emp:opacity-100 text-red-500 cursor-pointer" />
                    </div>

                    {/* Employee 2: Crimson Red (Early Check-Out) */}
                    <div className="p-4 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white">MK</div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-red-500">Max Kraft</p>
                            <p className="text-[8px] font-bold flex items-center gap-1 uppercase tracking-tighter text-red-400">
                              <AlertCircle size={8} /> Early Check-Out (05.04)
                            </p>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* THE SUBSTITUTION TRIGGER (Appears because Max Kraft left early) */}
                  <button className="mt-4 w-full py-4 border-2 border-dashed border-blue-600/30 bg-blue-600/5 rounded-xl flex items-center justify-center font-black text-[10px] text-blue-500 uppercase tracking-widest hover:bg-blue-600/10 transition-all">
                    <UserPlus size={14} className="mr-2" /> Add Substitute for remaining 4 nights
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
