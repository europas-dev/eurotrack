// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Auth ──────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ─── Roles ─────────────────────────────────────────────────────────────────
export type UserRole = 'superadmin' | 'admin' | 'editor' | 'viewer' | 'pending'

export type AccessLevel =
  | { role: 'superadmin' }
  | { role: 'admin' }
  | { role: 'editor' }
  | { role: 'viewer' }
  | { role: 'pending' }

export async function getMyAccessLevel(): Promise<AccessLevel> {
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { role: 'pending' }

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[getMyAccessLevel] DB error:', error.message)
      return { role: 'pending' }
    }

    const role = (data as any)?.role as UserRole | null
    if (role === 'superadmin') return { role: 'superadmin' }
    if (role === 'admin')      return { role: 'admin' }
    if (role === 'editor')     return { role: 'editor' }
    if (role === 'viewer')     return { role: 'viewer' }
    return { role: 'pending' }
  } catch (e) {
    console.error('[getMyAccessLevel] unexpected error:', e)
    return { role: 'pending' }
  }
}

// ─── User management (superadmin only) ────────────────────────────────────
export async function getAllUsers(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, username, role, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((p: any) => ({ ...p, fullName: p.full_name ?? '' }))
}

/**
 * setUserRole
 *
 * Strategy (tried in order):
 *   1. Call the `set_user_role` Postgres RPC (SECURITY DEFINER — bypasses RLS).
 *      → This is the RECOMMENDED path. See SUPABASE_SETUP.md to create it.
 *   2. If RPC is not found (code PGRST202), fall back to a direct UPDATE.
 *      The direct UPDATE only succeeds if the RLS policy allows it
 *      (see SUPABASE_SETUP.md for the policy).
 *
 * After a successful change the function verifies the DB value actually
 * changed and throws if it didn't (so the UI can show a real error rather
 * than silently reverting).
 */
export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  // ── 1. Try RPC ───────────────────────────────────────────────────────────
  const { error: rpcErr } = await supabase.rpc('set_user_role', {
    target_id: userId,
    new_role:  role,
  })

  if (rpcErr) {
    // PGRST202 = function not found → fall through to direct UPDATE
    if (!rpcErr.code?.startsWith('PGRST202') && rpcErr.code !== '42883') {
      // Any other RPC error (e.g. permission denied inside the function)
      throw new Error(`Role change failed (RPC): ${rpcErr.message}`)
    }
    // ── 2. Fallback: direct UPDATE ──────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (updateErr) {
      throw new Error(
        `Role change failed. Please create the set_user_role function in Supabase. ` +
        `Details: ${updateErr.message}`
      )
    }
  }

  // ── 3. Verify the change actually landed ────────────────────────────────
  const { data: check } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (check && (check as any).role !== role) {
    throw new Error(
      `Database did not accept the role change (RLS policy likely blocking it). ` +
      `Current role is still '${(check as any).role}'. ` +
      `See SUPABASE_SETUP.md to fix RLS policies or add the set_user_role function.`
    )
  }
}

// ─── Profiles ──────────────────────────────────────────────────────────────
export async function getMyProfile() {
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return null

    const { data: row } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, role, font_family, font_size, avatar')
      .eq('id', user.id)
      .maybeSingle()

    const fullName   = row?.full_name   ?? user.user_metadata?.full_name  ?? user.user_metadata?.name ?? ''
    const username   = row?.username    ?? user.user_metadata?.username   ?? ''
    const fontFamily = row?.font_family ?? user.user_metadata?.fontFamily ?? 'inter'
    const fontSize   = row?.font_size   ?? user.user_metadata?.fontSize   ?? 16
    const avatar     = row?.avatar      ?? user.user_metadata?.avatar     ?? null

    return {
      id:         user.id,
      email:      row?.email ?? user.email ?? '',
      full_name:  fullName,
      fullName,
      username,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      avatar,
      fontFamily,
      fontSize,
      role: (row?.role as UserRole) ?? 'pending',
    }
  } catch { return null }
}

