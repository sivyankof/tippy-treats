import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { DECOR_KINDS, PLAIN_LAYER } from '../../data/plain-layers';
import { faceHalfSpan } from '../fx/glaze-growth';
import { decorItems, decorReach } from './decor-layout';
import { cutStripWidth, glazeCrestY } from './glaze-wave';
import { layerBox } from './layer-draw';
import { spongePores } from './sponge-pores';

const WIDTHS = [20, 90, 150, 200, 260, 333, 480, 720];

describe('decorItems', () => {
  it('never puts a decoration in front of the face or outside the glaze', () => {
    for (const kind of DECOR_KINDS) {
      for (const width of WIDTHS) {
        for (const cut of [null, 'left', 'right'] as const) {
          const box = layerBox(width);
          const half = faceHalfSpan(width, null);
          const reach = decorReach(kind);
          const strip = cut ? cutStripWidth(box) : 0;
          for (const item of decorItems(kind, box, cut, half)) {
            expect(Math.abs(item.x) - reach).toBeGreaterThanOrEqual(
              half + PLAIN_LAYER.decor.faceMargin - 1e-9,
            );
            expect(item.x - reach).toBeGreaterThanOrEqual(
              box.innerLeft + (cut === 'left' ? strip : 0),
            );
            expect(item.x + reach).toBeLessThanOrEqual(
              box.innerRight - (cut === 'right' ? strip : 0),
            );
            expect(item.y).toBeGreaterThan(box.top - PLAIN_LAYER.decor.maxRise);
            expect(item.y).toBeLessThan(glazeCrestY(box));
          }
        }
      }
    }
  });

  it('fills a wide layer on both sides and leaves a narrow one bare', () => {
    for (const kind of DECOR_KINDS) {
      const items = decorItems(kind, layerBox(720), null, faceHalfSpan(720, null));
      expect(items.some((i) => i.x < 0)).toBe(true);
      expect(items.some((i) => i.x > 0)).toBe(true);
      expect(decorItems(kind, layerBox(60), null, faceHalfSpan(60, null))).toHaveLength(0);
    }
  });

  it('keeps the decorations of the intact side in place after a bite', () => {
    for (const kind of DECOR_KINDS) {
      const whole = layerBox(720);
      const kept = layerBox(500);
      // Bitten on the right: the left edge of the kept part is where the whole layer's was.
      const shift = whole.left - kept.left;
      const before = decorItems(kind, whole, null, faceHalfSpan(720, null))
        .filter((i) => i.x < 0)
        .slice(0, 2);
      const after = decorItems(kind, kept, 'right', faceHalfSpan(500, null))
        .filter((i) => i.x < 0)
        .slice(0, 2);
      expect(after.length).toBe(before.length);
      after.forEach((item, k) => {
        expect(item.x + shift).toBeCloseTo(before[k]!.x);
        expect(item.y).toBeCloseTo(before[k]!.y);
        expect(item.variant).toBeCloseTo(before[k]!.variant);
      });
    }
  });

  it('gives the bitten-off part the decorations of the side it came from', () => {
    const kind = 'berries';
    const whole = layerBox(720);
    const piece = layerBox(220);
    // The piece bitten off the right keeps the right edge; its sponge faces left, it has no face.
    const shift = whole.right - piece.right;
    const right = decorItems(kind, whole, null, faceHalfSpan(720, null)).filter((i) => i.x > 0);
    const fallen = decorItems(kind, piece, 'left', null).filter((i) => i.x > 0);
    expect(fallen.length).toBeGreaterThan(0);
    expect(fallen[0]!.x + shift).toBeCloseTo(right[0]!.x);
    expect(fallen[0]!.variant).toBeCloseTo(right[0]!.variant);
  });
});

describe('spongePores', () => {
  it('spreads pores of several sizes over the sponge, none in front of the face', () => {
    for (const width of WIDTHS) {
      for (const cut of [null, 'left', 'right'] as const) {
        const box = layerBox(width);
        const half = faceHalfSpan(width, null);
        const top = glazeCrestY(box);
        const pores = spongePores(box, cut, half, top);
        for (const p of pores) {
          expect(Math.abs(p.x)).toBeGreaterThanOrEqual(half);
          expect(p.x - p.r).toBeGreaterThan(box.innerLeft);
          expect(p.x + p.r).toBeLessThan(box.innerRight);
          expect(p.y - p.r).toBeGreaterThanOrEqual(top - 1e-9);
          expect(p.y + p.r).toBeLessThan(box.innerBottom);
        }
      }
    }
    const wide = spongePores(layerBox(720), null, faceHalfSpan(720, null), -20);
    expect(wide.length).toBeGreaterThan(20);
    expect(new Set(wide.map((p) => p.r)).size).toBe(PLAIN_LAYER.pores.radii.length);
  });

  it('does not depend on the layer height being anything special', () => {
    expect(BALANCE.layer.height).toBeGreaterThan(0);
    expect(spongePores(layerBox(1), null, 0, 0)).toEqual([]);
  });
});
