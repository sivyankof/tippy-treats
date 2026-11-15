import { describe, expect, it } from 'vitest';
import { EDGE_SQUASH, type WallFeel } from '../../data/edge-squash';
import { BALANCE } from '../../data/balance';
import { BUBBLE_RIBS, ribLayoutFor } from './edge-squash-ribs';
import {
  bounceWave,
  byPower,
  columnEdge,
  edgeOverflow,
  fitShape,
  flatShape,
  glazeSwing,
  isSquashed,
  knockPulse,
  ribReach,
  slideShift,
  softOverflow,
  speedPower,
  squashGlaze,
  squashMid,
  squashScale,
  squashTallest,
  crownCover,
  squashWidth,
  squashX,
  visibleWalls,
  wantedDepth,
  type ColumnEdge,
  type EdgeShape,
} from './edge-squash';

const { feel, kneePx } = EDGE_SQUASH;
const LAYER_H = BALANCE.layer.height;
const RIBS = ribLayoutFor(1234, 5);
const WALL_L = 12;
const WALL_R = 1068;

/** The shape of a layer `width` wide around `cx` between the test walls. */
function shapeAt(
  cx: number,
  width: number,
  f: Readonly<WallFeel> = feel.normal,
  power = 0,
  ribbing = true,
): EdgeShape {
  const half = width / 2;
  const over = edgeOverflow(cx, half, WALL_L, WALL_R);
  const shape = fitShape(
    half,
    wantedDepth(over.left, kneePx, f),
    wantedDepth(over.right, kneePx, f),
    f,
    flatShape(),
    power,
    ribbing,
  );
  shape.ribs = RIBS;
  shape.ribbing = ribbing;
  return shape;
}

/** How far the smooth wedge of the columns at `u` reaches above and below the normal outline, shares of the layer height. */
function wedge(shape: Readonly<EdgeShape>, u: number): ColumnEdge {
  return columnEdge(shape, u, { up: 0, down: 0 });
}

/** The drawn distance of the column at `u` from the wall of each side it is nearer to. */
function fromWall(shape: Readonly<EdgeShape>, u: number): { side: 'left' | 'right'; d: number } {
  const x = squashX(shape, u) - shape.shift;
  const left = x - shape.edgeLeft;
  const right = shape.edgeRight - x;
  return left < right ? { side: 'left', d: left } : { side: 'right', d: right };
}

/** How far the whole outline (the wedge of the columns and the ribs of the silhouette on it) reaches at `u`, shares of the layer height. */
function reach(shape: Readonly<EdgeShape>, u: number): ColumnEdge {
  const base = wedge(shape, u);
  const at = fromWall(shape, u);
  const ribs = ribReach(shape, shape[at.side], at.d, { up: 0, down: 0 });
  return { up: base.up + ribs.up, down: base.down + ribs.down };
}

/** The most the body grows beyond its normal height anywhere, share of the layer height (glaze included). */
function tallestGrowth(shape: Readonly<EdgeShape>, withRibs = true): { total: number; up: number } {
  let total = 0;
  let up = 0;
  for (let u = -shape.half; u <= shape.half; u += 1) {
    const r = withRibs ? reach(shape, u) : wedge(shape, u);
    const glaze = squashGlaze(shape, u) / LAYER_H;
    if (r.up + glaze + r.down > total) {
      total = r.up + glaze + r.down;
      up = r.up + glaze;
    }
  }
  return { total, up: total > 0 ? up / total : 0 };
}

/** Drawn left and right edges of the body, world x. */
function edges(cx: number, width: number, f?: Readonly<WallFeel>): [number, number] {
  const s = shapeAt(cx, width, f);
  return [cx + squashX(s, -width / 2), cx + squashX(s, width / 2)];
}

describe('softOverflow', () => {
  it('is 0 well inside, the overflow well outside and continuous between', () => {
    expect(softOverflow(-30, 20)).toBe(0);
    expect(softOverflow(-20, 20)).toBe(0);
    expect(softOverflow(20, 20)).toBe(20);
    expect(softOverflow(50, 20)).toBe(50);
    let last = 0;
    for (let e = -20; e <= 20; e += 0.5) {
      const v = softOverflow(e, 20);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v - last).toBeLessThanOrEqual(0.5 + 1e-9);
      last = v;
    }
  });
});

