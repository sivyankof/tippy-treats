import { describe, expect, it } from 'vitest';
import {
  LayerMarkStore,
  MAX_PRESS_PICTURES,
  markGrow,
  markSwingDeg,
  markVanish,
  squeezeDoneMs,
  squeezeScale,
  type LayerMark,
  type MarkSqueeze,
} from './layer-mark-store';

function mark(over: Partial<LayerMark> = {}): LayerMark {
  return {
    texture: 'fx_test',
    dx: 10,
    dy: -4,
    originX: 0.5,
    originY: 0,
    width: 20,
    height: 30,
    bornMs: 1000,
    growMs: 200,
    ...over,
  };
}

describe('layer marks', () => {
  it('keeps at most one cut drop and one press mark per layer', () => {
    const store = new LayerMarkStore();
    const first = mark();
    expect(store.addCut(3, [first])).toBe(true);
    expect(store.addCut(3, [mark({ dx: 99 })])).toBe(false);
    expect(store.at(3)?.cut).toEqual([first]);
    expect(store.addPress(3, [mark(), mark()])).toBe(true);
    expect(store.addPress(3, [mark()])).toBe(false);
    expect(store.at(3)?.press).toHaveLength(2);
    expect(store.hasCut(4)).toBe(false);
    expect(store.hasPress(3)).toBe(true);
  });

  it('asks the layer above to hide its shadow only over a mark that wants it (the cream roll)', () => {
    const store = new LayerMarkStore();
    store.addPress(2, [mark()]);
    store.addCut(3, [mark({ clearOfShadow: true })]);
    store.addPress(4, [mark({ clearOfShadow: true }), mark({ clearOfShadow: true })]);
    expect(store.clearsShadowAbove(2)).toBe(false);
    expect(store.clearsShadowAbove(3)).toBe(false);
    expect(store.clearsShadowAbove(4)).toBe(true);
    expect(store.clearsShadowAbove(5)).toBe(false);
    store.removePress(4);
    expect(store.clearsShadowAbove(4)).toBe(false);
  });

  it('refuses an empty or too long mark', () => {
    const store = new LayerMarkStore();
    expect(store.addCut(1, [])).toBe(false);
    expect(store.addCut(1, [mark(), mark(), mark()])).toBe(false);
    expect(store.hasCut(1)).toBe(false);
    expect(store.addPress(1, [])).toBe(false);
    expect(
      store.addPress(
        1,
        Array.from({ length: MAX_PRESS_PICTURES + 1 }, () => mark()),
      ),
    ).toBe(false);
    expect(store.hasPress(1)).toBe(false);
  });

  it('forgets everything when a run starts', () => {
    const store = new LayerMarkStore();
    store.addCut(2, [mark()]);
    store.clear();
    expect(store.at(2)).toBeUndefined();
  });

  it('changes its version only when something really changed', () => {
    const store = new LayerMarkStore();
    const v0 = store.version;
    store.addCut(1, []);
    expect(store.version).toBe(v0);
    store.addCut(1, [mark()]);
    const v1 = store.version;
    expect(v1).toBeGreaterThan(v0);
    store.addCut(1, [mark()]);
    expect(store.version).toBe(v1);
    store.addPress(1, [mark()]);
    expect(store.version).toBeGreaterThan(v1);
    const v2 = store.version;
    store.clear();
    expect(store.version).toBeGreaterThan(v2);
  });

  it('grows in without popping and settles at full size', () => {
    const m = mark();
    expect(markGrow(m, 0)).toBeCloseTo(0);
    expect(markGrow(m, 100)).toBeGreaterThan(0);
    expect(markGrow(m, 200)).toBeCloseTo(1);
    expect(markGrow(m, 5000)).toBeCloseTo(1);
    expect(markGrow(mark({ growMs: 0 }), 0)).toBe(1);
  });

  it('swings with a decaying amplitude and comes to rest', () => {
    const m = mark({ swing: { amplitudeDeg: 20, periodMs: 400, decayMs: 300 } });
    expect(markSwingDeg(m, 0)).toBe(0);
    const early = Math.abs(markSwingDeg(m, 100));
    const later = Math.abs(markSwingDeg(m, 500));
    expect(early).toBeGreaterThan(later);
    expect(early).toBeLessThanOrEqual(20);
    expect(markSwingDeg(m, 3000)).toBe(0);
    expect(markSwingDeg(mark(), 100)).toBe(0);
  });
});

