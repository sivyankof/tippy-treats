import {
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesStoreProduct,
} from '@revenuecat/purchases-capacitor';
import { PRODUCTS } from '../../data/economy/shop';
import type { ProductIds } from './product-ids';
import type { IapService, PurchaseReport, StoreTransaction } from './types';

/** What the game needs of `@revenuecat/purchases-capacitor` (injected, so tests run without the app). */
export interface PurchasesPlugin {
  configure(options: { apiKey: string }): Promise<void>;
  getProducts(options: {
    productIdentifiers: string[];
    type: PRODUCT_CATEGORY;
  }): Promise<{ products: PurchasesStoreProduct[] }>;
  purchaseStoreProduct(options: { product: PurchasesStoreProduct }): Promise<MakePurchaseResult>;
  restorePurchases(): Promise<{ customerInfo: CustomerInfo }>;
  getCustomerInfo(): Promise<{ customerInfo: CustomerInfo }>;
}

const NETWORK_CODES: readonly string[] = [
  PURCHASES_ERROR_CODE.NETWORK_ERROR,
  PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR,
];

/** The error code of a rejected plugin call, as text; '' when the rejection carries none. */
function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  const { code } = error as { code: unknown };
  return typeof code === 'string' || typeof code === 'number' ? String(code) : '';
}

function userCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { userCancelled?: unknown }).userCancelled === true
  );
}

/** How a rejected purchase ends (docs/09-services-analytics.md, section 5). */
function failedPurchase(error: unknown): PurchaseReport {
  const code = errorCode(error);
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || userCancelled(error)) {
    return { result: 'cancelled' };
  }
  if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { result: 'pending' };
  if (NETWORK_CODES.includes(code)) return { result: 'failed', reason: 'network' };
  return { result: 'failed' };
}

/**
 * Purchases through RevenueCat (docs/09-services-analytics.md, section 5). Without an API key, or
 * when the SDK cannot start, the service is "store unavailable": no products, no purchases, and no
 * crash. A rejected plugin call never leaves the service as an unhandled rejection.
 */
export class NativeIap implements IapService {
  private ready: Promise<boolean> | null = null;
  private readonly products = new Map<string, PurchasesStoreProduct>();

  constructor(
    private readonly plugin: PurchasesPlugin,
    private readonly apiKey: string | undefined,
    private readonly ids: ProductIds,
  ) {}

  /** Configures the SDK once; false when there is no key or the start failed. */
  private configured(): Promise<boolean> {
    this.ready ??= this.configure();
    return this.ready;
  }

  private async configure(): Promise<boolean> {
    const key = this.apiKey?.trim();
    if (!key) return false;
    try {
      await this.plugin.configure({ apiKey: key });
      return true;
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    await this.configured();
  }

  async getProducts(): Promise<Array<{ id: string; priceString: string; title: string }>> {
    if (!(await this.configured())) return [];
    try {
      const productIdentifiers = this.ids.allIds();
      if (productIdentifiers.length === 0) return [];
      const { products } = await this.plugin.getProducts({
        productIdentifiers,
        type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
      });
      this.products.clear();
      for (const product of products) this.products.set(product.identifier, product);
      return products.map(({ identifier, priceString, title }) => ({
        id: identifier,
        priceString,
        title,
      }));
    } catch {
      return [];
    }
  }

  async purchase(id: string): Promise<PurchaseReport> {
    if (!(await this.configured())) return { result: 'failed', reason: 'unavailable' };
    try {
      if (!this.products.has(id)) await this.getProducts();
      const product = this.products.get(id);
      if (product === undefined) return { result: 'failed', reason: 'unavailable' };
      const { transaction } = await this.plugin.purchaseStoreProduct({ product });
      return { result: 'purchased', transactionId: transaction.transactionIdentifier };
    } catch (error) {
      return failedPurchase(error);
    }
  }

  /** Asks the store about the account's purchases; throws when it cannot (the button says so). */
  async restore(): Promise<string[]> {
    if (!(await this.configured())) throw new Error('store unavailable');
    const { customerInfo } = await this.plugin.restorePurchases();
    return this.ownedOneTime(customerInfo);
  }

  async ownedNonConsumables(): Promise<string[]> {
    if (!(await this.configured())) return [];
    const { customerInfo } = await this.plugin.getCustomerInfo();
    return this.ownedOneTime(customerInfo);
  }

  async completedTransactions(): Promise<StoreTransaction[]> {
    if (!(await this.configured())) return [];
    const { customerInfo } = await this.plugin.getCustomerInfo();
    return customerInfo.nonSubscriptionTransactions.map((tx) => ({
      productId: tx.productIdentifier,
      transactionId: tx.transactionIdentifier,
      purchasedAt: Date.parse(tx.purchaseDate),
    }));
  }

  /** The ids of the one-time (non-consumable) products the account has bought. */
  private ownedOneTime(info: CustomerInfo): string[] {
    const bought = new Set([
      ...info.allPurchasedProductIdentifiers,
      ...info.nonSubscriptionTransactions.map((tx) => tx.productIdentifier),
    ]);
    return [...bought].filter((id) => {
      const key = this.ids.keyOf(id);
      return key !== null && PRODUCTS[key].kind === 'non_consumable';
    });
  }
}
