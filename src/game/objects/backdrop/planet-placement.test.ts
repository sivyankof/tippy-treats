import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../../../data/screen';
import { PLANET_LOOK, PLANET_PLACE, SPACE_PLANET_IDS } from '../../../data/space-planets';
import { lapFirstIndex, lapProgress, spaceWidthLimit } from '../../../core/space-laps';
import { flightClearBand, hudFloor } from '../../camera-layout';
import { planetSize } from './dessert-planets';
import {
  corridorHalf,
  lapPlanet,
  planetFade,
  planetFit,
  planetLaneX,
  planetY,
  rememberLapOneWidth,
} from './planet-placement';

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

  it('is the top width halved plus the sway on lap 1 when it is known, the dashed cap on later laps', () => {
    const narrow = 300;
    const full = spaceWidthLimit(lapFirstIndex(1));
    expect(corridorHalf(1, narrow)).toBe(narrow / 2 + PLANET_PLACE.swayPx);
    expect(corridorHalf(1)).toBe(corridorHalf(1, full));
    expect(corridorHalf(2, narrow)).toBe(corridorHalf(2));
  });
});

describe('planetLaneX', () => {
  it('keeps clear of the dashed corridor on both sides, on every lap', () => {
    for (let lap = 1; lap <= 20; lap++) {
      for (const size of [ROUND, RINGED]) {
        for (const side of [0, 1] as const) {
          const x = planetLaneX(lap, W, size, side);
          if (x === null) continue;
          const half = corridorHalf(lap);
          if (side === 0) expect(x + size / 2).toBeLessThanOrEqual(W / 2 - half);
          else expect(x - size / 2).toBeGreaterThanOrEqual(W / 2 + half);
          // At most half of the planet hangs off the screen.
          expect(Math.min(x + size / 2, W) - Math.max(x - size / 2, 0)).toBeGreaterThanOrEqual(
            size * PLANET_PLACE.minVisible - 1e-6,
          );
        }
      }
    }
  });

  it('stands on the wanted side and has no lane where the corridor leaves none', () => {
    expect(planetLaneX(10, W, ROUND, 0)).toBeLessThan(W / 2);
    expect(planetLaneX(10, W, ROUND, 1)).toBeGreaterThan(W / 2);
    // Lap 2 is the widest corridor with dashes: a ringed planet has no lane.
    expect(planetLaneX(2, W, RINGED, 0)).toBeNull();
    expect(planetLaneX(1, W, ROUND, 1)).toBeNull();
  });

  it('mirrors the lanes: the same room on both sides', () => {
    for (let lap = 1; lap <= 12; lap++) {
      expect(planetLaneX(lap, W, ROUND, 0) === null).toBe(planetLaneX(lap, W, ROUND, 1) === null);
    }
  });
});

describe('planetFit', () => {
  const fit = (lap: number, id: (typeof SPACE_PLANET_IDS)[number], side: 0 | 1) =>
    planetFit(lap, W, planetSize(id).width, side);

  it('shows every planet from lap 2 on, smaller where the full size has no room, on either side', () => {
    for (const id of SPACE_PLANET_IDS) {
      for (let lap = 4; lap <= 20; lap++) {
        for (const side of [0, 1] as const) {
          const f = fit(lap, id, side);
          expect(f, `${id} lap ${lap}`).not.toBeNull();
          expect(f!.scale).toBeLessThanOrEqual(PLANET_PLACE.scale);
          expect(f!.scale).toBeGreaterThanOrEqual(PLANET_PLACE.minScale - 1e-9);
        }
      }
    }
    expect(fit(2, 'cookie', 0)!.scale).toBeLessThan(PLANET_PLACE.scale);
  });

  it('hides lap 1 with a full-width top and shows it with a narrow one', () => {
    const { width } = planetSize('marshmallow_moon');
    expect(planetFit(1, W, width, 0)).toBeNull();
    expect(planetFit(1, W, width, 0, 300)).not.toBeNull();
  });
});

