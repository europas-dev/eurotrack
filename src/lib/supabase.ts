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

// ─── Profiles ─────────────────────────────────────────────────────────────────
export async function getMyProfile() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return {
    id:         user.id,
    email:      user.email ?? '',
    full_name:  user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
    fullName:   user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
    avatar_url: user.user_metadata?.avatar_url ?? null,
    fontScale:  user.user_metadata?.fontScale  ?? 100,
    fontFamily: user.user_metadata?.fontFamily ?? 'inter',
  }
}

export async function updateMyProfile(updates: {
  full_name?: string
  fullName?: string
  avatar_url?: string
  fontScale?: number
  fontFamily?: string
}) {
  const { data, error } = await supabase.auth.updateUser({ data: updates })
  if (error) throw error
  const user = data.user
  if (!user) return null
  return {
    id:         user.id,
    email:      user.email ?? '',
    full_name:  user.user_metadata?.full_name ?? '',
    fullName:   user.user_metadata?.full_name ?? '',
    avatar_url: user.user_metadata?.avatar_url ?? null,
    fontScale:  user.user_metadata?.fontScale  ?? 100,
    fontFamily: user.user_metadata?.fontFamily ?? 'inter',
  }
}

export async function searchProfiles(query: string): Promise<any[]> {
  if (!query || query.trim().length < 2) return []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .ilike('email', `%${query.trim()}%`)
      .limit(10)
    if (error) return []
    return (data ?? []).map((p: any) => ({
      ...p,
      fullName: p.full_name ?? '',
    }))
  } catch {
    return []
  }
}

// ─── Collaborators ────────────────────────────────────────────────────────────
export async function inviteCollaborator(
  hotelId: string | null,
  userId: string,
  role: 'viewer' | 'editor'
): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('collaborators')
    .upsert({
      owner_id:   user.id,
      hotel_id:   hotelId ?? null,
      user_id:    userId,
      role,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,user_id,hotel_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCollaboratorPermission(
  collaboratorId: string,
  role: 'viewer' | 'editor'
): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('collaborators')
    .update({ role })
    .eq('owner_id', user.id)
    .eq('id', collaboratorId)
    .select()
    .single()
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

export async function getCollaborators(hotelId?: string | null): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  try {
    let q = supabase
      .from('collaborators')
      .select('id, user_id, role, invited_at, hotel_id, profiles(id, email, full_name, avatar_url)')
      .eq('owner_id', user.id)
    if (hotelId) q = q.eq('hotel_id', hotelId)
    const { data, error } = await q
    if (error) return []
    return (data ?? []).map((c: any) => ({
      id:        c.id,
      userId:    c.user_id,
      role:      c.role,
      hotelId:   c.hotel_id,
      email:     c.profiles?.email     ?? '',
      fullName:  c.profiles?.full_name ?? '',
      full_name: c.profiles?.full_name ?? '',
      avatar_url: c.profiles?.avatar_url ?? null,
      profile: {
        id:       c.user_id,
        email:    c.profiles?.email     ?? '',
        fullName: c.profiles?.full_name ?? '',
      },
    }))
  } catch {
    return []
  }
}

// ─── Normalizers (snake_case DB → camelCase app) ──────────────────────────────
function normalizeEmployee(e: any): any {
  if (!e) return null
  return {
    ...e,
    durationId: e.durationid ?? e.durationId,
    slotIndex:  e.slotindex  ?? e.slotIndex,
    checkIn:    e.checkin    ?? e.checkIn,
    checkOut:   e.checkout   ?? e.checkOut,
  }
}

function normalizeDuration(d: any): any {
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
    employees: (d.employees ?? []).map(normalizeEmployee),
  }
}

function normalizeHotel(h: any): any {
  return {
    ...h,
    companyTag:     h.companytag     ?? h.companyTag,
    contactPerson:  h.contactperson  ?? h.contactPerson,
    webLink:        h.weblink        ?? h.webLink,
    phone:          h.phone          ?? h.phone,
    notes:          h.notes          ?? h.notes,
    lastUpdatedBy:  h.lastupdatedby  ?? h.lastUpdatedBy,
    lastUpdatedAt:  h.lastupdatedat  ?? h.lastUpdatedAt,
    durations: (h.durations ?? []).map(normalizeDuration),
  }
}

// ─── Hotels ───────────────────────────────────────────────────────────────────
export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('*, durations(*, employees(*))')
    // Use created_at (Supabase default column name) — NOT createdat
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeHotel)
}

export async function createHotel(data: {
  name: string; city: string; companyTag: string;
  address?: string; contactPerson?: string; phone?: string
  email?: string; webLink?: string; notes?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: result, error } = await supabase
    .from('hotels')
    .insert({
      name:          data.name,
      city:          data.city,
      companytag:    data.companyTag,
      address:       data.address       ?? null,
      contactperson: data.contactPerson ?? null,
      phone:         data.phone         ?? null,
      email:         data.email         ?? null,
      weblink:       data.webLink       ?? null,
      notes:         data.notes         ?? null,
      userid:        user.id,
      lastupdatedby: user.email ?? user.id,
      lastupdatedat: new Date().toISOString(),
    })
    .select().single()
  if (error) throw error
  return normalizeHotel({ ...result, durations: [] })
}

export async function updateHotel(id: string, data: any) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('hotels')
    .update({
      name:          data.name,
      city:          data.city,
      companytag:    data.companyTag    ?? data.companytag,
      address:       data.address       ?? null,
      contactperson: data.contactPerson ?? data.contactperson ?? null,
      phone:         data.phone         ?? null,
      email:         data.email         ?? null,
      weblink:       data.webLink       ?? data.weblink ?? null,
      notes:         data.notes         ?? null,
      lastupdatedby: user?.email        ?? user?.id ?? null,
      lastupdatedat: new Date().toISOString(),
    })
    .eq('id', id)
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
