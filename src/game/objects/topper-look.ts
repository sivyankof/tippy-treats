import { Rng } from '../../core/rng';
import { PLAIN_TOPPERS, TOPPER_KINDS, type TopperKind } from '../../data/plain-toppers';
import type { DecorKind } from '../../data/plain-layers';
import { DEG_TO_RAD, lerp } from '../../util/math';
import { lookOfCode, plainLookAt, plainLooks } from './plain-look';

/** What a kind takes on screen, pixels: the picture size, its resting spot (from the picture top) and half its width on the edge. */
export interface TopperSize {
  width: number;
  height: number;
  restY: number;
  halfBody: number;
}

/** The on-screen size of a kind (the drawn size times `showScale`). */
export function topperSize(kind: TopperKind): TopperSize {
  const { width, height, restY, halfBody } = PLAIN_TOPPERS.kinds[kind];
  const k = PLAIN_TOPPERS.showScale;
  return { width: width * k, height: height * k, restY: restY * k, halfBody: halfBody * k };
}

/** The big topper of a plain layer: what it is and on which side of the face it sits (-1 left, 1 right). */
export interface Topper {
  kind: TopperKind;
  side: -1 | 1;
}

/** The draws of a layer's own topper stream: always all taken, so nothing depends on the decoration. */
function topperDraws(seed: number, layerIndex: number): { wanted: boolean } & Topper {
  const rng = new Rng(seed).fork(`${PLAIN_TOPPERS.stream}:${layerIndex}`);
  const wanted = rng.next() < PLAIN_TOPPERS.shareOfBare;
  const kind = TOPPER_KINDS[rng.int(0, TOPPER_KINDS.length - 1)]!;
  const side: -1 | 1 = rng.next() < 0.5 ? -1 : 1;
  return { wanted, kind, side };
}

/** The layer numbers `[from, to]` the first-topper guarantee looks at. */
const { guaranteeFrom, guaranteeTo } = PLAIN_TOPPERS;

/**
 * The topper of the plain layer with this 1-based number for the cosmetic `seed`, or `null`. Only
 * a layer without a small decoration gets one. Each layer draws from a stream of its own. When
 * none of layers 1..`guaranteeTo` got one by chance, the first bare layer from `guaranteeFrom`
 * takes it, so every run shows a topper early; this depends on the cosmetic seed alone.
 */
export function topperAt(seed: number, layerIndex: number, decor: DecorKind | null): Topper | null {
  const own = topperDraws(seed, layerIndex);
  if (decor !== null) return null;
  if (own.wanted) return { kind: own.kind, side: own.side };
  if (layerIndex < guaranteeFrom || layerIndex > guaranteeTo) return null;
  let first: number | null = null;
  for (let n = 1; n <= guaranteeTo; n++) {
    const bare = plainLookAt(seed, n).decor === null;
    if (bare && topperDraws(seed, n).wanted) return null;
    if (bare && first === null && n >= guaranteeFrom) first = n;
  }
  return first === layerIndex ? { kind: own.kind, side: own.side } : null;
}

/**
 * Where the topper sits on a layer `width` wide whose face takes `faceHalf` on each side of the
 * centre: its offset from the centre on `side`, or `null` when there is no room beside the face.
 */
export function topperOffset(
  kind: TopperKind,
  side: -1 | 1,
  width: number,
  faceHalf: number,
): number | null {
  const { faceGapPx, edgeGapPx, reach } = PLAIN_TOPPERS;
  const half = topperSize(kind).halfBody;
  const near = faceHalf + faceGapPx + half;
  const far = width / 2 - edgeGapPx - half;
  return far < near ? null : side * lerp(near, far, reach);
}

/**
 * Where a topper that stood at world x `worldX` sits on a layer that landed at `layerX` and is
 * `width` wide now (it may have been bitten): its offset from the new centre, pushed clear of the
 * face; `null` when the bite took its place (more than half of it lies beyond the edge).
 */
export function carriedOffset(
  kind: TopperKind,
  worldX: number,
  layerX: number,
  width: number,
  faceHalf: number,
): number | null {
  const { faceGapPx, edgeGapPx } = PLAIN_TOPPERS;
  const half = topperSize(kind).halfBody;
  const raw = worldX - layerX;
  if (Math.abs(raw) > width / 2) return null;
  const side = sideOfOffset(raw);
  const near = faceHalf + faceGapPx + half;
  const far = width / 2 - edgeGapPx - half;
  if (far < near) return null;
  return side * Math.min(Math.max(Math.abs(raw), near), far);
}

/** The side of the face a topper at `offset` from the centre stands on (-1 left, 1 right). */
export function sideOfOffset(offset: number): -1 | 1 {
  return offset < 0 ? -1 : 1;
}

/** The launch of a hopped-off topper. */
export interface PopLaunch {
  vx: number;
  vy: number;
  spinDeg: number;
}

/** The launch of the topper of layer `layerIndex` flying off towards `dir` (-1 left, 1 right). */
export function popLaunch(seed: number, layerIndex: number, dir: -1 | 1): PopLaunch {
  const { speedX, speedUp, spinDeg } = PLAIN_TOPPERS.hop;
  const rng = new Rng(seed).fork(`${PLAIN_TOPPERS.popStream}:${layerIndex}`);
  return {
    vx: dir * rng.range(speedX[0], speedX[1]),
    vy: -rng.range(speedUp[0], speedUp[1]),
    spinDeg: dir * rng.range(spinDeg[0], spinDeg[1]),
  };
}

/** Where a hopped-off topper is `ms` after the launch, relative to its start. */
export interface PopPose {
  dx: number;
  dy: number;
  angleDeg: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}

/** The pose of a hopped-off topper `ms` after it left; fills and returns `out`. */
export function popAt(launch: PopLaunch, ms: number, out: PopPose): PopPose {
  const { gravity, springMs, squashX, squashY, lifeMs, fadeFrom } = PLAIN_TOPPERS.hop;
  const t = ms / 1000;
  out.dx = launch.vx * t;
  out.dy = launch.vy * t + 0.5 * gravity * t * t;
  out.angleDeg = launch.spinDeg * t;
  const spring = ms >= springMs ? 0 : 1 - ms / springMs;
  out.scaleX = 1 + (squashX - 1) * spring;
  out.scaleY = 1 + (squashY - 1) * spring;
  const life = ms / lifeMs;
  out.alpha = life <= fadeFrom ? 1 : Math.max(0, 1 - (life - fadeFrom) / (1 - fadeFrom));
  return out;
}

/** Rest tilt of a kind on `side`, radians. */
export function restTilt(kind: TopperKind, side: -1 | 1): number {
  return PLAIN_TOPPERS.kinds[kind].restDeg * side * DEG_TO_RAD;
}

/** The toppers of the current run, remembered per layer number so the views ask every frame for free. */
class PlainToppers {
  private seed = -1;
  private known: Array<Topper | null> = [];

  /** The topper of the plain layer with this 1-based number, if it has one. */
  at(layerIndex: number): Topper | null {
    const seed = plainLooks.cosmeticSeed;
    if (seed !== this.seed) {
      this.seed = seed;
      this.known = [];
    }
    const cached = this.known[layerIndex];
    if (cached !== undefined) return cached;
    const decor = lookOfCode(plainLooks.codeFor(layerIndex)).decor;
    const topper = topperAt(seed, layerIndex, decor);
    this.known[layerIndex] = topper;
    return topper;
  }
}

export const plainToppers = new PlainToppers();
