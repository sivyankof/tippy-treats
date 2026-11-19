import { describe, expect, it } from 'vitest';
import { ZONE_SKY } from '../../../data/backdrop/backdrop-colors';
import { ZONES } from '../../../data/zones/zones';
import {
  ditherNoise,
  ditheredSky,
  fillDitheredRows,
  gradientBands,
  gradientColorAt,
} from './sky-gradient';

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

describe('ditheredSky', () => {
  it('keeps every pixel within the noise width of the gradient and is repeatable', () => {
    const pixels = ditheredSky(TWO_STOPS, 8, 8, 1.5);
    const again = ditheredSky(TWO_STOPS, 8, 8, 1.5);
    expect(Array.from(pixels)).toEqual(Array.from(again));
    for (let y = 0; y < 8; y++) {
      const ideal = (y + 0.5) * 32;
      for (let x = 0; x < 8; x++) {
        expect(Math.abs((pixels[(y * 8 + x) * 4] ?? 0) - ideal)).toBeLessThanOrEqual(2.5);
        expect(pixels[(y * 8 + x) * 4 + 3]).toBe(255);
      }
    }
  });

  it('breaks a flat step into grain: neighbours of one row differ', () => {
    const pixels = ditheredSky([{ at: 0, color: 0x101010 }], 32, 1, 1.5);
    const values = new Set(Array.from({ length: 32 }, (_, x) => pixels[x * 4]));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('ditherNoise', () => {
  it('stays in -1..1 and averages near 0', () => {
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const n = ditherNoise(i % 50, Math.floor(i / 50));
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      sum += n;
    }
    expect(Math.abs(sum / 2000)).toBeLessThan(0.1);
  });
});

describe('fillDitheredRows', () => {
  it('fills only the asked rows and matches the whole picture', () => {
    const whole = ditheredSky(TWO_STOPS, 6, 6, 1.5);
    const out = new Uint8ClampedArray(6 * 6 * 4);
    fillDitheredRows(out, TWO_STOPS, 6, 6, 1.5, 0, 2);
    expect(out.slice(0, 2 * 6 * 4)).toEqual(whole.slice(0, 2 * 6 * 4));
    expect(out[2 * 6 * 4 + 3]).toBe(0);
    fillDitheredRows(out, TWO_STOPS, 6, 6, 1.5, 2, 6);
    expect(Array.from(out)).toEqual(Array.from(whole));
  });
});