describe('edge squash shape', () => {
  it('leaves a layer away from the walls and a narrow layer at the extreme untouched', () => {
    expect(isSquashed(shapeAt(540, 720))).toBe(false);
    // The narrowest centre the flight reaches; a layer this narrow never comes near the wall.
    expect(isSquashed(shapeAt(140, 200))).toBe(false);
    expect(isSquashed(shapeAt(940, 200))).toBe(false);
  });

  it('keeps a wide layer inside the screen: the edge stops at the wall', () => {
    for (const cx of [140, 160, 200]) {
      const [left] = edges(cx, 720);
      expect(left).toBeCloseTo(WALL_L, 6);
    }
    for (const cx of [940, 900, 880]) {
      const [, right] = edges(cx, 720);
      expect(right).toBeCloseTo(WALL_R, 6);
    }
  });

  it('keeps the far side where it is and squashes only near the wall', () => {
    const s = shapeAt(880, 720);
    expect(squashX(s, -360)).toBe(-360);
    expect(squashScale(s, -200)).toBe(1);
    expect(reach(s, -200)).toEqual({ up: 0, down: 0 });
    expect(squashScale(s, 359)).toBeLessThan(0.9);
  });

  it('is mirrored between the walls', () => {
    const a = shapeAt(150, 600, feel.normal, 0.7);
    const b = shapeAt(1080 - 150, 600, feel.normal, 0.7);
    for (let u = -300; u <= 300; u += 25) {
      expect(squashX(a, u)).toBeCloseTo(-squashX(b, -u), 6);
      expect(reach(a, u).up).toBeCloseTo(reach(b, -u).up, 6);
      expect(reach(a, u).down).toBeCloseTo(reach(b, -u).down, 6);
    }
  });

  it('never folds: columns keep their order and never get narrower than minScale', () => {
    for (const f of Object.values(feel)) {
      for (const cx of [140, 145, 170, 220, 940]) {
        const s = shapeAt(cx, 720, f);
        let last = -Infinity;
        for (let u = -380; u <= 380; u += 2) {
          const x = squashX(s, u);
          expect(x).toBeGreaterThan(last);
          last = x;
          expect(squashScale(s, u)).toBeGreaterThanOrEqual(f.minScale - 1e-9);
        }
      }
    }
  });

  it('is continuous in the position: a small step moves every column a little', () => {
    const step = 0.25;
    for (const f of Object.values(feel)) {
      for (let cx = 140; cx <= 300; cx += step) {
        const a = shapeAt(cx, 720, f, 0.8);
        const b = shapeAt(cx + step, 720, f, 0.8);
        for (let u = -360; u <= 360; u += 30) {
          // A column can move at most by the step itself plus the squash it takes up.
          expect(Math.abs(cx + step + squashX(b, u) - (cx + squashX(a, u)))).toBeLessThan(step * 3);
          // The foot of a rib is a cusp (round bumps, pointed hollows), so allow a little more there.
          expect(Math.abs(reach(b, u).up - reach(a, u).up)).toBeLessThan(0.03);
          expect(Math.abs(reach(b, u).down - reach(a, u).down)).toBeLessThan(0.03);
        }
      }
    }
  });

  it('gets stronger the further the centre goes towards the wall', () => {
    let last = 0;
    for (let cx = 340; cx >= 140; cx -= 10) {
      const depth = shapeAt(cx, 720).left.depth;
      expect(depth).toBeGreaterThanOrEqual(last);
      last = depth;
    }
    expect(last).toBeGreaterThan(200);
  });

  it('makes the side at the wall taller and leaves the far side alone', () => {
    const s = shapeAt(140, 720, feel.normal, 1);
    expect(tallestGrowth(s).total).toBeGreaterThan(0.2);
    expect(reach(s, 355)).toEqual({ up: 0, down: 0 });
    expect(reach(s, 300)).toEqual({ up: 0, down: 0 });
  });

  it('gives a soft material a longer, taller squash and a hard one hardly any', () => {
    const soft = shapeAt(140, 720, feel.soft, 0.5, false);
    const normal = shapeAt(140, 720, feel.normal, 0.5, false);
    const hard = shapeAt(140, 720, feel.hard, 0.5, false);
    // At the deepest squash both zones fill the whole width: compare them a little further out.
    expect(shapeAt(300, 720, feel.soft).left.zone).toBeGreaterThan(
      shapeAt(300, 720, feel.normal).left.zone,
    );
    expect(tallestGrowth(soft, false).total).toBeGreaterThan(
      tallestGrowth(normal, false).total * 1.2,
    );
    expect(tallestGrowth(hard, false).total).toBeLessThan(tallestGrowth(normal, false).total * 0.4);
    expect(hard.left.depth).toBeLessThan(normal.left.depth * 0.5);
  });

  it('reports the drawn body: shifted away from the wall and narrower', () => {
    const s = shapeAt(140, 720);
    const [left, right] = edges(140, 720);
    expect(140 + squashMid(s)).toBeCloseTo((left + right) / 2, 6);
    expect(squashWidth(s)).toBeCloseTo(right - left, 6);
    expect(squashMid(s)).toBeGreaterThan(0);
  });

  it('shares the width between two walls without folding when both are hit', () => {
    const half = 600;
    const s = fitShape(half, 200, 100, feel.normal, flatShape());
    expect(s.left.zone + s.right.zone).toBeLessThanOrEqual(half * 2 + 1e-9);
    let last = -Infinity;
    for (let u = -half; u <= half; u += 5) {
      const x = squashX(s, u);
      expect(x).toBeGreaterThan(last);
      last = x;
    }
  });
});

