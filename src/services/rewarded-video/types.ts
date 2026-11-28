export type RewardedPlacement =
  | 'continue'
  | 'double_coins'
  | 'gift_double'
  | 'daily_attempt'
  | 'streak_restore'
  | 'shop_coins'
  | 'checkpoint_start';

export type RewardedResult = 'rewarded' | 'dismissed' | 'unavailable';

/**
 * Why no rewarded ad can be shown: no network; the next ad is being loaded right now; or the
 * network is fine but there is nothing to show.
 */
export type RewardedUnavailableReason = 'offline' | 'loading' | 'no_fill';

/** The reasons the analytics events know: a load under way counts as `no_fill` there. */
export type RewardedReasonParam = Exclude<RewardedUnavailableReason, 'loading'>;

/** Ads of the game; the rules of what to show and when live in core, the service only executes. */
export interface AdsService {
  /** Call after consent. */
  init(): Promise<void>;
  isRewardedReady(): boolean;
  /**
   * Null while a rewarded ad is ready or another one shows; otherwise why it is not. `offline`
   * wins over `loading`; `loading` only while the load request itself runs (not in the waits
   * between retries) and for at most `AD_LOAD.loadingCaptionMaxMs`.
   */
  rewardedUnavailableReason(): RewardedUnavailableReason | null;
  /**
   * Starts loading again when no ad is ready and none is loading: the failure count starts over
   * and a waiting retry is replaced. Called when the app returns, the network comes back or a
   * screen with an ad button opens. Does nothing otherwise.
   */
  wake(): void;
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  /**
   * Shows one interstitial and resolves when it is closed; true when an ad was shown. It knows no
   * rules: the caller decides in `core/economy/video-policy.ts` that it is time.
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
