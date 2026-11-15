import { STUB_PRICES } from '../data/iap-stub';
import { PRODUCT_KEYS, PRODUCTS } from '../data/shop';
import { t } from '../i18n';
import { WebAds } from './rewarded-video/web';
import type { AdsDevControl, AdsService } from './rewarded-video/types';
import { WebAudioService } from './audio/web';
import type { ShareService } from './share/types';
import { WebShare } from './share/web';
import type { AudioService } from './audio/types';
import type { HapticsService } from './haptics/types';
import { WebHaptics } from './haptics/web';
import { productIds } from './iap/product-ids';
import type { IapDevControl, IapService } from './iap/types';
import { WebIap, type StubProduct } from './iap/web';
import type { AnalyticsService } from './telemetry/types';
import { WebAnalytics } from './telemetry/web';
import type { StorageService } from './storage/types';
import { WebStorage } from './storage/web';

/** Everything the game asks of the device. Scenes use these and never pick an implementation. */
export interface Services {
  audio: AudioService;
  haptics: HapticsService;
  ads: AdsService;
  iap: IapService;
  storage: StorageService;
  share: ShareService;
  telemetry: AnalyticsService;
}

const webAds = new WebAds();

/** The products of the store stub: the ones `.env` gives an id to, at stub prices. */
const stubCatalog: StubProduct[] = PRODUCT_KEYS.flatMap((key) => {
  const id = productIds.idOf(key);
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

const webIap = new WebIap(stubCatalog);

/**
 * The single place that picks implementations. Capacitor is not installed yet, so these are
 * the web ones; native haptics, ads and purchases chosen by Capacitor.isNativePlatform() arrive
 * in stage M7.
 */
export const services: Services = {
  audio: new WebAudioService(),
  haptics: new WebHaptics(),
  ads: webAds,
  iap: webIap,
  storage: new WebStorage(),
  share: new WebShare(),
  telemetry: new WebAnalytics(),
};

/** Dev switch of the ad stub (debug panel). Not part of the services: native ads have none. */
export const adsDev: AdsDevControl = webAds;

/** Dev switch of the store stub (debug panel). Null outside the development build, so the reset cannot be reached in production. */
export const iapDev: IapDevControl | null = import.meta.env.DEV ? webIap : null;
