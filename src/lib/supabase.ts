import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function normalizeEmployee(e: any) {
  if (!e) return null;
  return {
    ...e,
    durationId: e.duration_id ?? e.durationId,
    slotIndex: e.slot_index ?? e.slotIndex,
    checkIn: e.check_in ?? e.checkIn,
    checkOut: e.check_out ?? e.checkOut,
  };
}

function normalizeDuration(d: any) {
  return {
    ...d,
    hotelId: d.hotel_id ?? d.hotelId,
    startDate: d.start_date ?? d.startDate,
    endDate: d.end_date ?? d.endDate,
    roomType: d.room_type ?? d.roomType,
    numberOfRooms: d.number_of_rooms ?? d.numberOfRooms,
    pricePerNightPerRoom: d.price_per_night_per_room ?? d.pricePerNightPerRoom,
    hasDiscount: d.has_discount ?? d.hasDiscount,
    discountType: d.discount_type ?? d.discountType,
    discountValue: d.discount_value ?? d.discountValue,
    isPaid: d.is_paid ?? d.isPaid,
    bookingId: d.booking_id ?? d.bookingId,
    useManualPrices: d.use_manual_prices ?? d.useManualPrices ?? false,
    nightlyPrices: d.nightly_prices ?? d.nightlyPrices ?? {},
    employees: (d.employees || []).map((e: any) => normalizeEmployee(e)),
  };
}

function normalizeCollaborator(c: any) {
  if (!c) return null;
  return {
    ...c,
    hotelId: c.hotel_id ?? c.hotelId,
    ownerId: c.owner_id ?? c.ownerId,
    sharedWithId: c.shared_with_id ?? c.sharedWithId,
    createdAt: c.created_at ?? c.createdAt,
    profile: c.profile || c.profiles || null,
  };
}

function normalizeHotel(h: any) {
  return {
    ...h,
    userId: h.user_id ?? h.userId,
    companyTag: h.company_tag ?? h.companyTag,
    webLink: h.web_link ?? h.webLink,
    contactPerson: h.contact_person ?? h.contactPerson,
    createdAt: h.created_at ?? h.createdAt,
    updatedAt: h.updated_at ?? h.updatedAt,
    notes: h.notes ?? null,
    durations: (h.durations || []).map(normalizeDuration),
    collaborators: (h.hotel_collaborators || h.collaborators || []).map((c: any) => normalizeCollaborator(c)),
  };
}

function normalizeProfile(p: any) {
  if (!p) return null;
  return {
    ...p,
    fullName: p.full_name ?? p.fullName,
    fontFamily: p.font_family ?? p.fontFamily ?? 'inter',
    fontScale: p.font_scale ?? p.fontScale ?? 100,
    themePreference: p.theme_preference ?? p.themePreference ?? 'system',
    createdAt: p.created_at ?? p.createdAt,
  };
}

// ─── PROFILES / SETTINGS ─────────────────────────────────────────────────────

export async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return normalizeProfile(data);
}