describe('bounce and knock', () => {
  it('start from zero, so nothing jumps', () => {
    expect(bounceWave(0, 220, 160)).toBe(0);
    expect(Math.abs(bounceWave(1, 220, 160))).toBeLessThan(0.05);
    expect(bounceWave(Infinity, 220, 160)).toBe(0);
    expect(knockPulse(0, 130)).toBe(0);
    expect(knockPulse(65, 130)).toBeCloseTo(1, 6);
    expect(knockPulse(130, 130)).toBe(0);
  });

  it('the bounce only deepens the squash and dies down', () => {
    for (let t = 0; t < 1000; t += 5) expect(bounceWave(t, 220, 160)).toBeGreaterThanOrEqual(0);
    expect(bounceWave(110, 220, 160)).toBeGreaterThan(0.4);
    expect(bounceWave(1000, 220, 160)).toBeLessThan(0.01);
  });
});

describe('hard layer slide', () => {
  const hard = feel.hard;

  /** The shape of a hard layer with the slide applied, like `FlyingEdgeSquash.draw`. */
  function hardShape(cx: number, width: number): EdgeShape {
    const half = width / 2;
    const over = edgeOverflow(cx, half, WALL_L, WALL_R);
    const s = shapeAt(cx, width, hard, 1);
    s.shift = slideShift(over.left, over.right, kneePx, hard);
    return s;
  }

  it('keeps the drawn edge at the wall however far the centre goes', () => {
    for (let cx = 140; cx >= 100; cx -= 4) {
      const s = hardShape(cx, 720);
      expect(cx + squashX(s, -360)).toBeGreaterThanOrEqual(WALL_L - 1e-6);
    }
    const deep = hardShape(140, 720);
    expect(140 + squashX(deep, -360)).toBeCloseTo(WALL_L, 6);
    const right = hardShape(WALL_R - 140, 720);
    expect(WALL_R - 140 + squashX(right, 360)).toBeCloseTo(WALL_R, 6);
  });

  it('puts the middle of the body at the middle of the visible part', () => {
    const s = hardShape(140, 720);
    expect(140 + squashMid(s)).toBeGreaterThan(140 + 100);
  });

  it('slides continuously with the position and not at all away from the walls', () => {
    expect(slideShift(-100, -100, kneePx, hard)).toBe(0);
    let last = slideShift(-40, -100, kneePx, hard);
    for (let e = -39; e < 200; e++) {
      const now = slideShift(e, -100, kneePx, hard);
      expect(Math.abs(now - last)).toBeLessThan(1.1);
      last = now;
    }
  });

  it('is zero for materials that give all the overflow', () => {
    expect(slideShift(200, -100, kneePx, feel.normal)).toBe(0);
  });

  it('reports the tallest column, 1 when flat', () => {
    expect(squashTallest(flatShape())).toBe(1);
    const s = shapeAt(140, 720);
    expect(squashTallest(s)).toBeGreaterThan(1);
    expect(squashTallest(s)).toBe(1 + s.left.rise + s.left.ribUp + s.left.ribDown);
  });

  it('squeezes the column at the wall harder with the edge bias, the far side stays put', () => {
    const plain: WallFeel = { ...feel.normal, edgeBias: 0 };
    const biased = shapeAt(300, 720, feel.normal);
    const flat = shapeAt(300, 720, plain);
    expect(squashScale(biased, -359)).toBeLessThan(squashScale(flat, -359) * 0.85);
    expect(squashScale(biased, -359)).toBeGreaterThanOrEqual(feel.normal.minScale - 1e-9);
    expect(squashScale(biased, 100)).toBe(1);
    expect(squashX(biased, 100)).toBe(100);
  });

  it('keeps a hard material nearly flat', () => {
    const hard = shapeAt(140, 720, feel.hard);
    expect(squashScale(hard, -359)).toBeGreaterThanOrEqual(feel.hard.minScale - 1e-9);
    expect(hard.left.ribUp).toBe(0);
    expect(hard.left.ribDown).toBe(0);
  });

  it('gathers the glaze only where the width was lost and sags it at the wall itself', () => {
    const s = shapeAt(180, 720);
    expect(squashGlaze(s, 300)).toBe(0);
    expect(squashGlaze(s, -250)).toBeGreaterThan(0);
    expect(squashGlaze(s, -250)).toBeGreaterThan(squashGlaze(s, -359) * 0.5);
    const flat = flatShape();
    expect(squashGlaze(flat, 0)).toBe(0);
  });

  it('swings the glaze spring from rest without a jump and settles', () => {
    const { periodMs, decayMs } = EDGE_SQUASH.glazeSpring;
    expect(glazeSwing(0, periodMs, decayMs)).toBe(0);
    expect(glazeSwing(Infinity, periodMs, decayMs)).toBe(0);
    expect(Math.abs(glazeSwing(2000, periodMs, decayMs))).toBeLessThan(0.001);
    expect(glazeSwing(periodMs / 4, periodMs, decayMs)).toBeGreaterThan(0);
  });
});

