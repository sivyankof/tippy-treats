import { describe, expect, it } from 'vitest';
import { continueOfferParams, continueUsedParams } from './continue-telemetry';

describe('continue event parameters', () => {
  it('names the options the window offers', () => {
    expect(continueOfferParams({ ad: 'ready', berryCost: 5, berriesMissing: 0 }, 12)).toEqual({
      height: 12,
      option: 'both',
    });
    expect(continueOfferParams({ ad: 'ready', berryCost: 5, berriesMissing: 3 }, 12)).toEqual({
      height: 12,
      option: 'ad',
    });
    expect(continueOfferParams({ ad: null, berryCost: 5, berriesMissing: 0 }, 7)).toEqual({
      height: 7,
      option: 'berries',
    });
  });

  it('describes the use of a continue', () => {
    expect(continueUsedParams(30, 'ad')).toEqual({ height: 30, method: 'ad' });
  });
});
