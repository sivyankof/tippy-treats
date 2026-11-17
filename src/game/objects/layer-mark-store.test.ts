import { describe, expect, it } from 'vitest';
import { LayerMarkStore, markGrow, markSwingDeg, type LayerMark } from './layer-mark-store';

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

  it('refuses an empty or too long mark', () => {
    const store = new LayerMarkStore();
    expect(store.addCut(1, [])).toBe(false);
    expect(store.addCut(1, [mark(), mark(), mark()])).toBe(false);
    expect(store.hasCut(1)).toBe(false);
    expect(store.addPress(1, [])).toBe(false);
    expect(store.addPress(1, [mark(), mark(), mark()])).toBe(false);
    expect(store.hasPress(1)).toBe(false);
  });

  it('forgets everything when a run starts', () => {
    const store = new LayerMarkStore();
    store.addCut(2, [mark()]);
    store.clear();
    expect(store.at(2)).toBeUndefined();
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
