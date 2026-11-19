import { describe, expect, it } from 'vitest';
import { CUT_LOOK } from '../../../data/cuts/cut-look';
import {
  beadShare,
  curvePoint,
  HALF_FLOATS,
  HalfShape,
  middleThickness,
  outlineOf,
  profileThickness,
  recoilAnchorScale,
  dropLaneSpeed,
  dropTallness,
  faceTurnShare,
  recoilLength,
  recoilRest,
  sagControl,
  sideInset,
  snapTimeMs,
  trimHalf,
  trimmedThickness,
  writeHalf,
  writeQuad,
} from './cut-strand-geometry';

const S = CUT_LOOK.strands;
/** World px per screen px on a 390 CSS px wide screen. */
const SCREEN = 1080 / 390;

describe('strand thickness', () => {
  it('is 4-6 screen px at the ends and 1.5-2 in the middle, outline included', () => {
    for (const trait of S.traits) {
      expect(trait.end / SCREEN).toBeGreaterThanOrEqual(4 - 0.05);
      expect(trait.end / SCREEN).toBeLessThanOrEqual(6 + 0.05);
      expect(trait.mid / SCREEN).toBeGreaterThanOrEqual(1.5);
      expect(trait.mid / SCREEN).toBeLessThanOrEqual(2 + 0.05);
    }
  });

  it('starts as a bridge thicker than the ends and thins to its middle', () => {
    const trait = S.traits[0];
    expect(middleThickness(trait, 0)).toBeGreaterThan(trait.end);
    expect(middleThickness(trait, S.thinMs)).toBe(trait.mid);
  });

  it('is thinnest at the break and flares to the anchor', () => {
    expect(profileThickness(0, 16, 5)).toBe(16);
    expect(profileThickness(1, 16, 5)).toBe(5);
    let last = Infinity;
    for (let s = 0; s <= 1; s += 0.1) {
      const w = profileThickness(s, 16, 5);
      expect(w).toBeLessThanOrEqual(last);
      last = w;
    }
  });

  it('keeps an outline thinner than half the strand', () => {
    for (const w of [2, 4.2, 8, 16]) {
      expect(outlineOf(w)).toBeLessThanOrEqual(w / 2);
      expect(outlineOf(w)).toBeLessThanOrEqual(S.outline.maxPx);
    }
  });

  it('has beads of 5-7 screen px', () => {
    for (const size of S.beads.sizePx) {
      const smallest = size - (S.traits.length - 1) * S.beads.stepPx;
      expect(smallest / SCREEN).toBeGreaterThanOrEqual(5 - 0.05);
      expect(size / SCREEN).toBeLessThanOrEqual(7);
    }
  });
});

describe('snap order', () => {
  it('snaps the strands one after another, never two in one frame (30-40 ms)', () => {
    const times = S.traits.map(snapTimeMs).sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++)
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(40);
  });
});

describe('beads', () => {
  it('slide down from their start towards the break, quicker and quicker', () => {
    const start = S.beads.from;
    const to = S.beads.to[0];
    expect(beadShare(0, start, to)).toBe(start);
    const a = beadShare(S.beads.startMs + S.beads.slideMs / 2, start, to);
    const b = beadShare(S.beads.startMs + S.beads.slideMs, start, to);
    expect(b).toBeCloseTo(to);
    expect(a - start).toBeLessThan(b - a);
  });
});

