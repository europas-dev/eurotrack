import React, { useState } from 'react';
import { Search, Share2, Bell, Download, Sun, Moon, Settings, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSignOut: () => void;
  onExport?: () => void;
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
}: HeaderProps) {
  const dk = theme === 'dark';
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications] = useState([
    { id: 1, type: 'warning', msg: lang === 'de' ? 'NH Hotel: 3 freie Betten diese Woche' : 'NH Hotel: 3 free beds this week' },
    { id: 2, type: 'info', msg: lang === 'de' ? 'Export abgeschlossen' : 'Export completed' },
  ]);
  const [readIds, setReadIds] = useState<number[]>([]);

  const unread = notifications.filter(n => !readIds.includes(n.id)).length;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'EuroTrack', url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert(lang === 'de' ? 'Link kopiert!' : 'Link copied to clipboard!');
      }
    } catch (e) {}
  };

  const btnCls = cn(
    'p-2 rounded-lg transition-all relative',
    dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
  );

  const panelCls = cn(
    'absolute top-full right-0 mt-2 w-80 rounded-xl border shadow-2xl z-50',
    dk ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'
  );

  return (
    <header className={cn('border-b sticky top-0 z-40', dk ? 'bg-[#0F172A] border-white/5' : 'bg-white border-slate-200')}>
      <div className="px-6 py-3">
        {/* Top Row */}
        <div className="flex items-center justify-between">
          <div className="text-2xl font-black italic">
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>

          <div className="flex items-center gap-1">

            {/* Share */}
            <button onClick={handleShare} className={btnCls} title={lang === 'de' ? 'Teilen' : 'Share'}>
              <Share2 size={18} />
            </button>

            {/* Language */}
            <button
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className={cn('px-3 py-1.5 rounded-lg font-bold text-sm transition-all',
                dk ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600')}
            >
              {lang.toUpperCase()}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
                className={btnCls} title={lang === 'de' ? 'Benachrichtigungen' : 'Notifications'}>
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
                    <div className={cn('flex items-center justify-between px-4 py-3 border-b',
                      dk ? 'border-white/10' : 'border-slate-100')}>
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {lang === 'de' ? 'Benachrichtigungen' : 'Notifications'}
                      </p>
                      <button onClick={() => setReadIds(notifications.map(n => n.id))}
                        className="text-xs text-blue-400 hover:text-blue-300 font-bold">
                        {lang === 'de' ? 'Alle gelesen' : 'Mark all read'}
                      </button>
                    </div>
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      {notifications.map(n => (
                        <div key={n.id}
                          onClick={() => setReadIds(p => [...p, n.id])}
                          className={cn('px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all flex items-start gap-2',
                            readIds.includes(n.id)
                              ? dk ? 'text-slate-500' : 'text-slate-400'
                              : dk ? 'bg-white/5 text-slate-200' : 'bg-slate-50 text-slate-700',
                            dk ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          )}>
                          <span className={n.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}>
                            {n.type === 'warning' ? '⚠' : 'ℹ'}
                          </span>
                          {n.msg}
                          {!readIds.includes(n.id) && (
                            <span className="ml-auto w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Export / Download */}
            <button onClick={onExport}
              className={btnCls} title={lang === 'de' ? 'Exportieren' : 'Export CSV'}>
              <Download size={18} />
            </button>

            {/* Theme toggle */}
            <button onClick={toggleTheme} className={btnCls}
              title={dk ? 'Light mode' : 'Dark mode'}>
              {dk ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Settings */}
            <div className="relative">
              <button onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
                className={btnCls} title={lang === 'de' ? 'Einstellungen' : 'Settings'}>
                <Settings size={18} />
              </button>

              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className={cn(panelCls, 'z-50')}>
                    <div className={cn('flex items-center justify-between px-4 py-3 border-b',
                      dk ? 'border-white/10' : 'border-slate-100')}>
                      <p className={cn('text-sm font-black', dk ? 'text-white' : 'text-slate-900')}>
                        {lang === 'de' ? 'Einstellungen' : 'Settings'}
                      </p>
                      <button onClick={() => setShowSettings(false)}
                        className={cn('p-1 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2',
                          dk ? 'text-slate-500' : 'text-slate-400')}>
                          {lang === 'de' ? 'Sprache' : 'Language'}
                        </p>
                        <div className="flex gap-2">
                          {(['de', 'en'] as const).map(l => (
                            <button key={l} onClick={() => setLang(l)}
                              className={cn('flex-1 py-2 rounded-lg text-sm font-bold border transition-all',
                                lang === l
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              )}>
                              {l === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className={cn('text-xs font-bold uppercase tracking-widest mb-2',
                          dk ? 'text-slate-500' : 'text-slate-400')}>
                          {lang === 'de' ? 'Design' : 'Theme'}
                        </p>
                        <button onClick={toggleTheme}
                          className={cn('w-full py-2 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2',
                            dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                          {dk ? <><Sun size={14} /> {lang === 'de' ? 'Hell' : 'Light mode'}</> : <><Moon size={14} /> {lang === 'de' ? 'Dunkel' : 'Dark mode'}</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sign out */}
            <button onClick={onSignOut}
              className="ml-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all">
              {lang === 'de' ? 'Abmelden' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="mt-3">
          <div className={cn('flex items-center gap-2 px-4 py-2 rounded-lg border',
            dk ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')}>
            <Search size={16} className="opacity-40 flex-shrink-0" />
            <input
              type="text"
              placeholder={lang === 'de' ? 'Hotels suchen...' : 'Search hotels...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn('flex-1 outline-none bg-transparent text-sm',
                dk ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400')}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className={cn('p-0.5 rounded', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
