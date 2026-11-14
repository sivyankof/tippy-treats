import { describe, expect, it } from 'vitest';
import { faceRecipe } from '../../data/creature-looks';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import {
  belowSpan,
  DropLimiter,
  dripCountFor,
  dripDurationMs,
  dripEndY,
  dripReachShares,
  dropChance,
  faceClearance,
  fallTimeMs,
  faceHalfSpan,
  growsDrips,
  growthProgress,
  growthStyle,
  runsOntoBelow,
  thaws,
  type BelowSpan,
} from './glaze-growth';

const span = (): BelowSpan => ({ left: 0, right: 0, faceFrom: 0, faceTo: 0 });

describe('which layers grow drips', () => {
  it('lets plain layers, honey and caramel grow drips; frosty thaws; crumb and brownie stay dry', () => {
    expect(growsDrips(null)).toBe(true);
    expect(growsDrips('honey')).toBe(true);
    expect(growsDrips('caramel')).toBe(true);
    expect(growsDrips('frosty')).toBe(false);
    expect(thaws('frosty')).toBe(true);
    expect(thaws('caramel')).toBe(false);
    for (const dry of ['crumb', 'brownie'] as const) {
      expect(growsDrips(dry)).toBe(false);
      expect(thaws(dry)).toBe(false);
    }
  });

  it('makes caramel slow, thick and stretchy, with rare drops', () => {
    const caramel = growthStyle('caramel');
    expect(caramel.durationMul).toBe(2);
    expect(caramel.widthMul).toBeGreaterThan(1);
    expect(caramel.lengthMul).toBe(1);
    expect(caramel.dropWeight).toBeLessThan(growthStyle(null).dropWeight);
  });

  it('gives honey longer, thicker and faster drips', () => {
    expect(growthStyle('honey').lengthMul).toBeGreaterThan(growthStyle(null).lengthMul);
    expect(growthStyle('honey').widthMul).toBeGreaterThan(growthStyle(null).widthMul);
    expect(growthStyle('honey').durationMul).toBeLessThan(growthStyle(null).durationMul);
  });

  it('grows 3 to 5 drips, more on a wider layer', () => {
    expect(dripCountFor(200)).toBe(GLAZE_DRIPS.count[0]);
    expect(dripCountFor(720)).toBe(GLAZE_DRIPS.count[1]);
    expect(dripCountFor(600)).toBeGreaterThan(dripCountFor(400));
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

  it('shows growth within the first seconds and sets within 8 to 12 s', () => {
    const [min, max] = GLAZE_DRIPS.growMs;
    expect(min).toBeGreaterThanOrEqual(8000);
    expect(max).toBeLessThanOrEqual(12000);
    expect(growthProgress(3000, max)).toBeGreaterThan(0.35);
    expect(growthProgress(GLAZE_DRIPS.startDelayMs + min, min)).toBe(1);
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

describe('drip length', () => {
  it('makes one drip of a layer the longest and the others shorter, each its own', () => {
    for (let layer = 0; layer < 20; layer++) {
      const shares = dripReachShares(layer, 5);
      expect(shares.filter((s) => s === 1)).toHaveLength(1);
      for (const s of shares) expect(s).toBeGreaterThanOrEqual(GLAZE_DRIPS.lengthShare[0]);
    }
    expect(dripReachShares(3, 4)).not.toEqual(dripReachShares(4, 4));
  });

  it('runs the longest drip onto the layer below, honey farther', () => {
    const tipY = -2;
    expect(dripEndY(120, tipY, 1, 1, false)).toBeCloseTo(60 + GLAZE_DRIPS.overlapPx);
    expect(dripEndY(120, tipY, 1, 1.6, false)).toBeGreaterThan(dripEndY(120, tipY, 1, 1, false));
    expect(dripEndY(120, tipY, 0, 1, false)).toBeCloseTo(tipY + GLAZE_DRIPS.minLengthPx);
  });

  it('stops a blocked drip above its own lower edge', () => {
    expect(dripEndY(120, -2, 1, 1.6, true)).toBe(60 - GLAZE_DRIPS.edgeStopPx);
    expect(dripEndY(120, 70, 1, 1, true)).toBe(70);
  });
});

describe('faces', () => {
  it('is wider for a pair of faces and scales down on a narrow layer', () => {
    const single = faceHalfSpan(400, null);
    expect(single).toBe(GLAZE_DRIPS.faceHalfWidth);
    expect(faceHalfSpan(100, null)).toBeLessThan(single);
    const twins = faceRecipe('twins');
    expect(faceHalfSpan(400, twins)).toBeGreaterThan(0);
  });

  it('keeps the drips of a layer off its own face', () => {
    expect(faceClearance(400, null, 10)).toBe(
      GLAZE_DRIPS.faceHalfWidth + GLAZE_DRIPS.faceMarginPx + 10,
    );
  });

  it('shifts the layer below with its centre', () => {
    const below = belowSpan(30, 400, null, span());
    expect(below.faceFrom).toBeCloseTo(30 - GLAZE_DRIPS.faceHalfWidth);
    expect(below.faceTo).toBeCloseTo(30 + GLAZE_DRIPS.faceHalfWidth);
    expect(below.left).toBe(-170);
    expect(below.right).toBe(230);
  });

  it('lets a drip run onto the layer below only aside its face and over its body', () => {
    const below = belowSpan(0, 400, null, span());
    const margin = GLAZE_DRIPS.faceMarginPx;
    expect(runsOntoBelow(0, below, 11)).toBe(false);
    expect(runsOntoBelow(below.faceTo + 5, below, 11)).toBe(false);
    expect(runsOntoBelow(below.faceTo + margin + 12, below, 11)).toBe(true);
    expect(runsOntoBelow(below.faceFrom - margin - 12, below, 11)).toBe(true);
    expect(runsOntoBelow(195, below, 11)).toBe(false);
    expect(runsOntoBelow(100, null, 11)).toBe(false);
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

  it('speeds up as it falls: four times the distance takes twice the time', () => {
    expect(fallTimeMs(0)).toBe(0);
    expect(fallTimeMs(-5)).toBe(0);
    expect(fallTimeMs(80)).toBeGreaterThan(fallTimeMs(20));
    expect(fallTimeMs(80)).toBeCloseTo(fallTimeMs(20) * 2);
  });
});
