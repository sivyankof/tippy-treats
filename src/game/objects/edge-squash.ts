import type { WallFeel } from '../../data/edge-squash';

/**
 * The squash of the flying layer against the screen edges, as pure functions of the layer
 * position (docs/06, section 4, "Удар о край экрана"). Offsets are measured from the layer
 * centre; `half` is half of the body width. Each side squashes a zone of the body next to its
 * wall: the column at offset `u` is drawn at `squashX(u)` and is `squashTall(u)` times as tall.
 */

/** The squash of one side: how far its edge is pushed in (px) and how long the squashed part is. */
export interface SideSquash {
  depth: number;
  zone: number;
  /** How much the gathered glaze of this side swings (1: at rest), the spring after a turn. */
  spring: number;
  /** Extra squeeze at the very wall that fits into the zone (0 .. the feel's `edgeBias`). */
  bias: number;
}

export interface EdgeShape {
  half: number;
  left: SideSquash;
  right: SideSquash;
  /** Narrowest a column may get and how much taller it gets for the width it lost. */
  minScale: number;
  bulge: number;
  maxTall: number;
  /** How high the glaze gathers at the wall and how much of it sags. */
  glazeLift: number;
  glazeSag: number;
  /** Share of the accordion folds shown (0: none). */
  folds: number;
  /** The whole drawn body slid sideways (px): a hard layer that hardly squashes keeps off the wall. */
  shift: number;
}

export function flatShape(): EdgeShape {
  return {
    half: 0,
    left: { depth: 0, zone: 1, spring: 1, bias: 0 },
    right: { depth: 0, zone: 1, spring: 1, bias: 0 },
    minScale: 1,
    bulge: 0,
    maxTall: 1,
    glazeLift: 0,
    glazeSag: 0,
    folds: 0,
    shift: 0,
  };
}

/** Is any side squashed? */
export function isSquashed(shape: Readonly<EdgeShape>): boolean {
  return shape.left.depth > 0 || shape.right.depth > 0 || shape.shift !== 0;
}

/**
 * A smooth `max(e, 0)`: 0 up to `-knee`, `e` from `knee` on, a parabola between, so the
 * squash eases in instead of starting with a kink.
 */
export function softOverflow(e: number, knee: number): number {
  if (knee <= 0) return Math.max(0, e);
  if (e <= -knee) return 0;
  if (e >= knee) return e;
  return ((e + knee) * (e + knee)) / (4 * knee);
}

/**
 * How far each edge of a body `half` wide around `cx` reaches past its wall (px, negative while
 * it is inside).
 */
export function edgeOverflow(
  cx: number,
  half: number,
  wallLeft: number,
  wallRight: number,
): { left: number; right: number } {
  return { left: wallLeft - (cx - half), right: cx + half - wallRight };
}

/** How deep a side would squash for its overflow `e`, before the shape limits it. */
export function wantedDepth(e: number, knee: number, feel: Readonly<WallFeel>): number {
  return feel.give * softOverflow(e, knee);
}

/**
 * How far the drawn body slides inwards (px, positive: to the right) for the overflows of both
 * walls: what the squash does not take up, so the edge still stops at the wall. Continuous in
 * the overflows.
 */
export function slideShift(
  overLeft: number,
  overRight: number,
  knee: number,
  feel: Readonly<WallFeel>,
): number {
  const rest = feel.slide * (1 - feel.give);
  return rest * (softOverflow(overLeft, knee) - softOverflow(overRight, knee));
}

/**
 * Fits the wanted depths of both sides into a body `half` wide: each side squashes a zone of at
 * least `zoneShare` of the width, longer when the squash is deep, so no column gets narrower than
 * `minScale`. Two zones never overlap (they share the width by depth), so the picture never
 * folds. Every step is continuous in the depths, so the shape never jumps. Fills `out`.
 */
export function fitShape(
  half: number,
  wantLeft: number,
  wantRight: number,
  feel: Readonly<WallFeel>,
  out: EdgeShape,
): EdgeShape {
  out.half = half;
  out.minScale = feel.minScale;
  out.bulge = feel.bulge;
  out.maxTall = feel.maxTall;
  out.glazeLift = feel.glazeLiftPx;
  out.glazeSag = feel.glazeSag;
  out.folds = feel.folds;
  out.shift = 0;
  const width = half * 2;
  const sum = wantLeft + wantRight;
  fitSide(out.left, width, Math.max(0, wantLeft), sum, feel);
  fitSide(out.right, width, Math.max(0, wantRight), sum, feel);
  return out;
}

function fitSide(
  side: SideSquash,
  width: number,
  want: number,
  sum: number,
  feel: Readonly<WallFeel>,
): void {
  const give = 1 - feel.minScale;
  const share = sum > 0 ? want / sum : 1;
  const zone = Math.min(
    Math.max(feel.zoneShare * width, ((2 + 2 * feel.edgeBias) * want) / give),
    width * share,
  );
  side.zone = Math.max(zone, Number.EPSILON);
  side.depth = zone > 0 ? Math.min(want, (zone * give) / 2) : 0;
  // The slope at the wall is `2 + 2 * bias` times depth over zone: the extra squeeze takes
  // whatever room is left under `minScale`, so a deep squash simply gets less of it.
  const room = side.depth > 0 ? (side.zone * give) / side.depth : 2;
  side.bias = Math.min(feel.edgeBias, Math.max(0, (room - 2) / 2));
}

