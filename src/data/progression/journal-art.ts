import { PALETTE } from '../common/palette';
import { JOURNAL_ROW_IDS, type JournalRowId } from './journal';

/**
 * The pictures of the baker's journal (docs/06-art-animation-audio.md, "Манера картинок"): the
 * icons of the fly bar and the rows, the five dishes of the fly window and the chevron of a row.
 * Drawn like the plain layers: flat fills in two tones, a thick warm outline, a light stroke.
 * All sizes and positions are shares of the baked picture size.
 */

/** A part of a picture; parts are drawn back to front, each with its own outline. */
export type JournalShape =
  | { kind: 'round'; radius: number }
  | { kind: 'ellipse' }
  | { kind: 'star'; inner: number; tips: number }
  /** A closed outline in absolute shares of the picture. */
  | { kind: 'poly'; points: readonly (readonly [x: number, y: number])[] };

export interface JournalPart {
  shape: JournalShape;
  /** Centre and half sizes (unused by `poly`). */
  x: number;
  y: number;
  rx: number;
  ry: number;
  fill: number;
  /** The flat shadow tone; the fill darkened a little when left out. */
  shadow?: number;
  /** Turn of the part round its centre, degrees. */
  tilt?: number;
  /** A highlight or a fill inside another part: no outline of its own. */
  flat?: boolean;
  alpha?: number;
}

export const JOURNAL_ART = {
  /** Baked size of an icon and of a dish, texture pixels. */
  iconSize: 96,
  dishSize: 256,
  chevronSize: 48,
  /** Share of the picture the outline takes (as for the plain layers' icons). */
  outlineShare: 0.05,
  /** The outline of a part is at most this share of its smaller half size. */
  smallOutline: 0.4,
  /** The lit tone is each part this much smaller, up and to the left. */
  band: 0.14,
  /** How much a missing shadow tone is darker than the fill. */
  shadowShade: -0.18,
  colors: {
    sponge: 0xf6c98c,
    spongeShadow: 0xd6914c,
    pink: 0xffaecb,
    pinkShadow: 0xe27ca4,
    cream: 0xfff4e4,
    creamShadow: 0xe9d5c3,
    gold: PALETTE.gold,
    goldShadow: 0xe0a020,
    berry: PALETTE.berry,
    berryShadow: 0xb02238,
    ink: 0x5a4470,
    inkShadow: 0x3b2a4a,
    wing: 0xe8f6ff,
    wingShadow: 0xb9d9ee,
    glass: 0xcfeaf6,
    glassShadow: 0x93c6dc,
    steel: 0xb6bfcc,
    steelShadow: 0x8590a2,
    bucket: 0x5b8def,
    bucketShadow: 0x3d63bf,
    water: 0x7fc4f0,
    tub: 0xf4f1ff,
    tubShadow: 0xc9c1e6,
    jam: 0xc8344f,
    copper: 0xc98d62,
    copperShadow: 0x9c6542,
    white: 0xffffff,
    chevron: PALETTE.accentSecondary,
  },
  /** A light stroke on a body: alpha of the white parts that stand for glass shine. */
  shineAlpha: 0.7,
  /** One fly in a dish: half sizes of its body and wings. */
  fly: { bodyRx: 0.024, bodyRy: 0.02, wingRx: 0.036, wingRy: 0.02, wingDx: 0.04, wingDy: 0.026 },
} as const;

const c = JOURNAL_ART.colors;
const fly = JOURNAL_ART.fly;

const ellipse = { kind: 'ellipse' } as const;
const round = (radius: number): JournalShape => ({ kind: 'round', radius });

/** A small fly at (x, y): two wings and a dark body. */
function flyParts(x: number, y: number, scale = 1): JournalPart[] {
  const wing = (side: -1 | 1): JournalPart => ({
    shape: ellipse,
    x: x + side * fly.wingDx * scale,
    y: y - fly.wingDy * scale,
    rx: fly.wingRx * scale,
    ry: fly.wingRy * scale,
    fill: c.wing,
    shadow: c.wingShadow,
    tilt: side * 35,
  });
  return [
    wing(-1),
    wing(1),
    {
      shape: ellipse,
      x,
      y,
      rx: fly.bodyRx * scale,
      ry: fly.bodyRy * scale,
      fill: c.ink,
      shadow: c.inkShadow,
    },
  ];
}

