/** Pure numbers of bars and ring arcs (drawn in `volume-bar.ts`). */

const FULL_TURN = Math.PI * 2;
/** A ring starts at twelve o'clock and runs clockwise. */
export const ARC_START = -Math.PI / 2;

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Width of the filled part of a bar: `share` of `width`, never narrower than its two rounded caps (0 stays 0). */
export function barFillWidth(share: number, width: number, radius: number): number {
  const filled = clamp01(share) * width;
  return filled > 0 ? Math.max(filled, radius * 2) : 0;
}

/** Where an arc of `share` of a full turn ends. */
export function arcEnd(share: number): number {
  return ARC_START + FULL_TURN * clamp01(share);
}

/** The angle a round cap of half `ringWidth` covers on a ring of `radius`. */
export function capAngle(radius: number, ringWidth: number): number {
  return ringWidth / 2 / radius;
}

/**
 * The part of an arc a soft layer (shade or gloss) covers: it stops a cap short at both ends so
 * it never lies over the round caps. Null when the arc is too short for it.
 */
export function inset(share: number, cap: number): { from: number; to: number } | null {
  const from = ARC_START + cap;
  const to = arcEnd(share) - cap;
  return to > from ? { from, to } : null;
}
