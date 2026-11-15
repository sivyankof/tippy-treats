import { RAINBOW_LOOK } from '../../../data/rainbow-look';
import type { Pt } from '../../fx/plain-style';

const { idle } = RAINBOW_LOOK;

/** 1 at `x === center`, falling to 0 at `half` away from it (a smooth hump). */
export function humpAt(x: number, center: number, half: number): number {
  const d = Math.abs(x - center);
  return d >= half ? 0 : 0.5 * (1 + Math.cos((Math.PI * d) / half));
}

/**
 * Where the wave of sponge `index` (0 = top) is at `timeMs`, as a share (0..1) of the way across
 * the layer, or `null` while it is not on its way.
 */
export function waveProgress(timeMs: number, index: number): number | null {
  const local = (timeMs % idle.waveEveryMs) - index * idle.staggerMs;
  if (local < 0 || local > idle.travelMs) return null;
  return local / idle.travelMs;
}

/** Share (0..1) of the sparkle flash at `timeMs`, a smooth in-and-out; 0 between flashes. */
export function sparkleAt(timeMs: number, phaseMs: number): number {
  const local = (timeMs + phaseMs) % idle.sparkleEveryMs;
  if (local > idle.sparkleMs) return 0;
  return Math.sin((Math.PI * local) / idle.sparkleMs);
}

/** `points` turned by `rad` around (`cx`, `cy`). */
export function rotatePoints(points: readonly Pt[], cx: number, cy: number, rad: number): Pt[] {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => ({
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
  }));
}

/** The scalloped edge of the glaze: the circles hang from y `edgeY`, between `x0` and `x1`, about `step` apart. */
export interface GlazeScallops {
  edgeY: number;
  x0: number;
  x1: number;
  radius: number;
  step: number;
}

/**
 * The lowest y the baked glaze reaches at `x`: its flat lower edge, the scallop circles under it
 * and the drips (`width` wide, `length` long from the edge), all grown by `grow` for the outline.
 * The colour wave keeps below it, so it never runs onto the white glaze.
 */
export function glazeFloorAt(
  x: number,
  scallops: GlazeScallops,
  drips: ReadonlyArray<{ x: number; length: number }>,
  dripWidth: number,
  grow: number,
): number {
  const { edgeY, x0, x1, radius, step } = scallops;
  let floor = edgeY + grow;
  const count = Math.max(1, Math.round((x1 - x0) / step));
  for (let i = 0; i < count; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / count;
    const dx = Math.abs(x - cx);
    const r = radius + grow;
    if (dx < r) floor = Math.max(floor, edgeY + Math.sqrt(r * r - dx * dx));
  }
  for (const d of drips) {
    if (Math.abs(x - d.x) <= dripWidth / 2 + grow) floor = Math.max(floor, edgeY + d.length + grow);
  }
  return floor;
}
