// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { enqueue, getQueue, removeFromQueue } from './offlineQueue';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function isOnline() { return navigator.onLine; }

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

// ─── NORMALIZERS ─────────────────────────────────────────────────────────────
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
    hotelId:             d.hotel_id              ?? d.hotelId,
    startDate:           d.start_date            ?? d.startDate,
    endDate:             d.end_date              ?? d.endDate,
    roomType:            d.room_type             ?? d.roomType,
    numberOfRooms:       d.number_of_rooms       ?? d.numberOfRooms,
    pricePerNightPerRoom:d.price_per_night_per_room ?? d.pricePerNightPerRoom,
    hasDiscount:         d.has_discount          ?? d.hasDiscount,
    discountType:        d.discount_type         ?? d.discountType,
    discountValue:       d.discount_value        ?? d.discountValue,
    isPaid:              d.is_paid               ?? d.isPaid,
    bookingId:           d.booking_id            ?? d.bookingId,
    useManualPrices:     d.use_manual_prices     ?? d.useManualPrices  ?? false,
    nightlyPrices:       d.nightly_prices        ?? d.nightlyPrices    ?? {},
    extensionNote:       d.extension_note        ?? d.extensionNote    ?? '',
    autoDistribute:      d.auto_distribute       ?? d.autoDistribute   ?? false,
    employees: (d.employees || []).map((e: any) => normalizeEmployee(e)),
  };
}

function normalizeHotel(h: any) {
  return {
    ...h,
    company:       h.company_tag ?? h.companyTag ?? h.company ?? '',
    companyTag:    h.company_tag ?? h.companyTag ?? '',
    webLink:       h.web_link    ?? h.webLink    ?? '',
    contactPerson: h.contact_person ?? h.contactPerson ?? '',
    durations: (h.durations || []).map(normalizeDuration),
  };
}

// ─── HOTELS ──────────────────────────────────────────────────────────────────
export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('*, durations(*, employees(*))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeHotel);
}

export async function createHotel(data: {
  name: string; city: string; company: string;
  address?: string; contact?: string; contactPerson?: string;
  email?: string; webLink?: string; notes?: string;
}) {
  const payload = {
    name: data.name,
    city: data.city,
    company_tag:    data.company,
    address:        data.address       || null,
    contact:        data.contact       || null,
    contact_person: data.contactPerson || null,
    email:          data.email         || null,
    web_link:       data.webLink       || null,
    notes:          data.notes         || null,
  };
  if (!isOnline()) {
    const tempId = crypto.randomUUID();
    enqueue({ type: 'createHotel', payload: { ...payload, tempId } });
    return normalizeHotel({ id: tempId, ...payload, durations: [], created_at: new Date().toISOString() });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: result, error } = await supabase
    .from('hotels').insert([{ ...payload, user_id: user.id }]).select().single();
  if (error) throw error;
  return normalizeHotel({ ...result, durations: [] });
}

