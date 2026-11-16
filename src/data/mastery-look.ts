import type { FaceRecipe } from './creature-looks';
import type { CreatureMaterial } from './creature-materials';
import type { CreatureId } from './creatures';
import { MASTERY } from './mastery';
import { MENU } from './menu-layout';
import type { ZoneId } from './zones';

/**
 * The "grown" look of a creature (docs/06, "Взрослый вид"): from this creature level the layer
 * is drawn with its extra details (a crown, a bow, bubbles, a sparkler...). The detail is baked
 * into a second picture of the creature on the shared atlas, so it adds no draws in the run.
 */
export const GROWN_LOOK_LEVEL = MASTERY.lookLevel;

/** Which picture of a creature a layer shows: the usual one, the grown one, or the grown ghost lit up by the sky. */
export type CreatureStage = 'base' | 'grown' | 'glow';

/** How a layer view picks the stage: always the usual one, always the grown one, or by the creature level. */
export type StageMode = 'base' | 'grown' | 'level';

/** The grown Ghost glows (a lit baked variant) in these zones. */
export const GLOW_ZONES: readonly ZoneId[] = ['stars', 'space'];

/** A circle: centre x as an offset, centre height above the top edge of the layer, radius. */
export interface Dot {
  dx: number;
  up: number;
  r: number;
}

