/**
 * Rare guests of Space (docs/06, section 5, "Редкие гости Космоса"): once in several runs one
 * object crosses the screen behind the tower. Decoration only; the run never knows about it.
 */

export const SPACE_VISITOR_IDS = ['eclair', 'saucer', 'teapot', 'comet'] as const;
export type SpaceVisitorId = (typeof SPACE_VISITOR_IDS)[number];

export function isSpaceVisitorId(value: string | null): value is SpaceVisitorId {
  return SPACE_VISITOR_IDS.some((id) => id === value);
}

/** How a guest moves while it crosses. */
export interface VisitorFlight {
  /** Seconds-long pass: the range of the time it takes to cross from edge to edge. */
  durationMs: readonly [number, number];
  /** Slow up-and-down sway, px and period. */
  bob: { px: number; ms: number };
  /** Gentle rocking, degrees and period. */
  rock: { deg: number; ms: number };
  /** The guest also drops this many px while it crosses (a comet falls along a slope). */
  slopePx: number;
  /** Tilts the picture along the slope of its path. */
  alongPath: boolean;
}

export interface VisitorSpec {
  texture: string;
  /** Picture size in px (the picture looks to the right). */
  width: number;
  height: number;
  /** Share of the passes this guest takes among the rare ones. */
  weight: number;
  flight: VisitorFlight;
}

export const SPACE_VISITOR = {
  /** Thickness of the warm outline of every part, in picture px (the layers' share of their height, kept thick at this size). */
  outlinePx: 9,
  /** Chance that a run gets a guest at all (decided once, when the Space backdrop is built). */
  chancePerRun: 0.25,
  /** Wait after the Space backdrop appears before the pass starts. */
  delayMs: [6000, 26000],
  /** With `?spaceGuest=` the pass starts this soon. */
  forcedDelayMs: 800,
  /**
   * The flight band is the free stripe of the screen between the HUD (its lowest edge) and the row
   * of the flying layer, `bandPadPx` clear of each. A guest taller than the stripe (with its sway
   * and slope) is drawn smaller; where it would need to be under `minFitScale` (a short screen)
   * the run gets no guest.
   */
  bandPadPx: 24,
  /** A guest that does not fit above the flying row's clear stripe passes below it, behind the tower top, in a lane this deep. */
  belowDepthPx: 420,
  minFitScale: 0.55,
  /** The background satellite and comet wait from this share of the pass before it starts to this share after it ends. */
  holdLead: 0.03,
  /** Share of the picture that sticks out past each screen edge when the pass begins and ends. */
  offscreenShare: 0.6,
  /** The guest fades in and out over this share of the pass at each end (the edges are off-screen anyway). */
  fadeEdge: 0.04,
  guests: {
    eclair: {
      texture: 'bd_sv_eclair',
      width: 320,
      height: 190,
      weight: 1,
      flight: {
        durationMs: [11000, 14000],
        bob: { px: 10, ms: 1500 },
        rock: { deg: 2, ms: 1100 },
        slopePx: 0,
        alongPath: false,
      },
    },
    saucer: {
      texture: 'bd_sv_saucer',
      width: 280,
      height: 300,
      weight: 1,
      flight: {
        durationMs: [12000, 15000],
        bob: { px: 18, ms: 2300 },
        rock: { deg: 4, ms: 1900 },
        slopePx: 0,
        alongPath: false,
      },
    },
    teapot: {
      texture: 'bd_sv_teapot',
      width: 250,
      height: 220,
      weight: 1,
      flight: {
        durationMs: [15000, 19000],
        bob: { px: 8, ms: 3200 },
        rock: { deg: 8, ms: 2600 },
        slopePx: 0,
        alongPath: false,
      },
    },
    comet: {
      texture: 'bd_sv_comet',
      width: 340,
      height: 150,
      weight: 1,
      flight: {
        durationMs: [4200, 5200],
        bob: { px: 0, ms: 1000 },
        rock: { deg: 0, ms: 1000 },
        slopePx: 90,
        alongPath: true,
      },
    },
  } satisfies Record<SpaceVisitorId, VisitorSpec>,
} as const;

/** Colours of the guests (flat fills; each gets the warm dark outline of its own tone). */
export const SPACE_VISITOR_COLORS = {
  pastry: 0xe8b070,
  glaze: 0x7a4026,
  cream: 0xfff1c9,
  donut: 0xff8fb8,
  donutHole: 0x3a2347,
  sprinkles: [0xffffff, 0xffe27a, 0x7cd8ff, 0x9af0a8],
  creature: 0x8fe0a8,
  creatureEye: 0x2a1a3a,
  glass: 0xdff6ff,
  glassStroke: 0x5a4a7a,
  headlight: 0xffe27a,
  gloss: 0xffffff,
  liner: 0x5ca8ff,
  linerStripe: 0x3f86e0,
  frosting: 0xff9ec8,
  frostingLight: 0xffc4de,
  /** The beam: two flat warm tones, the outer wide and the inner narrow. */
  beam: 0xffc95c,
  beamCore: 0xffe9a0,
  beamAlpha: 0.7,
  /** Outlines of the pale fills, a dark warm tone of their own colour (the generic shade turns grey on them). */
  porcelainOutline: 0x8a5a3c,
  silverOutline: 0x5a5f86,
  creamOutline: 0xa0703c,
  linerOutline: 0x1f4a99,
  beacon: 0xff4c4c,
  porcelain: 0xfff0e0,
  porcelainPattern: 0x5c7cff,
  silver: 0xd8dde6,
  caramel: 0xe39a2d,
  caramelDark: 0xc27a1c,
  wrapper: 0xffd27a,
  sugar: 0xffffff,
  sugarShade: 0xdcebff,
} as const;
