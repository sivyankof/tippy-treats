import { describe, expect, it } from 'vitest';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { BUBBLE_RIBS, hollowAt, ribHeight, ribLayoutFor, type RibRow } from './edge-squash-ribs';

const SEED = 987654;

/** Mean difference between the heights of two rows of ribs along the wedge. */
function rowGap(a: Readonly<RibRow>, b: Readonly<RibRow>): number {
  let sum = 0;
  const steps = 200;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    sum += Math.abs(ribHeight(a, t, 1) - ribHeight(b, t, 1));
  }
  return sum / steps;
}

/** How far apart the cuts of two rows are: the largest gap between where their ribs start. */
function startGap(a: Readonly<RibRow>, b: Readonly<RibRow>): number {
  return Math.max(...a.start.map((s, i) => Math.abs(s - b.start[i]!)));
}

describe('rib layout', () => {
  it('is the same for the same seed and layer, whatever order they are asked in', () => {
    const a = ribLayoutFor(SEED, 12);
    ribLayoutFor(SEED, 3);
    ribLayoutFor(SEED + 1, 40);
    expect(ribLayoutFor(SEED, 12)).toEqual(a);
  });

  it('differs measurably for two layers in a row, over a long run', () => {
    for (let i = 1; i < 300; i++) {
      const a = ribLayoutFor(SEED, i);
      const b = ribLayoutFor(SEED, i + 1);
      expect(rowGap(a.top, b.top)).toBeGreaterThan(0.09);
      expect(rowGap(a.bottom, b.bottom)).toBeGreaterThan(0.09);
      expect(startGap(a.top, b.top)).toBeGreaterThan(0.09);
      expect(startGap(a.bottom, b.bottom)).toBeGreaterThan(0.09);
    }
  });

  it('differs for two layers with one between, too', () => {
    for (let i = 1; i < 300; i++) {
      const a = ribLayoutFor(SEED, i);
      const c = ribLayoutFor(SEED, i + 2);
      expect(rowGap(a.top, c.top)).toBeGreaterThan(0.1);
      expect(startGap(a.top, c.top)).toBeGreaterThan(0.04);
    }
  });

  it('differs between runs', () => {
    const a = Array.from({ length: 20 }, (_, i) => ribLayoutFor(1, i + 1));
    const b = Array.from({ length: 20 }, (_, i) => ribLayoutFor(2, i + 1));
    expect(a).not.toEqual(b);
  });

  it('is uneven: different widths and heights, the bottom independent of the top', () => {
    for (let i = 1; i <= 60; i++) {
      const { top, bottom } = ribLayoutFor(SEED, i);
      for (const row of [top, bottom]) {
        expect(new Set(row.width).size).toBe(EDGE_SQUASH.ribs.slots);
        expect(new Set(row.height).size).toBe(EDGE_SQUASH.ribs.slots);
        expect(Math.max(...row.width)).toBeGreaterThan(Math.min(...row.width) * 1.8);
        // Small ribs among the big ones: the heights differ a lot, too.
        expect(Math.max(...row.height)).toBeGreaterThan(Math.min(...row.height) * 1.8);
      }
      expect(startGap(top, bottom)).toBeGreaterThan(0.035);
      expect(rowGap(top, bottom)).toBeGreaterThan(0.1);
    }
  });

  it('makes the rib at the wall the biggest and the ribs smaller along the wedge', () => {
    for (let i = 1; i <= 100; i++) {
      for (const row of Object.values(ribLayoutFor(SEED, i))) {
        const crest = (k: number): number => {
          let best = 0;
          for (let t = row.start[k]!; t < row.start[k]! + row.width[k]!; t += 0.002) {
            best = Math.max(best, ribHeight(row, t, 1));
          }
          return best;
        };
        for (let k = 1; k < row.start.length; k++) expect(crest(k)).toBeLessThan(crest(0));
      }
    }
  });

  it('tiles the wedge: the ribs follow each other and the widths add up to 1', () => {
    for (let i = 1; i <= 30; i++) {
      const layout = ribLayoutFor(SEED, i);
      for (const row of [layout.top, layout.bottom]) {
        expect(row.start).toHaveLength(EDGE_SQUASH.ribs.slots);
        expect(row.start[0]).toBe(0);
        const total = row.width.reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(1, 9);
        for (let k = 1; k < row.start.length; k++) {
          expect(row.start[k]).toBeCloseTo(row.start[k - 1]! + row.width[k - 1]!, 9);
        }
      }
    }
  });
});

describe('rib height', () => {
  const { top } = ribLayoutFor(SEED, 7);

  it('is full at the wall, flat where the wedge ends, never negative or above 1', () => {
    expect(ribHeight(top, 0, 1)).toBeCloseTo(top.height[0]!, 9);
    expect(ribHeight(top, 1, 1)).toBe(0);
    for (let t = 0; t <= 1; t += 0.002) {
      const h = ribHeight(top, t, 1);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it('is hollow between the ribs and round on a rib', () => {
    for (let i = 0; i < top.start.length - 1; i++) {
      expect(ribHeight(top, hollowAt(top, i), 1)).toBeCloseTo(0, 9);
    }
    expect(ribHeight(top, top.start[1]! + top.width[1]! * 0.33, 1)).toBeGreaterThan(0.2);
  });

  it('is one smooth bubble for a soft layer: highest at the wall, only ever lower further out, no hollow', () => {
    for (const row of [BUBBLE_RIBS.top, BUBBLE_RIBS.bottom]) {
      expect(ribHeight(row, 0, 1)).toBeGreaterThan(0.9);
      let last = Infinity;
      for (let t = 0; t < 1; t += 0.005) {
        const h = ribHeight(row, t, 1);
        expect(h).toBeLessThanOrEqual(last + 1e-9);
        last = h;
      }
      expect(ribHeight(row, 0.999, 1)).toBeLessThan(0.05);
    }
  });

  it('leans the crest towards the wall', () => {
    const start = top.start[1]!;
    const width = top.width[1]!;
    let best = 0;
    let at = 0;
    for (let x = 0.01; x < 1; x += 0.01) {
      // Take the envelope out: a rib's own shape only.
      const t = start + width * x;
      const h = ribHeight(top, t, 1) / Math.pow(1 - t, EDGE_SQUASH.ribs.fade);
      if (h > best) {
        best = h;
        at = x;
      }
    }
    expect(at).toBeLessThan(0.45);
  });

  it('shows the farthest rib only as far as asked', () => {
    const lastStart = top.start[top.start.length - 1]!;
    const middle = lastStart + top.width[top.width.length - 1]! * 0.33;
    expect(ribHeight(top, middle, 0)).toBe(0);
    expect(ribHeight(top, middle, 0.5)).toBeCloseTo(ribHeight(top, middle, 1) / 2, 9);
  });
});
