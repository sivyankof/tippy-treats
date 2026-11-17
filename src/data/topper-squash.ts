import type { TopperKind } from './plain-toppers';

/** What gets squashed under a landing layer: a big topper or the cream of a plain layer. */
export type SquashKind = TopperKind | 'cream';

/**
 * Squashing of the decorations (docs/06, section 4, "Придавливание украшений"): what a layer
 * landing on a big topper or on the cream of the layer below does. Pure looks and timings; the
 * run, the score and the sim do not depend on any of it. Pixels are world pixels, times are ms.
 */

/** A burst of small particles: how many, how fast and which way, the way `particle-motion` reads them. */
export interface SquashBurst {
  /** How many at full effects (the effect level halves it through the particle pool). */
  count: readonly [number, number];
  /** Pixels per second. */
  speed: readonly [number, number];
  /** Lift above the outward side, degrees (0 flies level, 90 straight up), and the cone width. */
  liftDeg: readonly [number, number];
  gravity: number;
  /** Share of the speed lost per second. */
  drag: number;
  /** Degrees per second. */
  spin: readonly [number, number];
  /** Scale of the picture at the start, and at the end as a multiple of it. */
  scale: readonly [number, number];
  scaleTo: number;
  lifeMs: readonly [number, number];
  /** The life share the particle stays solid for, then it fades. */
  holdShare: number;
  tints: readonly number[];
  /** The picture lies along its flight (a drop). */
  alignToFlight?: boolean;
  /** Flutter of a leaf gliding down. */
  sway?: { amplitude: readonly [number, number]; periodMs: readonly [number, number] };
}

/** The squeezed topper: it flattens in front of the layer, then sinks between the two layers and fades. */
export interface SquashFlatten {
  /** The scale it flattens to. */
  scaleX: number;
  scaleY: number;
  squashMs: number;
  /** Time it stays flat before the fade starts. */
  holdMs: number;
  fadeMs: number;
  /** The flat remains slide down by this many px of the layer height while they fade. */
  sinkPx: number;
  /** How much of the splat shows below the seam, px; the rest lies behind the new layer. */
  peekPx: number;
  ease: string;
}

/** What a kind does at the impact. */
export interface SquashKindLook {
  flatten: SquashFlatten | null;
  burst: SquashBurst | null;
  /** A second burst (crumbs of the wafer). */
  extra: SquashBurst | null;
  /** The picture the burst flies as (a key of `SQUASH_TEXTURES` or `fx_*`). */
  burstTexture: string | null;
  extraTexture: string | null;
  /** Juice stain left on the front of the lower layer: its tint; none for kinds that leave no stain. */
  stainTint: number | null;
  /** Both layers squint for this long (0: no squint). */
  squintMs: number;
}

/** Drawing of the new pictures: sizes in layer pixels, the field around each (docs/06 "Поле картинки") and the bake scale. */
export const SQUASH_PICTURES = {
  /** Room around every drawing, drawn pixels. */
  field: 4,
  /** The pictures are baked this many times bigger than they are shown. */
  bake: 2,
  outlinePx: 2.2,
  /** The cream roll's outline is thicker so the pale roll reads on a pale glaze. */
  rollOutlinePx: 3.4,
  /** The stain is drawn light and shown tinted: its tones are light greys that the tint turns into the tones of the juice. */
  stainColors: { base: 0xf4f4f4, shadow: 0xcdcdcd, gloss: 0xffffff },
  /** A mint leaf: the picture, its length and half width, drawn pixels; a flying leaf is shown `shownScale` times bigger. */
  leafSize: { width: 26, height: 42, length: 36, half: 10, shownScale: 2.1 },
  /** The break of the wafer: tilt of the tube, how far the break is above the resting spot, its width and the jag. */
  waferBreak: {
    tiltDeg: -24,
    centreAboveRest: 27.9,
    halfWidth: 20,
    zigStep: 4.5,
    zig: 2.2,
    insideLine: 3,
  },
} as const;

