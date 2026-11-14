import { describe, expect, it } from 'vitest';
import {
  LongestStill,
  StillTracker,
  effectiveStillMs,
  isOnScreen,
  toScreenRect,
} from './still-tracker';

/** One frame: observe every given key, then forget the unseen. */
function frame(
  tracker: StillTracker<string>,
  nowMs: number,
  items: Record<string, { values: number[]; tag?: string }>,
): Record<string, number> {
  tracker.beginFrame();
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(items)) {
    out[key] = tracker.observe(key, item.values, item.tag ?? '', nowMs);
  }
  tracker.endFrame();
  return out;
}

describe('StillTracker', () => {
  it('counts the time since the last change', () => {
    const tracker = new StillTracker<string>();
    expect(frame(tracker, 0, { a: { values: [1, 2] } }).a).toBe(0);
    expect(frame(tracker, 500, { a: { values: [1, 2] } }).a).toBe(500);
    expect(frame(tracker, 2500, { a: { values: [1, 2] } }).a).toBe(2500);
  });

  it('restarts the count on any change', () => {
    const tracker = new StillTracker<string>();
    frame(tracker, 0, { a: { values: [1, 2] } });
    frame(tracker, 1000, { a: { values: [1, 2] } });
    expect(frame(tracker, 1100, { a: { values: [1, 3] } }).a).toBe(0);
    expect(frame(tracker, 1600, { a: { values: [1, 3] } }).a).toBe(500);
  });

  it('counts a changed tag (frame name, text) as a change', () => {
    const tracker = new StillTracker<string>();
    frame(tracker, 0, { a: { values: [1], tag: 'open' } });
    expect(frame(tracker, 900, { a: { values: [1], tag: 'closed' } }).a).toBe(0);
  });

  it('ignores changes within the tolerance but notices a slow drift', () => {
    const tracker = new StillTracker<string>([0.1]);
    frame(tracker, 0, { a: { values: [10] } });
    // Each step is within the tolerance of the last frame, but together they leave the reference.
    expect(frame(tracker, 100, { a: { values: [10.06] } }).a).toBe(100);
    expect(frame(tracker, 200, { a: { values: [10.12] } }).a).toBe(0);
    expect(frame(tracker, 300, { a: { values: [10.12] } }).a).toBe(100);
  });

  it('forgets a thing that was not shown for a frame', () => {
    const tracker = new StillTracker<string>();
    frame(tracker, 0, { a: { values: [1] }, b: { values: [1] } });
    frame(tracker, 1000, { b: { values: [1] } });
    expect(tracker.size).toBe(1);
    // `a` comes back: it starts from zero, not from the time it was last seen.
    expect(frame(tracker, 3000, { a: { values: [1] }, b: { values: [1] } })).toEqual({
      a: 0,
      b: 3000,
    });
  });

  it('treats a different number of values as a change', () => {
    const tracker = new StillTracker<string>();
    frame(tracker, 0, { a: { values: [1] } });
    expect(frame(tracker, 500, { a: { values: [1, 1] } }).a).toBe(0);
  });

  it('starts over after an explicit forget', () => {
    const tracker = new StillTracker<string>();
    frame(tracker, 0, { a: { values: [1] } });
    tracker.beginFrame();
    tracker.observe('a', [1], '', 800);
    tracker.forget('a');
    tracker.endFrame();
    expect(frame(tracker, 1500, { a: { values: [1] } }).a).toBe(0);
  });

  it('clears everything', () => {
    const tracker = new StillTracker<string>();
    frame(tracker, 0, { a: { values: [1] } });
    tracker.clear();
    expect(tracker.size).toBe(0);
  });
});

describe('effectiveStillMs', () => {
  it('is the shortest time along the chain', () => {
    expect(effectiveStillMs(3000, 400)).toBe(400);
    expect(effectiveStillMs(300, Infinity)).toBe(300);
    expect(effectiveStillMs(5000, 5000)).toBe(5000);
  });
});

