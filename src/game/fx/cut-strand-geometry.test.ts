import { describe, expect, it } from 'vitest';
import { CUT_LOOK } from '../../data/cut-look';
import {
  beadShare,
  curvePoint,
  HALF_FLOATS,
  HalfShape,
  middleThickness,
  outlineOf,
  profileThickness,
  recoilAnchorScale,
  recoilLength,
  recoilWhip,
  sagControl,
  snapTimeMs,
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
  it('whips up and calms down', () => {
    expect(recoilWhip(0)).toBeCloseTo(0);
    expect(recoilWhip(S.recoil.springU / 2)).toBeGreaterThan(0);
    expect(recoilWhip(1)).toBeCloseTo(0);
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
