import type { StartPlaceId } from './start-places';
import type { WeatherId } from './weather';

/** What is seen through a window for each weather (docs/06, section 5, «Погода»). Colours are muted: the tower is the brightest thing. */
export interface WindowSky {
  top: number;
  bottom: number;
  /** Cloud colour; `null` for a sky without clouds (night). */
  cloud: number | null;
  /** A bigger, lower cloud bank that fills the top of the glass (rain, storm). */
  heavy: boolean;
  moon: boolean;
  stars: boolean;
}

export const WINDOW_SKY: Record<WeatherId, WindowSky> = {
  clear: {
    top: 0x9ed6f7,
    bottom: 0xe6f6fc,
    cloud: 0xffffff,
    heavy: false,
    moon: false,
    stars: false,
  },
  sunset: {
    top: 0xee9fb4,
    bottom: 0xffd3a6,
    cloud: 0xffe6d6,
    heavy: false,
    moon: false,
    stars: false,
  },
  night: { top: 0x232b5e, bottom: 0x464e98, cloud: null, heavy: false, moon: true, stars: true },
  rain: {
    top: 0x8d9cb0,
    bottom: 0xc4cdd9,
    cloud: 0x76849a,
    heavy: true,
    moon: false,
    stars: false,
  },
  snow: {
    top: 0xc9cae0,
    bottom: 0xeeeff8,
    cloud: 0xffffff,
    heavy: false,
    moon: false,
    stars: false,
  },
  leaves: {
    top: 0xf0c286,
    bottom: 0xffe7bb,
    cloud: 0xfff3de,
    heavy: false,
    moon: false,
    stars: false,
  },
  storm: {
    top: 0x4c5469,
    bottom: 0x747e92,
    cloud: 0x3a4153,
    heavy: true,
    moon: false,
    stars: false,
  },
};

/** The street of the Showcase zone for each weather: buildings, their lit windows and the pane frame. */
export interface StreetLook {
  building: number;
  buildingWindow: number;
  frame: number;
}

export const STREET_LOOK: Record<WeatherId, StreetLook> = {
  clear: { building: 0xb4daf3, buildingWindow: 0xe9f7ff, frame: 0xffffff },
  sunset: { building: 0xe6aebd, buildingWindow: 0xfff0d2, frame: 0xfff3ee },
  night: { building: 0x323a7c, buildingWindow: 0xffd98c, frame: 0x9aa2d2 },
  rain: { building: 0x9fadbf, buildingWindow: 0xdfe6ee, frame: 0xe8edf3 },
  snow: { building: 0xd3d4e6, buildingWindow: 0xf6f6fc, frame: 0xffffff },
  leaves: { building: 0xe9bd8f, buildingWindow: 0xfff0d2, frame: 0xfff6ea },
  storm: { building: 0x5c657d, buildingWindow: 0xaab4c7, frame: 0xc3cad8 },
};

/** Sizes of the baked window pictures; the canvas holds the frame, the sill and (kitchen) the valance. */
export const WINDOW_LOOK = {
  width: 180,
  height: 250,
  /** Glass inside the canvas. */
  glass: { x: 30, y: 36, w: 120, h: 172 },
  /** Centre of the window as shares of the screen; the offset is in logical px. */
  kitchen: { at: { x: 1, y: 0.54 }, offset: { x: -132, y: 0 } },
  shop: { at: { x: 0, y: 0.52 }, offset: { x: 132, y: 0 } },
  colors: {
    kitchen: {
      frame: 0xd9a070,
      valance: 0xfff0e0,
      valanceOutline: 0x9a5a38,
      valanceStripe: 0xf6b8a0,
    },
    shop: {
      frame: 0xf4a3bd,
      ring: 0xfff1e6,
    },
  },
  /** The window breathes a little, so nothing in the room stands still (docs/06, section 5). */
  pulse: { amount: 0.008, ms: 2100 },
  /** Slanted bands of light on the glass: x, width, lean (px) and alpha. */
  glints: [
    { x: 0.2, w: 0.14, lean: -0.22, alpha: 0.2 },
    { x: 0.55, w: 0.07, lean: -0.22, alpha: 0.16 },
  ],
} as const;

