// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Auth ─────────────────────────────────────────────────────────────────────
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

// ─── Access level ─────────────────────────────────────────────────────────────
export type UserRole = 'superadmin' | 'admin' | 'editor' | 'viewer' | 'pending'

export type AccessLevel =
  | { role: 'superadmin' }
  | { role: 'admin' }
  | { role: 'editor'; hotelIds: string[]; ownerId: string }
  | { role: 'viewer'; hotelIds: string[]; ownerId: string }
  | { role: 'pending' }

// Race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function getMyAccessLevel(): Promise<AccessLevel> {
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    // Not authenticated at all — send to login, not admin
    if (authErr || !user) return { role: 'pending' }

    // Fetch this user's profile role
    const profileResult = await withTimeout(
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      3000,
      { data: null, error: new Error('timeout') }
    )

    const role = (profileResult.data as any)?.role as UserRole | null

    if (role === 'superadmin') return { role: 'superadmin' }
    if (role === 'admin')      return { role: 'admin' }

    // Check if this user was invited as a collaborator by someone
    const collabResult = await withTimeout(
      supabase
        .from('collaborators')
        .select('hotel_id, role, owner_id')
        .eq('user_id', user.id),
      3000,
      { data: [], error: null }
    )

    const collabs = (collabResult.data as any[]) ?? []
    if (collabs.length > 0) {
      const hasEditor = collabs.some((c: any) => c.role === 'editor')
      const hotelIds  = collabs.map((c: any) => c.hotel_id).filter(Boolean)
      // ownerId = the admin who invited this user — used to filter hotels
      const ownerId   = collabs[0]?.owner_id ?? ''
      return hasEditor
        ? { role: 'editor', hotelIds, ownerId }
        : { role: 'viewer', hotelIds, ownerId }
    }

    // Profile exists but has no recognised role → pending approval
    // (do NOT fall back to admin — that's the security hole)
    return { role: 'pending' }

  } catch {
    // Any unexpected crash → pending, never admin
    return { role: 'pending' }
  }
}

// ─── User management (superadmin only) ────────────────────────────────────────
export async function getAllUsers(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, avatar_url, role, created_at')
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []).map((p: any) => ({ ...p, fullName: p.full_name ?? '' }))
  } catch { return [] }
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw error
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
export async function getMyProfile() {
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return null

    const { data: row } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, avatar_url, role')
      .eq('id', user.id)
      .maybeSingle()

    const fullName   = row?.full_name  ?? user.user_metadata?.full_name  ?? user.user_metadata?.name ?? ''
    const username   = row?.username   ?? user.user_metadata?.username   ?? ''
    const fontScale  = user.user_metadata?.fontScale  ?? 100
    const fontFamily = user.user_metadata?.fontFamily ?? 'inter'

    return {
      id:         user.id,
      email:      row?.email ?? user.email ?? '',
      full_name:  fullName,
      fullName,
      username,
      avatar_url: row?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      fontScale,
      fontFamily,
      role:       (row?.role as UserRole) ?? 'pending',
    }
  } catch { return null }
}

export async function updateMyProfile(updates: {
  full_name?:  string
  fullName?:   string
  username?:   string
  avatar_url?: string
  fontScale?:  number
  fontFamily?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fullName = updates.full_name ?? updates.fullName

  const metaPatch: Record<string, any> = {}
  if (fullName              !== undefined) metaPatch.full_name  = fullName
  if (updates.username      !== undefined) metaPatch.username   = updates.username
  if (updates.fontScale     !== undefined) metaPatch.fontScale  = updates.fontScale
  if (updates.fontFamily    !== undefined) metaPatch.fontFamily = updates.fontFamily
  if (updates.avatar_url    !== undefined) metaPatch.avatar_url = updates.avatar_url

  if (Object.keys(metaPatch).length > 0) {
    const { error: authErr } = await supabase.auth.updateUser({ data: metaPatch })
    if (authErr) throw authErr
  }

  const rowPatch: Record<string, any> = {}
  if (fullName           !== undefined) rowPatch.full_name  = fullName
  if (updates.username   !== undefined) rowPatch.username   = updates.username
  if (updates.avatar_url !== undefined) rowPatch.avatar_url = updates.avatar_url

  if (Object.keys(rowPatch).length > 0) {
    await supabase.from('profiles').update(rowPatch).eq('id', user.id)
  }

  return getMyProfile()
}

export async function searchProfiles(query: string): Promise<any[]> {
  if (!query || query.trim().length < 2) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    // Exclude the current user from search results
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, avatar_url')
      .or(`email.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`)
      .neq('id', user?.id ?? '')
      .limit(10)
    if (error) return []
    return (data ?? []).map((p: any) => ({ ...p, fullName: p.full_name ?? '' }))
  } catch { return [] }
}

