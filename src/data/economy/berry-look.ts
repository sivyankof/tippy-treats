import { PALETTE } from '../common/palette';

/**
 * Look of the berry picture (a strawberry drawn like the plain layers: flat two-tone fill, thick
 * outline, a stroke-and-dot highlight) and its idle motion in the counter
 * (docs/06-art-animation-audio.md, section 4). Shares are of the baked picture size,
 * "unit" coordinates are -1..1 across the body, angles are degrees, times milliseconds.
 */
export const BERRY_LOOK = {
  /** Size of the baked picture, in texture pixels: crisp up to the pop in the screen centre. */
  textureSize: 256,
  colors: {
    /** Main fill and the flat shadow band at the bottom right. */
    base: PALETTE.berry,
    shadow: 0xc41c36,
    gloss: 0xffffff,
    seed: 0xffe9a6,
    leaf: PALETTE.success,
    leafLight: 0x7ff0b4,
    stem: 0x2fb87c,
    /** Eyes and smile of the face on the large picture. */
    face: PALETTE.textDark,
  },
  /** Body: size shares, centre and half sizes, and the outline profile. */
  body: {
    centerY: 0.575,
    halfWidth: 0.365,
    halfHeight: 0.36,
    /** The outline: width rises quickly and tapers to a rounded point (see `bodyHalfWidth`). */
    profileLift: 0.68,
    profileRound: 0.55,
    outlineSteps: 36,
    /** The shadow band: the lit body is smaller by this share and pushed to the top left. */
    bandShare: 0.15,
  },
  /** Highlight as on the glaze: a short stroke and a dot beside it (unit offsets, shares of the size). */
  gloss: {
    x: -0.6,
    y: -0.28,
    length: 0.12,
    thick: 0.036,
    tiltDeg: -55,
    dotGap: 0.05,
    dotRadius: 0.018,
    alpha: 0.9,
  },
  seeds: {
    /** Rows from the top: height along the body (0..1) and how many seeds sit in the row. */
    rows: [
      { at: 0.32, count: 2 },
      { at: 0.5, count: 2 },
      { at: 0.7, count: 2 },
      { at: 0.86, count: 1 },
    ],
    /** Row spread as a share of the body width at that height. */
    spread: 0.78,
    rx: 0.03,
    ry: 0.044,
    /** Seeds keep this far (unit) from the gloss. */
    glossClearance: 0.34,
  },
  calyx: {
    /** Where the leaves meet, down from the top of the body (share of the body height). */
    sinkShare: 0.1,
    /** [angle from straight up, length as a share of the texture size], clockwise. */
    leaves: [
      { deg: -112, length: 0.23 },
      { deg: -62, length: 0.25 },
      { deg: 0, length: 0.21 },
      { deg: 62, length: 0.25 },
      { deg: 112, length: 0.23 },
    ],
    leafWidth: 0.088,
    /** The light half-strip down each leaf: length and width against the leaf. */
    lightLength: 0.7,
    lightWidth: 0.28,
    stemWidth: 0.04,
    stemHeight: 0.1,
  },
  /** The small face on the large picture: two dot eyes and a smile (unit offsets and shares of the size). */
  face: {
    eyeY: 0.05,
    eyeSpacing: 0.3,
    eyeRadius: 0.042,
    smileY: 0.19,
    smileRadius: 0.12,
    /** The smile arc covers this many degrees around straight down. */
    smileSpanDeg: 100,
    smileThick: 0.032,
  },

  /** In the HUD counter at rest: the icon sways and a spark twinkles on it now and then. */
  idle: {
    swayDeg: 5,
    swayPeriodMs: 2300,
    /** The icon also rises and falls a little, in pixels. */
    bobPx: 1.5,
    bobPeriodMs: 1800,
    /** A spark flashes this often; between flashes it is invisible. */
    sparkEveryMs: 2000,
    /** Share of the period the spark is lit. */
    sparkShare: 0.3,
    sparkScale: 0.75,
    sparkAlpha: 0.95,
    /** The spark turns this much while it flashes. */
    sparkTurnDeg: 45,
    /** Where it sits on the icon, as a share of the icon size from its centre. */
    sparkX: -0.2,
    sparkY: -0.22,
  },
} as const;
