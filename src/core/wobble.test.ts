import { describe, expect, it } from 'vitest';
import {
  advanceWobblePhase,
  decayWobble,
  isSneezing,
  widthAfterSneeze,
  WOBBLE_AFTER_SNEEZE,
  wobbleAfterNormal,
  wobbleAfterPerfect,
  wobbleAmplitude,
  wobbleOffset,
} from './wobble';

describe('wobble growth', () => {
  it('grows in proportion to the offset relative to the width', () => {
    expect(wobbleAfterNormal(0, 100, 400)).toBeCloseTo(15);
    expect(wobbleAfterNormal(20, -200, 400)).toBeCloseTo(50);
    expect(wobbleAfterNormal(0, 400, 400)).toBeCloseTo(60);
  });

  it('never exceeds 100', () => {
    expect(wobbleAfterNormal(90, 300, 400)).toBe(100);
  });
});

describe('wobble relief', () => {
  it('drops by 15 on a perfect drop, not below zero', () => {
    expect(wobbleAfterPerfect(40)).toBe(25);
    expect(wobbleAfterPerfect(10)).toBe(0);
  });

  it('decays by 2 per second, not below zero', () => {
    expect(decayWobble(50, 1000)).toBeCloseTo(48);
    expect(decayWobble(50, 250)).toBeCloseTo(49.5);
    expect(decayWobble(1, 5000)).toBe(0);
  });
});

describe('sway', () => {
  it('has an amplitude of 90 × (wobble / 100)^1.5', () => {
    expect(wobbleAmplitude(0)).toBe(0);
    expect(wobbleAmplitude(100)).toBeCloseTo(90);
    expect(wobbleAmplitude(25)).toBeCloseTo(11.25);
    expect(wobbleAmplitude(150)).toBeCloseTo(90);
  });

  it('follows a sine with a 2.4 s period', () => {
    const quarter = advanceWobblePhase(0, 600);
    expect(quarter).toBeCloseTo(Math.PI / 2);
    expect(wobbleOffset(100, quarter, 0)).toBeCloseTo(90);
    expect(wobbleOffset(100, advanceWobblePhase(quarter, 1200), 0)).toBeCloseTo(-90);
    expect(advanceWobblePhase(0, 2400)).toBeCloseTo(0);
  });

  it('fades with depth and vanishes ten layers down', () => {
    const phase = Math.PI / 2;
    expect(wobbleOffset(100, phase, 0)).toBeCloseTo(90);
    expect(wobbleOffset(100, phase, 5)).toBeCloseTo(22.5);
    expect(wobbleOffset(100, phase, 9)).toBeCloseTo(0.9);
    expect(wobbleOffset(100, phase, 10)).toBe(0);
    expect(wobbleOffset(100, phase, 25)).toBe(0);
  });
});

describe('sneeze', () => {
  it('triggers at 100', () => {
    expect(isSneezing(99.9)).toBe(false);
    expect(isSneezing(100)).toBe(true);
  });

  it('takes 15% of the width and resets wobble to 50', () => {
    expect(widthAfterSneeze(400)).toBeCloseTo(340);
    expect(WOBBLE_AFTER_SNEEZE).toBe(50);
  });
});
