import type { ProductKey } from '../../data/economy/shop';
import { productOwned } from '../../core/economy/shop';
import { productIds } from '../../services/iap/product-ids';
import { services } from '../../services';
import type { PurchaseReport, PurchaseResult } from '../../services/iap/types';
import { gameState } from '../../state';
import { logIapResult, logIapStart } from './economy-telemetry';
import { requestCloudWrite } from '../cloud/cloud-actions';

/**
 * How a purchase ended: the store's result (`PurchaseResult`, what `iap_result` logs) plus
 * `unavailable` (`.env` has no store id for the product) and `offline` (the store or the network
 * is not there).
 */
export type BuyOutcome = PurchaseResult | 'unavailable' | 'offline';

/** The i18n key of the line a failed purchase shows; null when nothing is to be said (done or cancelled). */
export function buyOutcomeKey(outcome: BuyOutcome): string | null {
  switch (outcome) {
    case 'pending':
      return 'shop.pending';
    case 'offline':
      return 'shop.storeDown';
    case 'failed':
    case 'unavailable':
      return 'shop.failed';
    default:
      return null;
  }
}

/** What "Restore purchases" found. */
export type RestoreOutcome = 'restored' | 'nothing' | 'failed';

/** The store price of every product the store knows, by key (`priceString` comes from the store). */
export type Prices = Partial<Record<ProductKey, string>>;

/** Keeps the ads service in step with the save. */
function applyRemoveAds(): void {
  services.ads.setRemoveAds(gameState.data.purchases.removeAds);
}

/** Store prices by product key; empty when the store cannot be reached. */
export async function loadPrices(): Promise<Prices> {
  try {
    const products = await services.iap.getProducts();
    const prices: Prices = {};
    for (const { id, priceString } of products) {
      const key = productIds.keyOf(id);
      if (key !== null) prices[key] = priceString;
    }
    return prices;
  } catch {
    return {};
  }
}

/**
 * Buys a product through the store. The goods are paid out only after the store said
 * `purchased`; a cancelled, failed or pending purchase changes nothing.
 */
export async function buyProduct(key: ProductKey): Promise<BuyOutcome> {
  const id = productIds.idOf(key);
  if (id === null) return 'unavailable';
  let report: PurchaseReport;
  logIapStart(key);
  try {
    report = await services.iap.purchase(id);
  } catch {
    logIapResult(key, 'failed');
    return 'failed';
  }
  logIapResult(key, report.result);
  if (report.result === 'failed') return report.reason === 'network' ? 'offline' : 'failed';
  if (report.result !== 'purchased') return report.result;
  gameState.grantProduct(key, report.transactionIds);
  applyRemoveAds();
  gameState.flush();
  requestCloudWrite();
  // One reward sound for every successful purchase, whichever screen it was made on.
  services.audio.play('purchase');
  return 'purchased';
}

/** One-time products the launch check gave back that the player was not told about yet. */
const untold = new Set<ProductKey>();

/**
 * The one-time products the launch check gave back (the store says the account owns them, the
 * save did not) since the last call; empty when none. The check waits only `BOOT.purchasesWaitMs`
 * before the game starts and may end later, on any screen: the shop takes this when it can speak
 * and says why the starter pack left. "Restore purchases" tells its own result and clears it.
 */
export function takeLaunchRestored(): ProductKey[] {
  const keys = [...untold];
  untold.clear();
  return keys;
}

/**
 * Puts what the store says is owned into the save; null when the store cannot be asked. `owned`:
 * what the store says; `restored`: the one-time products the save did not have and now has.
 */
async function syncOwned(
  fetchOwned: () => Promise<string[]>,
): Promise<{ owned: ProductKey[]; restored: ProductKey[] } | null> {
  try {
    const owned = productIds.keysOf(await fetchOwned());
    const before = gameState.data;
    if (!gameState.restorePurchases(owned)) return { owned, restored: [] };
    gameState.flush();
    requestCloudWrite();
    const restored = owned.filter(
      (key) => !productOwned(before, key) && productOwned(gameState.data, key),
    );
    return { owned, restored };
  } catch {
    return null;
  } finally {
    applyRemoveAds();
  }
}

/**
 * Pays out what the store completed that was never paid here: an approved "Ask to Buy", or a
 * purchase cut off between the store's answer and the payout. Only recent transactions not older
 * than the save, once each (`unpaidTransactions`); a one-time product already owned is skipped.
 */
async function payUnpaidTransactions(): Promise<boolean> {
  try {
    const known = (await services.iap.completedTransactions()).flatMap((tx) => {
      const key = productIds.keyOf(tx.productId);
      return key === null
        ? []
        : [{ key, transactionId: tx.transactionId, purchasedAt: tx.purchasedAt }];
    });
    let paid = false;
    for (const tx of gameState.unpaidTransactions(known)) {
      paid = gameState.grantProduct(tx.key, [tx.transactionId]) || paid;
    }
    if (paid) {
      gameState.flush();
      requestCloudWrite();
    }
    return paid;
  } catch {
    // The store cannot be asked now; the next reconcile tries again.
    return false;
  }
}

/** What one reconcile did: whether goods were paid out, and what the store said is owned (null: not asked). */
interface Reconciled {
  paid: boolean;
  synced: { owned: ProductKey[]; restored: ProductKey[] } | null;
}

/** The reconcile under way; a call during it gets its result. */
let reconciling: Promise<Reconciled> | null = null;

/**
 * The one reconcile of the store with the save, for the launch, "Restore purchases" and the app
 * coming back to the front: first pays what the store completed but was never paid here, then
 * puts the owned one-time products into the save and switches ads off if owned. One at a time:
 * a call made while another runs waits for it and gets its result.
 */
function reconcile(fetchOwned: () => Promise<string[]>): Promise<Reconciled> {
  reconciling ??= (async () => {
    try {
      // The payout goes first: a starter pack approved later is paid in full, not taken for a
      // restore (which gives back the creature only).
      const paid = await payUnpaidTransactions();
      return { paid, synced: await syncOwned(fetchOwned) };
    } finally {
      reconciling = null;
    }
  })();
  return reconciling;
}

/** At launch and when the app returns to the front: reconciles the store with the save. */
export async function syncPurchases(): Promise<void> {
  const { synced } = await reconcile(() => services.iap.ownedNonConsumables());
  for (const key of synced?.restored ?? []) untold.add(key);
}

/**
 * The "Restore purchases" button: the same reconcile, asking the store to restore. `restored`
 * when something was paid out or the store names a one-time product; `failed` when the store
 * could not be asked and nothing was paid.
 */
export async function restorePurchases(): Promise<RestoreOutcome> {
  const { paid, synced } = await reconcile(() => services.iap.restore());
  untold.clear();
  if (paid) return 'restored';
  if (synced === null) return 'failed';
  return synced.owned.length > 0 ? 'restored' : 'nothing';
}
