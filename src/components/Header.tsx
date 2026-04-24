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
  { id: 'serif', label: 'Serif', family: '"Charter", "Bitstream Charter", "Sitka Text", Cambria, serif' },
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

// ... Accordion and SectionLabel remain same ...

export default function Header({
  theme, lang, toggleTheme, setLang,
  searchQuery, setSearchQuery, searchScope, setSearchScope,
  onSignOut, onPrint,
  viewOnly = false, userRole = 'viewer',
  offlineMode, onToggleOfflineMode, isOnline = true
}: HeaderProps) {
  const dk = theme === 'dark';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSuperAdmin = userRole === 'superadmin';

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'security' | 'access'>('profile');
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);

  // ... (keep other states like font, email, pass, accessSearch) ...

  useEffect(() => {
    setProfileLoading(true);
    getMyProfile().then(p => {
      if (!p) return;
      setProfile(p); 
      setSelectedAvatar(p.avatar ?? null);
      setIsGhostMode(p.is_ghost || false);
      const fam = p.fontFamily ?? 'sans';
      const size = p.fontSize ?? 16;
      setFontFamilyState(fam); setFontSizeState(size); applyFont(fam, size);
    }).finally(() => setProfileLoading(false));
  }, []);

  function applyFont(familyId: string, size: number) {
    const font = FONT_STYLES.find(f => f.id === familyId);
    if (font) {
      document.body.style.fontFamily = font.family;
      // FIX: Force numbers to stay on the line and use tabular spacing
      document.body.style.fontVariantNumeric = 'tabular-nums lining-nums';
    }
    document.documentElement.style.fontSize = `${size}px`;
  }

  async function handleToggleGhost() {
    const next = !isGhostMode;
    setIsGhostMode(next);
    try { await updateMyProfile({ is_ghost: next }); } catch {}
  }

  const CollabRow = ({ c }: { c: any }) => (
    <div title={`${c.fullName || ''}\n${c.email}`} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl border', dk ? 'bg-white/3 border-white/8' : 'bg-slate-50 border-slate-200')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 overflow-hidden', dk ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
        {AVATARS.find(a => a.id === c.avatar)?.emoji || (c.fullName || c.email)[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>{c.fullName || 'Unknown'}</p>
        {/* FIX: Restore Username display */}
        {c.username && <p className="text-[10px] font-medium text-blue-500 -mt-0.5">@{c.username}</p>}
        <p className={cn('text-[11px] truncate opacity-60', dk ? 'text-slate-400' : 'text-slate-500')}>{c.email}</p>
      </div>
      {/* STOP PROPAGATION added to prevent dropdown closure */}
      <select 
        onClick={e => e.stopPropagation()} 
        value={pendingRole[c.userId] ?? c.role} 
        onChange={e => setPendingRole(p => ({ ...p, [c.userId]: e.target.value }))} 
        className={cn('text-xs font-bold rounded-lg border px-2 py-1 outline-none', dk ? 'bg-[#1E293B] border-white/10' : 'bg-white border-slate-200')}
      >
        <option value="viewer">👁 Viewer</option>
        <option value="editor">✏️ Editor</option>
        <option value="admin">🛡️ Admin</option>
      </select>
      <button onClick={e => { e.stopPropagation(); handleChangeCollabRole(c.userId); }} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all">
        {changingRole === c.userId ? <Loader2 size={12} className="animate-spin" /> : 'Change'}
      </button>
      {/* Delete button removed per request */}
    </div>
  );

  return (
    <>
      {/* ... header render remains same until export icon ... */}
      <button onClick={onPrint} className={iconBtn} title="Export">
        <Upload size={18} className="text-teal-500" />
      </button>
      {/* ... other header icons ... */}

      {/* SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-[999] flex pointer-events-none">
          <div className="flex-1 pointer-events-auto" onClick={() => setShowSettings(false)} />
          <div className={cn('relative w-full max-w-md h-full flex flex-col shadow-2xl border-l pointer-events-auto', drawerBg, dk ? 'border-white/10' : 'border-slate-200')} style={{ animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)' }}>
            
            {/* PROFILE CONTENT */}
            {settingsTab === 'profile' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className={cn('rounded-2xl border p-5 space-y-4', dk ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-200')}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-blue-500 text-2xl" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                      {AVATARS.find(a => a.id === selectedAvatar)?.emoji || (profile?.email?.[0].toUpperCase())}
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                        <Pencil size={14} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold truncate">{profile?.fullName || 'ShakHo'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <RoleShield role={userRole} dk={dk} />
                        {/* SUPER ADMIN GHOST MODE */}
                        {isSuperAdmin && (
                          <button onClick={handleToggleGhost} className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold transition-all', 
                            isGhostMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                          )}>
                            {isGhostMode ? <EyeOffIcon size={10} /> : <EyeIcon size={10} />}
                            {isGhostMode ? 'Ghost' : 'Visible'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Avatar Picker Logic remains same... */}
                </div>

                {/* PERSONALIZATION - THEME/LANG Integration */}
                <div className={cn('rounded-2xl border p-5 space-y-5', dk ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-200')}>
                   <SectionLabel dk={dk}>Personalization</SectionLabel>
                   {/* Font Style, Size, Lang, Appearance controls go here with stopPropagation added */}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        /* FIX: GLOBAL NUMBER STABILIZER */
        body { font-variant-numeric: tabular-nums lining-nums; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}
