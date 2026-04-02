import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { MapPin, User, Phone, Mail, Globe, Calendar, Plus, Moon, Trash2, ChevronDown, Building2 } from 'lucide-react';

interface HotelRowProps {
  entry: any;
  t: any;
  isDarkMode: boolean;
}

export const HotelRow: React.FC<HotelRowProps> = ({ entry, t, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!entry) return null;

  return (
    <div className="border-b border-slate-100 last:border-0 group bg-white">
      {/* HEADER ROW (The Summary) */}
      <div className="grid grid-cols-6 items-center px-10 py-8">
        <div className="col-span-2 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shadow-sm">
            <Building2 size={24} />
          </div>
          <div>
            <p className="font-black text-[#001A41] text-lg leading-tight">{entry.hotel_name || 'New Hotel'}</p>
            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest mt-1">
              <MapPin size={10} /> {entry.city || 'CITY'}
            </p>
          </div>
        </div>
        
        <div className="text-xs font-bold text-slate-900 bg-slate-50 px-3 py-1 rounded-full w-fit">
          {entry.check_in?.split('-').reverse().join('.').slice(0, 5) || '02.04'} - {entry.check_out?.split('-').reverse().join('.').slice(0, 5) || '09.04'}
        </div>

        <div className="flex items-center gap-1.5 font-black text-[#001A41]">
          21 <Moon size={14} className="text-slate-300" />
        </div>

        <div>
          <p className="font-black text-[#001A41] text-lg">{entry.free_beds || 3}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Free Beds</p>
        </div>

        <div className="flex items-center justify-end gap-6">
          <div className="text-right">
            <p className="font-black text-[#001A41] text-xl">{(entry.total_price || 0).toLocaleString('de-DE')} €</p>
          </div>
          <button onClick={() => setIsOpen(!isOpen)} className={cn("p-2 text-slate-300 hover:text-blue-600 transition-transform", isOpen && "rotate-180")}>
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      {/* EXPANDABLE CONTENT (The Logic) */}
      {isOpen && (
        <div className="px-10 pb-10 space-y-6">
          {/* 1. CONTACT DETAILS */}
          <div className="bg-white border border-slate-100 rounded-[1.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6 font-black text-[11px] text-[#001A41] uppercase tracking-widest">
              <User size={14} className="text-blue-600" /> Contact Details
            </div>
            <div className="grid grid-cols-5 gap-6">
              {['Address', 'Contact Person', 'Phone', 'Email', 'Website'].map((label) => (
                <div key={label}>
                  <p className="text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">{label}</p>
                  <input className="w-full bg-[#F8FAFC] border border-slate-100 rounded-xl p-3 outline-none text-xs font-bold text-[#001A41]" placeholder="..." />
                </div>
              ))}
            </div>
          </div>

          {/* 2. SUBSTITUTION ENGINE (Duration Slots) */}
          <div className="bg-white border border-slate-100 rounded-[1.5rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 font-black text-[11px] text-[#001A41] uppercase tracking-widest">
                <Calendar size={14} className="text-blue-600" /> Booking Durations
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-[#0038A8] text-white text-[10px] font-black rounded-xl shadow-lg">
                <Plus size={14} /> Add Booking Duration
              </button>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-6">
              <div className="grid grid-cols-6 gap-6 items-end">
                <div><p className="text-[8px] font-black text-slate-400 mb-2 uppercase">Check In</p><input type="date" value={entry.check_in} className="w-full p-2.5 border rounded-lg text-xs font-bold" /></div>
                <div><p className="text-[8px] font-black text-slate-400 mb-2 uppercase">Check Out</p><input type="date" value={entry.check_out} className="w-full p-2.5 border rounded-lg text-xs font-bold" /></div>
                <div><p className="text-[8px] font-black text-slate-400 mb-2 uppercase">Total Nights</p><p className="font-black text-xs py-2">7</p></div>
                <div><p className="text-[8px] font-black text-slate-400 mb-2 uppercase">Room Type</p><select className="w-full p-2.5 border rounded-lg text-xs font-bold"><option>EZ</option><option>DZ</option><option>TZ</option></select></div>
                <div><p className="text-[8px] font-black text-slate-400 mb-2 uppercase">Price / Night</p><input className="w-full p-2.5 border rounded-lg text-xs font-bold" placeholder="0 €" /></div>
                <div className="text-right"><p className="text-[8px] font-black text-slate-400 mb-2 uppercase">Total (Duration)</p><p className="font-black text-sm text-blue-900 py-2">0,00 €</p></div>
              </div>

              {/* THE SUBSTITUTION SLOT (The Green/Blue Dashed Box) */}
              <button className="mt-6 w-full py-5 border-2 border-dashed border-[#CCFBE1] bg-[#F1FDF6] rounded-2xl flex items-center justify-center font-black text-[10px] text-[#00A84E] uppercase tracking-widest hover:bg-[#CCFBE1] transition-all">
                <Plus size={16} className="mr-2" /> Add Substitute / Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
