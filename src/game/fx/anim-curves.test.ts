import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import {
  bump,
  collapseDelayMs,
  collapseDurationMs,
  comboTextScale,
  driftMotion,
  stepSpring,
  waveSquash,
  type SpringState,
} from './anim-curves';

describe('waveSquash', () => {
  it('starts at the landing squash scaled by the falloff', () => {
    const first = waveSquash(1);
    const s = ANIM.wave.falloff;
    expect(first.scaleX).toBeCloseTo(1 + (ANIM.land.scaleX - 1) * s, 10);
    expect(first.scaleY).toBeCloseTo(1 - (1 - ANIM.land.scaleY) * s, 10);
    expect(first.delayMs).toBe(ANIM.wave.delayMs);
  });

  it('weakens and delays further down', () => {
    let prev = waveSquash(1);
    for (let k = 2; k <= ANIM.wave.layers; k++) {
      const next = waveSquash(k);
      expect(next.scaleX).toBeLessThan(prev.scaleX);
      expect(next.scaleX).toBeGreaterThan(1);
      expect(next.scaleY).toBeGreaterThan(prev.scaleY);
      expect(next.scaleY).toBeLessThan(1);
      expect(next.delayMs).toBeGreaterThan(prev.delayMs);
      prev = next;
    }
  });

  it('has the full landing squash and no delay at k = 0', () => {
    const zero = waveSquash(0);
    expect(zero.scaleX).toBeCloseTo(ANIM.land.scaleX, 10);
    expect(zero.scaleY).toBeCloseTo(ANIM.land.scaleY, 10);
    expect(zero.delayMs).toBe(0);
  });
});

describe('collapseDurationMs', () => {
  const [minMs, maxMs] = ANIM.collapse.durationMs;
  const [minH, maxH] = ANIM.collapse.heightRange;

  it('is clamped to the configured bounds', () => {
    expect(collapseDurationMs(0)).toBe(minMs);
    expect(collapseDurationMs(minH)).toBe(minMs);
    expect(collapseDurationMs(maxH)).toBe(maxMs);
    expect(collapseDurationMs(maxH * 10)).toBe(maxMs);
  });

  it('grows with the height', () => {
    const mid = collapseDurationMs((minH + maxH) / 2);
    expect(mid).toBeCloseTo((minMs + maxMs) / 2, 10);
    let prev = collapseDurationMs(minH);
    for (let h = minH + 1; h <= maxH; h += 9) {
      const next = collapseDurationMs(h);
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });
});

describe('collapseDelayMs', () => {
  it('starts at the top and ends at the bottom', () => {
    expect(collapseDelayMs(9, 10, 1000)).toBe(0);
    expect(collapseDelayMs(0, 10, 1000)).toBe(900);
  });

  it('decreases with the index and stays below the duration', () => {
    let prev = Infinity;
    for (let i = 0; i < 20; i++) {
      const delay = collapseDelayMs(i, 20, 1500);
      expect(delay).toBeLessThan(prev);
      expect(delay).toBeLessThan(1500);
      prev = delay;
    }
  });

  it('handles tiny towers and out-of-range indices', () => {
    expect(collapseDelayMs(0, 1, 1200)).toBe(0);
    expect(collapseDelayMs(0, 0, 1200)).toBe(0);
    expect(collapseDelayMs(-5, 4, 1200)).toBe(900);
    expect(collapseDelayMs(99, 4, 1200)).toBe(0);
  });
});

describe('stepSpring', () => {
  const frame = 1000 / 60;

  function settle(target: number, deltaMs: number, steps: number): SpringState {
    return settleTrail(target, deltaMs, steps).final;
  }

  function settleTrail(
    target: number,
    deltaMs: number,
    steps: number,
  ): { trail: SpringState[]; final: SpringState } {
    const state: SpringState = { value: 0, velocity: 0 };
    const trail: SpringState[] = [];
    for (let i = 0; i < steps; i++) {
      stepSpring(state, target, ANIM.wobbleBar.fillStiffness, ANIM.wobbleBar.fillDamping, deltaMs);
      trail.push({ ...state });
    }
    return { trail, final: { ...state } };
  }

  it('overshoots the target and then settles on it', () => {
    const { trail, final } = settleTrail(1, frame, 200);
    expect(Math.max(...trail.map((s) => s.value))).toBeGreaterThan(1);
    expect(final.value).toBeCloseTo(1, 4);
    expect(Math.abs(final.velocity)).toBeLessThan(1e-4);
  });

  it('does not depend on the frame rate', () => {
    const fast = settle(1, frame, 20);
    const slow = settle(1, frame * 2, 10);
    expect(slow.value).toBeCloseTo(fast.value, 1);
  });

  it('ignores zero and negative deltas and caps huge ones', () => {
    const state: SpringState = { value: 0, velocity: 0 };
    stepSpring(state, 1, 0.18, 0.72, 0);
    stepSpring(state, 1, 0.18, 0.72, -50);
    expect(state).toEqual({ value: 0, velocity: 0 });
    stepSpring(state, 1, 0.18, 0.72, 1e9);
    expect(Number.isFinite(state.value)).toBe(true);
    const capped: SpringState = { value: 0, velocity: 0 };
    stepSpring(capped, 1, 0.18, 0.72, ANIM.fx.maxSimMs);
    expect(state).toEqual(capped);
  });
});

describe('bump', () => {
  it('is zero at both ends and one in the middle', () => {
    expect(bump(0)).toBeCloseTo(0, 10);
    expect(bump(0.5)).toBeCloseTo(1, 10);
    expect(bump(1)).toBeCloseTo(0, 10);
    expect(bump(0.25)).toBeCloseTo(bump(0.75), 10);
  });
});

describe('driftMotion', () => {
  const style = { spinDegPerSec: 40, gravity: 2400, lifeMs: 900, driftSpeed: 60 };

  it('drifts to the given side without a vertical push', () => {
    expect(driftMotion(style, 1, () => 0).vx).toBe(60);
    expect(driftMotion(style, -1, () => 0).vx).toBe(-60);
    expect(driftMotion(style, 1, () => 0).vy).toBe(0);
  });

  it('picks the spin sense from the random source', () => {
    expect(driftMotion(style, 1, () => 0.2).spin).toBe(-40);
    expect(driftMotion(style, 1, () => 0.7).spin).toBe(40);
  });

  it('copies gravity and life from the style', () => {
    const motion = driftMotion(style, 1, () => 0.7);
    expect(motion.gravity).toBe(2400);
    expect(motion.lifeMs).toBe(900);
  });

  it('matches the shape of the bite and miss styles', () => {
    expect(driftMotion(ANIM.bite, 1, () => 0.7).lifeMs).toBe(ANIM.bite.lifeMs);
    expect(driftMotion(ANIM.miss, -1, () => 0.7).vx).toBe(-ANIM.miss.driftSpeed);
  });
});

describe('comboTextScale', () => {
  it('is 1 at combo 1 and below', () => {
    expect(comboTextScale(1)).toBe(1);
    expect(comboTextScale(0)).toBe(1);
  });

  it('grows by one step per combo', () => {
    expect(comboTextScale(3)).toBeCloseTo(1 + 2 * ANIM.perfect.text.comboScaleStep, 10);
  });

  it('never exceeds the cap', () => {
    expect(comboTextScale(1000)).toBe(ANIM.perfect.text.maxScale);
  });
});
