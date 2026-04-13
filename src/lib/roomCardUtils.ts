// src/lib/roomCardUtils.ts
import type { RoomCard } from './types'
import { calculateNights } from './utils'

export function bedsForType(roomType: string, bedCount: number): number {
  if (roomType === 'EZ') return 1
  if (roomType === 'DZ') return 2
  if (roomType === 'TZ') return 3
  if (roomType === 'WG') return Math.max(1, bedCount)
  return 2
}

// ─── Derive brutto from netto + mwst if needed ───────────────────────────────
export function deriveB(brutto: number | null | undefined, netto: number | null | undefined, mwst: number | null | undefined): number {
  if (brutto != null && brutto > 0) return brutto
  if (netto != null && netto > 0) return netto * (1 + (mwst || 0) / 100)
  return 0
}

/**
 * Calculates the room card total based on the active pricing tab.
 *
 * per_bed:    (bedBrutto + bedEnergyBrutto) × beds × nights  − discount
 * per_room:   (roomBrutto + roomEnergyBrutto) × nights       − discount
 * total_room: (totalBrutto + totalEnergyBrutto)              − discount
 */
export function calcRoomCardTotal(
  card: any, // using any to support dynamically added energy keys
  durationStart: string,
  durationEnd: string,
): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0

  const beds = bedsForType(card.roomType, card.bedCount)
  let raw = 0

  const tab = card.pricingTab ?? 'per_room'

  if (tab === 'per_bed') {
    const b = deriveB(card.bedBrutto, card.bedNetto, card.bedMwst)
    const e = deriveB(card.bedEnergyBrutto, card.bedEnergyNetto, card.bedEnergyMwst) || card.bedEnergy || 0
    raw = (b + e) * beds * nights
  } else if (tab === 'total_room') {
    const b = deriveB(card.totalBrutto, card.totalNetto, card.totalMwst)
    const e = deriveB(card.totalEnergyBrutto, card.totalEnergyNetto, card.totalEnergyMwst) || card.totalEnergy || 0
    raw = b + e
  } else {
    // per_room (default)
    if (card.roomBrutto != null || card.roomNetto != null) {
      const b = deriveB(card.roomBrutto, card.roomNetto, card.roomMwst)
      const e = deriveB(card.roomEnergyBrutto, card.roomEnergyNetto, card.roomEnergyMwst) || card.roomEnergy || 0
      raw = (b + e) * nights
    } else {
      // legacy fallback for older entries
      if (card.useBruttoNetto || card.pricingMode === 'brutto_netto') {
        if (card.brutto != null && card.brutto > 0) {
          raw = card.brutto * nights
        } else if (card.netto != null && card.netto > 0 && card.mwst != null) {
          raw = card.netto * (1 + card.mwst / 100) * nights
        }
      } else if (card.pricePerBed && card.pricePerBedAmount > 0) {
        raw = card.pricePerBedAmount * beds * nights
      } else {
        raw = (card.nightlyPrice ?? 0) * nights
      }
    }
  }

  if (card.hasDiscount && card.discountValue > 0) {
    return card.discountType === 'percentage'
      ? raw * (1 - card.discountValue / 100)
      : Math.max(0, raw - card.discountValue)
  }
  return raw
}

/** Standard price per bed per night for this card */
export function calcPricePerBedPerNight(
  card: any,
  durationStart: string,
  durationEnd: string,
): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0
  const beds = bedsForType(card.roomType, card.bedCount)
  if (beds === 0) return 0
  const total = calcRoomCardTotal(card, durationStart, durationEnd)
  return total / nights / beds
}

// Legacy helpers kept for backward compat
export function calcRoomCardBrutto(card: RoomCard): number | null {
  if (card.brutto != null && card.brutto > 0) return card.brutto
  if (card.netto != null && card.netto > 0 && card.mwst != null)
    return card.netto * (1 + card.mwst / 100)
  return null
}
export function calcRoomCardNetto(card: RoomCard): number | null {
  if (card.netto != null && card.netto > 0) return card.netto
  if (card.brutto != null && card.brutto > 0 && card.mwst != null)
    return card.brutto / (1 + card.mwst / 100)
  return null
}

/** Price fields to copy when "Apply to same room type" is used */
export function extractPricingFields(card: any) {
  return {
    pricingTab:   card.pricingTab,
    // per_bed
    bedNetto:     card.bedNetto,
    bedMwst:      card.bedMwst,
    bedBrutto:    card.bedBrutto,
    bedEnergy:    card.bedEnergy, // Legacy
    bedEnergyNetto: card.bedEnergyNetto,
    bedEnergyMwst:  card.bedEnergyMwst,
    bedEnergyBrutto:card.bedEnergyBrutto,
    // per_room
    roomNetto:    card.roomNetto,
    roomMwst:     card.roomMwst,
    roomBrutto:   card.roomBrutto,
    roomEnergy:   card.roomEnergy, // Legacy
    roomEnergyNetto: card.roomEnergyNetto,
    roomEnergyMwst:  card.roomEnergyMwst,
    roomEnergyBrutto:card.roomEnergyBrutto,
    // total_room
    totalNetto:   card.totalNetto,
    totalMwst:    card.totalMwst,
    totalBrutto:  card.totalBrutto,
    totalEnergy:  card.totalEnergy, // Legacy
    totalEnergyNetto: card.totalEnergyNetto,
    totalEnergyMwst:  card.totalEnergyMwst,
    totalEnergyBrutto:card.totalEnergyBrutto,
    // discount
    hasDiscount:  card.hasDiscount,
    discountType: card.discountType,
    discountValue: card.discountValue,
  }
}
