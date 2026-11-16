import { describe, expect, it } from 'vitest';
import { BACKDROP_FAR, zoneHasFarRays } from './backdrop-far';

describe('far backdrop', () => {
  it('has no rays in the dark zones and rays elsewhere', () => {
    expect(zoneHasFarRays('stars')).toBe(false);
    expect(zoneHasFarRays('space')).toBe(false);
    for (const zone of ['kitchen', 'showcase', 'roof', 'clouds'] as const) {
      expect(zoneHasFarRays(zone)).toBe(true);
    }
  });

  it('keeps only small, low-contrast planets in the dark zones', () => {
    for (const zone of ['stars', 'space'] as const) {
      const circles = BACKDROP_FAR.shapes[zone].filter((s) => s.kind === 'circle');
      expect(circles.length).toBeGreaterThanOrEqual(1);
      expect(circles.length).toBeLessThanOrEqual(2);
      for (const c of circles) {
        if (c.kind === 'circle') {
          expect(c.r).toBeLessThanOrEqual(30);
          expect(c.tone).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
