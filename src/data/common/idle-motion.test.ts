import { describe, expect, it } from 'vitest';
import { ANIM } from './anim';
import { HINT_PULSE, IDLE_MOTION, MAX_IDLE_PERIOD_MS, TRAY_SHEEN } from './idle-motion';

describe('idle motion data', () => {
  for (const [name, spec] of Object.entries(IDLE_MOTION)) {
    it(`${name} moves and repeats within the still limit`, () => {
      expect(spec.periodMs).toBeGreaterThan(0);
      expect(spec.periodMs).toBeLessThanOrEqual(MAX_IDLE_PERIOD_MS);
      const amplitude = spec.scaleX + spec.scaleY + spec.angleDeg + spec.bobPx;
      expect(amplitude).toBeGreaterThan(0);
    });
  }

  it('keeps the other ambient loops within the still limit', () => {
    expect(HINT_PULSE.periodMs).toBeLessThanOrEqual(MAX_IDLE_PERIOD_MS);
    expect(ANIM.ui.breathePeriodMs).toBeLessThanOrEqual(MAX_IDLE_PERIOD_MS);
    expect(ANIM.wobbleBar.wavePeriodMs).toBeLessThanOrEqual(MAX_IDLE_PERIOD_MS);
  });

  it('keeps the HUD readable: amplitudes stay small', () => {
    for (const spec of Object.values(IDLE_MOTION)) {
      expect(spec.scaleX).toBeLessThanOrEqual(0.05);
      expect(spec.scaleY).toBeLessThanOrEqual(0.08);
      expect(spec.angleDeg).toBeLessThanOrEqual(4);
      expect(spec.bobPx).toBeLessThanOrEqual(4);
    }
  });

  it('lets the tray sheen finish before the next one starts', () => {
    expect(TRAY_SHEEN.durationMs).toBeLessThan(TRAY_SHEEN.everyMs);
  });
});
