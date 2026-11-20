import { describe, expect, it } from 'vitest';
import { createTestState } from './test-state';

const clock = () => ({ ms: 1_700_000_000_000 });

describe('store transactions in the game state', () => {
  it('pays a consumable once per transaction', () => {
    const state = createTestState(clock());
    expect(state.grantProduct('berries_80', 'tx-1')).toBe(true);
    expect(state.grantProduct('berries_80', 'tx-1')).toBe(false);
    expect(state.berries).toBe(80);
    expect(state.data.iap.processedTx).toEqual(['tx-1']);
    // Another transaction of the same product is another purchase.
    expect(state.grantProduct('berries_80', 'tx-2')).toBe(true);
    expect(state.berries).toBe(160);
  });

  it('remembers nothing for a purchase without a transaction id (the browser stub)', () => {
    const state = createTestState(clock());
    expect(state.grantProduct('berries_80')).toBe(true);
    expect(state.data.iap.processedTx).toEqual([]);
  });

  it('does not pay a transaction the launch payout already saw', () => {
    const c = clock();
    const state = createTestState(c);
    state.grantProduct('berries_500', 'paid');
    const list = [
      { key: 'berries_500' as const, transactionId: 'paid', purchasedAt: c.ms + 5 },
      { key: 'berries_80' as const, transactionId: 'later', purchasedAt: c.ms + 5 },
      { key: 'berries_80' as const, transactionId: 'before-reinstall', purchasedAt: c.ms - 5 },
    ];
    const unpaid = state.unpaidTransactions(list);
    expect(unpaid.map((tx) => tx.transactionId)).toEqual(['later']);
    for (const tx of unpaid) state.grantProduct(tx.key, tx.transactionId);
    expect(state.berries).toBe(580);
    expect(state.unpaidTransactions(list)).toEqual([]);
  });
});
