import {
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
  type AdMobPlugin,
} from '@capacitor-community/admob';

/** The events of the ad SDK the game listens to. */
export type AdEvent =
  | 'rewarded'
  | 'rewardedDismissed'
  | 'rewardedFailedToShow'
  | 'interstitialDismissed'
  | 'interstitialFailedToShow';

/** What the game needs of `@capacitor-community/admob` for ads (injected, so tests run without the app). */
export interface AdsPlugin {
  initialize(): Promise<void>;
  prepareRewarded(adId: string): Promise<void>;
  showRewarded(): Promise<void>;
  prepareInterstitial(adId: string): Promise<void>;
  showInterstitial(): Promise<void>;
  /** Subscribes to an SDK event for the life of the app. */
  on(event: AdEvent, handler: () => void): Promise<void>;
}

/** The real plugin behind `AdsPlugin`. */
export function createAdMobAdsPlugin(admob: AdMobPlugin): AdsPlugin {
  return {
    initialize: () => admob.initialize(),
    prepareRewarded: async (adId) => {
      await admob.prepareRewardVideoAd({ adId });
    },
    showRewarded: async () => {
      await admob.showRewardVideoAd();
    },
    prepareInterstitial: async (adId) => {
      await admob.prepareInterstitial({ adId });
    },
    showInterstitial: () => admob.showInterstitial(),
    on: async (event, handler) => {
      switch (event) {
        case 'rewarded':
          await admob.addListener(RewardAdPluginEvents.Rewarded, handler);
          return;
        case 'rewardedDismissed':
          await admob.addListener(RewardAdPluginEvents.Dismissed, handler);
          return;
        case 'rewardedFailedToShow':
          await admob.addListener(RewardAdPluginEvents.FailedToShow, handler);
          return;
        case 'interstitialDismissed':
          await admob.addListener(InterstitialAdPluginEvents.Dismissed, handler);
          return;
        case 'interstitialFailedToShow':
          await admob.addListener(InterstitialAdPluginEvents.FailedToShow, handler);
      }
    },
  };
}
