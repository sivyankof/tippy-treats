import { BACKDROP_COLORS } from './backdrop-colors';
import { GOLDEN } from '../util/math';
import { BD_TEX } from './backdrop';

/** Everything that moves in the backdrop of a zone (docs/06, section 5). Positions are shares of the screen unless marked px. */
export interface Point {
  x: number;
  y: number;
}
export type Range = readonly [number, number];
type Wave = { px: number; ms: number };

/** A picture that hovers in place: swings, bobs, spins, pulses, flickers, blinks or orbits. */
export interface HoverSpec {
  texture: string;
  at: Point;
  /** Extra shift in px from `at`. */
  offset?: Point;
  /** Pivot of the picture; swing and spin turn around it. */
  origin?: readonly [number, number];
  scale?: number;
  alpha?: number;
  tint?: number;
  /** Shifts every wave of this picture so neighbours do not move in sync (radians). */
  phase?: number;
  swing?: { deg: number; ms: number };
  bob?: Wave;
  /** Sideways sway. */
  sway?: Wave;
  /** Continuous turn in degrees per second. */
  spin?: number;
  /** Grows and shrinks by `amount` (share of its size). */
  pulse?: { amount: number; ms: number };
  /** Width flutter, like cloth in the wind. */
  flutter?: { amount: number; ms: number };
  flicker?: { lo: number; hi: number; ms: number };
  /** Eyelid blink: the picture flattens to `min` of its height for `share` of every `ms`. */
  blink?: { ms: number; share: number; min: number };
  /** Moves around `at` on an ellipse; `depth` makes the far half smaller. */
  orbit?: { rx: number; ry: number; degPerSec: number; depth: number };
  /** Tint runs from `tint` to `to` and back every `ms`. */
  tintCycle?: { to: number; ms: number };
}

/** Soft puffs rising in a column: steam, smoke. */
export interface PuffSpec {
  texture: string;
  tint: number;
  count: number;
  riseHeight: number;
  periodMs: number;
  startScale: number;
  endScale: number;
  alpha: number;
  swayPx: number;
}

/** A picture that crosses the screen now and then (fly, birds, plane, comet). */
export interface TravelSpec {
  texture: string;
  /** Members of a flock; they fan out by `spreadPx`. */
  count: number;
  spreadPx: Point;
  from: Point;
  to: Point;
  /** Share of the screen the whole path is shifted by at random on every pass. */
  jitter: Point;
  /** Half of the passes run in the opposite direction and the picture mirrors. */
  bothWays: boolean;
  moveMs: Range;
  /** Time from the start of one pass to the start of the next (never shorter than the pass). */
  intervalMs: Range;
  /** Wait before the first pass; a negative value starts that far into it. */
  initialDelayMs: Range;
  scale: number;
  alpha: number;
  /** Share of the pass over which it fades in and out. */
  fadeEdge: number;
  /** The picture points along its path (comet, shooting star). */
  alongPath: boolean;
  rock?: { deg: number; ms: number };
  bob?: Wave;
  /** Loops of a buzzing flight. */
  wobble?: Wave;
  /** Wing beats as a flatten of the picture: `min` of its height every `ms`. */
  flap?: { ms: number; min: number };
}

/** Points that grow, shrink and glow: twinkling stars, blinking bulbs. */
export interface TwinkleSpec {
  texture: string;
  /** Shares of the screen; `dy` is an extra shift in px. */
  points: readonly (Point & { dy?: number })[];
  tints: readonly number[];
  periodMs: Range;
  scale: Range;
  alpha: Range;
  /** 1 is a smooth wave; higher makes sharper on/off blinks. */
  sharpness: number;
  /** Neighbours alternate in phase (garland) instead of running free (stars). */
  alternate: boolean;
}

const MICRO_AMOUNT = 0.008;

/** A fixture that has no motion of its own still breathes a little, so it never stands still. */
function micro(ms: number, phase = 0): Pick<HoverSpec, 'pulse' | 'phase'> {
  return { pulse: { amount: MICRO_AMOUNT, ms }, phase };
}

const PLASTIC = 0.754878;

function frac(value: number): number {
  return value - Math.floor(value);
}

/** An even-looking scatter of points over the screen (low-discrepancy sequence). */
function scatter(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 0.04 + 0.92 * frac(i * GOLDEN + 0.3),
    y: 0.03 + 0.94 * frac(i * PLASTIC + 0.2),
  }));
}

const GARLAND = { count: 13, sag: 46, y: 0.3, drop: 26, wireHeight: 90 };

