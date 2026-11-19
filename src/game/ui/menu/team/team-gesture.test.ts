import { describe, expect, it } from 'vitest';
import { PressGesture } from './team-gesture';

describe('PressGesture', () => {
  it('is a tap when released quickly without moving', () => {
    const g = new PressGesture(450, 24);
    g.begin(0, 0, 0);
    expect(g.move(5, 5)).toBe(false);
    expect(g.holdReached(100)).toBe(false);
    expect(g.end()).toBe('tap');
  });

  it('is a long press once, and then not a tap', () => {
    const g = new PressGesture(450, 24);
    g.begin(0, 0, 0);
    expect(g.holdReached(500)).toBe(true);
    expect(g.holdReached(600)).toBe(false);
    expect(g.end()).toBe('none');
  });

  it('is a drag after moving far enough, and then neither tap nor long press', () => {
    const g = new PressGesture(450, 24);
    g.begin(0, 0, 0);
    expect(g.move(30, 0)).toBe(true);
    expect(g.move(60, 0)).toBe(false);
    expect(g.dragging).toBe(true);
    expect(g.holdReached(900)).toBe(false);
    expect(g.end()).toBe('drop');
  });

  it('does not start a drag after a long press', () => {
    const g = new PressGesture(450, 24);
    g.begin(0, 0, 0);
    g.holdReached(500);
    expect(g.move(100, 100)).toBe(false);
    expect(g.end()).toBe('none');
  });

  it('is idle after cancel and end', () => {
    const g = new PressGesture(450, 24);
    g.begin(0, 0, 0);
    g.cancel();
    expect(g.active).toBe(false);
    expect(g.end()).toBe('none');
  });
});
