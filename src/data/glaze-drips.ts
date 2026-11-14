import type { CreatureId } from './creatures';

/**
 * Glaze drips that keep growing after a layer has landed (docs/06, section 3, "Растущие подтёки").
 * The picture of the layer has short drips baked in; these numbers drive the extra length that is
 * drawn over them, the drops that fall off and the spots they leave on the layer below.
 * Distances are logical pixels, times milliseconds.
 */
export const GLAZE_DRIPS = {
  /** A plain layer grows one drip per this much of its width, within `count`. */
  widthPerDrip: 150,
  count: [3, 5] as readonly [number, number],
  /** A tongue that carries two drips holds them at these shares of its width. */
  pairShares: [0.32, 0.68] as readonly [number, number],
  /** A drip takes a time in this range to reach its full length; each drip has its own. */
  growMs: [8000, 12000] as readonly [number, number],
  /** Nothing grows for this long after the layer lands (the squash settles first). */
  startDelayMs: 250,
  /** Every growing drip reaches at least this far below its tongue. */
  minLengthPx: 16,
  /** The longest drip of a layer runs this far past the lower edge of its layer, onto the layer below. */
  overlapPx: 30,
  /** The other drips reach a share of the longest one in this range (each its own, no randomness). */
  lengthShare: [0.3, 0.85] as readonly [number, number],
  /** Over the face of the layer below (or past its side) a drip stops this far above its own lower edge. */
  edgeStopPx: 6,
  /** Half width of a face at scale 1: eyes, cheeks and the sweat drop. */
  faceHalfWidth: 62,
  /** A drip keeps this far from a face (beyond its own half width). */
  faceMarginPx: 12,

  /** The look of a growing drip: a stem, a round drop at its end, a darker outline and a highlight. */
  look: {
    stem: 20,
    bulb: 30,
    outline: 3.5,
    /** The highlight stripe: centre offset from the middle of the drip and width, as shares of the stem. */
    stripeAt: -0.24,
    stripeWidth: 0.2,
    /** The stripe is the glaze lightened by this much. */
    stripeLift: 0.45,
    /** White highlight on the round end: offset from its centre and size, as shares of its diameter. */
    shineX: -0.2,
    shineY: -0.14,
    shineW: 0.22,
    shineH: 0.3,
    shineAlpha: 0.8,
  },
  /** The thin drip of the lick (it runs between the eyes), at face scale 1. */
  lickLook: { stem: 9, bulb: 16, outline: 2.5 },

  /** Drops that fall from grown drips onto the layer below. */
  drop: {
    /** A drop falls at most once in this time for the whole tower. */
    minIntervalMs: 1400,
    /** After that pause a drop falls on average once per this time. */
    meanWaitMs: 1200,
    /** A drip drops once it has grown this share of its length. */
    readyShare: 0.6,
    /** Downward acceleration of a falling drop, pixels per second squared. */
    gravity: 2600,
    /** The round end of the drip shrinks to this scale when the drop leaves and swells back in `regrowMs`. */
    bulbShrink: 0.5,
    regrowMs: 900,
    /** The drop lands this far below the centre of the layer below (a range: each drop its own). */
    landY: [14, 40] as readonly [number, number],
    /** Size of the spot it leaves. */
    spotWidth: 30,
    spotHeight: 15,
    /** The spot squashes in, stays, then melts away: flattens, slides down a little and fades. */
    spotSplatMs: 160,
    spotHoldMs: [2500, 4000] as readonly [number, number],
    spotMeltMs: 1400,
    spotMeltSlidePx: 6,
    /** At most this many spots on one layer; a new one replaces the oldest. */
    spotsPerLayer: 3,
  },

  /**
   * How a creature's drips differ from a plain layer's: length, growth time and thickness
   * multipliers, and `dropWeight`, how often its drips let a drop go compared with the others.
   */
  honey: { lengthMul: 1.6, durationMul: 0.75, widthMul: 1.3, dropWeight: 1 },
  /**
   * Caramel is slow, thick and stretchy. Its drops are rare, and before one breaks off it hangs
   * on a thread: it sinks `threadPx` in `threadMs` tied to the drip by a thread `threadWidth` wide.
   */
  caramel: {
    lengthMul: 1,
    durationMul: 2,
    widthMul: 1.4,
    dropWeight: 0.3,
    threadMs: 420,
    threadPx: 56,
    threadWidth: 6,
  },
  /**
   * Frosty thaws: no drips, but now and then a small light drop of meltwater leaves the bottom
   * edge (no stem), not before `startMs` after landing; its spot melts faster (`spotHoldMul`).
   * Meltwater keeps its own time for the whole tower: at most once per `minIntervalMs`, on average
   * `meanWaitMs` after that.
   */
  frosty: {
    minIntervalMs: 2500,
    meanWaitMs: 2500,
    startMs: 2000,
    color: 0xdff4ff,
    sizeMul: 0.6,
    spotHoldMul: 0.35,
  },
  /** Dry creatures: no drips and no drops. */
  dryCreatures: ['crumb', 'brownie'] as readonly CreatureId[],
} as const;