describe('isOnScreen', () => {
  const view = { w: 1080, h: 1920 };
  const still = { x: 0, y: 0 };
  const follows = { x: 1, y: 1 };

  it('accepts a rectangle that overlaps the screen', () => {
    expect(
      isOnScreen({ x: 100, y: 100, width: 50, height: 50 }, still, follows, view.w, view.h),
    ).toBe(true);
    expect(
      isOnScreen({ x: -20, y: 10, width: 50, height: 50 }, still, follows, view.w, view.h),
    ).toBe(true);
  });

  it('rejects one fully outside', () => {
    expect(
      isOnScreen({ x: -80, y: 10, width: 50, height: 50 }, still, follows, view.w, view.h),
    ).toBe(false);
    expect(
      isOnScreen({ x: 10, y: 2000, width: 50, height: 50 }, still, follows, view.w, view.h),
    ).toBe(false);
  });

  it('moves the world with the camera, but not a fixed object', () => {
    const rect = { x: 100, y: -3000, width: 50, height: 50 };
    const scroll = { x: 0, y: -3000 };
    expect(isOnScreen(rect, scroll, follows, view.w, view.h)).toBe(true);
    expect(isOnScreen(rect, scroll, { x: 0, y: 0 }, view.w, view.h)).toBe(false);
  });
});

describe('toScreenRect', () => {
  it('moves a rectangle by the camera scroll, as far as the object follows it', () => {
    const rect = { x: 100, y: 500, width: 40, height: 30 };
    const scroll = { x: 10, y: -200 };
    expect(toScreenRect(rect, scroll, { x: 1, y: 1 })).toEqual({
      x: 90,
      y: 700,
      width: 40,
      height: 30,
    });
    expect(toScreenRect(rect, scroll, { x: 0, y: 0 })).toEqual(rect);
  });

  it('tells a sub-pixel jitter from a visible move once tracked with a tolerance', () => {
    const tracker = new StillTracker<string>([0.5, 0.5, 0.5, 0.5]);
    const at = (nowMs: number, x: number, scale: number): number => {
      const r = toScreenRect({ x, y: 0, width: 80 * scale, height: 80 * scale }, zero, zero);
      return frame(tracker, nowMs, { a: { values: [r.x, r.y, r.width, r.height] } }).a ?? 0;
    };
    const zero = { x: 0, y: 0 };
    at(0, 10, 1);
    // 0.06 % of 80 px is 0.05 px: not visible.
    expect(at(1000, 10.2, 1.0006)).toBe(1000);
    expect(at(2000, 10.2, 1.0006)).toBe(2000);
    // Over half a pixel: a visible move.
    expect(at(2100, 10.8, 1)).toBe(0);
  });
});

describe('objects without bounds', () => {
  it('count as on screen and are still reported when they never change', () => {
    const view = { w: 1080, h: 1920 };
    const zero = { x: 0, y: 0 };
    expect(isOnScreen(null, zero, zero, view.w, view.h)).toBe(true);
    const tracker = new StillTracker<string>();
    const stillMs = (nowMs: number): number =>
      frame(tracker, nowMs, { sky: { values: [0, 0] } }).sky ?? 0;
    stillMs(0);
    expect(stillMs(2500)).toBeGreaterThan(2000);
  });
});

describe('LongestStill', () => {
  it('keeps the longest time per key and lists those over the threshold, longest first', () => {
    const longest = new LongestStill<string, string>();
    longest.record('a', 1000, 'a1');
    longest.record('a', 2600, 'a2');
    longest.record('a', 1800, 'a3');
    longest.record('b', 4000, 'b1');
    longest.record('c', 2000, 'c1');
    expect(longest.over(2000)).toEqual([
      { ms: 4000, note: 'b1' },
      { ms: 2600, note: 'a2' },
    ]);
  });
});
