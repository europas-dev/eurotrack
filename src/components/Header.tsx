// src/components/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import {
  getMyProfile, updateMyProfile, getCollaborators,
  updateCollaboratorPermission, removeCollaborator, searchProfiles,
  grantUserAccess, updateMyUsername, updateMyEmail,
  updateMyPassword, sendPasswordReset,
} from '../lib/supabase';
import {
  Moon, Sun, Download, Settings, LogOut,
  X, Check, Loader2, Users, Search,
  User, Lock, UserPlus, Trash2, ChevronDown,
  ChevronRight, Pencil, Shield, Type, Minus, Plus,
  Mail, KeyRound, AtSign, Eye, EyeOff, HelpCircle,
  FileText, Info,
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
  userRole?: string;
}

// ─── Avatar presets ───────────────────────────────────────────────────────────
const AVATARS = [
  { id: 'fox',      emoji: '🦊', bg: '#f97316' },
  { id: 'wolf',     emoji: '🐺', bg: '#3b82f6' },
  { id: 'lion',     emoji: '🦁', bg: '#f59e0b' },
  { id: 'bear',     emoji: '🐻', bg: '#92400e' },
  { id: 'butterfly',emoji: '🦋', bg: '#a855f7' },
  { id: 'dolphin',  emoji: '🐬', bg: '#06b6d4' },
  { id: 'eagle',    emoji: '🦅', bg: '#1e3a5f' },
  { id: 'cactus',   emoji: '🌵', bg: '#16a34a' },
  { id: 'fire',     emoji: '🔥', bg: '#dc2626' },
  { id: 'moon',     emoji: '🌙', bg: '#4f46e5' },
  { id: 'lightning',emoji: '⚡', bg: '#ca8a04' },
  { id: 'target',   emoji: '🎯', bg: '#475569' },
];

// ─── Font options ─────────────────────────────────────────────────────────────
const FONTS = [
  { value: 'inter',        label: 'Inter',           family: 'Inter, sans-serif' },
  { value: 'roboto',       label: 'Roboto',          family: 'Roboto, sans-serif' },
  { value: 'open-sans',    label: 'Open Sans',       family: '"Open Sans", sans-serif' },
  { value: 'dm-sans',      label: 'DM Sans',         family: '"DM Sans", sans-serif' },
  { value: 'nunito',       label: 'Nunito',          family: 'Nunito, sans-serif' },
  { value: 'poppins',      label: 'Poppins',         family: 'Poppins, sans-serif' },
  { value: 'georgia',      label: 'Georgia',         family: 'Georgia, serif' },
  { value: 'times',        label: 'Times New Roman', family: '"Times New Roman", serif' },
  { value: 'playfair',     label: 'Playfair Display',family: '"Playfair Display", serif' },
  { value: 'lora',         label: 'Lora',            family: 'Lora, serif' },
  { value: 'jetbrains',    label: 'JetBrains Mono',  family: '"JetBrains Mono", monospace' },
];

// ─── Role shield config ───────────────────────────────────────────────────────
function RoleShield({ role, lang }: { role: string; lang: string }) {
  const configs: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
    superadmin: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', icon: '👑', label: 'Super Admin' },
    admin:      { color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   icon: '🛡️', label: 'Admin' },
    editor:     { color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  icon: '✏️', label: 'Editor' },
    viewer:     { color: 'text-slate-400',  bg: 'bg-slate-400/10',  border: 'border-slate-400/30',  icon: '👁️', label: 'Viewer' },
  };
  const c = configs[role] ?? configs.viewer;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold', c.bg, c.border, c.color)}>
      <Shield size={12} />
      <span>{c.icon} {c.label}</span>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────
