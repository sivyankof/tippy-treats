import { CUT_LOOK } from '../../data/cuts/cut-look';
import { backOut, clamp01, lerp, smoothstep } from '../../util/math';

/**
 * Shapes of the glaze strands of a cut (docs/06, "Срезы с характером"): where a strand runs, how
 * thick it is along its length, where the beads are, how a snapped end springs back. Pure maths,
 * no Phaser; the strips are written into the vertex rows of a `StripRope` (a row is the left and
 * the right vertex, four floats).
 */
const S = CUT_LOOK.strands;
const FLOATS_PER_ROW = 4;
/** The first rows of a strip turn from across the strand to along the cut face. */
const FACE_ROWS = 3;
/** The most the end rows turn towards the cut face (radians). */
const FACE_TURN = Math.PI / 4;
/** Rows must be this many times farther apart than the turn moves their ends, or the turn fades. */
const FACE_FOLD_MARGIN = 1.5;

export type StrandTrait = (typeof S.traits)[number];

export interface Vec {
  x: number;
  y: number;
}

/** Rows of the strip of one half of a strand: the ribbon, then the round cap of its far end. */
export const HALF_ROWS = S.rows + S.capRows;

/** The floats of the vertex rows of a half. */
export const HALF_FLOATS = HALF_ROWS * FLOATS_PER_ROW;

/** Thickness of the middle `sinceMs` after the let-go: thicker than the ends at first (the strands make one bridge), then the trait's own. */
export function middleThickness(trait: StrandTrait, sinceMs: number): number {
  return lerp(trait.end * S.bridge, trait.mid, smoothstep(sinceMs / S.thinMs));
}

/**
 * Thickness of a half `s` (0 at its anchor, 1 at the thinnest point) along it: thick at the anchor,
 * thin over a long middle, flaring near the end it holds on to.
 */
export function profileThickness(s: number, end: number, mid: number): number {
  const d = 1 - clamp01(s);
  return mid + (end - mid) * Math.pow(d, S.profilePower);
}

/** Outline of a strand of this thickness, per side. */
export function outlineOf(thickness: number): number {
  const { share, minPx, maxPx } = S.outline;
  return Math.min(maxPx, Math.max(minPx, thickness * share), thickness / 2);
}

/** Where along the half (share from its anchor) a bead is `sinceMs` after the let-go: it slides down quicker and quicker. */
export function beadShare(sinceMs: number, startShare: number, to: number): number {
  const { startMs, slideMs } = S.beads;
  const t = clamp01((sinceMs - startMs) / slideMs);
  return lerp(startShare, to, t * t);
}

/** How grown a bead is `sinceMs` after the let-go (0 not yet, 1 full). */
export function beadGrow(sinceMs: number): number {
  return smoothstep((sinceMs - S.beads.startMs) / S.beads.growMs);
}

/** When a strand with this trait snaps, ms from the let-go. */
export function snapTimeMs(trait: StrandTrait): number {
  return S.snapMs + trait.snapShift;
}

/**
 * Share of a snapped half that is left `u` (0..1) into the recoil: it flies back past its rest
 * share `rest` and settles there (`backOut`), then goes into the glaze.
 */
export function recoilLength(u: number, rest: number = S.recoil.restShare): number {
  const { springU } = S.recoil;
  if (u < springU) return rest + (1 - rest) * (1 - backOut(u / springU));
  return rest * (1 - smoothstep((u - springU) / (1 - springU)));
}

/** The rest share of a snapped half `length` px long: a short round stub, never longer than `restPx`. */
export function recoilRest(length: number): number {
  const { restShare, restPx } = S.recoil;
  return length > 0 ? Math.min(restShare, restPx / length) : restShare;
}

/**
 * The part of a snapped half that is left, `length` (share) of it from its anchor: the same curve
 * cut short, so the half retracts along the path it had and never folds. `control` and `end` are
 * the half's control point and break point from its anchor; the shortened ones are written into
 * `outControl` and `outEnd` (also from the anchor).
 */
export function trimHalf(
  control: Vec,
  end: Vec,
  length: number,
  outControl: Vec,
  outEnd: Vec,
): void {
  const l = clamp01(length);
  outEnd.x = 2 * control.x * l * (1 - l) + end.x * l * l;
  outEnd.y = 2 * control.y * l * (1 - l) + end.y * l * l;
  outControl.x = control.x * l;
  outControl.y = control.y * l;
}

/** Thickness of what is left of a snapped half at share `s` of it, `length` of the half left: the profile it had, the free end rounding off where it was cut. */
export function trimmedThickness(s: number, length: number, end: number, mid: number): number {
  return profileThickness(clamp01(s) * clamp01(length), end, mid);
}

/**
 * Height to width of a falling drop `ageMs` after it fell off moving at `speed` (px/s): round as
 * the bead it was, drawn out to a teardrop over `tallMs`, stretched along the speed.
 */
