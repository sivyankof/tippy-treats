// Store transactions already paid out, as pure rules over the save (docs/09-services-analytics.md,
// section 5): a consumable is paid once per transaction.
import { IAP_RULES } from '../../data/economy/iap-rules';
import { PRODUCTS, type ProductKey } from '../../data/economy/shop';
import type { Save } from '../save/schema';

/** A completed store transaction of a product the game knows. */
export interface KnownTransaction {
  key: ProductKey;
  transactionId: string;
  /** Epoch ms of the purchase. */
  purchasedAt: number;
}

export function txProcessed(save: Pick<Save, 'iap'>, transactionId: string): boolean {
  return save.iap.processedTx.includes(transactionId);
}

/** The save with the transaction remembered as paid out (newest last, the oldest forgotten past the limit). */
export function withTxRecorded(save: Save, transactionId: string): Save {
  if (txProcessed(save, transactionId)) return save;
  const processedTx = [...save.iap.processedTx, transactionId].slice(-IAP_RULES.processedTxKeep);
  return { ...save, iap: { ...save.iap, processedTx } };
}

/**
 * The consumable transactions to pay out at launch: not yet on the list and not older than the
 * save (a reinstall or a progress reset never pays old berries again). Each transaction once.
 */
export function unpaidConsumables(
  save: Pick<Save, 'iap' | 'createdAt'>,
  transactions: readonly KnownTransaction[],
): KnownTransaction[] {
  const seen = new Set<string>();
  return transactions.filter((tx) => {
    if (PRODUCTS[tx.key].kind !== 'consumable') return false;
    if (!Number.isFinite(tx.purchasedAt) || tx.purchasedAt < save.createdAt) return false;
    if (txProcessed(save, tx.transactionId) || seen.has(tx.transactionId)) return false;
    seen.add(tx.transactionId);
    return true;
  });
}
