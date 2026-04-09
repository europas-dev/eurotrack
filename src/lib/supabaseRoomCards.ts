// src/lib/supabaseRoomCards.ts
import { supabase } from './supabase'
import type { RoomCard, Employee } from './types'

function normalizeEmployee(e: any): Employee | null {
  if (!e || typeof e !== 'object') return null
  return {
    id:         e.id,
    durationId: e.durationid  ?? e.durationId  ?? '',
    roomCardId: e.room_card_id ?? e.roomCardId ?? null,
    slotIndex:  e.slot_index  ?? e.slotIndex  ?? e.slotindex ?? 0,
    name:       e.name        ?? '',
    checkIn:    e.checkin     ?? e.checkIn     ?? undefined,
    checkOut:   e.checkout    ?? e.checkOut    ?? undefined,
  }
}

function normalizeRoomCard(r: any): RoomCard {
  return {
    id:               r.id,
    durationId:       r.durationid       ?? r.durationId,
    roomNo:           r.room_no          ?? '',
    floor:            r.floor            ?? '',
    roomType:         r.room_type        ?? 'DZ',
    bedCount:         r.bed_count        ?? 2,
    nightlyPrice:     r.nightly_price    ?? 0,
    pricePerBed:      r.price_per_bed    ?? false,
    pricePerBedAmount:r.price_per_bed_amount ?? 0,
    useBruttoNetto:   r.use_brutto_netto ?? false,
    brutto:           r.brutto           ?? null,
    netto:            r.netto            ?? null,
    mwst:             r.mwst             ?? null,
    useManualPrices:  r.use_manual_prices ?? false,
    nightlyPrices:    r.nightly_prices   ?? {},
    hasDiscount:      r.has_discount     ?? false,
    discountType:     r.discount_type    ?? 'percentage',
    discountValue:    r.discount_value   ?? 0,
    pricingSynced:    r.price_synced     ?? false,
    pricingMode:      r.pricing_mode     ?? 'simple',
    sortOrder:        r.sort_order       ?? 0,
    employees:        (r.employees ?? []).map(normalizeEmployee).filter(Boolean) as Employee[],
  }
}

export async function getRoomCardsForDuration(durationId: string): Promise<RoomCard[]> {
  const { data, error } = await supabase
    .from('room_cards')
    .select('*, employees(*)')
    .eq('durationid', durationId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(normalizeRoomCard)
}

export async function createRoomCard(durationId: string, roomType: string, bedCount: number, sortOrder: number): Promise<RoomCard> {
  const { data, error } = await supabase
    .from('room_cards')
    .insert({
      durationid: durationId,
      room_type:  roomType,
      bed_count:  bedCount,
      sort_order: sortOrder,
      nightly_price: 0,
      price_per_bed: false,
      price_per_bed_amount: 0,
      use_brutto_netto: false,
      use_manual_prices: false,
      nightly_prices: {},
      has_discount: false,
      discount_type: 'percentage',
      discount_value: 0,
      price_synced: false,
      pricing_mode: 'simple',
    })
    .select().single()
  if (error) throw error
  return normalizeRoomCard({ ...data, employees: [] })
}

export async function updateRoomCard(id: string, patch: Partial<RoomCard>): Promise<void> {
  const row: any = {}
  if (patch.roomNo           !== undefined) row.room_no              = patch.roomNo
  if (patch.floor            !== undefined) row.floor                = patch.floor
  if (patch.roomType         !== undefined) row.room_type            = patch.roomType
  if (patch.bedCount         !== undefined) row.bed_count            = patch.bedCount
  if (patch.nightlyPrice     !== undefined) row.nightly_price        = patch.nightlyPrice
  if (patch.pricePerBed      !== undefined) row.price_per_bed        = patch.pricePerBed
  if (patch.pricePerBedAmount!== undefined) row.price_per_bed_amount = patch.pricePerBedAmount
  if (patch.useBruttoNetto   !== undefined) row.use_brutto_netto     = patch.useBruttoNetto
  if (patch.brutto           !== undefined) row.brutto               = patch.brutto
  if (patch.netto            !== undefined) row.netto                = patch.netto
  if (patch.mwst             !== undefined) row.mwst                 = patch.mwst
  if (patch.useManualPrices  !== undefined) row.use_manual_prices    = patch.useManualPrices
  if (patch.nightlyPrices    !== undefined) row.nightly_prices       = patch.nightlyPrices
  if (patch.hasDiscount      !== undefined) row.has_discount         = patch.hasDiscount
  if (patch.discountType     !== undefined) row.discount_type        = patch.discountType
  if (patch.discountValue    !== undefined) row.discount_value       = patch.discountValue
  if (patch.pricingSynced    !== undefined) row.price_synced         = patch.pricingSynced
  if (patch.pricingMode      !== undefined) row.pricing_mode         = patch.pricingMode
  const { error } = await supabase.from('room_cards').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteRoomCard(id: string): Promise<void> {
  const { error } = await supabase.from('room_cards').delete().eq('id', id)
  if (error) throw error
}

// ── Employees linked to room cards ──────────────────────────────────────────
export async function createRoomCardEmployee(
  roomCardId: string,
  durationId: string,
  slotIndex: number,
  data: { name: string; checkIn?: string; checkOut?: string }
): Promise<Employee> {
  const { data: result, error } = await supabase
    .from('employees')
    .insert({
      room_card_id: roomCardId,
      durationid:   durationId,
      slot_index:   slotIndex,
      name:         data.name,
      checkin:      data.checkIn  ?? null,
      checkout:     data.checkOut ?? null,
    })
    .select().single()
  if (error) throw error
  return normalizeEmployee(result)!
}

export async function updateRoomCardEmployee(
  id: string,
  data: { name?: string; checkIn?: string; checkOut?: string }
): Promise<void> {
  const { error } = await supabase.from('employees').update({
    name:     data.name,
    checkin:  data.checkIn  ?? null,
    checkout: data.checkOut ?? null,
  }).eq('id', id)
  if (error) throw error
}

export async function deleteRoomCardEmployee(id: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error
}
