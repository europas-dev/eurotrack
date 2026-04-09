// src/components/UserManagement.tsx
import React, { useEffect, useState } from 'react';
import { getAllUsers, setUserRole, UserRole } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Users, Shield, Crown, Eye, Edit3, Clock, Sun, Moon, Globe, ArrowLeft } from 'lucide-react';

interface Props {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  onSignOut: () => void;
  onBack: () => void;
}

const ROLE_LABELS: Record<UserRole, { en: string; de: string; color: string; icon: React.ReactNode }> = {
  superadmin: { en: 'Super Admin', de: 'Super Admin', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: <Crown size={12} /> },
  admin:      { en: 'Admin',       de: 'Admin',       color: 'text-green-400 bg-green-400/10 border-green-400/20',   icon: <Shield size={12} /> },
  editor:     { en: 'Editor',      de: 'Bearbeiter',  color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',     icon: <Edit3 size={12} /> },
  viewer:     { en: 'Viewer',      de: 'Betrachter',  color: 'text-slate-400 bg-slate-400/10 border-slate-400/20',  icon: <Eye size={12} /> },
  pending:    { en: 'Pending',     de: 'Ausstehend',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',  icon: <Clock size={12} /> },
};

export default function UserManagement({ theme, lang, toggleTheme, setLang, onBack }: Props) {
  const dk = theme === 'dark';
  const [users, setUsers]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    getAllUsers()
      .then(u => { setUsers(u); setLoading(false); })
      .catch(e => { setDbError(String(e)); setLoading(false); });
  }, []);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSaving(userId);
    try {
      await setUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      alert('Failed to update role');
    } finally {
      setSaving(null);
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

      {/* Header */}
      <header className={cn('shrink-0 flex items-center justify-between px-6 py-4 border-b', dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200')}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={cn('p-2 rounded-lg mr-1 transition-all', dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
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
          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className={cn('p-2 rounded-lg text-xs font-bold flex items-center gap-1', dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            <Globe size={14} /> {lang === 'de' ? 'EN' : 'DE'}
          </button>
          <button onClick={toggleTheme} className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            {dk ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(['superadmin','admin','editor','viewer','pending'] as UserRole[]).map(r => {
              const count = users.filter(u => (u.role ?? 'pending') === r).length;
              const info  = ROLE_LABELS[r];
              return (
                <div key={r} className={cn('rounded-xl border p-3 text-center', dk ? 'bg-white/3 border-white/10' : 'bg-white border-slate-200')}>
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
            className={cn('w-full px-4 py-2.5 rounded-xl border text-sm', dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400')}
          />

          {/* Error */}
          {dbError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-xs font-mono">{dbError}</p>
            </div>
          )}

          {/* User table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400" />
            </div>
          ) : (
            <div className={cn('rounded-2xl border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('border-b text-xs font-bold uppercase tracking-wider', dk ? 'bg-white/3 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')}>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Benutzer' : 'User'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'E-Mail' : 'Email'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Rolle' : 'Role'}</th>
                    <th className="px-4 py-3 text-left">{lang === 'de' ? 'Aktion' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => {
                    const role = (user.role ?? 'pending') as UserRole;
                    const info = ROLE_LABELS[role];
                    const isSaving = saving === user.id;
                    return (
                      <tr key={user.id} className={cn('border-b transition-colors',
                        i % 2 === 0 ? (dk ? 'bg-transparent' : 'bg-white') : (dk ? 'bg-white/2' : 'bg-slate-50/50'),
                        dk ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50')}>
                        <td className="px-4 py-3">
                          <div className="font-bold">{user.full_name || user.username || '—'}</div>
                          {user.username && user.full_name && (
                            <div className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>@{user.username}</div>
                          )}
                        </td>
                        <td className={cn('px-4 py-3', dk ? 'text-slate-400' : 'text-slate-500')}>{user.email || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border', info.color)}>
                            {info.icon}
                            {lang === 'de' ? info.de : info.en}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {role === 'superadmin' ? (
                            <span className={cn('text-xs', dk ? 'text-slate-600' : 'text-slate-300')}>
                              {lang === 'de' ? 'Geschützt' : 'Protected'}
                            </span>
                          ) : (
                            <select
                              disabled={isSaving}
                              value={role}
                              onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                              className={cn('px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer disabled:opacity-50',
                                dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                              )}
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">{lang === 'de' ? 'Bearbeiter' : 'Editor'}</option>
                              <option value="viewer">{lang === 'de' ? 'Betrachter' : 'Viewer'}</option>
                              <option value="pending">{lang === 'de' ? 'Ausstehend' : 'Pending'}</option>
                            </select>
                          )}
                          {isSaving && <span className={cn('ml-2 text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>...</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className={cn('px-4 py-12 text-center', dk ? 'text-slate-600' : 'text-slate-400')}>
                        <Users className="mx-auto mb-2 opacity-30" size={32} />
                        <div className="font-bold">{lang === 'de' ? 'Keine Benutzer gefunden' : 'No users found'}</div>
                        {!dbError && (
                          <div className="text-xs mt-1 opacity-60">
                            {lang === 'de' ? 'Prüfen Sie die RLS-Richtlinien in Supabase' : 'Check RLS policies in Supabase'}
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
