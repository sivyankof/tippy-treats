import { describe, expect, it } from 'vitest';
import { LICK } from '../../data/lick';
import { newRibbon, sampleRibbon } from './tongue-ribbon';

const N = LICK.tongue.segments;

function chain(at: (i: number) => [number, number]): number[] {
  const points: number[] = [];
  for (let i = 0; i <= N; i++) points.push(...at(i));
  return points;
}

describe('sampleRibbon', () => {
  it('samples every piece and passes through the points', () => {
    const r = newRibbon();
    const points = chain((i) => [i * 10, 0]);
    expect(sampleRibbon(points, () => 20, r)).toBe(true);
    expect(r.count).toBe(N * LICK.tongue.draw.sub + 1);
    expect(r.x[0]).toBeCloseTo(0);
    expect(r.x[r.count - 1]).toBeCloseTo(N * 10);
    expect(r.half[5]).toBe(10);
    expect(r.tx[3]).toBeCloseTo(1);
    expect(r.ty[3]).toBeCloseTo(0);
  });

  it('turns smoothly along a bend: neighbouring directions differ little', () => {
    const r = newRibbon();
    const points = chain((i) => [Math.sin(i / 3) * 60, -Math.cos(i / 3) * 60]);
    sampleRibbon(points, () => 20, r);
    for (let j = 1; j < r.count; j++) {
      const dot = r.tx[j]! * r.tx[j - 1]! + r.ty[j]! * r.ty[j - 1]!;
      expect(dot).toBeGreaterThan(0.97);
    }
  });

  it('reports a body without length', () => {
    const r = newRibbon();
    expect(
      sampleRibbon(
        chain(() => [5, 5]),
        () => 20,
        r,
      ),
    ).toBe(false);
  });
});
