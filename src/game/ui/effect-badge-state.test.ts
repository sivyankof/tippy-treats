import { describe, expect, it } from 'vitest';
import type { ActiveEffect } from '../../core/abilities/types';
import { ANIM } from '../../data/anim';
import {
  badgeCreature,
  badgeVisual,
  BadgeTracker,
  type BadgeState,
  type BadgeVisual,
} from './effect-badge-state';

function effect(id: ActiveEffect['id'], layersLeft: number): ActiveEffect {
  return { id, layersLeft, level: 1, boosted: false, value: 0 };
}

const linear = (t: number): number => t;
const scratch = (): BadgeVisual => ({ scale: 0, alpha: 0 });

describe('BadgeTracker', () => {
  it('adds a badge per effect and one for the shield, in order of appearance', () => {
    const tracker = new BadgeTracker();
    tracker.sync([effect('honey', 3)], 0);
    tracker.sync([effect('honey', 3), effect('frosty', 2)], 4);
    expect(tracker.items.map((b) => b.key)).toEqual(['honey', 'frosty', 'shield']);
    expect(tracker.items.map((b) => b.layersLeft)).toEqual([3, 2, 4]);
    expect(tracker.items.every((b) => b.phase === 'in')).toBe(true);
  });

  it('settles a new badge after the appear time', () => {
    const tracker = new BadgeTracker();
    tracker.sync([effect('honey', 3)], 0);
    tracker.step(ANIM.badges.inMs - 1);
    expect(tracker.items[0]?.phase).toBe('in');
    tracker.step(1);
    expect(tracker.items[0]?.phase).toBe('live');
  });

  it('restarts the counter pop only when the number changes', () => {
    const tracker = new BadgeTracker();
    tracker.sync([effect('honey', 3)], 0);
    tracker.step(500);
    tracker.sync([effect('honey', 3)], 0);
    expect(tracker.items[0]?.counterAgeMs).toBeGreaterThan(400);
    tracker.sync([effect('honey', 2)], 0);
    expect(tracker.items[0]?.counterAgeMs).toBe(0);
    expect(tracker.items[0]?.layersLeft).toBe(2);
  });

  it('shrinks a finished effect out and then removes its badge', () => {
    const tracker = new BadgeTracker();
    tracker.sync([effect('honey', 1)], 0);
    tracker.step(1000);
    tracker.sync([], 0);
    expect(tracker.items[0]?.phase).toBe('out');
    expect(tracker.step(ANIM.badges.outMs - 1)).toBe(false);
    expect(tracker.items).toHaveLength(1);
    expect(tracker.step(1)).toBe(true);
    expect(tracker.items).toHaveLength(0);
  });

  it('brings a leaving badge back when the effect returns', () => {
    const tracker = new BadgeTracker();
    tracker.sync([effect('honey', 1)], 0);
    tracker.sync([], 0);
    tracker.step(50);
    tracker.sync([effect('honey', 4)], 0);
    expect(tracker.items).toHaveLength(1);
    expect(tracker.items[0]).toMatchObject({ phase: 'in', layersLeft: 4, ageMs: 0 });
  });

  it('keeps the order of the others when one leaves', () => {
    const tracker = new BadgeTracker();
    tracker.sync([effect('honey', 2), effect('frosty', 2), effect('lemon', 2)], 0);
    tracker.sync([effect('honey', 2), effect('lemon', 2)], 0);
    tracker.step(ANIM.badges.outMs);
    expect(tracker.items.map((b) => b.key)).toEqual(['honey', 'lemon']);
  });
});

describe('badgeVisual', () => {
  function badge(patch: Partial<BadgeState>): BadgeState {
    return {
      key: 'honey',
      layersLeft: 3,
      phase: 'live',
      ageMs: 5000,
      counterAgeMs: Infinity,
      x: 0,
      seen: true,
      ...patch,
    };
  }
  const times = [0, 100, 200, 300, 400, 500, 600, 900];

  it('grows in with the ease and stays opaque', () => {
    const v = badgeVisual(
      badge({ phase: 'in', ageMs: ANIM.badges.inMs / 2 }),
      0,
      linear,
      scratch(),
    );
    expect(v.scale).toBeGreaterThan(0.49);
    expect(v.scale).toBeLessThan(0.5 * ANIM.badges.pulseScale + 1e-9);
    expect(v.alpha).toBe(1);
  });

  it('pulses between 1 and the pulse scale while live', () => {
    const scales = times.map((t) => badgeVisual(badge({}), t, linear, scratch()).scale);
    for (const scale of scales) {
      expect(scale).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(scale).toBeLessThanOrEqual(ANIM.badges.pulseScale + 1e-9);
    }
    expect(Math.max(...scales)).toBeGreaterThan(1.01);
  });

  it('blinks with one layer left and not before', () => {
    const blink = times.map(
      (t) => badgeVisual(badge({ layersLeft: 1 }), t, linear, scratch()).alpha,
    );
    expect(Math.min(...blink)).toBeLessThan(0.6);
    expect(Math.min(...blink)).toBeGreaterThanOrEqual(ANIM.badges.blinkMinAlpha - 1e-9);
    const steady = times.map(
      (t) => badgeVisual(badge({ layersLeft: 2 }), t, linear, scratch()).alpha,
    );
    expect(steady.every((a) => a === 1)).toBe(true);
  });

  it('shrinks to nothing when leaving', () => {
    const half = badgeVisual(
      badge({ phase: 'out', ageMs: ANIM.badges.outMs / 2 }),
      0,
      linear,
      scratch(),
    );
    expect(half.scale).toBeCloseTo(0.5, 5);
    const gone = badgeVisual(
      badge({ phase: 'out', ageMs: ANIM.badges.outMs * 2 }),
      0,
      linear,
      scratch(),
    );
    expect(gone.scale).toBe(0);
  });
});

describe('badgeCreature', () => {
  it('shows the shield as the brownie', () => {
    expect(badgeCreature('shield')).toBe('brownie');
    expect(badgeCreature('lemon')).toBe('lemon');
  });
});
