import { describe, expect, it } from 'vitest';
import { fadeAlpha, HintClock } from './timeline';

describe('fadeAlpha', () => {
  it('rises, holds and falls', () => {
    expect(fadeAlpha(0, 1000, 200, 300)).toBe(0);
    expect(fadeAlpha(100, 1000, 200, 300)).toBeCloseTo(0.5);
    expect(fadeAlpha(500, 1000, 200, 300)).toBe(1);
    expect(fadeAlpha(850, 1000, 200, 300)).toBeCloseTo(0.5);
  });

  it('is zero outside of the span', () => {
    expect(fadeAlpha(-1, 1000, 200, 300)).toBe(0);
    expect(fadeAlpha(1000, 1000, 200, 300)).toBe(0);
  });

  it('allows an instant start or end', () => {
    expect(fadeAlpha(0, 1000, 0, 0)).toBe(1);
  });
});

describe('HintClock', () => {
  it('runs for its total and then stops', () => {
    const clock = new HintClock();
    expect(clock.active).toBe(false);
    clock.start(100);
    expect(clock.active).toBe(true);
    clock.tick(60);
    expect(clock.elapsed).toBe(60);
    expect(clock.alpha(0, 0)).toBe(1);
    clock.tick(60);
    expect(clock.active).toBe(false);
    clock.tick(500);
    expect(clock.elapsed).toBe(120);
  });

  it('can be stopped and restarted', () => {
    const clock = new HintClock();
    clock.start(100);
    clock.stop();
    expect(clock.active).toBe(false);
    clock.start(50);
    expect(clock.total).toBe(50);
    expect(clock.elapsed).toBe(0);
  });
});
