import type { HoverSpec } from '../backdrop/backdrop-life';

/** The dessert planets of the Space laps, in the order the laps show them (docs/02, section 8; docs/06, section 5). */
export const SPACE_PLANET_IDS = [
  'marshmallow_moon',
  'cookie',
  'caramel',
  'donut_ring',
  'mint_candy',
  'blueberry_jelly',
  'cinnamon_galaxy',
  'cotton_galaxy',
  'truffle_hole',
] as const;

export type SpacePlanetId = (typeof SPACE_PLANET_IDS)[number];

const PLANET_KEY_PREFIX = 'bd_planet_';

export const planetKey = (id: SpacePlanetId): string => `${PLANET_KEY_PREFIX}${id}`;

/** The muted copy of a planet picture (`PLANET_DIM`): a texture of its own, baked in a step right after the planet. */
export const planetDimKey = (id: SpacePlanetId): string => `${planetKey(id)}_dim`;

/** Colours of one planet: `base` and `shade` are the two flat tones of the body, the rest are its details. */
export interface PlanetColors {
  base: number;
  shade: number;
  detail: number;
  detailShade: number;
  ring?: number;
  ringShade?: number;
}

export const PLANET_COLORS: Record<SpacePlanetId, PlanetColors> = {
  marshmallow_moon: { base: 0xf7ead8, shade: 0xe0c9b4, detail: 0xe8d2bd, detailShade: 0xcdb39d },
  cookie: { base: 0xdca35e, shade: 0xbd7f3f, detail: 0x6a3d22, detailShade: 0x4b2915 },
  caramel: { base: 0xe8963c, shade: 0xc97325, detail: 0xf6bf6e, detailShade: 0xd9892f },
  donut_ring: {
    base: 0xe2b277,
    shade: 0xc08a50,
    detail: 0xff9ec0,
    detailShade: 0xe0709a,
    ring: 0xff9ec0,
    ringShade: 0xe0709a,
  },
  mint_candy: {
    base: 0x86e6c8,
    shade: 0x58c3a6,
    detail: 0xd8fff0,
    detailShade: 0xa6efd6,
    ring: 0xfff4de,
    ringShade: 0xe9d3b0,
  },
  blueberry_jelly: { base: 0x6478e0, shade: 0x4658bc, detail: 0xa9b8ff, detailShade: 0x3a49a0 },
  cinnamon_galaxy: { base: 0xc88a52, shade: 0xa96a38, detail: 0x7d4426, detailShade: 0x5b2f18 },
  cotton_galaxy: { base: 0xf7a6d6, shade: 0xdc82bc, detail: 0x9fd0ff, detailShade: 0x78aee8 },
  truffle_hole: {
    base: 0x7a4a36,
    shade: 0x58321f,
    detail: 0xa5705a,
    detailShade: 0x3d2114,
    ring: 0xf2ae4a,
    ringShade: 0xd48a2a,
  },
};

/** Size and look numbers of the planet pictures (px at the logical screen size). */
export const PLANET_LOOK = {
  /** Radius of the body. */
  radius: 190,
  /** Share of the sky colour mixed into every colour of the planet, so it stays below the tower in contrast. */
  muteShare: 0.4,
  /** The sky colour that mix leans towards (the middle of the Space sky). */
  muteTo: 0x120a2e,
  /** Outline thickness as a share of the body radius (the layers' manner). */
  outlineShare: 0.075,
  /** The second tone: a crescent on the lower right of the body; the light circle is shifted by this share of the radius. */
  crescentShift: 0.3,
  /** Corners of a crescent / spiral polyline per full turn. */
  curveSteps: 72,
  /** Gloss mark on the upper left of the body, in shares of the radius. */
  gloss: { x: -0.42, y: -0.5, length: 0.3, thick: 0.1, tilt: -0.9, dotGap: 0.07, dotRadius: 0.05 },
  glossAlpha: 0.75,
  /** Canvas of a planet without a ring (square) and with one. */
  size: 440,
  ringedWidth: 646,
  ringedHeight: 440,
  /** Ring of the ringed planets: half-axes as shares of the radius, thickness and tilt (rad). */
  ring: {
    rx: 1.55,
    ry: 0.42,
    thick: 0.2,
    tilt: -0.22,
    thin: 0.1,
    /** Front half of the ring leaves this much (rad) off each end for its outline. */
    insetRad: 0.16,
  },
} as const;

/**
 * How the planet crosses the screen (docs/06, section 5). It is the far background: the progress of the tower
 * through its lap (not the clock) carries it from above the top of the screen to below the bottom, one planet per
 * lap, on alternating sides. It stands beside the tower, outside the dashed lap corridor (the width cap of its lap,
 * centred on the screen), and stays visible the whole way: the flying layer and the HUD plates are drawn over it.
 */
export const PLANET_PLACE = {
  /** The planet's preferred centre, as a share of the screen width from the screen edge on its side. */
  x: 0.11,
  scale: 0.6,
  /**
   * Where the planet has no room at `scale`, it is shown smaller, in steps of `scaleStep`, down to
   * `minScale` (40% below the first size of the planets, 0.85).
   */
  minScale: 0.51,
  scaleStep: 0.01,
  /** Clear space between the planet picture and a dashed edge line. */
  lineGap: 8,
  /** At most this share of the planet's width may hang off the screen edge (its centre stays this far in, in widths, minus a half). */
  edgeCut: 0.25,
  /** A planet with no room even at `minScale` keeps out of the corridor and hangs off the edge by up to this share instead. */
  fallbackEdgeCut: 0.5,
  /** The planet enters above the top edge; by a seeded draw it starts up to this share of the screen height higher (it comes into view later in the lap). */
  enterVary: 0.08,
  /** Full and lite levels, on top of the scroll; the minimal level has no drift. */
  drift: {
    bob: { px: 10, ms: 6400 },
    swing: { deg: 3, ms: 8200 },
  },
} satisfies {
  x: number;
  scale: number;
  minScale: number;
  scaleStep: number;
  lineGap: number;
  edgeCut: number;
  fallbackEdgeCut: number;
  enterVary: number;
  drift: Pick<HoverSpec, 'bob' | 'swing'>;
};

/**
 * The muted look of the planet while it is behind the flight row (docs/06, section 5): a copy baked ahead with the
 * planet (`planetDimKey`), with the saturation and the brightness scaled down, blended in over `featherPx` before
 * the stripe.
 */
export const PLANET_DIM = {
  /** Share of its colourfulness the muted copy keeps (about -35%). */
  saturation: 0.65,
  /** Brightness factor of the muted copy (about -35%). */
  brightness: 0.65,
  /** The muted copy fades in over this many px of approach to the flight stripe (fully muted where they overlap). */
  featherPx: 80,
} as const;

/** The plate "Lap N" (docs/06, "Смена зоны"): shorter than the zone plate. */
export const LAP_PLATE = {
  width: 380,
  height: 112,
  fontSize: 60,
  labelPad: 32,
  /** The plate hangs against the left edge, so it never covers the next-creature chip on the right. */
  leftMargin: 24,
  holdMs: 900,
  /** The plate shows from this lap on (lap 1 starts with the zone itself). */
  firstLap: 2,
} as const;
