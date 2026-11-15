import { BD_TEX } from './backdrop';
import { BACKDROP_COLORS } from './backdrop-colors';
import type { Range, TravelSpec } from './backdrop-life';
import { CREATURE_MATERIALS } from './creature-materials';
import type { ZoneId } from './zones';

/**
 * How a guest of the tower looks: the picture it sits with, the flat one it turns into when a
 * layer lands on it, and the colours of that flat picture. Other zones get a guest of their own
 * (a bird on the roof, a star among the stars) by adding an entry to `TOWER_GUESTS`.
 */
export interface GuestLook {
  /** Picture of the guest in flight and at rest (the one of the zone backdrop). */
  texture: string;
  /** Size of that picture in pixels (the baked size); the feet are `feetY` down from its top. */
  size: { width: number; height: number };
  feetY: number;
  /** The head side of the picture: the guest faces this way when the picture is not mirrored. */
  headSide: -1 | 1;
  /** Key and colours of the flat picture: a pancake with crossed-out eyes. */
  flat: {
    texture: string;
    width: number;
    height: number;
    /** Where the feet line of the flat picture is, a share of its height from the top. */
    feetShare: number;
    /** Half of the flat picture's visible width at `scale` 1, for the room it takes on a layer. */
    halfWidthPx: number;
    /** The body ellipse: its centre and size as shares of the picture. */
    bodyY: number;
    bodyWidth: number;
    bodyHeight: number;
    /** The wing pressed flat under the body (the other one sticks out, see `wingOut`). */
    flatWing: { x: number; y: number; width: number; height: number };
    /** The eyes: centres (shares of the picture), radius (share of the height), outline width. */
    eyeX: number;
    eyeY: number;
    eyeRadiusShare: number;
    eyeRingPx: number;
    /** The cross in each eye: arm length (share of the eye radius) and line width. */
    crossShare: number;
    crossPx: number;
    /** Legs sticking out from under the pancake: where they start (shares), how long and how they fan out. */
    legs: { x: number; y: number; lengthPx: number; fanDeg: readonly number[] };
    /** The other wing, sticking out: where it starts (shares), its size and lean. */
    wingOut: { x: number; y: number; lengthPx: number; widthPx: number; angleDeg: number };
    body: number;
    wing: number;
    wingAlpha: number;
    eyeWhite: number;
    pupil: number;
    outline: number;
  };
  /** Where the front legs start, in the picture (pixels), and the colour of the legs. */
  legs: {
    x: number;
    y: number;
    color: number;
    widthPx: number;
    /** Back and middle legs: where they stand (shares of the picture width from the centre). */
    backAt: readonly number[];
    /** How far a back leg starts above the body line, leans back and goes under the feet line. */
    backTopPx: number;
    backLeanPx: number;
    footDropPx: number;
    /** The front pair that rubs over the head: start, reach, rise and how much of the swing it gets. */
    front: { baseInsetPx: number; reachPx: number; risePx: number; swingX: number; swingY: number };
  };
  /** Drawn size relative to the picture. */
  scale: number;
  /** Half of the body width at `scale` 1, for the room it takes on a layer. */
  halfWidthPx: number;
}

const KITCHEN_FLY = BD_TEX.kitchen.fly;

/** The camera kick of the heaviest landing (the brownie's material): a splat kicks as hard. */
const HEAVY_KICK = CREATURE_MATERIALS.brownie.impact?.kick ?? 1;

export const TOWER_GUESTS: Partial<Record<ZoneId, GuestLook>> = {
  kitchen: {
    texture: KITCHEN_FLY,
    size: { width: 40, height: 30 },
    feetY: 25,
    headSide: -1,
    flat: {
      texture: 'guest_fly_flat',
      width: 92,
      height: 44,
      feetShare: 0.55,
      halfWidthPx: 40,
      bodyY: 0.64,
      bodyWidth: 0.62,
      bodyHeight: 0.3,
      flatWing: { x: 0.25, y: 0.6, width: 0.28, height: 0.2 },
      eyeX: 0.11,
      eyeY: 0.62,
      eyeRadiusShare: 0.2,
      eyeRingPx: 1.6,
      crossShare: 0.62,
      crossPx: 2.4,
      legs: { x: 0.29, y: 0.7, lengthPx: 11, fanDeg: [8, 32, 58] },
      wingOut: { x: 0.2, y: 0.6, lengthPx: 22, widthPx: 9, angleDeg: -12 },
      body: BACKDROP_COLORS.kitchen.fly,
      wing: BACKDROP_COLORS.shared.white,
      wingAlpha: 0.75,
      eyeWhite: BACKDROP_COLORS.shared.white,
      pupil: BACKDROP_COLORS.shared.ink,
      outline: BACKDROP_COLORS.shared.ink,
    },
    legs: {
      x: 12,
      y: 24,
      color: BACKDROP_COLORS.kitchen.fly,
      widthPx: 1.6,
      backAt: [-0.1, 0.12, 0.26],
      backTopPx: 3,
      backLeanPx: 2,
      footDropPx: 1,
      front: { baseInsetPx: 1, reachPx: 3, risePx: 8, swingX: 0.5, swingY: 0.4 },
    },
    scale: 2.4,
    halfWidthPx: 18,
  },
};