const flies = (spots: readonly (readonly [number, number])[]): JournalPart[] =>
  spots.flatMap(([x, y]) => flyParts(x, y));

/** A white stroke of shine on glass or metal. */
const shine = (x: number, y: number, rx: number, ry: number, tilt = 0): JournalPart => ({
  shape: round(1),
  x,
  y,
  rx,
  ry,
  fill: c.white,
  flat: true,
  alpha: JOURNAL_ART.shineAlpha,
  tilt,
});

/** The dishes of the fly window, by tier 1..5 (index 0 is unused): glass, jar, pot, bucket, bathtub. */
export const JOURNAL_DISHES: readonly (readonly JournalPart[])[] = [
  [],
  // A tumbler with a few flies over its rim.
  [
    {
      shape: {
        kind: 'poly',
        points: [
          [0.27, 0.3],
          [0.73, 0.3],
          [0.64, 0.86],
          [0.36, 0.86],
        ],
      },
      x: 0.5,
      y: 0.58,
      rx: 0.23,
      ry: 0.28,
      fill: c.glass,
      shadow: c.glassShadow,
    },
    shine(0.38, 0.55, 0.025, 0.17, 6),
    ...flies([
      [0.4, 0.16],
      [0.62, 0.2],
      [0.5, 0.08],
    ]),
  ],
  // A jar of jam with a golden lid and a swarm round it.
  [
    {
      shape: round(0.4),
      x: 0.5,
      y: 0.6,
      rx: 0.25,
      ry: 0.28,
      fill: c.glass,
      shadow: c.glassShadow,
    },
    {
      shape: round(0.4),
      x: 0.5,
      y: 0.66,
      rx: 0.2,
      ry: 0.2,
      fill: c.jam,
      shadow: c.berry,
      flat: true,
    },
    {
      shape: round(0.4),
      x: 0.5,
      y: 0.28,
      rx: 0.21,
      ry: 0.06,
      fill: c.gold,
      shadow: c.goldShadow,
    },
    shine(0.37, 0.52, 0.022, 0.12, 4),
    ...flies([
      [0.2, 0.18],
      [0.78, 0.14],
      [0.36, 0.08],
      [0.66, 0.06],
      [0.86, 0.34],
    ]),
  ],
  // A pot with its lid on and flies all over it.
  [
    {
      shape: ellipse,
      x: 0.15,
      y: 0.55,
      rx: 0.07,
      ry: 0.045,
      fill: c.steel,
      shadow: c.steelShadow,
    },
    {
      shape: ellipse,
      x: 0.85,
      y: 0.55,
      rx: 0.07,
      ry: 0.045,
      fill: c.steel,
      shadow: c.steelShadow,
    },
    {
      shape: round(0.3),
      x: 0.5,
      y: 0.62,
      rx: 0.32,
      ry: 0.26,
      fill: c.steel,
      shadow: c.steelShadow,
    },
    shine(0.3, 0.6, 0.025, 0.14, 8),
    {
      shape: round(0.9),
      x: 0.5,
      y: 0.36,
      rx: 0.32,
      ry: 0.08,
      fill: c.steel,
      shadow: c.steelShadow,
    },
    { shape: ellipse, x: 0.5, y: 0.25, rx: 0.06, ry: 0.05, fill: c.pink, shadow: c.pinkShadow },
    ...flies([
      [0.2, 0.2],
      [0.78, 0.18],
      [0.34, 0.1],
      [0.64, 0.1],
      [0.88, 0.4],
      [0.1, 0.4],
    ]),
  ],
  // A bucket with ears on its rim.
  [
    {
      shape: {
        kind: 'poly',
        points: [
          [0.2, 0.3],
          [0.8, 0.3],
          [0.7, 0.88],
          [0.3, 0.88],
        ],
      },
      x: 0.5,
      y: 0.6,
      rx: 0.3,
      ry: 0.29,
      fill: c.bucket,
      shadow: c.bucketShadow,
    },
    { shape: round(1), x: 0.5, y: 0.31, rx: 0.31, ry: 0.06, fill: c.steel, shadow: c.steelShadow },
    { shape: ellipse, x: 0.17, y: 0.3, rx: 0.04, ry: 0.04, fill: c.steel, shadow: c.steelShadow },
    { shape: ellipse, x: 0.83, y: 0.3, rx: 0.04, ry: 0.04, fill: c.steel, shadow: c.steelShadow },
    shine(0.34, 0.6, 0.025, 0.14, 8),
    ...flies([
      [0.16, 0.16],
      [0.36, 0.08],
      [0.58, 0.14],
      [0.82, 0.1],
      [0.9, 0.3],
      [0.5, 0.2],
      [0.08, 0.34],
    ]),
  ],
  // A bathtub with water and a cloud of flies.
  [
    { shape: ellipse, x: 0.24, y: 0.88, rx: 0.06, ry: 0.04, fill: c.gold, shadow: c.goldShadow },
    { shape: ellipse, x: 0.76, y: 0.88, rx: 0.06, ry: 0.04, fill: c.gold, shadow: c.goldShadow },
    { shape: round(0.5), x: 0.5, y: 0.6, rx: 0.42, ry: 0.22, fill: c.tub, shadow: c.tubShadow },
    { shape: round(1), x: 0.5, y: 0.47, rx: 0.37, ry: 0.06, fill: c.water, flat: true },
    {
      shape: round(0.5),
      x: 0.86,
      y: 0.34,
      rx: 0.035,
      ry: 0.07,
      fill: c.steel,
      shadow: c.steelShadow,
    },
    shine(0.24, 0.62, 0.025, 0.07, 80),
    ...flies([
      [0.16, 0.2],
      [0.34, 0.12],
      [0.52, 0.2],
      [0.7, 0.1],
      [0.26, 0.34],
      [0.6, 0.32],
      [0.44, 0.06],
      [0.9, 0.16],
    ]),
  ],
];

