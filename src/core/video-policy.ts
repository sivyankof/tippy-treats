import { REWARDED_OFFERS } from '../data/rewarded-video';

/**
 * "×2 coins for an ad" on the results screen: only for a run that reached the save and earned
 * at least `REWARDED_OFFERS.doubleCoinsMin` coins (docs/05-economy-monetization.md, section 6).
 */
export function canOfferDoubleCoins(earned: number, recorded: boolean): boolean {
  return recorded && earned >= REWARDED_OFFERS.doubleCoinsMin;
}
