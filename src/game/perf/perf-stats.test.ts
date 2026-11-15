import { describe, expect, it } from 'vitest';
import { formatTable, percentile, SegmentSamples } from './perf-stats';

describe('percentile', () => {
  it('takes the nearest rank', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 0.95)).toBe(10);
    expect(percentile(sorted, 0.5)).toBe(5);
    expect(percentile(sorted, 0.1)).toBe(1);
  });

  it('is 0 for no frames and clamps the share', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([3, 4], 0)).toBe(3);
    expect(percentile([3, 4], 2)).toBe(4);
  });
});

describe('SegmentSamples', () => {
  it('sums up mean, p95 and worst of the frames', () => {
    const samples = new SegmentSamples();
    for (let i = 1; i <= 100; i++) samples.add(i, 10, 1000 + i * 10);
    const stats = samples.summary('calm', 0.95);
    expect(stats.frames).toBe(100);
    expect(stats.meanMs).toBeCloseTo(50.5);
    expect(stats.p95Ms).toBe(95);
    expect(stats.worstMs).toBe(100);
    expect(stats.drawCallsMean).toBe(10);
    expect(stats.intervalMeanMs).toBeCloseTo(10);
    expect(stats.intervalP95Ms).toBe(10);
    expect(stats.wallMs).toBe(990);
    expect(stats.fps).toBeCloseTo(100);
  });

  it('grows past its first capacity', () => {
    const samples = new SegmentSamples();
    for (let i = 0; i < 10000; i++) samples.add(1, null, i);
    const stats = samples.summary('x', 0.95);
    expect(stats.frames).toBe(10000);
    expect(stats.meanMs).toBe(1);
  });

  it('reports no draw calls when one frame could not count them', () => {
    const samples = new SegmentSamples();
    samples.add(1, 5, 0);
    samples.add(1, null, 16);
    expect(samples.summary('x', 0.95).drawCallsMean).toBeNull();
  });

  it('measures the gaps between frames, not the first frame', () => {
    const samples = new SegmentSamples();
    for (const at of [100, 116, 132, 200]) samples.add(1, null, at);
    const stats = samples.summary('x', 0.95);
    expect(stats.intervalMeanMs).toBeCloseTo(100 / 3);
    expect(stats.intervalP95Ms).toBe(68);
  });

  it('keeps the gaps when the capacity grows', () => {
    const samples = new SegmentSamples();
    for (let i = 0; i < 5000; i++) samples.add(1, null, i * 2);
    expect(samples.summary('x', 0.95).intervalMeanMs).toBe(2);
  });

  it('is all zeros for an empty window', () => {
    const stats = new SegmentSamples().summary('x', 0.95);
    expect(stats).toMatchObject({
      frames: 0,
      meanMs: 0,
      p95Ms: 0,
      worstMs: 0,
      intervalMeanMs: 0,
      intervalP95Ms: 0,
      fps: 0,
    });
    expect(stats.drawCallsMean).toBeNull();
  });
});

describe('formatTable', () => {
  it('prints a markdown row per segment', () => {
    const row = new SegmentSamples();
    row.add(2, 12, 0);
    row.add(4, 14, 16);
    const text = formatTable([row.summary('calm', 0.95, 'ok')], 2);
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('| calm | 3.00 | 4.00 | 4.00 | 16.00 | 16.00 | 2 | 13.0 | 62.5 | ok |');
  });
});
