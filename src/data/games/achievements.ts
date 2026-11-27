/**
 * Game Center achievements (docs/04-meta-retention.md, section 13). The ids are permanent: the
 * same strings are set up in App Store Connect and may never change. A counter achievement goes
 * in tiers (I, II, III), each tier its own achievement with a progress bar to its `target`; the
 * singles are steps the game itself has (heights of the zones, Space lap 3). Points add up to
 * no more than `ACHIEVEMENT_POINTS_MAX` and each stays within `ACHIEVEMENT_POINT_CAP` (limits of
 * Game Center). Achievements give nothing inside the game.
 */

/** What an achievement counts, read from the save by `achievementPercents`. */
export type AchievementCounter =
  | 'flies'
  | 'perfects'
  | 'runs'
  | 'layers'
  | 'combo'
  | 'streak'
  | 'creatures'
  | 'masters'
  | 'daily'
  | 'height'
  | 'lap';

export interface AchievementDef {
  /** Permanent id, the same in App Store Connect. */
  readonly id: string;
  readonly counter: AchievementCounter;
  /** The counter value that completes it. */
  readonly target: number;
  /** Game Center points. */
  readonly points: number;
}

/** Points of a tier: the higher tier is worth more. */
const TIER_POINTS = { three: [10, 25, 50], two: [15, 50] } as const;

/** One achievement per tier: `<row>_1`, `<row>_2`… */
function tiers(
  row: string,
  counter: AchievementCounter,
  targets: readonly number[],
  points: readonly number[],
): AchievementDef[] {
  return targets.map((target, i) => ({
    id: `${row}_${i + 1}`,
    counter,
    target,
    points: points[i] ?? 0,
  }));
}

/**
 * How many creatures there are in 1.1. "The Crew" II and "Masters" II stay at this number when
 * new creatures come later, so an achievement already earned keeps its meaning.
 */
export const CREW_ALL_1_1 = 12;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Thresholds of the flies are the owner's; the rest are the plan of 1.1 (checked against the sim, docs/04, section 13).
  ...tiers('flies', 'flies', [50, 500, 1000], TIER_POINTS.three),
  ...tiers('perfects', 'perfects', [100, 1000, 5000], TIER_POINTS.three),
  ...tiers('runs', 'runs', [10, 100, 500], TIER_POINTS.three),
  ...tiers('layers', 'layers', [500, 5000, 25000], TIER_POINTS.three),
  ...tiers('combo', 'combo', [10, 20, 30], TIER_POINTS.three),
  ...tiers('streak', 'streak', [7, 30], TIER_POINTS.two),
  ...tiers('creatures', 'creatures', [6, CREW_ALL_1_1], TIER_POINTS.two),
  ...tiers('masters', 'masters', [1, CREW_ALL_1_1], TIER_POINTS.two),
  ...tiers('daily', 'daily', [50, 100], TIER_POINTS.two),
  { id: 'height_20', counter: 'height', target: 20, points: 5 },
  { id: 'height_40', counter: 'height', target: 40, points: 10 },
  { id: 'height_60', counter: 'height', target: 60, points: 15 },
  { id: 'height_80', counter: 'height', target: 80, points: 25 },
  { id: 'height_100', counter: 'height', target: 100, points: 50 },
  { id: 'lap_3', counter: 'lap', target: 3, points: 75 },
];

/** Limits of Game Center for one game. */
export const ACHIEVEMENTS_MAX = 100;
export const ACHIEVEMENT_POINT_CAP = 100;
export const ACHIEVEMENT_POINTS_MAX = 1000;
