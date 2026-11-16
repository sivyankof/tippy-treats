import { describe, expect, it } from 'vitest';
import { cellWidths, fitPanel, spreadBlocks } from './results-layout';

describe('cellWidths', () => {
  it('keeps the wanted widths when they fit', () => {
    expect(cellWidths([300, 300], 1000)).toEqual([300, 300]);
  });

  it('shrinks all cells by the same share when they do not fit', () => {
    expect(cellWidths([300, 300, 400], 500)).toEqual([150, 150, 200]);
  });
});

describe('spreadBlocks', () => {
  it('spreads free room evenly, edges included', () => {
    expect(spreadBlocks([100, 100], 0, 500, 10)).toEqual([150, 350]);
  });

  it('keeps the minimum gap and centres what is left', () => {
    // free = 20: the gap between the two blocks stays 30, the overflow starts at the top
    expect(spreadBlocks([100, 100], 0, 220, 30)).toEqual([50, 180]);
  });

  it('overflows downwards when nothing fits', () => {
    const [a, b] = spreadBlocks([100, 100], 0, 150, 30);
    expect(a).toBe(50);
    expect(b).toBe(180);
  });

  it('handles no blocks and one block', () => {
    expect(spreadBlocks([], 0, 100, 10)).toEqual([]);
    expect(spreadBlocks([100], 0, 300, 10)).toEqual([150]);
  });
});

const BASE = {
  blocksHeight: 650,
  foldSaving: 100,
  spacing: 200,
  headerHeight: 200,
  room: 1000,
  minShare: 0.3,
  minScale: 0.85,
  floorScale: 0.6,
};

describe('fitPanel', () => {
  it('changes nothing when everything fits', () => {
    expect(fitPanel({ ...BASE, blocksHeight: 500 })).toEqual({ share: 1, scale: 1, fold: false });
  });

  it('shrinks the spacing by what is missing', () => {
    // free = 1000 - 200 = 800: 650 of blocks leave 150 of the 200 the spacing wants
    expect(fitPanel(BASE)).toEqual({ share: 0.75, scale: 1, fold: false });
  });

  it('scales the panel once the spacing is at its minimum', () => {
    // 800 / (700 + 60) = 1.0526: still 1; 800 / (800 + 60) = 0.93
    const fit = fitPanel({ ...BASE, blocksHeight: 800 });
    expect(fit.share).toBe(0.3);
    expect(fit.scale).toBeCloseTo(800 / 860, 6);
    expect(fit.fold).toBe(false);
  });

  it('folds the missions when 0.85 is not enough, then scales again', () => {
    // plain: 800 / (900 + 60) = 0.83 < 0.85; folded: 800 / (800 + 60) = 0.93
    const fit = fitPanel({ ...BASE, blocksHeight: 900 });
    expect(fit.fold).toBe(true);
    expect(fit.share).toBe(0.3);
    expect(fit.scale).toBeCloseTo(800 / 860, 6);
  });

  it('may go below 0.85 only after the fold', () => {
    const fit = fitPanel({ ...BASE, blocksHeight: 1100 });
    expect(fit.fold).toBe(true);
    expect(fit.scale).toBeCloseTo(800 / 1060, 6);
    expect(fit.scale).toBeLessThan(0.85);
  });

  it('goes below 0.85 without a fold when there are no missions', () => {
    const fit = fitPanel({ ...BASE, blocksHeight: 1000, foldSaving: 0 });
    expect(fit.fold).toBe(false);
    expect(fit.scale).toBeCloseTo(800 / 1060, 6);
  });

  it('never scales below the floor', () => {
    expect(fitPanel({ ...BASE, blocksHeight: 3000 }).scale).toBe(0.6);
  });

  it('has nothing to shrink without spacing', () => {
    expect(fitPanel({ ...BASE, spacing: 0, blocksHeight: 500 }).share).toBe(1);
  });
});