export async function updateHotel(id: string, data: any) {
  const payload = {
    name:           data.name,
    city:           data.city,
    company_tag:    data.company ?? data.companyTag ?? data.company_tag,
    address:        data.address        ?? null,
    contact:        data.contact        ?? null,
    contact_person: data.contactPerson  ?? data.contact_person ?? null,
    email:          data.email          ?? null,
    web_link:       data.webLink        ?? data.web_link ?? null,
    notes:          data.notes          ?? null,
  };
  if (!isOnline()) { enqueue({ type: 'updateHotel', payload: { id, ...payload } }); return; }
  const { error } = await supabase.from('hotels').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteHotel(id: string) {
  if (!isOnline()) { enqueue({ type: 'deleteHotel', payload: { id } }); return; }
  const { error } = await supabase.from('hotels').delete().eq('id', id);
  if (error) throw error;
}

// ─── DURATIONS ────────────────────────────────────────────────────────────────
export async function createDuration(data: any) {
  const payload = {
    hotel_id:                 data.hotelId,
    start_date:               data.startDate              || null,
    end_date:                 data.endDate                || null,
    room_type:                data.roomType               ?? 'DZ',
    number_of_rooms:          data.numberOfRooms          ?? 1,
    price_per_night_per_room: data.pricePerNightPerRoom   ?? 0,
    has_discount:             data.hasDiscount            ?? false,
    discount_type:            data.discountType           ?? 'percentage',
    discount_value:           data.discountValue          ?? 0,
    is_paid:                  data.isPaid                 ?? false,
    booking_id:               data.bookingId              ?? null,
    use_manual_prices:        data.useManualPrices        ?? false,
    nightly_prices:           data.nightlyPrices          ?? {},
    extension_note:           data.extensionNote          ?? null,
    auto_distribute:          data.autoDistribute         ?? false,
  };
  if (!isOnline()) {
    const tempId = crypto.randomUUID();
    enqueue({ type: 'createDuration', payload: { ...payload, tempId } });
    return normalizeDuration({ id: tempId, ...payload, employees: [], created_at: new Date().toISOString() });
  }
  const { data: result, error } = await supabase.from('durations').insert([payload]).select().single();
  if (error) throw error;
  return normalizeDuration({ ...result, employees: [] });
}

export async function updateDuration(id: string, data: any) {
  const payload = {
    start_date:               data.startDate              ?? data.start_date              ?? null,
    end_date:                 data.endDate                ?? data.end_date                ?? null,
    room_type:                data.roomType               ?? data.room_type,
    number_of_rooms:          data.numberOfRooms          ?? data.number_of_rooms,
    price_per_night_per_room: data.pricePerNightPerRoom   ?? data.price_per_night_per_room,
    has_discount:             data.hasDiscount            ?? data.has_discount,
    discount_type:            data.discountType           ?? data.discount_type,
    discount_value:           data.discountValue          ?? data.discount_value,
    is_paid:                  data.isPaid                 ?? data.is_paid,
    booking_id:               data.bookingId              ?? data.booking_id    ?? null,
    use_manual_prices:        data.useManualPrices        ?? data.use_manual_prices ?? false,
    nightly_prices:           data.nightlyPrices          ?? data.nightly_prices   ?? {},
    extension_note:           data.extensionNote          ?? data.extension_note   ?? null,
    auto_distribute:          data.autoDistribute         ?? data.auto_distribute  ?? false,
  };
  if (!isOnline()) { enqueue({ type: 'updateDuration', payload: { id, ...payload } }); return; }
  const { error } = await supabase.from('durations').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteDuration(id: string) {
  if (!isOnline()) { enqueue({ type: 'deleteDuration', payload: { id } }); return; }
  const { error } = await supabase.from('durations').delete().eq('id', id);
  if (error) throw error;
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────
export async function createEmployee(durationId: string, slotIndex: number, data: any) {
  const payload = {
    duration_id: durationId,
    slot_index:  slotIndex,
    name:        data.name,
    check_in:    data.checkIn  ?? null,
    check_out:   data.checkOut ?? null,
  };
  if (!isOnline()) {
    const tempId = crypto.randomUUID();
    enqueue({ type: 'createEmployee', payload: { ...payload, tempId } });
    return normalizeEmployee({ id: tempId, ...payload, created_at: new Date().toISOString() });
  }
  const { data: result, error } = await supabase.from('employees').insert([payload]).select().single();
  if (error) throw error;
  return normalizeEmployee(result);
}

export async function updateEmployee(id: string, data: any) {
  const payload = {
    name:      data.name,
    check_in:  data.checkIn  ?? data.check_in  ?? null,
    check_out: data.checkOut ?? data.check_out ?? null,
  };
  if (!isOnline()) { enqueue({ type: 'updateEmployee', payload: { id, ...payload } }); return; }
  const { error } = await supabase.from('employees').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  if (!isOnline()) { enqueue({ type: 'deleteEmployee', payload: { id } }); return; }
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ─── OFFLINE SYNC ─────────────────────────────────────────────────────────────
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };
  let synced = 0; let failed = 0;
  for (const op of queue) {
    try {
      switch (op.type) {
        case 'createHotel': {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');
          const { tempId, ...p } = op.payload;
          await supabase.from('hotels').insert([{ ...p, user_id: user.id }]);
          break;
        }
        case 'updateHotel':   { const { id, ...p } = op.payload; await supabase.from('hotels').update(p).eq('id', id); break; }
        case 'deleteHotel':   { await supabase.from('hotels').delete().eq('id', op.payload.id); break; }
        case 'createDuration':{ const { tempId, ...p } = op.payload; await supabase.from('durations').insert([p]); break; }
        case 'updateDuration':{ const { id, ...p } = op.payload; await supabase.from('durations').update(p).eq('id', id); break; }
        case 'deleteDuration':{ await supabase.from('durations').delete().eq('id', op.payload.id); break; }
        case 'createEmployee':{ const { tempId, ...p } = op.payload; await supabase.from('employees').insert([p]); break; }
        case 'updateEmployee':{ const { id, ...p } = op.payload; await supabase.from('employees').update(p).eq('id', id); break; }
        case 'deleteEmployee':{ await supabase.from('employees').delete().eq('id', op.payload.id); break; }
      }
      removeFromQueue(op.id);
      synced++;
    } catch (e) {
      console.error('Sync failed for op', op.type, e);
      failed++;
    }
  }
  return { synced, failed };
}
