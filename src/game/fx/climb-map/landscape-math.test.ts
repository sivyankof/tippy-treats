import { describe, expect, it } from 'vitest';
import { CLIMB_LANDSCAPE } from '../../../data/progression/climb-landscape';
import { SPACE_PLANET_IDS } from '../../../data/zones/space-planets';
import {
  LAND_H,
  climbStripWidth,
  firstShutBand,
  fogBoundary,
  landscapeKey,
  lapPlanet,
  puffLayout,
  signRect,
  skyColorAt,
} from './landscape-math';

describe('lapPlanet', () => {
  it('gives the first nine laps nine different planets', () => {
    const planets = new Set(Array.from({ length: 9 }, (_, i) => lapPlanet(i + 1)));
    expect(planets.size).toBe(SPACE_PLANET_IDS.length);
  });
  it('wraps round after nine laps and treats a lap below 1 as lap 1', () => {
    expect(lapPlanet(10)).toBe(lapPlanet(1));
    expect(lapPlanet(0)).toBe(lapPlanet(1));
  });
});

describe('skyColorAt', () => {
  it('starts at the first stop and joins the laps without a seam', () => {
    expect(skyColorAt(0)).toBe(CLIMB_LANDSCAPE.sky[0]?.color);
    expect(skyColorAt(5)).toBe(skyColorAt(6));
    expect(skyColorAt(6)).toBe(skyColorAt(7));
    expect(skyColorAt(5.5)).toBe(CLIMB_LANDSCAPE.lapSky.mid);
  });
  it('is continuous at a stop', () => {
    const stop = CLIMB_LANDSCAPE.sky[3];
    expect(skyColorAt(stop?.p ?? 0)).toBe(stop?.color);
  });
});

describe('landscapeKey', () => {
  it('keeps shut and open pictures and every lap apart', () => {
    const keys = [
      landscapeKey('roof', 0, false),
      landscapeKey('roof', 0, true),
      landscapeKey('lap', 1, false),
      landscapeKey('lap', 2, false),
      landscapeKey('lap', 2, true),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('signRect', () => {
  it('stays inside the picture and clear of the tower column for every kind', () => {
    for (const kind of ['kitchen', 'showcase', 'roof', 'clouds', 'stars', 'lap'] as const) {
      const r = signRect(kind);
      expect(r.y).toBeGreaterThan(0);
      expect(r.y + r.height).toBeLessThan(LAND_H);
      expect(r.x + r.width).toBeLessThan(climbStripWidth() / 2 - 60);
    }
  });
});

describe('fogBoundary and firstShutBand', () => {
  it('puts the edge on the top of the band of the record', () => {
    expect(fogBoundary(2, 7)).toBe(4 * LAND_H);
    expect(fogBoundary(6, 7)).toBe(0);
  });
  it('finds the lowest shut band', () => {
    expect(firstShutBand([{ open: true }, { open: true }, { open: false }, { open: false }])).toBe(
      2,
    );
    expect(firstShutBand([{ open: true }])).toBe(1);
  });
});

describe('puffLayout', () => {
  it('is the same for the same seed and spans the width', () => {
    const a = puffLayout(7, 700, 7, [50, 74]);
    expect(puffLayout(7, 700, 7, [50, 74])).toEqual(a);
    expect(a).toHaveLength(7);
    expect(a[0]?.x).toBeLessThan(80);
    expect(a[6]?.x).toBeGreaterThan(620);
    for (const p of a) expect(p.r).toBeGreaterThanOrEqual(50);
  });
});
