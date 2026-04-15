// src/components/Header.tsx
import React, { useState, useEffect } from 'react';
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
  ChevronRight, Pencil, Shield, Minus, Plus,
  Mail, KeyRound, AtSign, Eye, EyeOff, HelpCircle,
  FileText, Info, Printer, FileSpreadsheet, Wifi, WifiOff // FIXED: Added Wifi icons
} from 'lucide-react';

const AVATARS = [
  { id: 'fox',       emoji: '🦊', bg: '#f97316' },
  { id: 'wolf',      emoji: '🐺', bg: '#3b82f6' },
  { id: 'lion',      emoji: '🦁', bg: '#f59e0b' },
  { id: 'bear',      emoji: '🐻', bg: '#92400e' },
  { id: 'butterfly', emoji: '🦋', bg: '#a855f7' },
  { id: 'dolphin',   emoji: '🐬', bg: '#06b6d4' },
  { id: 'eagle',     emoji: '🦅', bg: '#1e3a5f' },
  { id: 'cactus',    emoji: '🌵', bg: '#16a34a' },
  { id: 'fire',      emoji: '🔥', bg: '#dc2626' },
  { id: 'moon',      emoji: '🌙', bg: '#4f46e5' },
  { id: 'lightning', emoji: '⚡', bg: '#ca8a04' },
  { id: 'target',    emoji: '🎯', bg: '#475569' },
];

const FONTS = [
  { value: 'inter',      label: 'Inter',            family: 'Inter, sans-serif' },
  { value: 'roboto',     label: 'Roboto',           family: 'Roboto, sans-serif' },
  { value: 'open-sans',  label: 'Open Sans',        family: '"Open Sans", sans-serif' },
  { value: 'dm-sans',    label: 'DM Sans',          family: '"DM Sans", sans-serif' },
  { value: 'nunito',     label: 'Nunito',           family: 'Nunito, sans-serif' },
  { value: 'poppins',    label: 'Poppins',          family: 'Poppins, sans-serif' },
  { value: 'georgia',    label: 'Georgia',          family: 'Georgia, serif' },
  { value: 'playfair',   label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'lora',       label: 'Lora',             family: 'Lora, serif' },
  { value: 'jetbrains',  label: 'JetBrains Mono',   family: '"JetBrains Mono", monospace' },
];

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 19, 20];

function RoleShield({ role }: { role: string }) {
  const cfg: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
    superadmin: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', icon: '👑', label: 'Super Admin' },
    admin:      { color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   icon: '🛡️', label: 'Admin' },
    editor:     { color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  icon: '✏️', label: 'Editor' },
    viewer:     { color: 'text-slate-400',  bg: 'bg-slate-400/10',  border: 'border-slate-400/30',  icon: '👁️', label: 'Viewer' },
  };
  const c = cfg[role] ?? cfg.viewer;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold', c.bg, c.border, c.color)}>
      <Shield size={11} /><span>{c.icon} {c.label}</span>
    </div>
  );
}

