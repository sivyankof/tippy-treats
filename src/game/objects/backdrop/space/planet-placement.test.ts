import { describe, expect, it } from 'vitest';
import { LOGICAL_SIZE } from '../../../../data/app/screen';
import {
  PLANET_DIM,
  PLANET_LOOK,
  PLANET_PLACE,
  SPACE_PLANET_IDS,
  type SpacePlanetId,
} from '../../../../data/zones/space-planets';
import { BALANCE } from '../../../../data/tower/balance';
import { lapFirstIndex, lapProgress, spaceWidthLimit } from '../../../../core/zones/space-laps';
import { flightClearBand } from '../../../run/camera-layout';
import { planetSize } from './dessert-planets';
import {
  corridorHalf,
  lapPlanet,
  planetFit,
  planetLaneX,
  planetMute,
  planetPlace,
  planetY,
} from './planet-placement';

const W = LOGICAL_SIZE.width;
const SCREENS = [2337, 1919]; // 390x844 and 390x693 at the logical width
const ROUND = PLANET_LOOK.size * PLANET_PLACE.scale;
const RINGED = PLANET_LOOK.ringedWidth * PLANET_PLACE.scale;
const RINGED_IDS: SpacePlanetId[] = ['donut_ring', 'mint_candy', 'truffle_hole'];
const EPS = 1e-6;

/** The part of a planet `width` wide centred at `x` that hangs off the screen, as a share of its width. */
const cutOf = (x: number, width: number): number =>
  (Math.max(0, width / 2 - x) + Math.max(0, x + width / 2 - W)) / width;

/** True when a planet `width` wide centred at `x` keeps out of the corridor of `lap` (with the line gap). */
const clearOfCorridor = (lap: number, x: number, width: number): boolean => {
  const half = corridorHalf(lap) + PLANET_PLACE.lineGap;
  return x + width / 2 <= W / 2 - half + EPS || x - width / 2 >= W / 2 + half - EPS;
};

describe('corridorHalf', () => {
  it('is half the width cap of the lap between the dashed lines; lap 1 is the full layer width', () => {
    expect(corridorHalf(1)).toBe(BALANCE.layer.maxWidth / 2);
    expect(corridorHalf(2)).toBe(spaceWidthLimit(lapFirstIndex(2)) / 2);
    expect(corridorHalf(3)).toBeLessThan(corridorHalf(2));
    expect(corridorHalf(30)).toBe(corridorHalf(20));
  });
});

describe('planetLaneX', () => {
  it('keeps out of the corridor and hangs off the edge by at most a quarter, on every lap and side', () => {
    for (let lap = 1; lap <= 20; lap++) {
      for (const size of [ROUND, RINGED, ROUND * 0.85]) {
        for (const side of [0, 1] as const) {
          const x = planetLaneX(lap, W, size, side);
          if (x === null) continue;
          expect(clearOfCorridor(lap, x, size), `lap ${lap}`).toBe(true);
          expect(cutOf(x, size)).toBeLessThanOrEqual(PLANET_PLACE.edgeCut + EPS);
          // The centre is a quarter of the width (or more) in from the edge.
          expect(Math.min(x, W - x)).toBeGreaterThanOrEqual(size * PLANET_PLACE.edgeCut - EPS);
        }
      }
    }
  });

  it('stands on the wanted side and has no lane where the corridor leaves none', () => {
    expect(planetLaneX(10, W, ROUND, 0)).toBeLessThan(W / 2);
    expect(planetLaneX(10, W, ROUND, 1)).toBeGreaterThan(W / 2);
    expect(planetLaneX(2, W, RINGED, 0)).toBeNull();
    expect(planetLaneX(1, W, ROUND, 1)).toBeNull();
  });

  it('stands at its preferred distance from the edge where the lane allows it', () => {
    expect(planetLaneX(12, W, ROUND, 0)).toBeCloseTo(W * PLANET_PLACE.x);
    expect(planetLaneX(12, W, ROUND, 1)).toBeCloseTo(W - W * PLANET_PLACE.x);
  });

  it('mirrors the lanes: the same room on both sides', () => {
    for (let lap = 1; lap <= 12; lap++) {
      for (const size of [ROUND, RINGED]) {
        const left = planetLaneX(lap, W, size, 0);
        const right = planetLaneX(lap, W, size, 1);
        expect(left === null).toBe(right === null);
        if (left !== null && right !== null) expect(left + right).toBeCloseTo(W);
      }
    }
  });
});

