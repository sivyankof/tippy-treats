import { describe, expect, it } from 'vitest';
import { FrameSparkleRota, type SparkleFrame } from './frame-sparkle-rota';

const TIMING = { periodMs: 5000, runMs: 2000, firstDelayMs: 1000 };

class Fake implements SparkleFrame {
  shown = true;
  progress: number | null = null;
  starts = 0;
  constructor(readonly name: string) {}
  isShown(): boolean {
    return this.shown;
  }
  show(progress: number): void {
    if (this.progress === null) this.starts++;
    this.progress = progress;
  }
  hide(): void {
    this.progress = null;
  }
  get running(): boolean {
    return this.progress !== null;
  }
}

function setup(n: number) {
  const reduced = { on: false };
  const rota = new FrameSparkleRota(TIMING, () => reduced.on);
  const frames = Array.from({ length: n }, (_, i) => new Fake(`f${i}`));
  frames.forEach((f) => rota.register(f));
  const run = (ms: number, step = 50): void => {
    for (let t = 0; t < ms; t += step) rota.update(step);
  };
  return { rota, frames, run, reduced };
}

describe('frame sparkle rota', () => {
  it('waits for the first delay and then starts one frame', () => {
    const { frames, run } = setup(2);
    run(950);
    expect(frames.some((f) => f.running)).toBe(false);
    run(100);
    expect(frames.filter((f) => f.running)).toHaveLength(1);
  });

  it('never runs two at once and goes round in order', () => {
    const { frames, run } = setup(3);
    const order: string[] = [];
    let last: Fake | null = null;
    for (let t = 0; t < 40000; t += 50) {
      run(50);
      const running = frames.filter((f) => f.running);
      expect(running.length).toBeLessThanOrEqual(1);
      const cur = running[0] ?? null;
      if (cur && cur !== last) order.push(cur.name);
      last = cur;
    }
    expect(order.slice(0, 6)).toEqual(['f0', 'f1', 'f2', 'f0', 'f1', 'f2']);
  });

  it('starts a run every period and each run lasts runMs', () => {
    const { frames, run } = setup(1);
    run(1050);
    expect(frames[0]?.running).toBe(true);
    run(1900);
    expect(frames[0]?.running).toBe(true);
    run(150);
    expect(frames[0]?.running).toBe(false);
    run(2800);
    expect(frames[0]?.running).toBe(false);
    run(200);
    expect(frames[0]?.running).toBe(true);
    expect(frames[0]?.starts).toBe(2);
  });

  it('skips frames that are not shown', () => {
    const { frames, run } = setup(3);
    if (frames[0]) frames[0].shown = false;
    run(1100);
    expect(frames[1]?.running).toBe(true);
    run(5000);
    expect(frames[2]?.running).toBe(true);
    expect(frames[0]?.starts).toBe(0);
  });

  it('waits while no frame is shown and starts as soon as one is', () => {
    const { frames, run } = setup(1);
    if (frames[0]) frames[0].shown = false;
    run(5000);
    expect(frames[0]?.starts).toBe(0);
    if (frames[0]) frames[0].shown = true;
    run(100);
    expect(frames[0]?.running).toBe(true);
  });

  it('stops a run whose frame disappears', () => {
    const { frames, run } = setup(1);
    run(1500);
    expect(frames[0]?.running).toBe(true);
    if (frames[0]) frames[0].shown = false;
    run(50);
    expect(frames[0]?.running).toBe(false);
  });

  it('runs nothing at the minimal level and stops a run when it drops there', () => {
    const { frames, run, reduced } = setup(2);
    reduced.on = true;
    run(20000);
    expect(frames.every((f) => f.starts === 0)).toBe(true);
    reduced.on = false;
    run(1100);
    expect(frames.some((f) => f.running)).toBe(true);
    reduced.on = true;
    run(50);
    expect(frames.some((f) => f.running)).toBe(false);
  });

  it('forgets a frame that leaves, even while it runs, and keeps the pause before the next', () => {
    const { rota, frames, run } = setup(2);
    run(1100);
    const first = frames[0];
    if (first) rota.unregister(first);
    expect(rota.active).toBeNull();
    run(TIMING.periodMs - TIMING.runMs - 100);
    expect(frames[1]?.running).toBe(false);
    run(200);
    expect(frames[1]?.running).toBe(true);
  });

  it('clear stops everything', () => {
    const { rota, frames, run } = setup(2);
    run(1500);
    rota.clear();
    expect(frames.some((f) => f.running)).toBe(false);
    run(20000);
    expect(frames.some((f) => f.running)).toBe(false);
  });
});