/** Bulbs hang along the same arc the wire texture is drawn with (`garlandWireY`). */
function garlandPoints(): (Point & { dy: number })[] {
  return Array.from({ length: GARLAND.count }, (_, i) => {
    const x = 0.04 + (0.92 * i) / (GARLAND.count - 1);
    return { x, y: GARLAND.y, dy: GARLAND.drop + garlandWireY(x) };
  });
}

/** Height of the garland wire over its anchor line at the share `x` of the screen width. */
export function garlandWireY(x: number): number {
  return GARLAND.sag * Math.sin(Math.PI * x);
}

const KITCHEN_POT: Point = { x: 0.115, y: 0.6 };
const KITCHEN_RAIL: Point = { x: 0.87, y: 0.31 };
const KITCHEN_CLOCK: Point = { x: 0.13, y: 0.42 };
const COOK = BD_TEX.kitchen;
const ROOF_LINE: Point = { x: 0.8, y: 0.56 };
const ROOF_CHIMNEY: Point = { x: 0.1, y: 0.74 };
const CAKE: Point = { x: 0.86, y: 0.56 };
const MOON: Point = { x: 0.84, y: 0.6 };
const BULBS = BACKDROP_COLORS.showcase.bulbs;

function laundry(
  texture: string,
  dx: number,
  color: number,
  swing: HoverSpec['swing'],
  phase: number,
): HoverSpec {
  return {
    texture,
    at: ROOF_LINE,
    offset: { x: dx, y: -4 },
    origin: [0.5, 0],
    tint: color,
    swing,
    flutter: { amount: 0.12, ms: 760 },
    phase,
  };
}

function walker(y: number, scale: number, moveMs: Range): TravelSpec {
  return {
    texture: BD_TEX.showcase.walker,
    count: 1,
    spreadPx: { x: 0, y: 0 },
    from: { x: -0.1, y },
    to: { x: 1.1, y },
    jitter: { x: 0, y: 0 },
    bothWays: true,
    moveMs,
    intervalMs: [moveMs[1] + 1000, moveMs[1] + 4000],
    initialDelayMs: [-moveMs[0] / 2, 2000],
    scale,
    alpha: 0.3,
    fadeEdge: 0.04,
    alongPath: false,
    bob: { px: 7, ms: 520 },
    rock: { deg: 3, ms: 520 },
  };
}

