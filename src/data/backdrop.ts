import type { ZoneId } from './zones';

/** Texture keys of the pictures baked for the backdrops. Shared by the art code and the life data. */
export const BD_TEX = {
  puff: 'bd_puff',
  star: 'bd_star4',
  kitchen: {
    wallpaper: 'bd_k_wallpaper',
    tiles: 'bd_k_tiles',
    shelves: 'bd_k_shelves',
    utensils: 'bd_k_utensils',
    pot: 'bd_k_pot',
    lid: 'bd_k_lid',
    ladle: 'bd_k_ladle',
    rail: 'bd_k_rail',
    clock: 'bd_k_clock',
    hand: 'bd_k_hand',
    pendulum: 'bd_k_pendulum',
    fly: 'bd_k_fly',
    mug: 'bd_k_mug',
    sheen: 'bd_k_sheen',
  },
  showcase: {
    street: 'bd_s_street',
    panes: 'bd_s_panes',
    treats: 'bd_s_treats',
    awning: 'bd_s_awning',
    bulb: 'bd_s_bulb',
    wire: 'bd_s_wire',
    walker: 'bd_s_walker',
    stand: 'bd_s_stand',
    cake: 'bd_s_cake',
    sprinkle: 'bd_s_sprinkle',
  },
  roof: {
    far: 'bd_r_far',
    mid: 'bd_r_mid',
    near: 'bd_r_near',
    pipes: 'bd_r_pipes',
    bird: 'bd_r_bird',
    chimney: 'bd_r_chimney',
    rope: 'bd_r_rope',
    shirt: 'bd_r_shirt',
    sock: 'bd_r_sock',
    sheet: 'bd_r_sheet',
  },
  clouds: {
    far: 'bd_c_far',
    mid: 'bd_c_mid',
    near: 'bd_c_near',
    haze: 'bd_c_haze',
    balloon: 'bd_c_balloon',
    plane: 'bd_c_plane',
  },
  stars: {
    dust: 'bd_t_dust',
    mid: 'bd_t_mid',
    sparkles: 'bd_t_sparkles',
    glow: 'bd_t_glow',
    shooting: 'bd_t_shooting',
    moon: 'bd_t_moon',
    eye: 'bd_t_eye',
  },
  space: {
    dust: 'bd_p_dust',
    nebula: 'bd_p_nebula',
    nebulaTwo: 'bd_p_nebula2',
    sparkles: 'bd_p_sparkles',
    planetA: 'bd_p_planet_a',
    planetB: 'bd_p_planet_b',
    satellite: 'bd_p_satellite',
    comet: 'bd_p_comet',
  },
} as const;

/** Numbers of the zone backdrops; colours are in `backdrop-colors.ts`, life in `backdrop-life.ts`. */
export const BACKDROP = {
  /** The old zone flows into the new one over this long (docs/06, "Смена зоны"). */
  fadeMs: 1500,
  /** The pictures of the next zone are baked this long after a zone starts, so a change does not hitch. */
  prepareDelayMs: 800,
  /** The sky is a thin strip of `skyBands` rows stretched over the screen (the filter blends the rows). */
  skyBands: 64,
  skyBandHeight: 4,
  skyWidth: 4,
  /** The sky picture is a bit larger than the screen so its slow breathing never shows an edge. */
  skyOverscan: 1.06,
  skyBreathe: { amount: 0.012, periodMs: 1800 },
  /** Side of the square parallax tile pictures. */
  tile: 512,
  /** Zone scenery draws between the base of the background and the counter. */
  depthBase: 0.5,
  depthStep: 0.4,
  /**
   * Sideways drift of the four parallax layers in px/s (back to front). Every zone has one
   * wind: all layers move the same way (a positive value slides the picture to the left) and
   * the nearer the layer, the faster it goes, so the layers read as depth and never shear.
   * Walls and buildings stay slow; they only need to never stand still.
   */
  drift: {
    kitchen: [2, 3, 5, 8],
    showcase: [3, 4, 7, 11],
    roof: [3, 5, 8, 12],
    clouds: [8, 14, 24, 40],
    stars: [2, 3, 5, 8],
    space: [2, 3, 5, 8],
  } satisfies Record<ZoneId, readonly [number, number, number, number]>,
  /** Alpha of each parallax layer (back to front) per zone. */
  layerAlpha: {
    kitchen: [1, 1, 1, 1],
    showcase: [0.9, 0.55, 0.95, 0.85],
    roof: [0.7, 0.95, 0.95, 0.75],
    clouds: [0.7, 0.8, 0.9, 0.6],
    stars: [0.8, 0.9, 0.9, 0.7],
    space: [0.8, 0.55, 0.5, 0.9],
  } satisfies Record<ZoneId, readonly [number, number, number, number]>,
  /** Colour shift of whole parallax layers (space nebula): `from` to `to` and back every `ms`. */
  layerTint: {
    space: [
      null,
      { from: 0xff5cb8, to: 0x5cc8ff, ms: 22000 },
      { from: 0x7c5cff, to: 0xff9a5c, ms: 31000 },
      null,
    ],
  } as Partial<Record<ZoneId, readonly ({ from: number; to: number; ms: number } | null)[]>>,
} as const;

/** The kitchen counter under the tray: it stays in every zone and has a little life of its own. */
export const COUNTER = {
  topHeight: 40,
  edgeHeight: 8,
  /** The body is a tall rectangle so it never ends above the bottom of the screen. */
  bodyDepth: 6000,
  /** Barely visible breathing of the whole counter (alpha). */
  breathe: { lo: 0.965, hi: 1, periodMs: 1900 },
  /** A soft highlight running along the worktop and resting for `restShare` of each trip. */
  sheen: { width: 240, alpha: 0.5, periodMs: 4600, restShare: 0.25 },
  sheenHeight: 40,
  sheenLayers: 6,
  mug: {
    width: 90,
    height: 100,
    x: 92,
    /** How far the bottom of the mug sinks into the worktop face. */
    sink: 14,
    steam: {
      texture: BD_TEX.puff,
      tint: 0xffffff,
      count: 4,
      riseHeight: 130,
      periodMs: 2600,
      startScale: 0.35,
      endScale: 0.95,
      alpha: 0.6,
      swayPx: 12,
    },
    /** Where the steam leaves the cup, from the centre of the picture. */
    steamOffsetY: -58,
    pulse: { amount: 0.01, ms: 1500 },
  },
} as const;
