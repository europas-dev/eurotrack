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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
    employees: (d.employees || []).map((e: any) => normalizeEmployee(e)),
  };
}

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

function normalizeHotel(h: any) {
  return {
    ...h,
    companyTag: h.company_tag ?? h.companyTag,
    webLink: h.web_link ?? h.webLink,
    durations: (h.durations || []).map(normalizeDuration),
  };
}

// ─── HOTELS ──────────────────────────────────────────────────────────────────

export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select(`*, durations(*, employees(*))`)
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
  email?: string;
  webLink?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: result, error } = await supabase
    .from('hotels')
    .insert([{
      name: data.name,
      city: data.city,
      company_tag: data.companyTag,
      address: data.address || null,
      contact: data.contact || null,
      email: data.email || null,
      web_link: data.webLink || null,
      user_id: user.id,
    }])
    .select()
    .single();
  if (error) throw error;
  return normalizeHotel({ ...result, durations: [] });
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
      email: data.email,
      web_link: data.webLink ?? data.web_link,
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
      start_date: data.startDate,
      end_date: data.endDate,
      room_type: data.roomType ?? 'DZ',
      number_of_rooms: data.numberOfRooms ?? 1,
      price_per_night_per_room: data.pricePerNightPerRoom ?? 0,
      has_discount: data.hasDiscount ?? false,
      discount_type: data.discountType ?? 'percentage',
      discount_value: data.discountValue ?? 0,
      is_paid: data.isPaid ?? false,
      booking_id: data.bookingId ?? null,
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
