import { GLAZE_DRIPS } from '../../data/glaze-drips';
import type { CreatureId } from '../../data/creatures';
import type { FaceRecipe } from '../../data/creature-looks';
import { GOLDEN, MS_PER_SECOND } from '../../util/math';
import { faceLayout } from '../objects/face-recipe';

/** How a creature changes the growth of its drips and how often they let a drop go. */
export interface GrowthStyle {
  lengthMul: number;
  durationMul: number;
  widthMul: number;
  dropWeight: number;
}

const PLAIN_STYLE: GrowthStyle = { lengthMul: 1, durationMul: 1, widthMul: 1, dropWeight: 1 };

/** Whether the drips of this layer grow: plain and golden layers (`null`) and the runny creatures. */
export function growsDrips(creature: CreatureId | null): boolean {
  if (creature === null) return true;
  return creature !== 'frosty' && !GLAZE_DRIPS.dryCreatures.includes(creature);
}

/** Frosty grows no drips but thaws: meltwater drops leave its bottom edge. */
export function thaws(creature: CreatureId | null): boolean {
  return creature === 'frosty';
}

/** Honey grows longer, thicker and faster than the rest; caramel slow, thick and stretchy. */
export function growthStyle(creature: CreatureId | null): GrowthStyle {
  if (creature === 'honey') return GLAZE_DRIPS.honey;
  if (creature === 'caramel') return GLAZE_DRIPS.caramel;
  return PLAIN_STYLE;
}

/** How many drips a plain layer of this width grows (before the face takes its share). */
export function dripCountFor(width: number): number {
  const [min, max] = GLAZE_DRIPS.count;
  return Math.min(max, Math.max(min, Math.round(width / GLAZE_DRIPS.widthPerDrip)));
}

/** A stable share in 0..1 for a drip of a layer, spread by the golden ratio (no generator). */
function dripHash(layerIndex: number, dripIndex: number, salt: number): number {
  return ((((layerIndex * 5 + dripIndex * 3 + salt) * GOLDEN) % 1) + 1) % 1;
}

/** Growth time of one drip: spread over `growMs` without a random generator, so it never changes. */
export function dripDurationMs(layerIndex: number, dripIndex: number, durationMul = 1): number {
  const [min, max] = GLAZE_DRIPS.growMs;
  return (min + (max - min) * dripHash(layerIndex, dripIndex, 1)) * durationMul;
}

/**
 * How far each of the `count` drips of a layer reaches, as a share of the longest reach: one of
 * them (its place differs from layer to layer) is the longest, the others are shorter, each by
 * its own amount.
 */
export function dripReachShares(layerIndex: number, count: number): number[] {
  const [min, max] = GLAZE_DRIPS.lengthShare;
  const raw = Array.from({ length: count }, (_, i) => dripHash(layerIndex, i, 2));
  const longest = raw.indexOf(Math.max(...raw));
  return raw.map((r, i) => (i === longest ? 1 : min + (max - min) * r));
}

/** Share (0..1) of the growth done `ageMs` after landing: fast at first, then it slows and sets. */
export function growthProgress(ageMs: number, durationMs: number): number {
  const t = (ageMs - GLAZE_DRIPS.startDelayMs) / durationMs;
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  return 1 - (1 - t) * (1 - t);
}

/**
 * Lower end (relative to the layer centre) of a fully grown drip whose tongue ends at `tipY`:
 * `share` of the way from the shortest drip to the longest one, which runs `overlapPx` (times
 * `lengthMul`) past the lower edge onto the layer below. A `blocked` drip (over the face of the
 * layer below, past its side, or over the tray) stops just above its own lower edge.
 */
export function dripEndY(
  layerHeight: number,
  tipY: number,
  share: number,
  lengthMul: number,
  blocked: boolean,
): number {
  const shortest = tipY + GLAZE_DRIPS.minLengthPx;
  const longest = layerHeight / 2 + GLAZE_DRIPS.overlapPx * lengthMul;
  const end = shortest + (longest - shortest) * share;
  const limit = blocked ? layerHeight / 2 - GLAZE_DRIPS.edgeStopPx : Infinity;
  return Math.max(tipY, Math.min(end, limit));
}

/** The layer below as a drip of the layer above sees it, in the coordinates of the upper layer. */
export interface BelowSpan {
  /** Its sides. */
  left: number;
  right: number;
  /** The stretch its face covers. */
  faceFrom: number;
  faceTo: number;
}

/** Half width of a face on a layer of this width (a pair of faces is wider). */
export function faceHalfSpan(width: number, recipe: FaceRecipe | null): number {
  const { scale } = faceLayout(width, recipe);
  const half = GLAZE_DRIPS.faceHalfWidth;
  const pair = recipe?.pair;
  return scale * (pair ? pair.spread + pair.scale * half : half);
}

/** How near the centre a drip `halfWidth` wide may hang on a layer of this width without covering its face. */
export function faceClearance(width: number, recipe: FaceRecipe | null, halfWidth: number): number {
  return faceHalfSpan(width, recipe) + GLAZE_DRIPS.faceMarginPx + halfWidth;
}

/**
 * The layer below seen from the layer above: `offsetX` is how far the lower layer's centre is to
 * the right of the upper one's. Fills and returns `out`.
 */
export function belowSpan(
  offsetX: number,
  belowWidth: number,
  recipe: FaceRecipe | null,
  out: BelowSpan,
): BelowSpan {
  const half = faceHalfSpan(belowWidth, recipe);
  out.left = offsetX - belowWidth / 2;
  out.right = offsetX + belowWidth / 2;
  out.faceFrom = offsetX - half;
  out.faceTo = offsetX + half;
  return out;
}

/**
 * A drip of half width `halfWidth` at `x` may run onto the layer below: it keeps clear of the
 * face there (with its margin) and hangs over the body, not past its side. No layer below
 * (the tray) means it may not.
 */
export function runsOntoBelow(x: number, below: BelowSpan | null, halfWidth: number): boolean {
  if (!below) return false;
  const margin = GLAZE_DRIPS.faceMarginPx + halfWidth;
  const clearOfFace = x < below.faceFrom - margin || x > below.faceTo + margin;
  const overBody = x - halfWidth > below.left + margin && x + halfWidth < below.right - margin;
  return clearOfFace && overBody;
}

/** Time a drop takes to fall `distance` pixels from rest under the drop gravity. */
export function fallTimeMs(distance: number): number {
  return Math.sqrt((2 * Math.max(0, distance)) / GLAZE_DRIPS.drop.gravity) * MS_PER_SECOND;
}

/** Chance that a drop is due within `dtMs`, when one falls on average every `meanWaitMs`. */
export function dropChance(dtMs: number, meanWaitMs: number): number {
  return 1 - Math.exp(-Math.max(0, dtMs) / meanWaitMs);
}

/** Keeps drops at least `minIntervalMs` apart for the whole tower. */
export class DropLimiter {
  private lastMs = -Infinity;

  constructor(private readonly minIntervalMs: number) {}

  ready(nowMs: number): boolean {
    return nowMs - this.lastMs >= this.minIntervalMs;
  }

  /** Notes that a drop fell at `nowMs`. */
  mark(nowMs: number): void {
    this.lastMs = nowMs;
  }

  reset(): void {
    this.lastMs = -Infinity;
  }
}
