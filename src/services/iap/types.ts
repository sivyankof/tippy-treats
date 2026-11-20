/** How a purchase ended; the values `iap_result` logs (docs/09-services-analytics.md, section 5). */
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed' | 'pending';

/** What a purchase gave back: the result, the store transaction when paid, why when failed. */
export interface PurchaseReport {
  result: PurchaseResult;
  /**
   * Ids of the paid transaction, only with `purchased` from a real store: the store's id from the
   * purchase answer and the id the account's transaction list (`completedTransactions`) shows for
   * it, when the two differ. All are remembered, so the launch check never pays it again.
   */
  transactionIds?: string[];
  /** Only with `failed`: the store is not there at all, or the network is. */
  reason?: 'unavailable' | 'network';
}

/** A one-time transaction the store has completed (consumables included). */
export interface StoreTransaction {
  productId: string;
  transactionId: string;
  /** Epoch ms of the purchase. */
  purchasedAt: number;
}

/** Purchases of the game (docs/09-services-analytics.md, section 5). Ids are the store's product ids. */
export interface IapService {
  init(): Promise<void>;
  getProducts(): Promise<Array<{ id: string; priceString: string; title: string }>>;
  purchase(id: string): Promise<PurchaseReport>;
  /** Owned non-consumable ids. */
  restore(): Promise<string[]>;
  ownedNonConsumables(): Promise<string[]>;
  /** Every completed one-time transaction of the store account, consumables too. */
  completedTransactions(): Promise<StoreTransaction[]>;
}

/** Debug-panel control of the browser store stub; null outside the development build. */
export interface IapDevControl {
  resetPurchases(): void;
}
