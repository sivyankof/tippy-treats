/** Difficulty groups; matches `MissionGroup` of the save schema. */
export type MissionGroup = 'easy' | 'medium' | 'hard';

export type MissionKind =
  | 'runs'
  | 'floating_coins'
  | 'perfects'
  | 'height'
  | 'combo'
  | 'score'
  | 'daily_play'
  | 'calm_run'
  | 'abilities_run'
  | 'abilities'
  | 'coins';

/** A template with a fixed target. */
export interface FixedMissionTemplate {
  id: string;
  group: MissionGroup;
  kind: Exclude<MissionKind, 'height'>;
  target: number;
}

/** A height template: target = clamp(round(record * scale), min, max). */
export interface HeightMissionTemplate {
  id: string;
  group: MissionGroup;
  kind: 'height';
  scale: 0.5 | 0.8;
  min: number;
  max: number;
}

export type MissionTemplate = FixedMissionTemplate | HeightMissionTemplate;

export const MISSIONS = {
  /** Groups in list order: one mission of each is dealt per day. */
  groups: ['easy', 'medium', 'hard'] as const,
  /** Coins paid for a claimed mission. */
  reward: { easy: 40, medium: 80, hard: 150 } as const,
  /** Berries for the chest of the day (all three claimed). */
  chestBerries: 5,
  /** A "calm" run never lets the wobble reach this value. */
  calmWobble: 50,
  /** A mission counts as "so close" from this share of progress. */
  closeShare: 0.7,
  /** Free rerolls per day. */
  rerollsPerDay: 1,
  /** Salt mixed into the seed when a mission is rerolled. */
  rerollSalt: 'reroll',
};

export const MISSION_POOL: readonly MissionTemplate[] = [
  // Easy
  { id: 'runs_3', group: 'easy', kind: 'runs', target: 3 },
  { id: 'runs_5', group: 'easy', kind: 'runs', target: 5 },
  { id: 'floating_coins_15', group: 'easy', kind: 'floating_coins', target: 15 },
  { id: 'perfects_10', group: 'easy', kind: 'perfects', target: 10 },
  { id: 'abilities_3', group: 'easy', kind: 'abilities', target: 3 },
  { id: 'coins_150', group: 'easy', kind: 'coins', target: 150 },
  // Medium
  { id: 'height_half', group: 'medium', kind: 'height', scale: 0.5, min: 10, max: 40 },
  { id: 'combo_5', group: 'medium', kind: 'combo', target: 5 },
  { id: 'score_3000', group: 'medium', kind: 'score', target: 3000 },
  { id: 'daily_play_1', group: 'medium', kind: 'daily_play', target: 1 },
  { id: 'perfects_25', group: 'medium', kind: 'perfects', target: 25 },
  { id: 'floating_coins_40', group: 'medium', kind: 'floating_coins', target: 40 },
  { id: 'abilities_run_3', group: 'medium', kind: 'abilities_run', target: 3 },
  { id: 'calm_run_15', group: 'medium', kind: 'calm_run', target: 15 },
  // Hard
  { id: 'height_high', group: 'hard', kind: 'height', scale: 0.8, min: 20, max: 70 },
  { id: 'combo_8', group: 'hard', kind: 'combo', target: 8 },
  { id: 'calm_run_30', group: 'hard', kind: 'calm_run', target: 30 },
  { id: 'abilities_run_6', group: 'hard', kind: 'abilities_run', target: 6 },
  { id: 'score_8000', group: 'hard', kind: 'score', target: 8000 },
  { id: 'coins_600', group: 'hard', kind: 'coins', target: 600 },
];
