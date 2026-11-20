import type { ContinueOffer } from '../../core/run/continue-offer';
import type { EventParams } from '../../services/telemetry/types';

/** How the player continued. */
export type ContinueMethod = 'ad' | 'berries';

/**
 * Parameters of `continue_offer`: the tower height and what the window offers: `ad`, `berries`
 * (affordable now) or `both`. A window cannot open with neither.
 */
export function continueOfferParams(offer: Readonly<ContinueOffer>, height: number): EventParams {
  const ad = offer.ad === 'ready';
  const berries = offer.berriesMissing === 0;
  return { height, option: ad && berries ? 'both' : ad ? 'ad' : 'berries' };
}

/** Parameters of `continue_used`. */
export function continueUsedParams(height: number, method: ContinueMethod): EventParams {
  return { height, method };
}