describe('wedge strength by speed', () => {
  const { base, max } = BALANCE.speed;

  it('maps the speed to a share between the base and the maximum speed, smoothly', () => {
    expect(speedPower(base)).toBe(0);
    expect(speedPower(max)).toBe(1);
    expect(speedPower(base - 100)).toBe(0);
    expect(speedPower(max + 500)).toBe(1);
    expect(speedPower((base + max) / 2)).toBeCloseTo(0.5, 9);
    expect(byPower(EDGE_SQUASH.byPower.rise, 0)).toBe(EDGE_SQUASH.byPower.rise[0]);
    expect(byPower(EDGE_SQUASH.byPower.rise, 1)).toBe(EDGE_SQUASH.byPower.rise[1]);
  });

  it('a slow layer rises 12-15% at the wall, a fast one 25-30% (the wedge itself, without the ribs)', () => {
    const slow = tallestGrowth(shapeAt(140, 720, feel.normal, 0, false), false);
    const fast = tallestGrowth(shapeAt(140, 720, feel.normal, 1, false), false);
    expect(slow.total).toBeGreaterThanOrEqual(0.12);
    expect(slow.total).toBeLessThanOrEqual(0.15);
    expect(fast.total).toBeGreaterThanOrEqual(0.25);
    expect(fast.total).toBeLessThanOrEqual(0.3);
  });

  it('grows with the speed, step by step', () => {
    let last = tallestGrowth(shapeAt(140, 720, feel.normal, 0, false), false).total;
    for (let p = 0.05; p <= 1; p += 0.05) {
      const now = tallestGrowth(shapeAt(140, 720, feel.normal, p, false), false).total;
      expect(now).toBeGreaterThanOrEqual(last - 1e-9);
      expect(now - last).toBeLessThan(0.02);
      last = now;
    }
  });

  it('spreads mostly upwards: about 80% of the added height', () => {
    for (const p of [0, 0.5, 1]) {
      const share = tallestGrowth(shapeAt(140, 720, feel.normal, p)).up;
      expect(share).toBeGreaterThanOrEqual(0.75);
      expect(share).toBeLessThanOrEqual(0.88);
    }
  });

  it('is a wedge a quarter of the layer long, longer on a deep squash but never past a third', () => {
    const shallow = shapeAt(360, 720, feel.normal, 1);
    expect(shallow.left.len).toBeGreaterThan(720 * 0.25 - 1e-6);
    expect(shallow.left.len).toBeLessThan(720 * 0.27);
    for (const f of Object.values(feel)) {
      for (let cx = 140; cx >= 80; cx -= 6) {
        for (const power of [0, 1]) {
          const len = shapeAt(cx, 720, f, power).left.len;
          expect(len).toBeLessThanOrEqual(720 / 3 + 1e-9);
        }
      }
    }
    const deep = shapeAt(140, 720, feel.normal, 1);
    expect(deep.left.len).toBeGreaterThan(shallow.left.len);
    expect(deep.left.len).toBeLessThanOrEqual(720 / 3 + 1e-9);
    const s = deep;
    const end = squashX(s, -360) + s.left.len + 1;
    let u = -360;
    while (squashX(s, u) < end) u += 1;
    expect(reach(s, u)).toEqual({ up: 0, down: 0 });
    // And the part near the wall is taller than the part towards the end of the wedge.
    let near = 0;
    let far = 0;
    for (let x = -360; x < 360; x += 0.5) {
      const d = squashX(s, x) - squashX(s, -360);
      const up = reach(s, x).up;
      if (d < s.left.len * 0.3) near = Math.max(near, up);
      if (d > s.left.len * 0.6 && d < s.left.len) far = Math.max(far, up);
    }
    expect(near).toBeGreaterThan(far * 1.3);
  });

  it('is tallest right at the wall and the outline never rises above that further in', () => {
    for (const p of [0, 0.5, 1]) {
      for (const f of [feel.normal, feel.soft]) {
        for (let layer = 1; layer <= 40; layer++) {
          const s = shapeAt(140, 720, f, p);
          s.ribs = ribLayoutFor(1234, layer);
          const wall = reach(s, -360);
          const wallTop = wall.up;
          const wallBottom = wall.down;
          expect(wallTop).toBeGreaterThan(0);
          for (let u = -359; u <= 360; u += 1) {
            const r = reach(s, u);
            expect(r.up).toBeLessThanOrEqual(wallTop + 1e-9);
            expect(r.down).toBeLessThanOrEqual(wallBottom + 1e-9);
          }
        }
      }
    }
  });

  it('makes the ribs and the glaze bulge bigger with the speed: small when slow, plump when fast', () => {
    // The ribs have their own height: ~1.5 times the old one when slow, ~2 times when fast.
    const ribs = (power: number): number => shapeAt(140, 720, feel.normal, power).left.ribUp;
    expect(ribs(1)).toBeGreaterThan(ribs(0) * 2.5);
    const bulge = (power: number): number => {
      const s = shapeAt(140, 720, feel.normal, power);
      let best = 0;
      for (let u = -359; u <= 0; u += 1) best = Math.max(best, squashGlaze(s, u));
      return best;
    };
    expect(bulge(1)).toBeGreaterThan(bulge(0) * 2.5);
  });

  it('draws round bumps, not a staircase: every rib stands clear of the hollow before it', () => {
    for (const power of [0, 1]) {
      for (let layer = 1; layer <= 40; layer++) {
        const s = shapeAt(140, 720, feel.normal, power);
        s.ribs = ribLayoutFor(1234, layer);
        const d0 = squashX(s, -360);
        const heights: number[] = [];
        for (let x = 0; x < s.left.len; x += 0.5) {
          // The column drawn x px from the wall.
          let u = -360;
          while (squashX(s, u) - d0 < x) u += 0.25;
          heights.push(reach(s, u).up);
        }
        // Local peaks standing above the dips on both sides by a clear margin (of the layer height).
        let peaks = 0;
        let min = heights[0]!;
        let top = heights[0]!;
        let rising = true;
        for (const h of heights) {
          if (rising) {
            top = Math.max(top, h);
            if (h < top - 0.01) {
              peaks++;
              rising = false;
              min = h;
            }
          } else {
            min = Math.min(min, h);
            if (h > min + 0.01) {
              rising = true;
              top = h;
            }
          }
        }
        const lastShown = s.lastRib > 0.5 ? 4 : 3;
        expect(peaks).toBeGreaterThanOrEqual(power === 1 ? lastShown - 1 : 1);
      }
    }
  });

  it('shows 3 ribs at a slow speed and 4 at a fast one, the fourth fading in', () => {
    expect(shapeAt(140, 720, feel.normal, 0).lastRib).toBe(0);
    expect(shapeAt(140, 720, feel.normal, 1).lastRib).toBe(1);
    let last = 0;
    for (let p = 0; p <= 1; p += 0.02) {
      const now = shapeAt(140, 720, feel.normal, p).lastRib;
      expect(now).toBeGreaterThanOrEqual(last);
      expect(now - last).toBeLessThan(0.2);
      last = now;
    }
  });

  it('keeps the whole wedge without the ribs (fewer effects): smooth, no bumps', () => {
    const ribbed = shapeAt(140, 720, feel.normal, 1);
    const plain = shapeAt(140, 720, feel.normal, 1);
    plain.ribbing = false;
    // The ribs make the outline uneven; without them it only ever goes down away from the wall.
    let lastUp = Infinity;
    let bumps = 0;
    let lastRibbed = Infinity;
    for (let u = -355; u <= -150; u += 1) {
      const a = reach(plain, u).up;
      expect(a).toBeLessThanOrEqual(lastUp + 1e-9);
      lastUp = a;
      const b = reach(ribbed, u).up;
      if (b > lastRibbed + 1e-9) bumps++;
      lastRibbed = b;
    }
    expect(bumps).toBeGreaterThan(5);
    // The wedge is the same with or without the ribs; the ribs only stand on top of it.
    expect(tallestGrowth(plain).total).toBeCloseTo(tallestGrowth(ribbed, false).total, 9);
    expect(tallestGrowth(ribbed).total).toBeGreaterThan(tallestGrowth(plain).total);
  });

  it('springs the ribs: a swing of the spring changes their height, 1 is the rest', () => {
    const rest = shapeAt(140, 720, feel.normal, 1);
    const high = shapeAt(140, 720, feel.normal, 1);
    high.left.spring = 1.5;
    let sum = 0;
    let sumHigh = 0;
    for (let u = -355; u <= -150; u += 1) {
      sum += reach(rest, u).up;
      sumHigh += reach(high, u).up;
    }
    expect(sumHigh).toBeGreaterThan(sum);
  });

  it('never draws a column beyond the wall for a hard layer with ribs, slid and bounced', () => {
    for (let cx = 140; cx >= 100; cx -= 4) {
      const half = 360;
      const over = edgeOverflow(cx, half, WALL_L, WALL_R);
      const wanted = wantedDepth(over.left, kneePx, feel.hard);
      for (let bounce = 1; bounce <= 1.2; bounce += 0.05) {
        const s = fitShape(half, wanted * bounce + feel.hard.knockPx, 0, feel.hard, flatShape(), 1);
        s.ribs = RIBS;
        s.shift = slideShift(over.left, over.right, kneePx, feel.hard);
        for (let u = -half; u <= half; u += 3) {
          expect(cx + squashX(s, u)).toBeGreaterThanOrEqual(WALL_L - 1e-6);
        }
      }
    }
  });

  it('never draws a column beyond the wall, with the bounce on top of any depth', () => {
    for (let cx = 140; cx <= 200; cx += 4) {
      const half = 360;
      const over = edgeOverflow(cx, half, WALL_L, WALL_R);
      for (let bounce = 1; bounce <= 1.3; bounce += 0.05) {
        const s = fitShape(
          half,
          wantedDepth(over.left, kneePx, feel.normal) * bounce,
          0,
          feel.normal,
          flatShape(),
          1,
        );
        s.ribs = RIBS;
        for (let u = -half; u <= half; u += 3) {
          expect(cx + squashX(s, u)).toBeGreaterThanOrEqual(WALL_L - 1e-6);
        }
      }
    }
  });
});

