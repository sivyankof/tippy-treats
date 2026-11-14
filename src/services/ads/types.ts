export type RewardedPlacement =
  'continue' | 'double_coins' | 'gift_double' | 'daily_attempt' | 'streak_restore' | 'shop_coins';

export type RewardedResult = 'rewarded' | 'dismissed' | 'unavailable';

/** Ads of the game; the rules of what to show and when live in core, the service only executes. */
export interface AdsService {
  /** Call after consent. */
  init(): Promise<void>;
  isRewardedReady(): boolean;
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  /** Checks all the rules itself; true when an ad was shown. */
  maybeShowInterstitial(): Promise<boolean>;
  setRemoveAds(removed: boolean): void;
}

/** How the browser stub answers a rewarded ad. */
export type StubAdMode = 'reward' | 'dismissed' | 'unavailable';

/** Dev-only control of the stub, used by the debug panel. */
export interface AdsDevControl {
  readonly mode: StubAdMode;
  /** Switches to the next mode and returns it. */
  cycleMode(): StubAdMode;
}