/** What moves on the glass: drops, flakes, a leaf; counts are per picture. */
export interface GlassWeather {
  item: 'drop' | 'flake' | 'leaf';
  /** On a window of a start place. */
  window: number;
  /** Across the Showcase panes (they sit in two bands at the sides of the tower). */
  showcase: number;
  periodMs: readonly [number, number];
}

export const GLASS_WEATHER: Partial<Record<WeatherId, GlassWeather>> = {
  rain: { item: 'drop', window: 7, showcase: 7, periodMs: [11000, 17000] },
  storm: { item: 'drop', window: 10, showcase: 10, periodMs: [7000, 11000] },
  snow: { item: 'flake', window: 11, showcase: 9, periodMs: [12000, 19000] },
  leaves: { item: 'leaf', window: 3, showcase: 3, periodMs: [15000, 21000] },
};

/** The pictures that move on the glass, all on the shared atlas (one key per kind, baked for the weather of the run). */
export const GLASS_TEX = {
  drop: 'bd_win_drop',
  flake: 'bd_win_flake',
  leaf: 'bd_win_leaf',
} as const;

export const GLASS_LOOK = {
  drop: { w: 16, h: 26, color: 0xdbeaf7, dark: 0x7d93ad },
  flake: { size: 18 },
  leaf: { w: 46, h: 30, color: 0xffffff, dark: 0x8a6a58, tints: [0xe58a3c, 0xd2543a, 0xe9b43c] },
  /** Share of the cycle over which an item fades in and out. */
  fadeShare: 0.1,
  /** The sway of a flake or a leaf: share of the glass width, and its period (ms). */
  sway: {
    flake: { share: 0.07, ms: 3600, phaseStep: 0.17 },
    leaf: { share: 0.16, ms: 4200, phaseStep: 0.29, turnRad: 0.9, spinTurns: 0.4 },
  },
  /** How the items of one picture differ: period spread, phase and size steps per item index. */
  motion: {
    laneShift: 0.2,
    periodStep: 0.37,
    periodShift: 0.11,
    phaseShift: 0.1,
    sizeBase: 0.85,
    sizeSpread: 0.3,
    sizeStep: 0.61,
  },
  /** Share of the glass an item may use, from the outer edge (the tower hides the inner part): `[from, to]` of the width, per place. */
  windowSpan: { kitchen: [0.15, 1], shop: [0, 0.85] },
  /** Items keep this share of the glass away from its edges. */
  margin: 0.1,
  /** Showcase: items fade this far (px) before the clear band and the HUD floor. */
  bandFadePx: 40,
  /** Showcase: the two bands (logical px from each screen edge to the near and far side) and the lowest share of the height. */
  /** The things on the wide Showcase panes are drawn this much bigger than on a window. */
  showcaseSize: 1.6,
  showcaseBands: { near: 24, far: 190, lowest: 0.86 },
} as const;

/** Keys of the baked window pictures, one per place and weather of the run. */
export function windowKey(place: StartPlaceId, weather: WeatherId): string {
  return `bd_win_${place}_${weather}`;
}

/** The shop of the start place (docs/06, «Места старта»): pink-cream palette, striped awning, sweets on the shelves. */
export const SHOP_COLORS = {
  skyTop: 0xffe8ee,
  skyBottom: 0xffd5e0,
  stripe: 0xfff4e8,
  ring: 0xf3a8c0,
  shelf: 0xe8b89a,
  awningPink: 0xf6c3d0,
  awningCream: 0xfceaec,
  silhouette: 0xeaa8bd,
  sweets: {
    macaron: [0xf7a8c4, 0xc9b4f0, 0xa8dcc8, 0xffd48a],
    cream: 0xfff3e6,
    candy: [0xff9db8, 0x9edcc0, 0xffd77a],
    cake: 0xf3c9a0,
    glaze: 0xffb6cb,
  },
} as const;

export const SHOP_TEX = {
  wall: 'bd_shop_wall',
  lattice: 'bd_shop_lattice',
  shelves: 'bd_shop_shelves',
  stands: 'bd_shop_stands',
  awning: 'bd_win_shop_awning',
  lamp: 'bd_win_shop_lamp',
  sweets: 'bd_win_shop_sweets',
  display: 'bd_win_shop_display',
  sky: 'bd_sky_shop',
} as const;

