import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { hints: new Set<string>(), runs: 1 };

vi.mock('../../../../state', () => ({
  gameState: {
    hasHint: (id: string) => state.hints.has(id),
    markHint: (id: string) => state.hints.add(id),
    get runsFinished() {
      return state.runs;
    },
    streakEntry: () => ({ kind: 'none' }),
  },
}));
vi.mock('../../../economy/interstitial-flow', () => ({ prepareRemoveAdsOffer: vi.fn() }));
vi.mock('../oven/oven-window', () => ({ openOvenWindow: vi.fn() }));
vi.mock('../streak/streak-windows', () => ({ openStreakEntry: vi.fn() }));

import { pushBack } from '../../../app/back-stack';
import { prepareRemoveAdsOffer } from '../../../economy/interstitial-flow';
import { openDayWindow, takeFirstHome } from './day-entry';

describe('takeFirstHome', () => {
  beforeEach(() => {
    state.hints = new Set();
    state.runs = 1;
  });

  it('is true once for a new player, then false', () => {
    expect(takeFirstHome()).toBe(true);
    expect(takeFirstHome()).toBe(false);
  });

  it('is false for a player of an older save with several runs', () => {
    state.runs = 5;
    expect(takeFirstHome()).toBe(false);
  });
});

describe('openDayWindow: the "No ads" offer', () => {
  beforeEach(() => {
    state.hints = new Set(['oven', 'homeSeen']);
    state.runs = 20;
  });

  /** The offer is the window of this entry; its price comes when `release` is called. */
  function offerWithLatePrice() {
    let release: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => (release = resolve));
    const open = vi.fn();
    vi.mocked(prepareRemoveAdsOffer).mockReturnValue({ due: true, ready, open } as never);
    return { open, release: () => (release(), ready) };
  }

  const scene = { sys: { isActive: () => true } } as never;
  const hooks = { wallet: {} as never, isLeaving: () => false, onStreak: () => undefined };

  it('opens when its price comes and nothing else opened meanwhile', async () => {
    const offer = offerWithLatePrice();
    openDayWindow(scene, { firstHome: false, askShown: false }, hooks);
    await offer.release();
    expect(offer.open).toHaveBeenCalledTimes(1);
  });

  it('waits for another entry when a window opened before its price came', async () => {
    const offer = offerWithLatePrice();
    openDayWindow(scene, { firstHome: false, askShown: false }, hooks);
    const close = pushBack(() => true);
    await offer.release();
    close();
    expect(offer.open).not.toHaveBeenCalled();
  });
});
