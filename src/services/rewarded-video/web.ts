import { STUB_ADS } from '../../data/economy/rewarded-video';
import { t } from '../../i18n';
import type {
  RewardedUnavailableReason,
  AdsDevControl,
  AdsService,
  RewardedResult,
  StubAdMode,
} from './types';

const MODES: readonly StubAdMode[] = ['reward', 'dismissed', 'offline', 'no_fill', 'loading'];

/** A grey full-screen DOM overlay with a label; `null` where there is no DOM (tests). */
export function showStubOverlay(label: string): (() => void) | null {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.textContent = label;
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: String(STUB_ADS.zIndex),
    background: STUB_ADS.overlayColor,
    color: STUB_ADS.textColor,
    font: `${STUB_ADS.fontSizePx}px ${STUB_ADS.fontFamily}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: `${STUB_ADS.paddingPx}px`,
    boxSizing: 'border-box',
  });
  document.body.appendChild(el);
  return () => el.remove();
}

/**
 * Browser stand-in for the ad SDK: a fake rewarded ad that pays out after a couple of seconds and
 * a fake interstitial of the same length.
 * In dev the debug panel switches its answer (`cycleMode`) to try every branch of the flow. The
 * `loading` mode "loads" the next ad for `STUB_ADS.loadingMs` (on entering the mode and after each
 * show) and then pays out like `reward`.
 */
export class WebAds implements AdsService, AdsDevControl {
  private current: StubAdMode = 'reward';
  private busy = false;
  private removed = false;
  /** In the `loading` mode: the moment (`Date.now()`) the ad being "loaded" is ready. */
  private loadedAt = 0;

  /**
   * `showOverlay` returns the function that removes the overlay it drew; `mode` is the answer the
   * stub starts with (the store build starts at `no_fill`: no test ads for players).
   */
  constructor(
    private readonly showOverlay: (label: string) => (() => void) | null = showStubOverlay,
    mode: StubAdMode = 'reward',
  ) {
    this.current = mode;
    this.startLoading();
  }

  get mode(): StubAdMode {
    return this.current;
  }

  cycleMode(): StubAdMode {
    const next = MODES[(MODES.indexOf(this.current) + 1) % MODES.length];
    this.current = next ?? 'reward';
    this.startLoading();
    return this.current;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  isRewardedReady(): boolean {
    return this.reason() === null && !this.busy;
  }

  rewardedUnavailableReason(): RewardedUnavailableReason | null {
    // Ready, or only busy showing another ad: no reason to give.
    return this.busy ? null : this.reason();
  }

  private reason(): RewardedUnavailableReason | null {
    if (this.current === 'offline' || this.current === 'no_fill') return this.current;
    if (this.current === 'loading' && Date.now() < this.loadedAt) return 'loading';
    return null;
  }

  /** In the `loading` mode the next ad starts "loading" now. */
  private startLoading(): void {
    if (this.current === 'loading') this.loadedAt = Date.now() + STUB_ADS.loadingMs;
  }

  showRewarded(): Promise<RewardedResult> {
    if (!this.isRewardedReady()) return Promise.resolve('unavailable');
    this.busy = true;
    const hide = this.showOverlay(t('ads.stub'));
    const dismissed = this.current === 'dismissed';
    const delay = dismissed ? STUB_ADS.dismissAfterMs : STUB_ADS.durationMs;
    return new Promise((resolve) => {
      setTimeout(() => {
        hide?.();
        this.busy = false;
        this.startLoading();
        resolve(dismissed ? 'dismissed' : 'rewarded');
      }, delay);
    });
  }

  showInterstitial(): Promise<boolean> {
    if (this.removed || !this.isRewardedReady()) return Promise.resolve(false);
    this.busy = true;
    const hide = this.showOverlay(t('ads.stubInterstitial'));
    return new Promise((resolve) => {
      setTimeout(() => {
        hide?.();
        this.busy = false;
        resolve(true);
      }, STUB_ADS.durationMs);
    });
  }

  setRemoveAds(removed: boolean): void {
    this.removed = removed;
  }
}
