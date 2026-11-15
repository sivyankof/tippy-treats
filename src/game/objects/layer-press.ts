/**
 * A layer pressed down at one spot (it landed on the guest of the tower): it tilts around its
 * bottom corner on the far side, so that spot dips while the far end stays on the seam.
 * Offsets are pixels from the bottom centre of the layer, x to the right and y down.
 */

/** The bottom corner the layer tilts around: on the side away from `dx`, at `halfWidth`. */
export function pressPivot(dx: number, halfWidth: number): number {
  return dx < 0 ? halfWidth : -halfWidth;
}

/**
 * The tilt (radians, positive turns clockwise) around `pressPivot` that drops the bottom edge at
 * `dx` by `dipPx`. 0 for a layer with no width.
 */
export function pressAngle(dx: number, halfWidth: number, dipPx: number): number {
  const arm = dx - pressPivot(dx, halfWidth);
  if (arm === 0) return 0;
  return Math.asin(Math.max(-1, Math.min(1, dipPx / arm)));
}

/** How far the bottom edge at `dx` has dropped with the tilt `angle` around the corner `pivot`. */
export function pressDrop(dx: number, pivot: number, angle: number): number {
  return (dx - pivot) * Math.sin(angle);
}

/**
 * The shift that keeps the corner `pivot` in place while the layer turns by `angle` around its
 * bottom centre. Fills and returns `out`.
 */
export function pressShift(
  pivot: number,
  angle: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = pivot * (1 - Math.cos(angle));
  out.y = -pivot * Math.sin(angle);
  return out;
}
