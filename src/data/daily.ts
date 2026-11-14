/** One reward step of the daily tower: paid once per day when the best height reaches `height`. */
export interface DailyTier {
  height: number;
  reward: { coins?: number; berries?: number };
}

/** Daily tower numbers (docs/02-gameplay.md section 10, docs/04-meta-retention.md section 4). */
export const DAILY = {
  /** Free attempts per UTC day. */
  attempts: 3,
  /** Extra attempts a rewarded video can add per UTC day. */
  extraAttempts: 1,
  /** Level of every creature of the team of the day. */
  teamLevel: 3,
  /** Creatures in the team of the day. */
  teamSize: 3,
  /** Name of the Rng stream the team of the day is drawn from. */
  teamStream: 'daily_team',
  /** Reward steps, ascending by height. */
  tiers: [
    { height: 15, reward: { coins: 30 } },
    { height: 30, reward: { coins: 60 } },
    { height: 50, reward: { berries: 5 } },
    { height: 75, reward: { coins: 150, berries: 5 } },
    { height: 100, reward: { berries: 15 } },
  ] as readonly DailyTier[],
} as const;
