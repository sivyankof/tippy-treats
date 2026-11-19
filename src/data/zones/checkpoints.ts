/**
 * Checkpoint starts of the classic run (docs/02-gameplay.md, section 10, "Старт с контрольной
 * точки"). Prices and the daily ad limit are in `BALANCE.checkpoints` (data/tower/balance.ts).
 */

/** Heights a classic run may start from; each one is the top of a zone (the next layer opens zone 2…6). */
export const CHECKPOINT_HEIGHTS = [20, 40, 60, 80, 100] as const;

export type CheckpointHeight = (typeof CHECKPOINT_HEIGHTS)[number];

/**
 * Width of the first flying layer of a run that starts from a checkpoint: the median width of the
 * layer at that height over the EXPERT bot runs from zero that reach it, no team, continues
 * declined (`npm run sim`: the width table at the end of its checkpoint section prints the measured
 * values next to these). Measured 2026-11-19 on the speed curve of that day (start 540, power 1.9):
 * 2000, 1999, 1992, 1858 and 1312 runs reach 20...100. Owner's decision 2026-11-15: the regular
 * profile rarely reaches the high checkpoints and only with narrow layers, so its medians are
 * biased. The pre-built tower below narrows evenly from the first width down to this one. The
 * speed of the first layer always comes from the curve at the start height.
 */
export const CHECKPOINT_START_WIDTH: Readonly<Record<CheckpointHeight, number>> = {
  20: 712,
  40: 660,
  60: 597,
  80: 430,
  100: 327,
};
