// src/components/HotelRow.tsx
import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { 
  Building2, ChevronDown, MapPin, 
  Trash2, AlertCircle, Phone, Mail, Globe
} from 'lucide-react';

interface HotelRowProps {
  entry: any;
  isDarkMode: boolean;
  onDelete: (id: string) => void;
}

export function HotelRow({ entry, isDarkMode, onDelete }: HotelRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className={cn(
      "mb-3 rounded-xl border transition-all duration-300 overflow-hidden",
      isDarkMode ? "bg-[#0B1224] border-white/5 hover:border-white/10" : "bg-white border-slate-200 hover:border-slate-300"
    )}>
      {/* MAIN ROW */}
      <div 
        className="grid grid-cols-12 items-center px-8 py-5 cursor-pointer group hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Hotel Name & City */}
        <div className="col-span-2 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">{entry.name}</h3>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-widest",
              isDarkMode ? "text-slate-500" : "text-slate-400"
            )}>
              {entry.city}
            </span>
          </div>
        </div>

        {/* Company Tag */}
        <div className="col-span-1">
          <span className={cn(
            "px-3 py-1.5 rounded-full text-xs font-bold",
            isDarkMode ? "bg-purple-600/20 text-purple-300 border border-purple-500/30" : "bg-purple-100 text-purple-700"
          )}>
            {entry.companyTag}
          </span>
        </div>

        {/* Durations */}
        <div className="col-span-3 flex flex-wrap gap-2">
          {entry.durations?.slice(0, 3).map((d: any, i: number) => (
            <div key={i} className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold border",
              isDarkMode ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600"
            )}>
              {d.start} - {d.end} (⓷ {d.roomType})
            </div>
          ))}
          {entry.durations?.length > 3 && (
            <div className="px-2 py-1 text-[9px] text-slate-400">
              +{entry.durations.length - 3} more
            </div>
          )}
        </div>

        {/* Total Nights */}
        <div className="col-span-1 text-center">
          <p className="text-sm font-bold text-blue-400">{entry.totalNights || 0}</p>
          <p className={cn("text-[9px] font-bold uppercase", isDarkMode ? "text-slate-500" : "text-slate-400")}>
            Nights
          </p>
        </div>

        {/* Free Beds */}
        <div className="col-span-1 text-center">
          <p className="text-sm font-bold text-green-400">{entry.freeBeds || 0}</p>
          <p className={cn("text-[9px] font-bold uppercase", isDarkMode ? "text-slate-500" : "text-slate-400")}>
            Free
          </p>
        </div>

        {/* Employees */}
        <div className="col-span-2 flex flex-wrap gap-1">
          {entry.assignedEmployees?.slice(0, 2).map((name: string, i: number) => (
            <span key={i} className={cn(
              "px-2 py-1 rounded text-[9px] font-bold uppercase border",
              isDarkMode ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600"
            )}>
              {name}
            </span>
          ))}
          {entry.assignedEmployees?.length > 2 && (
            <span className="text-[9px] text-slate-400">+{entry.assignedEmployees.length - 2}</span>
          )}
        </div>

        {/* Total Cost */}
        <div className="col-span-1 text-right">
          <p className="text-base font-bold text-white">
            €{(entry.totalCost || 0).toLocaleString('de-DE')}
          </p>
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-center justify-end gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
            className={cn(
              "p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100",
              isDarkMode ? "hover:bg-red-600/20 text-red-400" : "hover:bg-red-100 text-red-600"
            )}
          >
            <Trash2 size={16} />
          </button>
          <ChevronDown size={18} className={cn(
            "transition-transform",
            isDarkMode ? "text-slate-600" : "text-slate-400",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* EXPANDED SECTION */}
      {isOpen && (
        <div className={cn(
          "px-8 pb-8 pt-4 border-t space-y-6",
          isDarkMode ? "border-white/5 bg-white/[0.01]" : "border-slate-200 bg-slate-50/50"
        )}>
          {/* Contact Details */}
          <div className={cn(
            "grid grid-cols-5 gap-4 p-4 rounded-xl border",
            isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
          )}>
            <div>
              <label className={cn("text-[9px] font-bold uppercase mb-2 block", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                Address
              </label>
              <input 
                type="text"
                defaultValue={entry.address || ''}
                placeholder="Add address..."
                className={cn(
                  "w-full px-2 py-1.5 rounded-lg text-sm outline-none border transition-all",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                )}
              />
            </div>
            <div>
              <label className={cn("text-[9px] font-bold uppercase mb-2 block", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                <Phone size={12} className="inline mr-1" /> Phone
              </label>
              <input 
                type="text"
                defaultValue={entry.contact || ''}
                placeholder="Add phone..."
                className={cn(
                  "w-full px-2 py-1.5 rounded-lg text-sm outline-none border transition-all",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                )}
              />
            </div>
            <div>
              <label className={cn("text-[9px] font-bold uppercase mb-2 block", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                <Mail size={12} className="inline mr-1" /> Email
              </label>
              <input 
                type="email"
                defaultValue={entry.email || ''}
                placeholder="Add email..."
                className={cn(
                  "w-full px-2 py-1.5 rounded-lg text-sm outline-none border transition-all",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                )}
              />
            </div>
            <div>
              <label className={cn("text-[9px] font-bold uppercase mb-2 block", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                <Globe size={12} className="inline mr-1" /> Website
              </label>
              <input 
                type="url"
                defaultValue={entry.webLink || ''}
                placeholder="Add URL..."
                className={cn(
                  "w-full px-2 py-1.5 rounded-lg text-sm outline-none border transition-all",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                )}
              />
            </div>
            <div>
              <label className={cn("text-[9px] font-bold uppercase mb-2 block", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                City
              </label>
              <input 
                type="text"
                defaultValue={entry.city || ''}
                placeholder="Add city..."
                className={cn(
                  "w-full px-2 py-1.5 rounded-lg text-sm outline-none border transition-all",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                )}
              />
            </div>
          </div>

          {/* Calendar & Durations would go here */}
          <div className={cn(
            "p-4 rounded-lg border text-center",
            isDarkMode ? "bg-white/5 border-white/10 text-slate-400" : "bg-white border-slate-200 text-slate-600"
          )}>
            📅 Calendar & Duration Tabs Coming Soon
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn(
            "p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl border",
            isDarkMode 
              ? "bg-[#0F172A] border-white/10" 
              : "bg-white border-slate-200"
          )}>
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4",
              isDarkMode ? "bg-red-600/20" : "bg-red-100"
            )}>
              <AlertCircle size={24} className={isDarkMode ? "text-red-400" : "text-red-600"} />
            </div>
            <h3 className={cn(
              "text-xl font-bold mb-2",
              isDarkMode ? "text-white" : "text-slate-900"
            )}>
              Are you sure?
            </h3>
            <p className={cn(
              "text-sm mb-6",
              isDarkMode ? "text-slate-400" : "text-slate-600"
            )}>
              This hotel will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                  isDarkMode
                    ? "bg-white/5 hover:bg-white/10 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                )}
              >
                Cancel
              </button>
              <button 
                onClick={() => { onDelete(entry.id); setShowDeleteModal(false); }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
