import { services } from '../services';
import type { AdUnavailableReason } from '../services/rewarded-video/types';

/** What a rewarded-ad button says while no ad can be shown. */
export interface AdCaption {
  /** i18n key of the caption. */
  key: 'continue.adUnavailable' | 'continue.noInternet';
  /** The caption comes with the "no internet" icon. */
  offline: boolean;
}

/** The caption for an unavailable ad: "No internet" with an icon when offline, else the old one. */
export function adCaptionFor(reason: AdUnavailableReason): AdCaption {
  return reason === 'offline'
    ? { key: 'continue.noInternet', offline: true }
    : { key: 'continue.adUnavailable', offline: false };
}

/** The caption for the ad service's current answer. */
export function currentAdCaption(): AdCaption {
  return adCaptionFor(services.ads.unavailableReason());
}
