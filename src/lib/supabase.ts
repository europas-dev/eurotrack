// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// ─── NORMALIZERS ──────────────────────────────────────────────────────────────
function normalizeEmployee(e: any) {
  if (!e) return null;
  return {
    ...e,
    durationId: e.duration_id ?? e.durationId,
    slotIndex:  e.slot_index  ?? e.slotIndex,
    checkIn:    e.check_in    ?? e.checkIn,
    checkOut:   e.check_out   ?? e.checkOut,
  };
}

function normalizeDuration(d: any) {
  return {
    ...d,
    hotelId:               d.hotel_id                ?? d.hotelId,
    startDate:             d.start_date              ?? d.startDate,
    endDate:               d.end_date                ?? d.endDate,
    roomType:              d.room_type               ?? d.roomType,
    numberOfRooms:         d.number_of_rooms         ?? d.numberOfRooms,
    wgBeds:                d.wg_beds                 ?? d.wgBeds,
    pricePerNightPerRoom:  d.price_per_night_per_room ?? d.pricePerNightPerRoom,
    totalPriceOverride:    d.total_price_override    ?? d.totalPriceOverride,
    useManualPrices:       d.use_manual_prices       ?? d.useManualPrices,
    nightlyPrices:         d.nightly_prices          ?? d.nightlyPrices,
    nettoPrice:            d.netto_price             ?? d.nettoPrice,
    bruttoPrice:           d.brutto_price            ?? d.bruttoPrice,
    mwst:                  d.mwst,
    hasDiscount:           d.has_discount            ?? d.hasDiscount,
    discountType:          d.discount_type           ?? d.discountType,
    discountValue:         d.discount_value          ?? d.discountValue,
    isPaid:                d.is_paid                 ?? d.isPaid,
    hasDeposit:            d.has_deposit             ?? d.hasDeposit,
    depositAmount:         d.deposit_amount          ?? d.depositAmount,
    invoiceNo:             d.invoice_no              ?? d.invoiceNo,
    bookingId:             d.booking_id              ?? d.bookingId,
    roomNo:                d.room_no                 ?? d.roomNo,
    floor:                 d.floor,
    employees: (d.employees || []).map(normalizeEmployee),
  };
}

function normalizeHotel(h: any) {
  return {
    ...h,
    companyTag:    h.company_tag     ?? h.companyTag,
    webLink:       h.web_link        ?? h.webLink,
    contactPerson: h.contact_person  ?? h.contactPerson ?? h.contact,
    lastUpdatedBy: h.last_updated_by ?? h.lastUpdatedBy,
    lastUpdatedAt: h.last_updated_at ?? h.lastUpdatedAt,
    durations: (h.durations || []).map(normalizeDuration),
  };
}

// ─── HOTELS ───────────────────────────────────────────────────────────────────
export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select(`*, durations(*, employees(*))`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeHotel);
}

export async function createHotel(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: result, error } = await supabase
    .from('hotels')
    .insert([{
      name:            data.name          || '',
      city:            data.city          || '',
      company_tag:     data.companyTag    || '',
      address:         data.address       || null,
      contact_person:  data.contactPerson || null,
      email:           data.email         || null,
      web_link:        data.webLink       || null,
      notes:           data.notes         || null,
      user_id:         user?.id           || null,
      last_updated_by: user?.email        || null,
      last_updated_at: new Date().toISOString(),
    }])
    .select()
    .single();
  if (error) throw error;
  return normalizeHotel({ ...result, durations: [] });
}

export async function updateHotel(id: string, data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('hotels')
    .update({
      name:            data.name,
      city:            data.city,
      company_tag:     data.companyTag    ?? data.company_tag,
      address:         data.address,
      contact_person:  data.contactPerson ?? data.contact,
      email:           data.email,
      web_link:        data.webLink       ?? data.web_link,
      notes:           data.notes,
      last_updated_by: user?.email        || null,
      last_updated_at: new Date().toISOString(),
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
      hotel_id:                 data.hotelId,
      start_date:               data.startDate              || null,
      end_date:                 data.endDate                || null,
      room_type:                data.roomType               || 'DZ',
      number_of_rooms:          data.numberOfRooms          || 1,
      wg_beds:                  data.wgBeds                 || null,
      price_per_night_per_room: data.pricePerNightPerRoom   || 0,
      total_price_override:     data.totalPriceOverride     || null,
      use_manual_prices:        data.useManualPrices        || false,
      nightly_prices:           data.nightlyPrices          || null,
      netto_price:              data.nettoPrice             || null,
      brutto_price:             data.bruttoPrice            || null,
      mwst:                     data.mwst                   || null,
      has_discount:             data.hasDiscount            || false,
      discount_type:            data.discountType           || 'percentage',
      discount_value:           data.discountValue          || 0,
      is_paid:                  data.isPaid                 || false,
      has_deposit:              data.hasDeposit             || false,
      deposit_amount:           data.depositAmount          || null,
      invoice_no:               data.invoiceNo              || null,
      booking_id:               data.bookingId              || null,
      room_no:                  data.roomNo                 || null,
      floor:                    data.floor                  || null,
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
      start_date:               data.startDate             ?? data.start_date,
      end_date:                 data.endDate               ?? data.end_date,
      room_type:                data.roomType              ?? data.room_type,
      number_of_rooms:          data.numberOfRooms         ?? data.number_of_rooms,
      wg_beds:                  data.wgBeds                ?? data.wg_beds,
      price_per_night_per_room: data.pricePerNightPerRoom  ?? data.price_per_night_per_room,
      total_price_override:     data.totalPriceOverride    ?? data.total_price_override,
      use_manual_prices:        data.useManualPrices       ?? data.use_manual_prices,
      nightly_prices:           data.nightlyPrices         ?? data.nightly_prices,
      netto_price:              data.nettoPrice            ?? data.netto_price,
      brutto_price:             data.bruttoPrice           ?? data.brutto_price,
      mwst:                     data.mwst,
      has_discount:             data.hasDiscount           ?? data.has_discount,
      discount_type:            data.discountType          ?? data.discount_type,
      discount_value:           data.discountValue         ?? data.discount_value,
      is_paid:                  data.isPaid                ?? data.is_paid,
      has_deposit:              data.hasDeposit            ?? data.has_deposit,
      deposit_amount:           data.depositAmount         ?? data.deposit_amount,
      invoice_no:               data.invoiceNo             ?? data.invoice_no,
      booking_id:               data.bookingId             ?? data.booking_id,
      room_no:                  data.roomNo                ?? data.room_no,
      floor:                    data.floor,
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
      slot_index:  slotIndex,
      name:        data.name,
      check_in:    data.checkIn  || null,
      check_out:   data.checkOut || null,
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
      name:      data.name,
      check_in:  data.checkIn  ?? data.check_in,
      check_out: data.checkOut ?? data.check_out,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}