export async function updateMyProfile(updates: {
  full_name?:  string
  fullName?:   string
  username?:   string
  avatar_url?: string
  avatar?:     string | null
  fontFamily?: string
  fontSize?:   number
  fontScale?:  number // legacy compat
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fullName = updates.full_name ?? updates.fullName

  // ── 1. profiles table (canonical) ────────────────────────────────────────
  const rowPatch: Record<string, any> = {}
  if (fullName           !== undefined) rowPatch.full_name   = fullName
  if (updates.username   !== undefined) rowPatch.username    = updates.username
  if (updates.avatar     !== undefined) rowPatch.avatar      = updates.avatar
  if (updates.fontFamily !== undefined) rowPatch.font_family = updates.fontFamily
  if (updates.fontSize   !== undefined) rowPatch.font_size   = updates.fontSize

  if (Object.keys(rowPatch).length > 0) {
    const { error: rowErr } = await supabase
      .from('profiles')
      .update(rowPatch)
      .eq('id', user.id)
    if (rowErr) console.warn('[updateMyProfile] profiles update warn:', rowErr.message)
  }

  // ── 2. auth user_metadata (fallback mirror) ───────────────────────────────
  const metaPatch: Record<string, any> = {}
  if (fullName           !== undefined) metaPatch.full_name  = fullName
  if (updates.username   !== undefined) metaPatch.username   = updates.username
  if (updates.avatar     !== undefined) metaPatch.avatar     = updates.avatar
  if (updates.fontFamily !== undefined) metaPatch.fontFamily = updates.fontFamily
  if (updates.fontSize   !== undefined) metaPatch.fontSize   = updates.fontSize

  if (Object.keys(metaPatch).length > 0) {
    const { error: authErr } = await supabase.auth.updateUser({ data: metaPatch })
    if (authErr) console.warn('[updateMyProfile] auth metadata warn:', authErr.message)
  }

  return getMyProfile()
}

// ─── Security: username ────────────────────────────────────────────────────
export async function updateMyUsername(newUsername: string): Promise<void> {
  const trimmed = newUsername.trim()
  if (!trimmed) throw new Error('Username cannot be empty')
  if (trimmed.length < 3) throw new Error('Username must be at least 3 characters')
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) throw new Error('Username: only letters, numbers, _ . -')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('profiles').select('id').eq('username', trimmed).neq('id', user.id).maybeSingle()
  if (existing) throw new Error('This username is already taken')

  const { error: dbErr } = await supabase
    .from('profiles').update({ username: trimmed }).eq('id', user.id)
  if (dbErr) throw dbErr

  await supabase.auth.updateUser({ data: { username: trimmed } })
}

// ─── Security: email ───────────────────────────────────────────────────────
export async function updateMyEmail(newEmail: string): Promise<void> {
  const trimmed = newEmail.trim()
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    throw new Error('Please enter a valid email address')

  const { error } = await supabase.auth.updateUser({ email: trimmed })
  if (error) throw error
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await supabase.from('profiles').update({ email: trimmed }).eq('id', user.id)
}

// ─── Security: password ────────────────────────────────────────────────────
export async function updateMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 6) throw new Error('New password must be at least 6 characters')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) throw new Error('Could not determine current email')

  const { error: reAuthErr } = await supabase.auth.signInWithPassword({
    email: user.email, password: currentPassword,
  })
  if (reAuthErr) throw new Error('Current password is incorrect')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ─── Security: password reset email ───────────────────────────────────────
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}

// ─── Access: grant / change user role (admin / superadmin) ────────────────
export async function grantUserAccess(
  userId: string,
  role: 'viewer' | 'editor' | 'admin',
): Promise<void> {
  await setUserRole(userId, role)
}

