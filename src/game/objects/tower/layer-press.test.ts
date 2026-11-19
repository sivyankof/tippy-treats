import { describe, expect, it } from 'vitest';
import { pressAngle, pressDrop, pressPivot, pressShift } from './layer-press';

/** Where a bottom point at `x` ends up after the turn by `angle` around the centre plus the shift. */
function turned(x: number, pivot: number, angle: number): { x: number; y: number } {
  const shift = pressShift(pivot, angle, { x: 0, y: 0 });
  return { x: x * Math.cos(angle) + shift.x, y: x * Math.sin(angle) + shift.y };
}

describe('layer press', () => {
  it('tilts around the corner away from the pressed spot', () => {
    expect(pressPivot(-40, 150)).toBe(150);
    expect(pressPivot(40, 150)).toBe(-150);
  });

  it('drops the pressed spot by the dip and keeps the far corner on the seam', () => {
    for (const dx of [-90, -20, 30, 110]) {
      const pivot = pressPivot(dx, 150);
      const angle = pressAngle(dx, 150, 8);
      expect(pressDrop(dx, pivot, angle)).toBeCloseTo(8);
      const spot = turned(dx, pivot, angle);
      expect(spot.y).toBeCloseTo(8);
      const corner = turned(pivot, pivot, angle);
      expect(corner.x).toBeCloseTo(pivot);
      expect(corner.y).toBeCloseTo(0);
    }
  });

  it('does not tilt a layer with no width or no dip', () => {
    expect(pressAngle(0, 0, 8)).toBe(0);
    expect(pressAngle(40, 150, 0)).toBe(0);
  });
});