export const SHOP_LOOK = {
  tile: 512,
  /** The boards of the wall (512 tile; `plank` px from the top, see `KITCHEN_SHELF`). */
  plank: 110,
  /** The sweets stand on a bracket in the right outer column, below the row of the flying layer. */
  sweets: {
    at: { x: 0.915, y: 0.72 },
    board: 150,
    /** Share the sweets' colours lean towards the wall. */
    mute: 0.35,
    items: [
      { x: -34, kind: 'candy', size: 36 },
      { x: 36, kind: 'macaron', size: 76 },
    ],
  },
  /**
   * The glass-front counter with four sweets in the left outer column, under the window and clear of the tower
   * (`at` is the centre as shares of the screen, `offset` in logical px). It is shown only on screens at least
   * `minHeight` tall: on a short screen it is left out, not shrunk. It breathes like the window.
   */
  display: {
    /** The picture is drawn on a 56x104 grid and baked `unit` times bigger. */
    w: 56,
    h: 104,
    unit: 2.7,
    at: { x: 0, y: 0.72 },
    offset: { x: 83, y: 0 },
    minHeight: 2000,
    /** Share the colours lean towards the wall, so the counter stays quieter than the tower. */
    mute: 0.3,
    glass: 0xe4f1f4,
    glassAlpha: 0.5,
    wood: 0xe8b89a,
    cap: 0xf3a8c0,
    cake: { glaze: 0xffb6cb, cherry: 0xe86a7e },
    cupcake: { liner: 0xc9b4f0, frosting: 0xffe0a8 },
    donut: { dough: 0xf3c9a0, icing: 0xa8dcc8 },
    jar: { glass: 0xfff3e6, candies: [0xff9db8, 0x9edcc0, 0xffd77a] },
    bob: { px: 5, ms: 2300 },
  },
  /** Stand silhouettes: x in the 512 tile. */
  standsX: [70, 250],
  /** The awning is `count` strips that bob `bobPx` over `bobMs`, each `phaseStep` radians behind the last. */
  awning: {
    height: 60,
    stripe: 64,
    count: 3,
    bobPx: 2,
    bobMs: 2600,
    phaseStep: 0.5,
  },
  /** Share of its brightness the awning loses at night. */
  awningNightDim: 0.15,
  lamp: {
    width: 60,
    height: 150,
    cord: 86,
    globe: 26,
    /** Each lamp: x as a share of the screen, extra px it hangs under the awning (they differ in height) and its swing period. */
    items: [
      { x: 0.26, drop: 0, ms: 2300 },
      { x: 0.76, drop: 44, ms: 2700 },
    ],
    /** The cord starts this many px up inside the awning; the lamps are drawn smaller than the picture. */
    tuckPx: 8,
    scale: 0.75,
    swingDeg: 4,
    phaseStep: 1.3,
  },
  /** Alpha of the wash that tints the far silhouettes of the wall pink. */
  farWash: 0.72,
} as const;

/**
 * The shelves of the home kitchen are bare boards (512 tile, the board `plank` px from the top: with the camera
 * of layers 1-10 no board comes within 40 px of the next-creature chip on 390x844 and 390x693). The jar stands
 * on its own bracket in the right outer column, below the row of the flying layer.
 */
export const KITCHEN_SHELF = {
  plank: 110,
  /** Jar picture on its bracket; `at` is the centre as shares of the screen, `offset` in logical px. */
  jar: { w: 52, h: 112, color: 0xe58fa0, mute: 0.5, board: 150, at: { x: 0.915, y: 0.72 } },
} as const;

/** The Showcase awning in the weather: stripes lean towards the sky of the weather; at night the layer is also opaque, so house windows do not show through. */
export const AWNING_WEATHER: Partial<Record<WeatherId, { mute: number; alpha?: number }>> = {
  night: { mute: 0.65, alpha: 1 },
  rain: { mute: 0.3 },
  storm: { mute: 0.3 },
};
