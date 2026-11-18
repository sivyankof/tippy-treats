import type { StartPlaceId } from './start-places';
import type { WeatherId } from './weather';
import { FLIGHT_CLEAR } from './flight-clear';

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

/**
 * Everything that hangs on the wall or stands in the room of a start place rides with the wall that carries the shelves
 * (docs/06, «Места старта»). The first copy stands where it did on the start view; further copies repeat on the wall
 * above it. Distances are in screens (shares of the screen height).
 */
export const WALL_LOOK = {
  /** The parallax layer of the wall with the shelves (index into `ANIM.parallax` and `BACKDROP.drift`). */
  layer: 2,
  /** The window: one copy per `spacing` screens, right and left of the tower in turn, from a pool built with the zone. */
  window: { firstGap: 1.3, spacing: 1.3, pool: 2 },
  /** The jar and the sweets bracket: one copy per 2.6 screens, midway between two windows (never next to one). */
  jar: { firstGap: 1.95, spacing: 2.6, pool: 2 },
  sweets: { firstGap: 1.95, spacing: 2.6, pool: 2 },
  /** The glass counter of the shop: midway between two windows, a screen and a third after the sweets. */
  display: { firstGap: 3.25, spacing: 2.6, pool: 2 },
  /** Things passing under a HUD plate or through the flight row keep this share of their alpha; it comes back over `featherPx`. */
  muted: 0.5,
  featherPx: 80,
  /** The mute grows over this much scroll (px of the wall), so the start view stands as drawn. */
  muteRampPx: 150,
  /** A fitted thing (the panoramic window) the tower has covered completely for this long (ms) is gone for good and frees its pictures. */
  retireAfterMs: 3000,
  /** A copy this far (px) beyond the screen edge, past its own half height, is only hidden. */
  offscreenSlackPx: 40,
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
    /** Free pixels above the tallest sweet inside its picture, so its outline is never cut. */
    edgePx: 3,
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
    /** Outline of the glass walls: a dark pinkish-brown, like the other outlines of the shop (not grey). */
    caseOutline: 0xb89090,
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
  /**
   * The awning and the lamps are the top of the room on the start view and fade out as the wall carries them down:
   * fully gone once their lowest point would stand `clearPx` above the top of the wobble plate (`shop-hang.ts`).
   * The zone's first frame is the world still dropping in (`ANIM.ui.transition.distance`); the view the player sees
   * has the wall `distance` x parallax lower, and the fade starts there, `settlePx` further (the drop-in overshoots).
   */
  hang: { clearPx: 40, settlePx: 6 },
  /** Share of its brightness the awning loses at night. */
  awningNightDim: 0.15,
  lamp: {
    width: 60,
    height: 150,
    cord: 86,
    globe: 26,
    /** The flat warm rim ring round the globe (one opaque tone, no soft glow): gap from the globe and ring width, px. */
    rim: { gap: 4, width: 4.4, color: 0xffe9a8 },
    /** Each lamp: x as a share of the screen, extra px it hangs under the awning (they differ in height) and its swing period. */
    items: [
      { x: 0.26, drop: 0, ms: 2300 },
      { x: 0.76, drop: 32, ms: 2700 },
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

/**
 * The panoramic window of the start view (docs/06, «Панорамное окно»): one wide window above the tower, in the wall's layer.
 * It is baked at `width` x `height` on the shared atlas (an own texture cost two draw calls: it broke the atlas batch twice,
 * see docs/08) and drawn smaller on a short screen; where it would be smaller than `minScale` the old small window stays.
 */
export const PANORAMA = {
  width: 640,
  height: 640,
  /** Glass inside the picture. */
  glass: { x: 64, y: 72, w: 512, h: 456 },
  /**
   * The picture is baked at `bakeScale` of its drawn size (the layers of the game are baked at 2/3 of theirs) and cut into
   * `cols` x `rows` pieces, each its own cell of the shared atlas, edge to edge (no overlap: a muted window would show the
   * doubled pixels as lines). One 640 px tall cell took a 648 px shelf of the page (0.09-0.13 of its peak); strips as wide
   * as the picture wasted the height of the shelves they stood in; pieces about 145 px square fit the 160 px shelves of
   * the layer pictures, which have room for three (docs/08, journal).
   */
  pieces: { cols: 3, rows: 3 },
  bakeScale: 2 / 3,
  /** Each piece is drawn this many px bigger (half of it on every side): the pieces overlap, so no seam line shows at a fractional position. */
  seamPx: 1.5,
  /** Frame outline and the width of the frame around the glass. */
  outlinePx: 6,
  framePx: 34,
  /** Sill under the glass: gap from the glass, height. */
  sill: { gap: 24, height: 52 },
  /** Arched top of the shop window: height of the arch. */
  archPx: 120,
  barPx: 16,
  /** Vertical bar at the middle, horizontal bar at this share of the glass height. */
  crossAt: 0.6,
  valance: { top: 46, band: 54, scallops: 8 },
  /** Layout on the start view: the tower of the start view, the gap under the HUD (`hudFloor`) and above the flying layer. */
  layout: { towerLayers: 2, flightGapPx: 24, reachExtraPx: 30, minScale: 0.6, centreShare: 0.5 },
  /**
   * The window goes behind the tower: it fades out while this share of its height (from the top) still stands above the
   * tower top, to nothing at `goneAt` (the middle of the glass is at 0.47, so the window is gone before the tower reaches
   * it). The tower top jumps by a layer when one lands, so the fade follows its target over time: the whole way in `easeMs`.
   */
  cover: { fullAt: 0.8, goneAt: 0.5, easeMs: 320 },
  /** Alpha of the whole window while the incoming layer flies in front of it (a partial mute would need a second draw). */
  rowMuted: 0.85,
  /** The mute follows the row (which jumps by a layer on a landing) over time: from none to full in this many ms. */
  rowEaseMs: 200,
  /**
   * The moon of the night window, a picture of its own over the glass: it fades out while the window fades from 1 to
   * `goneAt`, and has `mutedAlpha` of its alpha while the flight row passes in front of the moon itself (on 390x693 the
   * row touches the bottom of the window already on the start view, so the mute of the whole window would hide it there).
   */
  moon: { goneAt: 0.6, mutedAlpha: 0 },
  /** The mute fades in over this many px before the row reaches the window: the start view, where the row stands 50 px or more below it, is not muted. */
  rowFeatherPx: 24,
  /** Drops, flakes and leaves of the pane: counts per weather (the lite level shows half), size against the small window's. */
  items: { rain: 12, storm: 16, snow: 14, leaves: 5, size: 1.5 },
  /**
   * The storm flash in the glass: peak alpha of the picture, colour; the texture is baked this much smaller than the glass.
   * Inside the picture the sky is lit to `skyAlpha`, the storm clouds to `cloudAlpha`; the sash bars are cut out. The bolt
   * (the sky bolt's shape and colours) stands in the upper right pane: its top under the right cloud at `x`, `top` (shares
   * of the glass), `height` of the glass tall, its strokes `scale` of the sky bolt's.
   */
  flash: {
    alpha: 1,
    color: 0xf6f9ff,
    bakeShare: 1 / 3,
    skyAlpha: 0.5,
    cloudAlpha: 0.85,
    bolt: { x: 0.74, top: 0.1, height: 0.44, scale: 0.9 },
  },
  /** Gap kept to the HUD plates (the same as the flying layer's). */
  hudGapPx: FLIGHT_CLEAR.hudGapPx,
} as const;

/** Key of the baked panoramic window of a place and weather, and of the glass-shaped flash of its storm. */
export function panoramaKey(place: StartPlaceId, weather: WeatherId): string {
  return `bd_win_pano_${place}_${weather}`;
}

/**
 * One piece of the panoramic window: its rectangle in the baked picture (baked px) and the offset of its centre from the
 * picture's centre in drawn px (the units the window is laid out in).
 */
export interface PanoramaPiece {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centreX: number;
  centreY: number;
}

export function panoramaPieces(place: StartPlaceId, weather: WeatherId): PanoramaPiece[] {
  const { pieces, width, height, bakeScale } = PANORAMA;
  const bakedW = Math.round(width * bakeScale);
  const bakedH = Math.round(height * bakeScale);
  const stepX = Math.ceil(bakedW / pieces.cols);
  const stepY = Math.ceil(bakedH / pieces.rows);
  const out: PanoramaPiece[] = [];
  for (let r = 0; r < pieces.rows; r++) {
    for (let c = 0; c < pieces.cols; c++) {
      const x = c * stepX;
      const y = r * stepY;
      const w = Math.min(stepX, bakedW - x);
      const h = Math.min(stepY, bakedH - y);
      out.push({
        key: `${panoramaKey(place, weather)}_p${r}${c}`,
        x,
        y,
        width: w,
        height: h,
        centreX: (x + w / 2 - bakedW / 2) / bakeScale,
        centreY: (y + h / 2 - bakedH / 2) / bakeScale,
      });
    }
  }
  return out;
}

export function panoramaMoonKey(place: StartPlaceId): string {
  return `bd_win_pano_moon_${place}`;
}

export function panoramaFlashKey(place: StartPlaceId): string {
  return `bd_win_pano_flash_${place}`;
}
