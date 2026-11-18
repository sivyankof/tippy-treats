import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { crackle, tapeHiss } from './tape';

function random(seed: number): () => number {
  const rng = new Rng(seed);
  return () => rng.next();
}

describe('tape hiss', () => {
  const rate = 44_100;
  const frames = rate;
  const fade = 2205;
  const hiss = tapeHiss(frames, rate, random(3), 3200, fade);

  it('has no DC, peaks at 1 and is not silent', () => {
    let sum = 0;
    let peak = 0;
    let energy = 0;
    for (const v of hiss) {
      sum += v;
      energy += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    expect(Math.abs(sum / frames)).toBeLessThan(1e-6);
    expect(peak).toBeCloseTo(1, 6);
    expect(Math.sqrt(energy / frames)).toBeGreaterThan(0.1);
  });

  it('loops without a step: the jump from the end to the start is an ordinary one', () => {
    let usual = 0;
    for (let i = 1; i < frames; i++)
      usual = Math.max(usual, Math.abs((hiss[i] ?? 0) - (hiss[i - 1] ?? 0)));
    const seam = Math.abs((hiss[0] ?? 0) - (hiss[frames - 1] ?? 0));
    expect(seam).toBeLessThanOrEqual(usual);
  });

  it('is the same for the same seed', () => {
    expect(tapeHiss(1000, rate, random(3), 3200, 50)).toEqual(
      tapeHiss(1000, rate, random(3), 3200, 50),
    );
  });
});

describe('crackle', () => {
  it('is a short click: peak 1, ends at zero, no DC to speak of', () => {
    const click = crackle(176, random(9));
    let sum = 0;
    let peak = 0;
    for (const v of click) {
      sum += v;
      peak = Math.max(peak, Math.abs(v));
    }
    expect(peak).toBeCloseTo(1, 6);
    expect(click[click.length - 1]).toBe(0);
    expect(Math.abs(sum)).toBeLessThan(0.5);
  });
});
