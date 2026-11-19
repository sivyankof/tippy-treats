import { describe, expect, it } from 'vitest';
import { CREATURE_SLEEP } from '../../data/creatures/creature-style';
import { zPose, type ZPose } from './sleep-zs';

const pose = (t: number, i: number): ZPose => zPose(t, i, { x: 0, y: 0, alpha: 0, scale: 0 });

describe('zPose', () => {
  const cfg = CREATURE_SLEEP.zs;

  it('starts invisible at the anchor and ends invisible above it', () => {
    const start = pose(0, 0);
    expect(start.alpha).toBe(0);
    expect(start.y).toBeCloseTo(0);
    expect(pose(cfg.periodMs - 1, 0).alpha).toBeLessThan(0.02);
  });

  it('rises and drifts as the loop goes on', () => {
    const early = pose(cfg.periodMs * 0.3, 0);
    const late = pose(cfg.periodMs * 0.7, 0);
    expect(late.y).toBeLessThan(early.y);
    expect(late.x).toBeGreaterThan(early.x);
    expect(late.scale).toBeGreaterThan(early.scale);
  });

  it('is fully visible in the middle and spreads the letters over the loop', () => {
    expect(pose(cfg.periodMs * 0.5, 0).alpha).toBe(1);
    expect(pose(0, 1).y).not.toBeCloseTo(pose(0, 0).y);
  });
});