describe('ribs of the silhouette', () => {
  it('stand out of the wedge at the wall: together with it they make the rise, the wall rib the highest', () => {
    const s = shapeAt(140, 720, feel.normal, 1);
    const wall = ribReach(s, s.left, 0, { up: 0, down: 0 });
    expect(wall.up).toBeGreaterThan(wall.down);
    expect(wall.up).toBeGreaterThan(0.1);
    for (let d = 1; d < s.left.len; d += 1) {
      const r = ribReach(s, s.left, d, { up: 0, down: 0 });
      expect(r.up).toBeLessThanOrEqual(wall.up + 1e-9);
    }
    expect(ribReach(s, s.left, s.left.len, { up: 0, down: 0 })).toEqual({ up: 0, down: 0 });
    expect(ribReach(s, s.left, -5, { up: 0, down: 0 }).up).toBeCloseTo(wall.up, 9);
  });

  it('are none without a rise, in fewer effects and for a hard layer', () => {
    const s = shapeAt(140, 720, feel.normal, 1, false);
    expect(ribReach(s, s.left, 0, { up: 0, down: 0 })).toEqual({ up: 0, down: 0 });
    const hard = shapeAt(140, 720, feel.hard, 1);
    expect(ribReach(hard, hard.left, 0, { up: 0, down: 0 })).toEqual({ up: 0, down: 0 });
    const flat = flatShape();
    flat.ribs = RIBS;
    expect(ribReach(flat, flat.left, 0, { up: 0, down: 0 })).toEqual({ up: 0, down: 0 });
  });

  it('leave the columns a smooth wedge: the outline of the columns alone only ever goes down away from the wall', () => {
    for (let layer = 1; layer <= 20; layer++) {
      const s = shapeAt(140, 720, feel.normal, 1);
      s.ribs = ribLayoutFor(1234, layer);
      let last = Infinity;
      for (let u = -360; u <= -100; u += 1) {
        const up = wedge(s, u).up;
        expect(up).toBeLessThanOrEqual(last + 1e-9);
        last = up;
      }
    }
  });
});

