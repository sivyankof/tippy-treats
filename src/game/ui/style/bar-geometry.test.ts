import { describe, expect, it } from 'vitest';
import { ARC_START, arcEnd, barFillWidth, capAngle, inset } from './bar-geometry';

describe('barFillWidth', () => {
  it('is zero for an empty bar and never narrower than the caps otherwise', () => {
    expect(barFillWidth(0, 100, 10)).toBe(0);
    expect(barFillWidth(0.01, 100, 10)).toBe(20);
    expect(barFillWidth(0.5, 100, 10)).toBe(50);
  });
  it('clamps the share', () => {
    expect(barFillWidth(3, 100, 10)).toBe(100);
    expect(barFillWidth(-1, 100, 10)).toBe(0);
  });
});

describe('arcs', () => {
  it('starts at twelve o clock and runs a full turn', () => {
    expect(arcEnd(0)).toBe(ARC_START);
    expect(arcEnd(1) - ARC_START).toBeCloseTo(Math.PI * 2);
    expect(arcEnd(2)).toBeCloseTo(arcEnd(1));
  });
  it('shortens soft layers by a cap at both ends', () => {
    const cap = capAngle(100, 20);
    expect(cap).toBeCloseTo(0.1);
    const span = inset(0.5, cap);
    expect(span?.from).toBeCloseTo(ARC_START + cap);
    expect(span?.to).toBeCloseTo(arcEnd(0.5) - cap);
  });
  it('drops soft layers on a very short arc', () => {
    expect(inset(0.01, capAngle(100, 20))).toBeNull();
  });
});