/**
 * The guest on the tower (docs/06, "Гость на башне"): it lands on the top layer now and then, sits
 * for a few seconds and flies away; a layer that lands on it flattens it for a moment. The timing
 * is drawn from the cosmetic stream of the run, so nothing of it touches the rules.
 * Distances are pixels of the world, times are milliseconds.
 */
export const TOWER_GUEST = {
  /** Name of the stream forked from the cosmetic seed of the run. */
  stream: 'guest',
  /** Wait between the end of one visit and the start of the next (so at least this apart). */
  intervalMs: [40000, 60000] as Range,
  /** The first visit of a run comes this soon. */
  firstDelayMs: [9000, 22000] as Range,
  /** A visit could not start (no room, a layer in the way): look again after this. */
  retryMs: 3000,

  /** Where the guest sits on the top layer. */
  site: {
    /** Free space kept between the guest and the face, and between the guest and the layer edge. */
    faceGapPx: 8,
    edgeGapPx: 6,
    /** The guest sits this far (share of the free stretch, `[near, far]`) from the face. */
    reach: [0.3, 1] as Range,
    /** The feet sink this far into the top surface. */
    sinkPx: 4,
    /** Free space kept on each side of the shadow of the flying layer. */
    shadowGapPx: 16,
  },

  /** Time the guest rests on the layer, rubbing its legs. */
  sitMs: [3500, 6000] as Range,
  rub: { periodMs: 240, swingPx: 4, twitchDeg: 2, twitchPeriodMs: 1700 },

  /** Flights: the guest comes in, leaves of its own will, or bolts from a danger. */
  arrive: {
    flightMs: [1500, 2100] as Range,
    zigzagPx: 22,
    zigzagCycles: 2.5,
    /** How high above the layer the arrival path starts. */
    abovePx: [140, 320] as Range,
  },
  leave: {
    flightMs: [1700, 2400] as Range,
    zigzagPx: 22,
    zigzagCycles: 3,
    risePx: [160, 360] as Range,
  },
  startle: {
    flightMs: [600, 900] as Range,
    zigzagPx: 28,
    zigzagCycles: 3,
    risePx: [120, 240] as Range,
  },
  /** The flight beyond the screen edge, in pixels. */
  offscreenPx: 60,
  /** Wing beats as a flatten of the picture: `min` of its height every `ms`. */
  flap: { ms: 80, min: 0.55 } satisfies NonNullable<TravelSpec['flap']>,
  /** Tilt in flight; the buzz tilt goes `tiltPeriodMul` times slower than the wing beat. */
  tiltDeg: 12,
  tiltPeriodMul: 3,
  /** The wing beat and the buzz tilt fade in over this long when a flight starts (and out when it lands). */
  flightRampMs: 100,

  /** "Fewer effects" lets no guest come to the tower (the dev trigger `window.tippyFly()` still does). */
  reducedVisits: false,

  /**
   * The guest flinches (hops, leans away, settles) when a layer in the air comes within `marginPx`
   * of it or over it; it does not leave. `cooldownMs` keeps it from hopping on every pass.
   */
  shy: { marginPx: 14, hopPx: 10, hopMs: 260, leanDeg: 14, cooldownMs: 1400 },

  /** A layer lands on the guest (docs/06, "Гость на башне", the splat step by step). */
  splat: {
    /**
     * The blow on the layer that landed: it holds its squash for `hitstopMs` (only the picture;
     * the sim and the game clock go on), squashes deeper than a normal landing and dips by
     * `dipPx` where the guest is, tilting around its far bottom corner, then settles over
     * `settleMs`. The camera is kicked `kickMul` times a normal landing, as a heavy layer does.
     */
    impact: {
      hitstopMs: 20,
      squashX: 1.2,
      squashY: 0.62,
      dipPx: 8,
      settleMs: 340,
      dipEase: 'Quad.easeOut',
      kickMul: HEAVY_KICK,
    },
    /**
     * The picture squashes from the normal shape into this one (`squashMs`), then the flat
     * picture pops in and settles with a gloop that dies out (`kick` times `amount` at first,
     * over `settleMs`).
     */
    squashMs: 60,
    squashTo: { scaleX: 1.6, scaleY: 0.25 },
    gloop: { amount: 0.05, periodMs: 260, kick: 5, settleMs: 160 },
    holdMs: [800, 1200] as Range,
    /** The legs and the wing sticking out of the pancake tremble: swing in degrees, one shiver every `periodMs`. */
    tremble: { periodMs: 70, legDeg: 14, wingDeg: 10 },
    /** The layer above looks down at the guest and gapes for this long after the hold ends. */
    surprise: { reaction: 'gape' as const, extraMs: 300 },
    /**
     * The stretchy peel: the flat picture narrows and stretches up (`stretch`, scales of the flat
     * picture) while it tilts up to `tiltDeg`; at `popAt` of the way the normal picture pops out,
     * crumpled small (`pop`), and the tilt goes back.
     */
    peelMs: 300,
    peel: {
      stretch: { scaleX: 0.5, scaleY: 1.8 },
      popAt: 0.6,
      pop: { scaleX: 0.8, scaleY: 0.6 },
      tiltDeg: 18,
    },
    /** Inflating back from the crumpled shape: a spring that overshoots `cycles` times and dies out. */
    inflateMs: 420,
    inflate: { cycles: 2, decay: 3.5 },
    /** Shaking its head: a damped swing of the tilt with a little wobble of the scales. */
    shakeMs: 760,
    shake: { amount: 0.08, cycles: 4, decay: 2.4, tiltDeg: 20 },
    /**
     * Stars circling over its head while it shakes: `count` of them on an ellipse (`radiusXPx`,
     * `radiusYPx`, pixels of the world) `liftPx` above its feet, one turn every `periodMs`; the
     * far side is drawn `farScale` smaller. They fade out over `fadeMs` once it flies away.
     */
    orbit: {
      count: 3,
      radiusXPx: 40,
      radiusYPx: 12,
      liftPx: 74,
      periodMs: 560,
      scale: 1.15,
      farScale: 0.6,
      fadeMs: 500,
      tints: [0xffd23f, 0xfff3b0, 0xffd23f],
    },
    /**
     * The offended flight away: a long zigzag whose swing staggers (grows and shrinks `stagger.share`
     * of it, `stagger.cycles` times on the way) and a strong tilt.
     */
    flee: {
      flightMs: [1900, 2500] as Range,
      zigzagPx: 40,
      zigzagCycles: 5,
      risePx: [180, 320] as Range,
      stagger: { share: 0.7, cycles: 1.7 },
      tiltDeg: 26,
    },
    /** Little stars fly out of the pancake. */
    stars: {
      count: 9,
      tints: [0xffd23f, 0xfff3b0, 0xffffff],
      style: {
        speed: [110, 230] as Range,
        gravity: 260,
        drag: 1.4,
        spin: [-240, 240] as Range,
        scale: [0.55, 1] as Range,
        scaleTo: 0.2,
        alpha: 1,
        holdShare: 0.4,
        lifeMs: [560, 820] as Range,
        spreadDeg: 300,
        tiltDeg: 0,
      },
    },
    /** The clap ring around the pancake: a ring as wide as `widthMul` times the pancake. */
    ring: { tint: 0xffffff, widthMul: 1.1 },
    /**
     * The layers under the seam (`depth` of them) glance at the pancake, each with `glanceChance`;
     * one of those may giggle (`giggleChance`) `giggleDelayMs` after the splat, for `giggleMs`.
     */
    neighbours: {
      depth: 2,
      glanceChance: 0.85,
      giggleChance: 0.6,
      giggleDelayMs: 380,
      giggleMs: 700,
      giggle: 'joy' as const,
    },
  },
} as const;
