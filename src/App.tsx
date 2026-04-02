import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Building2, Moon, LogOut, Loader2, Sun, Search, Settings } from 'lucide-react';
import { cn } from './lib/utils';
import { translations, Language } from './translations';
import { supabase } from './lib/supabase';
import { HotelRow } from './components/HotelRow';
import Auth from './components/Auth';
import Landing from './components/Landing';
import { Toaster, toast } from 'sonner';

export default function App() {
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('de');
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(2026);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [allYearsData, setAllYearsData] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<'company' | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');

  const t = useMemo(() => translations[language] || translations['de'], [language]);

  const fetchData = async (userId: string) => {
    const { data } = await supabase
      .from('years')
      .select('*, companies (*, hotel_entries (*))')
      .eq('user_id', userId);
    if (data) setAllYearsData(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setView('dashboard'); fetchData(session.user.id); }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setUser(session.user); setView('dashboard'); fetchData(session.user.id); }
      else { setUser(null); setView('landing'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const currentYearData = useMemo(() => 
    allYearsData?.find(y => y.year === selectedYear) || { id: '', companies: [] }
  , [allYearsData, selectedYear]);

  const filteredCompanies = useMemo(() => 
    (currentYearData?.companies || []).filter((c: any) => c.month === activeMonth)
  , [currentYearData, activeMonth]);

  const activeCompany = useMemo(() => 
    filteredCompanies.find(c => c.id === activeCompanyId) || filteredCompanies[0] || null
  , [filteredCompanies, activeCompanyId]);

  const monthlyTotal = useMemo(() => {
    if (!activeCompany) return 0;
    return (activeCompany.hotel_entries || []).reduce((acc: number, h: any) => acc + (Number(h.total_cost) || 0), 0);
  }, [activeCompany]);

  const handleAddCompany = async () => {
    if (!newCompanyName.trim() || !user) return;
    let yearId = currentYearData.id;
    if (!yearId) {
      const { data } = await supabase.from('years').insert([{ year: selectedYear, user_id: user.id }]).select().single();
      yearId = data.id;
    }
    await supabase.from('companies').insert([{ name: newCompanyName, month: activeMonth, year_id: yearId, user_id: user.id }]);
    setNewCompanyName('');
    setActiveModal(null);
    fetchData(user.id);
  };

  // --- THE SOUL: ADD HOTEL (Matching your JSONB Schema) ---
  const handleAddHotel = async () => {
    if (!activeCompany || !user) return;
    
    const { error } = await supabase.from('hotel_entries').insert([{
      company_id: activeCompany.id,
      user_id: user.id,
      name: "Neues Hotel",
      city: "Stadt",
      durations: [], // Empty JSONB array for the engine
      free_beds: 3,
      total_cost: 0
    }]);

    if (error) toast.error(error.message);
    else fetchData(user.id);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;
  if (view === 'landing') return <Landing lang={language} setLang={setLanguage} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} onLogin={() => setView('auth')} onRegister={() => setView('auth')} />;
  if (view === 'auth') return <Auth lang={language} theme={isDarkMode ? 'dark' : 'light'} onBack={() => setView('landing')} onAuthSuccess={() => setView('dashboard')} />;

  return (
    <div className={cn("flex h-screen w-full font-sans", isDarkMode ? "bg-[#020617] text-white" : "bg-slate-50 text-slate-900")}>
      <Toaster position="top-center" richColors />
      <aside className={cn("w-72 flex flex-col border-r", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 text-2xl font-black italic mb-10">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-[10px] text-white">E1</div>
            <span>Euro</span><span className="text-[#EAB308]">Track.</span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
            {t.months.map((m: string, i: number) => (
              <button key={m} onClick={() => {setActiveMonth(i); setActiveCompanyId(null);}} className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm", activeMonth === i ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-400 hover:text-white")}>
                <span>{m}</span>
                <span className="text-[10px] opacity-40">0 €</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-6 border-t border-white/10">
             <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">{t.monthlyTotal}</p>
             <p className="text-2xl font-black">{monthlyTotal.toLocaleString('de-DE')} €</p>
             <button onClick={() => supabase.auth.signOut()} className="w-full mt-4 py-3 rounded-xl border border-red-500/20 text-red-500 text-xs font-black">Logout</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-white/5 px-10 flex justify-between items-center">
          <h1 className="text-2xl font-black uppercase">{t.months[activeMonth]} {selectedYear}</h1>
          <div className="flex gap-4">
            <button onClick={() => setLanguage(language === 'en' ? 'de' : 'en')} className="px-3 py-1 border border-white/10 rounded-lg text-xs font-black uppercase">{language}</button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 border border-white/10 rounded-lg">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              {filteredCompanies.map(c => (
                <button key={c.id} onClick={() => setActiveCompanyId(c.id)} className={cn("px-6 py-2 rounded-lg text-xs font-black", activeCompanyId === c.id ? "bg-blue-600 text-white" : "text-slate-400")}>{c.name}</button>
              ))}
              <button onClick={() => setActiveModal('company')} className="px-4 text-blue-500 font-bold"><Plus size={16}/></button>
            </div>
          </div>

          {activeCompany ? (
            <div className="space-y-6">
              <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 flex justify-between items-center">
                 <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center"><Building2 size={28}/></div>
                    <div><h2 className="text-3xl font-black leading-none">{activeCompany.name}</h2></div>
                 </div>
                 <button onClick={handleAddHotel} className="px-10 py-5 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl">
                    <Plus size={24}/> {t.hotelCard.addEntry}
                 </button>
              </div>
              {activeCompany.hotel_entries?.map((hotel: any) => (
                <HotelRow key={hotel.id} entry={hotel} t={t} isDarkMode={isDarkMode} />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center opacity-10"><Building2 size={100}/></div>
          )}
        </div>
      </main>

      {activeModal === 'company' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/90 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#0F172A] border border-white/10 rounded-[3rem] p-12 text-center">
            <h3 className="text-3xl font-black mb-8 uppercase">New Company</h3>
            <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-full rounded-2xl py-6 px-8 bg-white/5 border border-white/10 text-white text-xl outline-none mb-10 focus:border-blue-500" placeholder="e.g. Siemens" />
            <div className="flex gap-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 font-bold opacity-50">Cancel</button>
              <button onClick={handleAddCompany} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase">Create Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
