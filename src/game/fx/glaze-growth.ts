import { GLAZE_DRIPS } from '../../data/glaze-drips';
import type { CreatureId } from '../../data/creatures';
import type { FaceRecipe } from '../../data/creature-looks';
import { GOLDEN } from '../../util/math';
import { faceLayout } from '../objects/face-recipe';

/** How a creature changes the growth of its drips. */
export interface GrowthStyle {
  lengthMul: number;
  durationMul: number;
}

const PLAIN_STYLE: GrowthStyle = { lengthMul: 1, durationMul: 1 };

/** Whether the drips of this layer grow: plain and golden layers (`null`) and the soft creatures. */
export function growsDrips(creature: CreatureId | null): boolean {
  return creature === null || !GLAZE_DRIPS.hardCreatures.includes(creature);
}

/** Honey grows longer and faster than the rest. */
export function growthStyle(creature: CreatureId | null): GrowthStyle {
  return creature === 'honey' ? GLAZE_DRIPS.honey : PLAIN_STYLE;
}

/** Growth time of one drip: spread over `growMs` without a random generator, so it never changes. */
export function dripDurationMs(layerIndex: number, dripIndex: number, durationMul = 1): number {
  const [min, max] = GLAZE_DRIPS.growMs;
  const share = ((((layerIndex * 5 + dripIndex * 3 + 1) * GOLDEN) % 1) + 1) % 1;
  return (min + (max - min) * share) * durationMul;
}

/** Share (0..1) of the growth done `ageMs` after landing: fast at first, then it slows and sets. */
export function growthProgress(ageMs: number, durationMs: number): number {
  const t = (ageMs - GLAZE_DRIPS.startDelayMs) / durationMs;
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  return 1 - (1 - t) * (1 - t);
}

/**
 * Longest extra length of a drip whose baked tip is at `tipY` (relative to the layer centre):
 * a share of the layer height, but not past the lower edge of the layer plus the overlap.
 */
export function maxExtension(layerHeight: number, tipY: number, lengthMul: number): number {
  const byShare = layerHeight * GLAZE_DRIPS.maxLengthShare * lengthMul;
  const byEdge = layerHeight / 2 + GLAZE_DRIPS.overlapPx - tipY;
  return Math.max(0, Math.min(byShare, byEdge));
}

/** A horizontal stretch of the layer a drip must stay out of. */
export interface Exclusion {
  from: number;
  to: number;
}

/** Half width of a face on a layer of this width (a pair of faces is wider). */
export function faceHalfSpan(width: number, recipe: FaceRecipe | null): number {
  const { scale } = faceLayout(width, recipe);
  const half = GLAZE_DRIPS.faceHalfWidth;
  const pair = recipe?.pair;
  return scale * (pair ? pair.spread + pair.scale * half : half);
}

/**
 * The stretch the face of the layer below covers, in the coordinates of the layer above:
 * `offsetX` is how far the lower layer's centre is to the right of the upper one's.
 */
export function faceExclusion(
  offsetX: number,
  belowWidth: number,
  recipe: FaceRecipe | null,
): Exclusion {
  const half = faceHalfSpan(belowWidth, recipe);
  return { from: offsetX - half, to: offsetX + half };
}

/** A drip of half width `halfWidth` at `x` keeps clear of the face (and its margin). */
export function standsAside(x: number, exclusion: Exclusion | null, halfWidth: number): boolean {
  if (!exclusion) return true;
  const margin = GLAZE_DRIPS.faceMarginPx + halfWidth;
  return x < exclusion.from - margin || x > exclusion.to + margin;
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
