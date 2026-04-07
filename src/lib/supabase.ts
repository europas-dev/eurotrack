// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Hotel, Duration, Employee, UserProfile, Notification } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });

  if (error) throw error;

  // Create profile
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      email: data.user.email!,
      full_name: fullName,
      role: 'admin'
    });
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ============================================================================
// HOTEL FUNCTIONS
// ============================================================================

export async function getHotels(): Promise<Hotel[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hotels')
    .select(`
      *,
      durations (
        *,
        employees (*)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transform database structure to app structure
  return (data || []).map(hotel => ({
    ...hotel,
    durations: (hotel.durations || []).map((duration: any) => ({
      ...duration,
      employees: Array(getTotalBeds(duration.room_type, duration.number_of_rooms))
        .fill(null)
        .map((_, index) => {
          const emp = duration.employees?.find((e: any) => e.slot_index === index);
          return emp ? {
            id: emp.id,
            name: emp.name,
            checkIn: emp.check_in,
            checkOut: emp.check_out
          } : null;
        })
    }))
  }));
}

function getTotalBeds(roomType: string, numberOfRooms: number): number {
  const capacity = { EZ: 1, DZ: 2, TZ: 3 }[roomType as 'EZ' | 'DZ' | 'TZ'] || 1;
  return capacity * numberOfRooms;
}

export async function createHotel(hotel: Omit<Hotel, 'id' | 'userId' | 'createdAt' | 'durations'>) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hotels')
    .insert({
      user_id: user.id,
      name: hotel.name,
      city: hotel.city,
      address: hotel.address || null,
      contact: hotel.contact || null,
      email: hotel.email || null,
      web_link: hotel.webLink || null,
      company_tag: hotel.companyTag
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHotel(id: string, updates: Partial<Hotel>) {
  const { data, error } = await supabase
    .from('hotels')
    .update({
      name: updates.name,
      city: updates.city,
      address: updates.address,
      contact: updates.contact,
      email: updates.email,
      web_link: updates.webLink,
      company_tag: updates.companyTag
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHotel(id: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// DURATION FUNCTIONS
// ============================================================================

export async function createDuration(duration: Omit<Duration, 'id' | 'employees'> & { hotelId: string }) {
  const { data, error } = await supabase
    .from('durations')
    .insert({
      hotel_id: duration.hotelId,
      booking_id: duration.bookingId || null,
      start_date: duration.startDate,
      end_date: duration.endDate,
      room_type: duration.roomType,
      number_of_rooms: duration.numberOfRooms,
      price_per_night_per_room: duration.pricePerNightPerRoom,
      auto_distribute: duration.autoDistribute,
      nightly_prices: duration.nightlyPrices || null,
      has_discount: duration.hasDiscount,
      discount_type: duration.discountType || null,
      discount_value: duration.discountValue || null,
      is_paid: duration.isPaid,
      extension_note: duration.extensionNote || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDuration(id: string, updates: Partial<Duration>) {
  const { data, error } = await supabase
    .from('durations')
    .update({
      booking_id: updates.bookingId,
      start_date: updates.startDate,
      end_date: updates.endDate,
      room_type: updates.roomType,
      number_of_rooms: updates.numberOfRooms,
      price_per_night_per_room: updates.pricePerNightPerRoom,
      auto_distribute: updates.autoDistribute,
      nightly_prices: updates.nightlyPrices,
      has_discount: updates.hasDiscount,
      discount_type: updates.discountType,
      discount_value: updates.discountValue,
      is_paid: updates.isPaid,
      extension_note: updates.extensionNote
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDuration(id: string) {
  const { error } = await supabase.from('durations').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// EMPLOYEE FUNCTIONS
// ============================================================================

export async function createEmployee(
  durationId: string,
  slotIndex: number,
  employee: Omit<Employee, 'id'>
) {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      duration_id: durationId,
      slot_index: slotIndex,
      name: employee.name,
      check_in: employee.checkIn,
      check_out: employee.checkOut
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .update({
      name: updates.name,
      check_in: updates.checkIn,
      check_out: updates.checkOut
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function getNotifications(): Promise<Notification[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}
