import { services } from '../../services';
import type { EventParams } from '../../services/telemetry/types';

/** Where the shop was opened from. */
export type ShopSource = 'home' | 'return';

/** Parameters of `gift_open`: whether the player doubled the coins with an ad. */
export function giftOpenParams(doubled: boolean): EventParams {
  return { doubled };
}

/** The gift box was opened; sent when its window goes away, once the player has had the chance to double it. */
export function logGiftOpen(doubled: boolean): void {
  services.telemetry.logEvent('gift_open', giftOpenParams(doubled));
}

/** The shop screen was opened; `source` is the place that led there. */
export function logShopOpen(source: ShopSource): void {
  services.telemetry.logEvent('shop_open', { source });
}

/** A store purchase was started (`product` is the key of the product, never the store's id). */
export function logIapStart(product: string): void {
  services.telemetry.logEvent('iap_start', { product });
}

/** A store purchase ended; `result` is `purchased`, `cancelled`, `failed` or `pending`. */
export function logIapResult(product: string, result: string): void {
  services.telemetry.logEvent('iap_result', { product, result });
}
