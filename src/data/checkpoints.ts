/**
 * Checkpoint starts of the classic run (docs/02-gameplay.md, section 10, "Старт с контрольной
 * точки"). Prices and the daily ad limit are in `BALANCE.checkpoints` (data/balance.ts).
 */

/** Heights a classic run may start from; each one is the top of a zone (the next layer opens zone 2…6). */
export const CHECKPOINT_HEIGHTS = [20, 40, 60, 80, 100] as const;

export type CheckpointHeight = (typeof CHECKPOINT_HEIGHTS)[number];

/**
 * Width of the first flying layer of a run that starts from a checkpoint: the median width of the
 * layer at that height over the EXPERT bot runs from zero that reach it, no team, continues
 * declined (`npm run sim`: the width table at the end of its checkpoint section prints the measured
 * values next to these; 2000, 1999, 1927, 1167 and 376 runs reach 20…100 with the arc speed curve of
 * 2026-11-16, which moved the widths of 60, 80 and 100; 20 and 40 stay, the curve starts above 40
 * and their medians moved by 1-2 px only through the shifted bot noise). Owner's decision
 * 2026-11-15: the regular profile rarely reaches the high checkpoints and only with narrow layers,
 * so its medians are biased (146 at 40, narrower than at 60). The pre-built tower below narrows
 * evenly from the first width down to this one.
 */
export const CHECKPOINT_START_WIDTH: Readonly<Record<CheckpointHeight, number>> = {
  20: 691,
  40: 591,
  60: 467,
  80: 273,
  100: 212,
};
