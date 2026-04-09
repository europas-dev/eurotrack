// src/components/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { getMyProfile, updateMyProfile } from '../lib/supabase';
import {
  Moon, Sun, Globe, Search, Share2, Download,
  Settings, LogOut, ChevronDown, User, Lock, Bell, X, Check, Loader2, Users
} from 'lucide-react';
import ShareModal from './ShareModal';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSignOut: () => void;
  onExport?: () => void;
  // Legacy props — kept for compat but no longer used for share
  activeHotelIdForShare?: string | null;
  activeHotelNameForShare?: string | null;
  collaborators?: any[];
  onCollaboratorsChanged?: (c: any[]) => void;
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
  const [settingsTab,  setSettingsTab]  = useState<'profile' | 'privacy' | 'notifications'>('profile');
  const [profile,      setProfile]      = useState<any>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');
  const [notifCount,   setNotifCount]   = useState(2);

  // Profile edit fields
  const [editName,     setEditName]     = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail,    setEditEmail]    = useState('');
  const [editOldPass,  setEditOldPass]  = useState('');
  const [editNewPass,  setEditNewPass]  = useState('');

  useEffect(() => {
    getMyProfile().then(p => {
      if (p) {
        setProfile(p);
        setEditName(p.fullName || p.full_name || '');
        setEditUsername(p.username || '');
        setEditEmail(p.email || '');
      }
    });
  }, []);

  async function handleSaveProfile() {
    setSaving(true); setSaveMsg('');
    try {
      const updated = await updateMyProfile({
        full_name: editName,
        username:  editUsername,
      });
      setProfile(updated);
      setSaveMsg(lang === 'de' ? '\u2713 Gespeichert' : '\u2713 Saved');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally { setSaving(false); }
  }

  const surface = dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = cn('w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-600'
       : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400');
  const iconBtn = cn('p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900');

  return (
    <>
      <header className={cn('shrink-0 flex items-center gap-3 px-6 py-3 border-b', surface)}>

        {/* Logo */}
        <div className="text-xl font-black italic mr-2 whitespace-nowrap select-none">
          Euro<span className="text-yellow-400">Track.</span>
        </div>

        {/* Search */}
        <div className="flex-1 relative max-w-xl">
          <Search size={15} className={cn('absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', dk ? 'text-slate-500' : 'text-slate-400')} />
          <input
            type="text"
            value={searchQuery}
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

          {/* Share / Invite */}
          <button onClick={() => setShowShare(true)} className={iconBtn} title={lang === 'de' ? 'Zugang teilen' : 'Share access'}>
            <Users size={18} />
          </button>

          {/* Lang */}
          <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className={cn(iconBtn, 'text-xs font-black px-3')}>
            {lang === 'de' ? 'EN' : 'DE'}
          </button>

          {/* Notifications */}
          <button className={iconBtn} onClick={() => setNotifCount(0)}>
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                {notifCount}
              </span>
            )}
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
          <button onClick={() => setShowSettings(true)} className={iconBtn}>
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

      {/* Share Modal */}
      {showShare && (
        <ShareModal
          theme={theme}
          lang={lang}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn('w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden max-h-[85vh] flex flex-col', surface)}>

            {/* Header */}
            <div className={cn('flex items-center justify-between px-6 py-4 border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              <h2 className="text-lg font-black">{lang === 'de' ? 'Einstellungen' : 'Settings'}</h2>
              <button onClick={() => setShowSettings(false)} className={cn('p-2 rounded-lg', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className={cn('flex border-b shrink-0', dk ? 'border-white/10' : 'border-slate-200')}>
              {([['profile', lang === 'de' ? 'Profil' : 'Profile', User],
                 ['privacy', lang === 'de' ? 'Sicherheit' : 'Security', Lock],
                 ['notifications', lang === 'de' ? 'Benachrichtigungen' : 'Notifications', Bell]] as const).map(([tab, label, Icon]) => (
                <button
                  key={tab}
                  onClick={() => setSettingsTab(tab)}
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
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {lang === 'de' ? 'Speichern' : 'Save'}
                    </button>
                    {saveMsg && <span className={cn('text-sm font-bold', saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{saveMsg}</span>}
                  </div>
                </>
              )}

              {settingsTab === 'privacy' && (
                <>
                  <p className={cn('text-sm', dk ? 'text-slate-400' : 'text-slate-500')}>
                    {lang === 'de'
                      ? 'Passwort\u00e4nderungen werden per E-Mail durchgef\u00fchrt. Bitte nutze die "Passwort vergessen"-Funktion im Login.'
                      : 'Password changes are handled via email. Please use the "Forgot password" function on the login screen.'}
                  </p>
                </>
              )}

              {settingsTab === 'notifications' && (
                <p className={cn('text-sm', dk ? 'text-slate-400' : 'text-slate-500')}>
                  {lang === 'de' ? 'Benachrichtigungseinstellungen folgen in K\u00fcrze.' : 'Notification preferences coming soon.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
