import { describe, expect, it } from 'vitest';
import { glyphBoxWidth, glyphChars, glyphKey, layoutGlyphs, pluralFormTexts } from './glyph-layout';

/** Every letter 10 wide, a kerning pair "AV" pulls 3 closer. */
const measure = (text: string): number => text.length * 10 - (text.includes('AV') ? 3 : 0);

describe('layoutGlyphs', () => {
  it('puts glyphs one advance apart', () => {
    const layout = layoutGlyphs('123', measure);
    expect(layout.glyphs.map((g) => g.x)).toEqual([0, 10, 20]);
    expect(layout.advance).toBe(30);
  });

  it('skips spaces but keeps their advance', () => {
    const layout = layoutGlyphs('a b', measure);
    expect(layout.glyphs).toEqual([
      { char: 'a', x: 0 },
      { char: 'b', x: 20 },
    ]);
  });

  it('keeps kerning between neighbours', () => {
    const layout = layoutGlyphs('AVx', measure);
    expect(layout.glyphs.map((g) => g.x)).toEqual([0, 7, 17]);
    expect(layout.advance).toBe(27);
  });

  it('lays out an empty string as nothing', () => {
    expect(layoutGlyphs('', measure)).toEqual({ glyphs: [], advance: 0 });
  });
});

describe('glyph helpers', () => {
  it('sizes the box like a Text', () => {
    expect(glyphBoxWidth(30.2, 8, 4)).toBe(47);
  });

  it('lists distinct non-space characters', () => {
    expect(glyphChars(['ab a', '1 b'])).toEqual(['a', 'b', '1']);
  });

  it('cuts the number mark out of every plural form', () => {
    expect(pluralFormTexts('one=in {n} layer|other=in {n} layers')).toEqual([
      'in  layer',
      'in  layers',
    ]);
  });

  it('keys a glyph by its code point', () => {
    expect(glyphKey('52_8', '5')).toBe('ui_hud_glyph_52_8_35');
  });
});
