import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import {
  coneBurst,
  confettiRain,
  edgeBurst,
  lineBurst,
  stepParticle,
  viewParticle,
  type ParticleState,
  type ParticleStyle,
} from './particle-motion';

const style: ParticleStyle = {
  speed: [100, 100],
  gravity: 0,
  drag: 0,
  spin: [0, 0],
  scale: [1, 1],
  scaleTo: 2,
  alpha: 0.8,
  holdShare: 0.5,
  lifeMs: [1000, 1000],
  spreadDeg: 0,
  tiltDeg: 0,
};

const half = () => 0.5;

function particle(extra: Partial<ParticleState> = {}): ParticleState {
  return { ...coneBurst(0, 0, 0, 1, style, half)[0]!, ...extra };
}

describe('stepParticle', () => {
  it('moves at the start velocity without forces', () => {
    const p = particle();
    stepParticle(p, 500);
    expect(p.x).toBeCloseTo(50, 8);
    expect(p.y).toBeCloseTo(0, 8);
  });

  it('accelerates down with gravity', () => {
    const p = particle({ vx: 0, vy: 0, gravity: 1000 });
    stepParticle(p, 100);
    expect(p.vy).toBeCloseTo(100, 8);
    expect(p.y).toBeGreaterThan(0);
  });

  it('slows down with drag and never reverses', () => {
    const p = particle({ drag: 5 });
    stepParticle(p, 1000);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vx).toBeLessThan(100);
  });

  it('rotates by the spin', () => {
    const p = particle({ spin: 90, angle: 10 });
    stepParticle(p, 1000);
    expect(p.angle).toBeCloseTo(100, 8);
  });
});

describe('viewParticle', () => {
  it('interpolates the scale over the life', () => {
    const p = particle();
    expect(viewParticle(p, 0).scale).toBeCloseTo(1, 8);
    expect(viewParticle(p, 500).scale).toBeCloseTo(1.5, 8);
    expect(viewParticle(p, 1000).scale).toBeCloseTo(2, 8);
  });

  it('holds the alpha, then fades to zero', () => {
    const p = particle();
    expect(viewParticle(p, 400).alpha).toBeCloseTo(0.8, 8);
    expect(viewParticle(p, 750).alpha).toBeCloseTo(0.4, 8);
    expect(viewParticle(p, 1000).alpha).toBeCloseTo(0, 8);
  });

  it('keeps the alpha when the hold share is the whole life', () => {
    expect(viewParticle(particle({ holdShare: 1 }), 900).alpha).toBeCloseTo(0.8, 8);
  });

  it('sways around the base x', () => {
    const p = particle({ swayAmplitude: 10, swayPeriodMs: 400, swayPhase: 0 });
    expect(viewParticle(p, 0).x).toBeCloseTo(0, 8);
    expect(viewParticle(p, 100).x).toBeCloseTo(10, 8);
  });
});

describe('bursts', () => {
  it('makes the requested number of cone particles flying in the direction', () => {
    const list = coneBurst(5, 6, 90, 4, style, half);
    expect(list).toHaveLength(4);
    expect(list[0]!.x).toBe(5);
    expect(list[0]!.y).toBe(6);
    expect(list[0]!.vx).toBeCloseTo(0, 8);
    expect(list[0]!.vy).toBeCloseTo(100, 8);
  });

  it('spreads the directions inside the cone', () => {
    const wide = { ...style, spreadDeg: 60 };
    const low = coneBurst(0, 0, 0, 1, wide, () => 0)[0]!;
    const high = coneBurst(0, 0, 0, 1, wide, () => 1)[0]!;
    expect(Math.atan2(low.vy, low.vx)).toBeCloseTo((-30 * Math.PI) / 180, 6);
    expect(Math.atan2(high.vy, high.vx)).toBeCloseTo((30 * Math.PI) / 180, 6);
  });

  it('starts edge particles under the edges and sends them outwards and up', () => {
    const list = edgeBurst(100, 50, 80, 6, { ...style, tiltDeg: 20 }, half);
    expect(list).toHaveLength(6);
    const left = list.filter((p) => p.x === 60);
    const right = list.filter((p) => p.x === 140);
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
    expect(left.every((p) => p.vx < 0 && p.vy < 0)).toBe(true);
    expect(right.every((p) => p.vx > 0 && p.vy < 0)).toBe(true);
  });

  it('keeps the total of an odd edge burst', () => {
    expect(edgeBurst(0, 0, 10, 7, style, half)).toHaveLength(7);
  });

  it('spreads line particles along the cut and sends them to the side', () => {
    const left = lineBurst(10, 100, 120, -1, 3, style, () => 0);
    expect(left[0]!.y).toBeCloseTo(40, 8);
    expect(left.every((p) => p.x === 10 && p.vx < 0)).toBe(true);
    const right = lineBurst(10, 100, 120, 1, 3, style, () => 1);
    expect(right[0]!.y).toBeCloseTo(160, 8);
    expect(right.every((p) => p.vx > 0)).toBe(true);
  });

  it('rains confetti from above the top edge across the width', () => {
    const list = confettiRain(400, 800, 0.5, 10, ANIM.record.confetti.style, () => 0.5);
    expect(list).toHaveLength(10);
    for (const p of list) {
      expect(p.x).toBeCloseTo(200, 8);
      expect(p.y).toBeCloseTo(-200, 8);
      expect(p.vy).toBeGreaterThan(0);
      expect(p.swayAmplitude).toBeGreaterThan(0);
    }
  });

  it('aligns long shapes with the flight direction', () => {
    const p = coneBurst(0, 0, 0, 1, { ...style, alignToDirection: true }, half)[0]!;
    expect(p.angle).toBeCloseTo(90, 8);
  });

  it('keeps every preset inside the sane bounds', () => {
    const presets = [
      ANIM.dust.style,
      ANIM.bite.crumbStyle,
      ANIM.sneeze.crumbStyle,
      ANIM.perfect.sparkStyle,
      ANIM.record.confetti.style,
    ];
    for (const preset of presets) {
      expect(preset.holdShare).toBeGreaterThanOrEqual(0);
      expect(preset.holdShare).toBeLessThanOrEqual(1);
      expect(preset.alpha).toBeGreaterThan(0);
    }
  });
});
