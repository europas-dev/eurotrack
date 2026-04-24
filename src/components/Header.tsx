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
  Moon, Sun, Settings, LogOut,
  X, Check, Loader2, Users, Search,
  User, Lock, UserPlus, ChevronDown,
  ChevronRight, Pencil, Shield, Minus, Plus,
  Mail, KeyRound, AtSign, Eye, EyeOff, HelpCircle,
  FileText, Info, Wifi, WifiOff, Upload, EyeIcon, EyeOffIcon
} from 'lucide-react';

const AVATARS = [
  { id: 'fox', emoji: '🦊', bg: '#f97316' },
  { id: 'wolf', emoji: '🐺', bg: '#3b82f6' },
  { id: 'lion', emoji: '🦁', bg: '#f59e0b' },
  { id: 'bear', emoji: '🐻', bg: '#92400e' },
  { id: 'butterfly', emoji: '🦋', bg: '#a855f7' },
  { id: 'dolphin', emoji: '🐬', bg: '#06b6d4' },
  { id: 'eagle', emoji: '🦅', bg: '#1e3a5f' },
  { id: 'cactus', emoji: '🌵', bg: '#16a34a' },
  { id: 'fire', emoji: '🔥', bg: '#dc2626' },
  { id: 'moon', emoji: '🌙', bg: '#4f46e5' },
  { id: 'lightning', emoji: '⚡', bg: '#ca8a04' },
  { id: 'target', emoji: '🎯', bg: '#475569' },
];

