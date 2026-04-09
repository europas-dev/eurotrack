// src/components/ShareModal.tsx
import React, { useState, useEffect } from 'react'
import { X, UserPlus, Shield, Eye, Edit3, Trash2, Check, Loader2, Mail } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  searchProfiles, inviteCollaborator,
  updateCollaboratorPermission, removeCollaborator,
  getMyProfile,
} from '../lib/supabase'

interface ShareModalProps {
  isDarkMode: boolean
  lang?: 'de' | 'en'
  onClose: () => void
}

export default function ShareModal({ isDarkMode, lang = 'de', onClose }: ShareModalProps) {
  const dk = isDarkMode
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<any[]>([])
  const [searching, setSearching]       = useState(false)
  const [permission, setPermission]     = useState<'viewer' | 'editor'>('viewer')
  const [inviting, setInviting]         = useState<string | null>(null)
  const [success, setSuccess]           = useState('')
  const [err, setErr]                   = useState('')

  const t = {
    title:       lang === 'de' ? 'Teilen & Zusammenarbeiten' : 'Share & Collaborate',
    subtitle:    lang === 'de' ? 'Lade Personen ein, diesen Workspace anzusehen oder zu bearbeiten.' : 'Invite people to view or edit this workspace.',
    searchLabel: lang === 'de' ? 'E-Mail oder Name suchen...' : 'Search by email or name...',
    viewer:      lang === 'de' ? 'Nur ansehen' : 'View only',
    editor:      lang === 'de' ? 'Bearbeiten' : 'Can edit',
    invite:      lang === 'de' ? 'Einladen' : 'Invite',
    current:     lang === 'de' ? 'Aktuelle Mitglieder' : 'Current members',
    noMembers:   lang === 'de' ? 'Noch keine Mitglieder eingeladen.' : 'No members invited yet.',
    remove:      lang === 'de' ? 'Entfernen' : 'Remove',
    close:       lang === 'de' ? 'Schließen' : 'Close',
    noResults:   lang === 'de' ? 'Keine Ergebnisse' : 'No results found',
    you:         lang === 'de' ? '(Du)' : '(You)',
  }

  useEffect(() => {
    getMyProfile().then((me: any) => {
      // seed with current user so they see themselves first
      setCollaborators(me ? [{ ...me, role: 'owner' }] : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchProfiles(query)
        setResults(res ?? [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  async function handleInvite(user: any) {
    setErr('')
    setInviting(user.id)
    try {
      await inviteCollaborator(user.id, permission)
      setCollaborators(p => [...p, { ...user, role: permission }])
      setSuccess(lang === 'de' ? `${user.email} eingeladen!` : `${user.email} invited!`)
      setQuery('')
      setResults([])
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setErr(e?.message || 'Failed to invite')
    } finally {
      setInviting(null)
    }
  }

  async function handleChangeRole(userId: string, newRole: 'viewer' | 'editor') {
    try {
      await updateCollaboratorPermission(userId, newRole)
      setCollaborators(p => p.map(c => c.id === userId ? { ...c, role: newRole } : c))
    } catch {}
  }

  async function handleRemove(userId: string) {
    try {
      await removeCollaborator(userId)
      setCollaborators(p => p.filter(c => c.id !== userId))
    } catch {}
  }

  const surface = dk ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm outline-none border transition-all',
    dk ? 'bg-white/5 border-white/10 focus:border-blue-500 text-white placeholder-slate-500'
       : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn('w-full max-w-md rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]', surface)}>

        {/* Header */}
        <div className={cn('flex items-center justify-between px-5 py-4 border-b', dk ? 'border-white/10' : 'border-slate-100')}>
          <div>
            <h2 className="text-base font-black">{t.title}</h2>
            <p className={cn('text-xs mt-0.5', dk ? 'text-slate-400' : 'text-slate-500')}>{t.subtitle}</p>
          </div>
          <button onClick={onClose} className={cn('p-2 rounded-lg transition-all', dk ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Search + permission */}
          <div className="space-y-2">
            <div className="relative">
              <Mail size={14} className={cn('absolute left-3 top-1/2 -translate-y-1/2', dk ? 'text-slate-500' : 'text-slate-400')} />
              <input
                className={cn(inputCls, 'pl-8')}
                placeholder={t.searchLabel}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
            </div>

            {/* Role selector */}
            <div className="flex gap-2">
              {(['viewer','editor'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setPermission(role)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5',
                    permission === role
                      ? 'bg-blue-600 text-white border-blue-600'
                      : dk ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {role === 'viewer' ? <Eye size={12} /> : <Edit3 size={12} />}
                  {role === 'viewer' ? t.viewer : t.editor}
                </button>
              ))}
            </div>

            {/* Search results */}
            {results.length > 0 && (
              <div className={cn('rounded-xl border divide-y', dk ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100')}>
                {results.map(u => (
                  <div key={u.id} className={cn('flex items-center justify-between px-3 py-2', dk ? 'hover:bg-white/5' : 'hover:bg-slate-50')}>
                    <div>
                      <p className="text-xs font-bold">{u.full_name || u.email}</p>
                      <p className={cn('text-[10px]', dk ? 'text-slate-500' : 'text-slate-400')}>{u.email}</p>
                    </div>
                    <button
                      onClick={() => handleInvite(u)}
                      disabled={!!inviting || collaborators.some(c => c.id === u.id)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-40',
                        'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                    >
                      {inviting === u.id ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
                      {collaborators.some(c => c.id === u.id) ? (lang === 'de' ? 'Bereits eingeladen' : 'Already added') : t.invite}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {query.length > 1 && !searching && results.length === 0 && (
              <p className={cn('text-xs text-center py-2', dk ? 'text-slate-500' : 'text-slate-400')}>{t.noResults}</p>
            )}
          </div>

          {/* Feedback */}
          {success && <p className="text-green-400 text-xs font-bold">{success}</p>}
          {err     && <p className="text-red-400 text-xs font-bold">{err}</p>}

          {/* Current members */}
          <div>
            <p className={cn('text-[10px] font-black uppercase tracking-widest mb-2', dk ? 'text-slate-500' : 'text-slate-400')}>
              {t.current}
            </p>

            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-blue-500" />
              </div>
            )}

            {!loading && collaborators.length === 0 && (
              <p className={cn('text-xs text-center py-4', dk ? 'text-slate-500' : 'text-slate-400')}>{t.noMembers}</p>
            )}

            <div className="space-y-1">
              {collaborators.map(c => (
                <div key={c.id} className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-xl',
                  dk ? 'bg-white/5' : 'bg-slate-50'
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
                      dk ? 'bg-blue-600/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                    )}>
                      {(c.full_name || c.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{c.full_name || c.email}</p>
                      <p className={cn('text-[10px] truncate', dk ? 'text-slate-500' : 'text-slate-400')}>{c.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.role === 'owner' ? (
                      <span className={cn('text-[10px] font-black uppercase px-2 py-0.5 rounded-full', dk ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-600')}>
                        Owner
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleChangeRole(c.id, c.role === 'viewer' ? 'editor' : 'viewer')}
                          title={lang === 'de' ? 'Berechtigung ändern' : 'Change role'}
                          className={cn(
                            'text-[10px] font-black uppercase px-2 py-0.5 rounded-full transition-all',
                            c.role === 'editor'
                              ? dk ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-green-100 text-green-700 hover:bg-green-200'
                              : dk ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'       : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          )}
                        >
                          {c.role === 'editor' ? (lang === 'de' ? 'Bearbeiten' : 'Editor') : (lang === 'de' ? 'Ansehen' : 'Viewer')}
                        </button>
                        <button
                          onClick={() => handleRemove(c.id)}
                          title={t.remove}
                          className={cn('p-1 rounded-lg transition-all', dk ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn('px-5 py-3 border-t', dk ? 'border-white/10' : 'border-slate-100')}>
          <button onClick={onClose} className={cn(
            'w-full py-2 rounded-xl text-sm font-bold border transition-all',
            dk ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          )}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
