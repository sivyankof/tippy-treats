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
  /**
   * Extra squeeze at the very wall: the push is `(1 - edgeBias) t^2 + edgeBias t^4` over the
   * zone, so the column at the wall gets narrower by `1 + edgeBias` times while the rest of
   * the layer stays put and the edge still stops at the wall.
   */
  edgeBias: number;
  /** How much the glaze gathers into a bulge at the wall, px of rise per share of lost width. */
  glazeLiftPx: number;
  /** Share of that bulge that sags back towards the wall itself (0..1). */
  glazeSag: number;
  /** Share of the accordion folds shown on the sponge, 0..1 (0 for a hard material: none). */
  folds: number;
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
  /** The gathered glaze springs back after the turn: share of the bulge, length of a swing, decay. */
  glazeSpring: { amp: 0.6, periodMs: 240, decayMs: 160 },
  /**
   * Accordion folds on the squeezed sponge: a few short vertical wrinkles hugging the wall,
   * shorter and fainter towards the middle. `at` is the distance from the wall as a share of the
   * layer width (all within the outer `0.12`, so they never reach the face); `from`/`to` span a
   * share of the sponge height (from the glaze down to the bottom edge).
   */
  folds: {
    /** Folds show from this squeeze depth (px) and are full at `fullDepthPx`. */
    fromDepthPx: 14,
    fullDepthPx: 50,
    items: [
      { at: 0.018, from: 0.25, to: 0.85, alpha: 1 },
      { at: 0.055, from: 0.35, to: 0.8, alpha: 0.65 },
      { at: 0.095, from: 0.45, to: 0.72, alpha: 0.35 },
    ],
    /** The fold bows this far sideways in the middle (px), away from the wall. */
    bowPx: 2.5,
    widthPx: 4.5,
    colour: 0x000000,
    alpha: 0.38,
    /** A light edge beside the dark crease, towards the wall. */
    lightWidthPx: 2.2,
    lightOffsetPx: 2.5,
    lightColour: 0xffffff,
    lightAlpha: 0.28,
  },
  feel: {
    normal: {
      give: 1,
      slide: 1,
      zoneShare: 0.5,
      minScale: 0.17,
      bulge: 0.4,
      maxTall: 1.28,
      bounce: 0.12,
      edgeBias: 0.25,
      glazeLiftPx: 18,
      glazeSag: 0.5,
      folds: 1,
      knockPx: 0,
      knockMs: 0,
      face: 'squint',
      faceMs: 360,
    },
    soft: {
      give: 1,
      slide: 1,
      zoneShare: 0.95,
      minScale: 0.14,
      bulge: 0.62,
      maxTall: 1.44,
      bounce: 0.2,
      edgeBias: 0.25,
      glazeLiftPx: 26,
      glazeSag: 0.55,
      folds: 1,
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
      edgeBias: 0.1,
      glazeLiftPx: 3,
      glazeSag: 0.2,
      folds: 0,
      knockPx: 12,
      knockMs: 130,
      face: 'gape',
      faceMs: 320,
    },
  } satisfies Record<WallFeelKind, WallFeel>,
} as const;
