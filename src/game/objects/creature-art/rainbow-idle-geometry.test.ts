import { describe, expect, it } from 'vitest';
import { RAINBOW_LOOK } from '../../../data/rainbow-look';
import {
  glazeFloorAt,
  humpAt,
  rotatePoints,
  sparkleAt,
  waveProgress,
} from './rainbow-idle-geometry';

const { idle } = RAINBOW_LOOK;

describe('humpAt', () => {
  it('is 1 in the middle and 0 at and beyond the edge', () => {
    expect(humpAt(10, 10, 20)).toBe(1);
    expect(humpAt(30, 10, 20)).toBeCloseTo(0);
    expect(humpAt(100, 10, 20)).toBe(0);
  });
});

describe('waveProgress', () => {
  it('runs from 0 to 1 and each lower sponge starts later', () => {
    expect(waveProgress(0, 0)).toBe(0);
    expect(waveProgress(idle.travelMs / 2, 0)).toBeCloseTo(0.5);
    expect(waveProgress(0, 1)).toBeNull();
    expect(waveProgress(idle.staggerMs, 1)).toBe(0);
  });
  it('is quiet between waves', () => {
    expect(waveProgress(idle.waveEveryMs - 1, 0)).toBeNull();
  });
});

describe('sparkleAt', () => {
  it('flashes at the start of a period and rests after it', () => {
    expect(sparkleAt(idle.sparkleMs / 2, 0)).toBeCloseTo(1);
    expect(sparkleAt(idle.sparkleMs + 1, 0)).toBe(0);
  });
});

describe('rotatePoints', () => {
  it('turns a point a quarter around the centre', () => {
    const [p] = rotatePoints([{ x: 1, y: 0 }], 0, 0, Math.PI / 2);
    expect(p!.x).toBeCloseTo(0);
    expect(p!.y).toBeCloseTo(1);
  });
});

describe('glazeFloorAt', () => {
  const scallops = { edgeY: 10, x0: 0, x1: 100, radius: 10, step: 20 };
  it('is the glaze edge between scallops, deeper under a scallop and under a drip', () => {
    expect(glazeFloorAt(-5, scallops, [], 20, 0)).toBe(10);
    expect(glazeFloorAt(10, scallops, [], 20, 0)).toBeCloseTo(20);
    expect(glazeFloorAt(50, scallops, [{ x: 50, length: 30 }], 20, 0)).toBe(40);
    expect(glazeFloorAt(50, scallops, [{ x: 50, length: 30 }], 20, 2)).toBe(42);
  });
});
