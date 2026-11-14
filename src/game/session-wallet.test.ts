import { describe, expect, it } from 'vitest';
import { SessionWallet } from './session-wallet';

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