describe('planetFit', () => {
  const fit = (lap: number, id: SpacePlanetId, side: 0 | 1) =>
    planetFit(lap, W, planetSize(id).width, side);

  it('fits every round planet on every lap, lap 1 too, smaller where the full size has no room', () => {
    for (const id of SPACE_PLANET_IDS.filter((p) => !RINGED_IDS.includes(p))) {
      for (let lap = 1; lap <= 20; lap++) {
        for (const side of [0, 1] as const) {
          const f = fit(lap, id, side);
          expect(f, `${id} lap ${lap}`).not.toBeNull();
          expect(f!.scale).toBeLessThanOrEqual(PLANET_PLACE.scale);
          expect(f!.scale).toBeGreaterThanOrEqual(PLANET_PLACE.minScale - EPS);
        }
      }
    }
    // The wide laps take a smaller planet, down to the floor of the ladder.
    expect(fit(1, 'cookie', 0)!.scale).toBeLessThan(PLANET_PLACE.scale);
    expect(fit(1, 'cookie', 0)!.scale).toBeGreaterThanOrEqual(PLANET_PLACE.minScale - EPS);
    expect(fit(12, 'cookie', 0)!.scale).toBe(PLANET_PLACE.scale);
  });

  it('fits the ringed planets from lap 5 on, at no less than the floor scale', () => {
    for (const id of RINGED_IDS) {
      for (let lap = 5; lap <= 20; lap++) {
        const f = fit(lap, id, 1);
        expect(f, `${id} lap ${lap}`).not.toBeNull();
        expect(f!.scale).toBeGreaterThanOrEqual(PLANET_PLACE.minScale - EPS);
      }
      expect(fit(1, id, 0)).toBeNull();
    }
  });
});

describe('planetPlace', () => {
  it('always places a planet: the fit where there is one', () => {
    for (let lap = 1; lap <= 20; lap++) {
      for (const id of SPACE_PLANET_IDS) {
        const width = planetSize(id).width;
        const fit = planetFit(lap, W, width, 0);
        const place = planetPlace(lap, W, width, 0);
        if (fit) expect(place).toEqual(fit);
        expect(place.scale).toBeGreaterThanOrEqual(PLANET_PLACE.minScale - EPS);
      }
    }
  });

  it('places a planet with no room at the floor scale, out of the corridor, cut by the edge up to the fallback share', () => {
    for (let lap = 1; lap <= 4; lap++) {
      for (const id of RINGED_IDS) {
        for (const side of [0, 1] as const) {
          const width = planetSize(id).width;
          const place = planetPlace(lap, W, width, side);
          const w = width * place.scale;
          expect(place.scale).toBe(PLANET_PLACE.minScale);
          expect(clearOfCorridor(lap, place.x, w), `${id} lap ${lap}`).toBe(true);
          expect(cutOf(place.x, w)).toBeLessThanOrEqual(PLANET_PLACE.fallbackEdgeCut + EPS);
          expect(side === 0 ? place.x < W / 2 : place.x > W / 2).toBe(true);
        }
      }
    }
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

describe('planetMute', () => {
  it('is fully muted while any part overlaps the flight stripe and plain clear of it', () => {
    for (const h of SCREENS) {
      const band = flightClearBand(h);
      const half = ROUND / 2;
      expect(planetMute((band.top + band.bottom) / 2, half, h)).toBe(1);
      // Touching the stripe from above or below.
      expect(planetMute(band.top - half + 1, half, h)).toBe(1);
      expect(planetMute(band.bottom + half - 1, half, h)).toBe(1);
      // Clear by the feather: plain.
      expect(planetMute(band.bottom + half + PLANET_DIM.featherPx, half, h)).toBe(0);
      expect(planetMute(band.top - half - PLANET_DIM.featherPx, half, h)).toBe(0);
      // Near the HUD the planet is plain (no fade there any more).
      expect(planetMute(half, half, h)).toBe(0);
    }
  });

  it('changes smoothly on the approach', () => {
    const h = 2337;
    const band = flightClearBand(h);
    const half = 126;
    const edge = band.bottom + half;
    const near = planetMute(edge + 20, half, h);
    const far = planetMute(edge + 60, half, h);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
  });
});

describe('lapPlanet', () => {
  it('shows a planet on every lap, lap 1 too, and all nine before one repeats', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = Array.from({ length: 45 }, (_, i) => lapPlanet(seed, i + 1));
      for (let block = 0; block < 5; block++) {
        expect(new Set(ids.slice(block * 9, block * 9 + 9)).size).toBe(9);
      }
    }
  });

  it('gives each lap a planet that fits it whole (no fallback place) for every seed', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (let lap = 1; lap <= 27; lap++) {
        const id = lapPlanet(seed, lap);
        expect(
          planetFit(lap, W, planetSize(id).width, 0),
          `seed ${seed} lap ${lap}`,
        ).not.toBeNull();
      }
    }
  });
});
