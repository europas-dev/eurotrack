import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── NORMALIZERS ──────────────────────────────────────────────────────────────
function normalizeEmployee(e: any) {
  if (!e) return null;
  return {
    ...e,
    durationId: e.durationid ?? e.durationId,
    slotIndex:  e.slotindex  ?? e.slotIndex,
    checkIn:    e.checkin    ?? e.checkIn,
    checkOut:   e.checkout   ?? e.checkOut,
  };
}

function normalizeDuration(d: any) {
  return {
    ...d,
    hotelId:              d.hotelid              ?? d.hotelId,
    startDate:            d.startdate            ?? d.startDate,
    endDate:              d.enddate              ?? d.endDate,
    roomType:             d.roomtype             ?? d.roomType,
    numberOfRooms:        d.numberofrooms        ?? d.numberOfRooms,
    pricePerNightPerRoom: d.pricepernightperroom ?? d.pricePerNightPerRoom,
    hasDiscount:          d.hasdiscount          ?? d.hasDiscount,
    discountType:         d.discounttype         ?? d.discountType,
    discountValue:        d.discountvalue        ?? d.discountValue,
    isPaid:               d.ispaid               ?? d.isPaid,
    bookingId:            d.bookingid            ?? d.bookingId,
    extensionNote:        d.extensionnote        ?? d.extensionNote,
    autoDistribute:       d.autodistribute       ?? d.autoDistribute,
    useManualPrices:      d.usemanualprice       ?? d.useManualPrices,
    nightlyPrices:        d.nightlyprices        ?? d.nightlyPrices ?? {},
    employees: (d.employees || []).map(normalizeEmployee),
  };
}

function normalizeHotel(h: any) {
  return {
    ...h,
    companyTag:    h.companytag    ?? h.companyTag,
    company:       h.companytag    ?? h.companyTag,
    webLink:       h.weblink       ?? h.webLink,
    contactPerson: h.contactperson ?? h.contactPerson,
    durations: (h.durations || []).map(normalizeDuration),
  };
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
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

// ─── HOTELS ───────────────────────────────────────────────────────────────────
export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('*, durations(*, employees(*))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeHotel);
}

export async function createHotel(data: {
  name: string;
  city: string;
  companyTag?: string;
  company?: string;
  address?: string;
  contact?: string;
  email?: string;
  webLink?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: result, error } = await supabase
    .from('hotels')
    .insert({
      name:       data.name,
      city:       data.city,
      companytag: data.companyTag ?? data.company ?? '',
      address:    data.address    ?? null,
      contact:    data.contact    ?? null,
      email:      data.email      ?? null,
      weblink:    data.webLink    ?? null,
      userid:     user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeHotel({ ...result, durations: [] });
}

export async function updateHotel(id: string, data: any) {
  const { error } = await supabase
    .from('hotels')
    .update({
      name:          data.name,
      city:          data.city,
      companytag:    data.companyTag    ?? data.companytag,
      address:       data.address,
      contact:       data.contact,
      email:         data.email,
      weblink:       data.webLink       ?? data.weblink,
      contactperson: data.contactPerson ?? data.contactperson,
      notes:         data.notes,
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
    .insert({
      hotelid:              data.hotelId,
      startdate:            data.startDate            ?? '',
      enddate:              data.endDate              ?? '',
      roomtype:             data.roomType             ?? 'DZ',
      numberofrooms:        data.numberOfRooms        ?? 1,
      pricepernightperroom: data.pricePerNightPerRoom ?? 0,
      hasdiscount:          data.hasDiscount          ?? false,
      discounttype:         data.discountType         ?? 'percentage',
      discountvalue:        data.discountValue        ?? 0,
      ispaid:               data.isPaid               ?? false,
      bookingid:            data.bookingId            ?? null,
      usemanualprice:       data.useManualPrices      ?? false,
      nightlyprices:        data.nightlyPrices        ?? {},
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeDuration({ ...result, employees: [] });
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
      hasdiscount:          data.hasDiscount          ?? data.hasdiscount,
      discounttype:         data.discountType         ?? data.discounttype,
      discountvalue:        data.discountValue        ?? data.discountvalue,
      ispaid:               data.isPaid               ?? data.ispaid,
      bookingid:            data.bookingId            ?? data.bookingid,
      extensionnote:        data.extensionNote        ?? data.extensionnote,
      usemanualprice:       data.useManualPrices      ?? data.usemanualprice,
      nightlyprices:        data.nightlyPrices        ?? data.nightlyprices,
      autodistribute:       data.autoDistribute       ?? data.autodistribute,
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
    .insert({
      durationid: durationId,
      slotindex:  slotIndex,
      name:       data.name,
      checkin:    data.checkIn  ?? null,
      checkout:   data.checkOut ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeEmployee(result);
}

export async function updateEmployee(id: string, data: any) {
  const { error } = await supabase
    .from('employees')
    .update({
      name:     data.name,
      checkin:  data.checkIn  ?? data.checkin,
      checkout: data.checkOut ?? data.checkout,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
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
    if (error.code === 'PGRST116') return { id: user.id, email: user.email };
    throw error;
  }

  return {
    ...data,
    fullName:   data.full_name   ?? data.fullname,
    fontFamily: data.font_family ?? data.fontfamily ?? 'inter',
    fontScale:  data.font_scale  ?? data.fontscale  ?? 100,
    avatarUrl:  data.avatar_url  ?? data.avatarurl,
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
    fullName:   data.full_name   ?? data.fullname,
    fontFamily: data.font_family ?? data.fontfamily ?? 'inter',
    fontScale:  data.font_scale  ?? data.fontscale  ?? 100,
    avatarUrl:  data.avatar_url  ?? data.avatarurl,
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
    fullName: p.full_name ?? p.fullname,
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

export async function updateCollaboratorPermission(shareId: string, permission: 'viewer' | 'editor') {
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
  const { error } = await supabase.from('workspace_shares').delete().eq('id', shareId);
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

// ─── OFFLINE QUEUE ────────────────────────────────────────────────────────────
const QUEUE_KEY = 'eurotrack_offline_queue';

interface QueuedOp {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

function loadQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueue(q: QueuedOp[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
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
      if (op.type === 'updateHotel')    await updateHotel(op.payload.id, op.payload.fields);
      if (op.type === 'updateDuration') await updateDuration(op.payload.id, op.payload.fields);
      if (op.type === 'deleteDuration') await deleteDuration(op.payload.id);
      if (op.type === 'updateEmployee') await updateEmployee(op.payload.id, op.payload.fields);
    } catch {
      failed.push(op);
    }
  }
  saveQueue(failed);
}

// Auto-sync when connection returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { syncOfflineQueue().catch(console.error); });
}
