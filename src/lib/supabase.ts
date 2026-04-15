// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
  }
})

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
export type AccessLevel = { role: UserRole }

export async function getMyAccessLevel(): Promise<AccessLevel> {
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return { role: 'pending' }
    const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (error) return { role: 'pending' }
    return { role: (data as any)?.role || 'pending' }
  } catch { return { role: 'pending' } }
}

// ─── User management ──────────────────────────────────────────────────────
export async function getAllUsers(): Promise<any[]> {
  const { data, error } = await supabase.from('profiles').select('id, email, full_name, username, role, created_at').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p: any) => ({ ...p, fullName: p.full_name ?? '' }))
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

// ─── Profiles ──────────────────────────────────────────────────────────────
export async function getMyProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: row } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    return {
      id: user.id,
      email: row?.email ?? user.email ?? '',
      fullName: row?.full_name ?? user.user_metadata?.full_name ?? '',
      username: row?.username ?? '',
      avatar: row?.avatar ?? null,
      fontFamily: row?.font_family ?? 'inter',
      fontSize: row?.font_size ?? 16,
      role: row?.role ?? 'pending'
    }
  } catch { return null }
}

export async function updateMyProfile(updates: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const payload: any = {}
  if (updates.full_name || updates.fullName) payload.full_name = updates.full_name || updates.fullName
  if (updates.avatar !== undefined) payload.avatar = updates.avatar
  if (updates.fontFamily) payload.font_family = updates.fontFamily
  if (updates.fontSize) payload.font_size = updates.fontSize
  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
  if (error) throw error
  return getMyProfile()
}

export async function updateMyUsername(username: string) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('profiles').update({ username }).eq('id', user?.id)
}

export async function updateMyEmail(email: string) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.auth.updateUser({ email })
  if (user) await supabase.from('profiles').update({ email }).eq('id', user.id)
}

export async function updateMyPassword(current: string, next: string) {
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) throw error
}

export async function sendPasswordReset(email: string) {
  await supabase.auth.resetPasswordForEmail(email)
}

export async function grantUserAccess(userId: string, role: string) {
  await setUserRole(userId, role as UserRole)
}

export async function searchProfiles(query: string) {
  const { data } = await supabase.from('profiles').select('*').or(`email.ilike.%${query}%,full_name.ilike.%${query}%,username.ilike.%${query}%`).limit(10)
  return data ?? []
}

export async function getCollaborators() {
  const { data } = await supabase.from('profiles').select('*').in('role', ['admin', 'editor', 'viewer']).order('created_at', { ascending: true })
  return (data ?? []).map(p => ({ ...p, userId: p.id, fullName: p.full_name }))
}

// ─── RESTORED COLLABORATOR EXPORTS FOR HEADER.TSX ──────────────────────────
export async function inviteCollaborator(userId: string, role: 'viewer' | 'editor' | 'admin'): Promise<any> {
  await grantUserAccess(userId, role)
}
export async function updateCollaboratorPermission(userId: string, role: 'viewer' | 'editor' | 'admin'): Promise<any> {
  await grantUserAccess(userId, role)
}
export async function removeCollaborator(userId: string): Promise<void> {
  await setUserRole(userId, 'pending')
}

// ─── Hotels ────────────────────────────────────────────────────────────────
export async function createHotel(data: any) {
  const { data: { user } } = await supabase.auth.getUser()
  const authorName = user?.user_metadata?.full_name || user?.email || 'Admin'
  const tags = Array.isArray(data.companyTag) ? data.companyTag : []

  const { data: result, error } = await supabase.from('hotels').insert({
    name: data.name,
    city: data.city,
    company_tag: tags,
    address: data.address,
    contactperson: data.contactPerson,
    phone: data.phone,
    email: data.email,
    weblink: data.webLink,
    notes: data.notes,
    country: data.country || 'Germany',
    year: data.year || 2026,
    last_updated_at: new Date().toISOString(),
    last_updated_by: authorName
  }).select().single()

  if (error) throw error
  return result
}

export async function updateHotel(id: string, data: any) {
  const { data: { user } } = await supabase.auth.getUser()
  const authorName = user?.user_metadata?.full_name || user?.email || 'Admin'
  
  const { error } = await supabase.from('hotels').update({
    name: data.name,
    city: data.city,
    company_tag: data.companyTag,
    address: data.address,
    contactperson: data.contactPerson,
    phone: data.phone,
    email: data.email,
    weblink: data.webLink,
    notes: data.notes,
    last_updated_at: new Date().toISOString(),
    last_updated_by: authorName
  }).eq('id', id)
  if (error) throw error
}

export async function deleteHotel(id: string) {
  await supabase.from('hotels').delete().eq('id', id)
}

// ─── Durations ─────────────────────────────────────────────────────────────
export async function createDuration(data: any) {
  const { data: result, error } = await supabase.from('durations').insert({
    hotel_id: data.hotelId,
    start_date: null,
    end_date: null,
    room_type: 'DZ'
  }).select().single()
  if (error) throw error
  return result
}