export function dropTallness(ageMs: number, speed: number): number {
  const { tall, tallMs, maxStretch, stretchPerSpeed } = S.drops;
  const stretch = Math.min(maxStretch, speed * stretchPerSpeed);
  return lerp(1, tall, smoothstep(ageMs / tallMs)) * (1 + stretch);
}

/**
 * Extra sideways speed of the `order`-th drop of a cut (0 for the first, px/s, outwards): drops of
 * neighbouring strands keep apart (see `S.drops.laneSpeed`).
 */
export function dropLaneSpeed(order: number): number {
  return S.drops.laneSpeed * order;
}

/** How thick the snapped half stays at its anchor `u` into the recoil (share): `keep` is what is left at the end. */
export function recoilAnchorScale(u: number, keep: number): number {
  return lerp(1, keep, smoothstep((u - S.recoil.springU) / (1 - S.recoil.springU)));
}

/**
 * How far in from the outer side of a layer (corner `radius`) a strand holds on at `fromTop` px
 * below its top edge: `inset` in on a straight side, more where the top corner rounds off, so the
 * end always sits on the outline and never hangs beside the corner.
 */
export function sideInset(radius: number, inset: number, fromTop: number): number {
  if (radius <= inset || fromTop >= radius) return inset;
  const r = radius - inset;
  const dy = radius - Math.max(fromTop, inset);
  return radius - Math.sqrt(Math.max(0, r * r - dy * dy));
}

/** The quadratic curve through `a` and `b` with control `c`, at `t`. */
export function curvePoint(a: Vec, c: Vec, b: Vec, t: number, out: Vec): Vec {
  const k = 1 - t;
  out.x = k * k * a.x + 2 * k * t * c.x + t * t * b.x;
  out.y = k * k * a.y + 2 * k * t * c.y + t * t * b.y;
  return out;
}

/** The unit direction of that curve at `t`. */
export function curveTangent(a: Vec, c: Vec, b: Vec, t: number, out: Vec): Vec {
  const k = 1 - t;
  let x = 2 * k * (c.x - a.x) + 2 * t * (b.x - c.x);
  let y = 2 * k * (c.y - a.y) + 2 * t * (b.y - c.y);
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    x = b.x - a.x;
    y = b.y - a.y;
  }
  const norm = Math.hypot(x, y) || 1;
  out.x = x / norm;
  out.y = y / norm;
  return out;
}

/**
 * The control point of a strand from `a` to `b` that sags: halfway, lowered by a share of the
 * length (at most `sag.maxPx`), times the trait's sag and `amount` (0..1, it grows with the stretch).
 */
export function sagControl(a: Vec, b: Vec, sag: number, amount: number, out: Vec): Vec {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  // The control point sits twice as low as the middle of the curve does.
  const drop = 2 * Math.min(S.sag.maxPx, len * S.sag.share) * sag * amount;
  out.x = (a.x + b.x) / 2;
  out.y = (a.y + b.y) / 2 + drop;
  return out;
}

/** The samples of one half: centre line, direction and thickness at each row. */
export class HalfShape {
  readonly x = new Float32Array(S.rows);
  readonly y = new Float32Array(S.rows);
  readonly tx = new Float32Array(S.rows);
  readonly ty = new Float32Array(S.rows);
  readonly w = new Float32Array(S.rows);
  /** The far end is a free, round end (after the snap). */
  capped = false;
  /** Along the cut face the anchor end sits on (unit): the end is cut flush with it, not across the strand. */
  faceX = 0;
  faceY = 1;
  private readonly p: Vec = { x: 0, y: 0 };
  private readonly t: Vec = { x: 0, y: 0 };

  /**
   * Samples the curve (a, c, b) from `t0` to `t1`; `thickness(s)` gives the thickness at the share
   * `s` of the way (0 at `t0`).
   */
  sample(a: Vec, c: Vec, b: Vec, t0: number, t1: number, thickness: (s: number) => number): void {
    const n = S.rows;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const t = lerp(t0, t1, s);
      curvePoint(a, c, b, t, this.p);
      curveTangent(a, c, b, t, this.t);
      const sign = t1 >= t0 ? 1 : -1;
      this.x[i] = this.p.x;
      this.y[i] = this.p.y;
      this.tx[i] = this.t.x * sign;
      this.ty[i] = this.t.y * sign;
      this.w[i] = Math.max(0, thickness(s));
    }
  }

  /** The point at share `s` of the half (between rows, straight). */
  pointAt(s: number, out: Vec): Vec {
    const f = clamp01(s) * (S.rows - 1);
    const i = Math.min(S.rows - 2, Math.floor(f));
    const k = f - i;
    out.x = lerp(this.x[i]!, this.x[i + 1]!, k);
    out.y = lerp(this.y[i]!, this.y[i + 1]!, k);
    return out;
  }

  /** Length along the samples (px). */
  length(): number {
    let len = 0;
    for (let i = 1; i < S.rows; i++) {
      len += Math.hypot(this.x[i]! - this.x[i - 1]!, this.y[i]! - this.y[i - 1]!);
    }
    return len;
  }
}

