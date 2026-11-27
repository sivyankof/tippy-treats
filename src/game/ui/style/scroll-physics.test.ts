import { describe, expect, it } from 'vitest';
import { MENU } from '../../../data/common/menu-layout';
import { ScrollPhysics } from './scroll-physics';

const cfg = MENU.style.scroll;

function make(max = 1000): { physics: ScrollPhysics; clock: { now: number } } {
  const clock = { now: 0 };
  return {
    physics: new ScrollPhysics(
      () => max,
      () => clock.now,
    ),
    clock,
  };
}

/** A fast drag up the screen in four steps, finger still down. */
function fling(physics: ScrollPhysics, clock: { now: number }): void {
  physics.down(900, true);
  for (let i = 1; i <= 4; i++) {
    clock.now += 16;
    physics.move(900 - i * 40, true);
  }
}

describe('ScrollPhysics', () => {
  it('does not drag before the finger moves past the drag distance', () => {
    const { physics } = make();
    physics.down(500, true);
    expect(physics.move(500 - cfg.dragPx, true)).toBe(false);
    expect(physics.wasDragged).toBe(false);
    expect(physics.move(500 - cfg.dragPx - 5, true)).toBe(true);
    expect(physics.wasDragged).toBe(true);
    expect(physics.offset).toBeGreaterThan(0);
  });

  it('ignores a press that began where it is not allowed, and a move without the finger down', () => {
    const { physics } = make();
    physics.down(500, false);
    expect(physics.move(100, true)).toBe(false);
    physics.down(500, true);
    expect(physics.move(100, false)).toBe(false);
    expect(physics.offset).toBe(0);
  });

  it('scales a drag by the unit of the list', () => {
    const { physics } = make();
    physics.down(500, true);
    physics.move(400, true, 0.5);
    expect(physics.offset).toBe(200);
  });

  it('throws after a fast drag and glides to a stop', () => {
    const { physics, clock } = make();
    fling(physics, clock);
    const dragged = physics.offset;
    physics.up();
    expect(physics.tick(16)).toBe(true);
    expect(physics.offset).toBeGreaterThan(dragged);
    let guard = 0;
    while (physics.tick(16) && guard++ < 2000);
    expect(physics.tick(16)).toBe(false);
  });

  it('does not throw when the finger rested before it was lifted', () => {
    const { physics, clock } = make();
    physics.down(900, true);
    clock.now += 16;
    physics.move(800, true);
    clock.now += cfg.speedWindowMs + 10;
    physics.up();
    expect(physics.tick(16)).toBe(false);
  });

  it('a lift without a drag throws nothing', () => {
    const { physics } = make();
    physics.down(500, true);
    physics.up();
    expect(physics.tick(16)).toBe(false);
  });

  it('a finger on a gliding list stops it and counts as a drag for the buttons', () => {
    const { physics, clock } = make();
    fling(physics, clock);
    physics.up();
    physics.down(500, true);
    expect(physics.wasDragged).toBe(true);
    expect(physics.tick(16)).toBe(false);
    physics.up();
    physics.down(500, true);
    expect(physics.wasDragged).toBe(false);
  });

  it('stops at the ends of the range', () => {
    const { physics } = make(300);
    physics.wheel(5000);
    expect(physics.offset).toBe(300);
    physics.wheel(-5000);
    expect(physics.offset).toBe(0);
    physics.jump(9999);
    expect(physics.offset).toBe(300);
  });

  it('stops the glide at an end', () => {
    const { physics, clock } = make(50);
    fling(physics, clock);
    physics.up();
    expect(physics.offset).toBe(50);
    expect(physics.tick(16)).toBe(true);
    expect(physics.tick(16)).toBe(false);
  });

  it('release stops everything', () => {
    const { physics, clock } = make();
    fling(physics, clock);
    physics.release();
    physics.up();
    expect(physics.tick(16)).toBe(false);
  });
});