describe('walls at the screen edge', () => {
  const VIEW = { left: 0, right: 1080 };
  const walls = { left: 0, right: 0 };

  it('puts the walls on the edge of the visible part, less the safe area only', () => {
    visibleWalls(VIEW.left, VIEW.right, 0, 0, walls);
    expect(walls).toEqual({ left: 0, right: 1080 });
    visibleWalls(-40, 1120, 30, 20, walls);
    expect(walls).toEqual({ left: -10, right: 1100 });
  });

  it('draws the squashed edge on the screen edge, at most half the outline beyond it', () => {
    visibleWalls(VIEW.left, VIEW.right, 0, 0, walls);
    const outline = EDGE_SQUASH.silhouette.outlinePx;
    for (const kind of ['normal', 'soft', 'hard'] as const) {
      const f = feel[kind];
      for (const power of [0, 1]) {
        for (const width of [500, 720, 900]) {
          for (const depth of [0, 10, 40, 90]) {
            for (const side of ['left', 'right'] as const) {
              const half = width / 2;
              const cx = side === 'left' ? walls.left + half - depth : walls.right - half + depth;
              const over = edgeOverflow(cx, half, walls.left, walls.right);
              const s = fitShape(
                half,
                wantedDepth(over.left, kneePx, f),
                wantedDepth(over.right, kneePx, f),
                f,
                flatShape(),
                power,
              );
              s.shift = slideShift(over.left, over.right, kneePx, f);
              const drawn = side === 'left' ? cx + squashX(s, -half) : cx + squashX(s, half);
              const wall = side === 'left' ? walls.left : walls.right;
              // Past the wall (outwards) is positive.
              const beyond = side === 'left' ? wall - drawn : drawn - wall;
              expect(beyond).toBeLessThanOrEqual(1e-6);
              if (depth >= kneePx) expect(Math.abs(beyond)).toBeLessThanOrEqual(1);
              expect(beyond).toBeLessThanOrEqual(outline / 2);
            }
          }
        }
      }
    }
  });
});

