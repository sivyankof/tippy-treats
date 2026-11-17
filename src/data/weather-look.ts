import type { GradientStop } from './backdrop-colors';
import type { EffectLevel } from './effect-levels';
import type { WeatherId } from './weather';

/** The two zones that show the whole weather. */
export type WeatherZone = 'roof' | 'clouds';
export type PerZone<T> = Record<WeatherZone, T>;
type PerLevel<T> = Record<EffectLevel, T>;
type Layers4 = readonly [number, number, number, number];

const NONE = 0xffffff;

/** Texture keys of the weather pictures (all under `fx_`, so they live on the shared atlas). */
export const WEATHER_TEX = {
  flake: ['fx_wx_flake0', 'fx_wx_flake1', 'fx_wx_flake2'],
  drop: 'fx_wx_drop',
  leaf: ['fx_wx_leaf_orange', 'fx_wx_leaf_red', 'fx_wx_leaf_yellow'],
  splash: 'fx_wx_splash',
  star: ['fx_wx_star0', 'fx_wx_star1'],
  moon: 'fx_wx_moon',
  cap: 'fx_wx_cap',
  bankRain: 'fx_wx_bank_rain',
  bankStorm: 'fx_wx_bank_storm',
  bankFlash: 'fx_wx_bank_flash',
  bolt: 'fx_wx_bolt',
} as const;

/** Seed of the cosmetic stream of the sky pieces (stars, lightning), the same in both zones. */
const SKY_SEED = 7141;

