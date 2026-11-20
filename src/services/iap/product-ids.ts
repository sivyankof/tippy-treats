import { PRODUCT_KEYS, type ProductKey } from '../../data/economy/shop';

/**
 * Store identifiers of the products. They live only in `.env` (see `.env.example`), never in the
 * repository; a product without an id is unavailable.
 */
const ENV_IDS: Record<ProductKey, unknown> = {
  remove_ads: import.meta.env.VITE_IAP_REMOVE_ADS,
  starter_pack: import.meta.env.VITE_IAP_STARTER_PACK,
  berries_80: import.meta.env.VITE_IAP_BERRIES_80,
  berries_500: import.meta.env.VITE_IAP_BERRIES_500,
  berries_1200: import.meta.env.VITE_IAP_BERRIES_1200,
  berries_2800: import.meta.env.VITE_IAP_BERRIES_2800,
};

/** Maps logical keys to store ids; `ids` is what `.env` gave (a blank value means no id). */
export class ProductIds {
  private readonly byKey = new Map<ProductKey, string>();
  private readonly byId = new Map<string, ProductKey>();

  constructor(source: Partial<Record<ProductKey, unknown>>) {
    for (const key of PRODUCT_KEYS) {
      const raw = source[key];
      const id = typeof raw === 'string' ? raw.trim() : '';
      if (id === '' || this.byId.has(id)) continue;
      this.byKey.set(key, id);
      this.byId.set(id, key);
    }
  }

  /** The store id of a product, or null when `.env` has none. */
  idOf(key: ProductKey): string | null {
    return this.byKey.get(key) ?? null;
  }

  /** Every store id `.env` gave. */
  allIds(): string[] {
    return [...this.byId.keys()];
  }

  keyOf(id: string): ProductKey | null {
    return this.byId.get(id) ?? null;
  }

  /** The logical keys of the store ids the game knows; unknown ids are left out. */
  keysOf(ids: readonly string[]): ProductKey[] {
    return ids.flatMap((id) => {
      const key = this.keyOf(id);
      return key === null ? [] : [key];
    });
  }
}

export const productIds = new ProductIds(ENV_IDS);
