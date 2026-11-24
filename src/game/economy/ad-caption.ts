import { services } from '../../services';
import type { RewardedUnavailableReason } from '../../services/rewarded-video/types';

/** What a rewarded-ad button says while no ad can be shown. */
export interface AdCaption {
  /** i18n key of the caption. */
  key: 'continue.adUnavailable' | 'continue.noInternet' | 'continue.adLoading';
  /** The caption comes with the "no internet" icon. */
  offline: boolean;
}

/**
 * The caption for an unavailable ad: "No internet" with an icon when offline, "Loading…" while
 * the next ad loads, else "Ad unavailable".
 */
export function adCaptionFor(reason: RewardedUnavailableReason | null): AdCaption {
  if (reason === 'offline') return { key: 'continue.noInternet', offline: true };
  if (reason === 'loading') return { key: 'continue.adLoading', offline: false };
  return { key: 'continue.adUnavailable', offline: false };
}

/** The caption for the ad service's current answer. */
export function currentAdCaption(): AdCaption {
  return adCaptionFor(services.ads.rewardedUnavailableReason());
}

/**
 * Everything a rewarded-ad button shows, as one value to compare: ready, why not, or `busy`
 * while another ad shows. A button redraws only when it changes.
 */
export type AdState = 'ready' | RewardedUnavailableReason | 'busy';

export function currentAdState(): AdState {
  if (services.ads.isRewardedReady()) return 'ready';
  return services.ads.rewardedUnavailableReason() ?? 'busy';
}
