/** Pure numbers of bars and ring arcs (drawn in `volume-bar.ts`). */

import { clamp01, TWO_PI } from '../../../util/math';
import type { Pt } from '../../fx/common/plain-style';

/** A ring starts at twelve o'clock and runs clockwise. */
export const ARC_START = -Math.PI / 2;

/** Width of the filled part of a bar: `share` of `width`, never narrower than its two rounded caps (0 stays 0). */
export function barFillWidth(share: number, width: number, radius: number): number {
  const filled = clamp01(share) * width;
  return filled > 0 ? Math.max(filled, radius * 2) : 0;
}

/** Where an arc of `share` of a full turn ends. */
export function arcEnd(share: number): number {
  return ARC_START + TWO_PI * clamp01(share);
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

/** A rounded bar: top-left corner, size and corner radius (half the height makes a pill). */
export interface BarBox {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
}

/** The corner radius a bar of this box really gets: never more than half its height or width. */
export function barRadius(box: Readonly<BarBox>): number {
  return Math.max(0, Math.min(box.radius, box.height / 2, box.width / 2));
}

/**
 * The outline of a rounded bar, clockwise (screen y down) from the left end of its top edge; each rounded corner is
 * traced in chords of about `stepPx`.
 */
export function roundedOutline(box: Readonly<BarBox>, stepPx: number): Pt[] {
  const { left, top, width, height } = box;
  const r = barRadius(box);
  const right = left + width;
  const bottom = top + height;
  const chords = Math.max(1, Math.ceil((r * Math.PI) / 2 / stepPx));
  const corners: readonly [number, number, number][] = [
    [right - r, top + r, -Math.PI / 2],
    [right - r, bottom - r, 0],
    [left + r, bottom - r, Math.PI / 2],
    [left + r, top + r, Math.PI],
  ];
  const points: Pt[] = [];
  for (const [cx, cy, from] of corners) {
    for (let i = 0; i <= chords; i++) {
      const a = from + (i / chords) * (Math.PI / 2);
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return points;
}

/** Which side of the edge `a`→`b` a point is on: ≥ 0 inside a clockwise (screen y down) outline. */
function side(a: Pt, b: Pt, p: Pt): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** The part of a convex outline inside another convex outline, both clockwise (screen y down). */
export function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let kept: Pt[] = [...subject];
  clip.forEach((a, i) => {
    const b = clip[(i + 1) % clip.length] ?? a;
    const input = kept;
    kept = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length] ?? p;
      const sp = side(a, b, p);
      const sq = side(a, b, q);
      if (sp >= 0) kept.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        kept.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    });
  });
  return kept;
}

/**
 * The lit face of a bar fill: a pill of `faceHeight` along the top of the bar (its own rounded bottom leaves the shade
 * tone along the bottom), cut to the bar's outline so its ends never stick out past the curve of the shade pill under
 * it, at any fill.
 */
export function barFaceOutline(box: Readonly<BarBox>, faceHeight: number, stepPx: number): Pt[] {
  const face = { ...box, height: faceHeight, radius: Math.min(barRadius(box), faceHeight / 2) };
  return clipConvex(roundedOutline(face, stepPx), roundedOutline(box, stepPx));
}
