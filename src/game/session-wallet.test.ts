import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../core/tower-sim';
import { BALANCE } from '../data/balance';
import { berriesFromEvents, SessionWallet } from './session-wallet';

describe('SessionWallet', () => {
  it('starts empty and adds whole berries', () => {
    const wallet = new SessionWallet();
    expect(wallet.berries).toBe(0);
    wallet.add(5);
    wallet.add(2.9);
    wallet.add(-4);
    wallet.add(0);
    expect(wallet.berries).toBe(7);
  });

  it('spends only what it has', () => {
    const wallet = new SessionWallet();
    wallet.add(20);
    expect(wallet.spend(15)).toBe(true);
    expect(wallet.berries).toBe(5);
    expect(wallet.canAfford(6)).toBe(false);
    expect(wallet.spend(6)).toBe(false);
    expect(wallet.berries).toBe(5);
  });
});

describe('berriesFromEvents', () => {
  const perfectGolden: SimEvent = { type: 'golden', perfect: true };

  it('pays a berry only for a perfect golden landing', () => {
    expect(berriesFromEvents([])).toBe(0);
    expect(berriesFromEvents([{ type: 'golden', perfect: false }])).toBe(0);
    expect(berriesFromEvents([perfectGolden])).toBe(BALANCE.golden.perfectBerries);
  });

  it('credits each berry once, so a berry can pay for the continue of the same run', () => {
    const wallet = new SessionWallet();
    wallet.add(berriesFromEvents([perfectGolden]));
    expect(wallet.berries).toBe(BALANCE.golden.perfectBerries);
    wallet.add(berriesFromEvents([]));
    expect(wallet.berries).toBe(BALANCE.golden.perfectBerries);
  });
});
