import { ANIM } from '../common/anim';

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
  /**
   * Length of the squashed part as a share of the layer width (longer when the squash is deep);
   * the wedge of the squash is as long as this share of the drawn width.
   */
  zoneShare: number;
  /** The narrowest a column of the picture gets, right at the wall (horizontal scale). */
  minScale: number;
  /** How much the wedge rises at the wall, times the rise of `byPower` (a hard material barely rises). */
  rise: number;
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
  /** Size of the ribs along the wedge outline, times `byPower.ribHeight` (0 for a hard material: none; a soft one only has a low bubble). */
  ribs: number;
  /** A soft material with a wavy top has no ribs: the wedge bulges at the wall as one smooth bubble. */
  bubble: boolean;
  /**
   * How much of the glaze drops and the impact strokes the material gives at the touch, times
   * their strength by speed (0 for a hard material: it only knocks off crumbs).
   */
  splash: number;
  /** The face at the touch and how long it holds it. */
  face: WallFace;
  faceMs: number;
}

/** A value at the slow end (`power` 0) and at the fast end (`power` 1) of the flight speed. */
export type ByPower = readonly [slow: number, fast: number];

export const EDGE_SQUASH = {
  /**
   * The squash starts this far before the edge touches and eases in over twice this distance,
   * so the edge slows down smoothly instead of stopping dead.
   */
  kneePx: 20,
  /**
   * Columns of the deformable picture: a rib needs about ten of them to be a round fold, so most
   * of them sit where the squash is: `edgeShare` of the columns go to each outer `edgeSpan` of
   * the picture's width (the middle gets the rest).
   */
  columns: { count: 161, edgeSpan: 0.4, edgeShare: 0.42 },
  /**
   * What stands above the body in the picture (the scalloped crown of the jelly, a wafer) would be
   * squeezed into spikes: as a column gets narrower than `from` (its horizontal scale) that part is
   * cut away, all of it by `full`, leaving `rimPx` above the body for its outline, so the silhouette
   * is the smooth outline of the ribs. The crown is also cut away along the whole wedge and lets go
   * over `releaseShare` of its length past the end, so the bubble of a soft layer never ends in a step.
   */
  crownCut: { from: 0.97, full: 0.75, rimPx: 3.5, releaseShare: 0.35 },
  /** The face moves this share of the way to the centre of the visible part. */
  faceShare: 1,
  /** The face reacts only to a squash at least this deep, px. */
  reactFromPx: 24,
  /** The bounce at the turn: length of one hop and the time it takes to die down by e. */
  bounce: { periodMs: 200, decayMs: 180 },
  /** The gathered glaze and the ribs spring back after the turn: share, length of a swing, decay. */
  glazeSpring: { amp: 0.6, periodMs: 240, decayMs: 160 },
  /**
   * The wedge: the column at the wall gets taller and the height returns to normal along the
   * drawn distance from the wall (`feel.zoneShare` of the width) as `(1 - t) ^ profile`.
   */
  wedge: {
    /** Share of the added height that goes up; the rest goes down. */
    upShare: 0.85,
    profile: 1.5,
    /** The rise is full from this squash depth, px (it grows smoothly from 0). */
    fullDepthPx: 40,
    /** The wedge never takes more than this share of the drawn body width. */
    maxBodyShare: 0.45,
    /**
     * The crumpled part is `feel.zoneShare` of the layer width long and grows up to `deepMul` times
     * that as the squash deepens to `deepDepthPx`, but never past `maxShare` of the width.
     */
    deepMul: 4 / 3,
    deepDepthPx: 70,
    maxShare: 1 / 3,
  },
  /**
   * How strong everything is, by the speed of the layer: `power` is its share between the start
   * and the top speed of `BALANCE.speed`. Slow: +12-15% of the height at the wall with the
   * glaze, calm, 3 small ribs on top and 2 at the bottom. Fast: +25-30%, 4 ribs on top and 3 at the bottom, a bigger bulge, drops and strokes, a squint.
   */
  byPower: {
    /** Added height of the wedge at the wall without the glaze, share of the layer height. */
    rise: [0.12, 0.235] satisfies ByPower,
    /**
     * Height of the ribs standing on the wedge outline, share of the layer height, independent
     * of the wedge: small when slow, big plump ones when fast. The bottom ribs are clearly
     * lower, so they never cover the top of the tower layer or the ghost guide below.
     */
    ribHeight: {
      top: [0.095, 0.37] satisfies ByPower,
      bottom: [0.035, 0.11] satisfies ByPower,
    },
    /**
     * The ceiling of the drawn outline above the normal layer top at the wall, glaze, wedge and ribs
     * together, share of the layer height: slow +25%, fast +45%. It never lets the squash cover the
     * tower or hide the aim, whatever the material.
     */
    maxUp: [0.25, 0.45] satisfies ByPower,
    /** The glaze bulge, times `feel.glazeLiftPx`. */
    glazeMul: [0.4, 1.45] satisfies ByPower,
    /**
     * The last rib of each row fades in between these two powers: the fourth on top (the first
     * three are always there), the third at the bottom (the first two are always there).
     */
    lastRib: {
      top: [0.15, 0.55] satisfies ByPower,
      bottom: [0.3, 0.7] satisfies ByPower,
    },
    /**
     * Glaze drops, strokes and the squint grow smoothly: nothing at `from`, everything at `full`
     * (powers). Up to `count` drops fly; each new drop grows from nothing, and `size` is the
     * share of their size a barely-there splash has.
     */
    drops: { from: 0.3, full: 0.8, count: 3, size: 0.3 },
    /** Impact strokes: their strength (alpha and length) ramps in over the same kind of range. */
    strokes: { from: 0.25, full: 0.75, size: 0.4 },
    /** The face squints at the touch for `faceMs` times the ramp (a normal or soft material); too short a squint is skipped; the worried `o` mouth of the aim comes back from `mouthFrom` of the ramp (a slower layer keeps a calm face). */
    squint: { from: 0.25, full: 0.7, minShare: 0.2, mouthFrom: 0.5 },
  },
  /**
   * The ribs: the wedge outline is cut into `slots` places (top and bottom row), each with its own
   * width and height picked from ranges, so they are never ruler-made. A rib is a plump round bump leaning towards
   * the wall; the one at the wall is the biggest.
   */
  ribs: {
    /** Name of the stream a layer's ribs are picked from (`fork('<name>:<layer>:<row>')` of the cosmetic seed). */
    stream: 'ribs',
    slots: { top: 4, bottom: 3 },
    /**
     * Four very different layouts (widths as shares of the wedge length, scaled to add up to 1,
     * and heights 0..1 per slot, from the wall): big-small-medium-low, medium-big-low-small, and
     * so on. The layout of a row comes from the layer number (the top and the bottom row take
     * different ones), so two layers in a row, and two layers with one between, never get the
     * same cut.
     */
    styles: {
      top: [
        {
          width: [
            [0.38, 0.42],
            [0.14, 0.18],
            [0.22, 0.26],
            [0.18, 0.22],
          ],
          height: [
            [0.92, 1.0],
            [0.72, 0.84],
            [0.8, 0.88],
            [0.4, 0.48],
          ],
        },
        {
          width: [
            [0.2, 0.24],
            [0.32, 0.36],
            [0.13, 0.16],
            [0.26, 0.3],
          ],
          height: [
            [0.9, 0.96],
            [0.8, 0.88],
            [0.4, 0.48],
            [0.66, 0.78],
          ],
        },
        {
          width: [
            [0.14, 0.17],
            [0.14, 0.17],
            [0.34, 0.38],
            [0.28, 0.32],
          ],
          height: [
            [0.94, 1.0],
            [0.4, 0.48],
            [0.8, 0.88],
            [0.66, 0.78],
          ],
        },
        {
          width: [
            [0.26, 0.3],
            [0.2, 0.24],
            [0.14, 0.17],
            [0.3, 0.34],
          ],
          height: [
            [0.96, 1.0],
            [0.74, 0.86],
            [0.4, 0.48],
            [0.8, 0.88],
          ],
        },
      ] as const,
      /** Three slots for the bottom row (fewer, lower and wider; never the layout of the top). */
      bottom: [
        {
          width: [
            [0.42, 0.46],
            [0.16, 0.2],
            [0.34, 0.38],
          ],
          height: [
            [0.9, 1.0],
            [0.3, 0.4],
            [0.74, 0.84],
          ],
        },
        {
          width: [
            [0.16, 0.2],
            [0.42, 0.46],
            [0.34, 0.38],
          ],
          height: [
            [0.92, 1.0],
            [0.78, 0.88],
            [0.4, 0.5],
          ],
        },
        {
          width: [
            [0.3, 0.34],
            [0.14, 0.18],
            [0.48, 0.52],
          ],
          height: [
            [0.94, 1.0],
            [0.34, 0.44],
            [0.7, 0.82],
          ],
        },
        {
          width: [
            [0.16, 0.2],
            [0.3, 0.34],
            [0.46, 0.5],
          ],
          height: [
            [0.9, 0.98],
            [0.45, 0.5],
            [0.8, 0.9],
          ],
        },
      ] as const,
    },
    /** The crest sits at `0.5 ^ (1 / lean)` of the rib from its wall side (1: in the middle, less: nearer the wall). */
    lean: 0.7,
    /** The top ribs take at most this share of what is left under the ceiling after the glaze; the wedge under them gets the rest. */
    ceilingShare: 0.8,
    /** Below 1 the bump is plumper (flatter on top, steeper at the foot). */
    plump: 0.35,
    /** The foot of every rib eases in over this share of its width, so the hollows are soft creases (no spike, no vertical wall). */
    foot: 0.22,
    /** The ribs shrink along the wedge as `(1 - t) ^ fade`. */
    fade: 0.12,
  },
  /**
   * The outline of the crumpled part, drawn over the picture as one smooth curve: a polygon with the
   * round ribs (or one bubble) on top of the wedge, filled with the glaze (top) or the sponge (bottom)
   * of the layer and outlined like the layer itself. The columns carry the wedge body, this gives the
   * rounded silhouette.
   */
  silhouette: {
    /** Points along the wedge for each row of ribs (more: rounder). */
    samples: 64,
    /** The fill reaches this far into the body below the outline, so the picture's own outline under it never shows, px. */
    insetPx: ANIM.layer.outline + 3,
    /** Line width of the outline: the layer's own. */
    outlinePx: ANIM.layer.outline,
  },
  /**
   * Short curved notches in the hollows between the ribs, inside the sponge only: the top ones
   * start just below the glaze line, the bottom ones at the bottom edge. Shorter and paler the
   * further from the wall.
   */
  notches: {
    lengthPx: 20,
    /** Each next hollow is this share shorter. */
    shrink: 0.28,
    /** How far the notch starts inside the sponge (from the bottom edge, and below the glaze line), px. */
    insetPx: 3,
    /** The glaze line sits this share of the body height below its top: the glaze and its drips. */
    glazeLineShare: 0.46,
    /** The notch bows this far towards the wall (px). */
    bowPx: 3.5,
    widthPx: 4,
    /** The bow: (share of the length along, share of `bowPx` across) of the two middle points of the notch. */
    curve: [
      [0.4, 0.9],
      [0.75, 0.7],
    ] as const,
    colour: 0x4a2f20,
    alpha: 0.4,
    /** The notches show from this squash depth, px, and are full at `fullDepthPx`. */
    fromDepthPx: 14,
    fullDepthPx: 50,
  },
  /** Short strokes of the impact: a fan up from the crest of the wedge that fades in `ms`. */
  strokes: {
    count: 3,
    ms: 220,
    /** Fan of the directions around straight up, degrees, and the angle between the strokes. */
    fanDeg: 34,
    /** The whole fan leans this far away from the wall, degrees. */
    tiltDeg: 12,
    /** Stroke starts this far from the crest and is this long at the start and at the end, px. */
    gapPx: [8, 22] as const,
    lengthPx: [18, 32] as const,
    widthPx: 5,
    colour: 0x000000,
    alpha: 0.55,
    /** The fade of the stroke alpha over its time: `(1 - progress) ^ fadePow`. */
    fadePow: 1.5,
    /** The crest is this far from the wall along the wedge, share of its length. */
    crestShare: 0.06,
  },
  /** Glaze drops that fly up from the wall at the touch of a fast layer. */
  drops: {
    style: {
      speed: [420, 760],
      gravity: 1300,
      drag: 0.3,
      spin: [-30, 30],
      alignToDirection: true,
      scale: [2.3, 3.2],
      scaleTo: 0.8,
      alpha: 1,
      holdShare: 0.7,
      lifeMs: [620, 820],
      spreadDeg: 0,
      tiltDeg: 0,
    },
    /** Where they start: this far from the wall, share of the layer height above the layer centre. */
    insetPx: 18,
    riseShare: 0.62,
    /** The drops leave the vertical this far away from the wall, degrees. */
    awayDeg: 14,
    /**
     * The first drops of a touch, one by one so they never overlap: how far each leaves the middle
     * direction (degrees, positive: away from the wall) and its speed, px/s. A weaker touch
     * throws the first ones only. The style's `speed` is not used.
     */
    launch: [
      { offsetDeg: 0, speed: 720 },
      { offsetDeg: 20, speed: 540 },
      { offsetDeg: -14, speed: 620 },
    ] as const,
  },
  feel: {
    normal: {
      give: 1,
      slide: 1,
      zoneShare: 0.25,
      minScale: 0.15,
      rise: 1,
      bounce: 0.12,
      edgeBias: 0.2,
      glazeLiftPx: 12,
      glazeSag: 0.5,
      ribs: 1,
      bubble: false,
      splash: 1,
      knockPx: 0,
      knockMs: 0,
      face: 'squint',
      faceMs: 360,
    },
    soft: {
      give: 1,
      slide: 1,
      zoneShare: 0.33,
      minScale: 0.12,
      rise: 1.3,
      bounce: 0.2,
      edgeBias: 0.2,
      glazeLiftPx: 18,
      glazeSag: 0.55,
      ribs: 0.9,
      bubble: true,
      splash: 1,
      knockPx: 0,
      knockMs: 0,
      face: 'squint',
      faceMs: 420,
    },
    hard: {
      give: 0.35,
      slide: 1,
      zoneShare: 0.2,
      minScale: 0.55,
      rise: 0.25,
      bounce: 0.08,
      edgeBias: 0.1,
      glazeLiftPx: 2,
      glazeSag: 0.2,
      ribs: 0,
      bubble: false,
      splash: 0,
      knockPx: 12,
      knockMs: 130,
      face: 'gape',
      faceMs: 320,
    },
  } satisfies Record<WallFeelKind, WallFeel>,
} as const;
