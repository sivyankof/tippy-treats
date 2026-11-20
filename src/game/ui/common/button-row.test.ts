import { describe, expect, it } from 'vitest';
import { rowCentres } from './button-row';

describe('rowCentres', () => {
  it('puts the row against its right edge, the buttons gap apart', () => {
    expect(rowCentres(300, 100, 2, 20)).toEqual([130, 250]);
  });

  it('a row as wide as the window spans it from edge to edge', () => {
    const width = 700;
    const gap = 20;
    const buttonWidth = (width - gap * 2) / 3;
    const xs = rowCentres(width / 2, buttonWidth, 3, gap);
    expect(xs[0]).toBeCloseTo(-width / 2 + buttonWidth / 2);
    expect(xs[2]).toBeCloseTo(width / 2 - buttonWidth / 2);
  });
});
