import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { RULE_ANIM } from '../../data/rule-anim';
import { shadowLook } from './shadow-emphasis';

const cfg = RULE_ANIM.cloud.shadow;

describe('shadowLook', () => {
  it('is the normal shadow without a cloud', () => {
    const look = shadowLook(0, 123, false);
    expect(look.fillAlpha).toBeCloseTo(ANIM.flying.hintShadowAlpha);
    expect(look.outlineAlpha).toBe(0);
  });

  it('grows monotonically with the density', () => {
    let last = 0;
    for (let i = 0; i <= 20; i++) {
      const look = shadowLook(i / 20, 0, false);
      expect(look.fillAlpha).toBeGreaterThanOrEqual(last - 1e-9);
      last = look.fillAlpha;
    }
    expect(shadowLook(1, 0, true).fillAlpha).toBeCloseTo(cfg.shadowAlpha);
  });

  it('keeps only the stronger fill in fewer effects', () => {
    const a = shadowLook(1, 0, true);
    const b = shadowLook(1, cfg.pulsePeriodMs / 2, true);
    expect(a.outlineAlpha).toBe(0);
    expect(a.fillAlpha).toBe(b.fillAlpha);
    expect(a.fillAlpha).toBeCloseTo(cfg.shadowAlpha);
  });
});
