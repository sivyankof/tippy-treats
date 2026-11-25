import { describe, expect, it } from 'vitest';
import { VOLUME_TEXT } from '../../../data/common/volume-text-look';
import { blendSpan, glossSpot, inkBox, innerShadeShift } from './volume-text-layout';

const REF = { x0: 0, x1: 100, y0: -100, y1: 0 };

describe('volume text layout', () => {
  it('makes the ink box from the text metrics', () => {
    const box = inkBox({
      actualBoundingBoxLeft: -4,
      actualBoundingBoxRight: 60,
      actualBoundingBoxAscent: 80,
      actualBoundingBoxDescent: 2,
    });
    expect(box).toEqual({ x0: 4, x1: 60, y0: -80, y1: 2 });
  });

  it('blends the face over the lettering from its top down', () => {
    const plain = blendSpan(REF, { from: 0.1, to: 1.1 });
    expect(plain.y0).toBeCloseTo(-90);
    expect(plain.y1).toBeCloseTo(10);
    const span = blendSpan({ ...REF, y1: 10 }, VOLUME_TEXT.blend);
    expect(span.y0).toBeLessThan(span.y1);
    expect(span.y0).toBeGreaterThan(-100);
  });

  it('moves the cutting copy up and to the left, so the shade lies on the lower right edge', () => {
    const shift = innerShadeShift(200, VOLUME_TEXT.innerShade);
    expect(shift.x).toBeCloseTo(200 * VOLUME_TEXT.innerShade.dx);
    expect(shift.y).toBeCloseTo(200 * VOLUME_TEXT.innerShade.dy);
    expect(shift.x).toBeLessThan(0);
    expect(shift.y).toBeLessThan(0);
  });

  it('puts the gloss to the upper left of the glyph and sizes it by the font size', () => {
    const wide = glossSpot({ x0: 0, x1: 80, y0: -100, y1: 0 }, 140, VOLUME_TEXT.gloss);
    const narrow = glossSpot({ x0: 0, x1: 20, y0: -100, y1: 0 }, 140, VOLUME_TEXT.gloss);
    expect(wide.x).toBeLessThan(40);
    expect(wide.y).toBeLessThan(-50);
    expect(narrow.rx).toBeCloseTo(wide.rx);
    expect(narrow.ry).toBeCloseTo(140 * VOLUME_TEXT.gloss.ry);
  });
});
