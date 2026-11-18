import { describe, expect, it } from 'vitest';
import {
  ARC_START,
  arcEnd,
  barFaceOutline,
  barFillWidth,
  capAngle,
  inset,
  clipConvex,
  roundedOutline,
  type BarBox,
} from './bar-geometry';

/** How far a point lies outside a rounded bar (0 inside it). */
function outside(box: BarBox, x: number, y: number): number {
  const r = Math.min(box.radius, box.height / 2, box.width / 2);
  const cx = Math.min(Math.max(x, box.left + r), box.left + box.width - r);
  const cy = Math.min(Math.max(y, box.top + r), box.top + box.height - r);
  return Math.max(0, Math.hypot(x - cx, y - cy) - r);
}

describe('barFillWidth', () => {
  it('is zero for an empty bar and never narrower than the caps otherwise', () => {
    expect(barFillWidth(0, 100, 10)).toBe(0);
    expect(barFillWidth(0.01, 100, 10)).toBe(20);
    expect(barFillWidth(0.5, 100, 10)).toBe(50);
  });
  it('clamps the share', () => {
    expect(barFillWidth(3, 100, 10)).toBe(100);
    expect(barFillWidth(-1, 100, 10)).toBe(0);
  });
});

describe('arcs', () => {
  it('starts at twelve o clock and runs a full turn', () => {
    expect(arcEnd(0)).toBe(ARC_START);
    expect(arcEnd(1) - ARC_START).toBeCloseTo(Math.PI * 2);
    expect(arcEnd(2)).toBeCloseTo(arcEnd(1));
  });
  it('shortens soft layers by a cap at both ends', () => {
    const cap = capAngle(100, 20);
    expect(cap).toBeCloseTo(0.1);
    const span = inset(0.5, cap);
    expect(span?.from).toBeCloseTo(ARC_START + cap);
    expect(span?.to).toBeCloseTo(arcEnd(0.5) - cap);
  });
  it('drops soft layers on a very short arc', () => {
    expect(inset(0.01, capAngle(100, 20))).toBeNull();
  });
});

describe('the lit face of a bar fill', () => {
  // The XP bar (a pill), a mission bar (smaller corners) and a fill as narrow as its caps.
  const boxes: BarBox[] = [
    { left: 10, top: 20, width: 300, height: 44, radius: 22 },
    { left: 0, top: 0, width: 120, height: 46, radius: 18 },
    { left: -5, top: -14, width: 28, height: 28, radius: 14 },
  ];

  it('traces the rounded outline on its curve', () => {
    for (const box of boxes) {
      for (const p of roundedOutline(box, 2)) expect(outside(box, p.x, p.y)).toBeLessThan(1e-9);
    }
  });

  it('stays inside the shade pill at every fill and reaches the cut line', () => {
    for (const base of boxes) {
      for (const width of [base.height, base.height * 1.5, base.width]) {
        const box = { ...base, width };
        const face = barFaceOutline(box, box.height * 0.7, 2);
        expect(face.length).toBeGreaterThan(4);
        for (const p of face) {
          expect(outside(box, p.x, p.y)).toBeLessThan(1e-9);
          expect(p.y).toBeLessThanOrEqual(box.top + box.height * 0.7 + 1e-9);
        }
        expect(Math.max(...face.map((p) => p.y))).toBeCloseTo(box.top + box.height * 0.7);
      }
    }
  });

  it('keeps the face where it lay inside the pill: the full width along the top, its own round bottom', () => {
    const box = boxes[0] as BarBox;
    const face = barFaceOutline(box, 30, 2);
    const xs = face.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(box.left, 0);
    expect(Math.max(...xs)).toBeCloseTo(box.left + box.width, 0);
    // The bottom edge is flat only between the face's own rounded ends.
    const bottom = face.filter((p) => p.y > box.top + 30 - 1e-6).map((p) => p.x);
    expect(Math.min(...bottom)).toBeCloseTo(box.left + 15);
    expect(Math.max(...bottom)).toBeCloseTo(box.left + box.width - 15);
  });

  it('clips a convex outline by another', () => {
    const square = (x: number, y: number, size: number): { x: number; y: number }[] => [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ];
    const clipped = clipConvex(square(5, 5, 10), square(0, 0, 10));
    expect(clipped.map((p) => [p.x, p.y]).sort()).toEqual(
      [
        [10, 5],
        [10, 10],
        [5, 10],
        [5, 5],
      ].sort(),
    );
    expect(clipConvex(square(20, 20, 5), square(0, 0, 10))).toEqual([]);
  });
});