/** Shared drawing numbers of the grown details, all in pixels of the layer picture. */
export const GROWN_LOOKS = {
  honey: {
    topPad: 58,
    /** Honeycomb crown: hexagonal cells standing on the top edge. */
    cells: [
      { dx: -48, up: 10, r: 23 },
      { dx: 0, up: 26, r: 29 },
      { dx: 48, up: 10, r: 23 },
    ] satisfies Dot[],
    cellFill: '#ffd25a',
    cellInner: 0.55,
    /** The honey drop on the body: radius, how far from the right edge, height from the body centre. */
    drop: { r: 18, fromEdge: 56, dy: 16, fill: '#ffb52e', shine: 0.35 },
    /** Face room kept free of the drop, pixels. */
    faceGap: 8,
  },
  puff: {
    topPad: 110,
    /** Whipped-cream swirl on the puffs: stacked ellipses (rx, ry, height of the centre above the top edge). */
    swirl: [
      { rx: 48, ry: 21, up: 38 },
      { rx: 34, ry: 18, up: 58 },
      { rx: 21, ry: 15, up: 75 },
    ],
    cream: '#ffffff',
    cherry: { r: 16, up: 93, fill: '#e0364f', stem: 18, shine: 0.3 },
  },
  jelly: {
    topPad: 56,
    /** Big bubbles inside the body: how many per full-width layer, radius range. */
    inside: { perFullWidth: 8, minR: 10, rangeR: 11, alpha: 0.5, margin: 20 },
    /** Bubbles rising over the top edge. */
    rising: [
      { dx: 0.16, up: 24, r: 14 },
      { dx: 0.2, up: 48, r: 9 },
      { dx: -0.22, up: 22, r: 11 },
    ],
    faceGap: 12,
  },
  caramel: {
    topPad: 102,
    /** Lollipop on a stick: stands at this share of the half width from the centre. */
    stand: { share: 0.5, minFromEdge: 64 },
    stick: { width: 11, up: 40 },
    disc: { r: 35, up: 66, turns: 2.5, line: 6 },
    /** Two sticky threads from the lollipop to the cap. */
    threads: { width: 4, spread: 16 },
  },
  frosty: {
    topPad: 96,
    /** Icicle crown: spikes at x offset, height above the top edge, width. */
    spikes: [
      { dx: -56, up: 58, w: 26 },
      { dx: -28, up: 74, w: 30 },
      { dx: 0, up: 92, w: 34 },
      { dx: 28, up: 74, w: 30 },
      { dx: 56, up: 58, w: 26 },
    ],
    ice: '#cdeeff',
    /** Snowflakes on the cream strip: per full-width layer, arm length, line width. */
    flakes: { perFullWidth: 6, arm: 16, line: 4.5, shade: -0.16 },
    faceGap: 14,
  },
  brownie: {
    topPad: 56,
    /** Glaze helmet: half-width as a share of the layer, its largest half-width, height above the top edge, how far it dips into the body. */
    helmet: { share: 0.36, maxHalf: 150, up: 50, dip: 12, rim: 12 },
    nuts: [
      { dx: -0.5, up: 0.42 },
      { dx: 0, up: 0.64 },
      { dx: 0.5, up: 0.42 },
    ],
    nut: { w: 34, h: 24, outline: 4 },
  },
  sprinkle: {
    topPad: 100,
    /** The sparkler: stands at this share of the half width, leans out by `lean`, stick height and ray length. */
    stand: { share: 0.5, minFromEdge: 60 },
    stick: { width: 7, up: 64, lean: 26 },
    rays: { count: 10, length: 26, inner: 9, width: 6 },
    sparks: [
      { dx: -44, up: 82, r: 4 },
      { dx: 46, up: 70, r: 5 },
      { dx: 24, up: 30, r: 4 },
    ] satisfies Dot[],
  },
  crumb: {
    topPad: 26,
    /** The big chip on the body: size, gaps to the left edge and to the face, the smallest share of its size it may shrink to, height from the body centre. */
    chip: { w: 88, h: 56, corner: 8, edgeGap: 16, faceGap: 10, minFit: 0.45, dy: 8, tilt: -0.22 },
    /** The bitten corner: circles cut out of the top right corner (offsets from the corner). */
    bite: [
      { dx: -14, dy: 16, r: 22 },
      { dx: -44, dy: 4, r: 17 },
      { dx: 4, dy: 46, r: 16 },
    ],
    biteRim: 7,
    biteInner: 4,
  },
  ghost: {
    topPad: 58,
    /** Bow between the peaks: loop size, knot radius, height of its centre above the top edge. */
    bow: { loopW: 42, loopH: 30, knot: 11, up: 8, fill: '#ff8fb8', tail: 20 },
    /** Lit variant: inner rim, extra sparkles. */
    glow: { rim: 6, rimAlpha: 0.75, sparks: 7, spark: 10, tint: '#dff6ff', halo: '#b9e6ff' },
  },
  twins: {
    topPad: 64,
    /** One cap per face: dome size, brim height, pom-pom radius, colours (left, right). */
    cap: { rx: 46, ry: 36, brim: 12, pom: 11, up: 6 },
    colors: ['#ff9ecb', '#6fd8c4'] as const,
  },
  lemon: {
    topPad: 82,
    /** Umbrella of lemon wedges beside the slice: stands at this share of the half width. */
    stand: { share: 0.55, minFromEdge: 78 },
    canopy: { rx: 62, ry: 44, wedges: 4, up: 24 },
    handle: { width: 7, up: 28 },
    /** Juice splashes (offset from the umbrella centre). */
    splash: [
      { dx: -78, up: 40, r: 7 },
      { dx: -88, up: 14, r: 4 },
      { dx: 80, up: 50, r: 6 },
      { dx: 90, up: 20, r: 7 },
      { dx: -62, up: 70, r: 4 },
    ] satisfies Dot[],
  },
  rainbow: {
    topPad: 64,
    /** The big crown star is the usual one drawn this much larger and lifted this far; the small side stars flank it. */
    star: { scale: 1.7, lift: 14 },
    sideStars: { dx: 80, up: 6, r: 15 },
    /** Shimmering trail baked over the sponges: glints from lower left to upper right. */
    trail: { count: 12, size: 8, faceGap: 14 },
  },
} as const satisfies Record<CreatureId, unknown>;

/** What a creature's face does once grown (the changes on top of its usual face; docs/06 table). */
export const GROWN_FACE: Readonly<Partial<Record<CreatureId, Partial<FaceRecipe>>>> = {
  puff: { cheekScale: 2.2, cheekSpread: 1.2 },
  brownie: {
    browLeft: { angleDeg: -34, offsetY: 2, scaleX: 1.4, scaleY: 1.9 },
    browRight: { angleDeg: -34, offsetY: 2, scaleX: 1.4, scaleY: 1.9 },
  },
  crumb: { cheekScale: 2.7, cheekSpread: 1.25 },
  lemon: {
    lidLeft: 0.3,
    lidRight: 0.55,
    browRight: { angleDeg: -30, offsetY: 6, scaleX: 1, scaleY: 1 },
  },
};