export async function updateMyProfile(data: {
  fullName?: string;
  fontFamily?: string;
  fontScale?: number;
  themePreference?: 'light' | 'dark' | 'system';
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const payload: any = {};
  if (data.fullName !== undefined) payload.full_name = data.fullName;
  if (data.fontFamily !== undefined) payload.font_family = data.fontFamily;
  if (data.fontScale !== undefined) payload.font_scale = data.fontScale;
  if (data.themePreference !== undefined) payload.theme_preference = data.themePreference;

  const { data: result, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return normalizeProfile(result);
}

export async function searchProfiles(query: string) {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, font_family, font_scale, theme_preference')
    .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(10);

  if (error) throw error;
  return (data || []).map(normalizeProfile);
}

// ─── HOTELS ──────────────────────────────────────────────────────────────────

export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select(`
      *,
      durations(*, employees(*)),
      hotel_collaborators(
        *,
        profile:profiles!hotel_collaborators_shared_with_id_fkey(
          id, email, full_name, font_family, font_scale, theme_preference
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeHotel);
}

export async function createHotel(data: {
  name: string;
  city: string;
  companyTag: string;
  address?: string;
  contact?: string;
  contactPerson?: string;
  email?: string;
  webLink?: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data: result, error } = await supabase
    .from('hotels')
    .insert([{
      name: data.name,
      city: data.city,
      company_tag: data.companyTag,
      address: data.address || null,
      contact: data.contact || null,
      contact_person: data.contactPerson || null,
      email: data.email || null,
      web_link: data.webLink || null,
      notes: data.notes || null,
      user_id: user.id,
    }])
    .select()
    .single();

  if (error) throw error;
  return normalizeHotel({ ...result, durations: [], hotel_collaborators: [] });
}

export async function updateHotel(id: string, data: any) {
  const { error } = await supabase
    .from('hotels')
    .update({
      name: data.name,
      city: data.city,
      company_tag: data.companyTag ?? data.company_tag,
      address: data.address,
      contact: data.contact,
      contact_person: data.contactPerson ?? data.contact_person,
      email: data.email,
      web_link: data.webLink ?? data.web_link,
      notes: data.notes,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteHotel(id: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', id);
  if (error) throw error;
}

// ─── DURATIONS ────────────────────────────────────────────────────────────────

export async function createDuration(data: any) {
  const { data: result, error } = await supabase
    .from('durations')
    .insert([{
      hotel_id: data.hotelId,
      start_date: data.startDate ?? '',
      end_date: data.endDate ?? '',
      room_type: data.roomType ?? 'DZ',
      number_of_rooms: data.numberOfRooms ?? 1,
      price_per_night_per_room: data.pricePerNightPerRoom ?? 0,
      has_discount: data.hasDiscount ?? false,
      discount_type: data.discountType ?? 'percentage',
      discount_value: data.discountValue ?? 0,
      is_paid: data.isPaid ?? false,
      booking_id: data.bookingId ?? null,
      use_manual_prices: data.useManualPrices ?? false,
      nightly_prices: data.nightlyPrices ?? {},
    }])
    .select()
    .single();

  if (error) throw error;
  return normalizeDuration({ ...result, employees: [] });
}

export async function updateDuration(id: string, data: any) {
  const { error } = await supabase
    .from('durations')
    .update({
      start_date: data.startDate ?? data.start_date,
      end_date: data.endDate ?? data.end_date,
      room_type: data.roomType ?? data.room_type,
      number_of_rooms: data.numberOfRooms ?? data.number_of_rooms,
      price_per_night_per_room: data.pricePerNightPerRoom ?? data.price_per_night_per_room,
      has_discount: data.hasDiscount ?? data.has_discount,
      discount_type: data.discountType ?? data.discount_type,
      discount_value: data.discountValue ?? data.discount_value,
      is_paid: data.isPaid ?? data.is_paid,
      booking_id: data.bookingId ?? data.booking_id,
      use_manual_prices: data.useManualPrices ?? data.use_manual_prices,
      nightly_prices: data.nightlyPrices ?? data.nightly_prices ?? {},
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteDuration(id: string) {
  const { error } = await supabase.from('durations').delete().eq('id', id);
  if (error) throw error;
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────

export async function createEmployee(durationId: string, slotIndex: number, data: any) {
  const { data: result, error } = await supabase
    .from('employees')
    .insert([{
      duration_id: durationId,
      slot_index: slotIndex,
      name: data.name,
      check_in: data.checkIn ?? null,
      check_out: data.checkOut ?? null,
    }])
    .select()
    .single();

  if (error) throw error;
  return normalizeEmployee(result);
}

export async function updateEmployee(id: string, data: any) {
  const { error } = await supabase
    .from('employees')
    .update({
      name: data.name,
      check_in: data.checkIn ?? data.check_in,
      check_out: data.checkOut ?? data.check_out,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ─── COLLABORATORS / SHARING ─────────────────────────────────────────────────

export async function getHotelCollaborators(hotelId: string) {
  const { data, error } = await supabase
    .from('hotel_collaborators')
    .select(`
      *,
      profile:profiles!hotel_collaborators_shared_with_id_fkey(
        id, email, full_name, font_family, font_scale, theme_preference
      )
    `)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeCollaborator);
}

export async function inviteCollaborator(hotelId: string, sharedWithId: string, permission: 'viewer' | 'editor') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hotel_collaborators')
    .insert([{
      hotel_id: hotelId,
      owner_id: user.id,
      shared_with_id: sharedWithId,
      permission,
    }])
    .select(`
      *,
      profile:profiles!hotel_collaborators_shared_with_id_fkey(
        id, email, full_name, font_family, font_scale, theme_preference
      )
    `)
    .single();

  if (error) throw error;
  return normalizeCollaborator(data);
}

export async function updateCollaboratorPermission(id: string, permission: 'viewer' | 'editor') {
  const { data, error } = await supabase
    .from('hotel_collaborators')
    .update({ permission })
    .eq('id', id)
    .select(`
      *,
      profile:profiles!hotel_collaborators_shared_with_id_fkey(
        id, email, full_name, font_family, font_scale, theme_preference
      )
    `)
    .single();

  if (error) throw error;
  return normalizeCollaborator(data);
}

export async function removeCollaborator(id: string) {
  const { error } = await supabase
    .from('hotel_collaborators')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