describe('recoil', () => {
  it('flies back past its rest length, settles, then goes into the glaze', () => {
    const { restShare, springU } = S.recoil;
    expect(recoilLength(0)).toBeCloseTo(1);
    expect(recoilLength(springU)).toBeCloseTo(restShare);
    let min = 1;
    for (let u = 0; u <= springU; u += 0.01) min = Math.min(min, recoilLength(u));
    expect(min).toBeLessThan(restShare);
    expect(recoilLength(1)).toBeCloseTo(0);
  });
  it('retracts along the path it had: the shortened curve lies on the old one', () => {
    const c = { x: 40, y: 30 };
    const e = { x: 100, y: 10 };
    const oc = { x: 0, y: 0 };
    const oe = { x: 0, y: 0 };
    const origin = { x: 0, y: 0 };
    for (const l of [1, 0.6, 0.18, 0.03]) {
      trimHalf(c, e, l, oc, oe);
      const p = curvePoint(origin, c, e, l, { x: 0, y: 0 });
      expect(oe.x).toBeCloseTo(p.x);
      expect(oe.y).toBeCloseTo(p.y);
      // Halfway along the short curve is a point of the old one.
      const q = curvePoint(origin, oc, oe, 0.5, { x: 0, y: 0 });
      const r = curvePoint(origin, c, e, l / 2, { x: 0, y: 0 });
      expect(q.x).toBeCloseTo(r.x);
      expect(q.y).toBeCloseTo(r.y);
    }
  });
  it('keeps the profile: the free end gets thicker as it comes back, never thicker than the anchor', () => {
    const t = S.traits[0];
    let last = 0;
    for (const l of [1, 0.6, 0.3, 0.18, 0.05]) {
      const tip = trimmedThickness(1, l, t.end, t.mid);
      expect(tip).toBeGreaterThanOrEqual(last);
      expect(tip).toBeLessThanOrEqual(t.end);
      // No lump: thinner from the anchor to the free end.
      for (let s = 0.1; s <= 1; s += 0.1) {
        expect(trimmedThickness(s, l, t.end, t.mid)).toBeLessThanOrEqual(
          trimmedThickness(s - 0.1, l, t.end, t.mid) + 1e-9,
        );
      }
      last = tip;
    }
    expect(trimmedThickness(1, 1, t.end, t.mid)).toBeCloseTo(t.mid);
  });
  it('never crosses the rows of a short thick end (no spikes)', () => {
    const t = S.traits[0];
    for (const len of [4, 10, 20, 60]) {
      const shape = new HalfShape();
      shape.faceX = 0.6;
      shape.faceY = 0.8;
      shape.capped = true;
      shape.sample(
        { x: 0, y: 0 },
        { x: len / 2, y: len / 4 },
        { x: len, y: len / 3 },
        0,
        1,
        () => t.end,
      );
      const out = new Float32Array(HALF_FLOATS);
      writeHalf(
        shape,
        out,
        (w) => w / 2,
        () => 0,
      );
      // Each side of the strip keeps going forward along the strand: no row folds back over the one before.
      for (let i = 1; i < S.rows; i++) {
        const tx = shape.tx[i]!;
        const ty = shape.ty[i]!;
        for (const side of [0, 2]) {
          const dx = out[i * 4 + side]! - out[(i - 1) * 4 + side]!;
          const dy = out[i * 4 + side + 1]! - out[(i - 1) * 4 + side + 1]!;
          expect(dx * tx + dy * ty).toBeGreaterThan(-1e-6);
        }
      }
      expect(faceTurnShare(shape, t.end / 2)).toBeLessThanOrEqual(1);
    }
  });
  it('settles as a short stub, however long the half was', () => {
    expect(recoilRest(20)).toBeCloseTo(S.recoil.restShare);
    expect(recoilRest(200) * 200).toBeCloseTo(S.recoil.restPx);
    expect(recoilLength(S.recoil.springU, recoilRest(200))).toBeCloseTo(recoilRest(200));
  });
  it('shrinks the anchor to what is kept', () => {
    expect(recoilAnchorScale(0, 0)).toBe(1);
    expect(recoilAnchorScale(1, 0)).toBe(0);
    expect(recoilAnchorScale(1, 0.5)).toBe(0.5);
  });
});

describe('path', () => {
  it('sags below the straight line between the anchors', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    const c = sagControl(a, b, 1, 1, { x: 0, y: 0 });
    const mid = curvePoint(a, c, b, 0.5, { x: 0, y: 0 });
    expect(mid.y).toBeGreaterThan(0);
    expect(mid.y).toBeLessThanOrEqual(S.sag.maxPx + 1e-6);
  });

  it('writes a strip of the right width and a round cap when snapped', () => {
    const shape = new HalfShape();
    shape.sample({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, 0, 1, () => 10);
    const out = new Float32Array(HALF_FLOATS);
    shape.capped = false;
    writeHalf(
      shape,
      out,
      (w) => w / 2,
      () => 0,
    );
    // A horizontal strip: the rows are 10 px tall.
    expect(Math.abs(out[1]! - out[3]!)).toBeCloseTo(10);
    // Without a cap the extra rows have no area: both vertices at the end centre.
    const last = (S.rows + S.capRows - 1) * 4;
    expect(out[last]).toBeCloseTo(out[last + 2]!);
    shape.capped = true;
    writeHalf(
      shape,
      out,
      (w) => w / 2,
      () => 0,
    );
    // The cap reaches half the width past the end.
    expect(out[last]).toBeCloseTo(105);
  });

  it('lays a quad with its picture bottom along the given direction', () => {
    const out = new Float32Array(8);
    writeQuad(out, 0, 0, 10, 20, 0, 1);
    // Top-left, top-right, bottom-left, bottom-right.
    expect([out[0], out[1], out[2], out[3]]).toEqual([-5, -10, 5, -10]);
    expect([out[4], out[5], out[6], out[7]]).toEqual([-5, 10, 5, 10]);
  });
});

