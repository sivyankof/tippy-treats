import { LICK } from '../../data/lick';

/**
 * The centre line of the tongue as a smooth chain of samples: a position, the unit direction of
 * travel and the half width at each one. Filled by `sampleRibbon`, drawn by `tongue-draw.ts`.
 */
export interface Ribbon {
  count: number;
  x: number[];
  y: number[];
  /** Unit direction of travel (from the root to the tip). */
  tx: number[];
  ty: number[];
  /** Half the width of the ribbon (without its outline). */
  half: number[];
}

/** An empty ribbon with room for the samples of a tongue of `LICK.tongue.segments` pieces. */
export function newRibbon(): Ribbon {
  const size = LICK.tongue.segments * LICK.tongue.draw.sub + 1;
  const zeros = (): number[] => new Array<number>(size).fill(0);
  return { count: 0, x: zeros(), y: zeros(), tx: zeros(), ty: zeros(), half: zeros() };
}

/** A point of the Catmull-Rom curve through `p1` and `p2` at `t` (0..1), on one axis. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (3 * p1 - p0 - 3 * p2 + p3) * t3)
  );
}

/** The coordinate `axis` (0 x, 1 y) of point `i` of `points`, the ends held for indexes outside. */
function pointAt(points: readonly number[], n: number, i: number, axis: 0 | 1): number {
  return points[Math.min(n, Math.max(0, i)) * 2 + axis]!;
}

/** Shortest direction vector worth normalising. */
const MIN_STEP = 1e-6;

/**
 * Smooths the body `points` (flat `[x0, y0, ...]`, `LICK.tongue.segments + 1` of them, from the
 * mouth to the tip) into `out`: `LICK.tongue.draw.sub` samples per piece with the directions of
 * travel and `halfAt(i)` (half width at the fractional point index `i`). False when the body
 * has no length (nothing to draw).
 */
export function sampleRibbon(
  points: readonly number[],
  halfAt: (index: number) => number,
  out: Ribbon,
): boolean {
  const n = LICK.tongue.segments;
  const { sub } = LICK.tongue.draw;
  const count = n * sub + 1;
  out.count = count;
  for (let j = 0; j < count; j++) {
    const i = Math.min(n - 1, Math.floor(j / sub));
    const t = j / sub - i;
    out.x[j] = catmullRom(
      pointAt(points, n, i - 1, 0),
      pointAt(points, n, i, 0),
      pointAt(points, n, i + 1, 0),
      pointAt(points, n, i + 2, 0),
      t,
    );
    out.y[j] = catmullRom(
      pointAt(points, n, i - 1, 1),
      pointAt(points, n, i, 1),
      pointAt(points, n, i + 1, 1),
      pointAt(points, n, i + 2, 1),
      t,
    );
    out.half[j] = halfAt(j / sub) / 2;
  }
  // Directions from the neighbours, so the edges of the ribbon are smooth through every sample.
  let any = false;
  for (let j = 0; j < count; j++) {
    const a = Math.max(0, j - 1);
    const b = Math.min(count - 1, j + 1);
    const dx = out.x[b]! - out.x[a]!;
    const dy = out.y[b]! - out.y[a]!;
    const length = Math.hypot(dx, dy);
    if (length > MIN_STEP) {
      out.tx[j] = dx / length;
      out.ty[j] = dy / length;
      any = true;
    } else {
      // No length here: keep the direction of the sample before (or up, at the root).
      out.tx[j] = j > 0 ? out.tx[j - 1]! : 0;
      out.ty[j] = j > 0 ? out.ty[j - 1]! : -1;
    }
  }
  return any;
}
