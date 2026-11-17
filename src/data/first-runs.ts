/**
 * The first runs of a player are for playing, not for selling (docs/05-economy-monetization.md,
 * section 5, "Первые забеги без продаж"). Runs are the finished runs of the save (`stats.runs`).
 */
export const FIRST_RUNS = {
  /** The first runs have no "Continue?" window after a miss and no "×2 coins" on their results. */
  clean: 3,
  /** Until this many runs are finished there is no starter pack on Home and no interstitial. */
  quiet: 10,
} as const;
