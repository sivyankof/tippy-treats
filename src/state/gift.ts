// The free gift box as pure functions over the save.
import { earn } from '../core/economy';
import { giftReady, msUntilGift, openGift } from '../core/gift';
import type { Save } from '../core/save/schema';

export function isGiftReady(save: Save, nowMs: number, clockBack: boolean): boolean {
  return giftReady(save.gift, nowMs, clockBack);
}

export function giftWaitMs(save: Save, nowMs: number): number {
  return msUntilGift(save.gift, nowMs);
}

/** The save with the box opened and its coins paid; null when it is not ready. */
export function withGiftOpened(
  save: Save,
  nowMs: number,
  clockBack: boolean,
): { save: Save; coins: number } | null {
  const opening = openGift(save.gift, nowMs, save.installId, clockBack);
  if (!opening) return null;
  const paid = earn(save, { coins: opening.coins });
  return { save: { ...paid, gift: opening.gift }, coins: opening.coins };
}
