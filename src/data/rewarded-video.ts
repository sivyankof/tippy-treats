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
  zIndex: 10000,
} as const;

/** Rewarded ad offers and their limits (docs/05-economy-monetization.md, section 6). */
export const REWARDED_OFFERS = {
  /** "×2 coins" on the results screen needs at least this many coins earned in the run. */
  doubleCoinsMin: 10,
} as const;
