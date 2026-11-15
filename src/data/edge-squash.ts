/** How a material gives when the flying layer runs into the screen edge. */
export type WallFeelKind = 'normal' | 'soft' | 'hard';

/** Faces a layer can pull at the touch (a subset of the face reactions). */
export type WallFace = 'squint' | 'gape' | 'scrunch' | 'ouch';

/**
 * The give of one kind of material at the screen edge (docs/06, section 4, "Удар о край
 * экрана"). The squash is a function of the layer position only: the same place gives the same
 * shape at any frame rate.
 */
export interface WallFeel {
  /**
   * Share of the overflow the squash takes up (a hard material hardly gives): the rest is
   * drawn slid back inwards (`slide`), so the edge still stops at the wall.
   */
  give: number;
  /**
   * Share of the overflow the squash leaves over that is drawn slid back inwards, so the edge
   * still stops at the wall (1: all of it). The true position does not change.
   */
  slide: number;
  /** Length of the squashed part as a share of the layer width (longer when the squash is deep). */
  zoneShare: number;
  /** The narrowest a column of the picture gets, right at the wall (horizontal scale). */
  minScale: number;
  /** A column gets taller by `bulge` times what it lost in width (the volume is kept), up to `maxTall`. */
  bulge: number;
  maxTall: number;
  /** The light bounce off the wall at the turn: how much deeper it squashes, share of the depth. */
  bounce: number;
  /** A short dent at the moment of the touch (px, 0: none) and how long it lasts. */
  knockPx: number;
  knockMs: number;
  /** The face at the touch and how long it holds it. */
  face: WallFace;
  faceMs: number;
}

export const EDGE_SQUASH = {
  /** Gap kept between the layer and the screen edge (on top of the safe area), logical px. */
  marginPx: 12,
  /**
   * The squash starts this far before the edge touches and eases in over twice this distance,
   * so the edge slows down smoothly instead of stopping dead.
   */
  kneePx: 20,
  /** Columns of the deformable picture: more columns, a smoother top edge. */
  columns: 33,
  /** The face moves this share of the way to the centre of the visible part. */
  faceShare: 1,
  /** The face reacts only to a squash at least this deep, px. */
  reactFromPx: 24,
  /** The bounce at the turn: length of one hop and the time it takes to die down by e. */
  bounce: { periodMs: 200, decayMs: 180 },
  feel: {
    normal: {
      give: 1,
      slide: 1,
      zoneShare: 0.5,
      minScale: 0.22,
      bulge: 0.32,
      maxTall: 1.22,
      bounce: 0.12,
      knockPx: 0,
      knockMs: 0,
      face: 'squint',
      faceMs: 360,
    },
    soft: {
      give: 1,
      slide: 1,
      zoneShare: 0.95,
      minScale: 0.18,
      bulge: 0.55,
      maxTall: 1.38,
      bounce: 0.2,
      knockPx: 0,
      knockMs: 0,
      face: 'squint',
      faceMs: 420,
    },
    hard: {
      give: 0.35,
      slide: 1,
      zoneShare: 0.22,
      minScale: 0.55,
      bulge: 0.1,
      maxTall: 1.06,
      bounce: 0.08,
      knockPx: 12,
      knockMs: 130,
      face: 'gape',
      faceMs: 320,
    },
  } satisfies Record<WallFeelKind, WallFeel>,
} as const;
