import type { CreatureId } from './creatures';

/**
 * Glaze drips that keep growing after a layer has landed (docs/06, section 3, "Растущие подтёки").
 * The picture of the layer has short drips baked in; these numbers drive the extra length that is
 * drawn over them.
 */
export const GLAZE_DRIPS = {
  /** A drip takes a time in this range (ms) to reach its full length; each drip has its own. */
  growMs: [10000, 15000],
  /** Nothing grows for this long after the layer lands (the squash settles first). */
  startDelayMs: 700,
  /** Longest extra length of a drip, as a share of the layer height. */
  maxLengthShare: 0.25,
  /** A drip may run this far past the lower edge of its layer, onto the layer below. */
  overlapPx: 10,
  /** Half width of a face at scale 1: eyes, cheeks and the sweat drop. */
  faceHalfWidth: 62,
  /** A drip must stay this far from the face of the layer below (beyond its own half width). */
  faceMarginPx: 12,
  /** A drop falls from a grown drip at most once in this time for the whole tower (ms). */
  dropMinIntervalMs: 4500,
  /** After that pause a drop falls on average once per this time (ms). */
  dropMeanWaitMs: 2500,
  /** Honey drips longer and faster than the others. */
  honey: { lengthMul: 1.6, durationMul: 0.75 },
  /** Hard materials do not run: their glaze has set. */
  hardCreatures: ['caramel', 'frosty', 'crumb', 'brownie'] as readonly CreatureId[],
} as const;
