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
  const [profile,      setProfile]      = useState<any>(null);
  const [editName,     setEditName]     = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,   setProfileMsg]   = useState('');

  // Avatar picker
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar,   setSelectedAvatar]   = useState<string | null>(null);

  // Personalization
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
  async function handleSaveProfile() {
    setSavingProfile(true); setProfileMsg('');
    try {
      const updated = await updateMyProfile({
        full_name:  editName,
        avatar:     selectedAvatar,
        fontScale,
        fontFamily,
      });
      setProfile(updated);
      applyFont(fontFamily, fontScale);
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
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border',
                        shareRole === r ? 'bg-blue-600 text-white border-blue-600'
                          : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                      {r === 'editor' ? '✏️ Editor' : '👁 Viewer'}
                    </button>
                  ))}
                </div>
                {shareSearching ? (
                  <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-blue-500" /></div>
                ) : shareResults.length > 0 ? (
                  <div className={cn('rounded-xl border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
                    {shareResults.map((u, i) => (
                      <div key={u.id} className={cn('flex items-center gap-3 px-4 py-3 transition-all',
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
                          <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                            {u.username ? `@${u.username} · ` : ''}{u.email}
                          </p>
                        </div>
                        <button onClick={() => handleShareGrant(u.id)} disabled={sharing === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shrink-0">
                          {sharing === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                          {lang === 'de' ? 'Zugriff erteilen' : 'Grant Access'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : shareSearch.trim() ? (
                  <p className={cn('text-xs text-center py-3', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Keine Nutzer gefunden' : 'No users found'}
                  </p>
                ) : null}
                {shareMsg && (
                  <p className={cn('text-xs font-bold mt-2 text-center',
                    shareMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{shareMsg}</p>
                )}
              </div>

              <div>
                <SectionLabel dk={dk}>{lang === 'de' ? 'Aktuelle Zugänge' : 'Current Access'}</SectionLabel>
                {shareCollabsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-blue-500" /></div>
                ) : shareCollabs.length === 0 ? (
                  <p className={cn('text-xs text-center py-4', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de' ? 'Noch kein Zugriff erteilt' : 'No access granted yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shareCollabs.map(c => (
                      <CollabRow key={c.userId} c={c} onRole={handleChangeRole} onRemove={handleRemove} />
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

            {/* Modal header */}
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
                ['profile',  lang === 'de' ? 'Profil'     : 'Profile',  User],
                ['security', lang === 'de' ? 'Sicherheit' : 'Security', Lock],
                ...(isAdmin ? [['access', lang === 'de' ? 'Zugriff' : 'Access', Users] as const] : []),
              ] as const).map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => setSettingsTab(tab as any)}
                  className={cn('flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px',
                    settingsTab === tab
                      ? 'border-blue-500 text-blue-500'
                      : cn('border-transparent', dk ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* ══════════ PROFILE TAB ══════════ */}
              {settingsTab === 'profile' && (
                <>
                  {/* Avatar + identity */}
                  <div className="flex items-center gap-4">
                    <AvatarDisplay size={72} editable />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-lg font-black truncate', dk ? 'text-white' : 'text-slate-900')}>
                        {profile?.fullName || profile?.full_name || '—'}
                      </p>
                      <p className={cn('text-sm truncate mb-1', dk ? 'text-slate-400' : 'text-slate-500')}>
                        @{profile?.username || '—'}
                        <span className={cn('ml-2 text-[10px]', dk ? 'text-slate-600' : 'text-slate-400')}>
                          ({lang === 'de' ? 'In Sicherheit ändern' : 'Change in Security'})
                        </span>
                      </p>
                      <RoleShield role={profile?.role ?? 'viewer'} lang={lang} />
                    </div>
                  </div>

                  {/* Avatar picker modal */}
                  {showAvatarPicker && (
                    <div className={cn('rounded-xl border p-4', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
                      <div className="flex items-center justify-between mb-3">
                        <p className={cn('text-xs font-bold uppercase tracking-widest', dk ? 'text-slate-400' : 'text-slate-500')}>
                          {lang === 'de' ? 'Avatar wählen' : 'Choose Avatar'}
                        </p>
                        <button onClick={() => setShowAvatarPicker(false)}
                          className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-6 gap-2">
                        {AVATARS.map(av => (
                          <button
                            key={av.id}
                            onClick={() => { setSelectedAvatar(av.id); setShowAvatarPicker(false); }}
                            className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all hover:scale-110',
                              selectedAvatar === av.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent scale-110' : '')}
                            style={{ background: av.bg }}
                          >
                            {av.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Display name */}
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Anzeigename' : 'Display Name'}</SectionLabel>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className={inputCls} placeholder={lang === 'de' ? 'Ihr Name' : 'Your name'} />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'E-Mail (nur ansehen)' : 'Email (read-only)'}</SectionLabel>
                    <input value={profile?.email || ''} disabled
                      className={cn(inputCls, 'opacity-50 cursor-not-allowed')} />
                  </div>

                  {/* Personalization */}
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Personalisierung' : 'Personalization'}</SectionLabel>
                    <div className={cn('rounded-xl border p-4 space-y-4', dk ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50')}>

                      {/* Text size */}
                      <div>
                        <p className={cn('text-xs font-bold mb-2', dk ? 'text-slate-300' : 'text-slate-700')}>
                          {lang === 'de' ? 'Textgröße' : 'Text Size'}
                          <span className={cn('ml-2 font-normal', dk ? 'text-slate-500' : 'text-slate-400')}>{fontScale}%</span>
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setFontScaleState(s => Math.max(75, s - 5))}
                            className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-all',
                              dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}>
                            <Minus size={14} />
                          </button>
                          <div className="flex-1">
                            <input type="range" min={75} max={130} step={5}
                              value={fontScale}
                              onChange={e => setFontScaleState(Number(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                          <button
                            onClick={() => setFontScaleState(s => Math.min(130, s + 5))}
                            className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-all',
                              dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}>
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => setFontScaleState(100)}
                            className={cn('text-xs px-2 py-1 rounded border transition-all',
                              dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                            {lang === 'de' ? 'Reset' : 'Reset'}
                          </button>
                        </div>
                        <div className={cn('flex justify-between text-[10px] mt-1', dk ? 'text-slate-600' : 'text-slate-400')}>
                          <span>75%</span><span>100%</span><span>130%</span>
                        </div>
                      </div>

                      {/* Font family */}
                      <div>
                        <p className={cn('text-xs font-bold mb-2', dk ? 'text-slate-300' : 'text-slate-700')}>
                          <Type size={12} className="inline mr-1" />
                          {lang === 'de' ? 'Schriftart' : 'Font Family'}
                        </p>
                        <select
                          value={fontFamily}
                          onChange={e => setFontFamilyState(e.target.value)}
                          className={cn(inputCls)}
                          style={{ fontFamily: FONTS.find(f => f.value === fontFamily)?.family }}
                        >
                          <optgroup label="Sans-serif">
                            {FONTS.filter(f => !f.family.includes('serif') && !f.family.includes('monospace')).map(f => (
                              <option key={f.value} value={f.value} style={{ fontFamily: f.family }}>{f.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Serif">
                            {FONTS.filter(f => f.family.includes('serif')).map(f => (
                              <option key={f.value} value={f.value} style={{ fontFamily: f.family }}>{f.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Monospace">
                            {FONTS.filter(f => f.family.includes('monospace')).map(f => (
                              <option key={f.value} value={f.value} style={{ fontFamily: f.family }}>{f.label}</option>
                            ))}
                          </optgroup>
                        </select>
                        <p className={cn('text-xs mt-2 px-1', dk ? 'text-slate-400' : 'text-slate-500')}
                          style={{ fontFamily: FONTS.find(f => f.value === fontFamily)?.family }}>
                          {lang === 'de' ? 'Vorschau: Das Hotelmanagement-System' : 'Preview: The hotel management system'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex items-center gap-3">
                    <button onClick={handleSaveProfile} disabled={savingProfile} className={btnPrimary}>
                      {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {lang === 'de' ? 'Speichern' : 'Save'}
                    </button>
                    {profileMsg && (
                      <span className={cn('text-sm font-bold',
                        profileMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                        {profileMsg}
                      </span>
                    )}
                  </div>

                  {/* Accordions */}
                  <div className="space-y-2 pt-2">
                    <Accordion title={lang === 'de' ? 'Häufige Fragen (FAQ)' : 'FAQ'} icon={HelpCircle} dk={dk}>
                      <div className="space-y-3">
                        {[
                          [
                            lang === 'de' ? 'Wie füge ich ein Hotel hinzu?' : 'How do I add a hotel?',
                            lang === 'de' ? 'Klicke auf "Hotel hinzufügen" im Dashboard. Gib Name und optional Stadt ein und bestätige.' : 'Click "Add Hotel" in the dashboard. Enter the name and optionally a city, then confirm.',
                          ],
                          [
                            lang === 'de' ? 'Wie funktioniert die Bettenzuweisung?' : 'How does bed assignment work?',
                            lang === 'de' ? 'Öffne ein Hotel und eine Buchungsdauer. Unter "Bettenbelegung" kannst du jedem Bett einen Mitarbeiter zuweisen und Anreise-/Abreisedaten festlegen.' : 'Open a hotel and a booking duration. Under "Bed assignments" you can assign an employee to each bed and set check-in/check-out dates.',
                          ],
                          [
                            lang === 'de' ? 'Was ist der Unterschied zwischen EZ, DZ, TZ und WG?' : 'What is the difference between EZ, DZ, TZ and WG?',
                            lang === 'de' ? 'EZ = Einzelzimmer (1 Bett), DZ = Doppelzimmer (2 Betten), TZ = Tripple (3 Betten), WG = Wohngemeinschaft (individuell konfigurierbar).' : 'EZ = Single room (1 bed), DZ = Double room (2 beds), TZ = Triple room (3 beds), WG = Shared flat (configurable beds).',
                          ],
                          [
                            lang === 'de' ? 'Wie exportiere ich Daten?' : 'How do I export data?',
                            lang === 'de' ? 'Nutze den Export-Button im Dashboard oder in der Toolbar. Die Daten werden als CSV-Datei heruntergeladen.' : 'Use the Export button in the dashboard toolbar. Data will be downloaded as a CSV file.',
                          ],
                        ].map(([q, a]) => (
                          <div key={q}>
                            <p className={cn('font-bold text-sm mb-0.5', dk ? 'text-white' : 'text-slate-800')}>{q}</p>
                            <p className="text-xs leading-relaxed">{a}</p>
                          </div>
                        ))}
                      </div>
                    </Accordion>

                    <Accordion title={lang === 'de' ? 'Datenschutzrichtlinie' : 'Privacy Policy'} icon={FileText} dk={dk}>
                      <div className="space-y-2 text-xs leading-relaxed">
                        <p><strong>{lang === 'de' ? 'Datenerhebung' : 'Data Collection'}:</strong> {lang === 'de' ? 'EuroTrack speichert nur die Daten, die du selbst eingibst. Dazu gehören Hotelinfos, Buchungsdaten und Mitarbeiterdaten.' : 'EuroTrack only stores data that you enter yourself. This includes hotel info, booking data, and employee data.'}</p>
                        <p><strong>{lang === 'de' ? 'Datenspeicherung' : 'Data Storage'}:</strong> {lang === 'de' ? 'Alle Daten werden sicher bei Supabase gespeichert und sind nur für autorisierte Benutzer zugänglich.' : 'All data is securely stored with Supabase and accessible only to authorized users.'}</p>
                        <p><strong>{lang === 'de' ? 'Keine Weitergabe' : 'No Sharing'}:</strong> {lang === 'de' ? 'Wir geben deine Daten nicht an Dritte weiter.' : 'We do not share your data with third parties.'}</p>
                        <p className={cn('italic', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {lang === 'de' ? 'Letztes Update: April 2026. Dieser Text wird noch finalisiert.' : 'Last updated: April 2026. This text will be finalized.'}
                        </p>
                      </div>
                    </Accordion>

                    <Accordion title={lang === 'de' ? 'Über EuroTrack' : 'About EuroTrack'} icon={Info} dk={dk}>
                      <div className="space-y-2 text-xs leading-relaxed">
                        <p>{lang === 'de' ? 'EuroTrack ist ein internes Hotel- und Buchungsmanagement-System für europäische Einsatzplanung.' : 'EuroTrack is an internal hotel and booking management system for European deployment planning.'}</p>
                        <p>{lang === 'de' ? 'Entwickelt für Teams, die Mitarbeiterunterkünfte effizient verwalten müssen.' : 'Built for teams that need to efficiently manage employee accommodations.'}</p>
                        <div className={cn('mt-3 pt-3 border-t flex items-center justify-between', dk ? 'border-white/10' : 'border-slate-200')}>
                          <span className={dk ? 'text-slate-500' : 'text-slate-400'}>Version</span>
                          <span className={cn('font-bold', dk ? 'text-slate-300' : 'text-slate-700')}>1.0.0</span>
                        </div>
                      </div>
                    </Accordion>
                  </div>
                </>
              )}

              {/* ══════════ SECURITY TAB ══════════ */}
              {settingsTab === 'security' && (
                <>
                  {/* Change username */}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50')}>
                    <div className="flex items-center gap-2">
                      <AtSign size={16} className={dk ? 'text-blue-400' : 'text-blue-600'} />
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {lang === 'de' ? 'Benutzername ändern' : 'Change Username'}
                      </p>
                    </div>
                    <p className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                      {lang === 'de'
                        ? 'Nach der Änderung kannst du dich mit dem neuen Benutzernamen einloggen.'
                        : 'After changing, you can log in with the new username immediately.'}
                    </p>
                    <input
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder={lang === 'de' ? 'Neuer Benutzername' : 'New username'}
                      className={inputCls}
                    />
                    <div className="flex items-center gap-3">
                      <button onClick={handleSaveUsername} disabled={savingUsername || !newUsername.trim()} className={btnPrimary}>
                        {savingUsername ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {lang === 'de' ? 'Aktualisieren' : 'Update'}
                      </button>
                      {usernameMsg && (
                        <span className={cn('text-xs font-bold', usernameMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{usernameMsg}</span>
                      )}
                    </div>
                  </div>

                  {/* Change email */}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50')}>
                    <div className="flex items-center gap-2">
                      <Mail size={16} className={dk ? 'text-blue-400' : 'text-blue-600'} />
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {lang === 'de' ? 'E-Mail ändern' : 'Change Email'}
                      </p>
                    </div>
                    <p className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                      {lang === 'de'
                        ? 'Ein Bestätigungslink wird an die neue E-Mail-Adresse gesendet.'
                        : 'A confirmation link will be sent to the new email address.'}
                    </p>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder={lang === 'de' ? 'Neue E-Mail-Adresse' : 'New email address'}
                      className={inputCls}
                    />
                    <div className="flex items-center gap-3">
                      <button onClick={handleSaveEmail} disabled={savingEmail || !newEmail.trim()} className={btnPrimary}>
                        {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        {lang === 'de' ? 'Link senden' : 'Send Link'}
                      </button>
                      {emailMsg && (
                        <span className={cn('text-xs font-bold leading-snug', emailMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{emailMsg}</span>
                      )}
                    </div>
                  </div>

                  {/* Change password */}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50')}>
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className={dk ? 'text-blue-400' : 'text-blue-600'} />
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {lang === 'de' ? 'Passwort ändern' : 'Change Password'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type={showCurrentPass ? 'text' : 'password'}
                          value={currentPass}
                          onChange={e => setCurrentPass(e.target.value)}
                          placeholder={lang === 'de' ? 'Aktuelles Passwort' : 'Current password'}
                          className={cn(inputCls, 'pr-10')}
                        />
                        <button type="button" onClick={() => setShowCurrentPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                          {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          placeholder={lang === 'de' ? 'Neues Passwort' : 'New password'}
                          className={cn(inputCls, 'pr-10')}
                        />
                        <button type="button" onClick={() => setShowNewPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                          {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <input
                        type="password"
                        value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                        placeholder={lang === 'de' ? 'Passwort bestätigen' : 'Confirm new password'}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={handleSavePassword}
                        disabled={savingPass || !currentPass || !newPass || !confirmPass}
                        className={btnPrimary}>
                        {savingPass ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                        {lang === 'de' ? 'Passwort ändern' : 'Change Password'}
                      </button>
                      <button
                        onClick={handleForgotPassword}
                        disabled={sendingReset}
                        className={cn('text-xs font-bold transition-all',
                          dk ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700')}>
                        {sendingReset
                          ? (lang === 'de' ? 'Wird gesendet...' : 'Sending...')
                          : (lang === 'de' ? 'Passwort vergessen?' : 'Forgot password?')}
                      </button>
                    </div>
                    {(passMsg || resetMsg) && (
                      <p className={cn('text-xs font-bold',
                        (passMsg || resetMsg).startsWith('Error') ? 'text-red-400' : 'text-green-400')}>
                        {passMsg || resetMsg}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ══════════ ACCESS TAB (admin/superadmin only) ══════════ */}
              {settingsTab === 'access' && isAdmin && (
                <>
                  <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
                    {lang === 'de'
                      ? 'Suche einen Nutzer nach Benutzername oder E-Mail und erteile sofort Zugriff — kein Einladungslink nötig.'
                      : 'Search a user by username or email and grant access instantly — no invite link needed.'}
                  </p>

                  {/* Search */}
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Nutzer suchen & Zugriff erteilen' : 'Find user & grant access'}</SectionLabel>
                    <div className="relative mb-3">
                      <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
                      <input type="text" value={accessSearch} onChange={e => setAccessSearch(e.target.value)}
                        placeholder={lang === 'de' ? 'Benutzername oder E-Mail...' : 'Username or email...'}
                        className={cn(inputCls, 'pl-9')} />
                    </div>

                    {accessSearching ? (
                      <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-blue-500" /></div>
                    ) : accessResults.length > 0 ? (
                      <div className={cn('rounded-xl border overflow-hidden mb-3', dk ? 'border-white/10' : 'border-slate-200')}>
                        {accessResults.map((u, i) => (
                          <button key={u.id}
                            onClick={() => { setSelectedUser(u); setAccessResults([]); setAccessSearch(''); }}
                            className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-all',
                              i > 0 ? (dk ? 'border-t border-white/5' : 'border-t border-slate-100') : '',
                              selectedUser?.id === u.id
                                ? (dk ? 'bg-blue-600/20' : 'bg-blue-50')
                                : (dk ? 'hover:bg-white/5' : 'hover:bg-slate-50'))}>
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0',
                              dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
                              {(u.full_name || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
                                {u.full_name || u.username || u.email}
                              </p>
                              <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                                {u.username ? `@${u.username} · ` : ''}{u.email}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : accessSearch.trim() ? (
                      <p className={cn('text-xs text-center py-3 mb-3', dk ? 'text-slate-500' : 'text-slate-400')}>
                        {lang === 'de' ? 'Keine Nutzer gefunden' : 'No users found'}
                      </p>
                    ) : null}

                    {/* Selected user + role grant */}
                    {selectedUser && (
                      <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50')}>
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0',
                            dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
                            {(selectedUser.full_name || selectedUser.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-bold', dk ? 'text-white' : 'text-slate-900')}>
                              {selectedUser.full_name || selectedUser.username || selectedUser.email}
                            </p>
                            <p className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>{selectedUser.email}</p>
                          </div>
                          <button onClick={() => setSelectedUser(null)}
                            className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {(['viewer', 'editor', 'admin'] as const).map(r => (
                            <button key={r} onClick={() => setGrantRole(r)}
                              className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border',
                                grantRole === r ? 'bg-blue-600 text-white border-blue-600'
                                  : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-100')}>
                              {r === 'admin' ? '🛡️ Admin' : r === 'editor' ? '✏️ Editor' : '👁 Viewer'}
                            </button>
                          ))}
                        </div>
                        <button onClick={handleGrantAccess} disabled={granting} className={cn(btnPrimary, 'w-full justify-center')}>
                          {granting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                          {lang === 'de' ? 'Zugriff erteilen' : 'Grant Access'}
                        </button>
                      </div>
                    )}

                    {grantMsg && (
                      <p className={cn('text-xs font-bold text-center mt-2',
                        grantMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{grantMsg}</p>
                    )}
                  </div>

                  {/* Current collaborators */}
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Aktuelle Zugänge' : 'Current Access'}</SectionLabel>
                    {collabsLoading ? (
                      <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
                    ) : collabs.length === 0 ? (
                      <div className={cn('text-center py-8 rounded-xl border-2 border-dashed', dk ? 'border-white/10' : 'border-slate-200')}>
                        <Users size={28} className={cn('mx-auto mb-2', dk ? 'text-slate-600' : 'text-slate-300')} />
                        <p className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {lang === 'de' ? 'Noch kein Zugriff erteilt' : 'No access granted yet'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {collabs.map(c => (
                          <CollabRow key={c.userId} c={c} onRole={handleChangeRole} onRemove={handleRemove} />
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
