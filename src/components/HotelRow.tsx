import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { MapPin, User, ChevronDown, Building2, Calendar, Plus, Moon } from 'lucide-react';

export const HotelRow = ({ entry, t, isDarkMode }: any) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={cn("border rounded-[2.5rem] overflow-hidden mb-6", isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200")}>
      <div className="grid grid-cols-6 items-center px-10 py-8 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="col-span-2 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center"><Building2 size={24} /></div>
          <div><p className="font-black text-lg leading-tight">{entry.name || 'New Hotel'}</p></div>
        </div>
        <div className="text-xs font-bold opacity-50 flex items-center gap-2"><Calendar size={14}/> 01.04 - 07.04</div>
        <div className="flex items-center gap-1.5 font-black text-blue-500">7 <Moon size={14} /></div>
        <div className="font-black text-lg text-emerald-500">{entry.free_beds || 3} Beds</div>
        <div className="flex items-center justify-end gap-6">
          <p className="font-black text-xl">{(entry.total_cost || 0).toLocaleString('de-DE')} €</p>
          <ChevronDown size={20} className={cn("transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div className="px-10 pb-10 space-y-6">
          <div className="grid grid-cols-5 gap-6 p-8 bg-white/5 rounded-3xl border border-white/5">
             {['Address', 'Contact', 'Phone', 'Email', 'Website'].map(l => (
               <div key={l}><p className="text-[8px] font-black opacity-30 uppercase mb-2">{l}</p><input className="w-full bg-white/5 border border-white/5 p-3 rounded-xl text-xs font-bold" placeholder="..." /></div>
             ))}
          </div>
          <button className="w-full py-5 border-2 border-dashed border-blue-500/20 bg-blue-500/5 rounded-3xl flex items-center justify-center text-blue-500 font-black uppercase tracking-widest text-xs hover:bg-blue-500/10 transition-all">
            <Plus size={16} className="mr-2" /> Add Booking Duration
          </button>
        </div>
      )}
    </div>
  );
};
