// src/components/UserManagement.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { getAllUsers, setUserRole, UserRole } from '../lib/supabase';
import { cn } from '../lib/utils';
import {
  Users, Shield, Crown, Eye, Edit3, Clock,
  Sun, Moon, Globe, ArrowLeft,
  Check, XCircle, Search, RefreshCw, ChevronDown, Lock,
} from 'lucide-react';

interface Props {
  theme:       'dark' | 'light';
  lang:        'de' | 'en';
  toggleTheme: () => void;
  setLang:     (l: 'de' | 'en') => void;
  onSignOut:   () => void;
  onBack:      () => void;
}

type Filter = 'all' | UserRole;

// superadmin is intentionally excluded from the assignable dropdown options
const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'editor', 'viewer', 'pending'];
const ALL_ROLES:        UserRole[] = ['superadmin', 'admin', 'editor', 'viewer', 'pending'];

const ROLE_META: Record<UserRole, {
  en: string; de: string;
  bg: string; text: string; border: string;
  dot: string;
  icon: React.ReactNode;
}> = {
  superadmin: {
    en: 'Super Admin', de: 'Super Admin',
    bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', dot: 'bg-yellow-400',
    icon: <Crown size={13} />,
  },
  admin: {
    en: 'Admin', de: 'Admin',
    bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', dot: 'bg-green-400',
    icon: <Shield size={13} />,
  },
  editor: {
    en: 'Editor', de: 'Bearbeiter',
    bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400',
    icon: <Edit3 size={13} />,
  },
  viewer: {
    en: 'Viewer', de: 'Betrachter',
    bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400',
    icon: <Eye size={13} />,
  },
  pending: {
    en: 'Pending', de: 'Ausstehend',
    bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400',
    icon: <Clock size={13} />,
  },
};

