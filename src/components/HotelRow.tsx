import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { 
  MapPin, User, Phone, Mail, Globe, Calendar, Plus, Moon, 
  Trash2, ChevronDown, Building2, UserPlus, AlertCircle, Percent, Calculator, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const HotelRow = ({ entry, t, isDarkMode }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [durations, setDurations] = useState<any[]>(entry.durations || []);

  // --- CALCULATION LOGIC ---
  const totalNightsAllDurations = durations.reduce((sum, d) => sum + (Number(d.nights) || 0), 0);
  
  const getOccupancy = () => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    durations.forEach(d => {
      const bedCount = d.roomType === 'TZ' ? 3 : d.roomType === 'DZ' ? 2 : 1;
      totalBeds += bedCount;
      occupiedBeds += (d.employees?.length || 0);
    });
    return { free: totalBeds - occupiedBeds, total: totalBeds };
  };

  const occupancy = getOccupancy();

  // --- ACTIONS ---
  const addDuration = () => {
    const newDuration = {
      id: Date.now(),
      start: new Date().toISOString().split('T')[0],
      end: new Date(Date.now() + 604800000).toISOString().split('T')[0],
      nights: 7,
      roomType: 'DZ',
      priceNight: 0,
      discount: 0,
      discountType: 'percent', // or 'amount'
      employees: []
    };
    const updated = [...durations, newDuration];
    setDurations(updated);
    saveToDb(updated);
  };

  const saveToDb = async (updatedDurations: any[]) => {
    const totalCost = updatedDurations.reduce((sum, d) => {
      const base = d.nights * d.priceNight;
      const discount = d.discountType === 'percent' ? (base * d.discount / 100) : d.discount;
      return sum + (base - discount);
    }, 0);

    const { error } = await supabase
      .from('hotel_entries')
      .update({ 
        durations: updatedDurations,
        total_cost: totalCost,
        free_beds: getOccupancy().free 
      })
      .eq('id', entry.id);
    
    if (error) toast.error("Update failed");
  };

  const getEmployeeColor = (emp: any, durationEnd: string) => {
    const today = new Date();
    const checkOut = new Date(emp.checkOut);
    const end = new Date(durationEnd);
    const diffDays = Math.ceil((checkOut.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (checkOut < today) return 'text-red-500 bg-red-500/10 border-red-500/20'; // Red: Completed
    if (diffDays <= 3 && diffDays > 0) return 'text-orange-500 bg-orange-500/10 border-orange-500/20'; // Orange: Checkout in 3 days
    if (new Date(emp.checkIn) > today) return 'text-blue-400 bg-blue-400/10 border-blue-400/20'; // Blue: Assigned but not started
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'; // Normal: Staying
  };

  return (
    <div className={cn("border rounded-[2.5rem] overflow-hidden mb-6 transition-all", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
      
      {/* --- MAIN ROW (Source 1 & 2) --- */}
      <div className="grid grid-cols-12 items-center px-10 py-8 cursor-pointer hover:bg-white/5" onClick={() => setIsOpen(!isOpen)}>
        <div className="col-span-3 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Building2 size={24} /></div>
          <div>
            <p className="font-black text-lg text-white">{entry.name}</p>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest leading-none mt-1">{entry.city}</p>
          </div>
        </div>

        {/* All Durations with Types (Source 2) */}
        <div className="col-span-3 flex flex-wrap gap-2">
          {durations.map((d, i) => (
            <div key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black">
              <span className="text-blue-400">{d.roomType}</span>: {d.start.split('-').reverse().join('.').slice(0,5)} - {d.end.split('-').reverse().join('.').slice(0,5)}
            </div>
          ))}
        </div>

        {/* Total Nights (Source 2) */}
        <div className="col-span-1 text-center">
          <p className="text-lg font-black text-white">{totalNightsAllDurations}</p>
          <p className="text-[8px] font-black opacity-30 uppercase">Nights</p>
        </div>

        {/* Occupancy (Source 2) */}
        <div className="col-span-1 text-center">
          <p className="text-lg font-black text-blue-500">{occupancy.free} / {occupancy.total}</p>
          <p className="text-[8px] font-black opacity-30 uppercase">Free Beds</p>
        </div>

        {/* Employee List (Source 2) */}
        <div className="col-span-2 flex -space-x-2 overflow-hidden px-4">
          {durations.flatMap(d => d.employees || []).slice(0, 4).map((emp, i) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0F172A] bg-blue-600 flex items-center justify-center text-[8px] font-black text-white">
              {emp.name?.slice(0,2).toUpperCase()}
            </div>
          ))}
          {occupancy.free > 0 && <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/20"><Plus size={12}/></div>}
        </div>

        {/* Total Sum (Source 2) */}
        <div className="col-span-2 flex items-center justify-end gap-6">
          <div className="text-right">
            <p className="text-xl font-black text-white">{(entry.total_cost || 0).toLocaleString('de-DE')} €</p>
          </div>
          <ChevronDown size={20} className={cn("opacity-30 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* --- DROPDOWN AREA (Source 4) --- */}
      {isOpen && (
        <div className="px-10 pb-10 space-y-8 animate-in fade-in slide-in-from-top-4">
          
          {/* Contact Details (Source 5) */}
          <div className="grid grid-cols-5 gap-6 p-8 bg-white/5 rounded-[2rem] border border-white/5">
             {[
               {label: 'Address', icon: <MapPin size={12}/>, val: entry.address},
               {label: 'Contact person', icon: <User size={12}/>, val: entry.contact_person},
               {label: 'Telefon', icon: <Phone size={12}/>, val: entry.phone},
               {label: 'Email', icon: <Mail size={12}/>, val: entry.email},
               {label: 'Web', icon: <Globe size={12}/>, val: entry.website, isLink: true},
             ].map((item, i) => (
               <div key={i}>
                 <p className="text-[8px] font-black opacity-30 uppercase mb-2 flex items-center gap-1">{item.icon} {item.label}</p>
                 <div className="flex items-center gap-2">
                    <input className="w-full bg-white/5 border border-white/5 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500/50" placeholder="..." defaultValue={item.val}/>
                    {item.isLink && item.val && <a href={item.val} target="_blank" rel="noreferrer" className="p-2 bg-blue-600 rounded-lg text-white"><ExternalLink size={14}/></a>}
                 </div>
               </div>
             ))}
          </div>

          {/* Booking Duration Engine (Source 6 & 7) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 flex items-center gap-2"><Calendar size={14}/> Booking Durations</h3>
               <button onClick={addDuration} className="p-3 bg-blue-600 text-white rounded-xl hover:scale-105 transition-all"><Plus size={20}/></button>
            </div>

            {durations.map((slot, sIdx) => {
              const bedCount = slot.roomType === 'TZ' ? 3 : slot.roomType === 'DZ' ? 2 : 1;
              return (
                <div key={slot.id} className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 relative overflow-hidden">
                  <div className="grid grid-cols-8 gap-4 items-end mb-8">
                    <div className="col-span-1">
                      <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-white">Start</p>
                      <input type="date" value={slot.start} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"/>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-white">End</p>
                      <input type="date" value={slot.end} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"/>
                    </div>
                    <div className="col-span-1 text-center">
                      <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-white">Nights</p>
                      <div className="p-3 font-black text-xs text-white">{slot.nights}</div>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-white">Room Type</p>
                      <select value={slot.roomType} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        <option value="EZ">EZ</option><option value="DZ">DZ</option><option value="TZ">TZ</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-white">Price/Night</p>
                      <div className="relative">
                        <input type="number" value={slot.priceNight} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"/>
                        <button className="absolute right-2 top-1.5 p-1.5 bg-blue-600 rounded-md text-[8px] font-black text-white hover:bg-blue-500">AUTO</button>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-white">Discount</p>
                      <div className="relative">
                        <input type="number" value={slot.discount} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white outline-none"/>
                        <button className="absolute right-2 top-1.5 p-1.5 opacity-30 text-white"><Percent size={12}/></button>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                       <p className="text-[8px] font-black opacity-30 mb-2 uppercase text-blue-400">Total Duration</p>
                       <p className="text-lg font-black text-white">0,00 €</p>
                    </div>
                  </div>

                  {/* Bed Slots Based on Room Type (Source 8, 9, 10, 11) */}
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: bedCount }).map((_, bIdx) => {
                      const emp = slot.employees?.[bIdx];
                      return (
                        <div key={bIdx} className={cn(
                          "p-4 rounded-2xl border transition-all relative group/bed",
                          emp ? getEmployeeColor(emp, slot.end) : "bg-white/5 border-dashed border-white/10"
                        )}>
                          {!emp ? (
                            <button className="w-full h-full flex flex-col items-center justify-center py-4">
                               <UserPlus size={20} className="mb-2 opacity-20"/>
                               <p className="text-[8px] font-black uppercase opacity-30 tracking-widest">Assign Employee</p>
                            </button>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <p className="text-[10px] font-black uppercase">{emp.name}</p>
                                <Trash2 size={12} className="opacity-0 group-hover/bed:opacity-100 cursor-pointer text-red-500"/>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div><p className="text-[6px] font-black opacity-50 uppercase">In</p><p className="text-[8px] font-bold">{emp.checkIn.split('-').reverse().join('.').slice(0,5)}</p></div>
                                <div><p className="text-[6px] font-black opacity-50 uppercase">Out</p><p className="text-[8px] font-bold">{emp.checkOut.split('-').reverse().join('.').slice(0,5)}</p></div>
                                <div><p className="text-[6px] font-black opacity-50 uppercase">Nts</p><p className="text-[8px] font-bold">{emp.nights}</p></div>
                              </div>
                              
                              {/* Substitution Icon (Source 12) */}
                              {new Date(emp.checkOut) < new Date(slot.end) && (
                                <button className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                  <Plus size={14}/>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
