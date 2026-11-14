import { describe, expect, it } from 'vitest';
import { BACKDROP } from '../../../data/backdrop';
import { ZoneFade } from './zone-fade';

describe('ZoneFade', () => {
  it('shows its first zone at once', () => {
    const fade = new ZoneFade(3, 1500);
    expect(fade.current).toBe(3);
    expect(fade.previous).toBeNull();
    expect(fade.alphaOf(3)).toBe(1);
    expect(fade.alphaOf(2)).toBe(0);
  });

  it('keeps the old zone under a new zone that fades in', () => {
    const fade = new ZoneFade(0, 1500);
    fade.goTo(1);
    expect(fade.previous).toBe(0);
    expect(fade.alphaOf(1)).toBe(0);
    expect(fade.alphaOf(0)).toBe(1);
    fade.update(750);
    expect(fade.alphaOf(1)).toBeCloseTo(0.5, 10);
    expect(fade.alphaOf(0)).toBe(1);
  });

  it('ends after the duration and drops the old zone', () => {
    const fade = new ZoneFade(0, 1500);
    fade.goTo(1);
    fade.update(1499);
    expect(fade.previous).toBe(0);
    fade.update(1);
    expect(fade.previous).toBeNull();
    expect(fade.progress).toBe(1);
    expect(fade.alphaOf(1)).toBe(1);
    expect(fade.alphaOf(0)).toBe(0);
  });

  it('rises smoothly and never goes backwards', () => {
    const fade = new ZoneFade(0, BACKDROP.fadeMs);
    fade.goTo(1);
    let last = fade.alphaOf(1);
    for (let i = 0; i < 100; i++) {
      fade.update(BACKDROP.fadeMs / 100 - 1e-6);
      const alpha = fade.alphaOf(1);
      expect(alpha).toBeGreaterThanOrEqual(last);
      last = alpha;
    }
  });

  it('ignores a change to the zone it already shows', () => {
    const fade = new ZoneFade(2, 1500);
    fade.goTo(2);
    expect(fade.previous).toBeNull();
  });

  it('turns a second change into a new fade over what was fading in', () => {
    const fade = new ZoneFade(0, 1500);
    fade.goTo(1);
    fade.update(500);
    fade.goTo(2);
    expect(fade.previous).toBe(1);
    expect(fade.current).toBe(2);
    expect(fade.alphaOf(0)).toBe(0);
    expect(fade.alphaOf(2)).toBe(0);
  });
});