describe('vanishing press marks', () => {
  it('shrinks a press mark away and sweeps it out when it is over', () => {
    const store = new LayerMarkStore();
    store.addPress(2, [mark()]);
    store.addCut(2, [mark()]);
    expect(store.vanishPress(2, 1000, 100)).toBe(true);
    expect(store.vanishPress(2, 1000, 100)).toBe(false);
    const shown = store.at(2)?.press?.[0] as LayerMark;
    expect(markVanish(shown, 999)).toBe(1);
    expect(markVanish(shown, 1050)).toBeGreaterThan(0);
    expect(markVanish(shown, 1050)).toBeLessThan(1);
    expect(markVanish(shown, 1100)).toBe(0);
    store.sweep(1099);
    expect(store.hasPress(2)).toBe(true);
    store.sweep(1100);
    expect(store.hasPress(2)).toBe(false);
    expect(store.hasCut(2)).toBe(true);
  });

  it('removes a press mark at once and drops an empty set', () => {
    const store = new LayerMarkStore();
    store.addPress(5, [mark()]);
    const version = store.version;
    expect(store.removePress(5)).toBe(true);
    expect(store.removePress(5)).toBe(false);
    expect(store.at(5)).toBeUndefined();
    expect(store.version).toBeGreaterThan(version);
  });
});

describe('squeezeScale', () => {
  const look: MarkSqueeze = {
    bulgeMs: 70,
    bulge: [0.2, 0.7],
    pushMs: 230,
    over: [1.1, 0.9],
    settleMs: 300,
    sag: { ms: 1600, to: [0.96, 1.1] },
  };

  it('starts from nothing and swells to the bulge (anticipation)', () => {
    expect(squeezeScale(look, -5, 0)).toBe(0);
    expect(squeezeScale(look, 0, 1)).toBe(0);
    expect(squeezeScale(look, 70, 0)).toBeCloseTo(0.2);
    expect(squeezeScale(look, 70, 1)).toBeCloseTo(0.7);
  });

  it('is pushed out to the overshoot, then settles back past 1 and comes to rest', () => {
    expect(squeezeScale(look, 300, 0)).toBeCloseTo(1.1);
    expect(squeezeScale(look, 300, 1)).toBeCloseTo(0.9);
    let under = Infinity;
    for (let t = 300; t <= 600; t += 5) under = Math.min(under, squeezeScale(look, t, 0));
    expect(under).toBeLessThan(1);
    expect(under).toBeGreaterThan(0.95);
    expect(squeezeScale(look, 600, 0)).toBeCloseTo(1);
  });

  it('then sags slowly to its final scale and stays there', () => {
    expect(squeezeDoneMs(look)).toBe(70 + 230 + 300 + 1600);
    expect(squeezeScale(look, 1400, 1)).toBeGreaterThan(1);
    expect(squeezeScale(look, 1400, 1)).toBeLessThan(1.1);
    expect(squeezeScale(look, 2200, 1)).toBeCloseTo(1.1);
    expect(squeezeScale(look, 9000, 0)).toBeCloseTo(0.96);
    expect(squeezeScale({ ...look, sag: undefined }, 9000, 0)).toBe(1);
  });

  it('can show a small bump from its first frame instead of growing from nothing', () => {
    const bump: MarkSqueeze = { ...look, from: [0.24, 0.32] };
    expect(squeezeScale(bump, 0, 0)).toBe(0);
    expect(squeezeScale(bump, 1, 0)).toBeCloseTo(0.24, 1);
    expect(squeezeScale(bump, 1, 1)).toBeCloseTo(0.32, 1);
    expect(squeezeScale(bump, 70, 0)).toBeCloseTo(0.2);
  });

  it('never jumps between two frames (nothing pops)', () => {
    for (const axis of [0, 1] as const) {
      let last = squeezeScale(look, 0, axis);
      for (let t = 4; t <= squeezeDoneMs(look) + 100; t += 4) {
        const next = squeezeScale(look, t, axis);
        expect(Math.abs(next - last)).toBeLessThan(0.1);
        last = next;
      }
    }
  });
});
