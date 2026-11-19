import { describe, expect, it } from 'vitest';
import { FrameWorkStats } from './frame-work-stats';

const OPTIONS = { frames: 100, percentile: 0.95, refreshFrames: 1 };

describe('FrameWorkStats', () => {
  it('is zero without frames', () => {
    const stats = new FrameWorkStats(OPTIONS);
    expect(stats.average).toBe(0);
    expect(stats.percentile).toBe(0);
  });

  it('reports the average and the 95th percentile', () => {
    const stats = new FrameWorkStats(OPTIONS);
    for (let i = 1; i <= 100; i++) stats.add(i);
    expect(stats.average).toBeCloseTo(50.5);
    expect(stats.percentile).toBe(95);
  });

  it('keeps only the latest frames', () => {
    const stats = new FrameWorkStats(OPTIONS);
    for (let i = 0; i < 100; i++) stats.add(50);
    for (let i = 0; i < 100; i++) stats.add(5);
    expect(stats.average).toBeCloseTo(5);
    expect(stats.percentile).toBe(5);
  });
});