export const BACKDROP_LIFE = {
  /** Shape constants of the shared motion helpers (`life-motion.ts`). */
  motion: {
    /** Share of a wobble loop the sideways swing takes next to the vertical one. */
    wobbleSide: 0.6,
    /** Phase step between the members of a flock, radians. */
    flockPhase: 0.9,
    /** Phase step between neighbouring twinkles, radians. */
    twinklePhase: 1.7,
    /** Turns of sideways sway a puff makes while it rises. */
    puffSwayTurns: 1.5,
    /** Phase step between the puffs of a column, radians. */
    puffSwayStep: 1.3,
  },
  kitchen: {
    pot: { texture: COOK.pot, at: KITCHEN_POT, pulse: { amount: 0.012, ms: 900 } } as HoverSpec,
    lid: {
      texture: COOK.lid,
      at: KITCHEN_POT,
      offset: { x: 0, y: -46 },
      bob: { px: 3, ms: 360 },
      swing: { deg: 2.5, ms: 430 },
    } as HoverSpec,
    steam: {
      texture: BD_TEX.puff,
      tint: 0xffffff,
      count: 5,
      riseHeight: 260,
      periodMs: 3200,
      startScale: 0.5,
      endScale: 1.7,
      alpha: 0.55,
      swayPx: 22,
    } as PuffSpec,
    steamAt: KITCHEN_POT,
    steamOffset: { x: 0, y: -76 },
    rail: { texture: COOK.rail, at: KITCHEN_RAIL, ...micro(1700, 1) } as HoverSpec,
    ladles: [
      { dx: -66, swing: { deg: 7, ms: 1500 }, phase: 0, scale: 1 },
      { dx: 0, swing: { deg: 9, ms: 1750 }, phase: 1.3, scale: 0.85 },
      { dx: 66, swing: { deg: 6, ms: 1300 }, phase: 2.4, scale: 1.1 },
    ].map(({ dx, swing, phase, scale }): HoverSpec => ({
      texture: COOK.ladle,
      at: KITCHEN_RAIL,
      offset: { x: dx, y: 6 },
      origin: [0.5, 0.05],
      scale,
      swing,
      phase,
    })),
    clock: { texture: COOK.clock, at: KITCHEN_CLOCK, ...micro(1900, 2) } as HoverSpec,
    clockHand: {
      texture: COOK.hand,
      at: KITCHEN_CLOCK,
      offset: { x: 0, y: -60 },
      origin: [0.5, 0.9],
      spin: 6,
    } as HoverSpec,
    pendulum: {
      texture: COOK.pendulum,
      at: KITCHEN_CLOCK,
      offset: { x: 0, y: 26 },
      origin: [0.5, 0.04],
      swing: { deg: 14, ms: 1600 },
    } as HoverSpec,
    fly: {
      texture: COOK.fly,
      count: 1,
      spreadPx: { x: 0, y: 0 },
      from: { x: -0.1, y: 0.5 },
      to: { x: 1.1, y: 0.6 },
      jitter: { x: 0, y: 0.18 },
      bothWays: true,
      moveMs: [5000, 7000],
      intervalMs: [9000, 14000],
      initialDelayMs: [1000, 3000],
      scale: 1.2,
      alpha: 1,
      fadeEdge: 0.03,
      alongPath: false,
      wobble: { px: 46, ms: 420 },
      flap: { ms: 90, min: 0.6 },
    } as TravelSpec,
  },
  showcase: {
    garland: {
      wireHeight: GARLAND.wireHeight,
      wire: {
        texture: BD_TEX.showcase.wire,
        at: { x: 0.5, y: GARLAND.y },
        origin: [0.5, 0],
        ...micro(1800, 0.4),
      } as HoverSpec,
      bulbs: {
        texture: BD_TEX.showcase.bulb,
        points: garlandPoints(),
        tints: BULBS,
        periodMs: [1400, 1400],
        scale: [0.9, 1.1],
        alpha: [0.25, 1],
        sharpness: 3,
        alternate: true,
      } as TwinkleSpec,
    },
    walkers: [
      walker(0.8, 0.9, [15000, 19000]),
      walker(0.84, 1, [13000, 17000]),
      walker(0.88, 1.1, [17000, 21000]),
    ],
    cakeStand: {
      texture: BD_TEX.showcase.stand,
      at: CAKE,
      offset: { x: 0, y: 62 },
      ...micro(1700),
    } as HoverSpec,
    cake: {
      texture: BD_TEX.showcase.cake,
      at: CAKE,
      bob: { px: 3, ms: 1800 },
      pulse: { amount: 0.01, ms: 1500 },
    } as HoverSpec,
    sprinkles: BACKDROP_COLORS.showcase.sprinkles.map((color, i, all): HoverSpec => ({
      texture: BD_TEX.showcase.sprinkle,
      at: CAKE,
      offset: { x: 0, y: -14 },
      tint: color,
      phase: (i * 2 * Math.PI) / all.length,
      orbit: { rx: 64, ry: 12, degPerSec: 70, depth: 0.3 },
      spin: 90,
    })),
  },
  roof: {
    birds: {
      texture: BD_TEX.roof.bird,
      count: 4,
      spreadPx: { x: 70, y: 34 },
      from: { x: -0.15, y: 0.38 },
      to: { x: 1.15, y: 0.3 },
      jitter: { x: 0, y: 0.1 },
      bothWays: true,
      moveMs: [9000, 12000],
      intervalMs: [13000, 19000],
      initialDelayMs: [-3000, 1500],
      scale: 0.9,
      alpha: 0.9,
      fadeEdge: 0.03,
      alongPath: false,
      flap: { ms: 380, min: 0.25 },
      bob: { px: 10, ms: 1500 },
    } as TravelSpec,
    chimney: { texture: BD_TEX.roof.chimney, at: ROOF_CHIMNEY, ...micro(1600, 0.8) } as HoverSpec,
    smoke: {
      texture: BD_TEX.puff,
      tint: BACKDROP_COLORS.roof.smoke,
      count: 6,
      riseHeight: 320,
      periodMs: 5200,
      startScale: 0.5,
      endScale: 2.2,
      alpha: 0.6,
      swayPx: 40,
    } as PuffSpec,
    smokeAt: ROOF_CHIMNEY,
    smokeOffset: { x: 0, y: -112 },
    rope: { texture: BD_TEX.roof.rope, at: ROOF_LINE, ...micro(1500, 1.9) } as HoverSpec,
    laundry: [
      laundry(BD_TEX.roof.shirt, -100, BACKDROP_COLORS.roof.laundry[0], { deg: 9, ms: 1200 }, 0),
      laundry(BD_TEX.roof.sock, -35, BACKDROP_COLORS.roof.laundry[2], { deg: 12, ms: 1000 }, 1.1),
      laundry(BD_TEX.roof.sheet, 40, BACKDROP_COLORS.roof.laundry[1], { deg: 7, ms: 1500 }, 2.3),
      laundry(BD_TEX.roof.sock, 112, BACKDROP_COLORS.roof.laundry[3], { deg: 11, ms: 1100 }, 0.6),
    ],
  },
  clouds: {
    balloon: {
      texture: BD_TEX.clouds.balloon,
      count: 1,
      spreadPx: { x: 0, y: 0 },
      from: { x: -0.2, y: 0.58 },
      to: { x: 1.2, y: 0.5 },
      jitter: { x: 0, y: 0.06 },
      bothWays: true,
      moveMs: [70000, 85000],
      intervalMs: [70000, 85000],
      initialDelayMs: [-20000, -20000],
      scale: 1,
      alpha: 1,
      fadeEdge: 0.01,
      alongPath: false,
      rock: { deg: 3, ms: 1900 },
      bob: { px: 14, ms: 3200 },
    } as TravelSpec,
    plane: {
      texture: BD_TEX.clouds.plane,
      count: 1,
      spreadPx: { x: 0, y: 0 },
      from: { x: -0.2, y: 0.42 },
      to: { x: 1.2, y: 0.3 },
      jitter: { x: 0, y: 0.15 },
      bothWays: true,
      moveMs: [6500, 8000],
      intervalMs: [11000, 16000],
      initialDelayMs: [1000, 4000],
      scale: 1,
      alpha: 1,
      fadeEdge: 0.02,
      alongPath: false,
      rock: { deg: 3, ms: 900 },
      bob: { px: 6, ms: 700 },
    } as TravelSpec,
  },
  stars: {
    twinkle: {
      texture: BD_TEX.star,
      points: scatter(18),
      tints: [BACKDROP_COLORS.stars.star, BACKDROP_COLORS.stars.warm],
      periodMs: [900, 1900],
      scale: [0.2, 0.6],
      alpha: [0.25, 1],
      sharpness: 1,
      alternate: false,
    } as TwinkleSpec,
    shooting: {
      texture: BD_TEX.stars.shooting,
      count: 1,
      spreadPx: { x: 0, y: 0 },
      from: { x: 0.95, y: 0.1 },
      to: { x: 0.35, y: 0.42 },
      jitter: { x: 0.3, y: 0.15 },
      bothWays: false,
      moveMs: [650, 850],
      intervalMs: [6000, 10000],
      initialDelayMs: [1500, 5000],
      scale: 1,
      alpha: 1,
      fadeEdge: 0.2,
      alongPath: true,
    } as TravelSpec,
    glow: {
      texture: BD_TEX.puff,
      at: MOON,
      scale: 3.6,
      alpha: 0.28,
      tint: BACKDROP_COLORS.stars.moon,
      pulse: { amount: 0.06, ms: 1900 },
    } as HoverSpec,
    moon: {
      texture: BD_TEX.stars.moon,
      at: MOON,
      bob: { px: 8, ms: 1900 },
      swing: { deg: 2.5, ms: 1700 },
    } as HoverSpec,
    eyes: [-36, 36].map((dx): HoverSpec => ({
      texture: BD_TEX.stars.eye,
      at: MOON,
      offset: { x: dx, y: -8 },
      bob: { px: 8, ms: 1900 },
      blink: { ms: 3400, share: 0.07, min: 0.1 },
    })),
  },
  space: {
    planets: [
      {
        texture: BD_TEX.space.planetA,
        at: { x: 0.16, y: 0.7 },
        bob: { px: 12, ms: 5200 },
        swing: { deg: 5, ms: 6400 },
      },
      {
        texture: BD_TEX.space.planetB,
        at: { x: 0.86, y: 0.46 },
        scale: 0.8,
        phase: 1,
        bob: { px: 10, ms: 4600 },
        swing: { deg: 6, ms: 5800 },
      },
    ] as HoverSpec[],
    satellite: {
      texture: BD_TEX.space.satellite,
      count: 1,
      spreadPx: { x: 0, y: 0 },
      from: { x: -0.15, y: 0.25 },
      to: { x: 1.15, y: 0.45 },
      jitter: { x: 0, y: 0.2 },
      bothWays: true,
      moveMs: [17000, 21000],
      intervalMs: [22000, 30000],
      initialDelayMs: [-6000, 1000],
      scale: 1,
      alpha: 1,
      fadeEdge: 0.02,
      alongPath: false,
      rock: { deg: 5, ms: 1800 },
    } as TravelSpec,
    comet: {
      texture: BD_TEX.space.comet,
      count: 1,
      spreadPx: { x: 0, y: 0 },
      from: { x: 1.15, y: 0.12 },
      to: { x: -0.15, y: 0.5 },
      jitter: { x: 0, y: 0.15 },
      bothWays: false,
      moveMs: [2600, 3400],
      intervalMs: [9000, 13000],
      initialDelayMs: [3000, 7000],
      scale: 1,
      alpha: 1,
      fadeEdge: 0.15,
      alongPath: true,
    } as TravelSpec,
  },
} as const;
