import { describe, expect, it } from 'vitest';
import { REWARDED_OFFERS } from '../data/rewarded-video';
import { canOfferDoubleCoins } from './video-policy';

describe('double coins offer', () => {
  it('needs at least 10 coins earned', () => {
    expect(REWARDED_OFFERS.doubleCoinsMin).toBe(10);
    expect(canOfferDoubleCoins(3, true)).toBe(false);
    expect(canOfferDoubleCoins(9, true)).toBe(false);
    expect(canOfferDoubleCoins(10, true)).toBe(true);
  });

  it('is never offered for a run that did not reach the save', () => {
    expect(canOfferDoubleCoins(50, false)).toBe(false);
  });
});
