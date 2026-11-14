import { STUB_ADS } from '../../data/ads';
import { t } from '../../i18n';
import type { AdsDevControl, AdsService, RewardedResult, StubAdMode } from './types';

const MODES: readonly StubAdMode[] = ['reward', 'dismissed', 'unavailable'];

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
  });
  document.body.appendChild(el);
  return () => el.remove();
}

/**
 * Browser stand-in for the ad SDK: a fake rewarded ad that pays out after a couple of seconds.
 * In dev the debug panel switches its answer (`cycleMode`) to try every branch of the flow.
 */
export class WebAds implements AdsService, AdsDevControl {
  private current: StubAdMode = 'reward';
  private busy = false;

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
    return this.current !== 'unavailable' && !this.busy;
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

  maybeShowInterstitial(): Promise<boolean> {
    return Promise.resolve(false);
  }

  setRemoveAds(): void {
    // The stub shows no interstitials, so there is nothing to switch off.
  }
}
