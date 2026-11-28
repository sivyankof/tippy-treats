import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { hints: new Set<string>(), runs: 1 };

vi.mock('../../../../state', () => ({
  gameState: {
    hasHint: (id: string) => state.hints.has(id),
    markHint: (id: string) => state.hints.add(id),
    get runsFinished() {
      return state.runs;
    },
  },
}));
vi.mock('../../../economy/interstitial-flow', () => ({ prepareRemoveAdsOffer: vi.fn() }));
vi.mock('../oven/oven-window', () => ({ openOvenWindow: vi.fn() }));
vi.mock('../streak/streak-windows', () => ({ openStreakEntry: vi.fn() }));

import { takeFirstHome } from './day-entry';

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