export async function updateDuration(id: string, data: any) {
  const { error } = await supabase.from('durations').update({
    start_date: data.startDate,
    end_date: data.endDate,
    room_type: data.roomType,
    number_of_rooms: data.numberOfRooms,
    price_per_night_per_room: data.pricePerNightPerRoom,
    use_manual_prices: data.useManualPrices,
    nightly_prices: data.nightlyPrices,
    auto_distribute: data.autoDistribute,
    use_brutto_netto: data.useBruttoNetto,
    brutto: data.brutto,
    netto: data.netto,
    mwst: data.mwst,
    has_discount: data.hasDiscount,
    discount_type: data.discountType,
    discount_value: data.discountValue,
    is_paid: data.isPaid,
    rechnung_nr: data.rechnungNr,
    booking_id: data.bookingId,
    deposit_enabled: data.depositEnabled,
    deposit_amount: data.depositAmount,
    extension_note: data.extensionNote
  }).eq('id', id)
  if (error) throw error
}

export async function deleteDuration(id: string) {
  await supabase.from('durations').delete().eq('id', id)
}

// ─── Room Cards ────────────────────────────────────────────────────────────
export async function createRoomCard(data: any) {
  const { data: result, error } = await supabase.from('room_cards').insert({
    id: data.id, 
    duration_id: data.durationId,
    room_type: data.roomType || 'EZ',
    bed_count: data.bedCount || 1,
    pricing_tab: 'per_room'
  }).select().single()
  if (error) throw error
  return result
}

export async function updateRoomCard(id: string, data: any) {
  const payload: any = {}
  if (data.roomNo !== undefined) payload.room_no = data.roomNo;
  if (data.floor !== undefined) payload.floor = data.floor;
  if (data.roomType !== undefined) payload.room_type = data.roomType;
  if (data.bedCount !== undefined) payload.bed_count = data.bedCount;
  if (data.pricingTab !== undefined) payload.pricing_tab = data.pricingTab;
  
  if (data.roomNetto !== undefined) payload.room_netto = data.roomNetto;
  if (data.roomMwst !== undefined) payload.room_mwst = data.roomMwst;
  if (data.roomBrutto !== undefined) payload.room_brutto = data.roomBrutto;
  if (data.bedNetto !== undefined) payload.bed_netto = data.bedNetto;
  if (data.bedMwst !== undefined) payload.bed_mwst = data.bedMwst;
  if (data.bedBrutto !== undefined) payload.bed_brutto = data.bedBrutto;
  if (data.totalNetto !== undefined) payload.total_netto = data.totalNetto;
  if (data.totalMwst !== undefined) payload.total_mwst = data.totalMwst;
  if (data.totalBrutto !== undefined) payload.total_brutto = data.totalBrutto;
  
  if (data.roomEnergyNetto !== undefined) payload.room_energy_netto = data.roomEnergyNetto;
  if (data.roomEnergyMwst !== undefined) payload.room_energy_mwst = data.roomEnergyMwst;
  if (data.roomEnergyBrutto !== undefined) payload.room_energy_brutto = data.roomEnergyBrutto;
  if (data.bedEnergyNetto !== undefined) payload.bed_energy_netto = data.bedEnergyNetto;
  if (data.bedEnergyMwst !== undefined) payload.bed_energy_mwst = data.bedEnergyMwst;
  if (data.bedEnergyBrutto !== undefined) payload.bed_energy_brutto = data.bedEnergyBrutto;
  if (data.totalEnergyNetto !== undefined) payload.total_energy_netto = data.totalEnergyNetto;
  if (data.totalEnergyMwst !== undefined) payload.total_energy_mwst = data.totalEnergyMwst;
  if (data.totalEnergyBrutto !== undefined) payload.total_energy_brutto = data.totalEnergyBrutto;

  if (data.hasDiscount !== undefined) payload.has_discount = data.hasDiscount;
  if (data.discountType !== undefined) payload.discount_type = data.discountType;
  if (data.discountValue !== undefined) payload.discount_value = data.discountValue;

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase.from('room_cards').update(payload).eq('id', id)
    if (error) throw error
  }
}

export async function deleteRoomCard(id: string) {
  await supabase.from('room_cards').delete().eq('id', id)
}

// ─── Employees ─────────────────────────────────────────────────────────────
export async function createEmployee(durationId: string, slotIndex: number, data: any) {
  const { data: result, error } = await supabase.from('employees').insert({
    id: data.id, 
    duration_id: durationId,           // PERFECT MATCH TO SQL
    room_card_id: data.roomCardId,    
    slot_index: slotIndex,             // PERFECT MATCH TO SQL
    name: data.name,
    checkin: data.checkIn,
    checkout: data.checkOut
  }).select().single()
  if (error) throw error
  return result
}

export async function updateEmployee(id: string, data: any) {
  const { error } = await supabase.from('employees').update({
    name: data.name,
    checkin: data.checkIn,
    checkout: data.checkOut
  }).eq('id', id)
  if (error) throw error
}

export async function deleteEmployee(id: string) {
  await supabase.from('employees').delete().eq('id', id)
}
