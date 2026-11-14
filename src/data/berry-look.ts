import { PALETTE } from './palette';

/**
 * Look of the berry picture (a glossy strawberry) and its idle motion in the counter
 * (docs/06-art-animation-audio.md, section 4). Shares are of the baked picture size,
 * "unit" coordinates are -1..1 across the body, angles are degrees, times milliseconds.
 */
export const BERRY_LOOK = {
  /** Size of the baked picture, in texture pixels: crisp up to the pop in the screen centre. */
  textureSize: 256,
  colors: {
    /** The dark rim at the bottom edge. */
    rim: 0x8f1427,
    /** Body gradient: deep at the bottom, light at the top. */
    deep: 0xc41c36,
    base: PALETTE.berry,
    light: 0xff7388,
    gloss: 0xffffff,
    glow: 0xff5a73,
    seed: 0xffe9a6,
    seedShadow: 0x8f1427,
    leaf: PALETTE.success,
    leafLight: 0x7ff0b4,
    leafDark: 0x1f8a5c,
    stem: 0x2fb87c,
  },
  /** Body: size shares, centre and half sizes, and the outline profile. */
  body: {
    centerY: 0.575,
    halfWidth: 0.365,
    halfHeight: 0.36,
    /** The outline: width rises quickly and tapers to a rounded point (see `bodyHalfWidth`). */
    profileLift: 0.68,
    profileRound: 0.55,
    rimGrow: 0.035,
    outlineSteps: 36,
  },
  /** The gradient is a stack of smaller and smaller bodies pushed up and to the left. */
  gradient: {
    layers: 16,
    shrinkX: 0.66,
    shrinkY: 0.72,
    shiftX: 0.1,
    shiftY: 0.3,
    /** Above 1 keeps the lower part deeper for longer. */
    curve: 1.15,
  },
  gloss: {
    /** Soft wide patch and a bright narrow one on top of it: [x, y, half width, half height] as unit offsets. */
    soft: { x: -0.36, y: -0.4, rx: 0.34, ry: 0.2, alpha: 0.26 },
    bright: { x: -0.42, y: -0.4, rx: 0.22, ry: 0.11, alpha: 0.9 },
    dot: { x: -0.1, y: -0.62, r: 0.035, alpha: 0.8 },
    tiltDeg: -32,
    /** A thin lit rim along the lower right. */
    rimAlpha: 0.22,
  },
  seeds: {
    /** Rows from the top: height along the body (0..1) and how many seeds sit in the row. */
    rows: [
      { at: 0.3, count: 3 },
      { at: 0.46, count: 4 },
      { at: 0.62, count: 3 },
      { at: 0.78, count: 2 },
    ],
    /** Row spread as a share of the body width at that height. */
    spread: 0.78,
    rx: 0.02,
    ry: 0.03,
    shadowDrop: 0.008,
    shadowAlpha: 0.5,
    /** Seeds keep this far (unit) from the bright gloss. */
    glossClearance: 0.3,
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
    outline: 0.012,
    stemWidth: 0.04,
    stemHeight: 0.1,
  },
  glow: {
    steps: 9,
    /** Glow radius as a share of the half size of the picture, and its strongest ring alpha. */
    reach: 0.9,
    /** Where the glow is centred, down from the top (share of the picture size). */
    centerY: 0.54,
    alpha: 0.05,
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
