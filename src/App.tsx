import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Building2, Moon, LogOut, Loader2, Sun, Search, 
  Filter, ArrowUpDown, Bell, Settings, Share2, Download, Globe
} from 'lucide-react';
import { cn } from './lib/utils';
import { translations, Language } from './translations';
import { supabase } from './lib/supabase';
import { HotelRow } from './components/HotelRow';
import Auth from './components/Auth';
import Landing from './components/Landing';
import { Toaster, toast } from 'sonner';

export default function App() {
  // --- CORE STATES ---
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('de');
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to Dark for the premium feel

  // --- DASHBOARD NAVIGATION ---
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(2026);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [allYearsData, setAllYearsData] = useState<any[]>([]);
  
  // --- MODAL & SEARCH ---
  const [activeModal, setActiveModal] = useState<'company' | 'hotel' | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');

  const t = useMemo(() => translations[language] || translations['de'], [language]);

  // --- DATABASE SYNC ---
  const fetchData = async (userId: string) => {
    const { data } = await supabase
      .from('years')
      .select('*, companies (*, hotel_entries (*))')
      .eq('user_id', userId);
    if (data) setAllYearsData(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { 
        setUser(session.user); 
        setView('dashboard'); 
        fetchData(session.user.id); 
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { 
        setUser(session.user); 
        setView('dashboard'); 
        fetchData(session.user.id); 
      } else { 
        setUser(null); 
        setView('landing'); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- CALCULATION ENGINE ---
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

  // --- ACTION HANDLERS ---
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
    toast.success(language === 'de' ? 'Firma erstellt' : 'Company created');
  };

  // --- VIEW RENDERING ---
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#020617]">
      <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
    </div>
  );

  if (view === 'landing') return (
    <Landing 
      lang={language} 
      setLang={setLanguage} 
      isDarkMode={isDarkMode} 
      toggleTheme={() => setIsDarkMode(!isDarkMode)}
      onLogin={() => setView('auth')} 
      onRegister={() => setView('auth')} 
    />
  );

  if (view === 'auth') return (
    <Auth 
      lang={language} 
      theme={isDarkMode ? 'dark' : 'light'} 
      onBack={() => setView('landing')} 
      onAuthSuccess={() => setView('dashboard')}
    />
  );

  return (
    <div className={cn(
      "flex h-screen w-full transition-all font-sans",
      isDarkMode ? "bg-[#020617] text-white" : "bg-slate-50 text-slate-900"
    )}>
      <Toaster position="top-center" richColors />

      {/* SIDEBAR */}
      <aside className={cn(
        "w-80 flex flex-col shrink-0 z-50 border-r",
        isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200"
      )}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 text-2xl font-black italic mb-10 px-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-[10px] text-white">E1</div>
            <span className={isDarkMode ? "text-white" : "text-slate-900"}>Euro</span><span className="text-[#EAB308]">Track.</span>
          </div>
          
          <div className="mb-8 px-2">
            <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-2">{t.sidebar.selectYear}</p>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(parseInt(e.target.value))} 
              className={cn("w-full border rounded-xl p-3 font-bold outline-none", isDarkMode ? "bg-slate-800 border-white/10" : "bg-slate-100 border-slate-200")}
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide pr-2">
            {t.months.map((m: string, i: number) => (
              <button 
                key={m} 
                onClick={() => {setActiveMonth(i); setActiveCompanyId(null);}} 
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm", 
                  activeMonth === i 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                    : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:bg-slate-100")
                )}
              >
                <span>{m}</span>
                <span className="text-[10px] opacity-60 tabular-nums">0,00 €</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
             <div>
                <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">{t.monthlyTotal}</p>
                <p className="text-2xl font-black tabular-nums">{monthlyTotal.toLocaleString('de-DE')} €</p>
             </div>
             <div>
                <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">{t.yearlyTotal}</p>
                <p className="text-3xl font-black text-blue-500 tabular-nums">{yearlyTotal.toLocaleString('de-DE')} €</p>
             </div>
             <button onClick={() => supabase.auth.signOut()} className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 text-xs font-black flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all">
                <LogOut size={14} /> {language === 'de' ? 'Abmelden' : 'Logout'}
             </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className={cn("h-20 border-b px-10 flex justify-between items-center shrink-0", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
          <h1 className="text-2xl font-black tracking-tighter uppercase">{t.months[activeMonth]} {selectedYear}</h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8 mr-6">
              <div className="text-right">
                <p className="text-[10px] font-black opacity-50 uppercase tracking-widest leading-none">Total Spend</p>
                <p className="text-xl font-black">{monthlyTotal.toLocaleString('de-DE')} €</p>
              </div>
              <div className="text-right border-l border-white/10 pl-8">
                <p className="text-[10px] font-black opacity-50 uppercase tracking-widest leading-none">{t.freeBeds}</p>
                <p className="text-xl font-black text-blue-500">3</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLanguage(l => l === 'en' ? 'de' : 'en')} className="px-3 py-1.5 border border-white/10 rounded-lg font-black text-xs uppercase hover:bg-white/5">{language}</button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 border border-white/10 rounded-lg hover:bg-white/5">
                {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
              </button>
              <button className="p-2.5 border border-white/10 rounded-lg hover:bg-white/5"><Settings size={18}/></button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className={cn("flex p-1 rounded-xl shadow-sm border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
              {filteredCompanies.map(c => (
                <button key={c.id} onClick={() => setActiveCompanyId(c.id)} className={cn("px-6 py-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap", activeCompanyId === c.id ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-blue-500")}>
                  {c.name}
                </button>
              ))}
              <button onClick={() => setActiveModal('company')} className="px-4 text-blue-500 font-bold border-l border-white/10"><Plus size={16}/></button>
            </div>
            <div className="relative flex-1 max-w-xs ml-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16}/>
              <input className={cn("w-full border rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none", isDarkMode ? "bg-white/5 border-white/10 focus:border-blue-500" : "bg-white border-slate-200 focus:border-blue-500")} placeholder={t.searchPlaceholder} />
            </div>
          </div>

          {activeCompany ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={cn("p-10 rounded-[2.5rem] border shadow-xl flex justify-between items-center", isDarkMode ? "bg-white/5 border-white/10 shadow-black/20" : "bg-white border-slate-200 shadow-slate-200/50")}>
                 <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30"><Building2 size={28}/></div>
                    <div>
                       <h2 className="text-3xl font-black leading-none">{activeCompany.name}</h2>
                       <p className="text-xs font-bold opacity-40 mt-1 uppercase tracking-widest">{t.months[activeMonth]} {selectedYear}</p>
                    </div>
                 </div>
                 <button onClick={() => setActiveModal('hotel')} className="px-10 py-5 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-2xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
                    <Plus size={24}/> {t.hotelCard.addEntry}
                 </button>
              </div>

              {activeCompany.hotel_entries?.map((hotel: any) => (
                <HotelRow key={hotel.id} entry={hotel} t={t} isDarkMode={isDarkMode} />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10 p-40">
              <Building2 size={120}/>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: NEW COMPANY */}
      {activeModal === 'company' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/90 backdrop-blur-md p-6">
          <div className={cn("w-full max-w-xl rounded-[3rem] p-12 shadow-2xl border animate-in zoom-in-95", isDarkMode ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
            <h3 className="text-3xl font-black mb-8 text-center uppercase tracking-tighter">{t.sidebar.newCompanyName}</h3>
            <input 
              autoFocus 
              value={newCompanyName} 
              onChange={(e) => setNewCompanyName(e.target.value)} 
              className={cn("w-full rounded-2xl py-6 px-8 font-bold outline-none mb-10 text-xl border transition-all", isDarkMode ? "bg-white/5 border-white/10 focus:border-blue-500 text-white" : "bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900")} 
              placeholder="e.g. Siemens AG" 
            />
            <div className="flex gap-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-5 font-black opacity-40 uppercase tracking-widest text-[10px]">{t.common.cancel}</button>
              <button onClick={handleAddCompany} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-2xl uppercase tracking-widest text-[10px]">Create Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
