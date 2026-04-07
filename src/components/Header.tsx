// src/components/Header.tsx
import React from 'react';
import { Search, Filter, ArrowUpDown, Share2, Globe, Bell, Download, Sun, Moon, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  theme: 'dark' | 'light';
  lang: 'de' | 'en';
  toggleTheme: () => void;
  setLang: (l: 'de' | 'en') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSignOut: () => void;
}

export default function Header({
  theme,
  lang,
  toggleTheme,
  setLang,
  searchQuery,
  setSearchQuery,
  onSignOut
}: HeaderProps) {
  return (
    <header className={cn(
      "border-b sticky top-0 z-40",
      theme === 'dark' 
        ? "bg-[#0F172A] border-white/5" 
        : "bg-white border-slate-200"
    )}>
      <div className="px-8 py-4">
        {/* Top Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-black italic">
            Euro<span className="text-[#EAB308]">Track.</span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-600"
              )}
              title="Share"
            >
              <Share2 size={20} />
            </button>

            <button
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className={cn(
                "px-3 py-2 rounded-lg font-bold text-sm transition-all",
                theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              {lang.toUpperCase()}
            </button>

            <button 
              className={cn(
                "p-2 rounded-lg transition-all relative",
                theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-600"
              )}
              title="Notifications"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <button 
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-600"
              )}
              title="Export"
            >
              <Download size={20} />
            </button>

            <button
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-600"
              )}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button 
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-600"
              )}
              title="Settings"
            >
              <Settings size={20} />
            </button>

            <button
              onClick={onSignOut}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all"
            >
              {lang === 'de' ? 'Abmelden' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex-1 flex items-center gap-2 px-4 py-2 rounded-lg",
            theme === 'dark' ? "bg-white/5 border border-white/10" : "bg-slate-100 border border-slate-200"
          )}>
            <Search size={18} className="opacity-50" />
            <input
              type="text"
              placeholder={lang === 'de' ? 'Hotels suchen...' : 'Search hotels...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "flex-1 outline-none bg-transparent text-sm",
                theme === 'dark' ? "text-white placeholder-slate-500" : "text-slate-900 placeholder-slate-400"
              )}
            />
          </div>

          <button className={cn(
            "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all",
            theme === 'dark'
              ? "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
              : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900"
          )}>
            <Filter size={18} />
            {lang === 'de' ? 'Filter' : 'Filter'}
          </button>

          <button className={cn(
            "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all",
            theme === 'dark'
              ? "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
              : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900"
          )}>
            <ArrowUpDown size={18} />
            {lang === 'de' ? 'Sortieren' : 'Sort'}
          </button>
        </div>
      </div>
    </header>
  );
}
