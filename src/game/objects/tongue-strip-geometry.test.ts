import { describe, expect, it } from 'vitest';
import { LICK } from '../../data/lick';
import { newRibbon, sampleRibbon } from './tongue-ribbon';
import {
  BODY_STRIP_ROWS,
  bodyUvs,
  CAP_ROWS,
  OUTLINE_STRIP_ROWS,
  solidUvs,
  stripFloats,
  stripLayout,
  TIP_ROWS,
  TIP_STRIP_ROWS,
  tipUvs,
  TRUNK_ROWS,
  writeCapRows,
  writeTipRows,
  writeTrunkRows,
} from './tongue-strip-geometry';

const N = LICK.tongue.segments;
const WIDTH = 40;

/** A straight tongue along +x from the origin, `WIDTH` wide everywhere. */
function straight(): ReturnType<typeof newRibbon> {
  const r = newRibbon(LICK.tongue.strip.sub);
  const points: number[] = [];
  for (let i = 0; i <= N; i++) points.push(i * 10, 0);
  sampleRibbon(points, () => WIDTH, r);
  return r;
}

describe('tongue strip rows', () => {
  it('puts the two edges of a straight tongue a width apart, either side of the centre line', () => {
    const r = straight();
    const out = new Float32Array(stripFloats(TRUNK_ROWS));
    writeTrunkRows(r, 0, out);
    for (let j = 0; j < TRUNK_ROWS; j++) {
      expect(out[j * 4]).toBeCloseTo(r.x[j]!);
      expect(out[j * 4 + 2]).toBeCloseTo(r.x[j]!);
      // The left edge (u = 0) is on the -across side: for travel along +x that is -y.
      expect(out[j * 4 + 1]).toBeCloseTo(-WIDTH / 2);
      expect(out[j * 4 + 3]).toBeCloseTo(WIDTH / 2);
    }
  });

  it('grows both edges by the outline', () => {
    const r = straight();
    const out = new Float32Array(stripFloats(TRUNK_ROWS));
    writeTrunkRows(r, LICK.tongue.outline, out);
    expect(out[3]! - out[1]!).toBeCloseTo(WIDTH + LICK.tongue.outline * 2);
  });

  it('closes the tip on a point as far ahead as the tip is tall', () => {
    const r = straight();
    const out = new Float32Array(stripFloats(TIP_ROWS));
    writeTipRows(r, 0, out, 0);
    const last = (TIP_ROWS - 1) * 4;
    const tipX = r.x[r.count - 1]! + WIDTH * LICK.tongue.tipShare;
    expect(out[last]).toBeCloseTo(tipX);
    expect(out[last + 2]).toBeCloseTo(tipX);
    expect(out[last + 1]).toBeCloseTo(0, 4);
    expect(out[last + 3]).toBeCloseTo(0, 4);
    // The rim stays on the half ellipse and never goes behind the last sample.
    for (let i = 0; i < TIP_ROWS; i++) {
      const x = (out[i * 4]! - r.x[r.count - 1]!) / (WIDTH * LICK.tongue.tipShare);
      const y = out[i * 4 + 1]! / (WIDTH / 2);
      expect(x).toBeGreaterThan(0);
      expect(x * x + y * y).toBeCloseTo(1, 4);
    }
  });
});

describe('tongue strip root', () => {
  it('rounds the root behind the first sample and ends on it', () => {
    const r = straight();
    const out = new Float32Array(stripFloats(CAP_ROWS));
    writeCapRows(r, 0, out, 0);
    // The first row is the point of the circle, a radius behind the sample it sits on (half a piece along).
    const radius = WIDTH / 2;
    expect(out[0]).toBeCloseTo(r.x[LICK.tongue.strip.sub / 2]! - radius);
    expect(out[2]).toBeCloseTo(out[0]!);
    expect(out[1]).toBeCloseTo(0, 4);
    // The last row stands on the first sample and is as wide as the circle is there.
    const last = (CAP_ROWS - 1) * 4;
    expect(out[last]).toBeCloseTo(r.x[0]!, 4);
    expect(Math.abs(out[last + 3]! - out[last + 1]!)).toBeLessThanOrEqual(WIDTH + 1e-4);
    expect(Math.abs(out[last + 3]! - out[last + 1]!)).toBeGreaterThan(WIDTH * 0.9);
    // Rows widen monotonically from the point.
    for (let i = 1; i < CAP_ROWS; i++) {
      expect(Math.abs(out[i * 4 + 3]! - out[i * 4 + 1]!)).toBeGreaterThanOrEqual(
        Math.abs(out[(i - 1) * 4 + 3]! - out[(i - 1) * 4 + 1]!),
      );
    }
  });
});

describe('tongue strip uv', () => {
  it('maps the body strip across the whole picture: plain fill to the first sample, the band after', () => {
    const layout = stripLayout();
    const uv = bodyUvs();
    expect(uv).toHaveLength(stripFloats(BODY_STRIP_ROWS));
    for (let i = 0; i < BODY_STRIP_ROWS; i++) {
      expect(uv[i * 4]).toBe(0);
      expect(uv[i * 4 + 2]).toBe(1);
    }
    expect(uv[CAP_ROWS * 4 + 1]! * layout.height).toBeLessThan(layout.plain);
    const band = uv[(CAP_ROWS + 1) * 4 + 1]! * layout.height;
    expect(band).toBeGreaterThan(layout.plain);
    expect(band).toBeLessThan(layout.plain + layout.band);
  });

  it('maps the tip from the band down to the tip picture, narrowing to a point', () => {
    const layout = stripLayout();
    const uv = tipUvs();
    expect(uv).toHaveLength(stripFloats(TIP_STRIP_ROWS));
    expect(uv[1]! * layout.height).toBeCloseTo(layout.plain + layout.band);
    const last = TIP_ROWS * 4;
    expect(uv[last]).toBeCloseTo(0.5);
    expect(uv[last + 2]).toBeCloseTo(0.5);
    expect(uv[last + 1]! * layout.height).toBeCloseTo(
      layout.plain + layout.band + layout.tipHeight,
    );
    expect(uv[last + 1]!).toBeLessThanOrEqual(1);
  });

  it('keeps the outline on the middle of its plain picture', () => {
    const uv = solidUvs();
    expect(uv).toHaveLength(stripFloats(OUTLINE_STRIP_ROWS));
    expect([...uv].every((v) => v === 0.5)).toBe(true);
  });
});
