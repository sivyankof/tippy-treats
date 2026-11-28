import { AD_LOAD } from '../../data/economy/rewarded-video';
import type { AdUnits } from './ad-units';
import type { AdsPlugin } from './plugin';
import type { AdsService, RewardedResult, RewardedUnavailableReason } from './types';

type Schedule = (run: () => void, delayMs: number) => unknown;

/** One kind of ad the SDK loads ahead: ready or not, and how many loads failed in a row. */
interface Slot {
  unit: string | undefined;
  ready: boolean;
  loading: boolean;
  /** When the load under way began (`now()`); meaningful only while `loading`. */
  loadStartedAt: number;
  failures: number;
  retry: unknown;
  /** When the last load failed (`now()`). */
  failedAt: number;
}

const newSlot = (unit: string | undefined): Slot => ({
  unit,
  ready: false,
  loading: false,
  loadStartedAt: 0,
  failures: 0,
  retry: null,
  failedAt: 0,
});

/**
 * The ads of the phone (AdMob, docs/09-services-analytics.md, section 3). One rewarded and one
 * interstitial ad are loaded ahead; after each show the next one loads. A failed load is retried
 * after the waits of `AD_LOAD.retryDelaysMs`, then it waits until an ad is asked for or `wake()` is called. Before
 * `init()` (the consent is not done yet) and without a unit id nothing is available. Nothing here
 * throws: a blocked ad domain or a failing plugin means `unavailable`.
 */
export class NativeAds implements AdsService {
  private inited = false;
  private removed = false;
  private readonly rewarded: Slot;
  private readonly interstitial: Slot;
  /** Settles the show in progress when its ad closes (or fails); null when no ad shows. */
  private settleRewarded: ((result: RewardedResult) => void) | null = null;
  private settleInterstitial: ((shown: boolean) => void) | null = null;
  private earned = false;
  /** The SDK did not start or its events are not heard: no loads, every show is unavailable. */
  private broken = false;
  /** Numbers the shows, so a safety timer only settles the show it was set for. */
  private showSeq = 0;

  constructor(
    private readonly plugin: AdsPlugin,
    units: AdUnits,
    private readonly isOnline: () => boolean = () =>
      typeof navigator === 'undefined' || navigator.onLine !== false,
    private readonly schedule: Schedule = (run, delayMs) => setTimeout(run, delayMs),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.rewarded = newSlot(units.rewarded);
    this.interstitial = newSlot(units.interstitial);
  }

  async init(): Promise<void> {
    if (this.inited) return;
    this.inited = true;
    try {
      await this.plugin.initialize();
      await this.listen();
    } catch {
      // A failing SDK (or events nobody hears) leaves the ads unavailable; the game goes on.
      this.broken = true;
    }
    this.load('rewarded');
    this.load('interstitial');
  }

  isRewardedReady(): boolean {
    return this.inited && this.rewarded.ready && this.settleRewarded === null;
  }

  isShowing(): boolean {
    return this.settleRewarded !== null || this.settleInterstitial !== null;
  }

  rewardedUnavailableReason(): RewardedUnavailableReason | null {
    if (this.isRewardedReady() || this.settleRewarded !== null) return null;
    if (!this.isOnline()) return 'offline';
    const slot = this.rewarded;
    const fresh = this.now() - slot.loadStartedAt < AD_LOAD.loadingCaptionMaxMs;
    return slot.loading && fresh ? 'loading' : 'no_fill';
  }

  wake(networkBack = false): void {
    this.wakeSlot(this.rewarded, 'rewarded', networkBack);
    if (!this.removed) this.wakeSlot(this.interstitial, 'interstitial', networkBack);
  }

  async showRewarded(): Promise<RewardedResult> {
    if (!this.isRewardedReady()) {
      this.kick(this.rewarded, 'rewarded');
      return 'unavailable';
    }
    this.rewarded.ready = false;
    this.earned = false;
    const closed = new Promise<RewardedResult>((resolve) => {
      this.settleRewarded = resolve;
    });
    const seq = ++this.showSeq;
    Promise.resolve()
      .then(() => this.plugin.showRewarded())
      .then(() =>
        this.schedule(() => {
          if (seq === this.showSeq) this.finishRewarded('dismissed');
        }, AD_LOAD.showSafetyMs),
      )
      .catch(() => this.finishRewarded('unavailable'));
    const result = await closed;
    this.load('rewarded');
    return result;
  }

