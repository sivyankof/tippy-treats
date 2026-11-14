import { GIFT } from '../data/gift';
import { Rng, hashString } from './rng';

export interface GiftState {
  nextAt: number;
}

export interface GiftOpening {
  coins: number;
  gift: GiftState;
}

/** The box is ready once its time has come, unless the clock was set back. */
export function giftReady(gift: GiftState, nowMs: number, clockBack: boolean): boolean {
  return !clockBack && gift.nextAt <= nowMs;
}

/**
 * Opens the box. Returns null when it is not ready. The amount depends only on the install id and
 * the scheduled time, so it stays the same if the page reloads before the save.
 * Doubling the reward for an ad is paid by the state layer, not here.
 */
export function openGift(
  gift: GiftState,
  nowMs: number,
  installId: string,
  clockBack = false,
): GiftOpening | null {
  if (!giftReady(gift, nowMs, clockBack)) return null;
  const rng = new Rng(hashString(`${installId}:${gift.nextAt}`));
  return {
    coins: rng.int(GIFT.minCoins, GIFT.maxCoins),
    gift: { nextAt: nowMs + GIFT.intervalMs },
  };
}

/** Milliseconds left until the box is ready (0 when ready). */
export function msUntilGift(gift: GiftState, nowMs: number): number {
  return Math.max(0, gift.nextAt - nowMs);
}
