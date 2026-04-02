import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, ChevronLeft, ChevronRight, Building2, Moon, LogOut, Loader2, Sun, Search, 
  Filter, ArrowUpDown, Bell, Settings, Share2, X, Download, Trash2, Calendar
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- NAVIGATION ---
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(2026);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [allYearsData, setAllYearsData] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<'company' | 'hotel' | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');

  const t = useMemo(() => translations[language] || translations['de'], [language]);

  // --- DATABASE FETCH ---
  const fetchData = async (userId: string) => {
    const { data } = await supabase.from('years').select('*, companies (*, hotel_entries (*))').eq('user_id', userId);
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
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // --- LOGIC CALCULATIONS ---
  const currentYearData = useMemo(() => 
    allYearsData?.find(y => y.year === selectedYear) || { id: '', companies: [] }
  , [allYearsData, selectedYear]);

  const filteredCompanies = useMemo(() => 
    (currentYearData?.companies || []).filter((c: any) => c.month === activeMonth)
  , [currentYearData, activeMonth]);

  const activeCompany = useMemo(() => 
    filteredCompanies.find(c => c.id === activeCompanyId) || filteredCompanies[0] || null
  , [filteredCompanies, activeCompanyId]);

  const yearlyTotal = useMemo(() => {
    return (currentYearData?.companies || []).reduce((acc: number, c: any) => {
      return acc + (c.hotel_entries || []).reduce((hAcc: number, h: any) => hAcc + (h.total_price || 0), 0);
    }, 0);
  }, [currentYearData]);

  const monthlyTotal = useMemo(() => {
    return filteredCompanies.reduce((acc, comp) => {
      return acc + (comp.hotel_entries || []).reduce((hAcc: number, h: any) => hAcc + (h.total_price || 0), 0);
    }, 0);
  }, [filteredCompanies]);

  // --- HANDLERS ---
  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#020617] text-white"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;
  if (view === 'landing') return <Landing lang={language} setLang={setLanguage} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} onGetStarted={() => setView('auth')} onLogin={() => setView('auth')} />;
  if (view === 'auth') return <Auth lang={language} themeMode={isDarkMode ? 'dark' : 'light'} onAuthSuccess={() => setView('dashboard')} onBack={() => setView('landing')} />;

  return (
    <div className={cn("flex h-screen w-full transition-all font-sans bg-[#F3F4F6] text-slate-900")}>
      <Toaster position="top-center" richColors />

      {/* SIDEBAR */}
      <aside className="w-72 bg-[#1E293B] text-white flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 text-2xl font-black italic mb-10">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-[10px]">E1</div>
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>
          
          <div className="mb-8 px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.sidebar.selectYear}</p>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-bold outline-none" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
            {t.months.map((m: string, i: number) => (
              <button key={m} onClick={() => {setActiveMonth(i); setActiveCompanyId(null);}} className={cn("w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-bold transition-all", activeMonth === i ? "bg-white text-[#1E293B] shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5")}>
                <span>{m}</span>
                <span className="text-[10px] opacity-40">0,00 €</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 bg-slate-800/50 border-t border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.yearlyTotal}</p>
          <p className="text-2xl font-black tabular-nums">{yearlyTotal.toLocaleString('de-DE')} €</p>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-[#1E293B] text-white px-10 flex justify-between items-center shrink-0">
          <h1 className="text-2xl font-black uppercase tracking-tighter">{t.months[activeMonth]} {selectedYear}</h1>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-xl font-black">{monthlyTotal.toLocaleString('de-DE')} €</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t.monthlyTotal}</p>
             </div>
             <div className="text-right border-l border-slate-700 pl-6">
                <p className="text-xl font-black text-blue-400">3</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t.freeBeds}</p>
             </div>
             <div className="flex gap-2 ml-4">
                <button onClick={() => setLanguage(l => l === 'en' ? 'de' : 'en')} className="px-3 py-1 border border-slate-700 rounded-lg text-xs font-black uppercase">{language}</button>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 border border-slate-700 rounded-lg">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
                <button className="p-2 border border-slate-700 rounded-lg"><Settings size={18}/></button>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-white">
          <div className="flex items-center gap-4 mb-8">
             <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                {filteredCompanies.map(c => (
                  <button key={c.id} onClick={() => setActiveCompanyId(c.id)} className={cn("px-6 py-2 rounded-lg text-xs font-black transition-all", activeCompanyId === c.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>
                    {c.name}
                  </button>
                ))}
                <button onClick={() => setActiveModal('company')} className="px-4 text-blue-700 font-bold hover:scale-110 transition-transform"><Plus size={18}/></button>
             </div>
             <div className="relative flex-1 max-w-xs ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                <input className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm font-bold shadow-sm outline-none focus:border-blue-300 transition-all" placeholder={t.searchPlaceholder} />
             </div>
          </div>

          {activeCompany ? (
            <div className="space-y-6">
              <div className="bg-[#F8FAFC] border border-slate-200 p-8 rounded-[2rem] flex justify-between items-center shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#0038A8] text-white rounded-xl flex items-center justify-center shadow-lg"><Building2 size={24}/></div>
                    <h2 className="text-3xl font-black text-[#001A41]">{activeCompany.name}</h2>
                 </div>
                 <button onClick={() => setActiveModal('hotel')} className="px-8 py-4 bg-[#0038A8] text-white font-black rounded-xl flex items-center gap-2 shadow-xl hover:bg-blue-800 transition-all">
                    <Plus size={20}/> {t.hotelCard.addEntry}
                 </button>
              </div>

              <div className="border border-slate-200 rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
                 <HotelRow entry={activeCompany.hotel_entries?.[0]} t={t} isDarkMode={isDarkMode} />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10 py-20"><Building2 size={100}/><p className="font-black mt-4 uppercase tracking-widest">No Company Selected</p></div>
          )}
        </div>
      </main>

      {/* NEW COMPANY MODAL */}
      {activeModal === 'company' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#001A41]/80 backdrop-blur-md p-6">
          <div className="w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-3xl font-black text-[#001A41] mb-8 text-center uppercase tracking-tighter">{t.sidebar.newCompanyName}</h3>
            <input autoFocus value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-full rounded-2xl py-6 px-8 font-bold outline-none mb-10 text-xl border border-slate-100 bg-slate-50 text-slate-900 focus:border-blue-500 transition-all" placeholder="Enter Company Name" />
            <div className="flex gap-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">{t.common.cancel}</button>
              <button onClick={handleAddCompany} className="flex-1 py-5 bg-[#0038A8] text-white rounded-2xl font-black shadow-2xl uppercase tracking-widest text-[10px]">Create Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
