import { describe, expect, it } from 'vitest';
import { ZONE_SKY } from '../../../data/backdrop-colors';
import { ZONES } from '../../../data/zones';
import { gradientBands, gradientColorAt } from './sky-gradient';

const TWO_STOPS = [
  { at: 0, color: 0x000000 },
  { at: 1, color: 0xffffff },
];

describe('gradientColorAt', () => {
  it('returns the end colours outside the stops', () => {
    expect(gradientColorAt(TWO_STOPS, -1)).toBe(0x000000);
    expect(gradientColorAt(TWO_STOPS, 2)).toBe(0xffffff);
  });

  it('blends linearly between two stops', () => {
    expect(gradientColorAt(TWO_STOPS, 0.5)).toBe(0x808080);
  });

  it('uses the right pair of stops with three of them', () => {
    const stops = [
      { at: 0, color: 0xff0000 },
      { at: 0.5, color: 0x00ff00 },
      { at: 1, color: 0x0000ff },
    ];
    expect(gradientColorAt(stops, 0.5)).toBe(0x00ff00);
    expect(gradientColorAt(stops, 0.25)).toBe(0x808000);
    expect(gradientColorAt(stops, 0.75)).toBe(0x008080);
  });

  it('is black for an empty gradient', () => {
    expect(gradientColorAt([], 0.5)).toBe(0);
  });
});

describe('gradientBands', () => {
  it('samples the middle of each band', () => {
    expect(gradientBands(TWO_STOPS, 2)).toEqual([0x404040, 0xbfbfbf]);
  });
});

describe('zone skies', () => {
  it('every zone has a sky with stops in order from 0 to 1', () => {
    for (const zone of ZONES) {
      const stops = ZONE_SKY[zone.id];
      expect(stops.length).toBeGreaterThanOrEqual(2);
      expect(stops[0]?.at).toBe(0);
      expect(stops[stops.length - 1]?.at).toBe(1);
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i]?.at).toBeGreaterThan(stops[i - 1]?.at ?? 0);
      }
    }
  });
});
