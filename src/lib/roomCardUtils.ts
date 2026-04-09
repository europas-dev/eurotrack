// src/lib/roomCardUtils.ts
import type { RoomCard, Employee } from './types'
import { calculateNights, getNightsBetween } from './utils'

export function bedsForType(roomType: string, bedCount: number): number {
  if (roomType === 'EZ') return 1
  if (roomType === 'DZ') return 2
  if (roomType === 'TZ') return 3
  if (roomType === 'WG') return Math.max(1, bedCount)
  return 2
}

export function calcRoomCardTotal(
  card: RoomCard,
  durationStart: string,
  durationEnd: string,
): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0

  // Brutto/Netto mode: total is brutto (or netto*mwst)
  if (card.useBruttoNetto || card.pricingMode === 'brutto_netto') {
    if (card.brutto != null && card.brutto > 0) return card.brutto
    if (card.netto != null && card.netto > 0 && card.mwst != null)
      return card.netto * (1 + card.mwst / 100)
    return 0
  }

  // Per-bed mode (WG)
  let pricePerRoom = card.nightlyPrice ?? 0
  if (card.pricePerBed && card.pricePerBedAmount > 0) {
    pricePerRoom = card.pricePerBedAmount * bedsForType(card.roomType, card.bedCount)
  }

  let raw = 0
  if (card.useManualPrices && card.nightlyPrices && Object.keys(card.nightlyPrices).length > 0) {
    const allNights = getNightsBetween(durationStart, durationEnd)
    raw = allNights.reduce((s, d) => s + (card.nightlyPrices[d] ?? pricePerRoom), 0)
  } else {
    raw = pricePerRoom * nights
  }

  if (card.hasDiscount && card.discountValue > 0) {
    return card.discountType === 'percentage'
      ? raw * (1 - card.discountValue / 100)
      : Math.max(0, raw - card.discountValue)
  }
  return raw
}

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

export function getCardGaps(card: RoomCard, durationStart: string, durationEnd: string) {
  const beds = bedsForType(card.roomType, card.bedCount)
  const gaps: Array<{ slotIndex: number; from: string; to: string }> = []
  for (let i = 0; i < beds; i++) {
    const emp: Employee | undefined = (card.employees ?? [])[i]
    if (!emp) {
      gaps.push({ slotIndex: i, from: durationStart, to: durationEnd })
    } else {
      if (emp.checkIn && emp.checkIn > durationStart)
        gaps.push({ slotIndex: i, from: durationStart, to: emp.checkIn })
      if (emp.checkOut && emp.checkOut < durationEnd)
        gaps.push({ slotIndex: i, from: emp.checkOut, to: durationEnd })
    }
  }
  return gaps
}
