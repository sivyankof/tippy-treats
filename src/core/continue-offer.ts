import { BALANCE } from '../data/balance';
import type { RunMode } from './run-result';

/** What the "Continue?" window offers; `null` instead of an offer means no window at all. */
export interface ContinueOffer {
  /** The rewarded ad: only the first continue of a run has it. `unavailable` shows it disabled. */
  ad: 'ready' | 'unavailable' | null;
  /** Berry price of this continue; always shown, even when the player cannot pay it yet. */
  berryCost: number;
  /** Berries the player lacks for the price (0 when it is affordable). */
  berriesMissing: number;
}

export interface ContinueOfferInput {
  mode: RunMode;
  continuesUsed: number;
  adReady: boolean;
  berries: number;
}

/**
 * Decides what the window after a miss shows. The daily tower has no continues, a run has at
 * most `BALANCE.continues.max`. The berry price is always part of the offer (short of berries it
 * is shown greyed with the missing amount), but the window is skipped when nothing in it could
 * be pressed: no ad ready and not enough berries.
 */
export function continueOffer(input: ContinueOfferInput): ContinueOffer | null {
  const { mode, continuesUsed, adReady, berries } = input;
  if (mode === 'daily' || continuesUsed >= BALANCE.continues.max) return null;
  const ad = continuesUsed === 0 ? (adReady ? 'ready' : 'unavailable') : null;
  const berryCost = BALANCE.continues.berryCosts[continuesUsed];
  if (berryCost === undefined) return null;
  const berriesMissing = Math.max(0, berryCost - berries);
  if (ad !== 'ready' && berriesMissing > 0) return null;
  return { ad, berryCost, berriesMissing };
}
