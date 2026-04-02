import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Building2, Moon, LogOut, Loader2, Sun, Search, 
  Settings, Globe, Calendar, Bell, X, AlertCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import { translations, Language } from './translations';
import { supabase } from './lib/supabase';
import { HotelRow } from './components/HotelRow';
import Auth from './components/Auth';
import Landing from './components/Landing';
import { Toaster, toast } from 'sonner';

export default function App() {
  // --- CORE APP STATE ---
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard'>('landing');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('de');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  // --- DASHBOARD NAVIGATION ---
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(2026);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [allYearsData, setAllYearsData] = useState<any[]>([]);
  
  // --- MODALS & INPUTS ---
  const [activeModal, setActiveModal] = useState<'company' | 'delete' | null>(null);
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

  // --- CALCULATION ENGINE (Source 2) ---
  const currentYearData = useMemo(() => 
    allYearsData?.find(y => y.year === selectedYear) || { id: '', companies: [] }
  , [allYearsData, selectedYear]);

  const filteredCompanies = useMemo(() => 
    (currentYearData?.companies || []).filter((c: any) => c.month === activeMonth)
  , [currentYearData, activeMonth]);

  const activeCompany = useMemo(() => 
    filteredCompanies.find(c => c.id === activeCompanyId) || filteredCompanies[0] || null
  , [filteredCompanies, activeCompanyId]);

  // Global Free Beds Calculation (Sum of all hotels in the current month view)
  const globalFreeBeds = useMemo(() => {
    return filteredCompanies.reduce((total, company) => {
      return total + (company.hotel_entries || []).reduce((hTotal: number, h: any) => hTotal + (h.free_beds || 0), 0);
    }, 0);
  }, [filteredCompanies]);

  const monthlyTotalSpend = useMemo(() => {
    return filteredCompanies.reduce((acc, comp) => {
      return acc + (comp.hotel_entries || []).reduce((hAcc: number, h: any) => hAcc + (Number(h.total_cost) || 0), 0);
    }, 0);
  }, [filteredCompanies]);

  // --- HANDLERS ---
  const handleAddHotel = async () => {
    if (!activeCompany || !user) return;
    const { error } = await supabase.from('hotel_entries').insert([{
      company_id: activeCompany.id,
      user_id: user.id,
      name: "Neues Hotel",
      city: "Stadt",
      durations: [], 
      free_beds: 3,
      total_cost: 0
    }]);
    if (!error) fetchData(user.id);
  };

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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;

  if (view === 'landing') return (
    <Landing 
      lang={language} setLang={setLanguage} 
      isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)}
      onLogin={() => setView('auth')} onRegister={() => setView('auth')} 
    />
  );

  if (view === 'auth') return (
    <Auth 
      lang={language} theme={isDarkMode ? 'dark' : 'light'} 
      onBack={() => setView('landing')} onAuthSuccess={() => setView('dashboard')}
    />
  );

  return (
    <div className={cn("flex h-screen w-full font-sans transition-all selection:bg-blue-500/30", isDarkMode ? "bg-[#020617] text-white" : "bg-slate-50 text-slate-900")}>
      <Toaster position="top-center" richColors />

      {/* SIDEBAR */}
      <aside className={cn("w-72 flex flex-col border-r", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 text-2xl font-black italic mb-10 px-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] text-white font-bold">E1</div>
            <span>Euro</span><span className="text-[#EAB308]">Track.</span>
          </div>
          
          <div className="mb-8 px-2">
            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-2">{t.sidebar.selectYear}</p>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className={cn("w-full border rounded-xl p-3 font-bold outline-none", isDarkMode ? "bg-slate-800 border-white/10" : "bg-slate-100 border-slate-200")}>
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide pr-2">
            {t.months.map((m: string, i: number) => (
              <button key={m} onClick={() => {setActiveMonth(i); setActiveCompanyId(null);}} className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm", activeMonth === i ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:bg-slate-100"))}>
                <span>{m}</span>
                <span className="text-[10px] opacity-40 tabular-nums">0,00 €</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10 space-y-4 font-mono">
             <div>
                <p className="text-[10px] font-black opacity-30 uppercase tracking-widest leading-none mb-1">Monthly Total</p>
                <p className="text-2xl font-bold">{monthlyTotalSpend.toLocaleString('de-DE')} €</p>
             </div>
             <button onClick={() => supabase.auth.signOut()} className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all">
                <LogOut size={14} /> Logout
             </button>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER (Source 13) */}
        <header className={cn("h-20 border-b px-10 flex justify-between items-center shrink-0 z-50", isDarkMode ? "bg-[#0F172A] border-white/5" : "bg-white border-slate-200")}>
          <h1 className="text-2xl font-black uppercase tracking-tighter tabular-nums">{t.months[activeMonth]} {selectedYear}</h1>
          
          <div className="flex items-center gap-10">
            <div className="flex gap-10 font-mono">
              <div className="text-right">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-widest leading-none mb-1">Free Beds</p>
                <p className="text-xl font-bold text-emerald-500">{globalFreeBeds}</p>
              </div>
              <div className="text-right border-l border-white/10 pl-10">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-widest leading-none mb-1">Total Spend</p>
                <p className="text-xl font-bold text-white">{monthlyTotalSpend.toLocaleString('de-DE')} €</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-10 border-l border-white/10">
              <button onClick={() => setShowCalendar(true)} className="p-2.5 border border-white/5 rounded-xl hover:bg-white/5 transition-all text-slate-400 hover:text-blue-500 relative">
                <Calendar size={18}/>
              </button>
              <button className="p-2.5 border border-white/5 rounded-xl hover:bg-white/5 transition-all text-slate-400 hover:text-yellow-500 relative">
                <Bell size={18}/>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0F172A]" />
              </button>
              <button className="p-2.5 border border-white/5 rounded-xl hover:bg-white/5 transition-all text-slate-400 hover:text-white">
                <Settings size={18}/>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-[#020617]">
          {/* Company Selector Tabs */}
          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
              {filteredCompanies.map(c => (
                <button key={c.id} onClick={() => setActiveCompanyId(c.id)} className={cn("px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap tracking-widest", activeCompanyId === c.id ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white")}>
                  {c.name}
                </button>
              ))}
              <button onClick={() => setActiveModal('company')} className="px-4 text-blue-500 hover:scale-110 transition-transform"><Plus size={18}/></button>
            </div>
            <div className="relative flex-1 max-w-xs ml-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={16}/>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold outline-none focus:border-blue-500/50 transition-all" placeholder="Search entries..." />
            </div>
          </div>

          {activeCompany ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Active Company Header Card */}
              <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 flex justify-between items-center shadow-2xl shadow-black/40">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20"><Building2 size={32}/></div>
                    <div>
                       <h2 className="text-4xl font-black tracking-tighter leading-none">{activeCompany.name}</h2>
                       <p className="text-xs font-bold opacity-30 uppercase tracking-[0.2em] mt-2">{t.months[activeMonth]} {selectedYear}</p>
                    </div>
                 </div>
                 <button onClick={handleAddHotel} className="px-10 py-5 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-2xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest text-xs">
                    <Plus size={24}/> Add Hotel
                 </button>
              </div>

              {/* List of Hotels */}
              <div className="space-y-4">
                {activeCompany.hotel_entries?.map((hotel: any) => (
                  <HotelRow 
                    key={hotel.id} 
                    entry={hotel} 
                    isDarkMode={isDarkMode} 
                    onDelete={() => fetchData(user.id)} 
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10 py-40">
              <Building2 size={120} className="mb-4 text-blue-500" />
              <p className="font-black uppercase tracking-[0.3em] text-sm">Select a Company Profile</p>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: NEW COMPANY */}
      {activeModal === 'company' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-6">
          <div className="w-full max-w-xl bg-[#0F172A] border border-white/10 rounded-[3rem] p-16 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-4xl font-black text-white mb-10 text-center uppercase tracking-tighter">New Profile</h3>
            <input 
              autoFocus 
              value={newCompanyName} 
              onChange={(e) => setNewCompanyName(e.target.value)} 
              className="w-full rounded-2xl py-6 px-8 font-bold outline-none mb-12 text-2xl border border-white/10 bg-white/5 text-white focus:border-blue-500 shadow-inner" 
              placeholder="e.g. Siemens AG" 
            />
            <div className="flex gap-6">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-6 font-black opacity-30 uppercase tracking-[0.2em] text-xs">Cancel</button>
              <button onClick={handleAddCompany} className="flex-1 py-6 bg-blue-600 text-white rounded-2xl font-black shadow-2xl uppercase tracking-[0.2em] text-xs hover:bg-blue-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MONTH CALENDAR OVERLAY (Source 14) */}
      {showCalendar && (
        <div className="fixed inset-0 z-[300] bg-[#020617] p-10 flex flex-col animate-in fade-in duration-500">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Monthly Schedule — {t.months[activeMonth]}</h2>
              <button onClick={() => setShowCalendar(false)} className="p-4 bg-white/5 rounded-2xl hover:bg-red-500/20 text-white transition-all"><X size={32}/></button>
           </div>
           <div className="flex-1 bg-white/5 border border-white/10 rounded-[3rem] p-10 overflow-hidden flex flex-col">
              <div className="grid grid-cols-7 mb-4 border-b border-white/5 pb-4">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <div key={day} className="text-[10px] font-black uppercase opacity-30 text-center tracking-widest">{day}</div>)}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-2">
                 {/* Calendar Days would be generated here */}
                 {Array.from({length: 35}).map((_, i) => (
                   <div key={i} className="border border-white/5 rounded-xl p-3 text-[10px] font-black opacity-20">{(i % 31) + 1}</div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
