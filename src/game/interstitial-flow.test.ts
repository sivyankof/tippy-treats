import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { createTestState } from '../state/test-state';

const h = vi.hoisted(() => ({
  prices: {} as { remove_ads?: string },
  opened: vi.fn((_scene: unknown, _price: string, onClosed: () => void) => onClosed()),
  audio: { suspend: vi.fn(), resume: vi.fn() },
}));
const state = createTestState();

vi.mock('../state', () => ({ gameState: state }));
vi.mock('./purchases', () => ({ loadPrices: () => Promise.resolve(h.prices) }));
vi.mock('./ui/menu/premium-offer', () => ({ openNoAdsOffer: h.opened }));
vi.mock('../services', () => ({
  services: { audio: h.audio, ads: { showInterstitial: () => Promise.resolve(true) } },
}));
vi.mock('./rewarded', () => ({ rewardedWatchedInRun: () => false }));

const scene = { scene: { isActive: () => true } } as unknown as Phaser.Scene;
const exit = {
  runMs: 30_000,
  recorded: true,
  newRecord: false,
  levelUp: false,
  newCreature: false,
};

describe('the "No ads" offer flow', () => {
  beforeEach(() => {
    h.opened.mockClear();
    h.prices.remove_ads = undefined;
  });

  it('waits for Home, needs a price to count, and comes once per day', async () => {
    const { leaveResultsAds, prepareRemoveAdsOffer } = await import('./interstitial-flow');
    const offerOnHome = async (): Promise<void> => {
      const offer = prepareRemoveAdsOffer();
      await offer.ready;
      offer.open(scene);
    };
    vi.spyOn(state, 'canShowInterstitial').mockReturnValue(true);
    h.prices.remove_ads = '$3.99';

    await leaveResultsAds(exit);
    await offerOnHome();
    expect(h.opened).not.toHaveBeenCalled();

    await leaveResultsAds(exit);
    expect(h.opened).not.toHaveBeenCalled();

    h.prices.remove_ads = undefined;
    await offerOnHome();
    expect(h.opened).not.toHaveBeenCalled();
    expect(state.data.ads.offerDay).toBe('');

    h.prices.remove_ads = '$3.99';
    await offerOnHome();
    expect(h.opened).toHaveBeenCalledTimes(1);
    expect(state.data.ads.offerDay).not.toBe('');

    await offerOnHome();
    expect(h.opened).toHaveBeenCalledTimes(1);
  });

  it('opens nothing when the price has not come yet by the time Home is free', async () => {
    const { prepareRemoveAdsOffer } = await import('./interstitial-flow');
    vi.spyOn(state, 'removeAdsOfferDue').mockReturnValue(true);
    h.prices.remove_ads = '$3.99';
    const offer = prepareRemoveAdsOffer();
    offer.open(scene);
    expect(h.opened).not.toHaveBeenCalled();
    await offer.ready;
    offer.open(scene);
    expect(h.opened).toHaveBeenCalledTimes(1);
  });
});