// Gradient avatars by first letter
const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-pink-600',
  'from-green-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-cyan-500 to-blue-600',
  'from-rose-500 to-pink-600',
];
function avatarGradient(str: string) {
  const code = (str || '?').charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ── Confirm dialog ──────────────────────────────────────────────────────────
function ConfirmDialog({
  user, newRole, lang, theme, onConfirm, onCancel, saving, saveError,
}: {
  user: any; newRole: UserRole; lang: 'de' | 'en'; theme: 'dark' | 'light';
  onConfirm: () => void; onCancel: () => void; saving: boolean; saveError: string;
}) {
  const dk   = theme === 'dark';
  const meta = ROLE_META[newRole];
  const name = user.full_name || user.username || user.email || 'User';
  const prev = ROLE_META[user.role as UserRole] ?? ROLE_META.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.70)' }}>
      <div className={cn(
        'w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden',
        dk ? 'bg-[#0D1625] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
      )}>
        <div className={cn('h-1.5 w-full', meta.dot)} />

        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', meta.bg, meta.border)}>
              <span className={meta.text}>{meta.icon}</span>
            </div>
            <div>
              <h3 className="font-black text-sm">
                {lang === 'de' ? 'Rolle ändern?' : 'Change Role?'}
              </h3>
              <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>{name}</p>
            </div>
          </div>

          {/* Before → After */}
          <div className={cn('flex items-center gap-3 p-3 rounded-xl mb-4', dk ? 'bg-white/5' : 'bg-slate-50')}>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
              prev.bg, prev.text, prev.border)}>
              {prev.icon} {lang === 'de' ? prev.de : prev.en}
            </span>
            <span className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>→</span>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
              meta.bg, meta.text, meta.border)}>
              {meta.icon} {lang === 'de' ? meta.de : meta.en}
            </span>
          </div>

          {saveError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-400 text-xs leading-relaxed">{saveError}</p>
            </div>
          )}

          <div className="flex gap-2.5">
            <button onClick={onCancel} disabled={saving}
              className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                dk ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600')}>
              {lang === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button onClick={onConfirm} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              {saving
                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {lang === 'de' ? 'Speichern…' : 'Saving…'}</>
                : <><Check size={14} /> {lang === 'de' ? 'Bestätigen' : 'Confirm'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Role badge ──────────────────────────────────────────────────────────────
function RoleBadge({ role, lang }: { role: UserRole; lang: 'de' | 'en' }) {
  const m = ROLE_META[role] ?? ROLE_META.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', m.bg, m.text, m.border)}>
      {m.icon} {lang === 'de' ? m.de : m.en}
    </span>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ role, count, active, lang, onClick, theme }: {
  role: Filter; count: number; active: boolean;
  lang: 'de' | 'en'; onClick: () => void; theme: 'dark' | 'light';
}) {
  const dk = theme === 'dark';
  if (role === 'all') {
    return (
      <button onClick={onClick} className={cn(
        'flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-2xl border transition-all min-w-[72px] text-center',
        active
          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
          : dk ? 'bg-white/5 border-white/10 hover:bg-white/8 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
      )}>
        <span className="text-xl font-black leading-none">{count}</span>
        <span className="text-[11px] font-bold opacity-80">{lang === 'de' ? 'Alle' : 'All'}</span>
      </button>
    );
  }
  const m = ROLE_META[role as UserRole];
  return (
    <button onClick={onClick} className={cn(
      'flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-2xl border transition-all min-w-[72px] text-center',
      active
        ? cn(m.bg, m.border, 'shadow-sm ring-2', m.text.replace('text-', 'ring-').replace('400', '400/40'))
        : dk ? 'bg-white/5 border-white/10 hover:bg-white/8' : 'bg-white border-slate-200 hover:bg-slate-50'
    )}>
      <span className={cn('text-xl font-black leading-none', active ? m.text : dk ? 'text-white' : 'text-slate-800')}>
        {count}
      </span>
      <span className={cn('text-[11px] font-bold', active ? m.text : dk ? 'text-slate-500' : 'text-slate-400')}>
        {role === 'superadmin' ? 'Super' :
         role === 'admin'      ? 'Admin' :
         role === 'editor'     ? (lang === 'de' ? 'Bearb.' : 'Editor') :
         role === 'viewer'     ? (lang === 'de' ? 'Betracht.' : 'Viewer') :
                                  (lang === 'de' ? 'Ausst.' : 'Pending')}
      </span>
    </button>
  );
}

// ── User row ────────────────────────────────────────────────────────────────
function UserRow({
  user, lang, theme,
  selectedRole, onDropdownChange, onApply, isSelf,
}: {
  user: any; lang: 'de' | 'en'; theme: 'dark' | 'light';
  selectedRole: UserRole; onDropdownChange: (r: UserRole) => void;
  onApply: () => void; isSelf: boolean;
}) {
  const dk          = theme === 'dark';
  const currentRole = (user.role as UserRole) ?? 'pending';
  // superadmin rows are fully locked — cannot be changed via the UI
  const isSuperAdmin = currentRole === 'superadmin';
  const isLocked     = isSuperAdmin || isSelf;
  const isDirty      = !isLocked && selectedRole !== currentRole;
  const initials     = (user.full_name || user.username || user.email || '?')[0].toUpperCase();
  const grad         = avatarGradient(initials);

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all',
      isLocked
        ? dk ? 'bg-white/[0.02] border-white/[0.04] opacity-70' : 'bg-slate-50 border-slate-100 opacity-70'
        : dk ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10'
             : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
    )}>
      {/* Avatar */}
      <div className={cn(
        'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-black text-sm shrink-0 select-none',
        grad
      )}>
        {initials}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm leading-tight truncate">
            {user.full_name || user.username || user.email}
          </p>
          {isSuperAdmin && (
            <Lock size={11} className={dk ? 'text-yellow-400/60 shrink-0' : 'text-yellow-600/60 shrink-0'} />
          )}
        </div>
        <p className={cn('text-xs truncate mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
          {user.email}
          {user.username && <span className="ml-2 opacity-60">@{user.username}</span>}
        </p>
      </div>

      {/* Role badge (current) */}
      <div className="hidden sm:block shrink-0">
        <RoleBadge role={currentRole} lang={lang} />
      </div>

      {/* Dropdown — hidden for superadmins, shown for everyone else */}
      {isSuperAdmin ? (
        <div className={cn(
          'shrink-0 px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5',
          dk ? 'bg-yellow-500/5 border-yellow-500/10 text-yellow-400/50' : 'bg-yellow-50 border-yellow-200 text-yellow-600/50'
        )}>
          <Lock size={11} />
          {lang === 'de' ? 'Nur DB' : 'DB only'}
        </div>
      ) : (
        <>
          <div className="relative shrink-0">
            <select
              value={selectedRole}
              onChange={e => onDropdownChange(e.target.value as UserRole)}
              disabled={isLocked}
              className={cn(
                'appearance-none text-xs font-bold pl-3 pr-7 py-2 rounded-xl border outline-none transition-all cursor-pointer',
                isLocked && 'opacity-40 cursor-not-allowed',
                isDirty
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : dk
                    ? 'bg-white/8 border-white/10 text-slate-300 hover:bg-white/12'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              )}
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>
                  {r === 'admin'  ? 'Admin' :
                   r === 'editor' ? (lang === 'de' ? 'Bearbeiter' : 'Editor') :
                   r === 'viewer' ? (lang === 'de' ? 'Betrachter' : 'Viewer') :
                                     (lang === 'de' ? 'Ausstehend' : 'Pending')}
                </option>
              ))}
            </select>
            <ChevronDown size={11}
              className={cn('absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none',
                isDirty ? 'text-white/70' : dk ? 'text-slate-500' : 'text-slate-400')}
            />
          </div>

          <button
            onClick={onApply}
            disabled={!isDirty}
            className={cn(
              'shrink-0 px-3.5 py-2 rounded-xl text-xs font-black transition-all',
              isDirty
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 hover:scale-105'
                : 'opacity-0 pointer-events-none'
            )}
          >
            {lang === 'de' ? 'Anwenden' : 'Apply'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function UserManagement({ theme, lang, toggleTheme, setLang, onBack }: Props) {
  const dk = theme === 'dark';

  const [users,         setUsers]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [dbError,       setDbError]       = useState('');
  const [search,        setSearch]        = useState('');
  const [filter,        setFilter]        = useState<Filter>('all');
  const [pendingChange, setPendingChange] = useState<{ user: any; newRole: UserRole } | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState('');
  const [selectedRole,  setSelectedRole]  = useState<Record<string, UserRole>>({});

  async function loadUsers(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setDbError('');
    try {
      const u = await getAllUsers();
      setUsers(u);
    } catch (e: any) {
      setDbError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length };
    ALL_ROLES.forEach(r => { c[r] = users.filter(u => u.role === r).length; });
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchFilter = filter === 'all' || u.role === filter;
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [users, filter, search]);

  function handleDropdownChange(userId: string, newRole: UserRole) {
    setSelectedRole(prev => ({ ...prev, [userId]: newRole }));
  }

  function handleApplyClick(user: any) {
    const newRole = selectedRole[user.id] ?? (user.role as UserRole);
    if (newRole === user.role) return;
    setSaveError('');
    setPendingChange({ user, newRole });
  }

  async function confirmChange() {
    if (!pendingChange) return;
    setSaving(true); setSaveError('');
    try {
      await setUserRole(pendingChange.user.id, pendingChange.newRole);
      setUsers(prev => prev.map(u =>
        u.id === pendingChange.user.id ? { ...u, role: pendingChange.newRole } : u
      ));
      setSelectedRole(prev => { const n = { ...prev }; delete n[pendingChange.user.id]; return n; });
      setPendingChange(null);
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to update role');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn('flex flex-col h-full', dk ? 'bg-[#020617]' : 'bg-slate-50')}>

      {pendingChange && (
        <ConfirmDialog
          user={pendingChange.user} newRole={pendingChange.newRole}
          lang={lang} theme={theme} saving={saving} saveError={saveError}
          onConfirm={confirmChange}
          onCancel={() => { setPendingChange(null); setSaveError(''); }}
        />
      )}

      {/* ── Header ── */}
      <div className={cn('shrink-0 border-b', dk ? 'bg-[#0A1120] border-white/10' : 'bg-white border-slate-200')}>
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <button onClick={onBack}
              className={cn('p-2 rounded-xl transition-all', dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500')}>
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Users size={17} className="text-white" />
              </div>
              <div>
                <h1 className="font-black text-base leading-tight">
                  {lang === 'de' ? 'Benutzerverwaltung' : 'User Management'}
                </h1>
                <p className={cn('text-xs leading-tight', dk ? 'text-slate-500' : 'text-slate-400')}>
                  EuroTrack &mdash; Super Admin
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadUsers(true)} disabled={refreshing}
              className={cn('p-2 rounded-xl transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5',
                dk ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600')}>
              <Globe size={12} /> {lang === 'de' ? 'EN' : 'DE'}
            </button>
            <button onClick={toggleTheme}
              className={cn('p-2 rounded-xl transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
              {dk ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Stats filter row */}
        <div className="flex items-center gap-2.5 px-6 py-4 overflow-x-auto no-scrollbar">
          <StatCard role="all"        count={counts.all}        active={filter === 'all'}        lang={lang} onClick={() => setFilter('all')}        theme={theme} />
          <StatCard role="superadmin" count={counts.superadmin} active={filter === 'superadmin'} lang={lang} onClick={() => setFilter('superadmin')} theme={theme} />
          <StatCard role="admin"      count={counts.admin}      active={filter === 'admin'}      lang={lang} onClick={() => setFilter('admin')}      theme={theme} />
          <StatCard role="editor"     count={counts.editor}     active={filter === 'editor'}     lang={lang} onClick={() => setFilter('editor')}     theme={theme} />
          <StatCard role="viewer"     count={counts.viewer}     active={filter === 'viewer'}     lang={lang} onClick={() => setFilter('viewer')}     theme={theme} />
          <StatCard role="pending"    count={counts.pending}    active={filter === 'pending'}    lang={lang} onClick={() => setFilter('pending')}    theme={theme} />
        </div>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search size={15} className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'de' ? 'Name, E-Mail oder Benutzername…' : 'Search name, email or username…'}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all',
                dk
                  ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
              )}
            />
          </div>
        </div>
      </div>

      {/* ── User list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn('h-[64px] rounded-2xl border animate-pulse',
            dk ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-100')} />
        ))}

        {!loading && dbError && (
          <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold text-sm">{lang === 'de' ? 'Fehler beim Laden' : 'Error loading users'}</p>
              <p className="text-red-400/70 text-xs mt-1">{dbError}</p>
            </div>
          </div>
        )}

        {!loading && !dbError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center border',
              dk ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200')}>
              <Users size={22} className={dk ? 'text-slate-500' : 'text-slate-400'} />
            </div>
            <p className={cn('text-sm font-bold', dk ? 'text-slate-500' : 'text-slate-400')}>
              {search ? (lang === 'de' ? 'Keine Treffer' : 'No matches') : (lang === 'de' ? 'Keine Benutzer' : 'No users')}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-blue-500 hover:underline">
                {lang === 'de' ? 'Suche löschen' : 'Clear search'}
              </button>
            )}
          </div>
        )}

        {!loading && !dbError && filtered.map(user => (
          <UserRow
            key={user.id}
            user={user}
            lang={lang}
            theme={theme}
            isSelf={false}
            selectedRole={selectedRole[user.id] ?? (user.role as UserRole)}
            onDropdownChange={r => handleDropdownChange(user.id, r)}
            onApply={() => handleApplyClick(user)}
          />
        ))}
      </div>

      {/* Footer */}
      {!loading && !dbError && (
        <div className={cn('shrink-0 border-t px-6 py-3 flex items-center justify-between',
          dk ? 'border-white/10 bg-[#0A1120]' : 'border-slate-200 bg-white')}>
          <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
            {filtered.length} {lang === 'de' ? 'Benutzer angezeigt' : 'users shown'}
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="ml-2 text-blue-500 hover:underline">
                {lang === 'de' ? 'Filter entfernen' : 'clear filter'}
              </button>
            )}
          </p>
          {counts.pending > 0 && (
            <button onClick={() => setFilter('pending')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
              <Clock size={11} />
              {counts.pending} {lang === 'de' ? 'ausstehend' : 'pending'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
