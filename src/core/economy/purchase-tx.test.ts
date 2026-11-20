import { describe, expect, it } from 'vitest';
import { IAP_RULES } from '../../data/economy/iap-rules';
import type { ProductKey } from '../../data/economy/shop';
import { createDefaultSave } from '../save/defaults';
import { txProcessed, unpaidConsumables, withTxRecorded } from './purchase-tx';

const T0 = 1_700_000_000_000;
const fresh = () => createDefaultSave(T0, 'id');

describe('processed transactions', () => {
  it('remembers a transaction once, newest last', () => {
    const once = withTxRecorded(fresh(), 'a');
    expect(withTxRecorded(once, 'a')).toBe(once);
    expect(withTxRecorded(once, 'b').iap.processedTx).toEqual(['a', 'b']);
    expect(txProcessed(once, 'a')).toBe(true);
    expect(txProcessed(once, 'b')).toBe(false);
  });

  it('keeps only the newest ones', () => {
    let save = fresh();
    for (let i = 0; i < IAP_RULES.processedTxKeep + 5; i++) save = withTxRecorded(save, `t${i}`);
    expect(save.iap.processedTx).toHaveLength(IAP_RULES.processedTxKeep);
    expect(save.iap.processedTx[0]).toBe('t5');
    expect(save.iap.processedTx.at(-1)).toBe(`t${IAP_RULES.processedTxKeep + 4}`);
  });
});

describe('unpaid consumables at launch', () => {
  const tx = (transactionId: string, purchasedAt: number, key: ProductKey = 'berries_80') => ({
    key,
    transactionId,
    purchasedAt,
  });

  it('pays what is new and not older than the save', () => {
    const save = withTxRecorded(fresh(), 'paid');
    const list = [tx('paid', T0 + 1), tx('new', T0 + 2), tx('old', T0 - 1), tx('same-ms', T0)];
    expect(unpaidConsumables(save, list).map((x) => x.transactionId)).toEqual(['new', 'same-ms']);
  });

  it('skips one-time products, a bad date and a repeated id', () => {
    const list = [
      tx('ads', T0 + 1, 'remove_ads'),
      tx('nan', Number.NaN),
      tx('dup', T0 + 1),
      tx('dup', T0 + 1),
    ];
    expect(unpaidConsumables(fresh(), list).map((x) => x.transactionId)).toEqual(['dup']);
  });
});
