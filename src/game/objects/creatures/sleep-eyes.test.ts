import { describe, expect, it } from 'vitest';
import { CREATURE_IDS } from '../../../data/creatures/creatures';
import { eyeArcPoints, sleepEyes } from './sleep-eyes';

describe('sleepEyes', () => {
  it('gives two eyes to a single face and four to the twins', () => {
    for (const id of CREATURE_IDS) {
      expect(sleepEyes(id, 360)).toHaveLength(id === 'twins' ? 4 : 2);
    }
  });

  it('keeps the eyes symmetric and inside a layer of this width', () => {
    for (const id of CREATURE_IDS) {
      const eyes = sleepEyes(id, 360);
      const xs = eyes.map((e) => e.x).sort((a, b) => a - b);
      expect(xs[0]).toBeCloseTo(-xs[xs.length - 1]!, 6);
      for (const eye of eyes) expect(Math.abs(eye.x) + eye.halfWidth).toBeLessThan(180);
    }
  });

  it('shrinks the pair of the twins against a single face', () => {
    const single = sleepEyes('honey', 360)[0]!;
    const twin = sleepEyes('twins', 360)[0]!;
    expect(twin.halfWidth).toBeLessThan(single.halfWidth);
  });
});

describe('eyeArcPoints', () => {
  it('runs left to right and bows down', () => {
    const eye = { x: 10, y: 5, halfWidth: 20, depth: 11, thick: 7 };
    const points = eyeArcPoints(eye, 12);
    expect(points).toHaveLength(13);
    expect(points[0]![0]).toBeCloseTo(-10);
    expect(points[12]![0]).toBeCloseTo(30);
    expect(points[6]![1]).toBeCloseTo(16);
    expect(points[0]![1]).toBeCloseTo(5);
  });
});
