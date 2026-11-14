import { describe, expect, it } from 'vitest';
import { cellAt, layoutGrid, type GridSpec } from './team-layout';

const SPEC: GridSpec = {
  count: 12,
  columns: 3,
  cardWidth: 312,
  cardHeight: 300,
  gapX: 28,
  gapY: 28,
  centerX: 540,
  top: 700,
  maxWidth: 1040,
  maxHeight: 1130,
  spareShare: 0.33,
};

describe('layoutGrid', () => {
  it('keeps full size when the grid fits', () => {
    const layout = layoutGrid({ ...SPEC, count: 6 });
    expect(layout.scale).toBe(1);
    expect(layout.cells).toHaveLength(6);
  });

  it('shrinks 12 cards to fit the space', () => {
    const layout = layoutGrid({ ...SPEC, maxHeight: 1000 });
    expect(layout.scale).toBeLessThan(1);
    expect(layout.height).toBeLessThanOrEqual(1000 + 1e-6);
    const last = layout.cells[11];
    expect((last?.y ?? Infinity) + (300 * layout.scale) / 2).toBeLessThanOrEqual(700 + 1000 + 1e-6);
  });

  it('centres an incomplete last row', () => {
    const layout = layoutGrid({ ...SPEC, count: 4 });
    expect(layout.cells[3]?.x).toBeCloseTo(540);
  });

  it('puts spare height above the grid', () => {
    const tall = layoutGrid({ ...SPEC, count: 3, maxHeight: 1500 });
    expect(tall.cells[0]?.y).toBeGreaterThan(700 + 150);
  });

  it('handles an empty grid', () => {
    expect(layoutGrid({ ...SPEC, count: 0 }).cells).toEqual([]);
  });
});

describe('cellAt', () => {
  const cells = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
  ];
  it('finds the cell under a point', () => {
    expect(cellAt(cells, 150, 150, 310, 120)).toBe(1);
  });
  it('returns -1 outside every cell', () => {
    expect(cellAt(cells, 150, 150, 200, 400)).toBe(-1);
  });
});