  async showInterstitial(): Promise<boolean> {
    if (this.removed || !this.inited || !this.interstitial.ready || this.settleInterstitial) {
      if (!this.removed) this.kick(this.interstitial, 'interstitial');
      return false;
    }
    this.interstitial.ready = false;
    const closed = new Promise<boolean>((resolve) => {
      this.settleInterstitial = resolve;
    });
    const seq = ++this.showSeq;
    Promise.resolve()
      .then(() => this.plugin.showInterstitial())
      .then(() =>
        this.schedule(() => {
          if (seq === this.showSeq) this.finishInterstitial(true);
        }, AD_LOAD.showSafetyMs),
      )
      .catch(() => this.finishInterstitial(false));
    const shown = await closed;
    this.load('interstitial');
    return shown;
  }

  setRemoveAds(removed: boolean): void {
    this.removed = removed;
  }

  /** The SDK events; the show promises settle on them (the plugin's own promises only say the show began). */
  private async listen(): Promise<void> {
    await Promise.all([
      this.plugin.on('rewarded', () => {
        this.earned = true;
      }),
      this.plugin.on('rewardedDismissed', () => this.finishRewarded('dismissed')),
      this.plugin.on('rewardedFailedToShow', () => this.finishRewarded('unavailable')),
      this.plugin.on('interstitialDismissed', () => this.finishInterstitial(true)),
      this.plugin.on('interstitialFailedToShow', () => this.finishInterstitial(false)),
    ]);
  }

  /** An earned reward counts even when the ad then fails or is closed in a rough way. */
  private finishRewarded(result: RewardedResult): void {
    const settle = this.settleRewarded;
    this.settleRewarded = null;
    settle?.(this.earned ? 'rewarded' : result);
  }

  private finishInterstitial(shown: boolean): void {
    const settle = this.settleInterstitial;
    this.settleInterstitial = null;
    settle?.(shown);
  }

  /**
   * Starts a load for an ad that is not there and not coming: the failure count starts over and a
   * waiting retry is dropped (its timer then does nothing), so loads never pile up.
   */
  /**
   * An ad was asked for and none is there: a load that is not under way or waiting for a retry
   * starts now, its failure count over.
   */
  private kick(slot: Slot, kind: 'rewarded' | 'interstitial'): void {
    if (!this.inited || slot.ready || slot.loading || slot.retry !== null) return;
    slot.failures = 0;
    this.load(kind);
  }

  /** See `wake`: a load that gave up starts over, not sooner than `AD_LOAD.wakeGapMs` after it failed. */
  private wakeSlot(slot: Slot, kind: 'rewarded' | 'interstitial', networkBack: boolean): void {
    if (!this.inited || slot.ready || slot.loading) return;
    if (!networkBack) {
      if (slot.retry !== null) return;
      if (slot.failures > 0 && this.now() - slot.failedAt < AD_LOAD.wakeGapMs) return;
    }
    slot.failures = 0;
    // A waiting retry is taken over: its timer finds another handle and does nothing.
    slot.retry = null;
    this.load(kind);
  }

  private load(kind: 'rewarded' | 'interstitial'): void {
    const slot = kind === 'rewarded' ? this.rewarded : this.interstitial;
    if (!this.inited || this.broken || slot.unit === undefined || slot.loading || slot.ready)
      return;
    slot.loading = true;
    slot.loadStartedAt = this.now();
    const unit = slot.unit;
    // `Promise.resolve().then` also catches a plugin that throws at once.
    Promise.resolve()
      .then(() =>
        kind === 'rewarded'
          ? this.plugin.prepareRewarded(unit)
          : this.plugin.prepareInterstitial(unit),
      )
      .then(
        () => {
          slot.loading = false;
          slot.ready = true;
          slot.failures = 0;
        },
        () => {
          slot.loading = false;
          slot.failedAt = this.now();
          const delay = AD_LOAD.retryDelaysMs[slot.failures];
          slot.failures += 1;
          if (delay === undefined) return;
          const handle: unknown = this.schedule(() => {
            // A kick in between took this retry over.
            if (slot.retry !== handle) return;
            slot.retry = null;
            this.load(kind);
          }, delay);
          slot.retry = handle;
        },
      );
  }
}
