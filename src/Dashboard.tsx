import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import type { AccessLevel } from './lib/supabase';
import {
  getHotels, createHotel, updateHotel, deleteHotel,
  createDuration, updateDuration, deleteDuration,
  createEmployee, updateEmployee, deleteEmployee,
  getCollaborators,
} from './lib/supabase';
import Header from './components/Header';
import HotelRow from './components/HotelRow';
import AddHotelModal from './components/AddHotelModal';
import ExportModal from './components/ExportModal';
import { cn } from './lib/utils';
import { Plus, Building2, Loader2, TriangleAlert } from 'lucide-react';

interface DashboardProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  offlineMode?: boolean;
  onToggleOfflineMode?: () => void;
  viewOnly?: boolean;
  accessLevel?: AccessLevel | null;
}

export default function Dashboard({
  theme, lang, toggleTheme, setLang,
  offlineMode = false,
  onToggleOfflineMode,
  viewOnly = false,
  accessLevel,
}: DashboardProps) {
  const dk = theme === 'dark';

  const [hotels,         setHotels]         = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showAddHotel,   setShowAddHotel]   = useState(false);
  const [showExport,     setShowExport]     = useState(false);
  const [collaborators,  setCollaborators]  = useState<any[]>([]);
  const [activeHotelId,  setActiveHotelId]  = useState<string | null>(null);
  const [savingIds,      setSavingIds]      = useState<Set<string>>(new Set());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Hotels visible to this user
  const visibleHotels = React.useMemo(() => {
    if (!accessLevel || accessLevel.role === 'admin') return hotels;
    if (accessLevel.role === 'editor' || accessLevel.role === 'viewer') {
      return hotels.filter(h => accessLevel.hotelIds.includes(h.id));
    }
    return [];
  }, [hotels, accessLevel]);

  const filteredHotels = React.useMemo(() => {
    if (!searchQuery.trim()) return visibleHotels;
    const q = searchQuery.toLowerCase();
    return visibleHotels.filter(h =>
      h.name?.toLowerCase().includes(q) ||
      h.city?.toLowerCase().includes(q) ||
      (Array.isArray(h.companyTag) ? h.companyTag : []).some((t: string) => t?.toLowerCase().includes(q))
    );
  }, [visibleHotels, searchQuery]);

  const activeHotel = hotels.find(h => h.id === activeHotelId) ?? null;

  useEffect(() => { loadHotels(); }, []);

  async function loadHotels() {
    try {
      setLoading(true); setError(null);
      const data = await getHotels();
      setHotels(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load hotels');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    getCollaborators(activeHotelId ?? undefined).then(setCollaborators).catch(() => {});
  }, [activeHotelId]);

  // ── Guarded write helper — blocks all mutations in viewOnly mode ─────────────
  function guardWrite<T extends any[]>(fn: (...args: T) => Promise<void>) {
    return async (...args: T) => {
      if (viewOnly) return;
      await fn(...args);
    };
  }

  // ── Hotel CRUD ───────────────────────────────────────────────────────────────
  const handleAddHotel = guardWrite(async (data: any) => {
    const hotel = await createHotel(data);
    setHotels(p => [hotel, ...p]);
  });

  const handleUpdateHotel = guardWrite(async (id: string, data: any) => {
    setHotels(p => p.map(h => h.id === id ? { ...h, ...data } : h));
    clearTimeout(saveTimers.current[id]);
    setSavingIds(p => new Set([...p, id]));
    saveTimers.current[id] = setTimeout(async () => {
      try { await updateHotel(id, data); }
      catch (e) { console.error('Hotel save failed', e); }
      finally { setSavingIds(p => { const n = new Set(p); n.delete(id); return n; }); }
    }, 600);
  });

  const handleDeleteHotel = guardWrite(async (id: string) => {
    setHotels(p => p.filter(h => h.id !== id));
    if (activeHotelId === id) setActiveHotelId(null);
    await deleteHotel(id);
  });

  // ── Duration CRUD ────────────────────────────────────────────────────────────
  const handleAddDuration = guardWrite(async (hotelId: string, data: any) => {
    const dur = await createDuration({ ...data, hotelId });
    setHotels(p => p.map(h => h.id === hotelId
      ? { ...h, durations: [...(h.durations ?? []), dur] }
      : h));
  });

  const handleUpdateDuration = guardWrite(async (hotelId: string, durId: string, data: any) => {
    setHotels(p => p.map(h => h.id === hotelId
      ? { ...h, durations: (h.durations ?? []).map((d: any) => d.id === durId ? { ...d, ...data } : d) }
      : h));
    clearTimeout(saveTimers.current[durId]);
    setSavingIds(p => new Set([...p, durId]));
    saveTimers.current[durId] = setTimeout(async () => {
      try { await updateDuration(durId, data); }
      catch (e) { console.error('Duration save failed', e); }
      finally { setSavingIds(p => { const n = new Set(p); n.delete(durId); return n; }); }
    }, 600);
  });

  const handleDeleteDuration = guardWrite(async (hotelId: string, durId: string) => {
    setHotels(p => p.map(h => h.id === hotelId
      ? { ...h, durations: (h.durations ?? []).filter((d: any) => d.id !== durId) }
      : h));
    await deleteDuration(durId);
  });

  // ── Employee CRUD ────────────────────────────────────────────────────────────
  const handleAddEmployee = guardWrite(async (hotelId: string, durId: string, slotIndex: number, data: any) => {
    const emp = await createEmployee(durId, slotIndex, data);
    setHotels(p => p.map(h => h.id === hotelId
      ? { ...h, durations: (h.durations ?? []).map((d: any) => d.id === durId
          ? { ...d, employees: [...(d.employees ?? []), emp] } : d) } : h));
  });

  const handleUpdateEmployee = guardWrite(async (hotelId: string, durId: string, empId: string, data: any) => {
    setHotels(p => p.map(h => h.id === hotelId
      ? { ...h, durations: (h.durations ?? []).map((d: any) => d.id === durId
          ? { ...d, employees: (d.employees ?? []).map((e: any) => e.id === empId ? { ...e, ...data } : e) } : d) } : h));
    clearTimeout(saveTimers.current[empId]);
    saveTimers.current[empId] = setTimeout(async () => {
      try { await updateEmployee(empId, data); }
      catch (e) { console.error('Employee save failed', e); }
    }, 600);
  });

  const handleDeleteEmployee = guardWrite(async (hotelId: string, durId: string, empId: string) => {
    setHotels(p => p.map(h => h.id === hotelId
      ? { ...h, durations: (h.durations ?? []).map((d: any) => d.id === durId
          ? { ...d, employees: (d.employees ?? []).filter((e: any) => e.id !== empId) } : d) } : h));
    await deleteEmployee(empId);
  });

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={cn('flex flex-col h-full', dk ? 'bg-[#020617]' : 'bg-slate-50')}>
      <Header
        theme={theme} lang={lang}
        toggleTheme={toggleTheme} setLang={setLang}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        onSignOut={handleSignOut}
        onExport={() => setShowExport(true)}
        activeHotelIdForShare={activeHotelId}
        activeHotelNameForShare={activeHotel?.name ?? null}
        collaborators={collaborators}
        onCollaboratorsChanged={setCollaborators}
        viewOnly={viewOnly}
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <TriangleAlert className="text-red-400 mx-auto mb-2" size={32} />
              <p className="text-red-400 font-bold">{error}</p>
              <button onClick={loadHotels} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                {lang === 'de' ? 'Erneut versuchen' : 'Retry'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-7xl mx-auto">

            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cn('text-2xl font-black', dk ? 'text-white' : 'text-slate-900')}>
                  {lang === 'de' ? 'Hotels' : 'Hotels'}
                </h1>
                <p className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {filteredHotels.length} {lang === 'de' ? 'Hotels' : 'hotels'}
                  {viewOnly && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/20">
                      {lang === 'de' ? 'Nur Ansicht' : 'View only'}
                    </span>
                  )}
                </p>
              </div>
              {/* Only admins and editors can add hotels */}
              {!viewOnly && (
                <button
                  onClick={() => setShowAddHotel(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all"
                >
                  <Plus size={18} />
                  {lang === 'de' ? 'Hotel hinzufügen' : 'Add Hotel'}
                </button>
              )}
            </div>

            {/* Hotel list */}
            {filteredHotels.length === 0 ? (
              <div className={cn('flex flex-col items-center justify-center py-24 rounded-2xl border', dk ? 'border-white/5 bg-white/2' : 'border-slate-200 bg-white')}>
                <Building2 className={cn('mb-4', dk ? 'text-slate-700' : 'text-slate-300')} size={48} />
                <p className={cn('font-black text-lg mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {searchQuery
                    ? (lang === 'de' ? 'Keine Hotels gefunden' : 'No hotels found')
                    : viewOnly
                      ? (lang === 'de' ? 'Keine Hotels freigegeben' : 'No hotels shared with you')
                      : (lang === 'de' ? 'Noch keine Hotels' : 'No hotels yet')}
                </p>
                {!searchQuery && !viewOnly && (
                  <button onClick={() => setShowAddHotel(true)} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                    {lang === 'de' ? 'Erstes Hotel erstellen' : 'Create your first hotel'}
                  </button>
                )}
              </div>
            ) : (
              filteredHotels.map(hotel => (
                <HotelRow
                  key={hotel.id}
                  hotel={hotel}
                  theme={theme}
                  lang={lang}
                  isSaving={savingIds.has(hotel.id)}
                  isActive={hotel.id === activeHotelId}
                  onActivate={() => setActiveHotelId(p => p === hotel.id ? null : hotel.id)}
                  onUpdate={(data: any) => handleUpdateHotel(hotel.id, data)}
                  onDelete={() => handleDeleteHotel(hotel.id)}
                  onAddDuration={(data: any) => handleAddDuration(hotel.id, data)}
                  onUpdateDuration={(durId: string, data: any) => handleUpdateDuration(hotel.id, durId, data)}
                  onDeleteDuration={(durId: string) => handleDeleteDuration(hotel.id, durId)}
                  onAddEmployee={(durId: string, slotIndex: number, data: any) => handleAddEmployee(hotel.id, durId, slotIndex, data)}
                  onUpdateEmployee={(durId: string, empId: string, data: any) => handleUpdateEmployee(hotel.id, durId, empId, data)}
                  onDeleteEmployee={(durId: string, empId: string) => handleDeleteEmployee(hotel.id, durId, empId)}
                  viewOnly={viewOnly}
                />
              ))
            )}
          </div>
        )}
      </main>

      {showAddHotel && !viewOnly && (
        <AddHotelModal
          theme={theme} lang={lang}
          onClose={() => setShowAddHotel(false)}
          onAdd={handleAddHotel}
        />
      )}

      {showExport && (
        <ExportModal
          theme={theme} lang={lang}
          hotels={filteredHotels}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