/** The same-named fields of the usual material, replaced for a grown creature ("wobbles more", "flutters", "jostle"). */
export const GROWN_MATERIAL: Readonly<Partial<Record<CreatureId, Partial<CreatureMaterial>>>> = {
  jelly: {
    sway: { mode: 'squash', x: 0.02, y: 0.1, periodMs: 620, tilt: 1.7 },
    idle: { mode: 'squash', x: 0.008, y: 0.024, periodMs: 900 },
  },
  caramel: {
    land: { squash: 0.7, durationMul: 1.5, ease: 'Sine.easeOut' },
    idle: { mode: 'squash', x: 0.006, y: 0.03, periodMs: 1500 },
  },
  ghost: {
    idle: { mode: 'breathe', x: 0.012, y: 0.026, periodMs: 800 },
  },
  twins: {
    shellLag: { liftPx: 18, liftMs: 120 },
    idle: { mode: 'squash', x: 0.004, y: 0.014, periodMs: 520 },
  },
};

/** The small moving sprite of a grown creature (one sheet picture), as the live layer shows it. */
export type GrownAccent =
  | {
      kind: 'bee';
      /** Orbit: radius across (at most this share of the layer width), height, the crown the bee circles above. */
      orbit: { rx: number; widthShare: number; ry: number; up: number; periodMs: number };
      flap: { periodMs: number; amount: number };
    }
  | {
      kind: 'breath';
      /** Start and end of the puff (offsets from the layer centre), scale and fade, one puff every `periodMs`. */
      from: { x: number; y: number };
      to: { x: number; y: number };
      scale: readonly [number, number];
      alpha: number;
      periodMs: number;
    }
  | {
      kind: 'spark';
      /** Pulse of the sparkler tip: scale range, spin per second (degrees). */
      scale: readonly [number, number];
      spinDegPerSec: number;
      periodMs: number;
    };

export const GROWN_ACCENTS: Readonly<Partial<Record<CreatureId, GrownAccent>>> = {
  honey: {
    kind: 'bee',
    orbit: { rx: 92, widthShare: 0.34, ry: 22, up: 30, periodMs: 2600 },
    flap: { periodMs: 140, amount: 0.22 },
  },
  frosty: {
    kind: 'breath',
    from: { x: 46, y: 26 },
    to: { x: 78, y: -8 },
    scale: [0.5, 1.3],
    alpha: 0.85,
    periodMs: 2600,
  },
  sprinkle: { kind: 'spark', scale: [0.7, 1.35], spinDegPerSec: 180, periodMs: 520 },
};

/** How the accent behaves per effects level: the factor of its period (a slower loop), flutter or spin on or off, or a still picture. */
export const GROWN_ACCENT_LEVELS = {
  full: { periodMul: 1, detail: true, still: false },
  lite: { periodMul: 2, detail: false, still: false },
  minimal: { periodMul: 1, detail: false, still: true },
} as const;

/** Pictures of the accents on the shared sheet (side in pixels). */
export const GROWN_ACCENT_TEXTURES = {
  bee: { key: 'fx_grown_bee', w: 30, h: 24 },
  breath: { key: 'fx_grown_breath', w: 40, h: 40 },
  spark: { key: 'fx_grown_spark', w: 36, h: 36 },
} as const;

/**
 * The gold frame of a level-5 card in the collection (docs/06, "Золотая рамка"): the shape and size of the
 * card's rarity rim, drawn as a ring with a gold band and four stars, baked once.
 */
export const MASTERY_FRAME = {
  /** Texture key on the shared sheet; the collection screen shows this picture over the card. */
  key: 'ui_mastery_frame',
  /** Size of the card the ring wraps (the collection card), the corner radius, the dark outline and the width of the band: those of the rarity rim of the card plate. */
  width: MENU.collection.card.width,
  height: MENU.collection.card.height,
  radius: MENU.style.looks.card.radius,
  outline: MENU.style.looks.card.outline,
  band: MENU.style.looks.card.rimWidth,
  /** Room around the card the picture keeps for stars that stick out. */
  pad: 14,
  gold: '#ffc93c',
  goldLight: '#fff0a0',
  goldDark: '#c98a12',
  /** Four-point stars on the corners: radius and the share of the band they sit on. */
  star: { r: 13, white: '#ffffff' },
  /** Fine highlight along the top of the band: height, inset from corners. */
  shine: { height: 3, inset: 54, alpha: 0.8 },
} as const;
