import { BALANCE } from '../data/balance';
import type { RunMode } from './run-result';

/** What the "Continue?" window offers; `null` instead of an offer means no window at all. */
export interface ContinueOffer {
  /** The rewarded ad: only the first continue of a run has it. `unavailable` shows it disabled. */
  ad: 'ready' | 'unavailable' | null;
  /** Berry price of this continue, or `null` when the player cannot pay it. */
  berryCost: number | null;
}

export interface ContinueOfferInput {
  mode: RunMode;
  continuesUsed: number;
  adReady: boolean;
  berries: number;
}

/**
 * Decides what the window after a miss shows. The daily tower has no continues, a run has at
 * most `BALANCE.continues.max`, and the window is skipped when the player has no way to pay
 * (no ad ready and not enough berries).
 */
export function continueOffer(input: ContinueOfferInput): ContinueOffer | null {
  const { mode, continuesUsed, adReady, berries } = input;
  if (mode === 'daily' || continuesUsed >= BALANCE.continues.max) return null;
  const ad = continuesUsed === 0 ? (adReady ? 'ready' : 'unavailable') : null;
  const cost = BALANCE.continues.berryCosts[continuesUsed] ?? null;
  const berryCost = cost !== null && berries >= cost ? cost : null;
  if (ad !== 'ready' && berryCost === null) return null;
  return { ad, berryCost };
}