// ─── Collaborators ────────────────────────────────────────────────────────────
// Signature: inviteCollaborator(userId, role)
// hotel_id is always null — invites give access to the entire dashboard
export async function inviteCollaborator(userId: string, role: 'viewer' | 'editor'): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('collaborators')
    .upsert({
      owner_id:   user.id,
      hotel_id:   null,          // null = access to entire dashboard
      user_id:    userId,
      role,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,user_id,hotel_id' })
    .select().single()
  if (error) throw error
  return data
}

export async function updateCollaboratorPermission(userId: string, role: 'viewer' | 'editor'): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('collaborators')
    .update({ role })
    .eq('owner_id', user.id)
    .eq('user_id', userId)
    .select().single()
  if (error) throw error
  return data
}

export async function removeCollaborator(userId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('collaborators')
    .delete()
    .eq('owner_id', user.id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getCollaborators(): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('collaborators')
      .select('id, user_id, role, invited_at, hotel_id, profiles(id, email, full_name, avatar_url)')
      .eq('owner_id', user.id)
    if (error) return []
    return (data ?? []).map((c: any) => ({
      id:         c.id,
      userId:     c.user_id,
      role:       c.role,
      hotelId:    c.hotel_id,
      email:      c.profiles?.email     ?? '',
      fullName:   c.profiles?.full_name ?? '',
      full_name:  c.profiles?.full_name ?? '',
      avatar_url: c.profiles?.avatar_url ?? null,
    }))
  } catch { return [] }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normaliseCompanyTag(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch {}
    return raw ? [raw] : []
  }
  return []
}

function serialiseCompanyTag(tags: string[]): string | null {
  if (!tags || tags.length === 0) return null
  return JSON.stringify(tags)
}

// ─── Normalizers ──────────────────────────────────────────────────────────────
function normalizeEmployee(e: any): any {
  if (!e || typeof e !== 'object') return null
  return {
    ...e,
    durationId: e.durationid ?? e.durationId,
    slotIndex:  e.slotindex  ?? e.slotIndex,
    checkIn:    e.checkin    ?? e.checkIn,
    checkOut:   e.checkout   ?? e.checkOut,
  }
}

