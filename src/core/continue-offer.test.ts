import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { continueOffer, type ContinueOfferInput } from './continue-offer';

const input = (overrides: Partial<ContinueOfferInput> = {}): ContinueOfferInput => ({
  mode: 'classic',
  continuesUsed: 0,
  adReady: true,
  berries: 0,
  ...overrides,
});

describe('continueOffer', () => {
  it('offers the ad on the first continue, and berries only when affordable', () => {
    expect(continueOffer(input())).toEqual({ ad: 'ready', berryCost: null });
    expect(continueOffer(input({ berries: 14 }))?.berryCost).toBeNull();
    expect(continueOffer(input({ berries: 15 }))).toEqual({ ad: 'ready', berryCost: 15 });
  });

  it('shows the disabled ad next to an affordable berry price', () => {
    expect(continueOffer(input({ adReady: false, berries: 40 }))).toEqual({
      ad: 'unavailable',
      berryCost: 15,
    });
  });

  it('shows no window when neither way works', () => {
    expect(continueOffer(input({ adReady: false, berries: 14 }))).toBeNull();
  });

  it('has no ad on the second continue and charges the second price', () => {
    expect(continueOffer(input({ continuesUsed: 1, berries: 29 }))).toBeNull();
    expect(continueOffer(input({ continuesUsed: 1, berries: 30 }))).toEqual({
      ad: null,
      berryCost: 30,
    });
  });

  it('stops after the maximum number of continues', () => {
    const used = BALANCE.continues.max;
    expect(continueOffer(input({ continuesUsed: used, berries: 999 }))).toBeNull();
  });

  it('has no continues in the daily tower', () => {
    expect(continueOffer(input({ mode: 'daily', berries: 999 }))).toBeNull();
  });
});
