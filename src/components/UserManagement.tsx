// src/components/UserManagement.tsx
import React, { useEffect, useState } from 'react';
import { getAllUsers, setUserRole, UserRole } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Users, Shield, Crown, Eye, Edit3, Clock, Sun, Moon, Globe, ArrowLeft, AlertTriangle, Check, XCircle } from 'lucide-react';

interface Props {
  theme:       'dark' | 'light';
  lang:        'de' | 'en';
  toggleTheme: () => void;
  setLang:     (l: 'de' | 'en') => void;
  onSignOut:   () => void;
  onBack:      () => void;
}

const ROLE_META: Record<UserRole, { en: string; de: string; color: string; icon: React.ReactNode }> = {
  superadmin: { en: 'Super Admin', de: 'Super Admin', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: <Crown  size={12} /> },
  admin:      { en: 'Admin',       de: 'Admin',       color: 'text-green-400 bg-green-400/10 border-green-400/20',   icon: <Shield size={12} /> },
  editor:     { en: 'Editor',      de: 'Bearbeiter',  color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',     icon: <Edit3  size={12} /> },
  viewer:     { en: 'Viewer',      de: 'Betrachter',  color: 'text-slate-400 bg-slate-400/10 border-slate-400/20',  icon: <Eye    size={12} /> },
  pending:    { en: 'Pending',     de: 'Ausstehend',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',  icon: <Clock  size={12} /> },
};

function ConfirmDialog({
  user, newRole, lang, theme, onConfirm, onCancel, saving, saveError,
}: {
  user: any; newRole: UserRole; lang: 'de' | 'en'; theme: 'dark' | 'light';
  onConfirm: () => void; onCancel: () => void; saving: boolean; saveError: string;
}) {
  const dk   = theme === 'dark';
  const meta = ROLE_META[newRole];
  const name = user.full_name || user.username || user.email || 'User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className={cn('w-full max-w-sm rounded-2xl border shadow-2xl p-6',
        dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <h3 className="font-black text-base">
            {lang === 'de' ? 'Rolle ändern?' : 'Change role?'}
          </h3>
        </div>

        <p className={cn('text-sm leading-relaxed mb-4', dk ? 'text-slate-400' : 'text-slate-500')}>
          {lang === 'de'
            ? <><strong className={dk ? 'text-white' : 'text-slate-900'}>{name}</strong> wird auf <span className={cn('font-bold', meta.color.split(' ')[0])}>{meta.de}</span> gesetzt.</>
            : <><strong className={dk ? 'text-white' : 'text-slate-900'}>{name}</strong>'s role will be set to <span className={cn('font-bold', meta.color.split(' ')[0])}>{meta.en}</span>.</>
          }
        </p>

        {/* Show DB error clearly so user knows it failed */}
        {saveError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-400 text-xs leading-relaxed">{saveError}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={saving}
            className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all',
              dk ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600')}>
            {lang === 'de' ? 'Abbrechen' : 'Cancel'}
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-2 disabled:opacity-60">
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {lang === 'de' ? 'Speichern…' : 'Saving…'}</>
              : <><Check size={14} /> {lang === 'de' ? 'Ja, ändern' : 'Yes, change'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement({ theme, lang, toggleTheme, setLang, onBack }: Props) {
  const dk = theme === 'dark';

  const [users,   setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [search,  setSearch]  = useState('');

  const [pendingChange, setPendingChange] = useState<{ user: any; newRole: UserRole } | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState('');
  const [selectedRole,  setSelectedRole]  = useState<Record<string, UserRole>>({});

  useEffect(() => {
    getAllUsers()
      .then(u => { setUsers(u); setLoading(false); })
      .catch(e => { setDbError(String(e)); setLoading(false); });
  }, []);

  function handleDropdownChange(user: any, newRole: UserRole) {
    setSelectedRole(prev => ({ ...prev, [user.id]: newRole }));
  }

  function handleApplyClick(user: any) {
    const newRole = selectedRole[user.id] ?? (user.role as UserRole);
    if (newRole === (user.role as UserRole)) return;
    setSaveError('');
    setPendingChange({ user, newRole });
  }

  async function confirmChange() {
    if (!pendingChange) return;
    setSaving(true);
    setSaveError('');
    try {
      await setUserRole(pendingChange.user.id, pendingChange.newRole);
      // Only update UI AFTER DB confirmed the change
      setUsers(prev => prev.map(u =>
        u.id === pendingChange.user.id ? { ...u, role: pendingChange.newRole } : u
      ));
      setSelectedRole(prev => { const n = { ...prev }; delete n[pendingChange.user.id]; return n; });
      setPendingChange(null);
    } catch (err: any) {
      // Show the real error in the dialog — don't close it
      setSaveError(err.message ?? 'Failed to update role');
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter(u =>
    !search.trim() ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn('flex flex-col h-full', dk ? 'bg-[#020617]' : 'bg-slate-50')}>

      {pendingChange && (
        <ConfirmDialog
          user={pendingChange.user}
          newRole={pendingChange.newRole}
          lang={lang} theme={theme}
          saving={saving}
          saveError={saveError}
          onConfirm={confirmChange}
          onCancel={() => { setPendingChange(null); setSaveError(''); }}
        />
      )}

      {/* Header */}
      <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0',
        dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className={cn('p-2 rounded-xl transition-all', dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-sm">{lang === 'de' ? 'Benutzerverwaltung' : 'User Management'}</h1>
              <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
                {users.length} {lang === 'de' ? 'Benutzer' : 'users'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              dk ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200')}>
            <Globe size={12} /> {lang === 'de' ? 'EN' : 'DE'}
          </button>
          <button onClick={toggleTheme}
            className={cn('p-2 rounded-xl transition-all', dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
            {dk ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={cn('px-6 py-3 border-b shrink-0',
        dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <input
          type="text"
          placeholder={lang === 'de' ? 'Suche nach Name, E-Mail, Benutzername…' : 'Search by name, email, username…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={cn('w-full px-4 py-2.5 rounded-xl text-sm outline-none border transition-all',
            dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
               : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400')}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {dbError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <strong>Error loading users:</strong> {dbError}
          </div>
        )}

        {!loading && !dbError && filtered.length === 0 && (
          <div className={cn('text-center py-16 text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
            {lang === 'de' ? 'Keine Benutzer gefunden.' : 'No users found.'}
          </div>
        )}

        {!loading && filtered.map(user => {
          const currentRole = (user.role as UserRole) ?? 'pending';
          const dropRole    = selectedRole[user.id] ?? currentRole;
          const isDirty     = dropRole !== currentRole;
          const meta        = ROLE_META[currentRole] ?? ROLE_META.pending;

          return (
            <div key={user.id}
              className={cn('flex items-center gap-4 px-4 py-3 rounded-xl mb-2 border transition-all',
                dk ? 'bg-white/3 border-white/5 hover:bg-white/6' : 'bg-white border-slate-200 hover:bg-slate-50')}>

              {/* Avatar */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                {(user.full_name || user.username || user.email || '?')[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">
                  {user.full_name || user.username || user.email}
                </p>
                <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {user.email}
                </p>
              </div>

              {/* Current role badge */}
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0', meta.color)}>
                {meta.icon}
                {lang === 'de' ? meta.de : meta.en}
              </span>

              {/* Role selector */}
              <select
                value={dropRole}
                onChange={e => handleDropdownChange(user, e.target.value as UserRole)}
                disabled={currentRole === 'superadmin'}
                className={cn(
                  'text-xs font-bold px-2 py-1.5 rounded-lg border outline-none transition-all cursor-pointer',
                  dk ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
                  currentRole === 'superadmin' && 'opacity-40 cursor-not-allowed'
                )}
              >
                {(['superadmin', 'admin', 'editor', 'viewer', 'pending'] as UserRole[]).map(r => (
                  <option key={r} value={r}>
                    {r === 'superadmin' ? 'Super Admin' :
                     r === 'admin'      ? 'Admin' :
                     r === 'editor'     ? (lang === 'de' ? 'Bearbeiter' : 'Editor') :
                     r === 'viewer'     ? (lang === 'de' ? 'Betrachter' : 'Viewer') :
                                          (lang === 'de' ? 'Ausstehend' : 'Pending')}
                  </option>
                ))}
              </select>

              {/* Apply button — only shown when dropdown differs from current */}
              <button
                onClick={() => handleApplyClick(user)}
                disabled={!isDirty || currentRole === 'superadmin'}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0',
                  isDirty && currentRole !== 'superadmin'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    : 'opacity-30 cursor-not-allowed',
                  dk ? 'disabled:bg-white/5' : 'disabled:bg-slate-100'
                )}
              >
                {lang === 'de' ? 'Anwenden' : 'Apply'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
