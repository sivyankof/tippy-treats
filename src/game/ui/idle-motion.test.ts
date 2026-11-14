import { describe, expect, it } from 'vitest';
import { IDLE_MOTION, MAX_IDLE_PERIOD_MS } from '../../data/idle-motion';
import { applyIdlePose, idlePose } from './idle-motion';

describe('idlePose', () => {
  const spec = IDLE_MOTION.hudNumber;

  it('repeats after one period', () => {
    const a = idlePose(spec, 300, 0.7);
    const b = idlePose(spec, 300 + spec.periodMs, 0.7);
    expect(b.scaleX).toBeCloseTo(a.scaleX, 9);
    expect(b.scaleY).toBeCloseTo(a.scaleY, 9);
    expect(b.angle).toBeCloseTo(a.angle, 9);
  });

  it('stays within the amplitudes around rest', () => {
    for (let t = 0; t < 4000; t += 37) {
      const pose = idlePose(IDLE_MOTION.badge, t, 1.1);
      expect(Math.abs(pose.scaleX - 1)).toBeLessThanOrEqual(IDLE_MOTION.badge.scaleX + 1e-9);
      expect(Math.abs(pose.angle)).toBeLessThanOrEqual(IDLE_MOTION.badge.angleDeg + 1e-9);
      expect(Math.abs(pose.bob)).toBeLessThanOrEqual(IDLE_MOTION.badge.bobPx + 1e-9);
    }
  });

  it('offsets objects by their phase', () => {
    const a = idlePose(spec, 500, 0);
    const b = idlePose(spec, 500, 2.1);
    expect(a.scaleX).not.toBeCloseTo(b.scaleX, 4);
  });

  it('keeps changing: no window of two seconds shows a constant pose', () => {
    for (const [name, s] of Object.entries(IDLE_MOTION)) {
      let min = Infinity;
      let max = -Infinity;
      for (let t = 0; t <= MAX_IDLE_PERIOD_MS; t += 20) {
        const pose = idlePose(s, 12345 + t, 1);
        const v = pose.scaleX + pose.scaleY + pose.angle + pose.bob;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      expect(max - min, name).toBeGreaterThan(1e-3);
    }
  });

  it('reuses the given object', () => {
    const out = { scaleX: 0, scaleY: 0, angle: 0, bob: 0 };
    expect(idlePose(spec, 100, 0, out)).toBe(out);
  });

  it('applies scale and tilt to a target', () => {
    const calls: number[] = [];
    applyIdlePose(
      {
        setScale: (x, y) => calls.push(x, y),
        setAngle: (a) => calls.push(a),
      },
      { scaleX: 1.1, scaleY: 0.9, angle: 2, bob: 3 },
    );
    expect(calls).toEqual([1.1, 0.9, 2]);
  });
});
