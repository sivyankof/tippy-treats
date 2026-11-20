import { describe, expect, it } from 'vitest';
import { STUB_IAP } from '../../data/economy/iap-stub';
import { PRODUCT_KEYS } from '../../data/economy/shop';
import { ProductIds } from './product-ids';
import { createStubIap, stubCatalog } from './stub-iap';

const IDS = new ProductIds(Object.fromEntries(PRODUCT_KEYS.map((key) => [key, `tippy_${key}`])));

/** A storage that already holds a remove-ads test purchase (an internal build on the same phone). */
function storageWithPurchase(): () => Storage {
  const data = new Map<string, string>([
    [STUB_IAP.storageKey, JSON.stringify(['tippy_remove_ads'])],
  ]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  } as unknown as Storage;
  return () => storage;
}

describe('the purchase stub of the build', () => {
  it('sells every product with an id where the debug tools are', async () => {
    expect(stubCatalog(IDS, true).map((p) => p.id)).toEqual(PRODUCT_KEYS.map((k) => `tippy_${k}`));
    const iap = createStubIap(IDS, true, storageWithPurchase());
    expect((await iap.getProducts()).length).toBe(PRODUCT_KEYS.length);
    expect(await iap.ownedNonConsumables()).toEqual(['tippy_remove_ads']);
  });

  it('sells nothing and owns nothing in the store build', async () => {
    expect(stubCatalog(IDS, false)).toEqual([]);
    const iap = createStubIap(IDS, false, storageWithPurchase());
    expect(await iap.getProducts()).toEqual([]);
    expect(await iap.ownedNonConsumables()).toEqual([]);
    expect(await iap.restore()).toEqual([]);
    expect(await iap.purchase('tippy_berries_80')).toEqual({ result: 'failed' });
  });
});
