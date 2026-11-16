/**
 * Mountain peaks behind the end of "Крыша" and the start of "Облака" (docs/06, section 5,
 * "Горы"). One baked picture; the height of the tower (in layers) decides how far it has risen.
 */

/** Which tower heights, in layers, the peaks are on screen for. */
export const MOUNTAIN_SPAN = {
  /** The peaks start to rise from the bottom edge here and stand fully up at `riseTo`. */
  riseFrom: 48,
  riseTo: 54,
  /** They start to sink here (clouds cover them) and are gone at `sinkTo`. */
  sinkFrom: 64,
  sinkTo: 72,
} as const;

export const MOUNTAIN_LOOK = {
  /** Texture key of the baked range. */
  texture: 'bd_mountains',
  width: 768,
  height: 540,
  /** Muted to about half the contrast against the sky (a warm mid sky tone) so the tower stays the most contrasting thing (docs/06, "Горы"). */
  rockBack: 0xe1c4cd,
  rockBackDark: 0xd9bbc6,
  rock: 0xcfb2c3,
  rockDark: 0xc6a7bb,
  snow: 0xfadcc5,
  snowDark: 0xf4d1b6,
  /** Warm brown outline of the snow (the dark tone of cream), warmer than the shade of the pale fill. */
  snowOutline: 0xcf9d87,
  /** Outline growth in texture pixels; the outline colour is the dark tone of each fill. */
  outline: 8,
  /**
   * The apex is a curve of `apexPoints` points `apexRound` px down each slope (at least
   * `apexMinOutlines` outline widths): the outline is stamped copies of the shape, and a sharp
   * apex would show one small tip per copy.
   */
  apexRound: 0.06,
  apexMinOutlines: 2.5,
  apexPoints: 9,
  /** How deep the drips hang, as a share of the cap height. */
  dripShare: 0.7,
  /** The snow edge hangs in rounded drips of these depths (share of the cap height) from left to right. */
  dripDepths: [0.0, 0.34, 0.12, 0.42, 0.18],
  /** Peaks: foot centre x, top y and half width at the bottom of the picture; `back` ones sit behind. */
  peaks: [
    { x: 150, top: 235, half: 140, back: true },
    { x: 600, top: 225, half: 140, back: true },
    { x: 178, top: 285, half: 100, back: false },
    { x: 572, top: 290, half: 100, back: false },
  ],
  /** Share of the peak (from the top) that carries snow, per peak group. */
  capShareBack: 0.2,
  capShareFront: 0.22,
  /** How far below the picture the shapes reach, so the outline does not show along the bottom edge. */
  overshoot: 30,
  /** Gloss mark on the sunlit slope of a front snow cap. */
  gloss: { dx: 0.22, dy: 0.5, length: 16, thick: 5, tilt: -1.0, dotGap: 5, dotRadius: 2.5 },
  glossAlpha: 0.5,
} as const;

/** The middle share of the screen width behind the tower: no peak stands in it (checked at the cap base and the apex). */
export const MOUNTAIN_FREE_BAND = 0.5;

/** Zones whose far plane gives way to the peaks: it fades out as they rise (they replace it, not cover it). */
export const MOUNTAIN_FAR_ZONES: readonly string[] = ['roof', 'clouds'];

/** Parallax slot the peaks are drawn above: in front of the opaque houses of the roof, in front of every cloud layer in the clouds (nothing see-through is drawn over them). */
export const MOUNTAIN_SLOT = { roof: 1, clouds: 3 } as const;

export const MOUNTAIN_MOTION = {
  /** The picture is as wide as the screen; `bottomShare` is where its bottom edge sits (1: the screen bottom). */
  bottomShare: 1,
  /** The picture is this share of the screen height tall (it is cropped at the sides on a narrow screen). */
  heightShare: 0.49,
  /** Full effects: the range sways slowly sideways so it is never still. Lite and minimal: no drift. */
  swayPx: 8,
  swayPeriodMs: 26000,
} as const;
