import { STUB_PRICES } from '../../data/economy/iap-stub';
import { PRODUCT_KEYS, PRODUCTS } from '../../data/economy/shop';
import { t } from '../../i18n';
import type { ProductIds } from './product-ids';
import { WebIap, type OwnedStorageSource, type StubProduct } from './web';

/** No storage: the stub remembers no purchase from before. */
const NO_STORAGE: OwnedStorageSource = () => null;

/** The products of the store stub: the ones `.env` gives an id to, at stub prices; none when the stub is off. */
export function stubCatalog(ids: ProductIds, enabled: boolean): StubProduct[] {
  if (!enabled) return [];
  return PRODUCT_KEYS.flatMap((key) => {
    const id = ids.idOf(key);
    if (id === null) return [];
    return [
      {
        id,
        priceString: STUB_PRICES[key],
        title: () => t(`shop.product.${key}`),
        consumable: PRODUCTS[key].kind === 'consumable',
      },
    ];
  });
}

/**
 * The purchase stub of this build. Off (the store build until M8) it sells nothing and owns
 * nothing: a purchase test-bought in an internal build on the same phone is not restored either.
 * `storage` stands in for the browser storage in tests.
 */
export function createStubIap(
  ids: ProductIds,
  enabled: boolean,
  storage?: OwnedStorageSource,
): WebIap {
  const source = enabled ? storage : NO_STORAGE;
  return new WebIap(stubCatalog(ids, enabled), undefined, source);
}
