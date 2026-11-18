import { describe, expect, it, vi } from 'vitest';
import { startleLayer } from './tower-weather-fx';
import type { LayerView } from './layer-view';

function fakeView(
  y: number,
  canStartle = true,
): LayerView & { react: ReturnType<typeof vi.fn>; hop: ReturnType<typeof vi.fn> } {
  const react = vi.fn();
  const hop = vi.fn();
  return {
    visible: true,
    y,
    faceView: { canStartle, react },
    rig: { hop },
    react,
    hop,
  } as unknown as LayerView & {
    react: ReturnType<typeof vi.fn>;
    hop: ReturnType<typeof vi.fn>;
  };
}

const band = { bandTop: 0, bandBottom: 1000 };

describe('startleLayer', () => {
  it('startles the view the layer index has when the step fires, not the one it had when the wave was made', () => {
    const old = fakeView(500);
    const now = fakeView(500);
    const views = new Map<number, LayerView>([[3, now]]);
    // `old` was the view of layer 3 once; it went back to the pool and layer 3 has `now`.
    expect(startleLayer({ index: 3, reaction: 'startle', hop: false }, { views, ...band })).toBe(
      true,
    );
    expect(now.react).toHaveBeenCalledTimes(1);
    expect(old.react).not.toHaveBeenCalled();
  });

  it('does nothing for a layer that has no view, left the screen or is busy', () => {
    const item = { index: 1, reaction: 'startle', hop: false } as const;
    expect(startleLayer(item, { views: new Map(), ...band })).toBe(false);
    const off = fakeView(2000);
    expect(startleLayer(item, { views: new Map([[1, off]]), ...band })).toBe(false);
    const busy = fakeView(500, false);
    expect(startleLayer(item, { views: new Map([[1, busy]]), ...band })).toBe(false);
    expect(off.react).not.toHaveBeenCalled();
    expect(busy.react).not.toHaveBeenCalled();
  });

  it('hops the top layer when the step says so', () => {
    const top = fakeView(500);
    startleLayer(
      { index: 0, reaction: 'startle', hop: true },
      { views: new Map([[0, top]]), ...band },
    );
    expect(top.hop).toHaveBeenCalledTimes(1);
  });
});
