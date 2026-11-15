import { describe, expect, it } from 'vitest';
import { faceHalfSpan } from '../fx/glaze-growth';
import { cutStripWidth, glazeCrestY } from './glaze-wave';
import { layerBox } from './layer-draw';
import type { Stroke } from './plain-lines';
import { marbleStrokes, waffleStrokes } from './sponge-material';

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