function normalizeDuration(d: any): any {
  if (!d || typeof d !== 'object') return null
  return {
    ...d,
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
  return {
    ...h,
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

// ─── Hotels ───────────────────────────────────────────────────────────────────
// getHotels: returns only hotels owned by the current user.
// For collaborators, pass ownerId to see that owner's hotels instead.
export async function getHotels(ownerId?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Use ownerId if provided (collaborator viewing someone else's hotels),
  // otherwise use the current user's own id.
  const targetOwnerId = ownerId ?? user.id

  const { data, error } = await supabase
    .from('hotels')
    .select('*, durations(*, employees(*))')
    .eq('owner_id', targetOwnerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeHotel).filter(Boolean)
}

export async function createHotel(data: {
  name: string
  city?: string | null
  companyTag?: string[] | string | null
  address?: string | null
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  webLink?: string | null
  notes?: string | null
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const tags = Array.isArray(data.companyTag)
    ? data.companyTag
    : (data.companyTag ? [data.companyTag] : [])

  const insertPayload: any = {
    owner_id:      user.id,           // ← every hotel is owned by the creator
    name:          data.name,
    city:          data.city          ?? null,
    companytag:    serialiseCompanyTag(tags),
    address:       data.address       ?? null,
    contactperson: data.contactPerson ?? null,
    phone:         data.phone         ?? null,
    email:         data.email         ?? null,
    weblink:       data.webLink       ?? null,
    notes:         data.notes         ?? null,
    lastupdatedat: new Date().toISOString(),
    lastupdatedby: user.email ?? user.id,
  }

  const { data: result, error } = await supabase
    .from('hotels')
    .insert(insertPayload)
    .select().single()

  if (error) throw error
  if (!result) throw new Error('Hotel created but no data returned — check RLS policies')
  return normalizeHotel({ ...result, durations: [] })
}

export async function updateHotel(id: string, data: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rawTag = data.companyTag ?? data.companytag ?? null
  const tags = Array.isArray(rawTag)
    ? rawTag
    : (rawTag ? [rawTag] : [])

  const updatePayload: any = {
    name:          data.name,
    city:          data.city          ?? null,
    companytag:    serialiseCompanyTag(tags),
    address:       data.address       ?? null,
    contactperson: data.contactPerson ?? data.contactperson ?? null,
    phone:         data.phone         ?? null,
    email:         data.email         ?? null,
    weblink:       data.webLink       ?? data.weblink ?? null,
    notes:         data.notes         ?? null,
    lastupdatedat: new Date().toISOString(),
    lastupdatedby: user.email ?? user.id,
  }

  const { error } = await supabase.from('hotels').update(updatePayload).eq('id', id)
  if (error) throw error
}

export async function deleteHotel(id: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', id)
  if (error) throw error
}

// ─── Durations ────────────────────────────────────────────────────────────────
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
  const { error } = await supabase
    .from('durations')
    .update({
      startdate:            data.startDate            ?? data.startdate,
      enddate:              data.endDate              ?? data.enddate,
      roomtype:             data.roomType             ?? data.roomtype,
      numberofrooms:        data.numberOfRooms        ?? data.numberofrooms,
      pricepernightperroom: data.pricePerNightPerRoom ?? data.pricepernightperroom,
      usemanualprices:      data.useManualPrices      ?? data.usemanualprices      ?? false,
      nightlyprices:        data.nightlyPrices        ?? data.nightlyprices        ?? {},
      autodistribute:       data.autoDistribute       ?? data.autodistribute       ?? false,
      usebruttonetto:       data.useBruttoNetto       ?? data.usebruttonetto       ?? false,
      brutto:               data.brutto               ?? null,
      netto:                data.netto                ?? null,
      mwst:                 data.mwst                 ?? null,
      hasdiscount:          data.hasDiscount          ?? data.hasdiscount          ?? false,
      discounttype:         data.discountType         ?? data.discounttype         ?? 'percentage',
      discountvalue:        data.discountValue        ?? data.discountvalue        ?? 0,
      ispaid:               data.isPaid               ?? data.ispaid               ?? false,
      rechnungnr:           data.rechnungNr           ?? data.rechnungnr           ?? null,
      bookingid:            data.bookingId            ?? data.bookingid            ?? null,
      depositenabled:       data.depositEnabled       ?? data.depositenabled       ?? false,
      depositamount:        data.depositAmount        ?? data.depositamount        ?? null,
      extensionnote:        data.extensionNote        ?? data.extensionnote        ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteDuration(id: string) {
  const { error } = await supabase.from('durations').delete().eq('id', id)
  if (error) throw error
}

// ─── Employees ────────────────────────────────────────────────────────────────
export async function createEmployee(durationId: string, slotIndex: number, data: any) {
  const { data: result, error } = await supabase
    .from('employees')
    .insert({
      durationid: durationId,
      slotindex:  slotIndex,
      name:       data.name,
      checkin:    data.checkIn  ?? null,
      checkout:   data.checkOut ?? null,
    })
    .select().single()
  if (error) throw error
  return normalizeEmployee(result)
}

export async function updateEmployee(id: string, data: any) {
  const { error } = await supabase
    .from('employees')
    .update({
      name:     data.name,
      checkin:  data.checkIn  ?? data.checkin  ?? null,
      checkout: data.checkOut ?? data.checkout ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}
