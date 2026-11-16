import { describe, expect, it } from 'vitest';
import { HUD_LAYOUT } from '../../../data/hud-layout';
import { LOGICAL_SIZE } from '../../../data/screen';
import { PLANET_LOOK, PLANET_PLACE } from '../../../data/space-planets';
import { flightClearBand } from '../../camera-layout';
import { planetOfLap } from '../../../core/space-planet';
import { planetSize } from './dessert-planets';
import { corridorHalf, planetFit, planetSpot } from './planet-placement';

const W = LOGICAL_SIZE.width;
const SCREENS = [2337, 1919]; // 390x844 and 390x693 at the logical width
const ROUND = PLANET_LOOK.size * PLANET_PLACE.scale;
const RINGED = PLANET_LOOK.ringedWidth * PLANET_PLACE.scale;

describe('corridorHalf', () => {
  it('is the width cap of the lap (lap 1 uses the full layer width) and narrows with the laps', () => {
    expect(corridorHalf(1)).toBeGreaterThan(corridorHalf(2));
    expect(corridorHalf(3)).toBeLessThan(corridorHalf(2));
    expect(corridorHalf(30)).toBe(corridorHalf(20));
  });
});

describe('planetSpot', () => {
  it('keeps clear of the dashed corridor and the HUD on every lap and screen', () => {
    for (const h of SCREENS) {
      for (let lap = 1; lap <= 20; lap++) {
        for (const size of [ROUND, RINGED]) {
          const spot = planetSpot(lap, W, h, size, ROUND);
          if (!spot) continue;
          const half = corridorHalf(lap);
          const left = spot.x - size / 2;
          const right = spot.x + size / 2;
          const top = spot.y - ROUND / 2;
          const bottom = spot.y + ROUND / 2;
          const clear = flightClearBand(h);
          const bob = PLANET_PLACE.drift.bob.px;
          const rowGap = PLANET_PLACE.rowGap;
          expect(bottom + bob <= clear.top - rowGap || top - bob >= clear.bottom + rowGap).toBe(
            true,
          );
          const clearOfLines = right <= W / 2 - half || left >= W / 2 + half || bottom <= clear.top;
          expect(clearOfLines).toBe(true);
          expect(top).toBeGreaterThanOrEqual(HUD_LAYOUT.badgeRowBottom + PLANET_PLACE.hudGap);
          expect(Math.min(right, W) - Math.max(left, 0)).toBeGreaterThanOrEqual(
            size * PLANET_PLACE.minVisible - 1e-6,
          );
          expect(bottom).toBeLessThanOrEqual(h);
        }
      }
    }
  });

  it('shows a planet on the narrow late laps, none on lap 1 where the full-width layers leave no lane', () => {
    for (const h of SCREENS) {
      expect(planetSpot(1, W, h, ROUND, ROUND)).toBeNull();
      expect(planetSpot(10, W, h, RINGED, ROUND)).not.toBeNull();
    }
  });

  it('shows nothing where no lane has room', () => {
    // Lap 2 is the widest corridor: a ringed planet has no lane on either side.
    expect(planetSpot(2, W, SCREENS[1] as number, RINGED, ROUND)).toBeNull();
    // A screen too short to put the planet under the HUD.
    expect(planetSpot(1, W, 600, ROUND, ROUND)).toBeNull();
  });

  it('prefers the left lane and uses the right one when the left is too narrow', () => {
    const left = planetSpot(10, W, 2337, ROUND, ROUND);
    expect(left?.x).toBeLessThan(W / 2);
  });
});

describe('planetFit', () => {
  const fit = (lap: number, h: number) => {
    const size = planetSize(planetOfLap(lap));
    return planetFit(lap, W, h, size.width, size.height);
  };

  it('shows the planet of every lap from 2 on, smaller where the full size has no room', () => {
    for (const h of SCREENS) {
      for (let lap = 2; lap <= 20; lap++) {
        const f = fit(lap, h);
        expect(f).not.toBeNull();
        expect(f!.scale).toBeLessThanOrEqual(PLANET_PLACE.scale);
        expect(f!.scale).toBeGreaterThanOrEqual(PLANET_PLACE.minScale - 1e-9);
      }
      expect(fit(4, h)!.scale).toBeLessThan(PLANET_PLACE.scale);
      expect(fit(6, h)!.scale).toBeCloseTo(PLANET_PLACE.scale);
    }
  });

  it('keeps the spot rules at the chosen scale and hides lap 1 even at the smallest scale', () => {
    for (const h of SCREENS) {
      for (let lap = 2; lap <= 9; lap++) {
        const size = planetSize(planetOfLap(lap));
        const f = fit(lap, h)!;
        expect(planetSpot(lap, W, h, size.width * f.scale, size.height * f.scale)).toEqual({
          x: f.x,
          y: f.y,
        });
      }
      expect(fit(1, h)).toBeNull();
    }
  });
});
