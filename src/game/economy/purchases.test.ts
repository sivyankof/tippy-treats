import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IapService, PurchaseReport, StoreTransaction } from '../../services/iap/types';
import { gameState as state } from '../../state';

const h = vi.hoisted(() => ({
  report: { result: 'purchased', transactionIds: ['tx-1'] } as PurchaseReport,
  transactions: [] as StoreTransaction[],
  owned: [] as string[],
  /** Holds the store's answer about owned products until released (a slow network at launch). */
  gate: null as Promise<void> | null,
  fail: false,
  setRemoveAds: vi.fn(),
  play: vi.fn(),
  clock: { ms: 1_700_000_000_000 },
}));
const { clock } = h;

vi.mock('../../state', async () => ({
  gameState: (await import('../../state/test-state')).createTestState(h.clock),
}));
vi.mock('../../services/iap/product-ids', () => ({
  productIds: {
    idOf: (key: string) => `tippy_${key}`,
    keyOf: (id: string) => (id.startsWith('tippy_') ? id.slice('tippy_'.length) : null),
    keysOf: (ids: string[]) => ids.filter((id) => id.startsWith('tippy_')).map((id) => id.slice(6)),
  },
}));
vi.mock('../../services', () => {
  const iap: IapService = {
    init: () => Promise.resolve(),
    getProducts: () => Promise.resolve([]),
    purchase: () => (h.fail ? Promise.reject(new Error('x')) : Promise.resolve(h.report)),
    restore: () => Promise.resolve(h.owned),
    ownedNonConsumables: () => (h.gate ?? Promise.resolve()).then(() => h.owned),
    completedTransactions: () =>
      h.fail ? Promise.reject(new Error('x')) : Promise.resolve(h.transactions),
  };
  return {
    services: {
      iap,
      ads: { setRemoveAds: h.setRemoveAds },
      audio: { play: h.play },
      telemetry: { logEvent: () => undefined, setUserProperty: () => undefined },
    },
  };
});

import { withTimeout } from '../../util/with-timeout';
import {
  buyOutcomeKey,
  buyProduct,
  takeLaunchRestored,
  restorePurchases,
  syncPurchases,
} from './purchases';

describe('purchases', () => {
  beforeEach(() => {
    h.fail = false;
    h.transactions = [];
    h.owned = [];
    h.gate = null;
  });

  it('pays a consumable only once for the same transaction', async () => {
    h.report = { result: 'purchased', transactionIds: ['dup'] };
    expect(await buyProduct('berries_80')).toBe('purchased');
    expect(await buyProduct('berries_80')).toBe('purchased');
    expect(state.berries).toBe(80);
  });

  it.each([
    [{ result: 'cancelled' }, 'cancelled', null],
    [{ result: 'pending' }, 'pending', 'shop.pending'],
    [{ result: 'failed' }, 'failed', 'shop.failed'],
    [{ result: 'failed', reason: 'network' }, 'offline', 'shop.storeDown'],
    [{ result: 'failed', reason: 'unavailable' }, 'failed', 'shop.failed'],
  ] as const)('grants nothing on %j', async (report, outcome, key) => {
    const before = state.berries;
    h.report = report;
    expect(await buyProduct('berries_500')).toBe(outcome);
    expect(buyOutcomeKey(outcome)).toBe(key);
    expect(state.berries).toBe(before);
  });

  it('answers failed when the plugin throws', async () => {
    h.fail = true;
    expect(await buyProduct('berries_500')).toBe('failed');
  });

  it('pays an approved pending purchase at launch, once, and not an old one', async () => {
    const before = state.berries;
    h.transactions = [
      { productId: 'tippy_berries_500', transactionId: 'approved', purchasedAt: clock.ms + 10 },
      { productId: 'tippy_berries_500', transactionId: 'ancient', purchasedAt: clock.ms - 10 },
    ];
    await syncPurchases();
    await syncPurchases();
    expect(state.berries).toBe(before + 500);
  });

  it('pays a starter pack approved later in full, not as a restore', async () => {
    const coins = state.coins;
    h.owned = ['tippy_starter_pack'];
    h.transactions = [
      { productId: 'tippy_starter_pack', transactionId: 'pack-1', purchasedAt: clock.ms + 10 },
    ];
    await syncPurchases();
    expect(state.data.purchases.starterPack).toBe(true);
    expect(state.coins).toBeGreaterThan(coins);
  });

  it('a launch check that ends after the start wait gives back an owned starter pack and says so once', async () => {
    // Device report (session 10): the pack left the shop right after an ad, nothing was bought.
    state.resetProgress();
    const { coins, berries } = state;
    takeLaunchRestored();
    let release = (): void => undefined;
    h.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.owned = ['tippy_starter_pack'];
    const sync = syncPurchases();
    // The game starts without waiting for the store any longer (BOOT.purchasesWaitMs).
    await expect(withTimeout(sync, 5)).rejects.toThrow();
    expect(state.data.purchases.starterPack).toBe(false);
    release();
    await sync;
    expect(state.data.purchases.starterPack).toBe(true);
    expect(state.data.creatures.crumb).toBeDefined();
    expect([state.coins, state.berries]).toEqual([coins, berries]);
    // Told once, even when the shop opens only later.
    expect(takeLaunchRestored()).toEqual(['starter_pack']);
    expect(takeLaunchRestored()).toEqual([]);
    // Nothing new on the next check.
    await syncPurchases();
    expect(takeLaunchRestored()).toEqual([]);
  });

  it('the restore button tells its own result and drops an untold launch restore', async () => {
    state.resetProgress();
    takeLaunchRestored();
    h.owned = ['tippy_starter_pack'];
    await syncPurchases();
    expect(await restorePurchases()).toBe('restored');
    expect(takeLaunchRestored()).toEqual([]);
  });

  it('survives a store that cannot be asked at launch', async () => {
    h.fail = true;
    await expect(syncPurchases()).resolves.toBeUndefined();
  });

  it('restores the ownership flag and tells what it found', async () => {
    expect(await restorePurchases()).toBe('nothing');
    h.owned = ['tippy_remove_ads'];
    expect(await restorePurchases()).toBe('restored');
    expect(state.data.purchases.removeAds).toBe(true);
    expect(h.setRemoveAds).toHaveBeenLastCalledWith(true);
  });
});