/** Look of the run weather in Roof and Clouds. Clear is the unchanged zone look and is not listed. */
export const WEATHER_LOOK = {
  skySeed: SKY_SEED,
  /** Sky gradient per weather and zone (top to bottom). */
  sky: {
    sunset: {
      roof: [
        { at: 0, color: 0x5a64b8 },
        { at: 0.55, color: 0xe27a98 },
        { at: 1, color: 0xffb878 },
      ],
      clouds: [
        { at: 0, color: 0x4a3f93 },
        { at: 0.5, color: 0xf0627a },
        { at: 1, color: 0xff9f62 },
      ],
    },
    night: {
      roof: [
        { at: 0, color: 0x141a4a },
        { at: 0.6, color: 0x2a3070 },
        { at: 1, color: 0x4a4086 },
      ],
      clouds: [
        { at: 0, color: 0x130f3e },
        { at: 0.5, color: 0x2d2470 },
        { at: 1, color: 0x58398a },
      ],
    },
    rain: {
      roof: [
        { at: 0, color: 0x73849d },
        { at: 0.7, color: 0xa2afc0 },
        { at: 1, color: 0xc9cdd3 },
      ],
      clouds: [
        { at: 0, color: 0x5a6280 },
        { at: 0.5, color: 0x8089a6 },
        { at: 1, color: 0xaeb0c4 },
      ],
    },
    storm: {
      roof: [
        { at: 0, color: 0x465169 },
        { at: 0.7, color: 0x6b758a },
        { at: 1, color: 0x8f929f },
      ],
      clouds: [
        { at: 0, color: 0x383d5c },
        { at: 0.5, color: 0x5c617f },
        { at: 1, color: 0x868ba4 },
      ],
    },
    snow: {
      roof: [
        { at: 0, color: 0xa7b6cc },
        { at: 0.7, color: 0xd3dbe6 },
        { at: 1, color: 0xeff0f4 },
      ],
      clouds: [
        { at: 0, color: 0x8e9bc8 },
        { at: 0.5, color: 0xc5cce6 },
        { at: 1, color: 0xefe6f0 },
      ],
    },
    leaves: {
      roof: [
        { at: 0, color: 0xe2b184 },
        { at: 0.7, color: 0xf4cf9a },
        { at: 1, color: 0xffe8c8 },
      ],
      clouds: [
        { at: 0, color: 0x8a5a86 },
        { at: 0.5, color: 0xe58862 },
        { at: 1, color: 0xffc47c },
      ],
    },
  } satisfies Partial<Record<WeatherId, PerZone<readonly GradientStop[]>>>,

  /** The pale colour the far plane silhouettes lean to (they start at the sky colour). */
  farLight: {
    sunset: { roof: 0xffd2b8, clouds: 0xffc8b0 },
    night: { roof: 0x6b6fb8, clouds: 0x7a68b8 },
    rain: { roof: 0xdfe5ee, clouds: 0xc8cde0 },
    storm: { roof: 0xb8bfcc, clouds: 0xa4a9c4 },
    snow: { roof: 0xffffff, clouds: 0xf6f2fa },
    leaves: { roof: 0xfff0d4, clouds: 0xffd6b4 },
  } satisfies Partial<Record<WeatherId, PerZone<number>>>,

  /** Multiply tint of the four parallax layers (back to front). Night roof bakes its own far and mid layers. */
  layerTint: {
    sunset: {
      roof: [0xf4e0f2, 0xdbd6ff, 0xdbebff, 0xdbebff],
      clouds: [0xffd0c0, 0xffc2a8, 0xffb8a0, 0xffd0b8],
    },
    night: {
      roof: [NONE, NONE, 0x7068a8, 0x6a62a0],
      clouds: [0x7a78b8, 0x6a68ac, 0x5e5ca0, 0x6a68a8],
    },
    rain: {
      roof: [0xc8d0dc, 0xb0b8c8, 0xa0a8b8, 0xa0a8b8],
      clouds: [NONE, NONE, NONE, NONE],
    },
    storm: {
      roof: [0xa8b0c0, 0x9098ac, 0x808aa0, 0x808aa0],
      clouds: [0xc4c8d8, 0xb8bccf, 0xaeb2c6, 0xc4c8d8],
    },
    snow: {
      roof: [0xe8eefc, 0xcfd9f0, 0xc0cce8, 0xc8d2ea],
      clouds: [0xf0f0ff, 0xe8ecfa, 0xe4e8f8, 0xf0f0fc],
    },
    leaves: {
      roof: [0xfff0e0, 0xebfaff, 0xe6ffff, 0xe6ffff],
      clouds: [0xffe0c0, 0xffd2b0, 0xffc8a0, 0xffe0c0],
    },
  } satisfies Partial<Record<WeatherId, PerZone<Layers4>>>,

  /** Multiply tint of the mountain range (both zones). */
  mountainTint: {
    sunset: 0xffc6b4,
    night: 0x6c68a8,
    rain: 0xa6aec2,
    storm: 0x8890aa,
    snow: 0xeef2ff,
    leaves: 0xffdcb4,
  } satisfies Partial<Record<WeatherId, number>>,

  /** Multiply tint of the chimney and the smoke of the Roof zone. */
  fixtureTint: {
    sunset: 0xf0b8a0,
    night: 0x6a62a0,
    rain: 0x9aa2b6,
    storm: 0x8088a0,
    leaves: 0xf4c898,
  } satisfies Partial<Record<WeatherId, number>>,

  /** Clouds of the Clouds zone in rain and storm (the pink evening clouds turn grey-blue). */
  cloudsGrey: { far: 0x8c94a8, mid: 0x98a0b4, near: 0xa6aebf, haze: 0xb4bbcb },

  /** Roof at night: the far and mid house layers are baked again with dusk walls and warm windows. */
  nightRoof: {
    farWall: 0x3a3f86,
    farRoof: 0x34397c,
    farWindow: 0xffc86a,
    farWindowAlpha: 0.6,
    midWall: 0x4a4a92,
    midRoof: 0x3a3a7c,
    window: 0xf0c577,
    windowAlpha: 0.7,
    darkWindow: 0x363a78,
    windowW: 30,
    windowH: 38,
  },

  /** Number of weather pictures on screen per effects level (the splashes and the stars count as well). */
  particleCount: { full: 40, lite: 20, minimal: 0 } satisfies PerLevel<number>,
  /** Rare splashes on the top layer: tower top Y spots at once, and the pause between them in ms (per level). */
  splash: {
    max: 3,
    pauseMs: { full: [900, 2200], lite: [1800, 4400], minimal: null } as PerLevel<
      readonly [number, number] | null
    >,
    lifeMs: 340,
    startScale: 0.5,
    endScale: 1.1,
    alpha: 0.85,
    scale: 1,
  },
  /** The particles fade out this far (px) from the edges of the flight row, and in at the screen ends. */
  bandFeatherPx: 70,
  /** Particles fade out toward the HUD plates over this many px beyond the HUD gap. */
  keepOutFeatherPx: 40,
  endFeatherPx: 60,
  /** Share of the particles that start in the side strips (the tower hides the middle), and the strip width as share of the screen. */
  sideBias: 0.75,
  sideShare: 0.3,

  /** Motion and look of each kind of falling thing (px, px/s, ms). */
  rain: {
    frames: ['drop'],
    speed: [1500, 1900],
    slant: 0.22,
    alpha: [0.75, 1],
    scale: [1, 1.3],
    count: 36,
  },
  storm: {
    frames: ['drop'],
    speed: [1900, 2400],
    slant: 0.38,
    alpha: [0.8, 1],
    scale: [1.1, 1.45],
    count: 36,
  },
  snow: {
    frames: ['flake'],
    speed: [90, 190],
    swayPx: [22, 60],
    swayMs: [3200, 6500],
    alpha: [0.85, 1],
    scale: [1, 1],
    count: 34,
  },
  leaves: {
    frames: ['leaf'],
    speed: [120, 210],
    swayPx: [70, 150],
    swayMs: [2600, 4800],
    spinMs: [2400, 5200],
    tiltRad: 0.9,
    alpha: [0.92, 1],
    scale: [0.9, 1.25],
    count: 26,
  },

  /** Rain and storm cloud bank at the top of the sky. */
  bank: {
    /** Picture size, and the scale it is shown at (it is wider than the screen so it can drift). */
    width: 1024,
    height: 256,
    scale: 1.27,
    driftPx: 60,
    driftMs: 26000,
    /** The bank is the sky colour at the top of the zone made this much darker (share, 0..1). */
    darkRain: 0.25,
    darkStorm: 0.4,
    /** The pale twin that lights the bank in a flash: this colour, this share. */
    flashColor: 0xdde6ff,
    flashMix: 0.8,
    /** Flat band from the top edge down to this y (picture px); every lobe reaches up into it, so the figure is one piece. */
    bodyBottom: 100,
    /** Width and height of a lobe's ellipse as multiples of its radius. */
    lobeWide: 3.1,
    lobeTall: 1.8,
    /** Lobes of the lower edge (picture px): centre x, centre y, radius. The middle ones stay high, behind the score. */
    lumps: [
      [40, 140, 66],
      [130, 150, 70],
      [220, 128, 62],
      [310, 92, 52],
      [400, 78, 46],
      [500, 70, 44],
      [600, 78, 46],
      [690, 94, 52],
      [790, 128, 62],
      [880, 152, 72],
      [975, 140, 66],
    ] as ReadonlyArray<readonly [number, number, number]>,
  },

  /** Lightning in the cloud bank of a storm. */
  lightning: {
    firstMs: [3000, 6000],
    everyMs: [8000, 15000],
    flashMs: [120, 180],
    /** Alpha of the pale lump overlay at the peak. */
    flashAlpha: 0.75,
    /** The bolt stands in one of these x ranges (share of the screen width). */
    xRanges: [
      [0.1, 0.26],
      [0.74, 0.9],
    ] as ReadonlyArray<readonly [number, number]>,
    /** Picture size, and the width of its rim and core strokes (picture px). */
    width: 140,
    height: 200,
    rimPx: 34,
    corePx: 22,
    /** Inside the cloud: the bolt starts this share of the cloud's height at that x down, is at most this share of it long, and ends at least `endGapPx` above its lower edge. */
    topShare: 0.22,
    lengthShare: 0.6,
    endGapPx: 25,
    /** The cloud must be at least this tall (px) at the strike point, and the strike point is drawn up to this many times to clear the HUD. */
    minCloudPx: 150,
    tries: 12,
  },

  /** Stars and the crescent moon of the night (both stand in the sky, behind the houses). */
  night: {
    stars: 14,
    starAlpha: [0.6, 1],
    twinkleMs: [1800, 4200],
    twinkleDepth: 0.4,
    /** Twinkle: the star's scale swings by this much. */
    twinkleScale: 0.25,
    /** A star is drawn up to this many times until it clears the HUD plates and the flight row. */
    tries: 10,
    /** Stars keep out of the flight row (and this far above it). */
    aboveBandPx: 50,
    topMarginPx: 30,
    /** The moon: radius of the disc (px), centre x as a share of the screen width. It hangs at the HUD floor. */
    moon: { radius: 40, xShare: 0.17 },
  },

  /** Thin snow cap on the top layer. */
  cap: {
    width: 512,
    height: 56,
    /** Picture y that sits on the top edge of the layer. */
    anchorY: 24,
    /** Share of the layer width the cap covers. */
    widthShare: 0.88,
    growMs: 1600,
    /** Depth offset over the top layer (it stays under the next layer). */
    depthStep: 0.0004,
    colors: { snow: 0xffffff, shade: 0xe6ecf8 },
  },
} as const;