/** A layer of cake of the icons: sponge with a glaze cap. */
function layer(y: number, rx: number, glaze: number, glazeShadow: number): JournalPart[] {
  return [
    { shape: round(0.5), x: 0.5, y, rx, ry: 0.1, fill: c.sponge, shadow: c.spongeShadow },
    {
      shape: round(0.9),
      x: 0.5,
      y: y - 0.06,
      rx: rx - 0.01,
      ry: 0.045,
      fill: glaze,
      shadow: glazeShadow,
      flat: true,
    },
  ];
}

/** The icons: the fly bar and each row of the journal. */
export const JOURNAL_ICONS: Record<'flies' | JournalRowId, readonly JournalPart[]> = {
  // A big fly seen from above.
  flies: [
    {
      shape: ellipse,
      x: 0.27,
      y: 0.4,
      rx: 0.2,
      ry: 0.11,
      tilt: -30,
      fill: c.wing,
      shadow: c.wingShadow,
    },
    {
      shape: ellipse,
      x: 0.73,
      y: 0.4,
      rx: 0.2,
      ry: 0.11,
      tilt: 30,
      fill: c.wing,
      shadow: c.wingShadow,
    },
    { shape: ellipse, x: 0.5, y: 0.6, rx: 0.19, ry: 0.27, fill: c.ink, shadow: c.inkShadow },
    { shape: ellipse, x: 0.5, y: 0.3, rx: 0.14, ry: 0.12, fill: c.ink, shadow: c.inkShadow },
    {
      shape: ellipse,
      x: 0.42,
      y: 0.28,
      rx: 0.045,
      ry: 0.05,
      fill: c.berry,
      shadow: c.berryShadow,
      flat: true,
    },
    {
      shape: ellipse,
      x: 0.58,
      y: 0.28,
      rx: 0.045,
      ry: 0.05,
      fill: c.berry,
      shadow: c.berryShadow,
      flat: true,
    },
    shine(0.43, 0.56, 0.02, 0.09, 8),
  ],
  // Three layers with a cherry.
  layers: [
    ...layer(0.76, 0.38, c.pink, c.pinkShadow),
    ...layer(0.56, 0.33, c.cream, c.creamShadow),
    ...layer(0.36, 0.28, c.pink, c.pinkShadow),
    { shape: ellipse, x: 0.5, y: 0.17, rx: 0.07, ry: 0.07, fill: c.berry, shadow: c.berryShadow },
  ],
  // A tall tower of layers and a ruler beside it.
  height: [
    ...layer(0.84, 0.2, c.pink, c.pinkShadow),
    ...layer(0.64, 0.19, c.cream, c.creamShadow),
    ...layer(0.44, 0.18, c.pink, c.pinkShadow),
    ...layer(0.24, 0.17, c.cream, c.creamShadow),
    {
      shape: round(0.3),
      x: 0.8,
      y: 0.5,
      rx: 0.09,
      ry: 0.42,
      fill: c.gold,
      shadow: c.goldShadow,
    },
    ...[0.16, 0.3, 0.44, 0.58, 0.72, 0.86].map((y, i): JournalPart => ({
      shape: round(1),
      x: i % 2 === 0 ? 0.77 : 0.79,
      y,
      rx: i % 2 === 0 ? 0.045 : 0.025,
      ry: 0.012,
      fill: c.inkShadow,
      flat: true,
    })),
  ],
  // A pot of glaze with drips running down its side.
  glaze: [
    {
      shape: round(0.4),
      x: 0.5,
      y: 0.64,
      rx: 0.34,
      ry: 0.28,
      fill: c.copper,
      shadow: c.copperShadow,
    },
    { shape: round(1), x: 0.5, y: 0.4, rx: 0.36, ry: 0.09, fill: c.pink, shadow: c.pinkShadow },
    {
      shape: round(1),
      x: 0.3,
      y: 0.55,
      rx: 0.045,
      ry: 0.13,
      fill: c.pink,
      shadow: c.pinkShadow,
      flat: true,
    },
    {
      shape: round(1),
      x: 0.62,
      y: 0.52,
      rx: 0.045,
      ry: 0.09,
      fill: c.pink,
      shadow: c.pinkShadow,
      flat: true,
    },
    { shape: ellipse, x: 0.78, y: 0.86, rx: 0.05, ry: 0.06, fill: c.pink, shadow: c.pinkShadow },
    shine(0.3, 0.78, 0.02, 0.06, 10),
  ],
  // A golden star of a perfect drop and two sparkles.
  perfects: [
    {
      shape: { kind: 'star', inner: 0.46, tips: 5 },
      x: 0.5,
      y: 0.52,
      rx: 0.4,
      ry: 0.4,
      fill: c.gold,
      shadow: c.goldShadow,
    },
    {
      shape: { kind: 'star', inner: 0.3, tips: 4 },
      x: 0.14,
      y: 0.16,
      rx: 0.09,
      ry: 0.09,
      fill: c.cream,
      shadow: c.creamShadow,
    },
    {
      shape: { kind: 'star', inner: 0.3, tips: 4 },
      x: 0.88,
      y: 0.2,
      rx: 0.07,
      ry: 0.07,
      fill: c.cream,
      shadow: c.creamShadow,
    },
    shine(0.38, 0.4, 0.025, 0.07, -35),
  ],
  // A toppled tower: one layer flat, two thrown aside.
  runs: [
    {
      shape: round(0.5),
      x: 0.46,
      y: 0.8,
      rx: 0.36,
      ry: 0.1,
      fill: c.sponge,
      shadow: c.spongeShadow,
    },
    {
      shape: round(0.9),
      x: 0.45,
      y: 0.75,
      rx: 0.34,
      ry: 0.04,
      fill: c.pink,
      shadow: c.pinkShadow,
      flat: true,
    },
    {
      shape: round(0.5),
      x: 0.68,
      y: 0.52,
      rx: 0.26,
      ry: 0.09,
      tilt: 28,
      fill: c.sponge,
      shadow: c.spongeShadow,
    },
    {
      shape: round(0.5),
      x: 0.3,
      y: 0.46,
      rx: 0.24,
      ry: 0.09,
      tilt: -22,
      fill: c.sponge,
      shadow: c.spongeShadow,
    },
    {
      shape: { kind: 'star', inner: 0.4, tips: 4 },
      x: 0.5,
      y: 0.26,
      rx: 0.09,
      ry: 0.09,
      fill: c.gold,
      shadow: c.goldShadow,
    },
    {
      shape: { kind: 'star', inner: 0.4, tips: 4 },
      x: 0.86,
      y: 0.22,
      rx: 0.06,
      ry: 0.06,
      fill: c.gold,
      shadow: c.goldShadow,
    },
  ],
};

/** Every icon key in the order the sheet lists them. */
export const JOURNAL_ICON_IDS = ['flies', ...JOURNAL_ROW_IDS] as const;

/** The chevron of a row: an arrow-like corner as points of its picture. */
export const JOURNAL_CHEVRON: readonly (readonly [number, number])[] = [
  [0.26, 0.1],
  [0.5, 0.1],
  [0.84, 0.5],
  [0.5, 0.9],
  [0.26, 0.9],
  [0.6, 0.5],
];
