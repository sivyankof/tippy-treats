import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../../data/app/clock';
import { IAP_RULES } from '../../data/economy/iap-rules';
import type { ProductKey } from '../../data/economy/shop';
import { createDefaultSave } from '../save/defaults';
import { txProcessed, unpaidTransactions, withTxRecorded } from './purchase-tx';

const T0 = 1_700_000_000_000;
const fresh = () => createDefaultSave(T0, 'id');

describe('processed transactions', () => {
  it('remembers a transaction once, newest last', () => {
    const once = withTxRecorded(fresh(), ['a']);
    expect(withTxRecorded(once, ['a'])).toBe(once);
    expect(withTxRecorded(once, ['b']).iap.processedTx).toEqual(['a', 'b']);
    expect(txProcessed(once, ['a'])).toBe(true);
    expect(txProcessed(once, ['b'])).toBe(false);
    expect(txProcessed(once, [])).toBe(false);
  });

  it('remembers every id of one purchase, and any of them marks it paid', () => {
    const save = withTxRecorded(fresh(), ['store-1', 'listed-1', 'store-1']);
    expect(save.iap.processedTx).toEqual(['store-1', 'listed-1']);
    expect(txProcessed(save, ['listed-1'])).toBe(true);
    expect(txProcessed(save, ['other', 'store-1'])).toBe(true);
  });

  it('keeps only the newest ones', () => {
    let save = fresh();
    for (let i = 0; i < IAP_RULES.processedTxKeep + 5; i++) save = withTxRecorded(save, [`t${i}`]);
    expect(save.iap.processedTx).toHaveLength(IAP_RULES.processedTxKeep);
    expect(save.iap.processedTx[0]).toBe('t5');
    expect(save.iap.processedTx.at(-1)).toBe(`t${IAP_RULES.processedTxKeep + 4}`);
  });
});

describe('unpaid transactions at launch', () => {
  const tx = (transactionId: string, purchasedAt: number, key: ProductKey = 'berries_80') => ({
    key,
    transactionId,
    purchasedAt,
  });
  const ids = (list: readonly { transactionId: string }[]) => list.map((x) => x.transactionId);

  it('pays what is new and not older than the save', () => {
    const save = withTxRecorded(fresh(), ['paid']);
    const list = [tx('paid', T0 + 1), tx('new', T0 + 2), tx('old', T0 - 1), tx('same-ms', T0)];
    expect(ids(unpaidTransactions(save, list, T0 + 10))).toEqual(['new', 'same-ms']);
  });

  it('never pays a transaction older than the payout window, even one pushed out of the list', () => {
    const now = T0 + 30 * MS_PER_DAY;
    const edge = now - IAP_RULES.launchPayoutDays * MS_PER_DAY;
    const list = [tx('trimmed-long-ago', edge - 1), tx('recent', edge), tx('fresh', now - 5)];
    expect(ids(unpaidTransactions(fresh(), list, now))).toEqual(['recent', 'fresh']);
  });

  it('includes one-time products, skips a bad date and a repeated id', () => {
    const list = [
      tx('pack', T0 + 1, 'starter_pack'),
      tx('nan', Number.NaN),
      tx('dup', T0 + 1),
      tx('dup', T0 + 1),
    ];
    expect(ids(unpaidTransactions(fresh(), list, T0 + 10))).toEqual(['pack', 'dup']);
  });
});