describe('falling drops', () => {
  /**
   * Where the drops of a cut start (from the cut edge, outwards positive, and from the layer
   * centre) as measured in the game for a thin, a big and a usual cut with strands, in the order
   * they fall.
   */
  const MEASURED = [
    [
      [26.5, 19.1, 17],
      [39, 22.8, 18],
      [62.2, 42.3, 17.5],
    ],
    [
      [-2.5, 7.2, 17],
      [15.5, 11.5, 18],
      [35.2, 9.9, 17.5],
    ],
    [
      [30.9, 22.3, 17],
      [44.8, 23.8, 18],
      [69.4, 38.5, 17.5],
    ],
  ] as const;

  it('snaps the lowest strand first and the highest last', () => {
    const order = S.traits
      .map((t) => ({ at: snapTimeMs(t), band: t.layerBand }))
      .sort((p, q) => p.at - q.at);
    for (let k = 1; k < order.length; k++) {
      expect(order[k]!.band).toBeLessThan(order[k - 1]!.band);
    }
  });

  it('fall apart: two drops of one cut never touch', () => {
    const { drops } = S;
    const drift = CUT_LOOK.ramp.strands.driftSpeed * drops.driftShare;
    const times = S.traits.map(snapTimeMs).sort((p, q) => p - q);
    for (const cut of MEASURED) {
      const at = (k: number, ms: number) => {
        const [x0, y0, size] = cut[k]!;
        const age = ms - times[k]!;
        if (age < 0 || age > drops.lifeMs) return null;
        const t = age / 1000;
        const vx = drift + dropLaneSpeed(k);
        const vy = drops.downSpeed + drops.gravity * t;
        const w = size;
        return {
          x: x0 + vx * t,
          y: y0 + drops.downSpeed * t + (drops.gravity * t * t) / 2,
          w,
          h: w * dropTallness(age, Math.hypot(vx, vy)),
        };
      };
      for (let ms = 0; ms < 1200; ms += 5) {
        for (let i = 0; i < cut.length; i++) {
          for (let j = i + 1; j < cut.length; j++) {
            const p = at(i, ms);
            const q = at(j, ms);
            if (!p || !q) continue;
            // Two ellipses of these sizes: apart when the scaled distance is over 1, with a margin.
            const dx = (p.x - q.x) / ((p.w + q.w) / 2);
            const dy = (p.y - q.y) / ((p.h + q.h) / 2);
            expect(Math.hypot(dx, dy)).toBeGreaterThan(1.15);
          }
        }
      }
    }
  });
});

describe('drop shape', () => {
  it('starts round as its bead and draws out to a teardrop', () => {
    expect(dropTallness(0, 0)).toBeCloseTo(1);
    expect(dropTallness(S.drops.tallMs, 0)).toBeCloseTo(S.drops.tall);
    expect(dropTallness(S.drops.tallMs, 1e6)).toBeCloseTo(S.drops.tall * (1 + S.drops.maxStretch));
  });
});

describe('anchors', () => {
  it('sit on the outline: in by the inset on the straight side, further in at the rounded corner', () => {
    expect(sideInset(30, 3, 40)).toBe(3);
    expect(sideInset(30, 3, 30)).toBeCloseTo(3);
    expect(sideInset(30, 3, 10)).toBeGreaterThan(6);
    // On the circle of the outline: (radius - x)^2 + (radius - y)^2 = (radius - inset)^2.
    const x = sideInset(30, 3, 10);
    expect((30 - x) ** 2 + 20 ** 2).toBeCloseTo(27 ** 2);
    // A corner smaller than the inset changes nothing.
    expect(sideInset(2, 3, 0)).toBe(3);
  });
});
