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

/** A burst of one more picture. */
export interface SquashExtra {
  burst: SquashBurst;
  texture: string;
}

/** What a kind does at the impact. */
export interface SquashKindLook {
  flatten: SquashFlatten | null;
  burst: SquashBurst | null;
  /** More bursts of other pictures (stem, seeds, leaf bits, crumbs). */
  extras: readonly SquashExtra[];
  /** The picture the burst flies as (a key of `SQUASH_TEXTURES` or `fx_*`). */
  burstTexture: string | null;
  /** Juice stain left on the front of the lower layer: its picture; none for kinds that leave no stain. */
  stainTexture: string | null;
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
  /**
   * The cream roll (docs/06, "Валик крема"): two ridges piped along the seam and a hanging drop,
   * drawn in neutral greys and shown with an overlay tint in the cream tone of the layer: mid
   * grey turns into that tone, the darker greys into its shade and outline, white stays white.
   */
  cream: {
    /** Thicker than the other pictures so the pale ridge reads on a pale glaze. */
    outlinePx: 2.8,
    tones: {
      /**
       * The warm outline: below mid grey the overlay multiplies each channel of the tint by twice
       * the level, so a warm level (x0.66, x0.53, x0.40) gives a caramel-brown tone of the cream
       * whatever the glaze hue, never a slate or olive grey.
       */
      outline: 0x544433,
      /** The shade band under the ridge and the creases: light and warm (x0.93, x0.88, x0.80). */
      shade: 0x777066,
      /** Mid grey: exactly the tint. */
      base: 0x808080,
      /** The light rim over the festoons (the tint 30% towards white). */
      light: 0xa6a6a6,
      gloss: 0xffffff,
    },
    /** The lit tone is drawn this much of each blob smaller, up and to the left: the shade shows as a band below. */
    band: 0.14,
    /** The light rim over a festoon: its thickness as a share of the festoon's height, and its arc (degrees, 270 is the top). */
    rim: { share: 0.3, fromDeg: 205, toDeg: 335 },
    /** The swirl crease over each festoon (but the end bead), in the shade tone: its thickness, drawn pixels. */
    crease: { widthPx: 1.5 },
    /** The gloss mark on its festoon, in festoon heights. */
    glossUnit: 4.4,
    /**
     * The two ridges, drawn pixels in a picture of `TOPPER_SQUASH.roll.width` x `height`, the inner
     * end (under the upper layer) on the left: a flat base lying on the glaze, the festoons on it
     * from big to small, and which festoon carries the gloss. Different counts and steps, so the
     * two ends of the seam never look mirrored.
     */
    ridges: {
      a: {
        base: { cx: 45, cy: 24.5, rx: 40.5, ry: 6 },
        festoons: [
          { cx: 13, cy: 17, rx: 11.5, ry: 11.5 },
          { cx: 34, cy: 16.5, rx: 11.5, ry: 11 },
          { cx: 54, cy: 18, rx: 10.5, ry: 10 },
          { cx: 72, cy: 20.5, rx: 9, ry: 8.5 },
          { cx: 82.5, cy: 24, rx: 4.8, ry: 4.8 },
        ],
        glossOn: 2,
      },
      b: {
        base: { cx: 44, cy: 24.5, rx: 40.5, ry: 6 },
        festoons: [
          { cx: 15, cy: 16.5, rx: 13, ry: 12.5 },
          { cx: 42, cy: 17, rx: 12.5, ry: 11.5 },
          { cx: 65, cy: 19.5, rx: 10.5, ry: 9.5 },
          { cx: 79.5, cy: 23.5, rx: 6.5, ry: 6 },
        ],
        glossOn: 1,
      },
    },
    /** The hanging drop: a neck from the ridge (`neck` of the width) and a round bulb at the bottom. */
    drop: { width: 16, height: 23, neck: 0.5 },
    /** The cream of the decoration, the tone the glaze is mixed into for the cream roll. */
    cream: 0xfffaf2,
  },
  /** Tones of the juice stains: the lit tone, the shadow tone (the outline is the shadow tone darkened) and the gloss. */
  stainColors: {
    cherry: { base: 0xea4f66, shadow: 0xc93550, gloss: 0xffd0d8 },
    strawberry: { base: 0xff7a8e, shadow: 0xe8566e, gloss: 0xffe0e5 },
  },
  /**
   * The flying juice drop is drawn light and shown tinted: the base is white and the outline a
   * mid grey, so the tint turns the outline into the dark tone of the drop's own colour.
   */
  drop: { width: 12, height: 17, outline: 0x8c8c8c, shadow: 0xd6d6d6 },
  /** A drop of lemon juice: bigger, drawn in its own colours (warm dark outline, juice yellow, light spot), shown untinted. */
  lemonDrop: { width: 16, height: 22, outline: 0xb5870f, body: 0xf3d430, light: 0xfff6a8 },
  /** A seed of the strawberry and the stem bit of the cherry, drawn pixels, in their own colours. */
  seed: { width: 8, height: 11, color: 0xffd860, dark: 0xb88a1c },
  stem: { width: 30, height: 18, thick: 4.5, color: 0x8aa83a, dark: 0x55701c },
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
  stainCherry: 'fx_sq_stain_cherry',
  stainStrawberry: 'fx_sq_stain_strawberry',
  creamRidgeA: 'fx_sq_cream_ridge_a',
  creamRidgeB: 'fx_sq_cream_ridge_b',
  creamDrop: 'fx_sq_cream_drop',
  leaf: 'fx_sq_leaf',
  drop: 'fx_sq_drop',
  lemonDrop: 'fx_sq_lemon_drop',
  seed: 'fx_sq_seed',
  stem: 'fx_sq_stem',
  waferTop: 'fx_sq_wafer_top',
  waferBottom: 'fx_sq_wafer_bottom',
} as const;

