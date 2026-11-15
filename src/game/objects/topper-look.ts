import { Rng } from '../../core/rng';
import { PLAIN_TOPPERS, TOPPER_KINDS, type TopperKind } from '../../data/plain-toppers';
import type { DecorKind } from '../../data/plain-layers';
import { DEG_TO_RAD, lerp } from '../../util/math';
import { faceHalfSpan } from '../fx/glaze-growth';
import { plainLookAt, plainLooks } from './plain-look';

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
function topperDraws(seed: number, layerIndex: number): Topper & { wanted: boolean } {
  const rng = new Rng(seed).fork(`${PLAIN_TOPPERS.stream}:${layerIndex}`);
  const wanted = rng.next() < PLAIN_TOPPERS.shareOfBare;
  const kind = TOPPER_KINDS[rng.int(0, TOPPER_KINDS.length - 1)]!;
  const side: -1 | 1 = rng.next() < 0.5 ? -1 : 1;
  return { wanted, kind, side };
}

/**
 * The topper the seeded draw gives to the plain layer with this 1-based number, or `null`. Only a
 * layer without a small decoration gets one. Each layer draws from a stream of its own.
 */
export function topperAt(seed: number, layerIndex: number, decor: DecorKind | null): Topper | null {
  const { wanted, ...topper } = topperDraws(seed, layerIndex);
  return decor === null && wanted ? topper : null;
}

/** What the first-topper guarantee needs to know about a layer of the run: its kind and how wide it is. */
export interface LayerFacts {
  plain: boolean;
  width: number;
}

/** Whether `facts` is a plain layer that can show a topper at all (it is bare, and there is room beside the face). */
function canShow(seed: number, layerIndex: number, facts: LayerFacts | undefined): boolean {
  if (!facts || !facts.plain || plainLookAt(seed, layerIndex).decor !== null) return false;
  const { kind, side } = topperDraws(seed, layerIndex);
  return topperOffset(kind, side, facts.width, faceHalfSpan(facts.width, null)) !== null;
}

/**
 * The topper of the plain layer `layerIndex` for the cosmetic `seed`: the seeded draw, or, when it
 * is a layer from `guaranteeFrom` to `guaranteeTo` and no plain layer of the run before it has
 * shown a topper, the first bare layer wide enough takes one, so every run shows a topper early.
 * `layers[i - 1]` tells about layer `i` (golden layers and creatures never carry one). The result
 * depends on the seed and on the kinds and widths of the layers up to this one only.
 */
export function topperFor(
  seed: number,
  layerIndex: number,
  layers: ReadonlyArray<LayerFacts | undefined>,
): Topper | null {
  const facts = layers[layerIndex - 1];
  if (!facts || !facts.plain) return null;
  const decor = plainLookAt(seed, layerIndex).decor;
  const own = topperAt(seed, layerIndex, decor);
  if (own) return canShow(seed, layerIndex, facts) ? own : null;
  const { guaranteeFrom, guaranteeTo } = PLAIN_TOPPERS;
  if (layerIndex < guaranteeFrom || layerIndex > guaranteeTo) return null;
  if (!canShow(seed, layerIndex, facts)) return null;
  for (let n = 1; n < layerIndex; n++) {
    if (!canShow(seed, n, layers[n - 1])) continue;
    if (n >= guaranteeFrom || topperAt(seed, n, null)) return null;
  }
  const { kind, side } = topperDraws(seed, layerIndex);
  return { kind, side };
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
  private facts: Array<LayerFacts | undefined> = [];

  private sync(): number {
    const seed = plainLooks.cosmeticSeed;
    if (seed !== this.seed) {
      this.seed = seed;
      this.known = [];
      this.facts = [];
    }
    return seed;
  }

  /** A view shows layer `layerIndex` (1-based) of this kind and width; the first note of a layer stays. */
  note(layerIndex: number, plain: boolean, width: number): void {
    this.sync();
    this.facts[layerIndex - 1] ??= { plain, width };
  }

  /** The topper of the plain layer with this 1-based number, if it has one (`null` until a view noted the layer). */
  at(layerIndex: number): Topper | null {
    const seed = this.sync();
    const cached = this.known[layerIndex];
    if (cached !== undefined) return cached;
    if (!this.facts[layerIndex - 1]) return null;
    const topper = topperFor(seed, layerIndex, this.facts);
    this.known[layerIndex] = topper;
    return topper;
  }
}

export const plainToppers = new PlainToppers();