const FONT_STYLES = [
  { id: 'sans', label: 'Default', family: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', family: 'ui-monospace, Menlo, Monaco, monospace' },
];

function RoleShield({ role, dk }: { role: string, dk: boolean }) {
  const cfg: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
    superadmin: { 
      color: dk ? 'text-yellow-400' : 'text-amber-700', 
      bg: dk ? 'bg-yellow-400/10' : 'bg-amber-100', 
      border: dk ? 'border-yellow-400/30' : 'border-amber-300', 
      icon: '👑', label: 'Super Admin' 
    },
    admin: { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30', icon: '🛡️', label: 'Admin' },
    editor: { color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30', icon: '✏️', label: 'Editor' },
    viewer: { color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30', icon: '👁️', label: 'Viewer' },
  };
  const c = cfg[role] ?? cfg.viewer;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold', c.bg, c.border, c.color)}>
      <span>{c.icon} {c.label}</span>
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
  onSignOut, onPrint,
  viewOnly = false, userRole = 'viewer',
  offlineMode, onToggleOfflineMode, isOnline = true
}: HeaderProps) {
  const dk = theme === 'dark';
  const isDe = lang === 'de';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperAdmin = userRole === 'superadmin';

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'security' | 'access'>('profile');

  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);

  const [fontFamily, setFontFamilyState] = useState('sans');
  const [fontSize, setFontSizeState] = useState(16);
  const [savingPersonalize, setSavingPersonalize] = useState(false);
  const [personalizeMsg, setPersonalizeMsg] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [usernameMsg, setUsernameMsg] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  const [accessSearch, setAccessSearch] = useState('');
  const [accessResults, setAccessResults] = useState<any[]>([]);
  const [accessSearching, setAccessSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [grantRole, setGrantRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState('');
  const [collabs, setCollabs] = useState<any[]>([]);
  const [collabsLoading, setCollabsLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const surface = dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900';
  const drawerBg = dk ? 'bg-[#0F172A]' : 'bg-white';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-[#1E293B] border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
      : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');
  const selectCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all cursor-pointer',
    dk ? 'bg-[#1E293B] border-white/10 text-white focus:border-blue-500'
      : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500');
  const iconBtn = cn('p-2.5 rounded-xl border transition-all flex items-center gap-2 group',
    dk ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900');
  const btnPrimary = 'flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all';

  useEffect(() => {
    setProfileLoading(true);
    getMyProfile().then(p => {
      if (!p) return;
      setProfile(p); setEditName(p.fullName || p.full_name || ''); setNewUsername(p.username || '');
      setSelectedAvatar(p.avatar ?? null);
      setIsGhostMode(p.is_ghost || false);
      const fam = p.fontFamily ?? 'sans'; const size = p.fontSize ?? 16;
      setFontFamilyState(fam); setFontSizeState(size); applyFont(fam, size);
    }).catch(() => { }).finally(() => setProfileLoading(false));
  }, []);

  function applyFont(familyId: string, size: number) {
    const font = FONT_STYLES.find(f => f.id === familyId);
    if (font) {
      document.body.style.fontFamily = font.family;
      document.body.style.fontVariantNumeric = 'tabular-nums lining-nums';
    }
    document.documentElement.style.fontSize = `${size}px`;
  }

  function handleFontFamilyChange(value: string) {
    setFontFamilyState(value);
    applyFont(value, fontSize);
  }

  function handleFontSizeChange(value: number) {
    const clamped = Math.min(20, Math.max(12, value));
    setFontSizeState(clamped);
    applyFont(fontFamily, clamped);
  }

  async function handleToggleGhost() {
    const next = !isGhostMode;
    setIsGhostMode(next);
    try { await updateMyProfile({ is_ghost: next }); } catch { }
  }

  async function handleSavePersonalization() {
    setSavingPersonalize(true); setPersonalizeMsg('');
    try { await updateMyProfile({ fontFamily, fontSize }); setPersonalizeMsg(isDe ? '✓ Gespeichert' : '✓ Saved'); setTimeout(() => setPersonalizeMsg(''), 2500); }
    catch (e: any) { setPersonalizeMsg(`Error: ${e.message}`); } finally { setSavingPersonalize(false); }
  }

  useEffect(() => { if (showSettings && settingsTab === 'access') loadCollabs(); }, [showSettings, settingsTab]);

  async function loadCollabs() { setCollabsLoading(true); try { const c = await getCollaborators(); setCollabs(c); setPendingRole(Object.fromEntries(c.map((x: any) => [x.userId, x.role]))); } catch { } finally { setCollabsLoading(false); } }

  useEffect(() => {
    if (!accessSearch.trim()) { setAccessResults([]); setSelectedUser(null); return; }
    const t = setTimeout(async () => { setAccessSearching(true); try { setAccessResults(await searchProfiles(accessSearch)); } catch { } finally { setAccessSearching(false); } }, 350);
    return () => clearTimeout(t);
  }, [accessSearch]);

  async function handleSaveProfile() { setSavingProfile(true); setProfileMsg(''); try { const updated = await updateMyProfile({ full_name: editName, avatar: selectedAvatar }); setProfile(updated); setEditingName(false); setProfileMsg(isDe ? '✓ Gespeichert' : '✓ Saved'); setTimeout(() => setProfileMsg(''), 2500); } catch (e: any) { setProfileMsg(`Error: ${e.message}`); } finally { setSavingProfile(false); } }
  async function handleSaveUsername() { setSavingUsername(true); setUsernameMsg(''); try { await updateMyUsername(newUsername); setProfile((p: any) => ({ ...p, username: newUsername })); setUsernameMsg(isDe ? '✓ Benutzername aktualisiert' : '✓ Username updated'); setTimeout(() => setUsernameMsg(''), 3000); } catch (e: any) { setUsernameMsg(`Error: ${e.message}`); } finally { setSavingUsername(false); } }
  async function handleSaveEmail() { setSavingEmail(true); setEmailMsg(''); try { await updateMyEmail(newEmail); setEmailMsg(isDe ? '✓ Bestätigungslink gesendet' : '✓ Confirmation link sent — check your email'); } catch (e: any) { setEmailMsg(`Error: ${e.message}`); } finally { setSavingEmail(false); } }
  async function handleSavePassword() { if (newPass !== confirmPass) { setPassMsg(isDe ? 'Passwörter stimmen nicht überein' : 'Passwords do not match'); return; } setSavingPass(true); setPassMsg(''); try { await updateMyPassword(currentPass, newPass); setCurrentPass(''); setNewPass(''); setConfirmPass(''); setPassMsg(isDe ? '✓ Passwort geändert' : '✓ Password changed'); setTimeout(() => setPassMsg(''), 3000); } catch (e: any) { setPassMsg(`Error: ${e.message}`); } finally { setSavingPass(false); } }
  async function handleForgotPassword() { if (!profile?.email) return; setSendingReset(true); setResetMsg(''); try { await sendPasswordReset(profile.email); setResetMsg(isDe ? '✓ Reset-Link gesendet' : '✓ Reset link sent'); setTimeout(() => setResetMsg(''), 4000); } catch (e: any) { setResetMsg(`Error: ${e.message}`); } finally { setSendingReset(false); } }
  async function handleGrantAccess() { if (!selectedUser) return; setGranting(true); setGrantMsg(''); try { await grantUserAccess(selectedUser.id, grantRole); setGrantMsg(isDe ? `✓ Zugriff erteilt` : `✓ Access granted`); setSelectedUser(null); setAccessSearch(''); setAccessResults([]); await loadCollabs(); setTimeout(() => setGrantMsg(''), 3000); } catch (e: any) { setGrantMsg(`Error: ${e.message}`); } finally { setGranting(false); } }
  async function handleChangeCollabRole(userId: string) { const role = pendingRole[userId] as any; if (!role) return; setChangingRole(userId); try { await updateCollaboratorPermission(userId, role); setCollabs(p => p.map(c => c.userId === userId ? { ...c, role } : c)); } catch { } finally { setChangingRole(null); } }
  async function handleRemove(userId: string) { try { await removeCollaborator(userId); setCollabs(p => p.filter(c => c.userId !== userId)); } catch { } }

  function AvatarDisplay({ size = 64 }: { size?: number }) {
    const av = AVATARS.find(a => a.id === selectedAvatar);
    const initials = (profile?.fullName || profile?.full_name || profile?.email || '?')[0].toUpperCase();
    return (
      <div className="relative inline-block cursor-pointer group shrink-0" style={{ width: size, height: size }} onClick={() => setShowAvatarPicker(v => !v)}>
        <div className="w-full h-full rounded-full flex items-center justify-center font-black select-none transition-all group-hover:opacity-80 overflow-hidden" style={{ background: av ? av.bg : (dk ? '#334155' : '#e2e8f0'), fontSize: size * 0.4 }}>
          {av ? av.emoji : <span className={dk ? 'text-slate-300' : 'text-slate-600'}>{initials}</span>}
        </div>
        <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow-md pointer-events-none">
          <Pencil size={9} className="text-white" />
        </div>
      </div>
    );
  }

  const CollabRow = ({ c }: { c: any }) => (
    <div title={`${c.fullName || ''}\n${c.email}`} className={cn('flex items-center gap-3 px-3 py-3 rounded-xl border', dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shrink-0 overflow-hidden', dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
        {AVATARS.find(a => a.id === c.avatar)?.emoji || (c.fullName || c.email)[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>{c.fullName || 'Unknown'}</p>
        {c.username && <p className="text-[12px] font-semibold text-blue-500">@{c.username}</p>}
        <p className={cn('text-[11px] truncate opacity-50', dk ? 'text-slate-400' : 'text-slate-500')}>{c.email}</p>
      </div>
      <select 
        onMouseDown={e => e.stopPropagation()} 
        value={pendingRole[c.userId] ?? c.role} 
        onChange={e => setPendingRole(p => ({ ...p, [c.userId]: e.target.value }))} 
        className={cn('text-xs font-bold rounded-lg border px-2 py-1.5 outline-none transition-all', dk ? 'bg-[#1E293B] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')}
      >
        <option value="viewer">{isDe ? 'Betrachter' : 'Viewer'}</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
      <button onMouseDown={e => e.stopPropagation()} onClick={() => handleChangeCollabRole(c.userId)} disabled={changingRole === c.userId} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all">
        {changingRole === c.userId ? <Loader2 size={12} className="animate-spin" /> : (isDe ? 'Ändern' : 'Change')}
      </button>
    </div>
  );

  return (
    <>
      <header className={cn('shrink-0 flex items-center gap-3 px-6 py-3 border-b z-50 relative', surface)}>
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
              <option value="all">{isDe ? 'Überall' : 'All Fields'}</option>
              <option value="hotel">{isDe ? 'Hotelname' : 'Hotel Name'}</option>
              <option value="city">{isDe ? 'Stadt' : 'City'}</option>
              <option value="company">{isDe ? 'Firma' : 'Company'}</option>
              <option value="employee">{isDe ? 'Mitarbeiter' : 'Employee'}</option>
              <option value="invoice">{isDe ? 'Rechnung' : 'Invoice No.'}</option>
            </select>
            <div className="relative flex-1 flex items-center">
              <Search size={15} className={cn('absolute left-3 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isDe ? 'Suchen...' : 'Search...'}
                className={cn('w-full h-9 pl-9 pr-9 text-sm outline-none bg-transparent font-bold', dk ? 'text-white placeholder-slate-600' : 'text-slate-900 placeholder-slate-400')}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3">
                  <X size={14} className={dk ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button onClick={onPrint} className={iconBtn} title="Export">
            <Upload size={18} className="text-teal-500" />
          </button>

          <button onClick={onToggleOfflineMode} className={cn(iconBtn, offlineMode && "bg-amber-500/20 text-amber-500")} title={isDe ? 'Offline-Modus' : 'Offline Mode'}>
            {(!isOnline || offlineMode) ? <WifiOff size={18} /> : <Wifi size={18} className="text-emerald-500" />}
          </button>

          <button onClick={() => setLang(isDe ? 'en' : 'de')} className={cn(iconBtn, 'text-xs font-black px-3')}>
            {lang.toUpperCase()}
          </button>

          <button onClick={toggleTheme} className={iconBtn}>
            {dk ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button onClick={() => { setShowSettings(true); setSettingsTab('profile'); }} className={iconBtn}>
            <Settings size={18} />
          </button>

          <button onClick={onSignOut} className="ml-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-sm transition-all shadow-md">
            {isDe ? 'Abmelden' : 'Sign Out'}
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[999] flex pointer-events-none">
          <div className="flex-1 pointer-events-auto" onClick={() => setShowSettings(false)} />
          <div className={cn('relative w-full max-w-md h-full flex flex-col shadow-2xl border-l pointer-events-auto', drawerBg, dk ? 'border-white/10' : 'border-slate-200')} style={{ animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)' }}>
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              <h2 className={cn('text-lg font-black', dk ? 'text-white' : 'text-slate-900')}>{isDe ? 'Einstellungen' : 'Settings'}</h2>
              <button onClick={() => setShowSettings(false)} className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}><X size={18} /></button>
            </div>
            <div className={cn('flex border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              {([{ id: 'profile', icon: User, label: isDe ? 'Profil' : 'Profile' }, { id: 'security', icon: Lock, label: isDe ? 'Sicherheit' : 'Security' }, ...(isAdmin ? [{ id: 'access', icon: Users, label: isDe ? 'Zugriff' : 'Access' }] : [])] as const).map(({ id, icon: Icon, label }) => (
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
                            <div className="flex items-center gap-2 group">
                              <span className={cn('text-sm font-black truncate', dk ? 'text-white' : 'text-slate-900')}>{profile?.fullName || profile?.full_name || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <RoleShield role={userRole} dk={dk} />
                              {isSuperAdmin && (
                                <button onClick={handleToggleGhost} className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold transition-all', 
                                  isGhostMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                )}>
                                  {isGhostMode ? <EyeOffIcon size={10} /> : <EyeIcon size={10} />}
                                  {isGhostMode ? (isDe ? 'Unsichtbar' : 'Invisible') : (isDe ? 'Sichtbar' : 'Visible')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {showAvatarPicker && (
                          <div className={cn('mt-4 pt-4 border-t', dk ? 'border-white/10' : 'border-slate-200')}>
                            <div className="flex items-center justify-between mb-3"><p className={cn('text-xs font-bold', dk ? 'text-slate-400' : 'text-slate-600')}>{isDe ? 'Avatar wählen' : 'Choose avatar'}</p><button onClick={() => setShowAvatarPicker(false)} className={cn('p-1 rounded text-xs', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}><X size={13} /></button></div>
                            <div className="grid grid-cols-6 gap-2">
                              {AVATARS.map(av => <button key={av.id} onClick={() => { setSelectedAvatar(av.id); setShowAvatarPicker(false); handleSaveProfile(); }} className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110', selectedAvatar === av.id ? 'ring-2 ring-blue-500 ring-offset-2' : '')} style={{ background: av.bg }}>{av.emoji}</button>)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={cn('rounded-xl border p-4 space-y-4', dk ? 'border-white/10' : 'border-slate-200')}>
                        <SectionLabel dk={dk}>{isDe ? 'Personalisierung' : 'Personalization'}</SectionLabel>
                        <div>
                          <p className={cn('text-xs font-bold mb-1.5', dk ? 'text-slate-400' : 'text-slate-600')}>{isDe ? 'Schriftstil' : 'Font Style'}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {FONT_STYLES.map(s => (
                              <button key={s.id} onClick={() => handleFontFamilyChange(s.id)} className={cn('py-2.5 rounded-lg border font-bold transition-all flex flex-col items-center justify-center', fontFamily === s.id ? 'border-blue-500 bg-blue-500/10 text-blue-500' : dk ? 'border-white/10 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-600')} style={{ fontFamily: s.family }}>
                                Ag <span className="text-[10px] uppercase font-normal">{s.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className={cn('text-xs font-bold mb-1.5', dk ? 'text-slate-400' : 'text-slate-600')}>{isDe ? 'Schriftgröße' : 'Font Size'}</p>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleFontSizeChange(fontSize - 1)} className={cn('p-1.5 rounded-lg border transition-all', dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}><Minus size={13} /></button>
                            <div className={cn('flex-1 text-center text-sm font-black rounded-lg border py-1.5', dk ? 'border-white/10 text-white' : 'border-slate-200 text-slate-900')}>{fontSize}px</div>
                            <button onClick={() => handleFontSizeChange(fontSize + 1)} className={cn('p-1.5 rounded-lg border transition-all', dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}><Plus size={13} /></button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className={cn('text-xs font-bold mb-1.5', dk ? 'text-slate-400' : 'text-slate-600')}>{isDe ? 'Sprache' : 'Language'}</p>
                            <div className="flex rounded-lg border overflow-hidden">
                              <button onClick={() => handleSetLang('de')} className={cn('flex-1 py-1.5 text-xs font-bold', lang === 'de' ? 'bg-blue-600 text-white' : 'opacity-50')}>DE</button>
                              <button onClick={() => handleSetLang('en')} className={cn('flex-1 py-1.5 text-xs font-bold', lang === 'en' ? 'bg-blue-600 text-white' : 'opacity-50')}>EN</button>
                            </div>
                          </div>
                          <div>
                            <p className={cn('text-xs font-bold mb-1.5', dk ? 'text-slate-400' : 'text-slate-600')}>{isDe ? 'Erscheinungsbild' : 'Appearance'}</p>
                            <div className="flex rounded-lg border overflow-hidden">
                              <button onClick={toggleTheme} className={cn('flex-1 py-1.5 flex justify-center', dk ? 'bg-blue-600 text-white' : 'opacity-50')}><Moon size={14} /></button>
                              <button onClick={toggleTheme} className={cn('flex-1 py-1.5 flex justify-center', !dk ? 'bg-blue-600 text-white' : 'opacity-50')}><Sun size={14} /></button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          {personalizeMsg && <p className={cn('text-xs font-bold', personalizeMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{personalizeMsg}</p>}
                          <button onClick={handleSavePersonalization} disabled={savingPersonalize} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ml-auto', dk ? 'border-white/10 hover:bg-white/10 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')}>{savingPersonalize ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {isDe ? 'Speichern' : 'Save'}</button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Accordion title="FAQ" icon={HelpCircle} dk={dk}><p>{isDe ? 'Häufig gestellte Fragen.' : 'Commonly asked questions.'}</p></Accordion>
                        <Accordion title={isDe ? 'Datenschutz' : 'Privacy Policy'} icon={FileText} dk={dk}><p>{isDe ? 'Sichere Datenspeicherung.' : 'Secure data storage.'}</p></Accordion>
                        <Accordion title={isDe ? 'Über EuroTrack' : 'About EuroTrack'} icon={Info} dk={dk}><p>{isDe ? 'Ein Tool für die Hotelverwaltung.' : 'A hotel management tool.'}</p></Accordion>
                      </div>
                    </>
                  )}
                </>
              )}
              {/* security and access tabs remain same... */}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* UNIVERSAL FIX: Force lining figures globally for all text */
        * {
          font-variant-numeric: lining-nums tabular-nums !important;
          -webkit-font-feature-settings: "lnum", "tnum";
          font-feature-settings: "lnum", "tnum";
        }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </>
  );
}
