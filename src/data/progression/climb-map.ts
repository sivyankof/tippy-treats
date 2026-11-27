import { PALETTE } from '../common/palette';

/**
 * Numbers of the climb map (docs/07-ui-screens.md, section 2.3): the ribbon inside the window,
 * the tower column, the flags and the animations. Sizes are pixels of the 1080-wide canvas;
 * strip coordinates have x = 0 in the middle of the ribbon and y = 0 at the top of the strip.
 */
export const CLIMB_MAP = {
  /** Height of one band (20 layers). */
  bandHeight: 360,
  /** The thick rim round the ribbon: the strip is inset by `thick`, the rim hides the corners of the bands. */
  frame: {
    thick: 14,
    radius: 30,
    fill: 0x8a6bc9,
    outlineShade: -0.4,
    lightShade: 0.35,
    darkShade: -0.22,
  },
  /** The goal row under the ribbon, on a light card. */
  goal: { height: 120, gap: 24, font: 44 },
  /** Texts on the sign of a band: the fonts and the best lap label (the sign itself is `CLIMB_LANDSCAPE.sign`). */
  text: {
    /** Free room kept between the texts and the tower. */
    towerGap: 24,
    nameFont: 42,
    rangeFont: 34,
    lockedFont: 46,
    lockedColor: 0xe4dcf2,
    /** The label of the best lap: a star and a small text. */
    bestLap: { font: 34, star: 40, gap: 8 },
  },
  /** The tower column: a picture of 20 layers drawn at `texScale` times the size it shows. */
  tower: {
    x: 22,
    width: 164,
    texScale: 2,
    /** Every drawn layer stands for this many real ones: fewer, thicker layers read better than a barcode. */
    perLayer: 2,
    /** Layers of the column wobble in width by this many pixels (of the picture) so the tower is not a ruler. */
    wobble: 14,
    glazeShare: 0.44,
    /** The top cake has less glaze, so its face has room. */
    topGlazeShare: 0.3,
    /** The top cake is this many drawn layers tall, so its face reads at phone size. */
    topHeight: 1.8,
    /** The column stops this many real layers under the top of the cake, so no sliver of it shows above the cake. */
    topOverlap: 0.5,
    outline: 4.4,
    glazeOutline: 3,
    band: 0.14,
    shadowShade: -0.16,
    dripWidth: 20,
    dripLength: 17,
    poreSize: 3.6,
    /** The soft dark strip down the right side of every layer. */
    sideShadow: 0.14,
    /** The face of the top cake, shares of the layer height. */
    face: {
      eyeY: 0,
      eyeSpacing: 0.42,
      eyeRadius: 0.1,
      smileY: 0.2,
      smileRadius: 0.17,
      smileSpanDeg: 110,
      smileThick: 0.06,
    },
    /** Layer `i` takes the plain pair `i * pairStep` of the run (the step is prime to the pair count, so neighbours differ). */
    pairStep: 5,
    /** Free field round the drawing, pixels of the picture. */
    pad: 8,
  },
  /** A flag on a pole. */
  flag: {
    poleWidth: 16,
    poleShade: -0.18,
    knob: 32,
    clothHeight: 72,
    clothPadX: 12,
    clothMaxWidth: 232,
    /** Free pole between the foot of the flag and the bottom of the cloth. */
    rise: 22,
    /** Clear space between the edge of the tower and the edge of a pole, on both sides. */
    towerGap: 16,
    /** Flags nearer than this (pixels, cloth to cloth) are moved up. */
    markGap: 96,
    font: 34,
    checkpointFont: 34,
    checkpointWidth: 104,
    fills: {
      record: { fill: 0x7b4fd6, rim: PALETTE.gold },
      today: { fill: 0xff8a3d, rim: 0xffe2b8 },
      checkpoint: { fill: 0x3dc46b, rim: 0xd2f7de },
    },
    footRadius: 16,
    footColor: 0xb57a52,
  },
  /** The star of the best lap. */
  star: { size: 96, inner: 0.5, fill: PALETTE.gold, outline: 5 },
  /** The scroll bar on the right of the ribbon. */
  bar: {
    width: 10,
    inset: 8,
    minThumb: 70,
    track: 0x000000,
    trackAlpha: 0.18,
    thumb: 0xfff6ec,
    thumbAlpha: 0.9,
  },
  anim: {
    /** The first scroll starts this long after the window is open. */
    startDelayMs: 140,
    /** The scroll from the bottom to the record and the growth of the tower with it. */
    scroll: { ms: 1900, ease: 'Sine.easeInOut' },
    flag: {
      /** Flags that the tower reaches in the same moment stand up this far apart. */
      staggerMs: 170,
      spring: { ms: 460, ease: 'Back.easeOut' },
      /** The lite level: no spring, a short fade. */
      fadeMs: 260,
    },
    /** The record flag sways: the cloth swings by `deg` about the pole. */
    sway: { deg: 3.5, ms: 1500, ease: 'Sine.easeInOut' },
    /** Objects fade out over this many pixels as they cross an edge of the ribbon. */
    edgeFade: 64,
  },
} as const;
