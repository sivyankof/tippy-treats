import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../data/clock';
import { SHOP } from '../data/shop';
import { createTestState } from './test-state';

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);

describe('shop in the game state', () => {
  it('offers the starter pack for a week from the install, until it is bought', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    expect(state.starterPackOffered).toBe(true);
    clock.ms = T0 + MS_PER_DAY;
    expect(state.starterPackMsLeft).toBe((SHOP.starterPackDays - 1) * MS_PER_DAY);
    expect(state.grantProduct('starter_pack')).toBe(true);
    expect(state.starterPackOffered).toBe(false);
    expect(state.data.creatures.crumb).toEqual({ level: 1 });
    expect(state.coins).toBe(500);
    expect(state.berries).toBe(60);
    expect(state.grantProduct('starter_pack')).toBe(false);
    expect(state.coins).toBe(500);
  });

  it('closes the offer after the week', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    clock.ms = T0 + SHOP.starterPackDays * MS_PER_DAY;
    expect(state.starterPackOffered).toBe(false);
  });

  it('pays free coins three times a local day', () => {
    const clock = { ms: T0 };
    const state = createTestState(clock);
    for (let i = 0; i < SHOP.freeCoins.perDay; i++) expect(state.claimFreeCoins()).toBe(true);
    expect(state.freeCoinsLeft).toBe(0);
    expect(state.claimFreeCoins()).toBe(false);
    expect(state.coins).toBe(SHOP.freeCoins.amount * SHOP.freeCoins.perDay);
    clock.ms = T0 + MS_PER_DAY;
    expect(state.freeCoinsLeft).toBe(SHOP.freeCoins.perDay);
  });

  it('exchanges berries for coins and refuses when they are short', () => {
    const state = createTestState({ ms: T0 });
    expect(state.exchangeBerries(10)).toBe(false);
    expect(state.berries).toBe(0);
    state.addBerries(15);
    expect(state.exchangeBerries(10)).toBe(true);
    expect(state.berries).toBe(5);
    expect(state.coins).toBe(100);
    expect(state.exchangeBerries(7)).toBe(false);
    expect(state.exchangeBerries(10)).toBe(false);
    expect(state.berries).toBe(5);
  });

  it('shows a red dot reason once a creature is affordable', () => {
    const state = createTestState({ ms: T0 });
    expect(state.coinCreatureAffordable).toBe(false);
    const cheapest = state.shopCreatures[0]?.price ?? 0;
    state.addCoins(cheapest);
    expect(state.coinCreatureAffordable).toBe(true);
  });

  it('restores the ads switch from the store and reports a change once', () => {
    const state = createTestState({ ms: T0 });
    expect(state.restorePurchases(['remove_ads'])).toBe(true);
    expect(state.data.purchases.removeAds).toBe(true);
    expect(state.restorePurchases(['remove_ads'])).toBe(false);
  });
});
