/**
 * Checkpoint starts of the classic run (docs/02-gameplay.md, section 10, "Старт с контрольной
 * точки"). Prices and the daily ad limit are in `BALANCE.checkpoints` (data/balance.ts).
 */

/** Heights a classic run may start from; each one is the top of a zone (the next layer opens zone 2…6). */
export const CHECKPOINT_HEIGHTS = [20, 40, 60, 80, 100] as const;

export type CheckpointHeight = (typeof CHECKPOINT_HEIGHTS)[number];

/**
 * Width of the first flying layer of a run that starts from a checkpoint: the median width of the
 * layer at that height in `npm run sim` (regular profile, no team), so skipping the climb gives
 * no wider layer than climbing. The pre-built tower below narrows evenly from the first width
 * down to this one.
 */
export const CHECKPOINT_START_WIDTH: Readonly<Record<CheckpointHeight, number>> = {
  20: 500,
  40: 440,
  60: 400,
  80: 380,
  100: 360,
};
