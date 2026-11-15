import { describe, expect, it } from 'vitest';
import { spacingShare, spreadBlocks } from './results-layout';

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

describe('spacingShare', () => {
  it('keeps the full spacing when everything fits', () => {
    expect(spacingShare(500, 100, 200, 1000, 0.3)).toBe(1);
  });

  it('shrinks the spacing by what is missing', () => {
    // free = 1000 - 200 - 650 = 150 of the 200 the spacing wants
    expect(spacingShare(650, 200, 200, 1000, 0.3)).toBe(0.75);
  });

  it('never goes below the minimum share', () => {
    expect(spacingShare(900, 200, 200, 1000, 0.3)).toBe(0.3);
  });

  it('has nothing to shrink without spacing', () => {
    expect(spacingShare(900, 0, 200, 1000, 0.3)).toBe(1);
  });
});
