import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { 
  Building2, ChevronDown, Calendar, MapPin, User, Phone, 
  Mail, Globe, ExternalLink, Plus, Trash2, AlertCircle, CheckCircle2 
} from 'lucide-react';

export const HotelRow = ({ entry, isDarkMode, onDelete }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // --- COLOR LOGIC ENGINE ---
  const getStatusStyle = (emp: any, durationEnd: string) => {
    const today = new Date();
    const checkIn = new Date(emp.checkIn);
    const checkOut = new Date(emp.checkOut);
    const end = new Date(durationEnd);
    
    const diffDays = Math.ceil((checkOut.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (checkOut < today) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'; // Green: Completed
    if (checkOut.getTime() !== end.getTime()) return 'bg-orange-500/10 text-orange-500 border-orange-500/20'; // Orange: Early Checkout
    if (diffDays <= 3 && diffDays > 0) return 'bg-red-500/10 text-red-500 border-red-500/20'; // Red: 3 days left
    if (checkIn > today) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // Blue: Future
    return 'bg-slate-500/10 text-slate-300 border-white/10'; // Normal: Staying
  };

  return (
    <div className={cn(
      "mb-4 rounded-xl border transition-all duration-300 overflow-hidden",
      isDarkMode ? "bg-[#0B1224] border-white/5" : "bg-white border-slate-200"
    )}>
      {/* MAIN ROW */}
      <div className="grid grid-cols-12 items-center px-8 py-5 cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
        <div className="col-span-3 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Building2 size={20}/></div>
          <div>
            <h3 className="text-base font-bold text-white leading-none">{entry.name}</h3>
            <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest">{entry.city}</span>
          </div>
        </div>

        <div className="col-span-3 flex flex-wrap gap-2">
          {entry.durations?.map((d: any, i: number) => (
            <div key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-bold text-slate-400">
              {d.roomType}: {d.start} - {d.end}
            </div>
          ))}
        </div>

        <div className="col-span-1 text-center font-mono">
          <p className="text-sm font-bold text-white">{entry.totalNights || 0}</p>
          <p className="text-[7px] font-bold opacity-30 uppercase">Nights</p>
        </div>

        <div className="col-span-1 text-center font-mono">
          <p className="text-sm font-bold text-emerald-500">{entry.freeBeds || 0}</p>
          <p className="text-[7px] font-bold opacity-30 uppercase">Free</p>
        </div>

        <div className="col-span-2 flex flex-wrap gap-1 px-2">
          {entry.assignedEmployees?.map((name: string, i: number) => (
            <div key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-bold text-white uppercase tracking-tighter">
              {name}
            </div>
          ))}
        </div>

        <div className="col-span-2 flex items-center justify-end gap-4">
          <div className="text-right font-mono">
            <p className="text-base font-bold text-white">{entry.totalCost?.toLocaleString('de-DE')} €</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
            className="p-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all"
          >
            <Trash2 size={16}/>
          </button>
          <ChevronDown size={18} className={cn("opacity-20 transition-transform", isOpen && "rotate-180")}/>
        </div>
      </div>

      {/* DROPDOWN AREA */}
      {isOpen && (
        <div className="px-8 pb-8 space-y-6 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-5 gap-4 p-5 bg-white/5 rounded-xl border border-white/5">
             {['Address', 'Contact person', 'Telefon', 'Email', 'Web'].map((label, i) => (
               <div key={i}>
                 <p className="text-[7px] font-bold opacity-30 uppercase mb-1">{label}</p>
                 <input className="w-full bg-transparent text-[10px] font-bold text-white outline-none border-b border-white/5 focus:border-blue-500 py-1" placeholder="..." />
               </div>
             ))}
          </div>

          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-blue-500">Booking Durations</h4>
            <button className="p-1.5 bg-blue-600 rounded-md text-white hover:scale-105 transition-transform"><Plus size={16}/></button>
          </div>

          {/* DURATION TABS & SLOTS Logic would render here */}
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0F172A] border border-white/10 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24}/>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
            <p className="text-sm text-slate-400 mb-6">This entry will be permanently deleted. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-bold text-white">No, Keep it</button>
              <button onClick={() => { onDelete(); setShowDeleteModal(false); }} className="flex-1 py-3 bg-red-600 rounded-xl text-xs font-bold text-white">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
