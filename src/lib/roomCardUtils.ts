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

export function deriveB(brutto: number | null | undefined, netto: number | null | undefined, mwst: number | null | undefined): number {
  if (brutto != null && brutto > 0) return brutto
  if (netto != null && netto > 0) return netto * (1 + (mwst || 0) / 100)
  return 0
}

export function deriveN(netto: number | null | undefined, brutto: number | null | undefined, mwst: number | null | undefined): number {
  if (netto != null && netto > 0) return netto
  if (brutto != null && brutto > 0) return brutto / (1 + (mwst || 0) / 100)
  return 0
}

/** * NEW: Calculate specific Netto Sum for the Master Invoice 
 */
export function calcRoomCardNettoSum(card: any, durationStart: string, durationEnd: string): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0
  const beds = bedsForType(card.roomType, card.bedCount)
  const tab = card.pricingTab ?? 'per_room'
  let raw = 0

  if (tab === 'per_bed') {
    const n = deriveN(card.bedNetto, card.bedBrutto, card.bedMwst)
    const e = deriveN(card.bedEnergyNetto, card.bedEnergyBrutto, card.bedEnergyMwst) || card.bedEnergy || 0
    raw = (n + e) * beds * nights
  } else if (tab === 'total_room') {
    const n = deriveN(card.totalNetto, card.totalBrutto, card.totalMwst)
    const e = deriveN(card.totalEnergyNetto, card.totalEnergyBrutto, card.totalEnergyMwst) || card.totalEnergy || 0
    raw = n + e
  } else {
    const n = deriveN(card.roomNetto, card.roomBrutto, card.roomMwst)
    const e = deriveN(card.roomEnergyNetto, card.roomEnergyBrutto, card.roomEnergyMwst) || card.roomEnergy || 0
    raw = (n + e) * nights
  }

  if (card.hasDiscount && card.discountValue > 0) {
    return card.discountType === 'percentage' ? raw * (1 - card.discountValue / 100) : Math.max(0, raw - card.discountValue)
  }
  return raw
}

export function calcRoomCardTotal(card: any, durationStart: string, durationEnd: string): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0
  const beds = bedsForType(card.roomType, card.bedCount)
  const tab = card.pricingTab ?? 'per_room'
  let raw = 0

  if (tab === 'per_bed') {
    const b = deriveB(card.bedBrutto, card.bedNetto, card.bedMwst)
    const e = deriveB(card.bedEnergyBrutto, card.bedEnergyNetto, card.bedEnergyMwst) || card.bedEnergy || 0
    raw = (b + e) * beds * nights
  } else if (tab === 'total_room') {
    const b = deriveB(card.totalBrutto, card.totalNetto, card.totalMwst)
    const e = deriveB(card.totalEnergyBrutto, card.totalEnergyNetto, card.totalEnergyMwst) || card.totalEnergy || 0
    raw = b + e
  } else {
    const b = deriveB(card.roomBrutto, card.roomNetto, card.roomMwst)
    const e = deriveB(card.roomEnergyBrutto, card.roomEnergyNetto, card.roomEnergyMwst) || card.roomEnergy || 0
    raw = (b + e) * nights
  }

  if (card.hasDiscount && card.discountValue > 0) {
    return card.discountType === 'percentage' ? raw * (1 - card.discountValue / 100) : Math.max(0, raw - card.discountValue)
  }
  return raw
}

export function extractPricingFields(card: any) {
  return {
    pricingTab: card.pricingTab,
    bedNetto: card.bedNetto, bedMwst: card.bedMwst, bedBrutto: card.bedBrutto,
    bedEnergyNetto: card.bedEnergyNetto, bedEnergyMwst: card.bedEnergyMwst, bedEnergyBrutto: card.bedEnergyBrutto,
    roomNetto: card.roomNetto, roomMwst: card.roomMwst, roomBrutto: card.roomBrutto,
    roomEnergyNetto: card.roomEnergyNetto, roomEnergyMwst: card.roomEnergyMwst, roomEnergyBrutto: card.roomEnergyBrutto,
    totalNetto: card.totalNetto, totalMwst: card.totalMwst, totalBrutto: card.totalBrutto,
    totalEnergyNetto: card.totalEnergyNetto, totalEnergyMwst: card.totalEnergyMwst, totalEnergyBrutto: card.totalEnergyBrutto,
    hasDiscount: card.hasDiscount, discountType: card.discountType, discountValue: card.discountValue,
  }
}
