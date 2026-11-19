import { RAINBOW_LOOK } from '../../../../data/creatures/rainbow-look';
import type { Pt } from '../../../fx/common/plain-style';
import type { GlazeLayout } from '../../tower/layer-draw';

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

/**
 * The lowest y the baked glaze reaches at `x`: its flat lower edge, the scallop circles under it
 * and the drips (`width` wide, `length` long from the edge), all grown by `grow` for the outline.
 * The colour wave keeps below it, so it never runs onto the white glaze.
 */
export function glazeFloorAt(
  x: number,
  layout: GlazeLayout,
  dripWidth: number,
  grow: number,
): number {
  const { edgeY, scallops, drips } = layout;
  let floor = edgeY + grow;
  for (const bump of scallops) {
    const dx = Math.abs(x - bump.x);
    const r = bump.radius + grow;
    if (dx < r) floor = Math.max(floor, edgeY + Math.sqrt(r * r - dx * dx));
  }
  for (const d of drips) {
    if (Math.abs(x - d.x) <= dripWidth / 2 + grow) floor = Math.max(floor, edgeY + d.length + grow);
  }
  return floor;
}
