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

export function calcRoomCardNettoSum(card: any, durationStart: string, durationEnd: string): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0
  const beds = bedsForType(card.roomType, card.bedCount)
  const tab = card.pricingTab ?? 'per_bed'
  const multiplier = tab === 'per_bed' ? (beds * nights) : tab === 'per_room' ? nights : 1

  let baseNetto = 0; let cEnergyNetto = 0;
  if (tab === 'per_bed') {
     baseNetto = Number(card.bedNetto) || 0;
     cEnergyNetto = (Number(card.bedEnergyNetto) || 0) * multiplier;
  } else if (tab === 'per_room') {
     baseNetto = Number(card.roomNetto) || 0;
     cEnergyNetto = (Number(card.roomEnergyNetto) || 0) * multiplier;
  } else {
     baseNetto = Number(card.totalNetto) || 0;
     cEnergyNetto = Number(card.totalEnergyNetto) || 0;
  }

  let discountedUnit = baseNetto;
  if (card.hasDiscount && card.discountValue > 0) {
      discountedUnit = card.discountType === 'percentage' 
          ? baseNetto * (1 - card.discountValue / 100) 
          : Math.max(0, baseNetto - card.discountValue);
  }

  return (discountedUnit * multiplier) + cEnergyNetto;
}

export function calcRoomCardTotal(card: any, durationStart: string, durationEnd: string): number {
  const nights = calculateNights(durationStart, durationEnd)
  if (nights === 0) return 0
  const beds = bedsForType(card.roomType, card.bedCount)
  const tab = card.pricingTab ?? 'per_bed'
  const multiplier = tab === 'per_bed' ? (beds * nights) : tab === 'per_room' ? nights : 1

  let baseNetto = 0; let mwstRate = 0; let cEnergyNetto = 0; let eMwstRate = 0;
  if (tab === 'per_bed') {
     baseNetto = Number(card.bedNetto) || 0; mwstRate = Number(card.bedMwst) || 0;
     cEnergyNetto = (Number(card.bedEnergyNetto) || 0) * multiplier; eMwstRate = Number(card.bedEnergyMwst) || 0;
  } else if (tab === 'per_room') {
     baseNetto = Number(card.roomNetto) || 0; mwstRate = Number(card.roomMwst) || 0;
     cEnergyNetto = (Number(card.roomEnergyNetto) || 0) * multiplier; eMwstRate = Number(card.roomEnergyMwst) || 0;
  } else {
     baseNetto = Number(card.totalNetto) || 0; mwstRate = Number(card.totalMwst) || 0;
     cEnergyNetto = Number(card.totalEnergyNetto) || 0; eMwstRate = Number(card.totalEnergyMwst) || 0;
  }

  let discountedUnit = baseNetto;
  if (card.hasDiscount && card.discountValue > 0) {
      discountedUnit = card.discountType === 'percentage' 
          ? baseNetto * (1 - card.discountValue / 100) 
          : Math.max(0, baseNetto - card.discountValue);
  }

  const cRoomNetto = discountedUnit * multiplier;
  const cRoomMwst = cRoomNetto * (mwstRate / 100);
  const cEnergyMwst = cEnergyNetto * (eMwstRate / 100);

  return cRoomNetto + cRoomMwst + cEnergyNetto + cEnergyMwst;
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
