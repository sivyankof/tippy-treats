/**
 * When the game asks the system for a rating (docs/04-meta-retention.md, section 10). The owner's
 * rules: late, rare and only after something good.
 */
export const REVIEW = {
  /** Days on which the game was played before the first request (the 3rd day). */
  minPlayDays: 3,
  /** Finished runs (`stats.runs`) before the first request. */
  minRuns: 10,
  /** Pause between two requests, whatever the game version. */
  minGapDays: 30,
  /** The request waits this long after the results' own animations (record, XP bar, level-up windows) are over. */
  afterAnimationsMs: 1200,
} as const;
