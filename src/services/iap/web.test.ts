import { describe, expect, it, vi } from 'vitest';
import { STUB_IAP } from '../../data/iap-stub';
import { WebIap, type StubProduct } from './web';

const CATALOG: StubProduct[] = [
  { id: 'ads', priceString: '$3.99', title: () => 'No ads', consumable: false },
  { id: 'berries', priceString: '$0.99', title: () => '80 berries', consumable: true },
];

/** A fake `localStorage` over the in-memory storage, so a "reload" is a new `WebIap` on the same map. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  } as unknown as Storage;
}

describe('WebIap', () => {
  it('lists the products with their prices and titles', async () => {
    const iap = new WebIap(
      CATALOG,
      () => Promise.resolve(true),
      () => null,
    );
    await expect(iap.getProducts()).resolves.toEqual([
      { id: 'ads', priceString: '$3.99', title: 'No ads' },
      { id: 'berries', priceString: '$0.99', title: '80 berries' },
    ]);
  });

  it('asks with the title and the price and answers purchased or cancelled', async () => {
    const confirm = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const iap = new WebIap(CATALOG, confirm, () => null);
    await expect(iap.purchase('berries')).resolves.toBe('purchased');
    expect(confirm).toHaveBeenCalledWith({ title: '80 berries', price: '$0.99' });
    await expect(iap.purchase('berries')).resolves.toBe('cancelled');
  });

  it('fails an unknown product and never asks', async () => {
    const confirm = vi.fn();
    const iap = new WebIap(CATALOG, confirm, () => null);
    await expect(iap.purchase('nope')).resolves.toBe('failed');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('remembers a bought non-consumable under its own key and refuses to sell it twice', async () => {
    const storage = fakeStorage();
    const iap = new WebIap(
      CATALOG,
      () => Promise.resolve(true),
      () => storage,
    );
    await iap.purchase('ads');
    expect(storage.getItem(STUB_IAP.storageKey)).toBe('["ads"]');
    await expect(iap.purchase('ads')).resolves.toBe('failed');
    // A new page: the store still knows what was bought.
    const again = new WebIap(
      CATALOG,
      () => Promise.resolve(true),
      () => storage,
    );
    await expect(again.restore()).resolves.toEqual(['ads']);
    await expect(again.ownedNonConsumables()).resolves.toEqual(['ads']);
  });

  it('does not remember a consumable and keeps a cancelled one out', async () => {
    const storage = fakeStorage();
    const confirm = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const iap = new WebIap(CATALOG, confirm, () => storage);
    await iap.purchase('berries');
    await iap.purchase('ads');
    await expect(iap.ownedNonConsumables()).resolves.toEqual([]);
  });

  it('keeps purchases in the page when the storage is blocked', async () => {
    const iap = new WebIap(
      CATALOG,
      () => Promise.resolve(true),
      () => {
        throw new Error('blocked');
      },
    );
    await iap.purchase('ads');
    await expect(iap.restore()).resolves.toEqual(['ads']);
  });

  it('ignores a damaged stored value', async () => {
    const storage = fakeStorage();
    storage.setItem(STUB_IAP.storageKey, '{oops');
    const iap = new WebIap(
      CATALOG,
      () => Promise.resolve(true),
      () => storage,
    );
    await expect(iap.restore()).resolves.toEqual([]);
  });

  it('answers one purchase at a time', async () => {
    let finish: (answer: boolean) => void = () => undefined;
    const iap = new WebIap(
      CATALOG,
      () => new Promise<boolean>((resolve) => (finish = resolve)),
      () => null,
    );
    const first = iap.purchase('berries');
    await expect(iap.purchase('berries')).resolves.toBe('failed');
    finish(true);
    await expect(first).resolves.toBe('purchased');
  });
});
