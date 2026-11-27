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
  /** The picture of a zone on the left of a band. */
  picture: { size: 132, left: 18 },
  /** Texts of a band: the gap after the picture, the fonts and the rows (offsets from the middle of the band). */
  text: {
    gap: 14,
    nameFont: 42,
    rangeFont: 34,
    lockedFont: 46,
    lockedColor: 0xe4dcf2,
    rows: { plain: [-27, 27], lap: [-58, -4, 52] },
    /** The label of the best lap: a star and a small text. */
    bestLap: { font: 26, star: 44, gap: 8 },
  },
  /** The silhouette of a shut band: the colours of its sky and the tint of the picture. */
  locked: { sky: [0xc9c2d8, 0xa9a1bd], tint: 0x6e6a8c, pictureAlpha: 0.92 },
  /** Sky of a band: a strip of this width stretches to the ribbon; the foot of the band has a ledge. */
  sky: {
    textureWidth: 8,
    ledge: 12,
    ledgeShade: -0.2,
    lineShade: -0.35,
    topLight: 0.18,
    topLightHeight: 8,
  },
  /** The tower column: a picture of 20 layers drawn at `texScale` times the size it shows. */
  tower: {
    x: 98,
    width: 116,
    texScale: 2,
    /** Layers of the column wobble in width by this many pixels (of the picture) so the tower is not a ruler. */
    wobble: 12,
    glazeShare: 0.46,
    outline: 3.2,
    band: 0.14,
    shadowShade: -0.16,
    dripWidth: 12,
    dripLength: 11,
    /** Layer `i` takes the plain pair `i * pairStep` of the run (the step is prime to the pair count, so neighbours differ). */
    pairStep: 5,
    /** Free field round the drawing, pixels of the picture. */
    pad: 6,
  },
  /** A flag on a pole. */
  flag: {
    poleWidth: 12,
    poleShade: -0.18,
    knob: 22,
    clothHeight: 64,
    clothPadX: 20,
    clothMaxWidth: 214,
    /** Free pole between the foot of the flag and the bottom of the cloth. */
    rise: 20,
    /** The pole stands this far from the tower on each side. */
    towerGap: 10,
    /** Flags nearer than this (pixels, cloth to cloth) are moved up. */
    markGap: 84,
    font: 32,
    checkpointFont: 30,
    checkpointWidth: 92,
    fills: {
      record: { fill: 0x7b4fd6, rim: PALETTE.gold },
      today: { fill: 0xff8a3d, rim: 0xffe2b8 },
      checkpoint: { fill: 0x3dc46b, rim: 0xd2f7de },
    },
    footRadius: 13,
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
