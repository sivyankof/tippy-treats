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
  flake: ['fx_wx_flake0', 'fx_wx_flake1', 'fx_wx_flake2', 'fx_wx_flake3'],
  drop: 'fx_wx_drop',
  leaf: ['fx_wx_leaf_orange', 'fx_wx_leaf_red', 'fx_wx_leaf_yellow'],
  splash: 'fx_wx_splash',
  star: ['fx_wx_star0', 'fx_wx_star1'],
  moon: 'fx_wx_moon',
  cap: 'fx_wx_cap',
  bankRain: 'fx_wx_bank_rain',
  bankStorm: 'fx_wx_bank_storm',
  /** The lit twin of the bank for a bolt on the left and on the right. */
  bankFlash: ['fx_wx_bank_flash_l', 'fx_wx_bank_flash_r'],
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
    /** Splashes allowed at once per level: with the raindrops they stay within `particleCount` (see `rainDropsShown`). */
    maxShown: { full: 3, lite: 1, minimal: 0 } satisfies PerLevel<number>,
    pauseMs: { full: [900, 2200], lite: [1800, 4400], minimal: null } as PerLevel<
      readonly [number, number] | null
    >,
    lifeMs: 340,
    /** Where along the tower top a splash may land (share of its width). */
    spanShare: [0.08, 0.92] as readonly [number, number],
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
  /** Share of the particles (unless a kind says otherwise) that start in the side strips (the tower hides the middle), and the strip width as share of the screen. */
  sideBias: 0.8,
  sideShare: 0.3,

  /** Motion and look of each kind of falling thing (px, px/s, ms). */
  rain: {
    frames: ['drop'],
    speed: [1500, 1900],
    slant: 0.22,
    alpha: [0.6, 0.75],
    scale: [0.85, 1.1],
    count: 37,
  },
  storm: {
    frames: ['drop'],
    speed: [1900, 2400],
    slant: 0.38,
    alpha: [0.6, 0.75],
    scale: [0.95, 1.15],
    count: 37,
  },
  snow: {
    frames: ['flake'],
    speed: [90, 190],
    swayPx: [22, 60],
    swayMs: [3200, 6500],
    alpha: [0.9, 1],
    scale: [1, 1],
    /** Cumulative chance of each flake picture but the last (small disc, middle disc, soft disc); the rest are the six-ray flake. */
    sizeCuts: [0.42, 0.84, 0.92] as readonly number[],
    /** No two flakes start closer than this (px of the 1080-wide logical screen, `gapRefHeight` tall), so they do not stick in pairs. */
    minGapPx: 130,
    gapRefHeight: 2340,
    /** The flakes keep to the side strips and the open sky: few hide behind the tower. */
    sideBias: 0.95,
    /** The open sky beside the tower is about this share of the width on each side (the tower hides the rest). */
    sideShare: 0.17,
    /** Snow is slow and big: its fades are short, so more of the flakes show (the HUD gap itself stays). */
    bandFeatherPx: 30,
    keepOutFeatherPx: 12,
    endFeatherPx: 30,
    count: 40,
  },
  leaves: {
    frames: ['leaf'],
    speed: [120, 210],
    swayPx: [70, 150],
    swayMs: [2600, 4800],
    spinMs: [2400, 5200],
    tiltRad: 0.9,
    /** The sway of the tilt lags the sway of the position by this many radians. */
    swayLag: 1.2,
    /** A turning leaf is this share of its height at its thinnest. */
    turnMin: 0.55,
    alpha: [0.92, 1],
    scale: [0.9, 1.25],
    count: 26,
  },

  /** Rain and storm cloud bank at the top of the sky: three rows of round puffs, the front ones over the back ones. */
  bank: {
    /** Picture size, and the scale it is shown at (it is wider than the screen so it can drift). */
    width: 1024,
    height: 256,
    scale: 1.27,
    driftPx: 60,
    driftMs: 26000,
    /** Colours of the bank: close to the sky at the top (low contrast), the storm a little darker. */
    colorRain: 0x6e7890,
    colorStorm: 0x4a5266,
    /** The pale top of every puff (the bank colour mixed with this by `lightMix`): paler and colder in a storm. */
    lightRain: 0xd2dcf2,
    lightStorm: 0xa6b4e0,
    lightMix: 0.62,
    /** Tone shifts (-1..1 towards black / white): the back row is darker, the front row lighter; the lower rim of every puff is `bellyShade` darker. */
    rowShade: [-0.06, 0, 0.03] as readonly [number, number, number],
    bellyShade: -0.22,
    /** Outline round the whole bank, and nowhere inside it (px), in a shade of the bank colour. */
    outlinePx: 3.4,
    /** A thin seam in the belly tone along the top of the puffs marked with a 1 (the fifth number), so a couple of front puffs read as lying over the rest. */
    seamPx: 2.6,
    /** Per row (the puffs of a row are drawn as one mass): a pale crescent this thick (px) lies along the top and a darker belly this thick along the bottom. */
    topLightPx: 11,
    bellyPx: 12,
    /** A flat strip along the top edge between these x that closes the gaps between the back puffs (picture px). At the sides the bank starts lower, so the pause button and the coins sit on sky and the pale top. */
    topStripPx: 40,
    stripFrom: 320,
    stripTo: 720,
    /** In a storm the lower rows hang this much lower, as a share of the puff radius (times the row: 0 back, 0.5 middle, 1 front). */
    stormHang: 0.3,
    /**
     * The puffs: row (0 back, 1 middle, 2 front), centre x, centre y, radius (picture px). The middle of the
     * bank (behind the score) is a single low row of small puffs, so only its light top goes under the HUD; the
     * sides are deep, with puffs of different sizes at different depths and no regular teeth.
     */
    puffs: [
      [0, -20, 150, 60],
      [0, 60, 147, 58],
      [0, 150, 149, 60],
      [0, 265, 78, 60],
      [0, 335, 34, 52],
      [0, 415, 10, 46],
      [0, 500, 12, 48],
      [0, 585, 8, 44],
      [0, 665, 20, 50],
      [0, 745, 121, 50],
      [0, 830, 145, 52],
      [0, 925, 143, 54],
      [0, 1010, 150, 60],
      [1, 35, 155, 60],
      [1, 130, 155, 56],
      [1, 222, 155, 56],
      [1, 735, 130, 50],
      [1, 820, 157, 54],
      [1, 905, 155, 60],
      [1, 995, 163, 56],
      [2, 60, 168, 58, 0],
      [2, 150, 156, 46, 1],
      [2, 235, 148, 50, 0],
      [2, 790, 134, 38, 0],
      [2, 865, 162, 58, 1],
      [2, 955, 158, 46, 1],
    ] as ReadonlyArray<readonly [number, number, number, number, number?]>,
    /**
     * The flash: ONE soft warm patch over the lit part of the cloud, centred on where the bolt stands (one
     * picture for a bolt on the left, one for the right; picture px), strongest at its centre, fading to nothing
     * at `flashRadiusPx`. It only lies on the clouds (the picture is cut to the bank) and is a little brighter
     * towards the edges of the puffs, `flashCoreShare` being how bright it is deep inside a mass. Drawn additively.
     */
    flashColor: 0xffe6a0,
    flashSpots: [
      { x: 285, y: 100 },
      { x: 707, y: 95 },
    ] as ReadonlyArray<{ x: number; y: number }>,
    flashRadiusPx: 210,
    flashCoreShare: 0.6,
    /** How bright the flash is on each row of puffs (back, middle, front): the front puffs stay dimmer, so the light comes from the bolt and not from a ball. */
    flashRowShare: [1, 1, 0.6] as readonly [number, number, number],
    /** How far (px) the brighter rim reaches into a mass: it falls off as exp(-depth / this). */
    flashReachPx: 34,
  },

  /** Lightning in the cloud bank of a storm. */
  lightning: {
    firstMs: [3000, 6000],
    everyMs: [8000, 15000],
    flashMs: [120, 180],
    /** Share of a flash over which it rises to its peak; it falls over the rest. */
    riseShare: 0.2,
    /** Alpha of the lit bank at the peak. */
    flashAlpha: 0.85,
    /** The bolt stands in one of these x ranges (share of the screen width): between the pause button and the score, and between the score and the coins. */
    xRanges: [
      [0.2, 0.28],
      [0.71, 0.745],
    ] as ReadonlyArray<readonly [number, number]>,
    /** Picture size, and the width of its outline, glow and core strokes (picture px). */
    width: 168,
    height: 240,
    rimPx: 26,
    midPx: 17,
    corePx: 8,
    /** The bolt starts this share of the cloud's height down at that x, is this share of it long (so it may come out of the cloud's lower edge by a few percent of its length). */
    topShare: 0.12,
    lengthShare: 0.95,
    /** Half the bolt's width for the HUD gap, as a share of its picture width times its scale. */
    hudHalfShare: 0.25,
    /** A bolt shorter than this share of the picture height is not shown. */
    minLengthShare: 0.25,
    /** The cloud must be at least this tall (px) at the strike point, and the strike point is drawn up to this many times to clear the HUD. */
    minCloudPx: 150,
    tries: 16,
  },

  /** Stars and the crescent moon of the night (both stand in the sky, drawn over the four parallax layers). */
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
