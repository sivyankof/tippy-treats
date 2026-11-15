/** Rare white sparkles around the tower (docs/06, "Искорки у башни"). */
export const TOWER_SPARKLES = {
  /** Texture key and size of the one shared picture. */
  texture: 'fx_tower_sparkle',
  textureSize: 64,
  /** Most sparkles alive at once. */
  maxLive: 6,
  /** Pause before the next sparkle at rest, in ms (min, max). */
  restGapMs: [2600, 5600],
  /** After a perfect drop the pauses get this short for `boostMs`. */
  boostGapMs: [160, 420],
  boostMs: 2200,
  /** A perfect drop pops this many at once. */
  perfectBurst: 2,
  /** Life of one sparkle, in ms (min, max). */
  lifeMs: [750, 1100],
  /** Size of the star tip to tip, in px (min, max). */
  sizePx: [26, 54],
  /** The first share of life is the spring pop, the last share is the fade. */
  popShare: 0.3,
  fadeFrom: 0.55,
  /** The sparkle shrinks by this share while it fades. */
  fadeShrink: 0.35,
  /** Turn over the whole life, in degrees (min, max, sign random). */
  turnDeg: [14, 34],
  tilt: 8,
  /** Where one may stand: gap from the side of the top layer in px, and rows around the top. */
  gapPx: [26, 150],
  rowsAbove: 0.45,
  rowsBelow: 2.6,
  /** Keep out of the flying layer column (and its shadow) by this much on each side. */
  avoidPadPx: 70,
  /** Tries to find a free spot before the sparkle is skipped. */
  tries: 4,
  /** Keep this far from the screen edges. */
  edgePx: 30,
} as const;