function Accordion({ title, icon: Icon, children, dk }: { title: string; icon: any; children: React.ReactNode; dk: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('rounded-xl border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-all',
          dk ? 'hover:bg-white/5 text-white' : 'hover:bg-slate-50 text-slate-900')}
      >
        <span className="flex items-center gap-2"><Icon size={14} />{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className={cn('px-4 pb-4 pt-1 text-sm leading-relaxed', dk ? 'text-slate-400 border-t border-white/10' : 'text-slate-600 border-t border-slate-100')}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ children, dk }: { children: React.ReactNode; dk: boolean }) {
  return (
    <p className={cn('text-[10px] font-black uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
      {children}
    </p>
  );
}

export default function Header({
  theme, lang, toggleTheme, setLang,
  searchQuery, setSearchQuery,
  onSignOut, onExport,
  viewOnly = false,
  userRole = 'viewer',
}: HeaderProps) {
  const dk = theme === 'dark';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  const [showShare,    setShowShare]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab,  setSettingsTab]  = useState<'profile' | 'security' | 'access'>('profile');

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile,       setProfile]       = useState<any>(null);
  const [editName,      setEditName]      = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState('');

  // Avatar picker
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar,   setSelectedAvatar]   = useState<string | null>(null);

  // Personalization — applied live, persisted on change (no save button)
  const [fontScale,    setFontScaleState]  = useState(100);
  const [fontFamily,   setFontFamilyState] = useState('inter');

  // ── Security state ─────────────────────────────────────────────────────────
  const [newUsername,     setNewUsername]     = useState('');
  const [usernameMsg,     setUsernameMsg]     = useState('');
  const [savingUsername,  setSavingUsername]  = useState(false);

  const [newEmail,        setNewEmail]        = useState('');
  const [emailMsg,        setEmailMsg]        = useState('');
  const [savingEmail,     setSavingEmail]     = useState(false);

  const [currentPass,     setCurrentPass]     = useState('');
  const [newPass,         setNewPass]         = useState('');
  const [confirmPass,     setConfirmPass]     = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass,     setShowNewPass]     = useState(false);
  const [passMsg,         setPassMsg]         = useState('');
  const [savingPass,      setSavingPass]      = useState(false);
  const [resetMsg,        setResetMsg]        = useState('');
  const [sendingReset,    setSendingReset]    = useState(false);

  // ── Access tab state ───────────────────────────────────────────────────────
  const [accessSearch,    setAccessSearch]    = useState('');
  const [accessResults,   setAccessResults]   = useState<any[]>([]);
  const [accessSearching, setAccessSearching] = useState(false);
  const [selectedUser,    setSelectedUser]    = useState<any>(null);
  const [grantRole,       setGrantRole]       = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [granting,        setGranting]        = useState(false);
  const [grantMsg,        setGrantMsg]        = useState('');
  const [collabs,         setCollabs]         = useState<any[]>([]);
  const [collabsLoading,  setCollabsLoading]  = useState(false);

  // ── Share modal state ──────────────────────────────────────────────────────
  const [shareSearch,     setShareSearch]     = useState('');
  const [shareResults,    setShareResults]    = useState<any[]>([]);
  const [shareSearching,  setShareSearching]  = useState(false);
  const [shareRole,       setShareRole]       = useState<'viewer' | 'editor'>('viewer');
  const [shareMsg,        setShareMsg]        = useState('');
  const [sharing,         setSharing]         = useState<string | null>(null);
  const [shareCollabs,    setShareCollabs]    = useState<any[]>([]);
  const [shareCollabsLoading, setShareCollabsLoading] = useState(false);

  const surface  = dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');
  const iconBtn  = cn('p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900');
  const btnPrimary = 'flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all';

  // ── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    getMyProfile().then(p => {
      if (!p) return;
      setProfile(p);
      setEditName(p.fullName || p.full_name || '');
      setNewUsername(p.username || '');
      setSelectedAvatar(p.avatar ?? null);
      setFontScaleState(p.fontScale ?? 100);
      setFontFamilyState(p.fontFamily ?? 'inter');
      applyFont(p.fontFamily ?? 'inter', p.fontScale ?? 100);
    });
  }, []);

  function applyFont(family: string, scale: number) {
    const font = FONTS.find(f => f.value === family);
    if (font) document.documentElement.style.setProperty('--font-body', font.family);
    document.documentElement.style.fontSize = `${scale}%`;
  }

  // Live-apply + persist font family immediately (no save button needed)
  function handleFontFamilyChange(value: string) {
    setFontFamilyState(value);
    const font = FONTS.find(f => f.value === value);
    if (font) document.documentElement.style.setProperty('--font-body', font.family);
    updateMyProfile({ fontFamily: value }).catch(() => {});
  }

  // Live-apply + persist font scale immediately (no save button needed)
  function handleFontScaleChange(value: number) {
    setFontScaleState(value);
    document.documentElement.style.fontSize = `${value}%`;
    updateMyProfile({ fontScale: value }).catch(() => {});
  }

  // Load collabs when access tab opens
  useEffect(() => {
    if (showSettings && settingsTab === 'access') loadCollabs();
  }, [showSettings, settingsTab]);

  // Load share collabs when share modal opens
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

  // ── Access search debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!accessSearch.trim()) { setAccessResults([]); setSelectedUser(null); return; }
    const t = setTimeout(async () => {
      setAccessSearching(true);
      try { setAccessResults(await searchProfiles(accessSearch)); } catch {}
      finally { setAccessSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [accessSearch]);

  // ── Share search debounce ──────────────────────────────────────────────────
  useEffect(() => {
    if (!shareSearch.trim()) { setShareResults([]); return; }
    const t = setTimeout(async () => {
      setShareSearching(true);
      try { setShareResults(await searchProfiles(shareSearch)); } catch {}
      finally { setShareSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [shareSearch]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  // Save only covers avatar + display name (font/size persist live on change)
  async function handleSaveProfile() {
    setSavingProfile(true); setProfileMsg('');
    try {
      const updated = await updateMyProfile({
        full_name: editName,
        avatar:    selectedAvatar,
      });
      setProfile(updated);
      setProfileMsg(lang === 'de' ? '✓ Gespeichert' : '✓ Saved');
      setTimeout(() => setProfileMsg(''), 2500);
    } catch (e: any) { setProfileMsg(`Error: ${e.message}`); }
    finally { setSavingProfile(false); }
  }

  async function handleSaveUsername() {
    setSavingUsername(true); setUsernameMsg('');
    try {
      await updateMyUsername(newUsername);
      setProfile((p: any) => ({ ...p, username: newUsername }));
      setUsernameMsg(lang === 'de' ? '✓ Benutzername aktualisiert' : '✓ Username updated');
      setTimeout(() => setUsernameMsg(''), 3000);
    } catch (e: any) { setUsernameMsg(`Error: ${e.message}`); }
    finally { setSavingUsername(false); }
  }

  async function handleSaveEmail() {
    setSavingEmail(true); setEmailMsg('');
    try {
      await updateMyEmail(newEmail);
      setEmailMsg(lang === 'de'
        ? '✓ Bestätigungslink gesendet — bitte E-Mail prüfen'
        : '✓ Confirmation link sent — please check your email');
    } catch (e: any) { setEmailMsg(`Error: ${e.message}`); }
    finally { setSavingEmail(false); }
  }

  async function handleSavePassword() {
    if (newPass !== confirmPass) { setPassMsg(lang === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match'); return; }
    setSavingPass(true); setPassMsg('');
    try {
      await updateMyPassword(currentPass, newPass);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setPassMsg(lang === 'de' ? '✓ Passwort geändert' : '✓ Password changed');
      setTimeout(() => setPassMsg(''), 3000);
    } catch (e: any) { setPassMsg(`Error: ${e.message}`); }
    finally { setSavingPass(false); }
  }

  async function handleForgotPassword() {
    if (!profile?.email) return;
    setSendingReset(true); setResetMsg('');
    try {
      await sendPasswordReset(profile.email);
      setResetMsg(lang === 'de' ? '✓ Reset-Link gesendet' : '✓ Reset link sent');
      setTimeout(() => setResetMsg(''), 4000);
    } catch (e: any) { setResetMsg(`Error: ${e.message}`); }
    finally { setSendingReset(false); }
  }

  async function handleGrantAccess() {
    if (!selectedUser) return;
    setGranting(true); setGrantMsg('');
    try {
      await grantUserAccess(selectedUser.id, grantRole);
      setGrantMsg(lang === 'de' ? `✓ Zugriff erteilt an ${selectedUser.fullName || selectedUser.email}` : `✓ Access granted to ${selectedUser.fullName || selectedUser.email}`);
      setSelectedUser(null); setAccessSearch(''); setAccessResults([]);
      await loadCollabs();
      setTimeout(() => setGrantMsg(''), 3000);
    } catch (e: any) { setGrantMsg(`Error: ${e.message}`); }
    finally { setGranting(false); }
  }

  async function handleShareGrant(userId: string) {
    setSharing(userId); setShareMsg('');
    try {
      await grantUserAccess(userId, shareRole);
      setShareMsg(lang === 'de' ? '✓ Zugriff erteilt' : '✓ Access granted');
      setShareSearch(''); setShareResults([]);
      await loadShareCollabs();
      setTimeout(() => setShareMsg(''), 3000);
    } catch (e: any) { setShareMsg(`Error: ${e.message}`); }
    finally { setSharing(null); }
  }

  async function handleChangeRole(userId: string, role: 'viewer' | 'editor' | 'admin') {
    try {
      await updateCollaboratorPermission(userId, role);
      setCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c));
      setShareCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c));
    } catch {}
  }

  async function handleRemove(userId: string) {
    try {
      await removeCollaborator(userId);
      setCollabs(p => p.filter(c => c.userId !== userId));
      setShareCollabs(p => p.filter(c => c.userId !== userId));
    } catch {}
  }

  // ── Avatar display ─────────────────────────────────────────────────────────
  function AvatarDisplay({ size = 64, editable = false }: { size?: number; editable?: boolean }) {
    const av = AVATARS.find(a => a.id === selectedAvatar);
    const initials = (profile?.fullName || profile?.full_name || profile?.email || '?')[0].toUpperCase();
    return (
      <div className="relative inline-block" style={{ width: size, height: size }}>
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-black select-none"
          style={{
            background: av ? av.bg : (dk ? '#334155' : '#e2e8f0'),
            fontSize: size * 0.4,
          }}
        >
          {av ? av.emoji : <span className={dk ? 'text-slate-300' : 'text-slate-600'}>{initials}</span>}
        </div>
        {editable && (
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shadow-lg transition-all"
          >
            <Pencil size={10} className="text-white" />
          </button>
        )}
      </div>
    );
  }

  // ── Role badge for collab list ─────────────────────────────────────────────
  const RoleBadge = ({ role, userId, onChange }: { role: string; userId: string; onChange: (r: any) => void }) => (
    <div className="relative group inline-block">
      <button className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all',
        role === 'admin'  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' :
        role === 'editor' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' :
                            'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30')}>
        {role === 'admin' ? '🛡️ Admin' : role === 'editor' ? '✏️ Editor' : '👁 Viewer'}
        <ChevronDown size={10} />
      </button>
      <div className={cn('absolute top-full left-0 mt-1 rounded-lg border shadow-xl z-50 min-w-[110px] overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all',
        dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}>
        {(['viewer', 'editor', 'admin'] as const).map(r => (
          <button key={r} onClick={() => onChange(r)}
            className={cn('w-full text-left px-3 py-2 text-xs font-bold transition-all',
              r === role ? (dk ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900')
                         : (dk ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-50 text-slate-600'))}>
            {r === 'admin' ? '🛡️ Admin' : r === 'editor' ? '✏️ Editor' : '👁 Viewer'}
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
        {(c.fullName || c.username || c.email || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
          {c.fullName || c.username || c.email || 'Unknown'}
        </p>
        <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
          {c.username ? `@${c.username} · ` : ''}{c.email}
        </p>
      </div>
      <RoleBadge role={c.role} userId={c.userId} onChange={r => onRole(c.userId, r)} />
      <button onClick={() => onRemove(c.userId)}
        className={cn('p-1.5 rounded-lg transition-all',
          dk ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main header bar ── */}
      <header className={cn('shrink-0 flex items-center gap-3 px-6 py-3 border-b', surface)}>
        <div className="text-xl font-black italic mr-2 whitespace-nowrap select-none">
          Euro<span className="text-yellow-400">Track.</span>
        </div>

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

        <div className="flex items-center gap-1 ml-auto">
          {/* Share — admin/superadmin only */}
          {isAdmin && (
            <button onClick={() => setShowShare(true)} className={iconBtn} title={lang === 'de' ? 'Zugang teilen' : 'Share Access'}>
              <Users size={18} />
            </button>
          )}

          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            className={cn(iconBtn, 'text-xs font-black px-3')}>
            {lang === 'de' ? 'EN' : 'DE'}
          </button>

          {onExport && (
            <button onClick={onExport} className={iconBtn} title={lang === 'de' ? 'Exportieren' : 'Export'}>
              <Download size={18} />
            </button>
          )}

          <button onClick={toggleTheme} className={iconBtn}>
            {dk ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button onClick={() => { setShowSettings(true); setSettingsTab('profile'); }} className={iconBtn}>
            <Settings size={18} />
          </button>

          <button
            onClick={onSignOut}
            className="ml-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-sm transition-all">
            {lang === 'de' ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          SHARE MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className={cn('w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col', surface)}>
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              <div>
                <h2 className="text-lg font-black">{lang === 'de' ? 'Zugriff teilen' : 'Share Access'}</h2>
                <p className={cn('text-xs mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>
                  {lang === 'de' ? 'Nutzer suchen und sofort Zugriff erteilen' : 'Search users and grant access instantly'}
                </p>
              </div>
              <button onClick={() => setShowShare(false)}
                className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <SectionLabel dk={dk}>{lang === 'de' ? 'Nutzer suchen' : 'Find user'}</SectionLabel>
                <div className="relative mb-3">
                  <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
                  <input type="text" value={shareSearch} onChange={e => setShareSearch(e.target.value)}
                    placeholder={lang === 'de' ? 'Benutzername oder E-Mail...' : 'Username or email...'}
                    className={cn(inputCls, 'pl-9')} />
                </div>
                <div className="flex gap-2 mb-3">
                  {(['viewer', 'editor'] as const).map(r => (
                    <button key={r} onClick={() => setShareRole(r)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                        shareRole === r
                          ? 'bg-blue-600 text-white border-blue-600'
                          : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                      {r === 'viewer' ? '👁 Viewer' : '✏️ Editor'}
                    </button>
                  ))}
                </div>

                {shareSearching && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                    <span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                      {lang === 'de' ? 'Suche...' : 'Searching...'}
                    </span>
                  </div>
                )}

                {shareResults.length > 0 && (
                  <div className="space-y-1">
                    {shareResults.map(u => (
                      <div key={u.id}
                        className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                          dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                          dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700')}>
                          {(u.fullName || u.username || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
                            {u.fullName || u.username || 'Unknown'}
                          </p>
                          <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                            {u.username ? `@${u.username}` : u.email}
                          </p>
                        </div>
                        <button onClick={() => handleShareGrant(u.id)}
                          disabled={sharing === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all">
                          {sharing === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                          {lang === 'de' ? 'Erteilen' : 'Grant'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {shareMsg && (
                  <p className={cn('text-xs font-bold mt-2',
                    shareMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                    {shareMsg}
                  </p>
                )}
              </div>

              {/* Current collaborators */}
              <div>
                <SectionLabel dk={dk}>{lang === 'de' ? 'Aktueller Zugriff' : 'Current Access'}</SectionLabel>
                {shareCollabsLoading ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                    <span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>Loading...</span>
                  </div>
                ) : shareCollabs.length === 0 ? (
                  <p className={cn('text-xs py-3', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Noch keine Mitarbeiter' : 'No collaborators yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shareCollabs.map(c => (
                      <CollabRow key={c.userId} c={c}
                        onRole={handleChangeRole}
                        onRemove={handleRemove} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SETTINGS MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className={cn('w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col', surface)}>

            {/* Header */}
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              <h2 className="text-lg font-black">{lang === 'de' ? 'Einstellungen' : 'Settings'}</h2>
              <button onClick={() => setShowSettings(false)}
                className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className={cn('flex border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              {([
                { id: 'profile',  icon: User,   label: lang === 'de' ? 'Profil'    : 'Profile'   },
                { id: 'security', icon: Lock,   label: lang === 'de' ? 'Sicherheit': 'Security'  },
                ...(isAdmin ? [{ id: 'access', icon: Users, label: lang === 'de' ? 'Zugriff' : 'Access' }] : []),
              ] as const).map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setSettingsTab(id as any)}
                  className={cn('flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all',
                    settingsTab === id
                      ? 'border-blue-500 text-blue-500'
                      : cn('border-transparent', dk ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}>
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ── PROFILE TAB ── */}
              {settingsTab === 'profile' && (
                <>
                  {/* Identity card: avatar → name → @username → role badge */}
                  <div className={cn('rounded-xl border p-5 space-y-4', dk ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-slate-50')}>

                    {/* Avatar + identity info */}
                    <div className="flex items-center gap-4">
                      <AvatarDisplay size={64} editable />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-base font-black truncate', dk ? 'text-white' : 'text-slate-900')}>
                          {profile?.fullName || profile?.full_name || '—'}
                        </p>
                        {profile?.username && (
                          <p className={cn('text-sm truncate', dk ? 'text-slate-400' : 'text-slate-500')}>
                            @{profile.username}
                          </p>
                        )}
                        <div className="mt-1.5">
                          <RoleShield role={userRole} lang={lang} />
                        </div>
                      </div>
                    </div>

                    {/* Edit display name */}
                    <div>
                      <SectionLabel dk={dk}>{lang === 'de' ? 'Anzeigename' : 'Display Name'}</SectionLabel>
                      <input
                        type="text" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder={lang === 'de' ? 'Dein Name...' : 'Your name...'}
                        className={inputCls}
                      />
                    </div>

                    {/* Save — only for avatar + name */}
                    <div className="flex items-center justify-between pt-1">
                      {profileMsg && (
                        <p className={cn('text-xs font-bold', profileMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                          {profileMsg}
                        </p>
                      )}
                      <button
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className={cn(btnPrimary, 'ml-auto')}>
                        {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {lang === 'de' ? 'Speichern' : 'Save'}
                      </button>
                    </div>
                  </div>

                  {/* Avatar picker */}
                  {showAvatarPicker && (
                    <div className={cn('rounded-xl border p-4', dk ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-slate-50')}>
                      <div className="flex items-center justify-between mb-3">
                        <SectionLabel dk={dk}>{lang === 'de' ? 'Avatar wählen' : 'Choose Avatar'}</SectionLabel>
                        <button onClick={() => setShowAvatarPicker(false)}
                          className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-6 gap-2">
                        {AVATARS.map(av => (
                          <button key={av.id} onClick={() => { setSelectedAvatar(av.id); setShowAvatarPicker(false); }}
                            className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110',
                              selectedAvatar === av.id ? 'ring-2 ring-blue-500 ring-offset-2' : '')}
                            style={{ background: av.bg }}>
                            {av.emoji}
                          </button>
                        ))}
                        <button onClick={() => { setSelectedAvatar(null); setShowAvatarPicker(false); }}
                          className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110',
                            !selectedAvatar ? 'ring-2 ring-blue-500 ring-offset-2' : '',
                            dk ? 'bg-slate-700' : 'bg-slate-200')}>
                          <User size={16} className={dk ? 'text-slate-300' : 'text-slate-600'} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Appearance — font/size apply live, no save button */}
                  <div className={cn('rounded-xl border p-4 space-y-4', dk ? 'border-white/10' : 'border-slate-200')}>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Darstellung' : 'Appearance'}</SectionLabel>

                    {/* Font family */}
                    <div>
                      <p className={cn('text-xs font-bold mb-2', dk ? 'text-slate-400' : 'text-slate-600')}>
                        {lang === 'de' ? 'Schriftart' : 'Font'}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {FONTS.map(f => (
                          <button key={f.value} onClick={() => handleFontFamilyChange(f.value)}
                            className={cn('px-3 py-2 rounded-lg border text-xs font-bold text-left transition-all',
                              fontFamily === f.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100')}
                            style={{ fontFamily: f.family }}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font scale */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-600')}>
                          {lang === 'de' ? 'Textgröße' : 'Text Size'}
                        </p>
                        <span className={cn('text-xs font-black', dk ? 'text-white' : 'text-slate-900')}>{fontScale}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleFontScaleChange(Math.max(75, fontScale - 5))}
                          className={cn('p-1.5 rounded-lg border transition-all',
                            dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}>
                          <Minus size={14} />
                        </button>
                        <input type="range" min={75} max={130} step={5} value={fontScale}
                          onChange={e => handleFontScaleChange(Number(e.target.value))}
                          className="flex-1 accent-blue-600 h-1.5 rounded-full" />
                        <button onClick={() => handleFontScaleChange(Math.min(130, fontScale + 5))}
                          className={cn('p-1.5 rounded-lg border transition-all',
                            dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── SECURITY TAB ── */}
              {settingsTab === 'security' && (
                <>
                  {/* FIX: Current email shown at top of security tab */}
                  {profile?.email && (
                    <div className={cn('rounded-xl border p-4', dk ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-slate-50')}>
                      <SectionLabel dk={dk}>{lang === 'de' ? 'Aktuelle E-Mail' : 'Current Email'}</SectionLabel>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className={dk ? 'text-slate-400' : 'text-slate-500'} />
                        <span className={cn('text-sm font-bold', dk ? 'text-white' : 'text-slate-900')}>
                          {profile.email}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Change username */}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10' : 'border-slate-200')}>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Benutzername ändern' : 'Change Username'}</SectionLabel>
                    <div className="relative">
                      <AtSign size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
                      <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                        placeholder={lang === 'de' ? 'Neuer Benutzername...' : 'New username...'}
                        className={cn(inputCls, 'pl-8')} />
                    </div>
                    {usernameMsg && (
                      <p className={cn('text-xs font-bold', usernameMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                        {usernameMsg}
                      </p>
                    )}
                    <button onClick={handleSaveUsername} disabled={savingUsername} className={btnPrimary}>
                      {savingUsername ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {lang === 'de' ? 'Benutzername speichern' : 'Save Username'}
                    </button>
                  </div>

                  {/* Change email */}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10' : 'border-slate-200')}>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'E-Mail ändern' : 'Change Email'}</SectionLabel>
                    <div className="relative">
                      <Mail size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
                      <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                        placeholder={lang === 'de' ? 'Neue E-Mail-Adresse...' : 'New email address...'}
                        className={cn(inputCls, 'pl-8')} />
                    </div>
                    {emailMsg && (
                      <p className={cn('text-xs font-bold', emailMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                        {emailMsg}
                      </p>
                    )}
                    <button onClick={handleSaveEmail} disabled={savingEmail} className={btnPrimary}>
                      {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      {lang === 'de' ? 'E-Mail aktualisieren' : 'Update Email'}
                    </button>
                  </div>

                  {/* Change password */}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10' : 'border-slate-200')}>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Passwort ändern' : 'Change Password'}</SectionLabel>
                    <div className="relative">
                      <input type={showCurrentPass ? 'text' : 'password'} value={currentPass}
                        onChange={e => setCurrentPass(e.target.value)}
                        placeholder={lang === 'de' ? 'Aktuelles Passwort' : 'Current password'}
                        className={inputCls} />
                      <button onClick={() => setShowCurrentPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showCurrentPass ? <EyeOff size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} /> : <Eye size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} />}
                      </button>
                    </div>
                    <div className="relative">
                      <input type={showNewPass ? 'text' : 'password'} value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder={lang === 'de' ? 'Neues Passwort' : 'New password'}
                        className={inputCls} />
                      <button onClick={() => setShowNewPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showNewPass ? <EyeOff size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} /> : <Eye size={14} className={dk ? 'text-slate-500' : 'text-slate-400'} />}
                      </button>
                    </div>
                    <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                      placeholder={lang === 'de' ? 'Passwort bestätigen' : 'Confirm password'}
                      className={inputCls} />
                    {passMsg && (
                      <p className={cn('text-xs font-bold', passMsg.startsWith('Error') || passMsg.includes('match') ? 'text-red-400' : 'text-green-400')}>
                        {passMsg}
                      </p>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <button onClick={handleForgotPassword} disabled={sendingReset}
                        className={cn('text-xs font-bold transition-all', dk ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')}>
                        {sendingReset ? '...' : (lang === 'de' ? 'Passwort vergessen?' : 'Forgot password?')}
                      </button>
                      {resetMsg && <p className={cn('text-xs font-bold', resetMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{resetMsg}</p>}
                      <button onClick={handleSavePassword} disabled={savingPass} className={btnPrimary}>
                        {savingPass ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                        {lang === 'de' ? 'Passwort ändern' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ── ACCESS TAB ── */}
              {settingsTab === 'access' && isAdmin && (
                <>
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Nutzer suchen & Zugriff erteilen' : 'Find user & grant access'}</SectionLabel>
                    <div className="relative mb-3">
                      <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
                      <input type="text" value={accessSearch} onChange={e => setAccessSearch(e.target.value)}
                        placeholder={lang === 'de' ? 'Benutzername oder E-Mail...' : 'Username or email...'}
                        className={cn(inputCls, 'pl-9')} />
                    </div>

                    {accessSearching && (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                        <span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                          {lang === 'de' ? 'Suche...' : 'Searching...'}
                        </span>
                      </div>
                    )}

                    {accessResults.length > 0 && !selectedUser && (
                      <div className="space-y-1 mb-3">
                        {accessResults.map(u => (
                          <button key={u.id} onClick={() => setSelectedUser(u)}
                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                              dk ? 'bg-white/3 border-white/8 hover:bg-white/8' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')}>
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                              dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700')}>
                              {(u.fullName || u.username || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
                                {u.fullName || u.username || 'Unknown'}
                              </p>
                              <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                                {u.username ? `@${u.username}` : u.email}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedUser && (
                      <div className={cn('rounded-xl border p-4 space-y-3 mb-3', dk ? 'border-blue-500/40 bg-blue-500/5' : 'border-blue-300 bg-blue-50')}>
                        <div className="flex items-center justify-between">
                          <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                            {selectedUser.fullName || selectedUser.username || selectedUser.email}
                          </p>
                          <button onClick={() => setSelectedUser(null)}
                            className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-blue-100 text-slate-500')}>
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {(['viewer', 'editor', 'admin'] as const).map(r => (
                            <button key={r} onClick={() => setGrantRole(r)}
                              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                grantRole === r
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-white')}>
                              {r === 'admin' ? '🛡️ Admin' : r === 'editor' ? '✏️ Editor' : '👁 Viewer'}
                            </button>
                          ))}
                        </div>
                        {grantMsg && (
                          <p className={cn('text-xs font-bold', grantMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                            {grantMsg}
                          </p>
                        )}
                        <button onClick={handleGrantAccess} disabled={granting} className={btnPrimary}>
                          {granting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                          {lang === 'de' ? 'Zugriff erteilen' : 'Grant Access'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Aktueller Zugriff' : 'Current Access'}</SectionLabel>
                    {collabsLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                        <span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>Loading...</span>
                      </div>
                    ) : collabs.length === 0 ? (
                      <p className={cn('text-xs py-3', dk ? 'text-slate-500' : 'text-slate-400')}>
                        {lang === 'de' ? 'Noch keine Mitarbeiter' : 'No collaborators yet'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {collabs.map(c => (
                          <CollabRow key={c.userId} c={c}
                            onRole={handleChangeRole}
                            onRemove={handleRemove} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