const BERRY_DROPS: SquashBurst = {
  count: [5, 7],
  speed: [620, 1000],
  liftDeg: [4, 34],
  gravity: 2600,
  drag: 0.6,
  spin: [110, 170],
  scale: [1.5, 2.3],
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
  /** The squashed topper sinks this many times faster than the squash itself, so it lies down before the squash ends. */
  sinkRamp: 1.2,
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
  /**
   * They are born between the two layers (behind the new one, like the pressed pancake of the fly)
   * at the side of the new layer: at least this far (plus the half span of its face) from its
   * middle and this far in from its edge, and fly outwards, so nothing stays over its front.
   */
  launch: { faceGapPx: 18, edgeInsetPx: 4 },
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
        scaleX: 1.8,
        scaleY: 0.13,
        squashMs: 85,
        holdMs: 150,
        fadeMs: 320,
        sinkPx: 2,
        peekPx: 15,
        ease: 'Quad.easeOut',
      },
      // Dark cherry juice and a bit of the stem flying off.
      burst: { ...BERRY_DROPS, tints: [0xc8203c, 0xe23a52, 0xa8142c] },
      extras: [
        {
          texture: SQUASH_TEXTURES.stem,
          burst: {
            count: [1, 2],
            speed: [520, 800],
            liftDeg: [14, 40],
            gravity: 1500,
            drag: 0.7,
            spin: [-420, 420],
            scale: [0.7, 0.9],
            scaleTo: 0.8,
            lifeMs: [520, 700],
            holdShare: 0.6,
            tints: [0xffffff],
          },
        },
      ],
      burstTexture: SQUASH_TEXTURES.drop,
      stainTexture: SQUASH_TEXTURES.stainCherry,
      squintMs: 0,
    },
    strawberry: {
      flatten: {
        scaleX: 1.7,
        scaleY: 0.14,
        squashMs: 85,
        holdMs: 150,
        fadeMs: 320,
        sinkPx: 2,
        peekPx: 15,
        ease: 'Quad.easeOut',
      },
      // Lighter juice, yellow seeds and a leaf bit.
      burst: { ...BERRY_DROPS, tints: [0xff5a70, 0xff8a9c, 0xf03e58] },
      extras: [
        {
          texture: SQUASH_TEXTURES.seed,
          burst: {
            count: [4, 6],
            speed: [520, 900],
            liftDeg: [4, 38],
            gravity: 2200,
            drag: 0.6,
            spin: [-300, 300],
            scale: [0.8, 1.1],
            scaleTo: 0.7,
            lifeMs: [420, 600],
            holdShare: 0.55,
            tints: [0xffffff],
          },
        },
        {
          texture: SQUASH_TEXTURES.leaf,
          burst: {
            count: [2, 2],
            speed: [520, 800],
            liftDeg: [8, 36],
            gravity: 900,
            drag: 0.9,
            spin: [-260, 260],
            scale: [0.55, 0.7],
            scaleTo: 0.9,
            lifeMs: [800, 1000],
            holdShare: 0.6,
            tints: [0xffffff],
            sway: { amplitude: [8, 14], periodMs: [600, 800] },
          },
        },
      ],
      burstTexture: SQUASH_TEXTURES.drop,
      stainTexture: SQUASH_TEXTURES.stainStrawberry,
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
        peekPx: 11,
        ease: 'Cubic.easeOut',
      },
      burst: {
        count: [3, 4],
        speed: [620, 980],
        liftDeg: [14, 58],
        gravity: 2100,
        drag: 0.9,
        spin: [110, 170],
        scale: [1.2, 1.7],
        scaleTo: 0.6,
        lifeMs: [420, 580],
        holdShare: 0.55,
        tints: [0xffffff],
        alignToFlight: true,
      },
      extras: [],
      burstTexture: SQUASH_TEXTURES.lemonDrop,
      stainTexture: null,
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
        peekPx: 11,
        ease: 'Back.easeOut',
      },
      burst: {
        count: [3, 4],
        // Thrown out, the leaf is slowed by the air (high drag) and planes down swaying, then fades.
        speed: [560, 820],
        liftDeg: [10, 46],
        gravity: 760,
        drag: 3.6,
        spin: [-140, 140],
        scale: [1, 1.25],
        scaleTo: 0.95,
        lifeMs: [1500, 1900],
        holdShare: 0.6,
        tints: [0xffffff],
        sway: { amplitude: [16, 26], periodMs: [650, 900] },
      },
      extras: [],
      burstTexture: SQUASH_TEXTURES.leaf,
      stainTexture: null,
      squintMs: 0,
    },
    wafer: {
      flatten: null,
      burst: {
        // The two halves: one count, they fly to opposite sides (see `waferHalves`).
        count: [2, 2],
        speed: [900, 1150],
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
      extras: [
        {
          texture: 'fx_crumb',
          burst: {
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
        },
      ],
      burstTexture: SQUASH_TEXTURES.waferTop,
      stainTexture: null,
      squintMs: 0,
    },
  } satisfies Record<Exclude<SquashKind, 'cream'>, SquashKindLook>,
  /** Mouths of the wafer halves: the break is shown by two pictures, the first flies up and out, the second along the layer. */
  wafer: {
    topLiftDeg: [36, 52],
    bottomLiftDeg: [8, 22],
  },
  /** The juice stain on the front of the lower layer. */
  stain: {
    /** Picture drawn size in layer pixels (the drip is part of it): a wide flat splash with a short drip. */
    width: 62,
    height: 34,
    /** Anchor: the top of the splash. */
    originX: 0.5,
    originY: 0.15,
    /** How far below the glaze edge (its lowest point over the stain) the top of the splash sits: it lies on the sponge. */
    belowGlazePx: 4,
    /** Clear space between the stain and the face, the side of the layer and the growing drips. */
    faceGapPx: 18,
    edgeGapPx: 6,
    dripGapPx: 4,
    growMs: 520,
    /** The mark is born this long after the impact, so the juice seems to arrive from the squash. */
    delayMs: 60,
    /** Slight tilt of the drip, degrees; sign follows the side. */
    tiltDeg: 3,
  },
  /** The cream roll squeezed out at both ends of the seam (docs/06, "Валик крема"). */
  roll: {
    /** Drawn size of a ridge picture (both ridges share it), layer pixels. */
    width: 90,
    height: 36,
    /** Where a ridge is held: on its bottom line, at the end tucked under the upper layer. */
    originX: 0.36,
    originY: 0.84,
    /** The bottom line of the ridge lies this many px below the top edge of the lower layer, on its glaze. */
    seamDropPx: 18,
    /** The left ridge starts this long after the impact, the right one `rightLagMs` later still. */
    delayMs: 40,
    rightLagMs: 30,
    /** Slight droop of the outer end, degrees. */
    droopDeg: 5,
    /** The outer end of a roll goes at most this far past the lower layer's edge, so it lies on the lower glaze. */
    overhangPx: 9,
    /** The upper layer must overlap the lower by at least this much for the rolls to have room. */
    minOverlapPx: 120,
    /** Share of the cream mixed into the glaze tone of the layer: the roll is cream with a hint of the glaze, clearly lighter than the glaze it lies on. */
    creamShare: 0.72,
    /**
     * A dark glaze gives less of its tone, so the cream stays light and warm on chocolate: from
     * `fromLuma` down to `toLuma` the cream share rises to `share`.
     */
    darkGlaze: { fromLuma: 0.6, toLuma: 0.35, share: 0.86 },
    /** Squeezed out: a small round bump shows at the seam and swells (both axes together, never a thin sliver), the ridge is pushed out past its length, then settles back. */
    squeeze: {
      from: [0.24, 0.32],
      bulgeMs: 70,
      bulge: [0.34, 0.44],
      pushMs: 230,
      over: [1.1, 0.9],
      settleMs: 300,
    },
    /** The ridges: the left one (picture a), the right one (picture b), and the drops hanging from each (where along the picture, how big). */
    sides: [
      { ridge: 'a', drops: [{ at: 0.6, size: 1 }] },
      {
        ridge: 'b',
        drops: [
          { at: 0.5, size: 1 },
          { at: 0.79, size: 0.7 },
        ],
      },
    ],
    drop: {
      /** A drop is pulled out from under the ridge, overshoots, then sags slowly a little and stays. */
      squeeze: {
        bulgeMs: 60,
        bulge: [0.55, 0.25],
        pushMs: 240,
        over: [0.9, 1.15],
        settleMs: 280,
        sag: { ms: 1600, to: [0.96, 1.1] },
      },
      /** The first drop starts when its ridge is this far through its bulge and push; each next one `staggerMs` later. */
      startShare: 0.85,
      staggerMs: 110,
      /** The neck of a drop goes this many px up under the ridge's bottom line. */
      tuckPx: 4,
      /** A drop never hangs over the face of the lower layer: this much clear space beyond the face. */
      faceGapPx: 18,
    },
  },
  /** Pooled pictures of squashed toppers (the oldest is reused). */
  maxCrushed: 3,
} as const;

/** Time the first drop of the flat topper's fade needs; the whole effect is over after this. */
export function crushedLifeMs(look: SquashFlatten): number {
  return look.squashMs + look.holdMs + look.fadeMs;
}
