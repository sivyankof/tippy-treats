import { describe, expect, it } from 'vitest';
import { GLASS_WEATHER } from '../../../data/window-look';
import { cycleFade, glassPose, newGlassPose } from './glass-motion';

const RAIN = GLASS_WEATHER.rain;
const LEAVES = GLASS_WEATHER.leaves;

describe('glass motion', () => {
  it('fades to nothing at the ends of a cycle and is whole in the middle', () => {
    expect(cycleFade(0)).toBe(0);
    expect(cycleFade(1)).toBe(0);
    expect(cycleFade(0.5)).toBe(1);
  });

  it('keeps every drop inside the glass at any time', () => {
    if (!RAIN) throw new Error('no rain');
    const pose = newGlassPose();
    for (let i = 0; i < RAIN.window; i++) {
      for (let t = 0; t < 60000; t += 997) {
        glassPose(RAIN, i, t, pose);
        expect(pose.u).toBeGreaterThanOrEqual(0);
        expect(pose.u).toBeLessThanOrEqual(1);
        expect(pose.v).toBeGreaterThanOrEqual(0);
        expect(pose.v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('lets a leaf sway across the glass without leaving it', () => {
    if (!LEAVES) throw new Error('no leaves');
    const pose = newGlassPose();
    for (let i = 0; i < LEAVES.showcase; i++) {
      for (let t = 0; t < 60000; t += 811) {
        glassPose(LEAVES, i, t, pose);
        expect(pose.u).toBeGreaterThan(-0.1);
        expect(pose.u).toBeLessThan(1.1);
      }
    }
  });

  it('does not move the items in step', () => {
    if (!RAIN) throw new Error('no rain');
    const a = glassPose(RAIN, 0, 3000, newGlassPose());
    const b = glassPose(RAIN, 1, 3000, newGlassPose());
    expect(a.v).not.toBeCloseTo(b.v, 2);
  });
});
