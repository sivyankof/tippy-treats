import type { HoverSpec } from './backdrop-life';

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
 * Where the planet hangs on the screen and how it drifts (docs/06, section 5). It sits in a free
 * lane: outside the dashed lap corridor (the width cap of its lap, centred on the tower) and
 * below the HUD; where no lane has room it is not shown.
 */
export const PLANET_PLACE = {
  /** Start x (left) and y as shares of the screen; the HUD pushes the planet down. */
  x: 0.11,
  y: 0.28,
  scale: 0.6,
  /** Clear space kept between the HUD (its lowest edge, counter chips included) and the top of the planet, drift included. */
  hudGap: 40,
  /** Clear space between the planet (drift included) and the stripe around the flying layer's line. */
  rowGap: 24,
  /** Clear space between the planet and a dashed edge line, drift included. */
  lineGap: 40,
  /** How far the top layer may stand off the screen centre, so the corridor is widened by this on each side. */
  swayPx: 40,
  /** A planet may hang off the screen edge, but at least this share of its width stays in view. */
  minVisible: 0.5,
  /** Full and lite levels; the minimal level holds the planet still. */
  drift: {
    bob: { px: 10, ms: 6400 },
    swing: { deg: 3, ms: 8200 },
  },
} satisfies {
  x: number;
  y: number;
  scale: number;
  hudGap: number;
  rowGap: number;
  lineGap: number;
  swayPx: number;
  minVisible: number;
  drift: Pick<HoverSpec, 'bob' | 'swing'>;
};

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
