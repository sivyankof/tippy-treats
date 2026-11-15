import { describe, expect, it } from 'vitest';
import { EDGE_SQUASH, type WallFeel } from '../../data/edge-squash';
import {
  bounceWave,
  edgeOverflow,
  fitShape,
  flatShape,
  isSquashed,
  knockPulse,
  slideShift,
  softOverflow,
  squashMid,
  squashScale,
  squashTallest,
  squashTall,
  squashWidth,
  squashX,
  wantedDepth,
  type EdgeShape,
} from './edge-squash';

const { feel, kneePx } = EDGE_SQUASH;
const WALL_L = 12;
const WALL_R = 1068;

/** The shape of a layer `width` wide around `cx` between the test walls. */
function shapeAt(cx: number, width: number, f: Readonly<WallFeel> = feel.normal): EdgeShape {
  const half = width / 2;
  const over = edgeOverflow(cx, half, WALL_L, WALL_R);
  return fitShape(
    half,
    wantedDepth(over.left, kneePx, f),
    wantedDepth(over.right, kneePx, f),
    f,
    flatShape(),
  );
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
    expect(squashTall(s, -200)).toBe(1);
    expect(squashScale(s, 359)).toBeLessThan(0.9);
  });

  it('is mirrored between the walls', () => {
    const a = shapeAt(150, 600);
    const b = shapeAt(1080 - 150, 600);
    for (let u = -300; u <= 300; u += 25) {
      expect(squashX(a, u)).toBeCloseTo(-squashX(b, -u), 6);
      expect(squashTall(a, u)).toBeCloseTo(squashTall(b, -u), 6);
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
        const a = shapeAt(cx, 720, f);
        const b = shapeAt(cx + step, 720, f);
        for (let u = -360; u <= 360; u += 30) {
          // A column can move at most by the step itself plus the squash it takes up.
          expect(Math.abs(cx + step + squashX(b, u) - (cx + squashX(a, u)))).toBeLessThan(step * 3);
          expect(Math.abs(squashTall(b, u) - squashTall(a, u))).toBeLessThan(0.01);
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

  it('makes the side at the wall taller, never more than maxTall', () => {
    const s = shapeAt(140, 720, feel.soft);
    expect(squashTall(s, -360)).toBeGreaterThan(1.2);
    expect(squashTall(s, -360)).toBeLessThanOrEqual(feel.soft.maxTall);
    expect(squashTall(s, 355)).toBe(1);
  });

  it('gives a soft material a longer, taller squash and a hard one hardly any', () => {
    const soft = shapeAt(140, 720, feel.soft);
    const normal = shapeAt(140, 720, feel.normal);
    const hard = shapeAt(140, 720, feel.hard);
    expect(soft.left.zone).toBeGreaterThan(normal.left.zone);
    expect(squashTall(soft, -340)).toBeGreaterThan(squashTall(normal, -340));
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
    const s = shapeAt(cx, width, hard);
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
    expect(squashTallest(s)).toBeLessThanOrEqual(feel.normal.maxTall);
  });
});
