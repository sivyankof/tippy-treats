import { describe, expect, it } from 'vitest';
import { faceHalfSpan } from '../fx/glaze-growth';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { cutStripWidth, deepestY, glazeCrestY, glazeWave } from './glaze-wave';
import { layerBox } from './layer-draw';
import type { Stroke } from './plain-lines';
import { marbleMinLength, marbleStrokes, waffleStrokes } from './sponge-material';

function xs(strokes: Stroke[]): number[] {
  return strokes.flatMap((s) => s.lines.flatMap((l) => l.filter((_, i) => i % 2 === 0)));
}

describe('sponge materials', () => {
  for (const [name, strokes] of [
    ['marble', marbleStrokes],
    ['waffle', waffleStrokes],
  ] as const) {
    it(`${name}: stays under the glaze, off the face and the cut strip`, () => {
      for (const width of [150, 333, 720]) {
        for (const cut of [null, 'left', 'right'] as const) {
          const box = layerBox(width);
          const half = faceHalfSpan(width, null);
          const strip = cut ? cutStripWidth(box) : 0;
          const found = strokes(box, cut, half, glazeCrestY(box));
          for (const s of found) {
            for (const line of s.lines) {
              for (let i = 0; i < line.length; i += 2) {
                expect(line[i + 1]!).toBeGreaterThanOrEqual(glazeCrestY(box));
                expect(line[i + 1]!).toBeLessThanOrEqual(box.innerBottom);
              }
            }
          }
          for (const x of xs(found)) {
            expect(Math.abs(x)).toBeGreaterThanOrEqual(half);
            expect(x).toBeGreaterThanOrEqual(box.innerLeft + (cut === 'left' ? strip : 0));
            expect(x).toBeLessThanOrEqual(box.innerRight - (cut === 'right' ? strip : 0));
          }
        }
      }
    });

    it(`${name}: draws something on a wide layer, to the middle on a faceless piece`, () => {
      const box = layerBox(480);
      expect(xs(strokes(box, null, 40, glazeCrestY(box))).length).toBeGreaterThan(10);
      expect(xs(strokes(box, null, null, glazeCrestY(box))).some((x) => Math.abs(x) < 10)).toBe(
        true,
      );
    });
  }
});

describe('marble ribbons', () => {
  const M = PLAIN_LAYER.marble;

  it('fit whole in the band under the deepest tongue, edge and wave included', () => {
    for (let width = 100; width <= 720; width += 7) {
      for (const cut of [null, 'left', 'right'] as const) {
        for (const faceless of [false, true]) {
          const box = layerBox(width);
          const wave = glazeWave(box, cut, faceless ? null : faceHalfSpan(width, null));
          const top = deepestY(wave);
          const height = box.innerBottom - top;
          for (const rib of M.ribbons) {
            const reach = rib.amplitude + rib.width / 2 + (rib.edge === null ? 0 : M.edgePx);
            const y = top + height * rib.yShare;
            expect(y - reach).toBeGreaterThanOrEqual(top);
            expect(y + reach).toBeLessThanOrEqual(box.innerBottom - M.inset);
          }
        }
      }
    }
  });

  it('keep every stroke, edge included, inside the band', () => {
    for (const width of [200, 333, 720]) {
      const box = layerBox(width);
      const top = deepestY(glazeWave(box, null, faceHalfSpan(width, null)));
      const found = marbleStrokes(box, null, faceHalfSpan(width, null), top);
      for (const s of found) {
        for (const line of s.lines) {
          for (let i = 1; i < line.length; i += 2) {
            expect(line[i]! - s.width / 2).toBeGreaterThanOrEqual(top - 1e-9);
            expect(line[i]! + s.width / 2).toBeLessThanOrEqual(box.innerBottom - M.inset + 1e-9);
          }
        }
      }
    }
  });

  it('shorten the shortest piece on a narrow stretch but never below the floor', () => {
    expect(marbleMinLength(1000)).toBe(M.minLength);
    expect(marbleMinLength(60)).toBe(M.minShare * 60);
    expect(marbleMinLength(-20)).toBe(M.minFloor);
  });

  it('keep some ribbons on a narrow layer', () => {
    for (const width of [240, 260, 280]) {
      for (const cut of [null, 'left', 'right'] as const) {
        const box = layerBox(width);
        const half = faceHalfSpan(width, null);
        const found = marbleStrokes(box, cut, half, deepestY(glazeWave(box, cut, half)));
        expect(found.some((s) => s.lines.length > 0)).toBe(true);
      }
    }
  });
});
