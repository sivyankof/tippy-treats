import type { ProductKey } from '../data/economy/shop';
import { productIds } from '../services/iap/product-ids';
import { services } from '../services';
import { gameState } from '../state';

/** How a purchase ended; `unavailable` means `.env` has no store id for the product. */
export type BuyOutcome = 'purchased' | 'cancelled' | 'failed' | 'pending' | 'unavailable';

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
  let result: Awaited<ReturnType<typeof services.iap.purchase>>;
  try {
    result = await services.iap.purchase(id);
  } catch {
    return 'failed';
  }
  if (result !== 'purchased') return result;
  gameState.grantProduct(key);
  applyRemoveAds();
  gameState.flush();
  // One reward sound for every successful purchase, whichever screen it was made on.
  services.audio.play('purchase');
  return 'purchased';
}

/** Puts what the store says is owned into the save; null when the store cannot be asked. */
async function syncOwned(fetchOwned: () => Promise<string[]>): Promise<ProductKey[] | null> {
  try {
    const keys = productIds.keysOf(await fetchOwned());
    if (gameState.restorePurchases(keys)) gameState.flush();
    return keys;
  } catch {
    return null;
  } finally {
    applyRemoveAds();
  }
}

/** At launch: reconciles the store's one-time purchases with the save and switches ads off if owned. */
export async function syncPurchases(): Promise<void> {
  await syncOwned(() => services.iap.ownedNonConsumables());
}

/** The "Restore purchases" button. */
export async function restorePurchases(): Promise<RestoreOutcome> {
  const keys = await syncOwned(() => services.iap.restore());
  if (keys === null) return 'failed';
  return keys.length > 0 ? 'restored' : 'nothing';
}
