import { describe, expect, it } from 'vitest';
import { VOLUME_TEXT } from '../../../data/common/volume-text-look';
import { bandTop, glossOf, inkBox } from './volume-text-layout';

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

  it('puts the shade band on the lower share of the lettering', () => {
    expect(bandTop(REF, 0.3)).toBeCloseTo(-30);
    expect(bandTop({ ...REF, y1: 10 }, 0.5)).toBeCloseTo(-45);
  });

  it('sizes the gloss by the lettering height and keeps it inside a narrow glyph', () => {
    const wide = glossOf({ x0: 0, x1: 80, y0: -100, y1: 0 }, REF, VOLUME_TEXT.gloss);
    expect(wide.length).toBeCloseTo(100 * VOLUME_TEXT.gloss.length);
    expect(wide.x).toBeCloseTo(80 * VOLUME_TEXT.gloss.x);
    expect(wide.y).toBeCloseTo(-100 + 100 * VOLUME_TEXT.gloss.y);
    const narrow = glossOf({ x0: 0, x1: 10, y0: -100, y1: 0 }, REF, VOLUME_TEXT.gloss);
    expect(narrow.length).toBeCloseTo(10 * VOLUME_TEXT.gloss.maxWidthShare);
    expect(narrow.thick).toBeCloseTo(wide.thick);
  });

  it('gloss sits in the upper half of the lettering', () => {
    const g = glossOf({ x0: 0, x1: 80, y0: -100, y1: 0 }, REF, VOLUME_TEXT.gloss);
    expect(g.y).toBeLessThan(-50);
    expect(g.tilt).toBeLessThan(0);
  });
});
