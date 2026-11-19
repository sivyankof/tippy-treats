import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/common/rng';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { WEATHER_LOOK } from '../../../data/weather/weather-look';
import { laneCount, laneU, snowSpots, startU, wrapGap } from './weather-lanes';

const SNOW = WEATHER_LOOK.snow;
const lanes = laneCount(LOGICAL_SIZE.width, SNOW.laneGapPx);

function layout(seed: number) {
  const rng = new Rng(seed);
  return snowSpots(
    SNOW.count,
    lanes,
    () => rng.next(),
    () => rng.next(),
  );
}

describe('snow lanes', () => {
  it('keeps lanes further apart than a sway plus the biggest flake', () => {
    const pitch = LOGICAL_SIZE.width / lanes;
    const swayMax = WEATHER_LOOK.snow.swayPx[1];
    expect(pitch).toBeGreaterThanOrEqual(2 * swayMax + Math.max(...SNOW.flakePx));
  });

  it('fits every flake into lanes within the cap', () => {
    expect(lanes * SNOW.laneCap).toBeGreaterThanOrEqual(SNOW.count);
    for (let seed = 1; seed <= 20; seed++) {
      const counts = new Map<number, number>();
      for (const s of layout(seed)) counts.set(s.lane, (counts.get(s.lane) ?? 0) + 1);
      for (const n of counts.values()) expect(n).toBeLessThanOrEqual(SNOW.laneCap);
    }
  });

  it('keeps flakes of one lane at the minimum gap down the screen', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const spots = layout(seed);
      for (const a of spots) {
        for (const b of spots) {
          if (a === b || a.lane !== b.lane) continue;
          expect(wrapGap(a.v, b.v) * SNOW.gapRefHeight).toBeGreaterThanOrEqual(SNOW.minGapPx);
        }
      }
    }
  });

  it('spreads the flakes over the whole width, not into columns at the edges', () => {
    const third = new Map<number, number>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const s of layout(seed)) {
        const k = Math.min(2, Math.floor(s.u * 3));
        third.set(k, (third.get(k) ?? 0) + 1);
      }
    }
    const total = SNOW.count * 20;
    for (const n of third.values()) expect(n / total).toBeGreaterThan(0.25);
    for (const s of layout(5)) expect(s.u).toBeGreaterThan(0);
    const us = layout(5).map((s) => s.u);
    expect(Math.min(...us)).toBeLessThan(0.2);
    expect(Math.max(...us)).toBeGreaterThan(0.8);
  });

  it('keeps a flake within the jitter of the middle of its lane', () => {
    for (const s of layout(3)) {
      expect(Math.abs(s.u - laneU(s.lane, lanes))).toBeLessThanOrEqual(
        SNOW.laneJitter / lanes + 1e-9,
      );
    }
  });

  it('starts most flakes in the side areas, at spread-out x positions', () => {
    const rng = new Rng(11);
    const xs: number[] = [];
    let side = 0;
    const total = 4000;
    for (let i = 0; i < total; i++) {
      const u = startU(rng, SNOW.sideBias, SNOW.sideShare);
      if (u < SNOW.sideShare || u > 1 - SNOW.sideShare) {
        side++;
        if (u < SNOW.sideShare) xs.push(u);
      }
    }
    expect(side / total).toBeGreaterThanOrEqual(0.55);
    // Inside one side area the x values fill it, not a few fixed values.
    const buckets = new Set(xs.map((u) => Math.floor((u / SNOW.sideShare) * 10)));
    expect(buckets.size).toBe(10);
  });

  it('does not put the lane-placed flakes of the side areas on a few fixed x values', () => {
    const xs = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const spots = snowSpots(
        SNOW.count,
        lanes,
        () => startU(rng, SNOW.sideBias, SNOW.sideShare),
        () => rng.next(),
      );
      for (const s of spots) if (s.u < SNOW.sideShare) xs.add(s.u.toFixed(3));
    }
    expect(xs.size).toBeGreaterThan(100);
  });

  it('takes the next lane over when the nearest is full', () => {
    const spots = snowSpots(
      SNOW.laneCap + 1,
      lanes,
      () => 0.01,
      (() => {
        let n = 0;
        return () => (n++ * 0.1) % 1;
      })(),
    );
    expect(new Set(spots.map((s) => s.lane))).toEqual(new Set([0, 1]));
  });
});
