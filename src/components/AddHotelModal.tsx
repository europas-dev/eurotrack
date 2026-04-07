// src/components/AddHotelModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createHotel } from '../lib/supabase';
import { cn } from '../lib/utils';
import { X, Loader2, Building2 } from 'lucide-react';
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
  const nameRef = useRef<HTMLInputElement>(null);
  const dk = theme === 'dark';

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim() || !form.companyTag.trim()) {
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

  const fieldCls = cn(
    "w-full px-0 py-2 text-sm outline-none border-b transition-all bg-transparent",
    dk ? "border-white/10 focus:border-blue-500 text-white placeholder-slate-600"
       : "border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400"
  );
  const labelCls = cn("text-[10px] font-bold uppercase tracking-widest block mb-1",
    dk ? "text-slate-500" : "text-slate-400");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className={cn("w-full max-w-md rounded-2xl shadow-2xl border",
        dk ? "bg-[#0F172A] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900")}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={cn("flex items-center gap-3 px-6 py-5 border-b",
          dk ? "border-white/10" : "border-slate-100")}>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black">{lang === 'de' ? 'Neues Hotel' : 'New Hotel'}</h2>
            <p className={cn("text-xs", dk ? "text-slate-500" : "text-slate-400")}>
              {lang === 'de' ? 'Felder können später inline bearbeitet werden' : 'Fields can be edited inline later'}
            </p>
          </div>
          <button onClick={onClose} className={cn("p-2 rounded-lg transition-all",
            dk ? "hover:bg-white/10" : "hover:bg-slate-100")}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-600/10 border border-red-600/20 rounded-xl">
              <p className="text-red-400 text-xs font-bold">{error}</p>
            </div>
          )}

          {/* Required */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{lang === 'de' ? 'Hotelname *' : 'Hotel Name *'}</label>
              <input ref={nameRef} className={fieldCls} placeholder="e.g. Grand Hotel Berlin" value={form.name} onChange={set('name')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{lang === 'de' ? 'Stadt *' : 'City *'}</label>
                <input className={fieldCls} placeholder="Berlin" value={form.city} onChange={set('city')} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'de' ? 'Firmen-Tag *' : 'Company Tag *'}</label>
                <input className={fieldCls} placeholder="EUROPAS" value={form.companyTag} onChange={set('companyTag')} />
              </div>
            </div>
          </div>

          {/* Optional divider */}
          <div className={cn("text-[10px] font-bold uppercase tracking-widest", dk ? "text-slate-600" : "text-slate-300")}>
            — Optional —
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{lang === 'de' ? 'Adresse' : 'Address'}</label>
              <input className={fieldCls} placeholder="Str. 1, Berlin" value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className={labelCls}>{lang === 'de' ? 'Telefon' : 'Phone'}</label>
              <input className={fieldCls} placeholder="+49 30 …" value={form.contact} onChange={set('contact')} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={fieldCls} type="email" placeholder="info@hotel.de" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input className={fieldCls} type="url" placeholder="https://…" value={form.webLink} onChange={set('webLink')} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className={cn("flex-1 py-3 rounded-xl font-bold border transition-all text-sm",
                dk ? "border-white/10 hover:bg-white/5 text-white" : "border-slate-200 hover:bg-slate-50 text-slate-900")}>
              {lang === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {lang === 'de' ? 'Hotel erstellen' : 'Create Hotel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
