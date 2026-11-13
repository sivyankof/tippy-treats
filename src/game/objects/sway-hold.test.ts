import { describe, expect, it } from 'vitest';
import { SwayHold } from './sway-hold';

function shownHold(): SwayHold {
  const hold = new SwayHold();
  hold.beginFrame();
  hold.note(0, 10);
  hold.note(1, -20);
  return hold;
}

describe('SwayHold', () => {
  it('passes the live sway through when nothing is frozen', () => {
    const hold = shownHold();
    expect(hold.apply(0, 5)).toBe(5);
    expect(hold.shownOffset(1)).toBe(-20);
    expect(hold.shownOffset(7)).toBe(0);
  });

  it('keeps the sway of the last shown frame while frozen', () => {
    const hold = shownHold();
    hold.freeze(100);
    expect(hold.apply(0, 99)).toBe(10);
    expect(hold.apply(1, -99)).toBe(-20);
    hold.advance(60);
    expect(hold.apply(0, 99)).toBe(10);
  });

  it('lets a layer without a held pose ride on the one below', () => {
    const hold = shownHold();
    hold.freeze(100);
    expect(hold.apply(2, 99)).toBe(-20);
  });

  it('catches up with the live sway after the freeze and then lets go of the held one', () => {
    const hold = shownHold();
    hold.freeze(50, 0.5);
    hold.advance(60);
    expect(hold.apply(0, 0)).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) hold.advance(16);
    expect(hold.apply(0, 0)).toBe(0);
  });

  it('forgets the shown values when a new frame begins', () => {
    const hold = shownHold();
    hold.beginFrame();
    expect(hold.shownOffset(0)).toBe(0);
  });
});