/**
 * Writes the strip of a half into `out`: each row `half(w)` to each side of the centre line (w is
 * the thickness there) and lifted `lift(w)` towards the side that is up on the screen. The far end
 * is a half ellipse of the last row's width when the half is capped, a point otherwise (no area).
 */
export function writeHalf(
  shape: HalfShape,
  out: Float32Array,
  half: (w: number) => number,
  lift: (w: number) => number,
  cap = shape.capped,
): void {
  const n = S.rows;
  const turn = faceTurnShare(shape, half(shape.w[0]!));
  for (let i = 0; i < n; i++) {
    const w = shape.w[i]!;
    let nx = -shape.ty[i]!;
    let ny = shape.tx[i]!;
    // The first rows turn towards the cut face, so the end grows out of it flush; at most
    // `FACE_TURN`, or a strand leaving the face steeply would get rows along itself (spikes).
    const face = i < FACE_ROWS ? (1 - i / FACE_ROWS) * turn : 0;
    if (face > 0) {
      const sign = nx * shape.faceX + ny * shape.faceY < 0 ? -1 : 1;
      const fx = shape.faceX * sign;
      const fy = shape.faceY * sign;
      const angle = Math.acos(Math.min(1, nx * fx + ny * fy));
      const turn = Math.min(angle, FACE_TURN) * face * (nx * fy - ny * fx < 0 ? -1 : 1);
      const c = Math.cos(turn);
      const sn = Math.sin(turn);
      const rx = nx * c - ny * sn;
      ny = nx * sn + ny * c;
      nx = rx;
    }
    const h = Math.max(0, half(w));
    const up = ny > 0 ? -1 : 1;
    const l = lift(w) * up;
    const cx = shape.x[i]! + nx * l;
    const cy = shape.y[i]! + ny * l;
    const at = i * FLOATS_PER_ROW;
    out[at] = cx - nx * h;
    out[at + 1] = cy - ny * h;
    out[at + 2] = cx + nx * h;
    out[at + 3] = cy + ny * h;
    if (i === n - 1) writeCap(shape, out, cap ? h : 0, cx, cy, nx, ny);
  }
}

/**
 * How much of the turn towards the cut face a strip may take (0..1): a short, thick half (a snapped
 * end going back into the glaze) has its rows so close that turning them would cross them over
 * (a spike), so the turn fades out as the rows get closer than the turn moves their ends.
 */
export function faceTurnShare(shape: HalfShape, halfWidth: number): number {
  const step = shape.length() / (S.rows - 1);
  const sweep = (FACE_TURN / FACE_ROWS) * Math.max(0, halfWidth);
  if (sweep <= 0) return 1;
  return clamp01(step / (sweep * FACE_FOLD_MARGIN));
}

/** The round cap past the last row (`cx`, `cy` its centre, `h` its half width, (nx, ny) across it). */
function writeCap(
  shape: HalfShape,
  out: Float32Array,
  h: number,
  cx: number,
  cy: number,
  nx: number,
  ny: number,
): void {
  const last = S.rows - 1;
  const tx = shape.tx[last]!;
  const ty = shape.ty[last]!;
  const rows = S.capRows;
  for (let j = 1; j <= rows; j++) {
    const a = (j / rows) * (Math.PI / 2);
    const along = Math.sin(a) * h;
    const across = Math.cos(a) * h;
    const at = (last + j) * FLOATS_PER_ROW;
    const x = cx + tx * along;
    const y = cy + ty * along;
    out[at] = x - nx * across;
    out[at + 1] = y - ny * across;
    out[at + 2] = x + nx * across;
    out[at + 3] = y + ny * across;
  }
}

/** The uv shares of a half strip on the strip picture: across it left to right, along it the middle row. */
export function halfUvs(left: number, right: number): Float32Array {
  const uv = new Float32Array(HALF_FLOATS);
  for (let r = 0; r < HALF_ROWS; r++) {
    const at = r * FLOATS_PER_ROW;
    uv[at] = left;
    uv[at + 1] = 0.5;
    uv[at + 2] = right;
    uv[at + 3] = 0.5;
  }
  return uv;
}

/** The uv shares of a quad (two rows: the top edge, then the bottom edge) over the whole picture. */
export function quadUvs(): Float32Array {
  return new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
}

/**
 * Writes a quad `w` x `h` centred on (x, y), its top turned to point along (-dirX, -dirY)
 * (the picture's up goes against the direction).
 */
export function writeQuad(
  out: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
  dirX = 0,
  dirY = 1,
): void {
  // Down of the picture along (dirX, dirY), right of it across.
  const rx = dirY;
  const ry = -dirX;
  const hw = w / 2;
  const hh = h / 2;
  out[0] = x - rx * hw - dirX * hh;
  out[1] = y - ry * hw - dirY * hh;
  out[2] = x + rx * hw - dirX * hh;
  out[3] = y + ry * hw - dirY * hh;
  out[4] = x - rx * hw + dirX * hh;
  out[5] = y - ry * hw + dirY * hh;
  out[6] = x + rx * hw + dirX * hh;
  out[7] = y + ry * hw + dirY * hh;
}
