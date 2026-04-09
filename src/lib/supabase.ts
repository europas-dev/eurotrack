// src/lib/supabase.ts
// NOTE: All Supabase column names are snake_case (DB convention).
// All JS/TS interfaces use camelCase. Normalization functions handle the mapping.
// German translation is handled at the component level — this file is data-only.

import { createClient } from '@supabase/supabase-js'
import type { Hotel, Duration, Employee, WorkspaceShare } from './types'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

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

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS — snake_case DB → camelCase TS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeEmployee(e: any): Employee | null {
  if (!e) return null
  return {
    id:       e.id,
    name:     e.name     ?? '',
    checkIn:  e.checkin  ?? e.checkIn  ?? '',
    checkOut: e.checkout ?? e.checkOut ?? '',
  }
}

function normalizeDuration(d: any): Duration {
  return {
    id:                   d.id,
    hotelId:              d.hotelid              ?? d.hotelId              ?? '',
    startDate:            d.startdate            ?? d.startDate            ?? '',
    endDate:              d.enddate              ?? d.endDate              ?? '',
    roomType:             d.roomtype             ?? d.roomType             ?? 'DZ',
    numberOfRooms:        d.numberofrooms        ?? d.numberOfRooms        ?? 1,

    // Simple pricing
    pricePerNightPerRoom: d.pricepernightperroom ?? d.pricePerNightPerRoom ?? 0,
    useManualPrices:      d.usemanualprices      ?? d.useManualPrices      ?? false,
    nightlyPrices:        d.nightlyprices        ?? d.nightlyPrices        ?? {},
    autoDistribute:       d.autodistribute       ?? d.autoDistribute       ?? false,

    // Brutto / Netto / MwSt
    useBruttoNetto:       d.usebruttonetto       ?? d.useBruttoNetto       ?? false,
    brutto:               d.brutto               ?? undefined,
    netto:                d.netto                ?? undefined,
    mwst:                 d.mwst                 ?? undefined,

    // Discount
    hasDiscount:          d.hasdiscount          ?? d.hasDiscount          ?? false,
    discountType:         d.discounttype         ?? d.discountType         ?? 'percentage',
    discountValue:        d.discountvalue        ?? d.discountValue        ?? 0,

    // Payment
    isPaid:               d.ispaid               ?? d.isPaid               ?? false,

    // Deposit
    depositEnabled:       d.depositenabled       ?? d.depositEnabled       ?? false,
    depositAmount:        d.depositamount        ?? d.depositAmount        ?? undefined,

    // References
    rechnungNr:           d.rechnungnr           ?? d.rechnungNr           ?? undefined,
    bookingId:            d.bookingid            ?? d.bookingId            ?? null,
    extensionNote:        d.extensionnote        ?? d.extensionNote        ?? undefined,

    // Employees — null slots = free beds
    employees: Array.isArray(d.employees)
      ? d.employees.map(normalizeEmployee)
      : [],
  }
}