/**
 * How far the side pushes the column `x` from its own edge inwards (`x` is measured towards
 * that edge: `half` is the edge itself). Quadratic over the zone, so the push starts gently and
 * the column at the wall is squeezed most; past the edge (the outline, the shadow) it goes on
 * with the slope it had at the edge.
 */
function push(side: Readonly<SideSquash>, half: number, x: number): number {
  if (side.depth <= 0) return 0;
  const bias = side.bias;
  const from = half - side.zone;
  if (x <= from) return 0;
  if (x >= half) return side.depth + (((2 + 2 * bias) * side.depth) / side.zone) * (x - half);
  const t = (x - from) / side.zone;
  const t2 = t * t;
  return side.depth * ((1 - bias) * t2 + bias * t2 * t2);
}

/** Slope of `push` at `x`. */
function pushSlope(side: Readonly<SideSquash>, half: number, x: number): number {
  if (side.depth <= 0) return 0;
  const bias = side.bias;
  const t = Math.min(1, (x - (half - side.zone)) / side.zone);
  return t <= 0 ? 0 : (side.depth * (2 * (1 - bias) * t + 4 * bias * t * t * t)) / side.zone;
}

/** Where the column at offset `u` is drawn. */
export function squashX(shape: Readonly<EdgeShape>, u: number): number {
  const { half } = shape;
  return shape.shift + u - push(shape.right, half, u) + push(shape.left, half, -u);
}

/** Horizontal scale of the picture at offset `u` (1: untouched). */
export function squashScale(shape: Readonly<EdgeShape>, u: number): number {
  const { half } = shape;
  const slope = 1 - pushSlope(shape.right, half, u) - pushSlope(shape.left, half, -u);
  return Math.max(0, slope);
}

/** How many times taller the column at offset `u` is: it gets back part of the width it lost. */
export function squashTall(shape: Readonly<EdgeShape>, u: number): number {
  const lost = 1 - squashScale(shape, u);
  return Math.min(shape.maxTall, 1 + shape.bulge * lost);
}

/**
 * How far the glaze of the column at offset `u` rises (px, up) as it gathers at the wall: in
 * proportion to the width the column lost, but the part nearest the wall sags back by `glazeSag`.
 * The spring after a turn scales it per side.
 */
export function squashGlaze(shape: Readonly<EdgeShape>, u: number): number {
  return shape.glazeLift * (glazeRise(shape, shape.right, u) + glazeRise(shape, shape.left, -u));
}

/** The glaze rise of one side at offset `x` towards that side's wall, before `glazeLift`. */
function glazeRise(shape: Readonly<EdgeShape>, s: Readonly<SideSquash>, x: number): number {
  const range = 1 - shape.minScale;
  const lost = pushSlope(s, shape.half, x);
  const near = range > 0 ? Math.min(1, lost / range) : 0;
  return lost * (1 - shape.glazeSag * near * near) * s.spring;
}

/** Centre of the drawn body, as an offset from the layer centre. */
export function squashMid(shape: Readonly<EdgeShape>): number {
  return shape.shift + (shape.left.depth - shape.right.depth) / 2;
}

/** The tallest column of the body (1: not squashed): what is laid around the layer must cover it. */
export function squashTallest(shape: Readonly<EdgeShape>): number {
  if (!isSquashed(shape)) return 1;
  return Math.max(squashTall(shape, -shape.half), squashTall(shape, shape.half));
}

/** Width of the drawn body. */
export function squashWidth(shape: Readonly<EdgeShape>): number {
  return shape.half * 2 - shape.left.depth - shape.right.depth;
}

/**
 * The damped bounce `ageMs` after the turn: a row of hops off the wall, each one `periodMs`
 * long and lower than the last. It starts at 0 with no slope (so nothing jumps) and is never
 * negative, so a bounce only deepens the squash and never lets the edge past the wall. Multiply
 * it by the amplitude.
 */
export function bounceWave(ageMs: number, periodMs: number, decayMs: number): number {
  if (ageMs <= 0 || !Number.isFinite(ageMs)) return 0;
  const hop = Math.sin((Math.PI * ageMs) / periodMs);
  return hop * hop * Math.exp(-ageMs / decayMs);
}

/**
 * The swing of the gathered glaze `ageMs` after the turn: a damped wave that starts at 0 with no
 * jump, first lifts the glaze as the wall lets go, then dips below rest and settles.
 */
export function glazeSwing(ageMs: number, periodMs: number, decayMs: number): number {
  if (ageMs <= 0 || !Number.isFinite(ageMs)) return 0;
  return Math.sin((2 * Math.PI * ageMs) / periodMs) * Math.exp(-ageMs / decayMs);
}

/** A single bump `ageMs` after the touch: 0 at both ends, 1 in the middle of `ms`. */
export function knockPulse(ageMs: number, ms: number): number {
  if (ms <= 0 || ageMs <= 0 || ageMs >= ms) return 0;
  return Math.sin((Math.PI * ageMs) / ms);
}
