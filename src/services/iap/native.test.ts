import { describe, expect, it, vi } from 'vitest';
import type {
  CustomerInfo,
  PurchasesStoreProduct,
  PurchasesStoreTransaction,
} from '@revenuecat/purchases-capacitor';
import { PRODUCT_KEYS } from '../../data/economy/shop';
import { NativeIap, type PurchasesPlugin } from './native';
import { ProductIds } from './product-ids';

const IDS = new ProductIds(Object.fromEntries(PRODUCT_KEYS.map((key) => [key, `tippy_${key}`])));

const product = (identifier: string, priceString: string): PurchasesStoreProduct =>
  ({ identifier, priceString, title: identifier }) as PurchasesStoreProduct;

const transaction = (
  transactionIdentifier: string,
  productIdentifier: string,
  purchaseDate = '2026-11-01T10:00:00Z',
): PurchasesStoreTransaction =>
  ({ transactionIdentifier, productIdentifier, purchaseDate }) as PurchasesStoreTransaction;

const info = (transactions: PurchasesStoreTransaction[]): { customerInfo: CustomerInfo } => ({
  customerInfo: {
    allPurchasedProductIdentifiers: transactions.map((tx) => tx.productIdentifier),
    nonSubscriptionTransactions: transactions,
  } as unknown as CustomerInfo,
});

function fakePlugin(over: Partial<PurchasesPlugin> = {}): PurchasesPlugin {
  return {
    configure: vi.fn(() => Promise.resolve()),
    getProducts: vi.fn(() =>
      Promise.resolve({
        products: [product('tippy_berries_80', '€0.99'), product('tippy_remove_ads', '€3.99')],
      }),
    ),
    purchaseStoreProduct: vi.fn(() =>
      Promise.resolve({
        productIdentifier: 'tippy_berries_80',
        transaction: transaction('tx-1', 'tippy_berries_80'),
        customerInfo: info([]).customerInfo,
      }),
    ),
    restorePurchases: vi.fn(() => Promise.resolve(info([]))),
    getCustomerInfo: vi.fn(() => Promise.resolve(info([]))),
    ...over,
  };
}

const rejects = (error: unknown) => vi.fn(() => Promise.reject(error));

describe('NativeIap without a key', () => {
  it('is a store that is not there, and never calls the plugin', async () => {
    const plugin = fakePlugin();
    const iap = new NativeIap(plugin, undefined, IDS);
    await iap.init();
    expect(await iap.getProducts()).toEqual([]);
    expect(await iap.purchase('tippy_berries_80')).toEqual({
      result: 'failed',
      reason: 'unavailable',
    });
    expect(await iap.ownedNonConsumables()).toEqual([]);
    expect(await iap.completedTransactions()).toEqual([]);
    await expect(iap.restore()).rejects.toThrow();
    expect(plugin.configure).not.toHaveBeenCalled();
    expect(await new NativeIap(plugin, '  ', IDS).getProducts()).toEqual([]);
  });

  it('is the same store when configure fails', async () => {
    const iap = new NativeIap(fakePlugin({ configure: rejects(new Error('no')) }), 'key', IDS);
    expect(await iap.getProducts()).toEqual([]);
    expect(await iap.purchase('tippy_berries_80')).toEqual({
      result: 'failed',
      reason: 'unavailable',
    });
  });
});

describe('NativeIap products', () => {
  it('configures once and maps the store products with their store prices', async () => {
    const plugin = fakePlugin();
    const iap = new NativeIap(plugin, 'key', IDS);
    const list = await iap.getProducts();
    await iap.getProducts();
    expect(list).toEqual([
      { id: 'tippy_berries_80', priceString: '€0.99', title: 'tippy_berries_80' },
      { id: 'tippy_remove_ads', priceString: '€3.99', title: 'tippy_remove_ads' },
    ]);
    expect(plugin.configure).toHaveBeenCalledTimes(1);
    expect(plugin.configure).toHaveBeenCalledWith({ apiKey: 'key' });
    expect(plugin.getProducts).toHaveBeenCalledWith({
      productIdentifiers: PRODUCT_KEYS.map((key) => `tippy_${key}`),
      type: 'NON_SUBSCRIPTION',
    });
  });

  it('gives no products when the store cannot be reached', async () => {
    const iap = new NativeIap(fakePlugin({ getProducts: rejects({ code: '10' }) }), 'key', IDS);
    expect(await iap.getProducts()).toEqual([]);
  });
});

describe('NativeIap purchase', () => {
  it('returns the store transaction of a paid purchase', async () => {
    const plugin = fakePlugin();
    const iap = new NativeIap(plugin, 'key', IDS);
    expect(await iap.purchase('tippy_berries_80')).toEqual({
      result: 'purchased',
      transactionId: 'tx-1',
    });
    expect(plugin.getProducts).toHaveBeenCalledTimes(1);
    await iap.purchase('tippy_berries_80');
    expect(plugin.getProducts).toHaveBeenCalledTimes(1);
  });

  it('fails a product the store does not list', async () => {
    const iap = new NativeIap(fakePlugin(), 'key', IDS);
    expect(await iap.purchase('tippy_berries_2800')).toEqual({
      result: 'failed',
      reason: 'unavailable',
    });
  });

  it.each([
    ['cancelled by code', { code: '1' }, { result: 'cancelled' }],
    ['cancelled by flag', { code: '0', userCancelled: true }, { result: 'cancelled' }],
    ['pending', { code: '20' }, { result: 'pending' }],
    ['network', { code: '10' }, { result: 'failed', reason: 'network' }],
    ['offline', { code: '35' }, { result: 'failed', reason: 'network' }],
    ['store problem', { code: '2' }, { result: 'failed' }],
    ['no code', new Error('boom'), { result: 'failed' }],
    ['nothing', undefined, { result: 'failed' }],
  ])('ends a rejected purchase as %s', async (_name, error, expected) => {
    const iap = new NativeIap(fakePlugin({ purchaseStoreProduct: rejects(error) }), 'key', IDS);
    expect(await iap.purchase('tippy_berries_80')).toEqual(expected);
  });
});

describe('NativeIap owned and restore', () => {
  const account = info([
    transaction('t1', 'tippy_remove_ads'),
    transaction('t2', 'tippy_berries_80'),
    transaction('t3', 'other_app_product'),
  ]);

  it('lists only the one-time products of the game, for launch and for restore', async () => {
    const iap = new NativeIap(
      fakePlugin({
        getCustomerInfo: () => Promise.resolve(account),
        restorePurchases: () => Promise.resolve(account),
      }),
      'key',
      IDS,
    );
    expect(await iap.ownedNonConsumables()).toEqual(['tippy_remove_ads']);
    expect(await iap.restore()).toEqual(['tippy_remove_ads']);
  });

  it('lets a store failure reach the caller, which shows the error', async () => {
    const iap = new NativeIap(
      fakePlugin({ restorePurchases: rejects({ code: '10' }) }),
      'key',
      IDS,
    );
    await expect(iap.restore()).rejects.toBeDefined();
  });

  it('reports completed transactions with their purchase time', async () => {
    const iap = new NativeIap(
      fakePlugin({ getCustomerInfo: () => Promise.resolve(account) }),
      'key',
      IDS,
    );
    const list = await iap.completedTransactions();
    expect(list[1]).toEqual({
      productId: 'tippy_berries_80',
      transactionId: 't2',
      purchasedAt: Date.parse('2026-11-01T10:00:00Z'),
    });
  });
});
