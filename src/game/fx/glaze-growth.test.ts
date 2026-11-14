import { describe, expect, it } from 'vitest';
import { faceRecipe } from '../../data/creature-looks';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import {
  DropLimiter,
  dripDurationMs,
  dropChance,
  faceExclusion,
  faceHalfSpan,
  growsDrips,
  growthProgress,
  growthStyle,
  maxExtension,
  standsAside,
} from './glaze-growth';

describe('which layers grow drips', () => {
  it('lets plain layers and soft creatures grow, not the hard ones', () => {
    expect(growsDrips(null)).toBe(true);
    expect(growsDrips('honey')).toBe(true);
    for (const hard of ['caramel', 'frosty', 'crumb', 'brownie'] as const) {
      expect(growsDrips(hard)).toBe(false);
    }
  });

  it('gives honey longer and faster drips', () => {
    expect(growthStyle('honey').lengthMul).toBeGreaterThan(growthStyle(null).lengthMul);
    expect(growthStyle('honey').durationMul).toBeLessThan(growthStyle(null).durationMul);
  });
});

describe('growth time and progress', () => {
  it('keeps every drip inside the growth range and is stable', () => {
    const [min, max] = GLAZE_DRIPS.growMs;
    for (let layer = 0; layer < 30; layer++) {
      for (let drip = 0; drip < 5; drip++) {
        const ms = dripDurationMs(layer, drip);
        expect(ms).toBeGreaterThanOrEqual(min);
        expect(ms).toBeLessThanOrEqual(max);
        expect(dripDurationMs(layer, drip)).toBe(ms);
      }
    }
  });

  it('does not start before the delay, rises and sets at 1', () => {
    const d = 12000;
    expect(growthProgress(0, d)).toBe(0);
    expect(growthProgress(GLAZE_DRIPS.startDelayMs, d)).toBe(0);
    let last = 0;
    for (let t = 0; t <= d + GLAZE_DRIPS.startDelayMs; t += 500) {
      const p = growthProgress(t, d);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(growthProgress(GLAZE_DRIPS.startDelayMs + d, d)).toBe(1);
    expect(growthProgress(1e9, d)).toBe(1);
    expect(growthProgress(-5, d)).toBe(0);
  });
});

describe('maximum extension', () => {
  it('is a share of the layer height', () => {
    expect(maxExtension(120, -20, 1)).toBeCloseTo(120 * GLAZE_DRIPS.maxLengthShare);
  });

  it('is longer with a multiplier but never runs past the overlap below the layer', () => {
    const tipY = 23;
    const ext = maxExtension(120, tipY, 1.6);
    expect(tipY + ext).toBeLessThanOrEqual(60 + GLAZE_DRIPS.overlapPx + 1e-9);
    expect(ext).toBeGreaterThan(maxExtension(120, tipY, 1));
  });

  it('is zero for a tip already past the limit', () => {
    expect(maxExtension(120, 200, 1)).toBe(0);
  });
});

describe('face exclusion', () => {
  it('is wider for a pair of faces and scales down on a narrow layer', () => {
    const single = faceHalfSpan(400, null);
    expect(single).toBe(GLAZE_DRIPS.faceHalfWidth);
    expect(faceHalfSpan(100, null)).toBeLessThan(single);
    const twins = faceRecipe('twins');
    expect(faceHalfSpan(400, twins)).toBeGreaterThan(0);
  });

  it('shifts with the centre of the layer below', () => {
    const ex = faceExclusion(30, 400, null);
    expect(ex.from).toBeCloseTo(30 - GLAZE_DRIPS.faceHalfWidth);
    expect(ex.to).toBeCloseTo(30 + GLAZE_DRIPS.faceHalfWidth);
  });

  it('lets only drips outside the face and its margin grow', () => {
    const ex = faceExclusion(0, 400, null);
    expect(standsAside(0, ex, 11)).toBe(false);
    expect(standsAside(ex.to + 5, ex, 11)).toBe(false);
    expect(standsAside(ex.to + GLAZE_DRIPS.faceMarginPx + 12, ex, 11)).toBe(true);
    expect(standsAside(ex.from - GLAZE_DRIPS.faceMarginPx - 12, ex, 11)).toBe(true);
    expect(standsAside(0, null, 11)).toBe(true);
  });
});

describe('drops', () => {
  it('keeps drops apart for the whole tower', () => {
    const limiter = new DropLimiter(4000);
    expect(limiter.ready(0)).toBe(true);
    limiter.mark(1000);
    expect(limiter.ready(4999)).toBe(false);
    expect(limiter.ready(5000)).toBe(true);
    limiter.reset();
    expect(limiter.ready(1001)).toBe(true);
  });

  it('has a chance that rises with time and stays below 1', () => {
    expect(dropChance(0, 2500)).toBe(0);
    expect(dropChance(16, 2500)).toBeLessThan(dropChance(1600, 2500));
    expect(dropChance(1e9, 2500)).toBeLessThanOrEqual(1);
  });
});
