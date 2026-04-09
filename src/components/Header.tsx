// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { getMyProfile, updateMyProfile, getCollaborators, inviteCollaborator, updateCollaboratorPermission, removeCollaborator, searchProfiles } from '../lib/supabase';
import {
  Moon, Sun, Download, Settings, LogOut,
  Bell, X, Check, Loader2, Users, Search,
  User, Lock, UserPlus, Trash2, ChevronDown
} from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSignOut: () => void;
  onExport?: () => void;
  viewOnly?: boolean;
}

export default function Header({
  theme, lang, toggleTheme, setLang,
  searchQuery, setSearchQuery,
  onSignOut, onExport,
  viewOnly = false,
}: HeaderProps) {
  const dk = theme === 'dark';

  const [showShare,    setShowShare]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab,  setSettingsTab]  = useState<'profile' | 'security' | 'collaborators'>('profile');

  // Profile
  const [profile,      setProfile]      = useState<any>(null);
  const [editName,     setEditName]     = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail,    setEditEmail]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');

  // Collaborators (Settings tab)
  const [collabs,      setCollabs]      = useState<any[]>([]);
  const [collabsLoading, setCollabsLoading] = useState(false);

  // Share modal
  const [shareSearch,  setShareSearch]  = useState('');
  const [shareResults, setShareResults] = useState<any[]>([]);
  const [shareSearching, setShareSearching] = useState(false);
  const [inviteRole,   setInviteRole]   = useState<'viewer' | 'editor'>('viewer');
  const [inviteMsg,    setInviteMsg]    = useState('');
  const [inviting,     setInviting]     = useState<string | null>(null);
  const [shareCollabs, setShareCollabs] = useState<any[]>([]);
  const [shareCollabsLoading, setShareCollabsLoading] = useState(false);

  const surface  = dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');
  const iconBtn  = cn('p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900');

  // Load profile once
  useEffect(() => {
    getMyProfile().then(p => {
      if (!p) return;
      setProfile(p);
      setEditName(p.fullName || p.full_name || '');
      setEditUsername(p.username || '');
      setEditEmail(p.email || '');
    });
  }, []);

  // Load collaborators when settings opens on that tab
  useEffect(() => {
    if (showSettings && settingsTab === 'collaborators') loadCollabs();
  }, [showSettings, settingsTab]);

  // Load collaborators when Share modal opens
  useEffect(() => {
    if (showShare) loadShareCollabs();
  }, [showShare]);

  async function loadCollabs() {
    setCollabsLoading(true);
    try { setCollabs(await getCollaborators()); } catch {}
    finally { setCollabsLoading(false); }
  }

  async function loadShareCollabs() {
    setShareCollabsLoading(true);
    try { setShareCollabs(await getCollaborators()); } catch {}
    finally { setShareCollabsLoading(false); }
  }

  async function handleSaveProfile() {
    setSaving(true); setSaveMsg('');
    try {
      const updated = await updateMyProfile({ full_name: editName, username: editUsername });
      setProfile(updated);
      setSaveMsg(lang === 'de' ? '✓ Gespeichert' : '✓ Saved');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e: any) { setSaveMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  // Share modal — search users
  useEffect(() => {
    if (!shareSearch.trim()) { setShareResults([]); return; }
    const t = setTimeout(async () => {
      setShareSearching(true);
      try { setShareResults(await searchProfiles(shareSearch)); } catch {}
      finally { setShareSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [shareSearch]);

  async function handleInvite(userId: string) {
    setInviting(userId); setInviteMsg('');
    try {
      await inviteCollaborator(userId, inviteRole);
      setInviteMsg(lang === 'de' ? '✓ Einladung gesendet' : '✓ Invited');
      setShareSearch(''); setShareResults([]);
      await loadShareCollabs();
      setTimeout(() => setInviteMsg(''), 3000);
    } catch (e: any) { setInviteMsg(`Error: ${e.message}`); }
    finally { setInviting(null); }
  }

  async function handleChangeRole(userId: string, role: 'viewer' | 'editor') {
    try {
      await updateCollaboratorPermission(userId, role);
      setShareCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c));
      setCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c));
    } catch {}
  }

  async function handleRemove(userId: string) {
    try {
      await removeCollaborator(userId);
      setShareCollabs(p => p.filter(c => c.userId !== userId));
      setCollabs(p => p.filter(c => c.userId !== userId));
    } catch {}
  }

  const RoleBadge = ({ role, userId, onChange }: { role: string; userId: string; onChange: (r: 'viewer'|'editor') => void }) => (
    <div className="relative group inline-block">
      <button className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all',
        role === 'editor'
          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
          : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30')}>
        {role === 'editor' ? '✏️ Editor' : '👁 Viewer'}
        <ChevronDown size={10} />
      </button>
      <div className={cn('absolute top-full left-0 mt-1 rounded-lg border shadow-xl z-50 min-w-[110px] overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all',
        dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}>
        {(['viewer', 'editor'] as const).map(r => (
          <button key={r} onClick={() => onChange(r)}
            className={cn('w-full text-left px-3 py-2 text-xs font-bold transition-all',
              r === role
                ? dk ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900'
                : dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-50 text-slate-600')}>
            {r === 'editor' ? '✏️ Editor' : '👁 Viewer'}
          </button>
        ))}
      </div>
    </div>
  );

  const CollabRow = ({ c, onRole, onRemove }: any) => (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border',
      dk ? 'bg-white/3 border-white/8 hover:bg-white/5' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0',
        dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
        {(c.fullName || c.email || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
          {c.fullName || c.username || c.email || 'Unknown'}
        </p>
        <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{c.email}</p>
      </div>
      <RoleBadge role={c.role} userId={c.userId} onChange={r => onRole(c.userId, r)} />
      <button onClick={() => onRemove(c.userId)}
        className={cn('p-1.5 rounded-lg transition-all',
          dk ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <>
      {/* ── Main header bar ── */}
      <header className={cn('shrink-0 flex items-center gap-3 px-6 py-3 border-b', surface)}>

        {/* Logo */}
        <div className="text-xl font-black italic mr-2 whitespace-nowrap select-none">
          Euro<span className="text-yellow-400">Track.</span>
        </div>

        {/* Search */}
        <div className="flex-1 relative max-w-xl">
          <Search size={15} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
            dk ? 'text-slate-500' : 'text-slate-400')} />
          <input
            type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === 'de' ? 'Hotels durchsuchen...' : 'Search hotels...'}
            className={cn(inputCls, 'pl-9 pr-9')}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} />
            </button>
          )}
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1 ml-auto">

          {/* Share / Collaborators */}
          <button onClick={() => setShowShare(true)} className={iconBtn} title={lang === 'de' ? 'Zugang teilen' : 'Share & Invite'}>
            <Users size={18} />
          </button>

          {/* Lang toggle */}
          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            className={cn(iconBtn, 'text-xs font-black px-3')}>
            {lang === 'de' ? 'EN' : 'DE'}
          </button>

          {/* Export */}
          {onExport && (
            <button onClick={onExport} className={iconBtn} title={lang === 'de' ? 'Exportieren' : 'Export'}>
              <Download size={18} />
            </button>
          )}

          {/* Theme */}
          <button onClick={toggleTheme} className={iconBtn}>
            {dk ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Settings */}
          <button onClick={() => { setShowSettings(true); setSettingsTab('profile'); }} className={iconBtn}>
            <Settings size={18} />
          </button>

          {/* Sign out */}
          <button
            onClick={onSignOut}
            className="ml-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-sm transition-all">
            {lang === 'de' ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* ── Share / Invite Modal ── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className={cn('w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col', surface)}>

            {/* Modal header */}
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0',
              dk ? 'border-white/10' : 'border-slate-200')}>
              <div>
                <h2 className="text-lg font-black">{lang === 'de' ? 'Zugriff teilen' : 'Share Access'}</h2>
                <p className={cn('text-xs mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de'
                    ? 'Eingeladene Nutzer sehen das gesamte Dashboard'
                    : 'Invited users can access the entire dashboard'}
                </p>
              </div>
              <button onClick={() => setShowShare(false)}
                className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Invite section */}
              <div>
                <label className={cn('text-xs font-bold uppercase tracking-widest mb-2 block',
                  dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Nutzer einladen' : 'Invite user'}
                </label>

                {/* Search input */}
                <div className="relative mb-2">
                  <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
                    dk ? 'text-slate-500' : 'text-slate-400')} />
                  <input
                    type="text" value={shareSearch}
                    onChange={e => setShareSearch(e.target.value)}
                    placeholder={lang === 'de' ? 'Name oder E-Mail suchen...' : 'Search by name or email...'}
                    className={cn(inputCls, 'pl-9')}
                  />
                </div>

                {/* Role selector */}
                <div className="flex gap-2 mb-3">
                  {(['viewer', 'editor'] as const).map(r => (
                    <button key={r} onClick={() => setInviteRole(r)}
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border',
                        inviteRole === r
                          ? 'bg-blue-600 text-white border-blue-600'
                          : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                      {r === 'editor' ? '✏️ Editor' : '👁 Viewer'}
                    </button>
                  ))}
                </div>

                {/* Search results */}
                {shareSearching ? (
                  <div className="flex justify-center py-3">
                    <Loader2 size={18} className="animate-spin text-blue-500" />
                  </div>
                ) : shareResults.length > 0 ? (
                  <div className={cn('rounded-xl border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
                    {shareResults.map((u, i) => (
                      <div key={u.id}
                        className={cn('flex items-center gap-3 px-4 py-3 transition-all',
                          i > 0 ? (dk ? 'border-t border-white/5' : 'border-t border-slate-100') : '',
                          dk ? 'hover:bg-white/5' : 'hover:bg-slate-50')}>
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0',
                          dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
                          {(u.full_name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
                            {u.full_name || u.username || u.email}
                          </p>
                          <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{u.email}</p>
                        </div>
                        <button
                          onClick={() => handleInvite(u.id)}
                          disabled={inviting === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shrink-0">
                          {inviting === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                          {lang === 'de' ? 'Einladen' : 'Invite'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : shareSearch.trim() ? (
                  <p className={cn('text-xs text-center py-3', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Keine Nutzer gefunden' : 'No users found'}
                  </p>
                ) : null}

                {inviteMsg && (
                  <p className={cn('text-xs font-bold mt-2 text-center',
                    inviteMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                    {inviteMsg}
                  </p>
                )}
              </div>

              {/* Current collaborators */}
              <div>
                <label className={cn('text-xs font-bold uppercase tracking-widest mb-2 block',
                  dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Aktuelle Mitarbeiter' : 'Current Collaborators'}
                </label>
                {shareCollabsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={18} className="animate-spin text-blue-500" />
                  </div>
                ) : shareCollabs.length === 0 ? (
                  <p className={cn('text-xs text-center py-4', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Noch keine Eingeladenen' : 'No collaborators yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shareCollabs.map(c => (
                      <CollabRow key={c.userId} c={c}
                        onRole={handleChangeRole} onRemove={handleRemove} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className={cn('w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col', surface)}>

            {/* Modal header */}
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0',
              dk ? 'border-white/10' : 'border-slate-200')}>
              <h2 className="text-lg font-black">{lang === 'de' ? 'Einstellungen' : 'Settings'}</h2>
              <button onClick={() => setShowSettings(false)}
                className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className={cn('flex border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              {([
                ['profile',       lang === 'de' ? 'Profil'          : 'Profile',      User],
                ['security',      lang === 'de' ? 'Sicherheit'      : 'Security',     Lock],
                ['collaborators', lang === 'de' ? 'Mitarbeiter'     : 'Collaborators', Users],
              ] as const).map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => setSettingsTab(tab)}
                  className={cn('flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px',
                    settingsTab === tab
                      ? 'border-blue-500 text-blue-500'
                      : cn('border-transparent', dk ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Profile tab */}
              {settingsTab === 'profile' && (
                <>
                  <div>
                    <label className={cn('text-xs font-bold uppercase tracking-widest mb-1.5 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                      {lang === 'de' ? 'Name' : 'Full Name'}
                    </label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className={inputCls}
                      placeholder={lang === 'de' ? 'Ihr Name' : 'Your name'} />
                  </div>
                  <div>
                    <label className={cn('text-xs font-bold uppercase tracking-widest mb-1.5 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                      {lang === 'de' ? 'Benutzername' : 'Username'}
                    </label>
                    <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className={inputCls}
                      placeholder="username" />
                  </div>
                  <div>
                    <label className={cn('text-xs font-bold uppercase tracking-widest mb-1.5 block', dk ? 'text-slate-400' : 'text-slate-500')}>
                      {lang === 'de' ? 'E-Mail (nur ansehen)' : 'Email (read-only)'}
                    </label>
                    <input value={editEmail} disabled className={cn(inputCls, 'opacity-50 cursor-not-allowed')} />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {lang === 'de' ? 'Speichern' : 'Save'}
                    </button>
                    {saveMsg && (
                      <span className={cn('text-sm font-bold',
                        saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                        {saveMsg}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Security tab */}
              {settingsTab === 'security' && (
                <div className={cn('p-4 rounded-xl border', dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
                  <div className="flex items-start gap-3">
                    <Lock size={18} className={dk ? 'text-slate-400 mt-0.5' : 'text-slate-500 mt-0.5'} />
                    <div>
                      <p className={cn('text-sm font-bold mb-1', dk ? 'text-white' : 'text-slate-900')}>
                        {lang === 'de' ? 'Passwort ändern' : 'Change Password'}
                      </p>
                      <p className={cn('text-xs leading-relaxed', dk ? 'text-slate-400' : 'text-slate-500')}>
                        {lang === 'de'
                          ? 'Passwortänderungen erfolgen per E-Mail. Verwende die "Passwort vergessen"-Funktion im Login-Bildschirm.'
                          : 'Password changes are handled via email. Use the "Forgot password" link on the login screen.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Collaborators tab */}
              {settingsTab === 'collaborators' && (
                <>
                  <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de'
                      ? 'Alle Nutzer mit Zugriff auf das Dashboard. Du kannst hier Zugriffsrollen ändern oder Personen entfernen.'
                      : 'All users with access to the dashboard. Change their role or remove access here.'}
                  </p>
                  {collabsLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={20} className="animate-spin text-blue-500" />
                    </div>
                  ) : collabs.length === 0 ? (
                    <div className="text-center py-8">
                      <Users size={32} className={cn('mx-auto mb-3', dk ? 'text-slate-600' : 'text-slate-300')} />
                      <p className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
                        {lang === 'de' ? 'Keine eingeladenen Nutzer' : 'No invited users yet'}
                      </p>
                      <button
                        onClick={() => { setShowSettings(false); setShowShare(true); }}
                        className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all">
                        {lang === 'de' ? 'Nutzer einladen' : 'Invite users'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {collabs.map(c => (
                        <CollabRow key={c.userId} c={c}
                          onRole={handleChangeRole} onRemove={handleRemove} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
