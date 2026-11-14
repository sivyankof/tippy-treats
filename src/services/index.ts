import { WebAds } from './ads/web';
import type { AdsDevControl, AdsService } from './ads/types';
import { WebAudioService } from './audio/web';
import type { AudioService } from './audio/types';
import type { HapticsService } from './haptics/types';
import { WebHaptics } from './haptics/web';

/** Everything the game asks of the device. Scenes use these and never pick an implementation. */
export interface Services {
  audio: AudioService;
  haptics: HapticsService;
  ads: AdsService;
}

const webAds = new WebAds();

/**
 * The single place that picks implementations. Capacitor is not installed yet, so these are
 * the web ones; native haptics and ads chosen by Capacitor.isNativePlatform() arrive in stage M7.
 */
export const services: Services = {
  audio: new WebAudioService(),
  haptics: new WebHaptics(),
  ads: webAds,
};

/** Dev switch of the ad stub (debug panel). Not part of the services: native ads have none. */
export const adsDev: AdsDevControl = webAds;
