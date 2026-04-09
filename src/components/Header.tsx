import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Share2, Bell, Download, Sun, Moon, Settings, X, Check,
  UserPlus, Shield, BookOpen, HelpCircle, Info, Type, Minus, Plus,
  User, AtSign, Mail, Lock, Eye, EyeOff, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  getMyProfile, updateMyProfile,
  searchProfiles, inviteCollaborator,
  updateCollaboratorPermission, removeCollaborator,
} from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSignOut: () => void;
  onExport?: () => void;
  onShare?: () => void;
  activeHotelIdForShare?: string | null;
  activeHotelNameForShare?: string | null;
  collaborators?: any[];
  onCollaboratorsChanged?: (list: any[] | ((prev: any[]) => any[])) => void;
}

type SettingsTab = 'profile' | 'privacy';

export default function Header({
  theme, lang, toggleTheme, setLang,
  searchQuery, setSearchQuery,
  onSignOut, onExport,
  activeHotelIdForShare = null,
  activeHotelNameForShare = null,
  collaborators = [],
  onCollaboratorsChanged,
}: HeaderProps) {
  const dk = theme === 'dark';

  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings,      setShowSettings]      = useState(false);
  const [showShare,         setShowShare]         = useState(false);
  const [settingsTab,       setSettingsTab]       = useState<SettingsTab>('profile');

  const [notifications] = useState([
    { id: 1, type: 'warning', msg: lang === 'de' ? 'Prüfe bevorstehende Check-outs und freie Betten' : 'Review upcoming check-outs and free beds' },
    { id: 2, type: 'info',    msg: lang === 'de' ? 'CSV Export verfügbar' : 'CSV export available' },
  ]);
  const [readIds, setReadIds] = useState<number[]>([]);
  const unread = notifications.filter(n => !readIds.includes(n.id)).length;

  const [profile,       setProfile]       = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Privacy & Security state
  const [privacyTab,    setPrivacyTab]    = useState<'username' | 'email' | 'password'>('username');
  const [newUsername,   setNewUsername]   = useState('');
  const [newEmail,      setNewEmail]      = useState('');
  const [currentPass,   setCurrentPass]   = useState('');
  const [newPass,       setNewPass]       = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [privacyMsg,    setPrivacyMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [showPw,        setShowPw]        = useState(false);

  const [shareQuery,      setShareQuery]      = useState('');
  const [shareResults,    setShareResults]    = useState<any[]>([]);
  const [shareLoading,    setShareLoading]    = useState(false);
  const [sharePermission, setSharePermission] = useState<'viewer' | 'editor'>('viewer');
  const [shareError,      setShareError]      = useState('');
  const [shareSuccess,    setShareSuccess]    = useState('');

  useEffect(() => { getMyProfile().then(setProfile).catch(() => {}); }, []);

  useEffect(() => {
    const root = document.documentElement;
    const fontScale  = profile?.fontScale  ?? 100;
    const fontFamily = profile?.fontFamily ?? 'inter';
    root.style.setProperty('--app-font-scale',  `${fontScale}%`);
    const fontMap: Record<string, string> = {
      inter:  'Inter, ui-sans-serif, system-ui, sans-serif',
      geist:  'Arial, ui-sans-serif, system-ui, sans-serif',
      roboto: 'Roboto, ui-sans-serif, system-ui, sans-serif',
      mono:   'ui-monospace, SFMono-Regular, Menlo, monospace',
    };
    document.body.style.fontFamily = fontMap[fontFamily] || fontMap.inter;
    document.body.style.fontSize   = `calc(16px * ${fontScale / 100})`;
  }, [profile]);

  async function saveProfile(patch: any) {
    try {
      setSavingProfile(true);
      const updated = await updateMyProfile(patch);
      setProfile(updated);
    } catch (e) { console.error(e); }
    finally { setSavingProfile(false); }
  }

  // ── Privacy actions ───────────────────────────────────────────────────────
  async function handleChangeUsername() {
    setPrivacyMsg(null);
    const u = newUsername.trim();
    if (!u || u.length < 3) { setPrivacyMsg({ type: 'err', text: lang === 'de' ? 'Mindestens 3 Zeichen.' : 'At least 3 characters.' }); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(u)) { setPrivacyMsg({ type: 'err', text: lang === 'de' ? 'Nur Buchstaben, Zahlen, _ . -' : 'Letters, numbers, _ . - only.' }); return; }
    setPrivacyLoading(true);
    try {
      // Check uniqueness
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', u).maybeSingle();
      if (existing) throw new Error(lang === 'de' ? 'Benutzername bereits vergeben.' : 'Username already taken.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('profiles').update({ username: u }).eq('id', user.id);
      await supabase.auth.updateUser({ data: { username: u } });
      setProfile((p: any) => ({ ...p, username: u }));
      setNewUsername('');
      setPrivacyMsg({ type: 'ok', text: lang === 'de' ? 'Benutzername geändert!' : 'Username updated!' });
    } catch (e: any) {
      setPrivacyMsg({ type: 'err', text: e.message });
    } finally { setPrivacyLoading(false); }
  }

  async function handleChangeEmail() {
    setPrivacyMsg(null);
    const e = newEmail.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setPrivacyMsg({ type: 'err', text: lang === 'de' ? 'Gültige E-Mail eingeben.' : 'Enter a valid email.' }); return;
    }
    setPrivacyLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: e });
      if (error) throw error;
      setNewEmail('');
      setPrivacyMsg({ type: 'ok', text: lang === 'de' ? 'Bestätigungslink gesendet. Bitte beide E-Mails bestätigen.' : 'Confirmation link sent. Please confirm both emails.' });
    } catch (e: any) {
      setPrivacyMsg({ type: 'err', text: e.message });
    } finally { setPrivacyLoading(false); }
  }

  async function handleChangePassword() {
    setPrivacyMsg(null);
    if (newPass.length < 6) { setPrivacyMsg({ type: 'err', text: lang === 'de' ? 'Mindestens 6 Zeichen.' : 'At least 6 characters.' }); return; }
    if (newPass !== confirmPass) { setPrivacyMsg({ type: 'err', text: lang === 'de' ? 'Passwörter stimmen nicht überein.' : 'Passwords do not match.' }); return; }
    setPrivacyLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setNewPass(''); setConfirmPass(''); setCurrentPass('');
      setPrivacyMsg({ type: 'ok', text: lang === 'de' ? 'Passwort geändert!' : 'Password updated!' });
    } catch (e: any) {
      setPrivacyMsg({ type: 'err', text: e.message });
    } finally { setPrivacyLoading(false); }
  }

  async function handleSearchPeople(value: string) {
    setShareQuery(value); setShareError(''); setShareSuccess('');
    if (!value.trim()) { setShareResults([]); return; }
    try {
      setShareLoading(true);
      const list = await searchProfiles(value);
      setShareResults(list);
    } catch (e: any) { setShareError(e.message || 'Search failed'); }
    finally { setShareLoading(false); }
  }

  async function handleInvite(person: any) {
    if (!activeHotelIdForShare) { setShareError(lang === 'de' ? 'Öffne zuerst ein Hotel' : 'Open a hotel first'); return; }
    try {
      setShareError('');
      const created = await inviteCollaborator(activeHotelIdForShare, person.id, sharePermission);
      onCollaboratorsChanged?.((prev: any[]) => [...(prev || collaborators || []), created]);
      setShareSuccess(lang === 'de' ? 'Benutzer eingeladen' : 'User invited');
      setShareQuery(''); setShareResults([]);
    } catch (e: any) { setShareError(e.message || 'Invite failed'); }
  }

  async function handleChangePermission(id: string, permission: 'viewer' | 'editor') {
    try {
      const updated = await updateCollaboratorPermission(id, permission);
      onCollaboratorsChanged?.((prev: any[]) => (prev || collaborators || []).map((c: any) => c.id === id ? updated : c));
    } catch (e) { console.error(e); }
  }

  async function handleRemoveCollaborator(id: string) {
    try {
      await removeCollaborator(id);
      onCollaboratorsChanged?.((prev: any[]) => (prev || collaborators || []).filter((c: any) => c.id !== id));
    } catch (e) { console.error(e); }
  }

  const btnCls = cn('p-2 rounded-lg transition-all relative', dk ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900');
  const panelCls = cn('absolute top-full right-0 mt-2 w-80 rounded-xl border shadow-2xl z-50', dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900');
  const inputCls = cn('w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all', dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500');
  const tabBtn = (active: boolean) => cn('flex-1 py-1.5 text-xs font-bold rounded-lg transition-all', active ? 'bg-blue-600 text-white' : dk ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100');

  return (
    <header className={cn('border-b sticky top-0 z-40', dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900')}>
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className={cn('text-2xl font-black italic', dk ? 'text-white' : 'text-slate-900')}>
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>

          <div className="flex items-center gap-1">

            {/* Share */}
            <div className="relative">
              <button onClick={() => { setShowShare(!showShare); setShowNotifications(false); setShowSettings(false); }} className={btnCls}>
                <Share2 size={18} />
              </button>
              {showShare && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShare(false)} />
                  <div className={cn(panelCls, 'z-50 w-[380px]')}>
                    <div className={cn('flex items-center justify-between px-4 py-3 border-b', dk ? 'border-white/10' : 'border-slate-100')}>
                      <div>
                        <p className={cn('text-sm font-black')}>{lang === 'de' ? 'Mitarbeiter' : 'Collaborators'}</p>
                        <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>{activeHotelNameForShare || (lang === 'de' ? 'Kein Hotel ausgewählt' : 'No hotel selected')}</p>
                      </div>
                      <button onClick={async () => {
                        try { if (navigator.share) await navigator.share({ title: 'EuroTrack', url: window.location.href }); else { await navigator.clipboard.writeText(window.location.href); alert(lang === 'de' ? 'Link kopiert' : 'Link copied'); } } catch {}
                      }} className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border', dk ? 'border-white/10 hover:bg-white/5 text-slate-200' : 'border-slate-200 hover:bg-slate-50 text-slate-700')}>
                        {lang === 'de' ? 'Link teilen' : 'Share link'}
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-2">
                        <input type="text" value={shareQuery} onChange={e => handleSearchPeople(e.target.value)}
                          placeholder={lang === 'de' ? 'E-Mail oder Name...' : 'Email or name...'}
                          className={cn(inputCls, 'flex-1')} />
                        <select value={sharePermission} onChange={e => setSharePermission(e.target.value as any)}
                          className={cn('px-2 py-2 rounded-lg text-sm outline-none border', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')}>
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      </div>
                      {shareLoading && <p className="text-xs text-slate-400">{lang === 'de' ? 'Suche...' : 'Searching...'}</p>}
                      {shareError   && <p className="text-xs text-red-400 font-bold">{shareError}</p>}
                      {shareSuccess && <p className="text-xs text-green-400 font-bold">{shareSuccess}</p>}
                      {shareResults.map((p: any) => (
                        <div key={p.id} className={cn('flex items-center justify-between px-3 py-2 rounded-lg border', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{p.fullName || 'User'}</p>
                            <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{p.email}</p>
                          </div>
                          <button onClick={() => handleInvite(p)} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                            <UserPlus size={12} />{lang === 'de' ? 'Einladen' : 'Invite'}
                          </button>
                        </div>
                      ))}
                      {collaborators.length > 0 && (
                        <div className="space-y-2 pt-2 border-t" style={{ borderColor: dk ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
                          {collaborators.map((c: any) => (
                            <div key={c.id} className={cn('flex items-center justify-between gap-2 px-3 py-2 rounded-lg border', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
                              <p className="text-sm font-bold truncate">{c.profile?.fullName || c.profile?.email || 'User'}</p>
                              <div className="flex items-center gap-1">
                                <select value={c.permission} onChange={e => handleChangePermission(c.id, e.target.value as any)}
                                  className={cn('px-2 py-1 rounded text-xs outline-none border', dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200')}>
                                  <option value="viewer">Viewer</option>
                                  <option value="editor">Editor</option>
                                </select>
                                <button onClick={() => handleRemoveCollaborator(c.id)} className="p-1 rounded text-red-400 hover:bg-red-500/10"><X size={12} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Language */}
            <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className={cn('px-3 py-1.5 rounded-lg font-bold text-sm transition-all', dk ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-700')}>
              {lang.toUpperCase()}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); setShowShare(false); }} className={btnCls}>
                <Bell size={18} />
                {unread > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{unread}</span>}
              </button>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className={cn(panelCls, 'z-50')}>
                    <div className={cn('flex items-center justify-between px-4 py-3 border-b', dk ? 'border-white/10' : 'border-slate-100')}>
                      <p className="text-sm font-black">{lang === 'de' ? 'Benachrichtigungen' : 'Notifications'}</p>
                      <button onClick={() => setReadIds(notifications.map(n => n.id))} className="text-xs text-blue-400 font-bold">{lang === 'de' ? 'Alle gelesen' : 'Mark all read'}</button>
                    </div>
                    <div className="p-2 space-y-1">
                      {notifications.map(n => (
                        <div key={n.id} onClick={() => setReadIds(p => [...new Set([...p, n.id])])}
                          className={cn('px-3 py-2.5 rounded-lg text-sm cursor-pointer flex items-start gap-2',
                            readIds.includes(n.id) ? dk ? 'text-slate-500' : 'text-slate-400' : dk ? 'bg-white/5 text-slate-100' : 'bg-slate-50 text-slate-700',
                            dk ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
                          <span className={n.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}>{n.type === 'warning' ? '⚠' : 'ℹ'}</span>
                          <span className="flex-1">{n.msg}</span>
                          {!readIds.includes(n.id) && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={onExport} className={btnCls}><Download size={18} /></button>
            <button onClick={toggleTheme} className={btnCls}>{dk ? <Sun size={18} /> : <Moon size={18} />}</button>

            {/* Settings */}
            <div className="relative">
              <button onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); setShowShare(false); }} className={btnCls}>
                <Settings size={18} />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className={cn(panelCls, 'z-50 w-96 max-h-[80vh] overflow-y-auto')}>
                    {/* Header */}
                    <div className={cn('flex items-center justify-between px-4 py-3 border-b sticky top-0', dk ? 'border-white/10 bg-[#0F172A]' : 'border-slate-100 bg-white')}>
                      <p className="text-sm font-black">{lang === 'de' ? 'Einstellungen' : 'Settings'}</p>
                      <button onClick={() => setShowSettings(false)} className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}><X size={14} /></button>
                    </div>

                    {/* Tabs */}
                    <div className={cn('flex gap-1 p-3 border-b', dk ? 'border-white/10' : 'border-slate-100')}>
                      <button onClick={() => { setSettingsTab('profile'); setPrivacyMsg(null); }} className={tabBtn(settingsTab === 'profile')}>
                        <User size={12} className="inline mr-1" />{lang === 'de' ? 'Profil' : 'Profile'}
                      </button>
                      <button onClick={() => { setSettingsTab('privacy'); setPrivacyMsg(null); }} className={tabBtn(settingsTab === 'privacy')}>
                        <Shield size={12} className="inline mr-1" />{lang === 'de' ? 'Sicherheit' : 'Security'}
                      </button>
                    </div>

                    <div className="p-4 space-y-4">

                      {/* ── PROFILE TAB ── */}
                      {settingsTab === 'profile' && (
                        <>
                          <div>
                            <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Name' : 'Full Name'}</p>
                            <input value={profile?.fullName || ''} onChange={e => setProfile((p: any) => ({ ...p, fullName: e.target.value }))} placeholder={lang === 'de' ? 'Vollständiger Name' : 'Full name'} className={inputCls} />
                            <button onClick={() => saveProfile({ full_name: profile?.fullName || '' })} disabled={savingProfile}
                              className="mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1 disabled:opacity-50">
                              {savingProfile ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              {lang === 'de' ? 'Speichern' : 'Save'}
                            </button>
                          </div>

                          <div>
                            <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Sprache' : 'Language'}</p>
                            <div className="flex gap-2">
                              {(['de', 'en'] as const).map(l => (
                                <button key={l} onClick={() => setLang(l)}
                                  className={cn('flex-1 py-2 rounded-lg text-sm font-bold border transition-all', lang === l ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                                  {l === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Design' : 'Theme'}</p>
                            <button onClick={toggleTheme}
                              className={cn('w-full py-2 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2', dk ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                              {dk ? <><Sun size={14} />{lang === 'de' ? 'Hellmodus' : 'Light mode'}</> : <><Moon size={14} />{lang === 'de' ? 'Dunkelmodus' : 'Dark mode'}</>}
                            </button>
                          </div>

                          <div>
                            <p className={cn('text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1', dk ? 'text-slate-500' : 'text-slate-400')}><Type size={12} />{lang === 'de' ? 'Schriftart' : 'Font'}</p>
                            <select value={profile?.fontFamily || 'inter'} onChange={e => { setProfile((p: any) => ({ ...p, fontFamily: e.target.value })); saveProfile({ fontFamily: e.target.value }); }}
                              className={cn(inputCls)}>
                              <option value="inter">Inter</option>
                              <option value="geist">Arial</option>
                              <option value="roboto">Roboto</option>
                              <option value="mono">Mono</option>
                            </select>
                          </div>

                          <div>
                            <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>{lang === 'de' ? 'Schriftgröße' : 'Font size'}</p>
                            <div className="flex items-center gap-2">
                              <button onClick={() => saveProfile({ fontScale: Math.max(85, (profile?.fontScale || 100) - 5) })} className={cn('p-2 rounded-lg border', dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50')}><Minus size={14} /></button>
                              <div className={cn('flex-1 text-center py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10' : 'border-slate-200')}>{profile?.fontScale || 100}%</div>
                              <button onClick={() => saveProfile({ fontScale: Math.min(135, (profile?.fontScale || 100) + 5) })} className={cn('p-2 rounded-lg border', dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50')}><Plus size={14} /></button>
                            </div>
                          </div>

                          <div className="space-y-1 pt-2 border-t" style={{ borderColor: dk ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
                            {[
                              { icon: <HelpCircle size={14} />, label: 'FAQ' },
                              { icon: <BookOpen  size={14} />, label: lang === 'de' ? 'Benutzerhandbuch' : 'User Guide' },
                              { icon: <Info      size={14} />, label: lang === 'de' ? 'Über EuroTrack'   : 'About EuroTrack' },
                            ].map(({ icon, label }) => (
                              <button key={label} className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all', dk ? 'hover:bg-white/5 text-slate-200' : 'hover:bg-slate-50 text-slate-700')}>
                                <span className="inline-flex items-center gap-2">{icon}{label}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {/* ── PRIVACY & SECURITY TAB ── */}
                      {settingsTab === 'privacy' && (
                        <>
                          {privacyMsg && (
                            <div className={cn('p-3 rounded-lg text-xs font-bold', privacyMsg.type === 'ok' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20')}>
                              {privacyMsg.text}
                            </div>
                          )}

                          {/* Sub-tabs */}
                          <div className={cn('flex gap-1 p-1 rounded-xl', dk ? 'bg-white/5' : 'bg-slate-100')}>
                            {(['username', 'email', 'password'] as const).map(tab => (
                              <button key={tab} onClick={() => { setPrivacyTab(tab); setPrivacyMsg(null); }}
                                className={cn('flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all',
                                  privacyTab === tab ? 'bg-blue-600 text-white' : dk ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-white')}>
                                {tab === 'username' ? (lang === 'de' ? 'Benutzername' : 'Username') : tab === 'email' ? 'Email' : (lang === 'de' ? 'Passwort' : 'Password')}
                              </button>
                            ))}
                          </div>

                          {/* Change Username */}
                          {privacyTab === 'username' && (
                            <div className="space-y-2">
                              <p className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                                {lang === 'de' ? `Aktuell: @${profile?.username || '—'}` : `Current: @${profile?.username || '—'}`}
                              </p>
                              <div className="relative">
                                <AtSign className="absolute left-3 top-2.5 opacity-30" size={16} />
                                <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
                                  placeholder={lang === 'de' ? 'Neuer Benutzername' : 'New username'}
                                  className={cn(inputCls, 'pl-9')} />
                              </div>
                              <button onClick={handleChangeUsername} disabled={privacyLoading || !newUsername.trim()}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                {privacyLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {lang === 'de' ? 'Benutzername ändern' : 'Change Username'}
                              </button>
                            </div>
                          )}

                          {/* Change Email */}
                          {privacyTab === 'email' && (
                            <div className="space-y-2">
                              <p className={cn('text-xs', dk ? 'text-slate-400' : 'text-slate-500')}>
                                {lang === 'de' ? `Aktuell: ${profile?.email || '—'}` : `Current: ${profile?.email || '—'}`}
                              </p>
                              <div className="relative">
                                <Mail className="absolute left-3 top-2.5 opacity-30" size={16} />
                                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                  placeholder={lang === 'de' ? 'Neue E-Mail-Adresse' : 'New email address'}
                                  className={cn(inputCls, 'pl-9')} />
                              </div>
                              <button onClick={handleChangeEmail} disabled={privacyLoading || !newEmail.trim()}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                {privacyLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {lang === 'de' ? 'E-Mail ändern' : 'Change Email'}
                              </button>
                              <p className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>
                                {lang === 'de' ? 'Du erhältst einen Bestätigungslink an die neue Adresse.' : 'A confirmation link will be sent to the new address.'}
                              </p>
                            </div>
                          )}

                          {/* Change Password */}
                          {privacyTab === 'password' && (
                            <div className="space-y-2">
                              <div className="relative">
                                <Lock className="absolute left-3 top-2.5 opacity-30" size={16} />
                                <input type={showPw ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                                  placeholder={lang === 'de' ? 'Neues Passwort' : 'New password'}
                                  className={cn(inputCls, 'pl-9 pr-9')} />
                                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 opacity-40 hover:opacity-80">
                                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                              <div className="relative">
                                <Lock className="absolute left-3 top-2.5 opacity-30" size={16} />
                                <input type={showPw ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                                  placeholder={lang === 'de' ? 'Passwort bestätigen' : 'Confirm new password'}
                                  className={cn(inputCls, 'pl-9')} />
                              </div>
                              <button onClick={handleChangePassword} disabled={privacyLoading || !newPass || !confirmPass}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                {privacyLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {lang === 'de' ? 'Passwort ändern' : 'Change Password'}
                              </button>
                            </div>
                          )}
                        </>
                      )}

                    </div>

                    {/* Sign out */}
                    <div className={cn('px-4 pb-4 border-t pt-3', dk ? 'border-white/10' : 'border-slate-100')}>
                      <button onClick={onSignOut} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg">
                        {lang === 'de' ? 'Abmelden' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={onSignOut} className="ml-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all">
              {lang === 'de' ? 'Abmelden' : 'Sign Out'}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className={cn('flex items-center gap-2 px-4 py-2 rounded-lg border', dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
            <Search size={16} className={cn('flex-shrink-0', dk ? 'text-slate-500' : 'text-slate-400')} />
            <input type="text" placeholder={lang === 'de' ? 'Hotels suchen...' : 'Search hotels...'}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className={cn('flex-1 outline-none bg-transparent text-sm', dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')} />
            {!!searchQuery && (
              <button onClick={() => setSearchQuery('')} className={cn('p-0.5 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}><X size={14} /></button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
