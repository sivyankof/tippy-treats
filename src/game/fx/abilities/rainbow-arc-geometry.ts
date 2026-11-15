export interface Point {
  x: number;
  y: number;
}

/** A point of the outline of a rounded rectangle and how far along the outline it lies (0..1). */
export interface RimPoint extends Point {
  u: number;
}

const QUARTER_STEPS = 4;

/**
 * Which way the arc bows, -1 (left) or 1 (right): the side of `to` once it is more than `deadPx`
 * away from `from` sideways, otherwise the side it bowed to before (no flip-flopping over the tower).
 */
export function arcSide(current: number, dx: number, deadPx: number): number {
  return Math.abs(dx) > deadPx ? Math.sign(dx) : current;
}

/**
 * Points along a quadratic curve from `from` to `to` whose control point lies `lift` of the
 * distance above the middle and `side` (signed, a share of the distance) to the side of it, so
 * the curve leaves `from` sideways and up, from the start to the share `grown` of the curve
 * (above 1 it runs past the end). Each point has the unit normal of the curve, always pointing up.
 */
export function arcCurve(
  from: Point,
  to: Point,
  lift: number,
  side: number,
  grown: number,
  steps: number,
): Array<Point & { nx: number; ny: number }> {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const cx = (from.x + to.x) / 2 + dist * side;
  const cy = (from.y + to.y) / 2 - dist * lift;
  const out: Array<Point & { nx: number; ny: number }> = [];
  const count = Math.max(1, Math.round(steps * grown));
  for (let i = 0; i <= count; i++) {
    const t = (grown * i) / count;
    const k = 1 - t;
    const x = k * k * from.x + 2 * k * t * cx + t * t * to.x;
    const y = k * k * from.y + 2 * k * t * cy + t * t * to.y;
    const dx = 2 * k * (cx - from.x) + 2 * t * (to.x - cx);
    const dy = 2 * k * (cy - from.y) + 2 * t * (to.y - cy);
    const len = Math.hypot(dx, dy) || 1;
    const flip = dx > 0 ? -1 : 1;
    out.push({ x, y, nx: (flip * -dy) / len, ny: (flip * dx) / len });
  }
  return out;
}

/** The outline of a rounded rectangle as a closed polyline (first point repeated at the end), clockwise from the top-left. */
export function rimPolyline(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  segmentPx: number,
): RimPoint[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const pts: Point[] = [];
  const edge = (ax: number, ay: number, bx: number, by: number): void => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / segmentPx));
    for (let i = 0; i < n; i++)
      pts.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n });
  };
  const corner = (cx: number, cy: number, startRad: number): void => {
    for (let i = 0; i < QUARTER_STEPS; i++) {
      const a = startRad + ((Math.PI / 2) * i) / QUARTER_STEPS;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  const right = x + width;
  const bottom = y + height;
  edge(x + r, y, right - r, y);
  corner(right - r, y + r, -Math.PI / 2);
  edge(right, y + r, right, bottom - r);
  corner(right - r, bottom - r, 0);
  edge(right - r, bottom, x + r, bottom);
  corner(x + r, bottom - r, Math.PI / 2);
  edge(x, bottom - r, x, y + r);
  corner(x + r, y + r, Math.PI);
  pts.push({ ...pts[0]! });
  let total = 0;
  const lengths = pts.map((p, i) => {
    if (i > 0) total += Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y);
    return total;
  });
  return pts.map((p, i) => ({ ...p, u: total > 0 ? lengths[i]! / total : 0 }));
}

/** Index of the colour band at position `u` (0..1) of the outline, with the colours slid by `phase` of a cycle. */
export function bandAt(u: number, phase: number, cycles: number, bands: number): number {
  const k = Math.floor((u * cycles + phase) * bands);
  return ((k % bands) + bands) % bands;
}

/** Width multiplier at position `u` (0..1) of the arc while a swell centred at `at` runs along it. */
export function swell(u: number, at: number, bulge: number, sigma: number): number {
  const d = (u - at) / sigma;
  return 1 + bulge * Math.exp(-d * d);
}
