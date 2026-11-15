import { BALANCE } from '../../data/balance';
import { EDGE_SQUASH, type ByPower, type WallFeel } from '../../data/edge-squash';
import { clamp01, lerp, smoothstep } from '../../util/math';
import { ribHeight, type RibLayout } from './edge-squash-ribs';

/**
 * The squash of the flying layer against the screen edges, as pure functions of the layer
 * position (docs/06, section 4, "Удар о край экрана"). Offsets are measured from the layer
 * centre; `half` is half of the body width. Each side squashes a zone of the body next to its
 * wall: the column at offset `u` is drawn at `squashX(u)`, and the part by the wall grows into a
 * wedge with ribs (`columnEdge`).
 */

/** The squash of one side: how far its edge is pushed in (px) and how long the squashed part is. */
export interface SideSquash {
  depth: number;
  zone: number;
  /** How much the gathered glaze of this side swings (1: at rest), the spring after a turn. */
  spring: number;
  /** Extra squeeze at the very wall that fits into the zone (0 .. the feel's `edgeBias`). */
  bias: number;
  /** How much taller the column at the wall gets, share of the layer height (without the ribs' crests). */
  rise: number;
  /** Length of the wedge along the drawn body, px. */
  len: number;
  /** Progress of the impact strokes of this side, 0..1 (-1: none shown). */
  hit: number;
  /** How strong those strokes are, 0..1 (set at the touch from the flight speed). */
  hitGain: number;
}

export interface EdgeShape {
  half: number;
  left: SideSquash;
  right: SideSquash;
  /** Narrowest a column may get. */
  minScale: number;
  /** How high the glaze gathers at the wall and how much of it sags. */
  glazeLift: number;
  glazeSag: number;
  /** Drawn edges of the body without the slide, offsets from the layer centre. */
  edgeLeft: number;
  edgeRight: number;
  /** Share of the rise that is made of ribs (0: none), their size and how much of the farthest one shows. */
  ribShare: number;
  ribGrow: number;
  lastRib: number;
  /** The ribs are shown (the reduced mode turns them off: the wedge carries the whole rise). */
  ribbing: boolean;
  /** The rib layout of the layer, `null`: no ribs. */
  ribs: Readonly<RibLayout> | null;
  /** The whole drawn body slid sideways (px): a hard layer that hardly squashes keeps off the wall. */
  shift: number;
}

