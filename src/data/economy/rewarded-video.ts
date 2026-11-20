/** Timings and look of the browser ad stub. */
export const STUB_ADS = {
  /** The fake ad runs this long before it pays out. */
  durationMs: 2000,
  /** In the `dismissed` mode the player "closes" the ad after this long. */
  dismissAfterMs: 700,
  overlayColor: '#8a8a8a',
  textColor: '#ffffff',
  fontFamily: 'sans-serif',
  fontSizePx: 40,
  paddingPx: 24,
  zIndex: 10000,
} as const;

/** The real ad SDK: how a failed load is retried (never a tight loop). */
export const AD_LOAD = {
  /** Waits before the 1st, 2nd, ... retry of a failed load; after the last one the ad stays unloaded until it is asked for. */
  retryDelaysMs: [5000, 15000, 45000, 120000],
  /** A consent request that has not answered in this long counts as failed, so Home never waits for the network. */
  consentTimeoutMs: 8000,
} as const;

/**
 * Google's public sample ad units: the dev server and the internal build always use them (a real
 * unit must never be tapped by the developer, that gets the AdMob account blocked). They are
 * published by Google and are not secrets.
 */
export const SAMPLE_AD_UNITS = {
  ios: {
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
  android: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
} as const;

/** Rewarded ad offers and their limits (docs/05-economy-monetization.md, section 6). */
export const REWARDED_OFFERS = {
  /** "×2 coins" on the results screen needs at least this many coins earned in the run. */
  doubleCoinsMin: 10,
  /** "×2 coins" may be watched this many times per local day. */
  doubleCoinsPerDay: 5,
} as const;