export async function searchProfiles(query: string): Promise<any[]> {
  if (!query || query.trim().length < 2) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, role')
      .or(`email.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
      .neq('id', user?.id ?? '')
      .limit(10)
    if (error) return []
    return (data ?? []).map((p: any) => ({ ...p, fullName: p.full_name ?? '', avatar_url: null }))
  } catch { return [] }
}

// ─── Collaborators ─────────────────────────────────────────────────────────
export async function inviteCollaborator(userId: string, role: 'viewer' | 'editor'): Promise<any> {
  await grantUserAccess(userId, role)
}
export async function updateCollaboratorPermission(userId: string, role: 'viewer' | 'editor' | 'admin'): Promise<any> {
  await grantUserAccess(userId, role)
}
export async function removeCollaborator(userId: string): Promise<void> {
  await setUserRole(userId, 'pending')
}
export async function getCollaborators(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, role, created_at')
      .in('role', ['admin', 'editor', 'viewer'])
      .order('created_at', { ascending: true })
    if (error) return []
    return (data ?? []).map((p: any) => ({
      id: p.id, userId: p.id, role: p.role,
      email: p.email ?? '', fullName: p.full_name ?? '',
      username: p.username ?? '', full_name: p.full_name ?? '',
      avatar_url: null,
    }))
  } catch { return [] }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function normaliseCompanyTag(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.filter(Boolean) } catch {}
    return raw ? [raw] : []
  }
  return []
}
function serialiseCompanyTag(tags: string[]): string | null {
  if (!tags || tags.length === 0) return null
  return JSON.stringify(tags)
}
function normalizeEmployee(e: any): any {
  if (!e || typeof e !== 'object') return null
  return { ...e,
    durationId: e.durationid ?? e.durationId,
    slotIndex:  e.slotindex  ?? e.slotIndex,
    checkIn:    e.checkin    ?? e.checkIn,
    checkOut:   e.checkout   ?? e.checkOut,
  }
}
function normalizeDuration(d: any): any {
  if (!d || typeof d !== 'object') return null
  return { ...d,
    hotelId:              d.hotelid              ?? d.hotelId,
    startDate:            d.startdate            ?? d.startDate,
    endDate:              d.enddate              ?? d.endDate,
    roomType:             d.roomtype             ?? d.roomType,
    numberOfRooms:        d.numberofrooms        ?? d.numberOfRooms,
    pricePerNightPerRoom: d.pricepernightperroom ?? d.pricePerNightPerRoom,
    useManualPrices:      d.usemanualprices      ?? d.useManualPrices      ?? false,
    nightlyPrices:        d.nightlyprices        ?? d.nightlyPrices        ?? {},
    autoDistribute:       d.autodistribute       ?? d.autoDistribute       ?? false,
    useBruttoNetto:       d.usebruttonetto       ?? d.useBruttoNetto       ?? false,
    brutto:               d.brutto               ?? null,
    netto:                d.netto                ?? null,
    mwst:                 d.mwst                 ?? null,
    hasDiscount:          d.hasdiscount          ?? d.hasDiscount          ?? false,
    discountType:         d.discounttype         ?? d.discountType         ?? 'percentage',
    discountValue:        d.discountvalue        ?? d.discountValue        ?? 0,
    isPaid:               d.ispaid               ?? d.isPaid               ?? false,
    rechnungNr:           d.rechnungnr           ?? d.rechnungNr,
    bookingId:            d.bookingid            ?? d.bookingId,
    depositEnabled:       d.depositenabled       ?? d.depositEnabled       ?? false,
    depositAmount:        d.depositamount        ?? d.depositAmount,
    extensionNote:        d.extensionnote        ?? d.extensionNote,
    employees: (d.employees ?? []).map(normalizeEmployee).filter(Boolean),
  }
}
function normalizeHotel(h: any): any {
  if (!h || typeof h !== 'object') return null
  const rawTag = h.companytag ?? h.companyTag ?? null
  return { ...h,
    companyTag:    normaliseCompanyTag(rawTag),
    contactPerson: h.contactperson ?? h.contactPerson ?? '',
    webLink:       h.weblink       ?? h.webLink       ?? '',
    phone:         h.phone         ?? '',
    notes:         h.notes         ?? '',
    lastUpdatedBy: h.lastupdatedby ?? h.lastUpdatedBy ?? '',
    lastUpdatedAt: h.lastupdatedat ?? h.lastUpdatedAt ?? '',
    durations: (h.durations ?? []).map(normalizeDuration).filter(Boolean),
  }
}

// ─── Hotels ────────────────────────────────────────────────────────────────
export async function getHotels() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('hotels')
    .select('*, durations(*, employees(*))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeHotel).filter(Boolean)
}
export async function createHotel(data: {
  name: string; city?: string | null; companyTag?: string[] | string | null
  address?: string | null; contactPerson?: string | null; phone?: string | null
  email?: string | null; webLink?: string | null; notes?: string | null
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const tags = Array.isArray(data.companyTag) ? data.companyTag : (data.companyTag ? [data.companyTag] : [])
  const { data: result, error } = await supabase
    .from('hotels')
    .insert({
      name: data.name, city: data.city ?? null,
      companytag:    serialiseCompanyTag(tags),
      address:       data.address       ?? null,
      contactperson: data.contactPerson ?? null,
      phone:         data.phone         ?? null,
      email:         data.email         ?? null,
      weblink:       data.webLink       ?? null,
      notes:         data.notes         ?? null,
      lastupdatedat: new Date().toISOString(),
      lastupdatedby: user.email ?? user.id,
    })
    .select().single()
  if (error) throw error
  if (!result) throw new Error('Hotel created but no data returned')
  return normalizeHotel({ ...result, durations: [] })
}
export async function updateHotel(id: string, data: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const rawTag = data.companyTag ?? data.companytag ?? null
  const tags = Array.isArray(rawTag) ? rawTag : (rawTag ? [rawTag] : [])
  const { error } = await supabase.from('hotels').update({
    name: data.name, city: data.city ?? null,
    companytag:    serialiseCompanyTag(tags),
    address:       data.address       ?? null,
    contactperson: data.contactPerson ?? data.contactperson ?? null,
    phone:         data.phone         ?? null,
    email:         data.email         ?? null,
    weblink:       data.webLink       ?? data.weblink ?? null,
    notes:         data.notes         ?? null,
    lastupdatedat: new Date().toISOString(),
    lastupdatedby: user.email ?? user.id,
  }).eq('id', id)
  if (error) throw error
}
export async function deleteHotel(id: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', id)
  if (error) throw error
}

// ─── Durations ─────────────────────────────────────────────────────────────
export async function createDuration(data: any) {
  const { data: result, error } = await supabase
    .from('durations')
    .insert({
      hotelid:              data.hotelId,
      startdate:            data.startDate            ?? '',
      enddate:              data.endDate              ?? '',
      roomtype:             data.roomType             ?? 'DZ',
      numberofrooms:        data.numberOfRooms        ?? 1,
      pricepernightperroom: data.pricePerNightPerRoom ?? 0,
      usemanualprices:      data.useManualPrices      ?? false,
      nightlyprices:        data.nightlyPrices        ?? {},
      autodistribute:       data.autoDistribute       ?? false,
      usebruttonetto:       data.useBruttoNetto       ?? false,
      brutto:               data.brutto               ?? null,
      netto:                data.netto                ?? null,
      mwst:                 data.mwst                 ?? null,
      hasdiscount:          data.hasDiscount          ?? false,
      discounttype:         data.discountType         ?? 'percentage',
      discountvalue:        data.discountValue        ?? 0,
      ispaid:               data.isPaid               ?? false,
      rechnungnr:           data.rechnungNr           ?? null,
      bookingid:            data.bookingId            ?? null,
      depositenabled:       data.depositEnabled       ?? false,
      depositamount:        data.depositAmount        ?? null,
      extensionnote:        data.extensionNote        ?? null,
    })
    .select().single()
  if (error) throw error
  if (!result) throw new Error('Duration created but no data returned')
  return normalizeDuration({ ...result, employees: [] })
}
export async function updateDuration(id: string, data: any) {
  const { error } = await supabase.from('durations').update({
    startdate:            data.startDate            ?? data.startdate,
    enddate:              data.endDate              ?? data.enddate,
    roomtype:             data.roomType             ?? data.roomtype,
    numberofrooms:        data.numberOfRooms        ?? data.numberofrooms,
    pricepernightperroom: data.pricePerNightPerRoom ?? data.pricepernightperroom,
    usemanualprices:      data.useManualPrices      ?? data.usemanualprices      ?? false,
    nightlyprices:        data.nightlyPrices        ?? data.nightlyprices        ?? {},
    autodistribute:       data.autoDistribute       ?? data.autodistribute       ?? false,
    usebruttonetto:       data.useBruttoNetto       ?? data.usebruttonetto       ?? false,
    brutto:               data.brutto               ?? null, netto: data.netto ?? null, mwst: data.mwst ?? null,
    hasdiscount:          data.hasDiscount          ?? data.hasdiscount          ?? false,
    discounttype:         data.discountType         ?? data.discounttype         ?? 'percentage',
    discountvalue:        data.discountValue        ?? data.discountvalue        ?? 0,
    ispaid:               data.isPaid               ?? data.ispaid               ?? false,
    rechnungnr:           data.rechnungNr           ?? data.rechnungnr           ?? null,
    bookingid:            data.bookingId            ?? data.bookingid            ?? null,
    depositenabled:       data.depositEnabled       ?? data.depositenabled       ?? false,
    depositamount:        data.depositAmount        ?? data.depositamount        ?? null,
    extensionnote:        data.extensionNote        ?? data.extensionnote        ?? null,
  }).eq('id', id)
  if (error) throw error
}
export async function deleteDuration(id: string) {
  const { error } = await supabase.from('durations').delete().eq('id', id)
  if (error) throw error
}

// ─── Employees ─────────────────────────────────────────────────────────────
export async function createEmployee(durationId: string, slotIndex: number, data: any) {
  const { data: result, error } = await supabase
    .from('employees')
    .insert({ durationid: durationId, slotindex: slotIndex, name: data.name,
      checkin: data.checkIn ?? null, checkout: data.checkOut ?? null })
    .select().single()
  if (error) throw error
  return normalizeEmployee(result)
}
export async function updateEmployee(id: string, data: any) {
  const { error } = await supabase.from('employees').update({
    name: data.name,
    checkin:  data.checkIn  ?? data.checkin  ?? null,
    checkout: data.checkOut ?? data.checkout ?? null,
  }).eq('id', id)
  if (error) throw error
}
export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}
