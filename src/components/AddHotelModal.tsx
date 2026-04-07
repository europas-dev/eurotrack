// src/components/AddHotelModal.tsx
import React, { useState } from 'react';
import { createHotel } from '../lib/supabase';
import { cn } from '../lib/utils';
import { X, Loader2 } from 'lucide-react';
import type { Theme, Language } from '../lib/types';

interface AddHotelModalProps {
  theme: Theme;
  lang: Language;
  onClose: () => void;
  onSave: (hotel: any) => void;
}

export default function AddHotelModal({ theme, lang, onClose, onSave }: AddHotelModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', city: '', address: '', contact: '', email: '', webLink: '', companyTag: '' });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.city || !form.companyTag) {
      setError(lang === 'de' ? 'Name, Stadt und Firmen-Tag sind Pflichtfelder.' : 'Name, city, and company tag are required.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const newHotel = await createHotel(form);
      onSave({ ...newHotel, durations: [] });
    } catch (err: any) {
      setError(err.message || 'Failed to create hotel');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';
  const inputClass = cn(
    "w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all",
    isDark ? "bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-500"
           : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
  );
  const labelClass = cn("text-xs font-bold uppercase tracking-widest mb-1 block", isDark ? "text-slate-400" : "text-slate-500");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={cn("w-full max-w-lg rounded-2xl shadow-2xl border p-8",
        isDark ? "bg-[#0F172A] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">{lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}</h2>
          <button onClick={onClose} className={cn("p-2 rounded-lg transition-all", isDark ? "hover:bg-white/10" : "hover:bg-slate-100")}>
            <X size={20} />
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-600/10 border border-red-600/20 rounded-xl">
            <p className="text-red-400 text-sm font-bold">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{lang === 'de' ? 'Hotelname *' : 'Hotel Name *'}</label>
              <input className={inputClass} placeholder="Grand Hotel Berlin" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className={labelClass}>{lang === 'de' ? 'Stadt *' : 'City *'}</label>
              <input className={inputClass} placeholder="Berlin" value={form.city} onChange={set('city')} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{lang === 'de' ? 'Firmen-Tag *' : 'Company Tag *'}</label>
            <input className={inputClass} placeholder="EUROPAS" value={form.companyTag} onChange={set('companyTag')} />
          </div>
          <div>
            <label className={labelClass}>{lang === 'de' ? 'Adresse' : 'Address'}</label>
            <input className={inputClass} placeholder="Unter den Linden 1, 10117 Berlin" value={form.address} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{lang === 'de' ? 'Telefon' : 'Phone'}</label>
              <input className={inputClass} placeholder="+49 30 123456" value={form.contact} onChange={set('contact')} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} type="email" placeholder="info@hotel.de" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input className={inputClass} type="url" placeholder="https://hotel.de" value={form.webLink} onChange={set('webLink')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className={cn("flex-1 py-3 rounded-xl font-bold border transition-all",
                isDark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50")}>
              {lang === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {lang === 'de' ? 'Speichern' : 'Save Hotel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
