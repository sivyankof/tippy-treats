// Store transactions already paid out, as pure rules over the save (docs/09-services-analytics.md,
// section 5): a consumable is paid once per transaction.
import { IAP_RULES } from '../../data/economy/iap-rules';
import { MS_PER_DAY } from '../../data/app/clock';
import type { ProductKey } from '../../data/economy/shop';
import type { Save } from '../save/schema';

/** A completed store transaction of a product the game knows. */
export interface KnownTransaction {
  key: ProductKey;
  transactionId: string;
  /** Epoch ms of the purchase. */
  purchasedAt: number;
}

/** True when any of the ids (one purchase may be known under several) was already paid out. */
export function txProcessed(save: Pick<Save, 'iap'>, transactionIds: readonly string[]): boolean {
  return transactionIds.some((id) => save.iap.processedTx.includes(id));
}

/** The save with the transaction ids remembered as paid out (newest last, the oldest forgotten past the limit). */
export function withTxRecorded(save: Save, transactionIds: readonly string[]): Save {
  const fresh = [...new Set(transactionIds)].filter((id) => !save.iap.processedTx.includes(id));
  if (fresh.length === 0) return save;
  const processedTx = [...save.iap.processedTx, ...fresh].slice(-IAP_RULES.processedTxKeep);
  return { ...save, iap: { ...save.iap, processedTx } };
}

/**
 * The transactions to pay out at launch: not yet on the list, not older than the save (a reinstall
 * or a progress reset never pays old berries again) and at most `IAP_RULES.launchPayoutDays` old
 * (an id pushed out of the list long ago is never paid again). One-time products are included:
 * a starter pack approved later is paid in full, and `grantProduct` refuses one already owned.
 * Each transaction once.
 */
export function unpaidTransactions(
  save: Pick<Save, 'iap' | 'createdAt'>,
  transactions: readonly KnownTransaction[],
  nowMs: number,
): KnownTransaction[] {
  const oldest = Math.max(save.createdAt, nowMs - IAP_RULES.launchPayoutDays * MS_PER_DAY);
  const seen = new Set<string>();
  return transactions.filter((tx) => {
    if (!Number.isFinite(tx.purchasedAt) || tx.purchasedAt < oldest) return false;
    if (txProcessed(save, [tx.transactionId]) || seen.has(tx.transactionId)) return false;
    seen.add(tx.transactionId);
    return true;
  });
}
