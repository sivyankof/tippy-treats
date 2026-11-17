import { ANIM } from '../../../data/anim';
import { BACKDROP } from '../../../data/backdrop';
import { WALL_LOOK } from '../../../data/window-look';
import { MS_PER_SECOND } from '../../../util/math';

/** How often a wall thing repeats on the wall: the screens from the start copy to the second copy, then between copies. */
export interface WallSeries {
  firstGap: number;
  spacing: number;
  pool: number;
}

/** How far (px) the wall has moved down since the start view, for the camera at `scrollY` (the start view has `startScrollY`). */
export function wallDownAt(scrollY: number, startScrollY: number): number {
  return (startScrollY - scrollY) * (ANIM.parallax[WALL_LOOK.layer] ?? 1);
}

/** Sideways shift (px) of a wall thing at `timeMs`: the wall's drift, of which things follow `WALL_LOOK.driftFollow`. */
export function wallDriftX(timeMs: number): number {
  const drift = BACKDROP.drift.kitchen[WALL_LOOK.layer] ?? 0;
  return (-drift * WALL_LOOK.driftFollow * timeMs) / MS_PER_SECOND;
}

/** Where a point of the wall stands on the screen: `anchor` is its place on the start view. Same as a point of the layer's texture. */
export function wallPoint(
  anchorX: number,
  anchorY: number,
  wallDown: number,
  timeMs: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = anchorX + wallDriftX(timeMs);
  out.y = anchorY + wallDown;
  return out;
}

/** Px above the start copy at which copy `n` of a series stands on a screen `height` tall. */
export function seriesRise(n: number, series: WallSeries, height: number): number {
  return n <= 0 ? 0 : (series.firstGap + (n - 1) * series.spacing) * height;
}

/**
 * The copy that pool slot `slot` shows now: of the copies with `n % pool === slot` the one nearest the middle of the
 * screen, so a slot always has the same side and a copy leaving at the bottom is replaced by the next one above.
 * `y0` is the start copy's centre on the start view.
 */
export function slotCopy(
  slot: number,
  series: WallSeries,
  y0: number,
  wallDown: number,
  height: number,
): number {
  const rise = y0 + wallDown - height / 2;
  const star = 1 + (rise / height - series.firstGap) / series.spacing;
  const m = Math.max(0, Math.round((star - slot) / series.pool));
  return slot + m * series.pool;
}

/** Odd copies stand on the other side of the tower. */
export function copyMirrored(n: number): boolean {
  return n % 2 === 1;
}