function Accordion({ title, icon: Icon, children, dk }: { title: string; icon: any; children: React.ReactNode; dk: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('rounded-xl border overflow-hidden', dk ? 'border-white/10' : 'border-slate-200')}>
      <button onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-all',
          dk ? 'hover:bg-white/5 text-white' : 'hover:bg-slate-50 text-slate-900')}>
        <span className="flex items-center gap-2"><Icon size={14} />{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className={cn('px-4 pb-4 pt-2 text-sm leading-relaxed', dk ? 'text-slate-400 border-t border-white/10' : 'text-slate-600 border-t border-slate-100')}>
          {children}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, dk }: { children: React.ReactNode; dk: boolean }) {
  return (
    <p className={cn('text-[10px] font-black uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
      {children}
    </p>
  );
}

// FIXED: Added offline toggle props to Header
interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchScope: string;
  setSearchScope: (scope: string) => void;
  onSignOut: () => void;
  onExportCsv?: () => void;
  onPrint?: () => void;
  viewOnly?: boolean;
  userRole?: string;
  offlineMode?: boolean;
  onToggleOfflineMode?: () => void;
  isOnline?: boolean;
}

export default function Header({
  theme, lang, toggleTheme, setLang,
  searchQuery, setSearchQuery, searchScope, setSearchScope,
  onSignOut, onExportCsv, onPrint,
  viewOnly = false, userRole = 'viewer',
  offlineMode, onToggleOfflineMode, isOnline = true
}: HeaderProps) {
  const dk = theme === 'dark';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  const [showShare,    setShowShare]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [settingsTab,  setSettingsTab]  = useState<'profile' | 'security' | 'access'>('profile');

  const [profile,          setProfile]        = useState<any>(null);
  const [profileLoading,   setProfileLoading] = useState(false);
  const [editingName,      setEditingName]    = useState(false);
  const [editName,         setEditName]       = useState('');
  const [savingProfile,    setSavingProfile]  = useState(false);
  const [profileMsg,       setProfileMsg]     = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar,   setSelectedAvatar]   = useState<string | null>(null);

  const [fontFamily,       setFontFamilyState] = useState('inter');
  const [fontSize,         setFontSizeState]   = useState(16);
  const [savingPersonalize, setSavingPersonalize] = useState(false);
  const [personalizeMsg,    setPersonalizeMsg]   = useState('');

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

  const [accessSearch,    setAccessSearch]    = useState('');
  const [accessResults,   setAccessResults]   = useState<any[]>([]);
  const [accessSearching, setAccessSearching] = useState(false);
  const [selectedUser,    setSelectedUser]    = useState<any>(null);
  const [grantRole,       setGrantRole]       = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [granting,        setGranting]        = useState(false);
  const [grantMsg,        setGrantMsg]        = useState('');
  const [collabs,         setCollabs]         = useState<any[]>([]);
  const [collabsLoading,  setCollabsLoading]  = useState(false);
  const [pendingRole,     setPendingRole]     = useState<Record<string, string>>({});
  const [changingRole,    setChangingRole]    = useState<string | null>(null);

  const [shareSearch,     setShareSearch]     = useState('');
  const [shareResults,    setShareResults]    = useState<any[]>([]);
  const [shareSearching,  setShareSearching]  = useState(false);
  const [shareRole,       setShareRole]       = useState<'viewer' | 'editor'>('viewer');
  const [shareMsg,        setShareMsg]        = useState('');
  const [sharing,         setSharing]         = useState<string | null>(null);
  const [shareCollabs,    setShareCollabs]    = useState<any[]>([]);
  const [shareCollabsLoading, setShareCollabsLoading] = useState(false);
  const [pendingShareRole, setPendingShareRole] = useState<Record<string, string>>({});
  const [changingShareRole, setChangingShareRole] = useState<string | null>(null);

  const surface  = dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900';
  const drawerBg = dk ? 'bg-[#0F172A]' : 'bg-white';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-[#1E293B] border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');
  const selectCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all cursor-pointer',
    dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-blue-500'
       : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500');
  const iconBtn  = cn('p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900');
  const btnPrimary = 'flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all';

  useEffect(() => {
    setProfileLoading(true);
    getMyProfile().then(p => {
      if (!p) return;
      setProfile(p); setEditName(p.fullName || p.full_name || ''); setNewUsername(p.username || '');
      setSelectedAvatar(p.avatar ?? null);
      const fam = p.fontFamily ?? 'inter'; const size = p.fontSize ?? 16;
      setFontFamilyState(fam); setFontSizeState(size); applyFont(fam, size);
    }).catch(() => {}).finally(() => setProfileLoading(false));
  }, []);

  function applyFont(family: string, size: number) {
    const font = FONTS.find(f => f.value === family);
    if (font) {
      document.body.style.fontFamily = font.family;
      document.documentElement.style.setProperty('--font-body', font.family);
    }
    document.documentElement.style.setProperty('--font-size-base', `${size}px`);
    document.documentElement.style.fontSize = `${size}px`;
  }

  function handleFontFamilyChange(value: string) {
    setFontFamilyState(value); const font = FONTS.find(f => f.value === value);
    if (font) {
      document.body.style.fontFamily = font.family;
      document.documentElement.style.setProperty('--font-body', font.family);
    }
  }

  function handleFontSizeChange(value: number) {
    const clamped = Math.min(20, Math.max(12, value)); setFontSizeState(clamped);
    document.documentElement.style.setProperty('--font-size-base', `${clamped}px`);
    document.documentElement.style.fontSize = `${clamped}px`;
  }

  async function handleSavePersonalization() {
    setSavingPersonalize(true); setPersonalizeMsg('');
    try { await updateMyProfile({ fontFamily, fontSize }); setPersonalizeMsg(lang === 'de' ? '✓ Gespeichert' : '✓ Saved'); setTimeout(() => setPersonalizeMsg(''), 2500); }
    catch (e: any) { setPersonalizeMsg(`Error: ${e.message}`); } finally { setSavingPersonalize(false); }
  }

  useEffect(() => { if (showSettings && settingsTab === 'access') loadCollabs(); }, [showSettings, settingsTab]);
  useEffect(() => { if (showShare) loadShareCollabs(); }, [showShare]);

  async function loadCollabs() { setCollabsLoading(true); try { const c = await getCollaborators(); setCollabs(c); setPendingRole(Object.fromEntries(c.map((x: any) => [x.userId, x.role]))); } catch {} finally { setCollabsLoading(false); } }
  async function loadShareCollabs() { setShareCollabsLoading(true); try { const c = await getCollaborators(); setShareCollabs(c); setPendingShareRole(Object.fromEntries(c.map((x: any) => [x.userId, x.role]))); } catch {} finally { setShareCollabsLoading(false); } }

  useEffect(() => {
    if (!accessSearch.trim()) { setAccessResults([]); setSelectedUser(null); return; }
    const t = setTimeout(async () => { setAccessSearching(true); try { setAccessResults(await searchProfiles(accessSearch)); } catch {} finally { setAccessSearching(false); } }, 350);
    return () => clearTimeout(t);
  }, [accessSearch]);

  useEffect(() => {
    if (!shareSearch.trim()) { setShareResults([]); return; }
    const t = setTimeout(async () => { setShareSearching(true); try { setShareResults(await searchProfiles(shareSearch)); } catch {} finally { setShareSearching(false); } }, 350);
    return () => clearTimeout(t);
  }, [shareSearch]);

  async function handleSaveProfile() { setSavingProfile(true); setProfileMsg(''); try { const updated = await updateMyProfile({ full_name: editName, avatar: selectedAvatar }); setProfile(updated); setEditingName(false); setProfileMsg(lang === 'de' ? '✓ Gespeichert' : '✓ Saved'); setTimeout(() => setProfileMsg(''), 2500); } catch (e: any) { setProfileMsg(`Error: ${e.message}`); } finally { setSavingProfile(false); } }
  async function handleSaveUsername() { setSavingUsername(true); setUsernameMsg(''); try { await updateMyUsername(newUsername); setProfile((p: any) => ({ ...p, username: newUsername })); setUsernameMsg(lang === 'de' ? '✓ Benutzername aktualisiert' : '✓ Username updated'); setTimeout(() => setUsernameMsg(''), 3000); } catch (e: any) { setUsernameMsg(`Error: ${e.message}`); } finally { setSavingUsername(false); } }
  async function handleSaveEmail() { setSavingEmail(true); setEmailMsg(''); try { await updateMyEmail(newEmail); setEmailMsg(lang === 'de' ? '✓ Bestätigungslink gesendet' : '✓ Confirmation link sent — check your email'); } catch (e: any) { setEmailMsg(`Error: ${e.message}`); } finally { setSavingEmail(false); } }
  async function handleSavePassword() { if (newPass !== confirmPass) { setPassMsg(lang === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match'); return; } setSavingPass(true); setPassMsg(''); try { await updateMyPassword(currentPass, newPass); setCurrentPass(''); setNewPass(''); setConfirmPass(''); setPassMsg(lang === 'de' ? '✓ Passwort geändert' : '✓ Password changed'); setTimeout(() => setPassMsg(''), 3000); } catch (e: any) { setPassMsg(`Error: ${e.message}`); } finally { setSavingPass(false); } }
  async function handleForgotPassword() { if (!profile?.email) return; setSendingReset(true); setResetMsg(''); try { await sendPasswordReset(profile.email); setResetMsg(lang === 'de' ? '✓ Reset-Link gesendet' : '✓ Reset link sent'); setTimeout(() => setResetMsg(''), 4000); } catch (e: any) { setResetMsg(`Error: ${e.message}`); } finally { setSendingReset(false); } }
  async function handleGrantAccess() { if (!selectedUser) return; setGranting(true); setGrantMsg(''); try { await grantUserAccess(selectedUser.id, grantRole); setGrantMsg(lang === 'de' ? `✓ Zugriff erteilt` : `✓ Access granted`); setSelectedUser(null); setAccessSearch(''); setAccessResults([]); await loadCollabs(); setTimeout(() => setGrantMsg(''), 3000); } catch (e: any) { setGrantMsg(`Error: ${e.message}`); } finally { setGranting(false); } }
  async function handleShareGrant(userId: string) { setSharing(userId); setShareMsg(''); try { await grantUserAccess(userId, shareRole); setShareMsg(lang === 'de' ? '✓ Zugriff erteilt' : '✓ Access granted'); setShareSearch(''); setShareResults([]); await loadShareCollabs(); setTimeout(() => setShareMsg(''), 3000); } catch (e: any) { setShareMsg(`Error: ${e.message}`); } finally { setSharing(null); } }
  async function handleChangeCollabRole(userId: string) { const role = pendingRole[userId] as any; if (!role) return; setChangingRole(userId); try { await updateCollaboratorPermission(userId, role); setCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c)); setShareCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c)); } catch {} finally { setChangingRole(null); } }
  async function handleChangeShareCollabRole(userId: string) { const role = pendingShareRole[userId] as any; if (!role) return; setChangingShareRole(userId); try { await updateCollaboratorPermission(userId, role); setShareCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c)); setCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c)); } catch {} finally { setChangingShareRole(null); } }
  async function handleRemove(userId: string) { try { await removeCollaborator(userId); setCollabs(p => p.filter(c => c.userId !== userId)); setShareCollabs(p => p.filter(c => c.userId !== userId)); } catch {} }

  function AvatarDisplay({ size = 64 }: { size?: number }) {
    const av = AVATARS.find(a => a.id === selectedAvatar);
    const initials = (profile?.fullName || profile?.full_name || profile?.email || '?')[0].toUpperCase();
    return (
      <div className="relative inline-block cursor-pointer group" style={{ width: size, height: size }} onClick={() => setShowAvatarPicker(v => !v)}>
        <div className="w-full h-full rounded-full flex items-center justify-center font-black select-none transition-all group-hover:opacity-80" style={{ background: av ? av.bg : (dk ? '#334155' : '#e2e8f0'), fontSize: size * 0.4 }}>
          {av ? av.emoji : <span className={dk ? 'text-slate-300' : 'text-slate-600'}>{initials}</span>}
        </div>
        <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow-md pointer-events-none">
          <Pencil size={9} className="text-white" />
        </div>
      </div>
    );
  }

  const CollabRow = ({ c }: { c: any }) => (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border', dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0', dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>{(c.fullName || c.username || c.email || '?')[0].toUpperCase()}</div>
      <div className="flex-1 min-w-0"><p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>{c.fullName || c.username || c.email || 'Unknown'}</p><p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{c.username ? `@${c.username} · ` : ''}{c.email}</p></div>
      <select value={pendingRole[c.userId] ?? c.role} onChange={e => setPendingRole(p => ({ ...p, [c.userId]: e.target.value }))} className={cn('text-xs font-bold rounded-lg border px-2 py-1 outline-none transition-all', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}><option value="viewer">👁 Viewer</option><option value="editor">✏️ Editor</option><option value="admin">🛡️ Admin</option></select>
      <button onClick={() => handleChangeCollabRole(c.userId)} disabled={changingRole === c.userId} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all">{changingRole === c.userId ? <Loader2 size={12} className="animate-spin" /> : (lang === 'de' ? 'Ändern' : 'Change')}</button>
      <button onClick={() => handleRemove(c.userId)} className={cn('p-1.5 rounded-lg transition-all shrink-0', dk ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}><Trash2 size={13} /></button>
    </div>
  );
  const ShareCollabRow = ({ c }: { c: any }) => (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border', dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0', dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>{(c.fullName || c.username || c.email || '?')[0].toUpperCase()}</div>
      <div className="flex-1 min-w-0"><p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>{c.fullName || c.username || c.email || 'Unknown'}</p><p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{c.username ? `@${c.username} · ` : ''}{c.email}</p></div>
      <select value={pendingShareRole[c.userId] ?? c.role} onChange={e => setPendingShareRole(p => ({ ...p, [c.userId]: e.target.value }))} className={cn('text-xs font-bold rounded-lg border px-2 py-1 outline-none transition-all', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}><option value="viewer">👁 Viewer</option><option value="editor">✏️ Editor</option><option value="admin">🛡️ Admin</option></select>
      <button onClick={() => handleChangeShareCollabRole(c.userId)} disabled={changingShareRole === c.userId} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all">{changingShareRole === c.userId ? <Loader2 size={12} className="animate-spin" /> : (lang === 'de' ? 'Ändern' : 'Change')}</button>
      <button onClick={() => handleRemove(c.userId)} className={cn('p-1.5 rounded-lg transition-all shrink-0', dk ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}><Trash2 size={13} /></button>
    </div>
  );

  return (
    <>
      <header className={cn('shrink-0 flex items-center gap-3 px-6 py-3 border-b', surface)}>
        <div className="flex-1 relative flex items-center max-w-2xl">
          <div className={cn('flex items-center rounded-lg border transition-all focus-within:ring-2 focus-within:ring-blue-500/50 w-full',
            dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200'
          )}>
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value)}
              className={cn('h-9 pl-3 pr-8 rounded-l-lg text-xs font-bold outline-none border-r appearance-none cursor-pointer',
                dk ? 'bg-[#0F172A] border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              )}
            >
              <option value="all">{lang === 'de' ? 'Überall' : 'All Fields'}</option>
              <option value="hotel">{lang === 'de' ? 'Hotelname' : 'Hotel Name'}</option>
              <option value="city">{lang === 'de' ? 'Stadt' : 'City'}</option>
              <option value="company">{lang === 'de' ? 'Firma' : 'Company'}</option>
              <option value="employee">{lang === 'de' ? 'Mitarbeiter' : 'Employee'}</option>
              <option value="invoice">{lang === 'de' ? 'Rechnung' : 'Invoice No.'}</option>
            </select>
            <div className="relative flex-1 flex items-center">
              <Search size={15} className={cn('absolute left-3 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'de' ? 'Suchen...' : 'Search...'}
                className={cn('w-full h-9 pl-9 pr-9 text-sm outline-none bg-transparent', dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')} 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3">
                  <X size={14} className={dk ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto relative">
          <button onClick={onPrint} className={iconBtn} title={lang === 'de' ? 'Drucken / PDF' : 'Print / Save as PDF'}>
            <Printer size={18} />
          </button>
          
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className={iconBtn} title={lang === 'de' ? 'Exportieren' : 'Export'}>
              <Download size={18} />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className={cn("absolute right-0 top-full mt-2 z-50 p-2 rounded-xl border shadow-xl w-48", dk ? "bg-[#0F172A] border-white/10" : "bg-white border-slate-200")}>
                  <p className={cn("px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest", dk ? "text-slate-500" : "text-slate-400")}>
                    {lang === 'de' ? 'Exportieren als' : 'Export as'}
                  </p>
                  <button onClick={() => { onExportCsv?.(); setShowExportMenu(false); }} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-all", dk ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-700")}>
                    <FileSpreadsheet size={14} className="text-green-500" /> Excel / CSV
                  </button>
                  <button onClick={() => { onPrint?.(); setShowExportMenu(false); }} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-all mt-1", dk ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-700")}>
                    <FileText size={14} className="text-red-500" /> PDF Document
                  </button>
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <button onClick={() => setShowShare(true)} className={iconBtn} title={lang === 'de' ? 'Zugang teilen' : 'Share Access'}>
              <Users size={18} />
            </button>
          )}

          {/* FIXED: Offline Toggle perfectly placed next to language and theme controls */}
          <button onClick={onToggleOfflineMode} className={iconBtn} title={lang === 'de' ? 'Offline-Modus umschalten' : 'Toggle Offline Mode'}>
            {(!isOnline || offlineMode) ? <WifiOff size={18} className="text-slate-400" /> : <Wifi size={18} className="text-emerald-500" />}
          </button>

          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className={cn(iconBtn, 'text-xs font-black px-3')}>
            {lang === 'de' ? 'EN' : 'DE'}
          </button>
          <button onClick={toggleTheme} className={iconBtn}>
            {dk ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => { setShowSettings(true); setSettingsTab('profile'); }} className={iconBtn}>
            <Settings size={18} />
          </button>
          <button onClick={onSignOut} className="ml-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-sm transition-all shadow-md">
            {lang === 'de' ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* SHARE MODAL */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className={cn('w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col', surface)}>
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              <div>
                <h2 className="text-lg font-black">{lang === 'de' ? 'Zugriff teilen' : 'Share Access'}</h2>
                <p className={cn('text-xs mt-0.5', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Nutzer suchen und Zugriff erteilen' : 'Search users and grant access'}</p>
              </div>
              <button onClick={() => setShowShare(false)} className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <SectionLabel dk={dk}>{lang === 'de' ? 'Nutzer suchen' : 'Find user'}</SectionLabel>
                <div className="relative mb-3">
                  <Search size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
                  <input type="text" value={shareSearch} onChange={e => setShareSearch(e.target.value)} placeholder={lang === 'de' ? 'Benutzername oder E-Mail...' : 'Username or email...'} className={cn(inputCls, 'pl-9')} />
                </div>
                <div className="flex gap-2 mb-3">
                  {(['viewer', 'editor'] as const).map(r => (
                    <button key={r} onClick={() => setShareRole(r)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border transition-all', shareRole === r ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>{r === 'viewer' ? '👁 Viewer' : '✏️ Editor'}</button>
                  ))}
                </div>
                {shareSearching && <div className="flex items-center gap-2 py-2"><Loader2 size={14} className="animate-spin text-blue-500" /><span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>{lang === 'de' ? 'Suche...' : 'Searching...'}</span></div>}
                {shareResults.length > 0 && (
                  <div className="space-y-1">
                    {shareResults.map(u => (
                      <div key={u.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border', dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0', dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700')}>{(u.fullName || u.username || u.email || '?')[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0"><p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>{u.fullName || u.username || 'Unknown'}</p><p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{u.username ? `@${u.username}` : u.email}</p></div>
                        <button onClick={() => handleShareGrant(u.id)} disabled={sharing === u.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all">{sharing === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} {lang === 'de' ? 'Erteilen' : 'Grant'}</button>
                      </div>
                    ))}
                  </div>
                )}
                {shareMsg && <p className={cn('text-xs font-bold mt-2', shareMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{shareMsg}</p>}
              </div>
              <div>
                <SectionLabel dk={dk}>{lang === 'de' ? 'Aktueller Zugriff' : 'Current Access'}</SectionLabel>
                {shareCollabsLoading ? <div className="flex items-center gap-2 py-3"><Loader2 size={14} className="animate-spin text-blue-500" /><span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>Loading...</span></div>
                : shareCollabs.length === 0 ? <p className={cn('text-xs py-3', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Noch keine Mitarbeiter' : 'No collaborators yet'}</p>
                : <div className="space-y-2">{shareCollabs.map(c => <ShareCollabRow key={c.userId} c={c} />)}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Z-Index upgraded to z-[999] so settings drawer will completely cover Timeline and Filter menus */}
      {showSettings && (
        <div className="fixed inset-0 z-[999] flex pointer-events-none">
          <div className="flex-1 pointer-events-auto bg-black/10" onClick={() => setShowSettings(false)} />
          <div className={cn('relative w-full max-w-md h-full flex flex-col shadow-2xl border-l pointer-events-auto', drawerBg, dk ? 'border-white/10' : 'border-slate-200')} style={{ animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)' }}>
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              <h2 className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{lang === 'de' ? 'Einstellungen' : 'Settings'}</h2>
              <button onClick={() => setShowSettings(false)} className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}><X size={18} /></button>
            </div>
            <div className={cn('flex border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              {([{ id: 'profile', icon: User, label: lang === 'de' ? 'Profil' : 'Profile' }, { id: 'security', icon: Lock, label: lang === 'de' ? 'Sicherheit' : 'Security' }, ...(isAdmin ? [{ id: 'access', icon: Users, label: lang === 'de' ? 'Zugriff' : 'Access' }] : [])] as const).map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setSettingsTab(id as any)} className={cn('flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all', settingsTab === id ? 'border-blue-500 text-blue-500' : cn('border-transparent', dk ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'))}><Icon size={14} />{label}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {settingsTab === 'profile' && (
                <>
                  {profileLoading ? <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-500" /></div> : (
                    <>
                      <div className={cn('rounded-xl border p-4', dk ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-slate-50')}>
                        <div className="flex items-center gap-4">
                          <AvatarDisplay size={60} />
                          <div className="flex-1 min-w-0 space-y-1">
                            {editingName ? (
                              <div className="flex items-center gap-2">
                                <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setEditingName(false); }} className={cn('flex-1 px-2 py-1 rounded-lg border text-sm font-bold outline-none', dk ? 'bg-[#1E293B] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900')} />
                                <button onClick={handleSaveProfile} disabled={savingProfile} className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all">{savingProfile ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}</button>
                                <button onClick={() => setEditingName(false)} className={cn('p-1.5 rounded-lg transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}><X size={12} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group"><span className={cn('text-sm font-black truncate', dk ? 'text-white' : 'text-slate-900')}>{profile?.fullName || profile?.full_name || '—'}</span><button onClick={() => setEditingName(true)} className={cn('opacity-0 group-hover:opacity-100 p-1 rounded transition-all', dk ? 'hover:bg-white/10 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600')}><Pencil size={12} /></button></div>
                            )}
                            {profileMsg && <p className={cn('text-xs font-bold', profileMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{profileMsg}</p>}
                            {profile?.username && <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>@{profile.username}</p>}
                            <RoleShield role={userRole} />
                          </div>
                        </div>
                        {showAvatarPicker && (
                          <div className={cn('mt-4 pt-4 border-t', dk ? 'border-white/10' : 'border-slate-200')}>
                            <div className="flex items-center justify-between mb-3"><p className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-600')}>{lang === 'de' ? 'Avatar wählen' : 'Choose avatar'}</p><button onClick={() => setShowAvatarPicker(false)} className={cn('p-1 rounded text-xs', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}><X size={13} /></button></div>
                            <div className="grid grid-cols-6 gap-2">
                              {AVATARS.map(av => <button key={av.id} onClick={() => { setSelectedAvatar(av.id); setShowAvatarPicker(false); handleSaveProfile(); }} className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110', selectedAvatar === av.id ? 'ring-2 ring-blue-500 ring-offset-2' : '')} style={{ background: av.bg }}>{av.emoji}</button>)}
                              <button onClick={() => { setSelectedAvatar(null); setShowAvatarPicker(false); handleSaveProfile(); }} className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110', !selectedAvatar ? 'ring-2 ring-blue-500 ring-offset-2' : '', dk ? 'bg-slate-700' : 'bg-slate-200')}><User size={15} className={dk ? 'text-slate-300' : 'text-slate-600'} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={cn('rounded-xl border p-4 space-y-4', dk ? 'border-white/10' : 'border-slate-200')}>
                        <SectionLabel dk={dk}>{lang === 'de' ? 'Personalisierung' : 'Personalization'}</SectionLabel>
                        <div>
                          <p className={cn('text-xs font-bold mb-1.5', dk ? 'text-slate-400' : 'text-slate-600')}>{lang === 'de' ? 'Schriftart' : 'Font Family'}</p>
                          <select value={fontFamily} onChange={e => handleFontFamilyChange(e.target.value)} className={selectCls}>{FONTS.map(f => <option key={f.value} value={f.value} style={{ fontFamily: f.family }}>{f.label}</option>)}</select>
                          <p className={cn('mt-2 text-sm px-3 py-2 rounded-lg border italic', dk ? 'border-white/10 text-slate-400 bg-white/3' : 'border-slate-200 text-slate-500 bg-slate-50')} style={{ fontFamily: FONTS.find(f => f.value === fontFamily)?.family }}>{lang === 'de' ? 'Die schnelle braune Katze springt.' : 'The quick brown fox jumps over.'}</p>
                        </div>
                        <div>
                          <p className={cn('text-xs font-bold mb-1.5', dk ? 'text-slate-400' : 'text-slate-600')}>{lang === 'de' ? 'Schriftgröße' : 'Font Size'}</p>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleFontSizeChange(fontSize - 1)} className={cn('p-1.5 rounded-lg border transition-all', dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}><Minus size={13} /></button>
                            <div className={cn('flex-1 text-center text-sm font-black rounded-lg border py-1.5', dk ? 'border-white/10 text-white' : 'border-slate-200 text-slate-900')}>{fontSize}px</div>
                            <button onClick={() => handleFontSizeChange(fontSize + 1)} className={cn('p-1.5 rounded-lg border transition-all', dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}><Plus size={13} /></button>
                          </div>
                          <div className="flex justify-between mt-1 px-0.5">{FONT_SIZES.map(s => <button key={s} onClick={() => handleFontSizeChange(s)} className={cn('text-[10px] font-bold transition-all', fontSize === s ? 'text-blue-500' : dk ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600')}>{s}</button>)}</div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          {personalizeMsg && <p className={cn('text-xs font-bold', personalizeMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{personalizeMsg}</p>}
                          <button onClick={handleSavePersonalization} disabled={savingPersonalize} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ml-auto', dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}>{savingPersonalize ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {lang === 'de' ? 'Speichern' : 'Save'}</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Accordion title="FAQ" icon={HelpCircle} dk={dk}><p>{lang === 'de' ? 'Hier finden Sie Antworten auf häufig gestellte Fragen zu EuroTrack.' : 'Find answers to frequently asked questions about EuroTrack here.'}</p></Accordion>
                        <Accordion title={lang === 'de' ? 'Datenschutz' : 'Privacy Policy'} icon={FileText} dk={dk}><p>{lang === 'de' ? 'Ihre Daten werden sicher gespeichert und nicht an Dritte weitergegeben.' : 'Your data is stored securely and never shared with third parties.'}</p></Accordion>
                        <Accordion title={lang === 'de' ? 'Über EuroTrack' : 'About EuroTrack'} icon={Info} dk={dk}><p>{lang === 'de' ? 'EuroTrack ist ein internes Hotel-Verwaltungstool für das Europa-Park-Team.' : 'EuroTrack is an internal hotel management tool for the Europa-Park team.'}</p></Accordion>
                      </div>
                    </>
                  )}
                </>
              )}

              {settingsTab === 'security' && (
                <>
                  {profile?.email && <div className={cn('rounded-xl border p-4', dk ? 'border-white/10 bg-white/2' : 'border-slate-200 bg-slate-50')}><SectionLabel dk={dk}>{lang === 'de' ? 'Aktuelle E-Mail' : 'Current Email'}</SectionLabel><div className="flex items-center gap-2"><Mail size={13} className={dk ? 'text-slate-400' : 'text-slate-500'} /><span className={cn('text-sm font-bold', dk ? 'text-white' : 'text-slate-900')}>{profile.email}</span></div></div>}
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10' : 'border-slate-200')}><SectionLabel dk={dk}>{lang === 'de' ? 'Benutzername ändern' : 'Change Username'}</SectionLabel><div className="relative"><AtSign size={13} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} /><input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder={lang === 'de' ? 'Neuer Benutzername...' : 'New username...'} className={cn(inputCls, 'pl-8')} /></div>{usernameMsg && <p className={cn('text-xs font-bold', usernameMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{usernameMsg}</p>}<button onClick={handleSaveUsername} disabled={savingUsername} className={btnPrimary}>{savingUsername ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {lang === 'de' ? 'Speichern' : 'Save Username'}</button></div>
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10' : 'border-slate-200')}><SectionLabel dk={dk}>{lang === 'de' ? 'E-Mail ändern' : 'Change Email'}</SectionLabel><div className="relative"><Mail size={13} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} /><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={lang === 'de' ? 'Neue E-Mail-Adresse...' : 'New email address...'} className={cn(inputCls, 'pl-8')} /></div>{emailMsg && <p className={cn('text-xs font-bold', emailMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{emailMsg}</p>}<button onClick={handleSaveEmail} disabled={savingEmail} className={btnPrimary}>{savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} {lang === 'de' ? 'E-Mail aktualisieren' : 'Update Email'}</button></div>
                  <div className={cn('rounded-xl border p-4 space-y-3', dk ? 'border-white/10' : 'border-slate-200')}><SectionLabel dk={dk}>{lang === 'de' ? 'Passwort ändern' : 'Change Password'}</SectionLabel><div className="relative"><input type={showCurrentPass ? 'text' : 'password'} value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder={lang === 'de' ? 'Aktuelles Passwort' : 'Current password'} className={inputCls} /><button onClick={() => setShowCurrentPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">{showCurrentPass ? <EyeOff size={13} className={dk ? 'text-slate-500' : 'text-slate-400'} /> : <Eye size={13} className={dk ? 'text-slate-500' : 'text-slate-400'} />}</button></div><div className="relative"><input type={showNewPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder={lang === 'de' ? 'Neues Passwort' : 'New password'} className={inputCls} /><button onClick={() => setShowNewPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">{showNewPass ? <EyeOff size={13} className={dk ? 'text-slate-500' : 'text-slate-400'} /> : <Eye size={13} className={dk ? 'text-slate-500' : 'text-slate-400'} />}</button></div><input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder={lang === 'de' ? 'Passwort bestätigen' : 'Confirm password'} className={inputCls} />{passMsg && <p className={cn('text-xs font-bold', passMsg.startsWith('Error') || passMsg.includes('match') ? 'text-red-400' : 'text-green-400')}>{passMsg}</p>}<div className="flex items-center justify-between flex-wrap gap-2"><button onClick={handleForgotPassword} disabled={sendingReset} className={cn('text-xs font-bold transition-all', dk ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')}>{sendingReset ? '...' : (lang === 'de' ? 'Passwort vergessen?' : 'Forgot password?')}</button>{resetMsg && <p className={cn('text-xs font-bold', resetMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{resetMsg}</p>}<button onClick={handleSavePassword} disabled={savingPass} className={btnPrimary}>{savingPass ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {lang === 'de' ? 'Passwort ändern' : 'Change Password'}</button></div></div>
                </>
              )}

              {settingsTab === 'access' && isAdmin && (
                <>
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Nutzer suchen & Zugriff erteilen' : 'Find user & grant access'}</SectionLabel>
                    <div className="relative mb-3"><Search size={13} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} /><input type="text" value={accessSearch} onChange={e => setAccessSearch(e.target.value)} placeholder={lang === 'de' ? 'Benutzername oder E-Mail...' : 'Username or email...'} className={cn(inputCls, 'pl-9')} /></div>
                    {accessSearching && <div className="flex items-center gap-2 py-2"><Loader2 size={13} className="animate-spin text-blue-500" /><span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>{lang === 'de' ? 'Suche...' : 'Searching...'}</span></div>}
                    {accessResults.length > 0 && !selectedUser && (
                      <div className="space-y-1 mb-3">
                        {accessResults.map(u => (
                          <button key={u.id} onClick={() => setSelectedUser(u)} className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all', dk ? 'bg-white/3 border-white/8 hover:bg-white/8' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')}>
                            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0', dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700')}>{(u.fullName || u.username || u.email || '?')[0].toUpperCase()}</div>
                            <div className="flex-1 min-w-0"><p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>{u.fullName || u.username || 'Unknown'}</p><p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{u.username ? `@${u.username}` : u.email}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedUser && (
                      <div className={cn('rounded-xl border p-4 space-y-3 mb-3', dk ? 'border-blue-500/40 bg-blue-500/5' : 'border-blue-300 bg-blue-50')}>
                        <div className="flex items-center justify-between"><p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>{selectedUser.fullName || selectedUser.username || selectedUser.email}</p><button onClick={() => setSelectedUser(null)} className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-blue-100 text-slate-500')}><X size={13} /></button></div>
                        <select value={grantRole} onChange={e => setGrantRole(e.target.value as any)} className={selectCls}><option value="viewer">👁 Viewer</option><option value="editor">✏️ Editor</option><option value="admin">🛡️ Admin</option></select>
                        {grantMsg && <p className={cn('text-xs font-bold', grantMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{grantMsg}</p>}
                        <button onClick={handleGrantAccess} disabled={granting} className={btnPrimary}>{granting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} {lang === 'de' ? 'Zugriff erteilen' : 'Grant Access'}</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <SectionLabel dk={dk}>{lang === 'de' ? 'Aktueller Zugriff' : 'Current Access'}</SectionLabel>
                    {collabsLoading ? <div className="flex items-center gap-2 py-3"><Loader2 size={14} className="animate-spin text-blue-500" /><span className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>Loading...</span></div>
                    : collabs.length === 0 ? <p className={cn('text-xs py-3', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Noch keine Mitarbeiter' : 'No collaborators yet'}</p>
                    : <div className="space-y-2">{collabs.map(c => <CollabRow key={c.userId} c={c} />)}</div>}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
        
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5); 
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.8);
        }
        .dark ::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
        }
        .dark ::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.8);
        }
      `}</style>
    </>
  );
}