describe('rib size and count by speed', () => {
  const by = EDGE_SQUASH.byPower;

  /** How many ribs of a row show at `last` (the farthest one counts when it has grown past half). */
  function shown(slots: number, last: number): number {
    return slots - 1 + (last > 0.5 ? 1 : 0);
  }

  it('shows 3 ribs on top and 2 at the bottom when slow, 4 and 3 when fast', () => {
    const slow = shapeAt(140, 720, feel.normal, 0);
    const fast = shapeAt(140, 720, feel.normal, 1);
    expect(shown(EDGE_SQUASH.ribs.slots.top, slow.lastRib)).toBe(3);
    expect(shown(EDGE_SQUASH.ribs.slots.bottom, slow.lastBottomRib)).toBe(2);
    expect(shown(EDGE_SQUASH.ribs.slots.top, fast.lastRib)).toBe(4);
    expect(shown(EDGE_SQUASH.ribs.slots.bottom, fast.lastBottomRib)).toBe(3);
    expect(slow.lastRib).toBe(0);
    expect(slow.lastBottomRib).toBe(0);
    expect(fast.lastRib).toBe(1);
    expect(fast.lastBottomRib).toBe(1);
  });

  it('makes the ribs 1.5 times (slow) to 2 times (fast) taller than the old ones, on their own numbers (before the ceiling)', () => {
    // The old ribs were a share of the rise: 0.65 * 0.12 * 0.8 slow, 0.97 * 0.24 * 0.8 fast.
    const oldSlow = 0.65 * 0.12 * 0.8;
    const oldFast = 0.97 * 0.24 * 0.8;
    expect(by.ribHeight.top[0]).toBeGreaterThan(oldSlow * 1.4);
    expect(by.ribHeight.top[0]).toBeLessThan(oldSlow * 1.6);
    expect(by.ribHeight.top[1]).toBeGreaterThan(oldFast * 1.9);
    expect(by.ribHeight.top[1]).toBeLessThan(oldFast * 2.1);
    // They do not depend on the wedge: the rise is its own number.
    const a = shapeAt(140, 720, feel.normal, 1);
    expect(a.left.ribUp).toBeLessThanOrEqual(by.ribHeight.top[1]);
    expect(a.left.ribUp).toBeGreaterThan(by.ribHeight.top[1] * 0.65);
    expect(a.left.ribDown).toBeCloseTo(by.ribHeight.bottom[1], 9);
  });

  it('grows the height and the count smoothly in between, never shrinking', () => {
    let lastUp = by.ribHeight.top[0];
    let lastDown = 0;
    let lastTop = 0;
    let lastBottom = 0;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const s = shapeAt(140, 720, feel.normal, p);
      expect(s.left.ribUp).toBeGreaterThanOrEqual(lastUp);
      expect(s.left.ribDown).toBeGreaterThanOrEqual(lastDown);
      expect(s.lastRib).toBeGreaterThanOrEqual(lastTop);
      expect(s.lastBottomRib).toBeGreaterThanOrEqual(lastBottom);
      expect(s.left.ribUp - lastUp).toBeLessThan(0.02);
      lastUp = s.left.ribUp;
      lastDown = s.left.ribDown;
      lastTop = s.lastRib;
      lastBottom = s.lastBottomRib;
    }
    const mid = shapeAt(140, 720, feel.normal, 0.5);
    expect(mid.left.ribUp).toBeGreaterThan(by.ribHeight.top[0]);
    expect(mid.left.ribUp).toBeLessThan(by.ribHeight.top[1]);
    expect(mid.lastRib).toBeGreaterThan(0.9);
    expect(mid.lastBottomRib).toBeGreaterThan(0);
    expect(mid.lastBottomRib).toBeLessThan(1);
  });

  it('keeps the bottom ribs clearly lower than the top ones at any speed', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      for (let layer = 1; layer <= 30; layer++) {
        const s = shapeAt(140, 720, feel.normal, p);
        s.ribs = ribLayoutFor(1234, layer);
        const wall = reach(s, -360);
        expect(s.left.ribDown).toBeLessThan(s.left.ribUp * 0.45);
        expect(wall.down).toBeLessThan(wall.up * 0.45);
      }
    }
  });

  it('gives a soft layer a bubble of its own size, a hard one no ribs', () => {
    const soft = shapeAt(140, 720, feel.soft, 1);
    expect(soft.left.ribUp).toBeLessThanOrEqual(by.ribHeight.top[1] * feel.soft.ribs);
    expect(soft.left.ribUp).toBeGreaterThan(by.ribHeight.top[1] * feel.soft.ribs * 0.55);
    expect(shapeAt(140, 720, feel.hard, 1).left.ribUp).toBe(0);
  });

  it('draws no ribs in fewer effects, only the wedge', () => {
    const s = shapeAt(140, 720, feel.normal, 1, false);
    expect(ribReach(s, s.left, 0, { up: 0, down: 0 })).toEqual({ up: 0, down: 0 });
    expect(crownCover(s, -360)).toBe(0);
    expect(wedge(s, -360).up).toBeGreaterThan(0.19);
  });
});

