import { STUB_ADS } from '../../data/rewarded-video';
import { t } from '../../i18n';
import type {
  RewardedUnavailableReason,
  AdsDevControl,
  AdsService,
  RewardedResult,
  StubAdMode,
} from './types';

const MODES: readonly StubAdMode[] = ['reward', 'dismissed', 'offline', 'no_fill'];

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
 * In dev the debug panel switches its answer (`cycleMode`) to try every branch of the flow.
 */
export class WebAds implements AdsService, AdsDevControl {
  private current: StubAdMode = 'reward';
  private busy = false;
  private removed = false;

  /** `showOverlay` returns the function that removes the overlay it drew. */
  constructor(
    private readonly showOverlay: (label: string) => (() => void) | null = showStubOverlay,
  ) {}

  get mode(): StubAdMode {
    return this.current;
  }

  cycleMode(): StubAdMode {
    const next = MODES[(MODES.indexOf(this.current) + 1) % MODES.length];
    this.current = next ?? 'reward';
    return this.current;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  isRewardedReady(): boolean {
    return this.current !== 'offline' && this.current !== 'no_fill' && !this.busy;
  }

  rewardedUnavailableReason(): RewardedUnavailableReason | null {
    if (this.isRewardedReady()) return null;
    return this.current === 'offline' ? 'offline' : 'no_fill';
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