export function flatShape(): EdgeShape {
  return {
    half: 0,
    left: { depth: 0, zone: 1, spring: 1, bias: 0, rise: 0, len: 0, hit: -1, hitGain: 0 },
    right: { depth: 0, zone: 1, spring: 1, bias: 0, rise: 0, len: 0, hit: -1, hitGain: 0 },
    minScale: 1,
    glazeLift: 0,
    glazeSag: 0,
    edgeLeft: 0,
    edgeRight: 0,
    ribShare: 0,
    ribGrow: 0,
    lastRib: 1,
    ribbing: true,
    ribs: null,
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
 * How strong the touch is for a layer flying at `speed` px/s: 0 at the base speed of the run and
 * 1 at the maximum one (`BALANCE.speed`), smooth in between.
 */
export function speedPower(speed: number): number {
  const { base, max } = BALANCE.speed;
  return max > base ? clamp01((speed - base) / (max - base)) : 0;
}

/** A value at `power` between its slow and its fast end. */
export function byPower(values: ByPower, power: number): number {
  return lerp(values[0], values[1], clamp01(power));
}

/**
 * Fits the wanted depths of both sides into a body `half` wide: each side squashes a zone of at
 * least `zoneShare` of the width, longer when the squash is deep, so no column gets narrower than
 * `minScale`. Two zones never overlap (they share the width by depth), so the picture never
 * folds. `power` (see `speedPower`) sets how tall the wedge at the wall gets and how big the
 * ribs and the glaze bulge are. Every step is continuous in the depths, so the shape never
 * jumps. Fills `out`.
 */
export function fitShape(
  half: number,
  wantLeft: number,
  wantRight: number,
  feel: Readonly<WallFeel>,
  out: EdgeShape,
  power = 0,
): EdgeShape {
  const by = EDGE_SQUASH.byPower;
  out.half = half;
  out.minScale = feel.minScale;
  out.glazeLift = feel.glazeLiftPx * byPower(by.glazeMul, power);
  out.glazeSag = feel.glazeSag;
  out.ribShare = feel.ribs > 0 ? byPower(by.ribShare, power) : 0;
  out.ribGrow = feel.ribs;
  out.lastRib = smoothstep((power - by.fourthRib[0]) / (by.fourthRib[1] - by.fourthRib[0]));
  out.shift = 0;
  const width = half * 2;
  const sum = wantLeft + wantRight;
  fitSide(out.left, width, Math.max(0, wantLeft), sum, feel);
  fitSide(out.right, width, Math.max(0, wantRight), sum, feel);
  out.edgeLeft = -half + out.left.depth;
  out.edgeRight = half - out.right.depth;
  const rise = byPower(by.rise, power) * feel.rise;
  const body = out.edgeRight - out.edgeLeft;
  fitWedge(out.left, width, body, feel, rise);
  fitWedge(out.right, width, body, feel, rise);
  return out;
}

/**
 * The wedge of one side: how long it is (the share of the width of the feel, longer on a deep
 * squash, never past a third of the width and never past its share of the drawn body) and how
 * tall it gets, growing with the depth of the squash.
 */
function fitWedge(
  side: SideSquash,
  width: number,
  body: number,
  feel: Readonly<WallFeel>,
  rise: number,
): void {
  const { fullDepthPx, deepDepthPx, deepMul, maxShare, maxBodyShare } = EDGE_SQUASH.wedge;
  const deep = lerp(1, deepMul, smoothstep(side.depth / deepDepthPx));
  side.len = Math.min(feel.zoneShare * width * deep, maxShare * width, maxBodyShare * body);
  side.rise = rise * smoothstep(side.depth / fullDepthPx);
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

/**
 * Where column `i` of `n` sits in the picture, as a share of its width (0..1): the columns are
 * packed densely in the outer parts, where the ribs are, and sparse in the middle. Piecewise
 * linear, so it never folds.
 */
export function columnShare(i: number, n: number): number {
  const { edgeSpan, edgeShare } = EDGE_SQUASH.columns;
  const s = n > 1 ? i / (n - 1) : 0;
  if (s <= edgeShare) return (s / edgeShare) * edgeSpan;
  if (s >= 1 - edgeShare) return 1 - ((1 - s) / edgeShare) * edgeSpan;
  return edgeSpan + ((s - edgeShare) / (1 - 2 * edgeShare)) * (1 - 2 * edgeSpan);
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

/** How much a column grows beyond the layer's normal outline, shares of the layer height. */
export interface ColumnEdge {
  up: number;
  down: number;
}

/**
 * How far the column at offset `u` reaches above and below the normal outline (shares of the
 * layer height, glaze not counted): a smooth wedge that is highest at the wall and goes back to
 * the normal height along `len`, mostly upwards. The ribs ride on its outline as a separate
 * silhouette (`ribReach`). The wedge is laid along the drawn distance from the wall, so it stays
 * where it is while the picture is squashed under it. Fills `out`.
 */
export function columnEdge(shape: Readonly<EdgeShape>, u: number, out: ColumnEdge): ColumnEdge {
  out.up = 0;
  out.down = 0;
  const x = squashX(shape, u) - shape.shift;
  wedgeAt(shape, shape.left, x - shape.edgeLeft, out);
  wedgeAt(shape, shape.right, shape.edgeRight - x, out);
  return out;
}

/** The reach of one side's smooth wedge at `d` px from its wall, kept in `out` when it is higher. */
function wedgeAt(
  shape: Readonly<EdgeShape>,
  side: Readonly<SideSquash>,
  d: number,
  out: ColumnEdge,
): void {
  if (side.rise <= 0 || side.len <= 0) return;
  const t = Math.max(0, d) / side.len;
  if (t >= 1) return;
  const { upShare, profile } = EDGE_SQUASH.wedge;
  const ribFrac = shape.ribbing && shape.ribs ? shape.ribShare : 0;
  const base = side.rise * (1 - ribFrac) * Math.pow(1 - t, profile);
  out.up = Math.max(out.up, upShare * base);
  out.down = Math.max(out.down, (1 - upShare) * base);
}

/**
 * How far the ribs of one side stand out of the wedge outline at `d` px from its wall (shares of
 * the layer height, top and bottom): the round bumps of the silhouette drawn over the picture
 * (see `edge-squash-silhouette.ts`), the one at the wall the biggest. The wedge and the ribs
 * together add up to the rise of the side. Fills `out`.
 */
export function ribReach(
  shape: Readonly<EdgeShape>,
  side: Readonly<SideSquash>,
  d: number,
  out: ColumnEdge,
): ColumnEdge {
  out.up = 0;
  out.down = 0;
  const ribs = shape.ribbing ? shape.ribs : null;
  if (!ribs || side.rise <= 0 || side.len <= 0) return out;
  const t = Math.max(0, d) / side.len;
  if (t >= 1) return out;
  // The wall rib of the top and of the bottom row add up to `ribShare` of the rise.
  const lump = side.rise * shape.ribShare * shape.ribGrow * Math.max(0, side.spring);
  const upShare = EDGE_SQUASH.ribs.upShare;
  out.up = lump * upShare * ribHeight(ribs.top, t, shape.lastRib);
  out.down = lump * (1 - upShare) * ribHeight(ribs.bottom, t, shape.lastRib);
  return out;
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

/** How many times taller than normal the tallest part of the body gets (1: not squashed): what is laid around the layer must cover it. */
export function squashTallest(shape: Readonly<EdgeShape>): number {
  if (!isSquashed(shape)) return 1;
  return 1 + Math.max(shape.left.rise, shape.right.rise);
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