function normalizeHotel(h: any): Hotel {
  return {
    id:            h.id,
    userId:        h.userid         ?? h.userId         ?? '',

    // Inline-editable main row fields
    name:          h.name           ?? '',
    city:          h.city           ?? '',
    companyTag:    h.companytag     ?? h.companyTag      ?? '',

    // Expanded panel fields
    address:       h.address        ?? undefined,
    contactPerson: h.contactperson  ?? h.contactPerson  ?? h.contact ?? undefined,
    phone:         h.phone          ?? undefined,
    email:         h.email          ?? undefined,
    webLink:       h.weblink        ?? h.webLink        ?? undefined,
    notes:         h.notes          ?? undefined,

    // Audit
    createdAt:     h.createdat      ?? h.createdAt      ?? '',
    updatedAt:     h.updatedat      ?? h.updatedAt      ?? undefined,
    lastUpdatedBy: h.lastupdatedby  ?? h.lastUpdatedBy  ?? undefined,
    lastUpdatedAt: h.lastupdatedat  ?? h.lastUpdatedAt  ?? undefined,

    // Relations
    durations: Array.isArray(h.durations)
      ? h.durations.map(normalizeDuration)
      : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOTELS
// ─────────────────────────────────────────────────────────────────────────────

export async function getHotels(): Promise<Hotel[]> {
  const { data, error } = await supabase
    .from('hotels')
    .select(`
      *,
      durations (
        *,
        employees ( * )
      )
    `)
    .order('createdat', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeHotel)
}

export async function createHotel(params: {
  name: string
  city: string
  companyTag: string
  address?: string
  contactPerson?: string
  phone?: string
  email?: string
  webLink?: string
  notes?: string
}): Promise<Hotel> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: result, error } = await supabase
    .from('hotels')
    .insert({
      name:          params.name,
      city:          params.city,
      companytag:    params.companyTag,
      address:       params.address       ?? null,
      contactperson: params.contactPerson ?? null,
      phone:         params.phone         ?? null,
      email:         params.email         ?? null,
      weblink:       params.webLink       ?? null,
      notes:         params.notes         ?? null,
      userid:        user.id,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeHotel({ ...result, durations: [] })
}

export async function updateHotel(id: string, data: Partial<Hotel>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('hotels')
    .update({
      name:          data.name,
      city:          data.city,
      companytag:    data.companyTag,
      address:       data.address        ?? null,
      contactperson: data.contactPerson  ?? null,
      phone:         data.phone          ?? null,
      email:         data.email          ?? null,
      weblink:       data.webLink        ?? null,
      notes:         data.notes          ?? null,
      updatedat:     new Date().toISOString(),
      lastupdatedby: user?.email         ?? null,
      lastupdatedat: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteHotel(id: string): Promise<void> {
  const { error } = await supabase.from('hotels').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// DURATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createDuration(data: Partial<Duration> & { hotelId: string }): Promise<Duration> {
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
      depositenabled:       data.depositEnabled       ?? false,
      depositamount:        data.depositAmount        ?? null,
      rechnungnr:           data.rechnungNr           ?? null,
      bookingid:            data.bookingId            ?? null,
      extensionnote:        data.extensionNote        ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeDuration({ ...result, employees: [] })
}

export async function updateDuration(id: string, data: Partial<Duration>): Promise<void> {
  const { error } = await supabase
    .from('durations')
    .update({
      startdate:            data.startDate,
      enddate:              data.endDate,
      roomtype:             data.roomType,
      numberofrooms:        data.numberOfRooms,
      pricepernightperroom: data.pricePerNightPerRoom,
      usemanualprices:      data.useManualPrices,
      nightlyprices:        data.nightlyPrices,
      autodistribute:       data.autoDistribute,
      usebruttonetto:       data.useBruttoNetto,
      brutto:               data.brutto               ?? null,
      netto:                data.netto                ?? null,
      mwst:                 data.mwst                 ?? null,
      hasdiscount:          data.hasDiscount,
      discounttype:         data.discountType,
      discountvalue:        data.discountValue,
      ispaid:               data.isPaid,
      depositenabled:       data.depositEnabled,
      depositamount:        data.depositAmount        ?? null,
      rechnungnr:           data.rechnungNr           ?? null,
      bookingid:            data.bookingId            ?? null,
      extensionnote:        data.extensionNote        ?? null,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteDuration(id: string): Promise<void> {
  const { error } = await supabase.from('durations').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────────────────────────────────────

export async function createEmployee(
  durationId: string,
  slotIndex: number,
  data: { name: string; checkIn?: string; checkOut?: string }
): Promise<Employee> {
  const { data: result, error } = await supabase
    .from('employees')
    .insert({
      durationid: durationId,
      slotindex:  slotIndex,
      name:       data.name,
      checkin:    data.checkIn  ?? null,
      checkout:   data.checkOut ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeEmployee(result) as Employee
}

export async function updateEmployee(
  id: string,
  data: { name?: string; checkIn?: string; checkOut?: string }
): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .update({
      name:     data.name,
      checkin:  data.checkIn  ?? null,
      checkout: data.checkOut ?? null,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE SHARING / COLLABORATORS
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteCollaborator(params: {
  ownerUserId: string
  email: string
  permission: 'viewer' | 'editor' | 'admin'
}): Promise<WorkspaceShare> {
  const { data: result, error } = await supabase
    .from('workspace_shares')
    .insert({
      ownerid:         params.ownerUserId,
      sharedwithemail: params.email,
      permission:      params.permission,
    })
    .select()
    .single()

  if (error) throw error
  return {
    id:              result.id,
    ownerId:         result.ownerid,
    sharedWithEmail: result.sharedwithemail,
    sharedWithId:    result.sharedwithid ?? undefined,
    permission:      result.permission,
    createdAt:       result.createdat,
  }
}

export async function getCollaborators(ownerUserId: string): Promise<WorkspaceShare[]> {
  const { data, error } = await supabase
    .from('workspace_shares')
    .select('*')
    .eq('ownerid', ownerUserId)
    .order('createdat', { ascending: false })

  if (error) throw error
  return (data ?? []).map(r => ({
    id:              r.id,
    ownerId:         r.ownerid,
    sharedWithEmail: r.sharedwithemail,
    sharedWithId:    r.sharedwithid ?? undefined,
    permission:      r.permission,
    createdAt:       r.createdat,
  }))
}

export async function updateCollaboratorPermission(
  shareId: string,
  permission: 'viewer' | 'editor' | 'admin'
): Promise<void> {
  const { error } = await supabase
    .from('workspace_shares')
    .update({ permission })
    .eq('id', shareId)
  if (error) throw error
}

export async function removeCollaborator(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_shares')
    .delete()
    .eq('id', shareId)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToHotels(userId: string, onUpdate: () => void): () => void {
  const channel = supabase
    .channel(`hotels:userid=eq.${userId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'hotels', filter: `userid=eq.${userId}` },
      () => onUpdate()
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'durations' },
      () => onUpdate()
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'employees' },
      () => onUpdate()
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
