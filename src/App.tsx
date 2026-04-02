import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Building2, Moon, LogOut, Loader2, Sun, Search, 
  Settings, Globe, Calendar
} from 'lucide-react';
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
  
  const [activeModal, setActiveModal] = useState<'company' | 'hotel' | null>(null);
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
    return filteredCompanies.reduce((acc, comp) => {
      return acc + (comp.hotel_entries || []).reduce((hAcc: number, h: any) => hAcc + (h.total_price || 0), 0);
    }, 0);
  }, [filteredCompanies]);

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

  // --- THE SOUL: ADD HOTEL FUNCTION ---
  const handleAddHotel = async () => {
    if (!activeCompany || !user) {
        toast.error("Please select or create a company first");
        return;
    }
    
    const { error } = await supabase.from('hotel_entries').insert([{
      company_id: activeCompany.id,
      hotel_name: "New Hotel Name",
      city: "City",
      check_in: new Date().toISOString().split('T')[0],
      check_out: new Date(Date.now() + 604800000).toISOString().split('T')[0],
      free_beds: 3,
      total_price: 0,
      user_id: user.id
    }]);

    if (error) {
      toast.error("Database Error: " + error.message);
    } else {
      toast.success("Hotel Added!");
      fetchData(user.id);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;

  if (view === 'landing') return <Landing lang={language} setLang={setLanguage} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} onLogin={() => setView('auth')} onRegister={() => setView('auth')} />;
  if (view === 'auth') return <Auth lang={language} theme={isDarkMode ? 'dark' : 'light'} onBack={() => setView('landing')} onAuthSuccess={() => setView('dashboard')} />;

  return (
    <div className={cn("flex h-screen w-full font-sans transition-all", isDarkMode ? "bg-[#020617] text-white" : "bg-slate-50 text-slate-900")}>
      <Toaster position="top-center" richColors />

      {/* SIDEBAR */}
      <aside className={cn("w-72 flex flex-col border-r", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 text-2xl font-black italic mb-10 px-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-[10px] text-white">E1</div>
            <span>Euro</span><span className="text-[#EAB308]">Track.</span>
          </div>
          
          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
            {t.months.map((m: string, i: number) => (
              <button key={m} onClick={() => {setActiveMonth(i); setActiveCompanyId(null);}} className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm", activeMonth === i ? "bg-blue-600 text-white" : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:bg-slate-100"))}>
                <span>{m}</span>
                <span className="text-[10px] opacity-40 tabular-nums">0 €</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
             <div><p className="text-[10px] font-black opacity-40 uppercase tracking-widest">{t.monthlyTotal}</p><p className="text-2xl font-black tabular-nums">{monthlyTotal} €</p></div>
             <button onClick={() => supabase.auth.signOut()} className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 text-xs font-black flex items-center justify-center gap-2">
                <LogOut size={14} /> Logout
             </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className={cn("h-20 border-b px-10 flex justify-between items-center", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
          <h1 className="text-2xl font-black uppercase">{t.months[activeMonth]} {selectedYear}</h1>
          <div className="flex items-center gap-4">
            <button onClick={() => setLanguage(language === 'en' ? 'de' : 'en')} className="px-3 py-1.5 border border-white/10 rounded-lg text-xs font-black uppercase">{language}</button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 border border-white/10 rounded-lg">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              {filteredCompanies.map(c => (
                <button key={c.id} onClick={() => setActiveCompanyId(c.id)} className={cn("px-6 py-2.5 rounded-lg text-xs font-black transition-all", activeCompanyId === c.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}>
                  {c.name}
                </button>
              ))}
              <button onClick={() => setActiveModal('company')} className="px-4 text-blue-500 font-bold"><Plus size={16}/></button>
            </div>
            <div className="relative flex-1 max-w-xs ml-auto text-white">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16}/>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none" placeholder={t.searchPlaceholder} />
            </div>
          </div>

          {activeCompany ? (
            <div className="space-y-6">
              <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 flex justify-between items-center shadow-2xl">
                 <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Building2 size={28}/></div>
                    <div className="text-white">
                       <h2 className="text-3xl font-black">{activeCompany.name}</h2>
                       <p className="text-xs font-bold opacity-40 uppercase tracking-widest">{t.months[activeMonth]} {selectedYear}</p>
                    </div>
                 </div>
                 <button onClick={handleAddHotel} className="px-10 py-5 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-xl hover:bg-blue-700 transition-all">
                    <Plus size={24}/> {t.hotelCard.addEntry}
                 </button>
              </div>

              {activeCompany.hotel_entries?.map((hotel: any) => (
                <HotelRow key={hotel.id} entry={hotel} t={t} isDarkMode={isDarkMode} />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center opacity-10 py-40"><Building2 size={120}/></div>
          )}
        </div>
      </main>

      {/* MODAL: NEW COMPANY */}
      {activeModal === 'company' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/90 backdrop-blur-md p-6">
          <div className="w-full max-w-xl bg-[#0F172A] border border-white/10 rounded-[3rem] p-12 shadow-2xl">
            <h3 className="text-3xl font-black text-white mb-8 text-center uppercase tracking-tighter">{t.sidebar.newCompanyName}</h3>
            <input autoFocus value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-full rounded-2xl py-6 px-8 font-bold outline-none mb-10 text-xl border border-white/10 bg-white/5 text-white focus:border-blue-500 transition-all" placeholder="Enter Company Name" />
            <div className="flex gap-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-5 font-black opacity-40 uppercase tracking-widest text-[10px] text-white">Cancel</button>
              <button onClick={handleAddCompany} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-2xl uppercase tracking-widest text-[10px]">Create Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
