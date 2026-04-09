// src/components/UserManagement.tsx
import React, { useEffect, useState } from 'react';
import { getAllUsers, setUserRole, UserRole } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Users, Shield, Crown, Eye, Edit3, Clock, Sun, Moon, Globe, ArrowLeft, AlertTriangle, Check } from 'lucide-react';

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

// Confirmation dialog
function ConfirmDialog({
  user, newRole, lang, theme, onConfirm, onCancel, saving,
}: {
  user: any; newRole: UserRole; lang: 'de' | 'en'; theme: 'dark' | 'light';
  onConfirm: () => void; onCancel: () => void; saving: boolean;
}) {
  const dk   = theme === 'dark';
  const meta = ROLE_META[newRole];
  const name = user.full_name || user.username || user.email || 'User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
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

        <p className={cn('text-sm leading-relaxed mb-5', dk ? 'text-slate-400' : 'text-slate-500')}>
          {lang === 'de'
            ? <>Die Rolle von <strong className={dk ? 'text-white' : 'text-slate-900'}>{name}</strong> wird auf <span className={cn('font-bold', meta.color.split(' ')[0])}>{meta.de}</span> geändert.</>
            : <>The role of <strong className={dk ? 'text-white' : 'text-slate-900'}>{name}</strong> will be changed to <span className={cn('font-bold', meta.color.split(' ')[0])}>{meta.en}</span>.</>
          }
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={saving}
            className={cn('px-4 py-2 rounded-xl text-sm font-bold transition-all',
              dk ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600')}
          >
            {lang === 'de' ? 'Abbrechen' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-2 disabled:opacity-60"
          >
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

  // Pending change state
  const [pendingChange, setPendingChange] = useState<{ user: any; newRole: UserRole } | null>(null);
  const [saving,        setSaving]        = useState(false);
  // Per-row selected role (before confirm)
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
    if (newRole === (user.role as UserRole)) return; // no change
    setPendingChange({ user, newRole });
  }

  async function confirmChange() {
    if (!pendingChange) return;
    setSaving(true);
    try {
      await setUserRole(pendingChange.user.id, pendingChange.newRole);
      setUsers(prev => prev.map(u =>
        u.id === pendingChange.user.id ? { ...u, role: pendingChange.newRole } : u
      ));
      setSelectedRole(prev => { const n = { ...prev }; delete n[pendingChange.user.id]; return n; });
    } catch {
      alert('Failed to update role');
    } finally {
      setSaving(false);
      setPendingChange(null);
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

      {/* Confirm dialog */}
      {pendingChange && (
        <ConfirmDialog
          user={pendingChange.user}
          newRole={pendingChange.newRole}
          lang={lang} theme={theme}
          saving={saving}
          onConfirm={confirmChange}
          onCancel={() => {
            setPendingChange(null);
            // reset the dropdown to current real role
            setSelectedRole(prev => {
              const n = { ...prev };
              delete n[pendingChange.user.id];
              return n;
            });
          }}
        />
      )}

      {/* Header */}
      <header className={cn('shrink-0 flex items-center justify-between px-6 py-4 border-b',
        dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className={cn('p-2 rounded-lg mr-1 transition-all',
              dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            <ArrowLeft size={16} />
          </button>
          <div className="w-8 h-8 bg-yellow-400/10 border border-yellow-400/20 rounded-lg flex items-center justify-center">
            <Crown className="text-yellow-400" size={16} />
          </div>
          <div>
            <h1 className="font-black text-lg leading-none">
              Euro<span className="text-yellow-400">Track.</span>
            </h1>
            <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
              {lang === 'de' ? 'Benutzerverwaltung' : 'User Management'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            className={cn('p-1.5 rounded-lg transition-all', dk ? 'hover:bg-white/5' : 'hover:bg-slate-100')}>
            {lang === 'de'
              ? <svg width={22} height={14} viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 3 }}><rect width="60" height="36" fill="#012169" /><path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="8" /><path d="M0,0 L60,36" stroke="#C8102E" strokeWidth="4.8" /><path d="M60,0 L0,36" stroke="#C8102E" strokeWidth="4.8" /><path d="M30,0 V36 M0,18 H60" stroke="#fff" strokeWidth="12" /><path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7.2" /></svg>
              : <svg width={22} height={14} viewBox="0 0 30 18" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 3 }}><rect width="30" height="6" fill="#000" /><rect y="6" width="30" height="6" fill="#D00" /><rect y="12" width="30" height="6" fill="#FFCE00" /></svg>
            }
          </button>
          <button onClick={toggleTheme}
            className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            {dk ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(['superadmin','admin','editor','viewer','pending'] as UserRole[]).map(r => {
              const count = users.filter(u => (u.role ?? 'pending') === r).length;
              const info  = ROLE_META[r];
              return (
                <div key={r} className={cn('rounded-xl border p-3 text-center',
                  dk ? 'bg-white/3 border-white/10' : 'bg-white border-slate-200')}>
                  <div className={cn('text-2xl font-black', info.color.split(' ')[0])}>{count}</div>
                  <div className={cn('text-xs font-bold mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? info.de : info.en}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'de' ? 'Benutzer suchen…' : 'Search users…'}
            className={cn('w-full px-4 py-2.5 rounded-xl border text-sm',
              dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-500'
                 : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
          />

          {/* Error */}
          {dbError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-xs font-mono">{dbError}</p>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400" />
            </div>
          ) : (
            <div className={cn('rounded-2xl border overflow-hidden',
              dk ? 'border-white/10' : 'border-slate-200')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('border-b text-xs font-bold uppercase tracking-wider',
                    dk ? 'bg-white/3 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')}>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Benutzer' : 'User'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'E-Mail' : 'Email'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Aktuelle Rolle' : 'Current Role'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Neue Rolle' : 'New Role'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Aktion' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => {
                    const currentRole = (user.role ?? 'pending') as UserRole;
                    const chosen      = (selectedRole[user.id] ?? currentRole) as UserRole;
                    const changed     = chosen !== currentRole;
                    const info        = ROLE_META[currentRole];

                    return (
                      <tr key={user.id}
                        className={cn('border-b transition-colors',
                          i % 2 === 0
                            ? (dk ? 'bg-transparent' : 'bg-white')
                            : (dk ? 'bg-white/2' : 'bg-slate-50/50'),
                          dk ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50')}
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="font-bold">{user.full_name || user.username || '—'}</div>
                          {user.username && user.full_name && (
                            <div className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>@{user.username}</div>
                          )}
                        </td>

                        {/* Email */}
                        <td className={cn('px-4 py-3 text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                          {user.email || '—'}
                        </td>

                        {/* Current role badge */}
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border', info.color)}>
                            {info.icon}
                            {lang === 'de' ? info.de : info.en}
                          </span>
                        </td>

                        {/* Role selector */}
                        <td className="px-4 py-3">
                          {currentRole === 'superadmin' ? (
                            <span className={cn('text-xs', dk ? 'text-slate-600' : 'text-slate-300')}>
                              {lang === 'de' ? 'Geschützt' : 'Protected'}
                            </span>
                          ) : (
                            <select
                              value={chosen}
                              onChange={e => handleDropdownChange(user, e.target.value as UserRole)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer',
                                // Dark mode: explicit dark bg + light text so it's readable
                                dk
                                  ? 'bg-slate-800 border-white/10 text-white'
                                  : 'bg-white border-slate-200 text-slate-900'
                              )}
                              style={dk ? { colorScheme: 'dark' } : {}}
                            >
                              <option value="admin"   className={dk ? 'bg-slate-800 text-white' : ''}>Admin</option>
                              <option value="editor"  className={dk ? 'bg-slate-800 text-white' : ''}>{lang === 'de' ? 'Bearbeiter' : 'Editor'}</option>
                              <option value="viewer"  className={dk ? 'bg-slate-800 text-white' : ''}>{lang === 'de' ? 'Betrachter' : 'Viewer'}</option>
                              <option value="pending" className={dk ? 'bg-slate-800 text-white' : ''}>{lang === 'de' ? 'Ausstehend' : 'Pending'}</option>
                            </select>
                          )}
                        </td>

                        {/* Apply button */}
                        <td className="px-4 py-3">
                          {currentRole !== 'superadmin' && (
                            <button
                              onClick={() => handleApplyClick(user)}
                              disabled={!changed}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                changed
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : (dk ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-300 cursor-not-allowed')
                              )}
                            >
                              {lang === 'de' ? 'Anwenden' : 'Apply'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5}
                        className={cn('px-4 py-12 text-center', dk ? 'text-slate-600' : 'text-slate-400')}>
                        <Users className="mx-auto mb-2 opacity-30" size={32} />
                        <div className="font-bold">
                          {lang === 'de' ? 'Keine Benutzer gefunden' : 'No users found'}
                        </div>
                        {!dbError && (
                          <div className="text-xs mt-1 opacity-60">
                            {lang === 'de'
                              ? 'Prüfen Sie die RLS-Richtlinien in Supabase'
                              : 'Check RLS policies in Supabase'}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
