/**
 * Game Center leaderboards (docs/04-meta-retention.md, section 13). The ids are permanent: the
 * same strings are set up in App Store Connect. `classic_height` is a plain best-score board;
 * `daily_height` recurs every day from 00:00 UTC (the day of the daily tower is a UTC day).
 */
export const BOARD_IDS = ['classic_height', 'daily_height'] as const;

export type BoardId = (typeof BOARD_IDS)[number];

/**
 * Highest value a board takes: a score above it is not sent (a changed save). Well above what an
 * honest player reaches: see `basis`.
 */
export const BOARD_MAX: Record<BoardId, { max: number; basis: string }> = {
  classic_height: {
    max: 2500,
    basis: 'strong bot with a level-3 crew, 3000 runs: best 890 (p99 531); about 2.8 times that',
  },
  daily_height: {
    max: 1500,
    basis: 'strong bot, best of 3 attempts over 1000 days: best 673 (p99 407); about 2.2 times that',
  },
};
