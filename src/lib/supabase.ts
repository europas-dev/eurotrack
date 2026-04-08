import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── HOTELS ───────────────────────────────────────────────────────────────────
export async function getHotels() {
  const { data: { user } } = await supabase.auth.getUser();
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
  return (data || []).map(normalizeHotel);
}

export async function createHotel(fields: {
  name: string;
  city: string;
  company: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hotels')
    .insert([{
      user_id:     user.id,
      name:        fields.name,
      city:        fields.city,
      company_tag: fields.company,
    }])
    .select()
    .single();

  if (error) throw error;
  return normalizeHotel({ ...data, durations: [] });
}

export async function updateHotel(id: string, fields: any) {
  const payload: Record<string, any> = {};
  if (fields.name        !== undefined) payload.name        = fields.name;
  if (fields.city        !== undefined) payload.city        = fields.city;
  if (fields.companyTag  !== undefined) payload.company_tag = fields.companyTag;
  if (fields.company     !== undefined) payload.company_tag = fields.company;
  if (fields.address     !== undefined) payload.address     = fields.address;
  if (fields.contact     !== undefined) payload.contact     = fields.contact;
  if (fields.email       !== undefined) payload.email       = fields.email;
  if (fields.webLink     !== undefined) payload.web_link    = fields.webLink;
  if (fields.notes       !== undefined) payload.notes       = fields.notes;
  if (fields.contactPerson !== undefined) payload.contact_person = fields.contactPerson;

  const { data, error } = await supabase
    .from('hotels')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHotel(id: string) {
  const { error } = await supabase
    .from('hotels')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── DURATIONS ────────────────────────────────────────────────────────────────
export async function createDuration(fields: {
  hotelId: string;
  startDate: string;
  endDate: string;
  roomType: string;
  numberOfRooms: number;
  pricePerNightPerRoom: number;
  hasDiscount: boolean;
  discountType: string;
  discountValue: number;
  isPaid: boolean;
  bookingId?: string | null;
  useManualPrices?: boolean;
  nightlyPrices?: Record<string, number>;
}) {
  const { data, error } = await supabase
    .from('durations')
    .insert([{
      hotel_id:                fields.hotelId,
      start_date:              fields.startDate,
      end_date:                fields.endDate,
      room_type:               fields.roomType,
      number_of_rooms:         fields.numberOfRooms,
      price_per_night_per_room: fields.pricePerNightPerRoom,
      has_discount:            fields.hasDiscount,
      discount_type:           fields.discountType,
      discount_value:          fields.discountValue,
      is_paid:                 fields.isPaid,
      booking_id:              fields.bookingId ?? null,
      use_manual_prices:       fields.useManualPrices ?? false,
      nightly_prices:          fields.nightlyPrices ?? {},
    }])
    .select(`*, employees (*)`)
    .single();

  if (error) throw error;
  return normalizeDuration(data);
}

export async function updateDuration(id: string, fields: any) {
  const payload: Record<string, any> = {};
  if (fields.startDate             !== undefined) payload.start_date               = fields.startDate;
  if (fields.endDate               !== undefined) payload.end_date                 = fields.endDate;
  if (fields.roomType              !== undefined) payload.room_type                = fields.roomType;
  if (fields.numberOfRooms         !== undefined) payload.number_of_rooms          = fields.numberOfRooms;
  if (fields.pricePerNightPerRoom  !== undefined) payload.price_per_night_per_room = fields.pricePerNightPerRoom;
  if (fields.hasDiscount           !== undefined) payload.has_discount             = fields.hasDiscount;
  if (fields.discountType          !== undefined) payload.discount_type            = fields.discountType;
  if (fields.discountValue         !== undefined) payload.discount_value           = fields.discountValue;
  if (fields.isPaid                !== undefined) payload.is_paid                  = fields.isPaid;
  if (fields.bookingId             !== undefined) payload.booking_id               = fields.bookingId;
  if (fields.extensionNote         !== undefined) payload.extension_note           = fields.extensionNote;
  if (fields.useManualPrices       !== undefined) payload.use_manual_prices        = fields.useManualPrices;
  if (fields.nightlyPrices         !== undefined) payload.nightly_prices           = fields.nightlyPrices;
  if (fields.autoDistribute        !== undefined) payload.auto_distribute          = fields.autoDistribute;

  const { data, error } = await supabase
    .from('durations')
    .update(payload)
    .eq('id', id)
    .select(`*, employees (*)`)
    .single();

  if (error) throw error;
  return normalizeDuration(data);
}

export async function deleteDuration(id: string) {
  const { error } = await supabase
    .from('durations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────
export async function upsertEmployees(
  durationId: string,
  employees: { id?: string; name: string | null; checkIn: string; checkOut: string }[]
) {
  // Delete existing and re-insert for simplicity
  await supabase.from('employees').delete().eq('duration_id', durationId);

  const rows = employees
    .filter(e => e !== null)
    .map(e => ({
      duration_id: durationId,
      name:        e.name,
      check_in:    e.checkIn,
      check_out:   e.checkOut,
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from('employees')
    .insert(rows)
    .select();

  if (error) throw error;
  return (data || []).map(normalizeEmployee);
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    // Profile row doesn't exist yet — return minimal object
    if (error.code === 'PGRST116') return { id: user.id, email: user.email };
    throw error;
  }

  return {
    ...data,
    fullName:   data.full_name,
    fontFamily: data.font_family,
    fontScale:  data.font_scale,
    avatarUrl:  data.avatar_url,
  };
}

export async function updateMyProfile(updates: {
  fullName?: string;
  fontFamily?: string;
  fontScale?: number;
  avatarUrl?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload: Record<string, any> = { id: user.id };
  if (updates.fullName   !== undefined) payload.full_name   = updates.fullName;
  if (updates.avatarUrl  !== undefined) payload.avatar_url  = updates.avatarUrl;
  if (updates.fontFamily !== undefined) payload.font_family = updates.fontFamily;
  if (updates.fontScale  !== undefined) payload.font_scale  = updates.fontScale;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    fullName:   data.full_name,
    fontFamily: data.font_family,
    fontScale:  data.font_scale,
    avatarUrl:  data.avatar_url,
  };
}

export async function searchProfiles(query: string) {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;

  return (data || []).map((p: any) => ({
    ...p,
    fullName: p.full_name,
  }));
}

// ─── COLLABORATORS ────────────────────────────────────────────────────────────
export async function inviteCollaborator(
  hotelId: string,
  sharedWithId: string,
  permission: 'viewer' | 'editor'
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('workspace_shares')
    .insert([{
      owner_id:       user.id,
      hotel_id:       hotelId,
      shared_with_id: sharedWithId,
      permission,
    }])
    .select('*, profile:shared_with_id(id, full_name, email)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateCollaboratorPermission(
  shareId: string,
  permission: 'viewer' | 'editor'
) {
  const { data, error } = await supabase
    .from('workspace_shares')
    .update({ permission })
    .eq('id', shareId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeCollaborator(shareId: string) {
  const { error } = await supabase
    .from('workspace_shares')
    .delete()
    .eq('id', shareId);

  if (error) throw error;
}

export async function getCollaborators() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('workspace_shares')
    .select('*, profile:shared_with_id(id, full_name, email)')
    .eq('owner_id', user.id);

  if (error) throw error;
  return data || [];
}

// ─── OFFLINE SYNC ─────────────────────────────────────────────────────────────
const QUEUE_KEY = 'eurotrack_offline_queue';

interface QueuedOp {
  id: string;
  type: 'updateHotel' | 'updateDuration' | 'createHotel' | 'deleteDuration';
  payload: any;
  timestamp: number;
}

function loadQueue(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function hasQueuedOps(): boolean {
  return loadQueue().length > 0;
}

export function queueOp(op: Omit<QueuedOp, 'id' | 'timestamp'>) {
  const q = loadQueue();
  q.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
  saveQueue(q);
}

export async function syncOfflineQueue() {
  const q = loadQueue();
  if (!q.length) return;

  const failed: QueuedOp[] = [];

  for (const op of q) {
    try {
      if (op.type === 'updateHotel') {
        await updateHotel(op.payload.id, op.payload.fields);
      } else if (op.type === 'updateDuration') {
        await updateDuration(op.payload.id, op.payload.fields);
      } else if (op.type === 'deleteDuration') {
        await deleteDuration(op.payload.id);
      }
    } catch {
      failed.push(op);
    }
  }

  saveQueue(failed);
}

// Auto-sync when connection returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineQueue().catch(console.error);
  });
}

// ─── NORMALIZERS (snake_case → camelCase) ──────────────────────────────────────
function normalizeHotel(h: any) {
  return {
    id:            h.id,
    userId:        h.user_id,
    name:          h.name,
    city:          h.city,
    companyTag:    h.company_tag,
    company:       h.company_tag,   // alias so both work
    address:       h.address,
    contact:       h.contact,
    contactPerson: h.contact_person,
    email:         h.email,
    webLink:       h.web_link,
    notes:         h.notes,
    createdAt:     h.created_at,
    updatedAt:     h.updated_at,
    durations:     (h.durations || []).map(normalizeDuration),
  };
}

function normalizeDuration(d: any) {
  return {
    id:                   d.id,
    hotelId:              d.hotel_id,
    bookingId:            d.booking_id,
    startDate:            d.start_date,
    endDate:              d.end_date,
    roomType:             d.room_type,
    numberOfRooms:        d.number_of_rooms,
    pricePerNightPerRoom: d.price_per_night_per_room,
    hasDiscount:          d.has_discount,
    discountType:         d.discount_type,
    discountValue:        d.discount_value,
    isPaid:               d.is_paid,
    extensionNote:        d.extension_note,
    autoDistribute:       d.auto_distribute,
    useManualPrices:      d.use_manual_prices,
    nightlyPrices:        d.nightly_prices ?? {},
    employees:            (d.employees || []).map(normalizeEmployee),
  };
}

function normalizeEmployee(e: any) {
  if (!e) return null;
  return {
    id:       e.id,
    name:     e.name,
    checkIn:  e.check_in,
    checkOut: e.check_out,
  };
}
