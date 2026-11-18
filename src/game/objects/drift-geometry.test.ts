import { describe, expect, it } from 'vitest';
import { TOWER_WEATHER } from '../../data/tower-weather';
import { WEATHER_LOOK } from '../../data/weather-look';
import {
  driftGrowStep,
  driftPictureIndex,
  driftShown,
  driftThickness,
  ledgeOf,
  type Ledge,
} from './drift-geometry';

const D = TOWER_WEATHER.drift;
const blank = (): Ledge => ({ width: 0, centerX: 0, span: 0 });

describe('ledgeOf', () => {
  it('finds the open top on each side of a narrower layer above', () => {
    // A 400 wide layer, 200 wide above it, 40 to the right of its centre.
    const left = ledgeOf(400, 200, 40, -1, blank());
    const right = ledgeOf(400, 200, 40, 1, blank());
    expect(left.width).toBe(140);
    expect(right.width).toBe(60);
    // Centre of the drift on the ledge, inset 4 px from the corner and the seam.
    expect(left.centerX).toBeCloseTo((-200 + -60) / 2);
    expect(right.centerX).toBeCloseTo((200 + 140) / 2);
    expect(left.span).toBe(140 - 2 * D.insetPx);
  });

  it('gives no ledge where the layer above reaches or overhangs the edge', () => {
    expect(ledgeOf(400, 400, 0, 1, blank()).width).toBe(0);
    expect(ledgeOf(400, 500, 0, -1, blank()).width).toBe(0);
    expect(ledgeOf(400, 300, 100, 1, blank()).width).toBe(0);
  });

  it('gives none on a ledge narrower than the minimum', () => {
    const narrow = D.minLedgePx - 1;
    expect(ledgeOf(400, 400 - 2 * narrow, 0, 1, blank()).width).toBe(0);
    expect(ledgeOf(400, 400 - 2 * D.minLedgePx, 0, 1, blank()).width).toBe(D.minLedgePx);
  });
});

describe('drift size', () => {
  it('thickens with the width, but never past a share of the cap', () => {
    const most = D.maxShareOfCap * WEATHER_LOOK.cap.radius;
    expect(driftThickness(10)).toBe(D.minThicknessPx);
    expect(driftThickness(60)).toBeGreaterThan(driftThickness(40));
    expect(driftThickness(5000)).toBe(most);
    expect(driftThickness(5000)).toBeLessThan(WEATHER_LOOK.cap.radius);
  });

  it('takes the nearest baked width', () => {
    expect(driftPictureIndex(1)).toBe(0);
    expect(driftPictureIndex(D.pictureWidths[2]!)).toBe(2);
    expect(driftPictureIndex(10_000)).toBe(D.pictureWidths.length - 1);
  });
});

describe('driftGrowStep', () => {
  it('builds up over the cap time and is full at once when asked', () => {
    let g = 0;
    for (let t = 0; t < WEATHER_LOOK.cap.growMs; t += 16) g = driftGrowStep(g, true, 16, false);
    expect(g).toBeGreaterThan(0.95);
    expect(driftGrowStep(0, true, 16, true)).toBe(1);
  });

  it('squashes away over the squash time when the ledge is covered', () => {
    let g = 1;
    let t = 0;
    while (g > 0) {
      g = driftGrowStep(g, false, 10, false);
      t += 10;
    }
    expect(t).toBeLessThanOrEqual(D.squashMs + 10);
    expect(t).toBeGreaterThanOrEqual(D.squashMs - 10);
    expect(driftShown(0)).toBe(0);
    expect(driftShown(1)).toBe(1);
  });
});
