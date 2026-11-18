import { describe, expect, it } from 'vitest';
import { TOWER_WEATHER } from '../../../data/tower-weather';
import { flakeAlpha, flakeGrow, launchFlake, stepFlake, type DustFlake } from './snow-dust-motion';

const blank = (): DustFlake => ({ x: 0, y: 0, vx: 0, vy: 0, ageMs: 0, lifeMs: 0 });

describe('snow dust motion', () => {
  it('launches out to its side and up', () => {
    const left = launchFlake(blank(), 100, 50, -1, 40, 200, 700);
    const right = launchFlake(blank(), 100, 50, 1, 40, 200, 700);
    expect(left.vx).toBeLessThan(0);
    expect(right.vx).toBeGreaterThan(0);
    expect(left.vy).toBeLessThan(0);
    expect(Math.hypot(left.vx, left.vy)).toBeCloseTo(200);
  });

  it('slows down in the air, then settles downwards', () => {
    const f = launchFlake(blank(), 0, 0, 1, 40, 220, 800);
    let top = 0;
    const speeds: number[] = [];
    for (let t = 0; t < 800; t += 16) {
      stepFlake(f, 16);
      top = Math.min(top, f.y);
      speeds.push(Math.abs(f.vx));
    }
    expect(top).toBeLessThan(-5);
    expect(f.vy).toBeGreaterThan(0);
    expect(speeds.at(-1)!).toBeLessThan(speeds[0]!);
    expect(f.x).toBeGreaterThan(0);
  });

  it('grows from nothing over the grow time and fades out before its life ends', () => {
    expect(flakeGrow(0)).toBe(0);
    expect(flakeGrow(TOWER_WEATHER.dust.growMs)).toBe(1);
    expect(flakeAlpha(0, 800)).toBe(1);
    expect(flakeAlpha(700, 800)).toBeGreaterThan(0);
    expect(flakeAlpha(700, 800)).toBeLessThan(1);
    expect(flakeAlpha(800, 800)).toBe(0);
  });
});
