// src/components/ShareModal.tsx
// Global collaborator invite + management — not per-hotel
import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import {
  getCollaborators, inviteCollaborator, updateCollaboratorPermission,
  removeCollaborator, searchProfiles,
} from '../lib/supabase';
import { X, UserPlus, Search, Loader2, Trash2, Shield, Eye } from 'lucide-react';

interface ShareModalProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  onClose: () => void;
}

export default function ShareModal({ theme, lang, onClose }: ShareModalProps) {
  const dk = theme === 'dark';

  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loadingCollabs, setLoadingCollabs] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [inviting, setInviting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadCollabs(); }, []);

  async function loadCollabs() {
    setLoadingCollabs(true);
    try {
      // null = global (not per hotel)
      const data = await getCollaborators(null);
      setCollaborators(data);
    } catch { setCollaborators([]); }
    finally { setLoadingCollabs(false); }
  }

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProfiles(searchQuery);
        // Filter out already-invited users
        const collabIds = new Set(collaborators.map(c => c.userId));
        setSearchResults(results.filter((r: any) => !collabIds.has(r.id)));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, collaborators]);

  async function handleInvite(user: any) {
    setInviting(user.id);
    setMsg('');
    try {
      // hotel_id = null means access to the whole dashboard
      await inviteCollaborator(null, user.id, inviteRole);
      setMsg(lang === 'de' ? `${user.email} eingeladen als ${inviteRole}` : `${user.email} invited as ${inviteRole}`);
      setSearchQuery('');
      setSearchResults([]);
      await loadCollabs();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally { setInviting(null); }
  }

  async function handleChangeRole(collab: any, newRole: 'viewer' | 'editor') {
    try {
      await updateCollaboratorPermission(collab.id, newRole);
      setCollaborators(p => p.map(c => c.id === collab.id ? { ...c, role: newRole } : c));
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function handleRemove(collab: any) {
    setRemoving(collab.userId);
    try {
      await removeCollaborator(collab.userId);
      setCollaborators(p => p.filter(c => c.userId !== collab.userId));
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    finally { setRemoving(null); }
  }

  const surface = dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
       : 'bg-slate-50 border-slate-200 focus:border-blue-400 text-slate-900 placeholder-slate-400');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn('w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden', surface)}>

        {/* Header */}
        <div className={cn('flex items-center justify-between px-6 py-4 border-b', dk ? 'border-white/10' : 'border-slate-200')}>
          <div>
            <h2 className="text-lg font-black">{lang === 'de' ? 'Zugang teilen' : 'Share Access'}</h2>
            <p className={cn('text-xs mt-0.5', dk ? 'text-slate-400' : 'text-slate-500')}>
              {lang === 'de'
                ? 'Lade Nutzer ein — sie sehen das gesamte Dashboard'
                : 'Invite users — they get access to the whole dashboard'}
            </p>
          </div>
          <button onClick={onClose} className={cn('p-2 rounded-lg transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Invite section */}
          <div>
            <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-2', dk ? 'text-slate-200' : 'text-slate-700')}>
              <UserPlus size={15} />
              {lang === 'de' ? 'Nutzer einladen' : 'Invite user'}
            </h3>

            {/* Role selector */}
            <div className="flex gap-2 mb-3">
              {(['viewer', 'editor'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={cn('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-all',
                    inviteRole === r
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                  {r === 'viewer' ? <Eye size={14} /> : <Shield size={14} />}
                  {r === 'viewer'
                    ? (lang === 'de' ? 'Nur Ansicht' : 'Viewer')
                    : (lang === 'de' ? 'Bearbeiter' : 'Editor')}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative">
              <Search size={15} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dk ? 'text-slate-500' : 'text-slate-400')} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'de' ? 'E-Mail oder Benutzername suchen...' : 'Search by email or username...'}
                className={cn(inputCls, 'pl-9')}
              />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className={cn('mt-2 rounded-xl border divide-y overflow-hidden',
                dk ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100')}>
                {searchResults.map(user => (
                  <div key={user.id} className={cn('flex items-center justify-between px-4 py-3',
                    dk ? 'hover:bg-white/5' : 'hover:bg-slate-50')}>
                    <div>
                      <p className="text-sm font-bold">{user.fullName || user.email}</p>
                      <p className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                        @{user.username || ''} {user.email}
                      </p>
                    </div>
                    <button
                      onClick={() => handleInvite(user)}
                      disabled={inviting === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all">
                      {inviting === user.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                      {inviteRole === 'viewer' ? (lang === 'de' ? 'Als Leser' : 'As viewer') : (lang === 'de' ? 'Als Editor' : 'As editor')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className={cn('text-xs mt-2 px-1', dk ? 'text-slate-500' : 'text-slate-400')}>
                {lang === 'de' ? 'Kein Nutzer gefunden' : 'No users found'}
              </p>
            )}

            {msg && (
              <p className={cn('text-xs mt-2 px-1 font-bold', msg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                {msg}
              </p>
            )}
          </div>

          {/* Collaborators list */}
          <div>
            <h3 className={cn('text-sm font-bold mb-3', dk ? 'text-slate-200' : 'text-slate-700')}>
              {lang === 'de' ? 'Aktuelle Zugriffe' : 'Current Access'}
              {collaborators.length > 0 && (
                <span className={cn('ml-2 text-xs font-bold px-2 py-0.5 rounded-full',
                  dk ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                  {collaborators.length}
                </span>
              )}
            </h3>

            {loadingCollabs ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span className={cn('text-sm', dk ? 'text-slate-400' : 'text-slate-500')}>Loading...</span>
              </div>
            ) : collaborators.length === 0 ? (
              <div className={cn('text-center py-8 rounded-xl border-2 border-dashed',
                dk ? 'border-white/10' : 'border-slate-200')}>
                <p className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Noch niemand eingeladen' : 'No collaborators yet'}
                </p>
              </div>
            ) : (
              <div className={cn('rounded-xl border divide-y overflow-hidden',
                dk ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100')}>
                {collaborators.map(collab => (
                  <div key={collab.id} className={cn('flex items-center gap-3 px-4 py-3',
                    dk ? 'hover:bg-white/5' : 'hover:bg-slate-50')}>

                    {/* Avatar */}
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
                      dk ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                      {(collab.fullName || collab.email || '?')[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{collab.fullName || collab.email}</p>
                      <p className={cn('text-xs truncate', dk ? 'text-slate-400' : 'text-slate-500')}>{collab.email}</p>
                    </div>

                    {/* Role toggle */}
                    <div className="flex gap-1">
                      {(['viewer', 'editor'] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => handleChangeRole(collab, r)}
                          className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all',
                            collab.role === r
                              ? 'bg-blue-600 text-white'
                              : dk ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                          {r === 'viewer' ? <Eye size={11} /> : <Shield size={11} />}
                          {r === 'viewer'
                            ? (lang === 'de' ? 'Leser' : 'View')
                            : (lang === 'de' ? 'Editor' : 'Edit')}
                        </button>
                      ))}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(collab)}
                      disabled={removing === collab.userId}
                      className={cn('p-1.5 rounded-lg transition-all flex-shrink-0',
                        dk ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50')}>
                      {removing === collab.userId
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Access explanation */}
          <div className={cn('rounded-xl p-4 text-xs leading-relaxed space-y-1.5',
            dk ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500')}>
            <p className="font-bold mb-2">{lang === 'de' ? 'Zugriffsebenen:' : 'Access levels:'}</p>
            <p>\uD83D\uDC41 <strong>Viewer</strong> — {lang === 'de' ? 'Kann alles sehen, nichts bearbeiten' : 'Can view everything, cannot edit'}</p>
            <p>\u270F\uFE0F <strong>Editor</strong> — {lang === 'de' ? 'Kann Hotels und Buchungen bearbeiten' : 'Can edit hotels and bookings'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