describe('planetY', () => {
  it('goes from above the top edge to below the bottom edge, linearly in the progress', () => {
    for (const h of SCREENS) {
      const half = ROUND / 2;
      expect(planetY(0, h, half, 0) + half).toBeLessThanOrEqual(0);
      expect(planetY(1, h, half, 0) - half).toBeGreaterThanOrEqual(h);
      const mid = planetY(0.5, h, half, 0);
      expect(planetY(0.25, h, half, 0) - planetY(0, h, half, 0)).toBeCloseTo(
        planetY(0.5, h, half, 0) - planetY(0.25, h, half, 0),
      );
      expect(mid).toBeGreaterThan(0);
    }
  });

  it('starts higher with a larger entry draw, by at most the vary share of the screen', () => {
    const h = 2337;
    const low = planetY(0, h, 130, 0);
    const high = planetY(0, h, 130, 1);
    expect(low - high).toBeCloseTo(PLANET_PLACE.enterVary * h);
  });

  it('moves down with the tower: a tower layer later puts the planet further down', () => {
    const h = 2337;
    const a = lapProgress(lapFirstIndex(2) - 1 + 5);
    const b = lapProgress(lapFirstIndex(2) - 1 + 6);
    expect(planetY(b.progress, h, 130, 0.3)).toBeGreaterThan(planetY(a.progress, h, 130, 0.3));
  });
});

describe('planetFade', () => {
  it('is invisible while any part is in the flight stripe (with its gap) and at full strength clear of it', () => {
    for (const h of SCREENS) {
      const band = flightClearBand(h);
      const half = ROUND / 2;
      const x = 130;
      const mid = (band.top + band.bottom) / 2;
      expect(planetFade(x, mid, half, half, h)).toBe(0);
      // Touching the stripe plus the gap from above or below.
      expect(planetFade(x, band.top - PLANET_PLACE.rowGap - half + 1, half, half, h)).toBe(0);
      expect(planetFade(x, band.bottom + PLANET_PLACE.rowGap + half - 1, half, half, h)).toBe(0);
      const below = band.bottom + PLANET_PLACE.rowGap + half + PLANET_PLACE.fadeFeatherPx;
      expect(planetFade(x, below + 50, half, half, h)).toBeGreaterThan(0);
    }
  });

  it('fades in smoothly past the stripe', () => {
    const h = 2337;
    const band = flightClearBand(h);
    const half = 126;
    const edge = band.bottom + PLANET_PLACE.rowGap + half;
    const a = planetFade(130, edge + 30, half, half, h);
    const b = planetFade(130, edge + 60, half, half, h);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });

  it('keeps a planet away from the HUD plates', () => {
    for (const h of SCREENS) {
      const half = ROUND / 2;
      // Its top edge above the HUD floor: hidden, whatever the lane.
      for (const x of [130, W - 130]) {
        expect(planetFade(x, hudFloor() - 10, half, half, h)).toBe(0);
        expect(planetFade(x, 60, half, half, h)).toBe(0);
      }
    }
  });
});

describe('lapPlanet', () => {
  it('shows a planet on every lap from 2 on, for any seed, and all nine before one repeats', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = Array.from({ length: 40 }, (_, i) => lapPlanet(seed, i + 2));
      expect(ids.every((id) => id !== null)).toBe(true);
      // The first block (nine laps) holds all nine planets before one repeats; the narrow laps take the ones that fit.
      expect(new Set(ids.slice(0, 9)).size).toBe(9);
      // Every following block of nine holds them all again.
      for (let block = 1; block < 4; block++) {
        expect(new Set(ids.slice(block * 9, block * 9 + 9)).size).toBe(9);
      }
    }
  });

  it('gives the same planet to the bake and to the show for any sequence of top widths', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const widths of [
        [300, 700, 500, 250, 900],
        [undefined, 640, 120],
        [420, 420, 90],
      ]) {
        // Lap 1 takes the width of its start; later laps carry the SAME remembered width into both places.
        let baked: number | undefined;
        let shown: number | undefined;
        widths.forEach((w, i) => {
          const lap = i + 1;
          baked = rememberLapOneWidth(baked, lap, w);
          shown = rememberLapOneWidth(shown, lap, w);
          expect(lapPlanet(seed, lap, baked)).toBe(lapPlanet(seed, lap, shown));
          expect(lapPlanet(seed, lap + 1, baked)).toBe(
            lapPlanet(seed, lap + 1, widths[0] ?? undefined),
          );
        });
        expect(rememberLapOneWidth(7, 3, 99)).toBe(7);
      }
    }
  });

  it('leaves lap 1 empty when nothing fits the full corridor, and fills it for a narrow top', () => {
    expect(lapPlanet(3, 1)).toBeNull();
    expect(lapPlanet(3, 1, 300)).not.toBeNull();
  });
});
