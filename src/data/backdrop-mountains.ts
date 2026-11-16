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
  /** Muted towards the sky so the tower stays the most contrasting thing (docs/06, "Горы"). */
  rockBack: 0xcdc0e6,
  rockBackDark: 0xbcaed9,
  rock: 0xa99bd2,
  rockDark: 0x9686c2,
  snow: 0xffefd6,
  snowDark: 0xf3d9b8,
  /** Warm brown outline of the snow (the dark tone of cream), warmer than the shade of the pale fill. */
  snowOutline: 0xa8795a,
  /** Outline growth in texture pixels; the outline colour is the dark tone of each fill. */
  outline: 8,
  /** How deep the drips hang, as a share of the cap height. */
  dripShare: 0.7,
  /** The snow edge hangs in rounded drips of these depths (share of the cap height) from left to right. */
  dripDepths: [0.0, 0.34, 0.12, 0.42, 0.18],
  /** Peaks: foot centre x, top y and half width at the bottom of the picture; `back` ones sit behind. */
  peaks: [
    { x: 248, top: 195, half: 225, back: true },
    { x: 525, top: 165, half: 225, back: true },
    { x: 375, top: 45, half: 255, back: false },
    { x: 518, top: 210, half: 165, back: false },
  ],
  /** Share of the peak (from the top) that carries snow, per peak group. */
  capShareBack: 0.2,
  capShareFront: 0.22,
  /** How far below the picture the shapes reach, so the outline does not show along the bottom edge. */
  overshoot: 30,
  /** Gloss mark on the sunlit slope of a front snow cap. */
  gloss: { dx: 0.22, dy: 0.5, length: 16, thick: 5, tilt: -1.0, dotGap: 5, dotRadius: 2.5 },
  glossAlpha: 0.85,
} as const;

/** Zones whose far plane gives way to the peaks: it fades out as they rise (they replace it, not cover it). */
export const MOUNTAIN_FAR_ZONES: readonly string[] = ['roof', 'clouds'];

/** Parallax slot the peaks are drawn above: in front of the opaque houses of the roof, in front of every cloud layer in the clouds (nothing see-through is drawn over them). */
export const MOUNTAIN_SLOT = { roof: 1, clouds: 3 } as const;

export const MOUNTAIN_MOTION = {
  /** The picture is as wide as the screen; `bottomShare` is where its bottom edge sits (1: the screen bottom). */
  bottomShare: 1,
  /** The picture is this share of the screen height tall (it is cropped at the sides on a narrow screen). */
  heightShare: 0.7,
  /** Full effects: the range sways slowly sideways so it is never still. Lite and minimal: no drift. */
  swayPx: 8,
  swayPeriodMs: 26000,
} as const;
