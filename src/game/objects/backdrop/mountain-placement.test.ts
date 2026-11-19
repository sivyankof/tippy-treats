import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../data/tower/balance';
import {
  MOUNTAIN_FREE_BAND,
  MOUNTAIN_LOOK,
  MOUNTAIN_MOTION,
  MOUNTAIN_SPAN,
} from '../../../data/backdrop/backdrop-mountains';
import { mountainRise, towerLayersAt } from './mountain-placement';

describe('mountain placement', () => {
  it('is hidden outside the span', () => {
    expect(mountainRise(0)).toBe(0);
    expect(mountainRise(MOUNTAIN_SPAN.riseFrom)).toBe(0);
    expect(mountainRise(MOUNTAIN_SPAN.sinkTo)).toBe(0);
    expect(mountainRise(100)).toBe(0);
  });

  it('stands fully up between the rise and the sink', () => {
    expect(mountainRise(MOUNTAIN_SPAN.riseTo)).toBe(1);
    expect(mountainRise(60)).toBe(1);
    expect(mountainRise(MOUNTAIN_SPAN.sinkFrom)).toBe(1);
  });

  it('rises and sinks smoothly and monotonically', () => {
    let prev = 0;
    for (let l = MOUNTAIN_SPAN.riseFrom; l <= MOUNTAIN_SPAN.riseTo; l += 0.25) {
      const r = mountainRise(l);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    prev = 1;
    for (let l = MOUNTAIN_SPAN.sinkFrom; l <= MOUNTAIN_SPAN.sinkTo; l += 0.25) {
      const r = mountainRise(l);
      expect(r).toBeLessThanOrEqual(prev);
      prev = r;
    }
  });

  it('shows the peaks at layers 55 and 65 and not in the kitchen or in space', () => {
    expect(mountainRise(55)).toBe(1);
    expect(mountainRise(65)).toBeGreaterThan(0.8);
    expect(mountainRise(10)).toBe(0);
    expect(mountainRise(90)).toBe(0);
  });

  it('reads the height in layers from the camera scroll', () => {
    const tray = 1000;
    const surface = 300;
    expect(towerLayersAt(tray - surface, tray, surface)).toBe(0);
    expect(towerLayersAt(tray - surface - 55 * BALANCE.layer.height, tray, surface)).toBeCloseTo(
      55,
    );
    expect(towerLayersAt(tray, tray, surface)).toBe(0);
  });

  it('keeps the middle of the screen behind the tower free of peaks', () => {
    const L = MOUNTAIN_LOOK;
    const screen = { w: 390, h: 844 };
    const scale = Math.max(
      (MOUNTAIN_MOTION.heightShare * screen.h) / L.height,
      (screen.w + 2 * MOUNTAIN_MOTION.swayPx) / L.width,
    );
    const bandHalf = (MOUNTAIN_FREE_BAND * screen.w) / 2 / scale + MOUNTAIN_MOTION.swayPx / scale;
    const mid = L.width / 2;
    for (const p of L.peaks) {
      const share = p.back ? L.capShareBack : L.capShareFront;
      const capBase = p.top + (L.height - p.top) * share;
      const widthAt = (y: number) => (p.half * (y - p.top)) / (L.height + L.overshoot - p.top);
      // The apex and the snow cap stay outside the band.
      expect(Math.abs(p.x - mid)).toBeGreaterThan(bandHalf);
      expect(Math.abs(p.x - mid) - widthAt(capBase)).toBeGreaterThan(bandHalf);
      // The rock too, down to the middle of the visible picture height.
      const midY = (p.top + L.height) / 2;
      expect(Math.abs(p.x - mid) - widthAt(midY)).toBeGreaterThan(bandHalf);
    }
  });
});
