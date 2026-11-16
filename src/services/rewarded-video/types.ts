export type RewardedPlacement =
  | 'continue'
  | 'double_coins'
  | 'gift_double'
  | 'daily_attempt'
  | 'streak_restore'
  | 'shop_coins'
  | 'checkpoint_start';

export type RewardedResult = 'rewarded' | 'dismissed' | 'unavailable';

/** Why no rewarded ad can be shown: no network, or the network is fine but there is nothing to show. */
export type RewardedUnavailableReason = 'offline' | 'no_fill';

/** Ads of the game; the rules of what to show and when live in core, the service only executes. */
export interface AdsService {
  /** Call after consent. */
  init(): Promise<void>;
  isRewardedReady(): boolean;
  /** Null while a rewarded ad is ready; otherwise why it is not. */
  rewardedUnavailableReason(): RewardedUnavailableReason | null;
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  /**
   * Shows one interstitial and resolves when it is closed; true when an ad was shown. It knows no
   * rules: the caller decides in `core/video-policy.ts` that it is time.
   */
  showInterstitial(): Promise<boolean>;
  setRemoveAds(removed: boolean): void;
}

/** How the browser stub answers a rewarded ad. */
export type StubAdMode = 'reward' | 'dismissed' | RewardedUnavailableReason;

/** Dev-only control of the stub, used by the debug panel. */
export interface AdsDevControl {
  readonly mode: StubAdMode;
  /** Switches to the next mode and returns it. */
  cycleMode(): StubAdMode;
}