/** Keys of the pictures of the squash on the shared atlas. */
export const SQUASH_TEXTURES = {
  stain: 'fx_sq_stain',
  creamRoll: 'fx_sq_cream_roll',
  leaf: 'fx_sq_leaf',
  waferTop: 'fx_sq_wafer_top',
  waferBottom: 'fx_sq_wafer_bottom',
} as const;

const BERRY_DROPS: SquashBurst = {
  count: [5, 7],
  speed: [620, 1000],
  liftDeg: [6, 60],
  gravity: 2600,
  drag: 0.6,
  spin: [110, 170],
  scale: [1.6, 2.6],
  scaleTo: 0.55,
  lifeMs: [420, 560],
  holdShare: 0.55,
  tints: [],
  alignToFlight: true,
};

export const TOPPER_SQUASH = {
  /** Name of the stream forked from the cosmetic seed, followed by `:<layer number>`. */
  stream: 'squash',
  /** Anticipation: the topper under the flying layer crouches softly. */
  crouch: {
    /** Scale of the topper when fully crouched. */
    scaleY: 0.94,
    scaleX: 1.03,
    /** Time constant the crouch eases in and out with. */
    easeMs: 130,
    /** The flying layer must be within this many px (centre to centre, horizontally) beyond its half width of the topper to count as over it. */
    reachPx: 6,
  },
  /** A topper this much of its half body inside the edge of the new layer counts as fully under it. */
  hitMarginPx: 2,
  /** How the upper layer gives where it sits on a squashed topper: a light cousin of the fly splat. */
  press: {
    scaleX: 1,
    scaleY: 1,
    holdMs: 20,
    settleMs: 340,
    squashEase: 'Quad.easeOut',
    dipPx: 10,
    dipEase: 'Back.easeOut',
    dipOnly: true,
  },

  /** The reaction of a face that squints. */
  squintReaction: 'squint',
  /** The juice, leaves, halves and crumbs start at the seam, this many px below it. */
  burstBelowSeamPx: 6,
  /** The flat remains pass from over the new layer to between the two layers after this long. */
  /** The topper shot sideways by a layer that sits on its body only: it flies off in an arc with spin. */
  edge: {
    speedX: [950, 1250],
    speedUp: [380, 560],
    spinDeg: [1100, 1600],
    gravity: 2300,
    squashX: 1.4,
    squashY: 0.6,
    springMs: 90,
    lifeMs: 1100,
    fadeFrom: 0.7,
  },
  kinds: {
    cherry: {
      flatten: {
        scaleX: 1.6,
        scaleY: 0.13,
        squashMs: 85,
        holdMs: 90,
        fadeMs: 320,
        sinkPx: 2,
        peekPx: 7,
        ease: 'Quad.easeOut',
      },
      burst: { ...BERRY_DROPS, tints: [0xe0243f, 0xff5a6e, 0xc4162f] },
      extra: null,
      burstTexture: 'fx_drop',
      extraTexture: null,
      stainTint: 0xe8344c,
      squintMs: 0,
    },
    strawberry: {
      flatten: {
        scaleX: 1.6,
        scaleY: 0.14,
        squashMs: 85,
        holdMs: 90,
        fadeMs: 320,
        sinkPx: 2,
        peekPx: 7,
        ease: 'Quad.easeOut',
      },
      burst: { ...BERRY_DROPS, tints: [0xf0344c, 0xff7084, 0xd02040] },
      extra: null,
      burstTexture: 'fx_drop',
      extraTexture: null,
      stainTint: 0xf2465c,
      squintMs: 0,
    },
    lemon: {
      flatten: {
        scaleX: 1.3,
        scaleY: 0.38,
        squashMs: 95,
        holdMs: 120,
        fadeMs: 300,
        sinkPx: 2,
        peekPx: 6,
        ease: 'Cubic.easeOut',
      },
      burst: {
        count: [7, 9],
        speed: [720, 1150],
        liftDeg: [12, 58],
        gravity: 2100,
        drag: 0.9,
        spin: [110, 170],
        scale: [1.5, 2.6],
        scaleTo: 0.5,
        lifeMs: [360, 520],
        holdShare: 0.5,
        tints: [0xf4e04a, 0xfff6a0, 0xe8cc2c],
        alignToFlight: true,
      },
      extra: null,
      burstTexture: 'fx_drop',
      extraTexture: null,
      stainTint: null,
      squintMs: 520,
    },
    mint: {
      flatten: {
        scaleX: 1.35,
        scaleY: 0.3,
        squashMs: 110,
        holdMs: 100,
        fadeMs: 300,
        sinkPx: 2,
        peekPx: 6,
        ease: 'Back.easeOut',
      },
      burst: {
        count: [3, 4],
        speed: [760, 1100],
        liftDeg: [-8, 34],
        gravity: 760,
        drag: 0.9,
        spin: [-300, 300],
        scale: [1, 1.25],
        scaleTo: 0.95,
        lifeMs: [1000, 1300],
        holdShare: 0.6,
        tints: [0xffffff],
        sway: { amplitude: [12, 22], periodMs: [650, 900] },
      },
      extra: null,
      burstTexture: SQUASH_TEXTURES.leaf,
      extraTexture: null,
      stainTint: null,
      squintMs: 0,
    },
    wafer: {
      flatten: null,
      burst: {
        // The two halves: one count, they fly to opposite sides (see `waferHalves`).
        count: [2, 2],
        speed: [800, 1100],
        liftDeg: [50, 75],
        gravity: 1900,
        drag: 0.35,
        spin: [340, 560],
        scale: [1, 1],
        scaleTo: 1,
        lifeMs: [720, 820],
        holdShare: 0.55,
        tints: [0xffffff],
      },
      extra: {
        count: [5, 7],
        speed: [420, 800],
        liftDeg: [0, 62],
        gravity: 1800,
        drag: 0.8,
        spin: [-220, 220],
        scale: [0.9, 1.5],
        scaleTo: 0.6,
        lifeMs: [420, 620],
        holdShare: 0.5,
        tints: [0xe9b87a, 0xc98d4c, 0xfff4d8],
      },
      burstTexture: SQUASH_TEXTURES.waferTop,
      extraTexture: 'fx_crumb',
      stainTint: null,
      squintMs: 0,
    },
  } satisfies Record<Exclude<SquashKind, 'cream'>, SquashKindLook>,
  /** Mouths of the wafer halves: the break is shown by two pictures, the first flies up and out, the second along the layer. */
  wafer: {
    topLiftDeg: [42, 62],
    bottomLiftDeg: [4, 24],
  },
  /** The juice stain on the front of the lower layer. */
  stain: {
    /** Picture drawn size in layer pixels (the drip is part of it). */
    width: 52,
    height: 46,
    /** Anchor: the top of the blob. */
    originX: 0.5,
    originY: 0.16,
    /** How far below the glaze edge (the deepest tongue) the anchor sits. */
    belowGlazePx: 3,
    /** Clear space between the stain and the face, and between the stain and the side of the layer. */
    faceGapPx: 10,
    edgeGapPx: 6,
    growMs: 520,
    /** The mark is born this long after the impact, so the juice seems to arrive from the squash. */
    delayMs: 60,
    /** Slight tilt of the drip, degrees; sign follows the side. */
    tiltDeg: 3,
  },
  /** The cream roll squeezed out at both ends of the seam. */
  roll: {
    width: 110,
    height: 58,
    /** Where the picture is held: the tucked end under the upper layer. */
    originX: 0.4,
    originY: 0.5,
    /** The roll sits on the seam: this many px below the top edge of the lower layer. */
    seamDropPx: 12,
    growMs: 380,
    delayMs: 40,
    /** Slight droop of the outer end, degrees. */
    droopDeg: 8,
    /** The upper layer must overlap the lower by at least this much for the rolls to have room. */
    minOverlapPx: 120,
  },
  /** Pooled pictures of squashed toppers (the oldest is reused). */
  maxCrushed: 3,
} as const;

/** Time the first drop of the flat topper's fade needs; the whole effect is over after this. */
export function crushedLifeMs(look: SquashFlatten): number {
  return look.squashMs + look.holdMs + look.fadeMs;
}
