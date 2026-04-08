import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Share2, Bell, Download, Sun, Moon, Settings, X, Check,
  UserPlus, Shield, BookOpen, HelpCircle, Info, Type, Minus, Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  getMyProfile,
  updateMyProfile,
  searchProfiles,
  inviteCollaborator,
  updateCollaboratorPermission,
  removeCollaborator,
} from '../lib/supabase';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSignOut: () => void;
  onExport?: () => void;
  activeHotelIdForShare?: string | null;
  activeHotelNameForShare?: string | null;
  collaborators?: any[];
  onCollaboratorsChanged?: (list: any[] | ((prev: any[]) => any[])) => void;
}

export default function Header({
  theme,
  lang,
  toggleTheme,
  setLang,
  searchQuery,
  setSearchQuery,
  onSignOut,
  onExport,
  activeHotelIdForShare = null,
  activeHotelNameForShare = null,
  collaborators = [],
  onCollaboratorsChanged,
}: HeaderProps) {
  const dk = theme === 'dark';

  const t = {
    share: lang === 'de' ? 'Teilen' : 'Share',
    notifications: lang === 'de' ? 'Benachrichtigungen' : 'Notifications',
    settings: lang === 'de' ? 'Einstellungen' : 'Settings',
    searchHotels: lang === 'de' ? 'Hotels suchen...' : 'Search hotels...',
    linkCopied: lang === 'de' ? 'Link kopiert' : 'Link copied',
    noActiveHotel: lang === 'de' ? 'Kein Hotel ausgewählt' : 'No hotel selected',
    collaborators: lang === 'de' ? 'Mitarbeiter' : 'Collaborators',
    shareLink: lang === 'de' ? 'Link teilen' : 'Share link',
    inviteUser: lang === 'de' ? 'Benutzer einladen' : 'Invite user',
    searchByEmail: lang === 'de' ? 'Suche per E-Mail oder Name...' : 'Search by email or name...',
    noCollaborators: lang === 'de' ? 'Noch keine Mitarbeiter' : 'No collaborators yet',
    profile: lang === 'de' ? 'Profil' : 'Profile',
    language: lang === 'de' ? 'Sprache' : 'Language',
    theme: lang === 'de' ? 'Design' : 'Theme',
    font: lang === 'de' ? 'Schriftart' : 'Font',
    fontSize: lang === 'de' ? 'Schriftgröße' : 'Font size',
    fullName: lang === 'de' ? 'Vollständiger Name' : 'Full name',
    saveProfile: lang === 'de' ? 'Profil speichern' : 'Save profile',
    signOut: lang === 'de' ? 'Abmelden' : 'Sign Out',
    markAllRead: lang === 'de' ? 'Alle gelesen' : 'Mark all read',
    searching: lang === 'de' ? 'Suche...' : 'Searching...',
    invited: lang === 'de' ? 'Benutzer eingeladen' : 'User invited',
    openHotelFirst: lang === 'de' ? 'Öffne zuerst ein Hotel' : 'Open a hotel first',
    invite: lang === 'de' ? 'Einladen' : 'Invite',
    darkMode: lang === 'de' ? 'Dunkelmodus' : 'Dark mode',
    lightMode: lang === 'de' ? 'Hellmodus' : 'Light mode',
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const [notifications] = useState([
    { id: 1, type: 'warning', msg: lang === 'de' ? 'Prüfe bevorstehende Check-outs und freie Betten' : 'Review upcoming check-outs and free beds' },
    { id: 2, type: 'info', msg: lang === 'de' ? 'CSV Export verfügbar' : 'CSV export available' },
  ]);
  const [readIds, setReadIds] = useState<number[]>([]);

  const [profile, setProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [shareQuery, setShareQuery] = useState('');
  const [shareResults, setShareResults] = useState<any[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharePermission, setSharePermission] = useState<'viewer' | 'editor'>('viewer');
  const [shareError, setShareError] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');

  const unread = notifications.filter(n => !readIds.includes(n.id)).length;

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const fontScale = profile?.fontScale ?? 100;
    const fontFamily = profile?.fontFamily ?? 'inter';
    root.style.setProperty('--app-font-scale', `${fontScale}%`);
    const fontMap: Record<string, string> = {
      inter: 'Inter, ui-sans-serif, system-ui, sans-serif',
      geist: 'Arial, ui-sans-serif, system-ui, sans-serif',
      roboto: 'Roboto, ui-sans-serif, system-ui, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    };
    root.style.setProperty('--app-font-family', fontMap[fontFamily] || fontMap.inter);
    document.body.style.fontFamily = fontMap[fontFamily] || fontMap.inter;
    document.body.style.fontSize = `calc(16px * ${fontScale / 100})`;
  }, [profile]);

  const btnCls = cn(
    'p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
  );

  const panelCls = cn(
    'absolute top-full right-0 mt-2 w-80 rounded-xl border shadow-2xl z-50',
    dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
  );

  const itemCls = cn(
    'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all',
    dk ? 'hover:bg-white/5 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
  );

  async function handleNativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeHotelNameForShare ? `EuroTrack – ${activeHotelNameForShare}` : 'EuroTrack',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert(t.linkCopied);
      }
    } catch {}
  }

  async function saveProfile(patch: any) {
    try {
      setSavingProfile(true);
      const updated = await updateMyProfile(patch);
      setProfile(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSearchPeople(value: string) {
    setShareQuery(value);
    setShareError('');
    setShareSuccess('');
    if (!value.trim()) {
      setShareResults([]);
      return;
    }
    try {
      setShareLoading(true);
      const list = await searchProfiles(value);
      setShareResults(list);
    } catch (e: any) {
      setShareError(e.message || 'Search failed');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleInvite(person: any) {
    if (!activeHotelIdForShare) {
      setShareError(t.openHotelFirst);
      return;
    }
    try {
      setShareError('');
      const created = await inviteCollaborator(activeHotelIdForShare, person.id, sharePermission);
      onCollaboratorsChanged?.((prev: any[]) => [...(prev || collaborators || []), created]);
      setShareSuccess(t.invited);
      setShareQuery('');
      setShareResults([]);
    } catch (e: any) {
      setShareError(e.message || 'Invite failed');
    }
  }

  async function handleChangePermission(id: string, permission: 'viewer' | 'editor') {
    try {
      const updated = await updateCollaboratorPermission(id, permission);
      onCollaboratorsChanged?.((prev: any[]) => (prev || collaborators || []).map((c: any) => (c.id === id ? updated : c)));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRemoveCollaborator(id: string) {
    try {
      await removeCollaborator(id);
      onCollaboratorsChanged?.((prev: any[]) => (prev || collaborators || []).filter((c: any) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  const settingsSections = useMemo(() => ([
    { icon: <Shield size={14} />, title: 'Privacy & Security' },
    { icon: <HelpCircle size={14} />, title: 'FAQ' },
    { icon: <BookOpen size={14} />, title: 'User Guide' },
    { icon: <Info size={14} />, title: 'About' },
  ]), []);

  return (
    <header className={cn(
      'border-b sticky top-0 z-40',
      dk ? 'bg-[#0F172A] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900'
    )}>
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className={cn('text-2xl font-black italic', dk ? 'text-white' : 'text-slate-900')}>
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => {
                  setShowShare(!showShare);
                  setShowNotifications(false);
                  setShowSettings(false);
                }}
                className={btnCls}
                title={t.share}
              >
                <Share2 size={18} />
              </button>

              {showShare && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShare(false)} />
                  <div className={cn(panelCls, 'z-50 w-[380px]')}>
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-b',
                      dk ? 'border-white/10' : 'border-slate-100'
                    )}>
                      <div>
                        <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                          {t.collaborators}
                        </p>
                        <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {activeHotelNameForShare || t.noActiveHotel}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleNativeShare}
                          className={cn(
                            'px-2.5 py-1.5 rounded-lg text-xs font-bold border',
                            dk ? 'border-white/10 hover:bg-white/5 text-slate-200' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          )}
                        >
                          {t.shareLink}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className={cn('text-[11px] font-bold uppercase tracking-widest', dk ? 'text-slate-500' : 'text-slate-400')}>
                            {t.inviteUser}
                          </p>

                          <button
                            onClick={() => shareQuery.trim() && shareResults[0] && handleInvite(shareResults[0])}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                          >
                            <UserPlus size={12} />
                            {t.invite}
                          </button>
                        </div>

                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={shareQuery}
                            onChange={e => handleSearchPeople(e.target.value)}
                            placeholder={t.searchByEmail}
                            className={cn(
                              'flex-1 px-3 py-2 rounded-lg text-sm outline-none border',
                              dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                            )}
                          />
                          <select
                            value={sharePermission}
                            onChange={e => setSharePermission(e.target.value as 'viewer' | 'editor')}
                            className={cn(
                              'px-2 py-2 rounded-lg text-sm outline-none border',
                              dk ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                            )}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                        </div>

                        {shareLoading && <p className={cn('text-xs', dk ? 'text-slate-500' : 'text-slate-400')}>{t.searching}</p>}
                        {shareError && <p className="text-xs text-red-400 font-bold">{shareError}</p>}
                        {shareSuccess && <p className="text-xs text-green-400 font-bold">{shareSuccess}</p>}

                        {!!shareResults.length && (
                          <div className="space-y-1 max-h-44 overflow-y-auto mt-2">
                            {shareResults.map((person: any) => (
                              <div
                                key={person.id}
                                className={cn(
                                  'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border',
                                  dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                                )}
                              >
                                <div className="min-w-0">
                                  <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
                                    {person.fullName || 'Unnamed user'}
                                  </p>
                                  <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                                    {person.email}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleInvite(person)}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                                >
                                  <UserPlus size={12} />
                                  {t.invite}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className={cn('text-[11px] font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {t.collaborators}
                        </p>

                        {collaborators.length === 0 ? (
                          <p className={cn('text-sm', dk ? 'text-slate-500' : 'text-slate-400')}>
                            {t.noCollaborators}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {collaborators.map((collab: any) => (
                              <div
                                key={collab.id}
                                className={cn(
                                  'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border',
                                  dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                                )}
                              >
                                <div className="min-w-0">
                                  <p className={cn('text-sm font-bold truncate', dk ? 'text-white' : 'text-slate-900')}>
                                    {collab.profile?.fullName || collab.profile?.email || 'User'}
                                  </p>
                                  <p className={cn('text-xs truncate', dk ? 'text-slate-500' : 'text-slate-400')}>
                                    {collab.profile?.email || collab.sharedWithId}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={collab.permission}
                                    onChange={e => handleChangePermission(collab.id, e.target.value as 'viewer' | 'editor')}
                                    className={cn(
                                      'px-2 py-1.5 rounded-lg text-xs outline-none border',
                                      dk ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                                    )}
                                  >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                  </select>
                                  <button
                                    onClick={() => handleRemoveCollaborator(collab.id)}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-bold text-sm transition-all',
                dk ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700'
              )}
            >
              {lang.toUpperCase()}
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowSettings(false);
                  setShowShare(false);
                }}
                className={btnCls}
                title={t.notifications}
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {unread}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className={cn(panelCls, 'z-50')}>
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-b',
                      dk ? 'border-white/10' : 'border-slate-100'
                    )}>
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {t.notifications}
                      </p>
                      <button onClick={() => setReadIds(notifications.map(n => n.id))} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
                        {t.markAllRead}
                      </button>
                    </div>

                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => setReadIds(prev => [...new Set([...prev, n.id])])}
                          className={cn(
                            'px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all flex items-start gap-2',
                            readIds.includes(n.id)
                              ? dk ? 'text-slate-500' : 'text-slate-400'
                              : dk ? 'bg-white/5 text-slate-100' : 'bg-slate-50 text-slate-700',
                            dk ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          )}
                        >
                          <span className={n.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}>
                            {n.type === 'warning' ? '⚠' : 'ℹ'}
                          </span>
                          <span className="flex-1">{n.msg}</span>
                          {!readIds.includes(n.id) && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={onExport} className={btnCls} title="Export CSV">
              <Download size={18} />
            </button>

            <button onClick={toggleTheme} className={btnCls} title={dk ? t.lightMode : t.darkMode}>
              {dk ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowNotifications(false);
                  setShowShare(false);
                }}
                className={btnCls}
                title={t.settings}
              >
                <Settings size={18} />
              </button>

              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className={cn(panelCls, 'z-50')}>
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-b',
                      dk ? 'border-white/10' : 'border-slate-100'
                    )}>
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {t.settings}
                      </p>
                      <button onClick={() => setShowSettings(false)} className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                        <X size={14} />
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {t.profile}
                        </p>
                        <input
                          type="text"
                          value={profile?.fullName || ''}
                          onChange={(e) => setProfile((p: any) => ({ ...p, fullName: e.target.value }))}
                          placeholder={t.fullName}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg text-sm outline-none border',
                            dk ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                          )}
                        />
                        <button
                          onClick={() => saveProfile({ fullName: profile?.fullName || '' })}
                          className="mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1"
                        >
                          {savingProfile ? '...' : <Check size={12} />}
                          {t.saveProfile}
                        </button>
                      </div>

                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {t.language}
                        </p>
                        <div className="flex gap-2">
                          {(['de', 'en'] as const).map(l => (
                            <button
                              key={l}
                              onClick={() => setLang(l)}
                              className={cn(
                                'flex-1 py-2 rounded-lg text-sm font-bold border transition-all',
                                lang === l ? 'bg-blue-600 text-white border-blue-600' : dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                              )}
                            >
                              {l === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {t.theme}
                        </p>
                        <button
                          onClick={toggleTheme}
                          className={cn(
                            'w-full py-2 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2',
                            dk ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {dk ? <><Sun size={14} /> {t.lightMode}</> : <><Moon size={14} /> {t.darkMode}</>}
                        </button>
                      </div>

                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1', dk ? 'text-slate-500' : 'text-slate-400')}>
                          <Type size={12} /> {t.font}
                        </p>
                        <select
                          value={profile?.fontFamily || 'inter'}
                          onChange={e => {
                            setProfile((p: any) => ({ ...p, fontFamily: e.target.value }));
                            saveProfile({ fontFamily: e.target.value });
                          }}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg text-sm outline-none border',
                            dk ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          )}
                        >
                          <option value="inter">Inter</option>
                          <option value="geist">Arial</option>
                          <option value="roboto">Roboto</option>
                          <option value="mono">Mono</option>
                        </select>
                      </div>

                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
                          {t.fontSize}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveProfile({ fontScale: Math.max(85, (profile?.fontScale || 100) - 5) })}
                            className={cn('p-2 rounded-lg border', dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50')}
                          >
                            <Minus size={14} />
                          </button>
                          <div className={cn('flex-1 text-center py-2 rounded-lg border text-sm font-bold', dk ? 'border-white/10 text-white' : 'border-slate-200 text-slate-900')}>
                            {profile?.fontScale || 100}%
                          </div>
                          <button
                            onClick={() => saveProfile({ fontScale: Math.min(135, (profile?.fontScale || 100) + 5) })}
                            className={cn('p-2 rounded-lg border', dk ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50')}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {settingsSections.map((section, idx) => (
                          <button key={idx} className={itemCls}>
                            <span className="inline-flex items-center gap-2">
                              {section.icon}
                              {section.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={onSignOut} className="ml-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all">
              {t.signOut}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg border',
            dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
          )}>
            <Search size={16} className={cn('flex-shrink-0', dk ? 'text-slate-500' : 'text-slate-400')} />
            <input
              type="text"
              placeholder={t.searchHotels}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn('flex-1 outline-none bg-transparent text-sm', dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')}
            />
            {!!searchQuery && (
              <button onClick={() => setSearchQuery('')} className={cn('p-0.5 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