describe('crown of a soft layer under the wedge', () => {
  it('is cut away along the whole wedge and lets go smoothly past its end', () => {
    const s = shapeAt(140, 720, feel.soft, 1);
    s.ribs = BUBBLE_RIBS;
    expect(crownCover(s, -360)).toBe(1);
    let last = 1;
    for (let u = -360; u <= 0; u += 1) {
      const c = crownCover(s, u);
      expect(c).toBeLessThanOrEqual(last + 1e-9);
      expect(last - c).toBeLessThan(0.1);
      last = c;
    }
    expect(crownCover(s, 300)).toBe(0);
  });

  it('grows smoothly with the depth of the squash', () => {
    const f = feel.soft;
    const at = (depth: number): number => {
      const s = fitShape(140, depth, 0, f, flatShape(), 1);
      s.ribs = BUBBLE_RIBS;
      return crownCover(s, -140 + depth / 2);
    };
    expect(at(0)).toBe(0);
    expect(at(2)).toBeGreaterThan(0);
    expect(at(2)).toBeLessThan(0.1);
    expect(at(EDGE_SQUASH.wedge.fullDepthPx)).toBeCloseTo(1, 5);
  });

  it('shows the single bubble of a soft layer at slow speed', () => {
    const s = shapeAt(140, 720, feel.soft, 0.2);
    s.ribs = BUBBLE_RIBS;
    const out = { up: 0, down: 0 };
    ribReach(s, s.left, 0, out);
    expect(out.up).toBeGreaterThan(0);
    expect(out.down).toBeGreaterThan(0);
  });
});

describe('height ceiling at the wall', () => {
  const by = EDGE_SQUASH.byPower;

  /** The highest the drawn outline reaches above the normal top (wedge, ribs and glaze), share of the layer height. */
  function highest(shape: Readonly<EdgeShape>): number {
    let top = 0;
    for (let u = -shape.half; u <= shape.half; u += 0.5) {
      top = Math.max(top, reach(shape, u).up + squashGlaze(shape, u) / LAYER_H);
    }
    return top;
  }

  it('keeps the ceiling numbers: +25% slow, +45% fast', () => {
    expect(by.maxUp[0]).toBe(0.25);
    expect(by.maxUp[1]).toBe(0.45);
  });

  it('never lets the outline rise past the ceiling of its speed, for any material, depth and ribs on or off', () => {
    for (const f of Object.values(feel)) {
      for (const ribbing of [true, false]) {
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
          const cap = byPower(by.maxUp, p);
          for (let cx = 330; cx >= 100; cx -= 10) {
            for (const spring of [1, 1.6, 0]) {
              const s = shapeAt(cx, 720, f, p, ribbing);
              s.left.spring = spring;
              s.right.spring = spring;
              for (let layer = 1; layer <= 8; layer++) {
                s.ribs = ribLayoutFor(99, layer);
                expect(highest(s)).toBeLessThanOrEqual(cap + 1e-9);
              }
            }
          }
        }
      }
    }
  });

  it('keeps the ribs big on a fast layer: most of the ceiling is the ribs, with deep hollows between them', () => {
    const s = shapeAt(140, 720, feel.normal, 1);
    expect(s.left.ribUp).toBeGreaterThan(0.2);
    const hollow = reach(s, -360 + 120).up;
    expect(hollow).toBeLessThan(s.left.ribUp);
  });
});
