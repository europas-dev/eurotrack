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

// ─── HOTELS ──────────────────────────────────────────────────────────────────

export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select(`
      *,
      durations (
        *,
        employees (*)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Normalize snake_case from DB to camelCase
  return (data || []).map((h: any) => ({
    ...h,
    companyTag: h.company_tag,
    webLink: h.web_link,
    durations: (h.durations || []).map((d: any) => ({
      ...d,
      hotelId: d.hotel_id,
      startDate: d.start_date,
      endDate: d.end_date,
      roomType: d.room_type,
      numberOfRooms: d.number_of_rooms,
      pricePerNightPerRoom: d.price_per_night_per_room,
      hasDiscount: d.has_discount,
      discountType: d.discount_type,
      discountValue: d.discount_value,
      isPaid: d.is_paid,
      bookingId: d.booking_id,
      employees: (d.employees || []).map((e: any) => ({
        ...e,
        durationId: e.duration_id,
        slotIndex: e.slot_index,
        checkIn: e.check_in,
        checkOut: e.check_out,
      })),
    })),
  }));
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
    }])
    .select()
    .single();

  if (error) throw error;
  return { ...result, companyTag: result.company_tag, webLink: result.web_link };
}

export async function updateHotel(id: string, data: any) {
  const { error } = await supabase
    .from('hotels')
    .update({
      name: data.name,
      city: data.city,
      company_tag: data.companyTag || data.company_tag,
      address: data.address,
      contact: data.contact,
      email: data.email,
      web_link: data.webLink || data.web_link,
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
      room_type: data.roomType || 'DZ',
      number_of_rooms: data.numberOfRooms || 1,
      price_per_night_per_room: data.pricePerNightPerRoom || 0,
      has_discount: data.hasDiscount || false,
      discount_type: data.discountType || 'percentage',
      discount_value: data.discountValue || 0,
      is_paid: data.isPaid || false,
      booking_id: data.bookingId || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return {
    ...result,
    hotelId: result.hotel_id,
    startDate: result.start_date,
    endDate: result.end_date,
    roomType: result.room_type,
    numberOfRooms: result.number_of_rooms,
    pricePerNightPerRoom: result.price_per_night_per_room,
    hasDiscount: result.has_discount,
    discountType: result.discount_type,
    discountValue: result.discount_value,
    isPaid: result.is_paid,
    bookingId: result.booking_id,
  };
}

export async function updateDuration(id: string, data: any) {
  const { error } = await supabase
    .from('durations')
    .update({
      start_date: data.startDate,
      end_date: data.endDate,
      room_type: data.roomType,
      number_of_rooms: data.numberOfRooms,
      price_per_night_per_room: data.pricePerNightPerRoom,
      has_discount: data.hasDiscount,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      is_paid: data.isPaid,
      booking_id: data.bookingId,
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
      check_in: data.checkIn || null,
      check_out: data.checkOut || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return { ...result, durationId: result.duration_id, slotIndex: result.slot_index, checkIn: result.check_in, checkOut: result.check_out };
}

export async function updateEmployee(id: string, data: any) {
  const { error } = await supabase
    .from('employees')
    .update({
      name: data.name,
      check_in: data.checkIn,
      check_out: data.checkOut,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}
