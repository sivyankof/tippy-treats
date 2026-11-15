/** Purchases of the game (docs/09-services-analytics.md, section 5). Ids are the store's product ids. */
export interface IapService {
  init(): Promise<void>;
  getProducts(): Promise<Array<{ id: string; priceString: string; title: string }>>;
  purchase(id: string): Promise<'purchased' | 'cancelled' | 'failed' | 'pending'>;
  /** Owned non-consumable ids. */
  restore(): Promise<string[]>;
  ownedNonConsumables(): Promise<string[]>;
}

/** Debug-panel control of the browser store stub; null outside the development build. */
export interface IapDevControl {
  resetPurchases(): void;
}
