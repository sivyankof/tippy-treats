import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { CUT_LOOK } from '../../data/cut-look';
import { cutStripWidth, glazeWave, waveY } from '../objects/glaze-wave';
import { layerBox } from '../objects/layer-draw';
import { rotatedOffset, squashedY, traceSpot } from './cut-trace-place';
import { faceHalfSpan } from './glaze-growth';

const OUTER = 36;

describe('traceSpot', () => {
  it('hangs inside the glaze of a plain layer: never over the sponge of the cut or the side outline', () => {
    for (const width of [200, 450, 720]) {
      for (const side of [1, -1] as const) {
        const spot = traceSpot(width, side, OUTER, true);
        const box = layerBox(width);
        const glazeEnd = box.innerRight - cutStripWidth(box);
        expect(side * spot.dx + OUTER / 2).toBeLessThanOrEqual(
          glazeEnd - CUT_LOOK.strands.trace.gapPx + 1e-9,
        );
        expect(side * spot.dx + OUTER / 2).toBeLessThan(width / 2 - ANIM.layer.outline);
      }
    }
  });

  it('hangs from the glaze edge where it is lowest over the drop', () => {
    const width = 600;
    const spot = traceSpot(width, 1, OUTER, true);
    const wave = glazeWave(layerBox(width), 'right', faceHalfSpan(width, null));
    const edge = Math.max(waveY(wave, spot.dx - OUTER / 2), waveY(wave, spot.dx + OUTER / 2));
    const top = spot.dy;
    expect(top).toBeLessThan(edge);
    expect(top + OUTER).toBeGreaterThan(edge);
  });

  it('hangs from the straight glaze bottom of a creature layer', () => {
    const spot = traceSpot(600, -1, OUTER, false);
    const bottom = -BALANCE.layer.height / 2 + BALANCE.layer.height * ANIM.layer.glazeDepth;
    expect(spot.dx).toBeLessThan(0);
    expect(spot.dy).toBeCloseTo(bottom - OUTER * CUT_LOOK.strands.trace.aboveShare);
  });
});

describe('squashedY', () => {
  it('keeps a point at its height above the bottom, squashed with the layer', () => {
    expect(squashedY(100, 40, 1)).toBe(60);
    expect(squashedY(100, 40, 0.72)).toBeCloseTo(71.2);
  });
});

describe('rotatedOffset', () => {
  it('keeps the offset at rest and turns it with the layer', () => {
    expect(rotatedOffset(10, 4, 0)).toEqual({ x: 10, y: 4 });
    const turned = rotatedOffset(10, 0, Math.PI / 2);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(10);
    const a = rotatedOffset(7, -3, 0.4);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(Math.hypot(7, -3));
  });
});

describe('traceSpot on a fractional width', () => {
  it('is the spot of the drawn (rounded) width', () => {
    expect(traceSpot(300.6, 1, OUTER, true)).toEqual(traceSpot(301, 1, OUTER, true));
    expect(traceSpot(300.4, -1, OUTER, false)).toEqual(traceSpot(300, -1, OUTER, false));
  });
});
