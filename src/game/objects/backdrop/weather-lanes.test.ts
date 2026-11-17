import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { LOGICAL_SIZE } from '../../../data/screen';
import { WEATHER_LOOK } from '../../../data/weather-look';
import { laneCount, laneU, snowSpots, wrapGap } from './weather-lanes';

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

  it('puts a flake on the middle of its lane', () => {
    for (const s of layout(3)) expect(s.u).toBe(laneU(s.lane, lanes));
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
