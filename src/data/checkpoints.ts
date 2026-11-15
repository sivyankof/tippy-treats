/**
 * Checkpoint starts of the classic run (docs/02-gameplay.md, section 10, "Старт с контрольной
 * точки"). Prices and the daily ad limit are in `BALANCE.checkpoints` (data/balance.ts).
 */

/** Heights a classic run may start from; each one is the top of a zone (the next layer opens zone 2…6). */
export const CHECKPOINT_HEIGHTS = [20, 40, 60, 80, 100] as const;

export type CheckpointHeight = (typeof CHECKPOINT_HEIGHTS)[number];

/**
 * Width of the first flying layer of a run that starts from a checkpoint: the median width of the
 * layer at that height over the bot runs from zero, no team, continues declined
 * (`npm run sim`: the width table at the end of its checkpoint section prints the measured values
 * next to these). Profile: regular for 20 and 40 (2000 runs, 1980 and 468 reach the height); the regular
 * profile almost never gets higher (5 runs reach 60, none reach 80 or 100), so 60, 80 and 100 come
 * from the expert profile (1908, 961 and 139 runs). The pre-built tower below narrows evenly from
 * the first width down to this one.
 */
export const CHECKPOINT_START_WIDTH: Readonly<Record<CheckpointHeight, number>> = {
  20: 429,
  40: 146,
  60: 459,
  80: 240,
  100: 183,
};
