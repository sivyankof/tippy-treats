import { describe, expect, it } from 'vitest';
import {
  budgetOver,
  budgetVerdict,
  formatBudgetLine,
  formatHeader,
  formatTable,
  percentile,
  SegmentSamples,
  type SegmentStats,
} from './perf-stats';

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

function stats(over: Partial<SegmentStats>): SegmentStats {
  return {
    id: 'calm',
    frames: 100,
    meanMs: 3,
    p95Ms: 4,
    worstMs: 10,
    intervalMeanMs: 16,
    intervalP95Ms: 17,
    drawCallsMean: 30,
    wallMs: 1600,
    fps: 60,
    note: '',
    ...over,
  };
}

describe('budget', () => {
  it('holds light and heavy segments to different draw call limits', () => {
    expect(budgetOver(stats({ id: 'calm', drawCallsMean: 41 })).draws).toBe(true);
    expect(budgetOver(stats({ id: 'calm', drawCallsMean: 40 })).draws).toBe(false);
    expect(budgetOver(stats({ id: 'tower', drawCallsMean: 59 })).draws).toBe(false);
    expect(budgetOver(stats({ id: 'tower', drawCallsMean: 61 })).draws).toBe(true);
  });

  it('skips the draw calls of a segment that has no count', () => {
    expect(budgetOver(stats({ drawCallsMean: null })).draws).toBe(false);
  });

  it('marks the values over and the row', () => {
    const lines = formatTable([stats({ meanMs: 9, worstMs: 60, intervalMeanMs: 20 })], 1).split(
      '\n',
    );
    expect(lines[2]).toBe('| calm ! | 9.0! | 4.0 | 60.0! | 20.0! | 17.0 | 100 | 30.0 | 60.0 |  |');
  });

  it('leaves a row within the budget unmarked', () => {
    expect(formatTable([stats({})], 1)).not.toContain('!');
  });

  it('gives the verdict line', () => {
    expect(formatBudgetLine(budgetVerdict([]))).toBe('budget: ok');
    expect(formatBudgetLine(budgetVerdict([stats({})]))).toBe('budget: ok');
    const rows = [
      stats({ id: 'edge', meanMs: 9 }),
      stats({ id: 'tower' }),
      stats({ id: 'space', worstMs: 51 }),
    ];
    expect(budgetVerdict(rows)).toEqual({ ok: false, over: ['edge', 'space'] });
    expect(formatBudgetLine(budgetVerdict(rows))).toBe('budget: over in 2 segments (edge, space)');
    expect(formatBudgetLine(budgetVerdict([stats({ meanMs: 9 })]))).toBe(
      'budget: over in 1 segment (calm)',
    );
  });
});

describe('formatHeader', () => {
  it('names the canvas, the density and what was changed for the run', () => {
    const line = formatHeader({
      fx: 'full',
      canvas: { width: 780, height: 1688 },
      css: { width: 390, height: 843.9 },
      devicePixelRatio: 3,
      densityCap: 2,
      textureUnits: 1,
      maxTextureUnits: 16,
      hidden: ['bg', 'hud'],
    });
    expect(line).toBe(
      'fx=full canvas=780x1688px css=390x844 dpr=3 density=2.00 cap=2 units=1/16 hidden=nobg,nohud',
    );
  });

  it('marks what was left as it is', () => {
    const line = formatHeader({
      fx: 'lite',
      canvas: { width: 1080, height: 2337 },
      css: { width: 0, height: 0 },
      devicePixelRatio: 1,
      densityCap: null,
      textureUnits: 16,
      maxTextureUnits: 16,
      hidden: [],
    });
    expect(line).toBe(
      'fx=lite canvas=1080x2337px css=0x0 dpr=1 density=0.00 cap=- units=16/16 hidden=-',
    );
  });
});
