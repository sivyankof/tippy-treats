/** Pure layout of a string drawn glyph by glyph from pictures (see glyph-text.ts). */

/** A glyph of a laid-out string and its pen position, in pixels from the left edge of the text. */
export interface GlyphPlacement {
  char: string;
  x: number;
}

/** The laid-out string: its glyphs (spaces only move the pen) and the pen advance of the whole string. */
export interface GlyphLayout {
  glyphs: GlyphPlacement[];
  advance: number;
}

/** Width of a string in the text font. */
export type MeasureText = (text: string) => number;

/**
 * Places every glyph where the browser would put it when it draws the whole string: the pen
 * position of a glyph is the width of the string up to and including it, minus its own width, so
 * kerning between neighbours is kept. Positions are whole pixels (the browser rounds a text the same way).
 */
export function layoutGlyphs(text: string, measure: MeasureText): GlyphLayout {
  const chars = Array.from(text);
  const glyphs: GlyphPlacement[] = [];
  let prefix = '';
  for (const char of chars) {
    prefix += char;
    if (char.trim() === '') continue;
    glyphs.push({ char, x: Math.round(measure(prefix) - measure(char)) });
  }
  return { glyphs, advance: chars.length === 0 ? 0 : measure(text) };
}

/** Width of the box of a text, as Phaser sizes a Text: the advance and the stroke rounded up, plus the padding on both sides. */
export function glyphBoxWidth(advance: number, strokeWidth: number, padX: number): number {
  return Math.ceil(advance + strokeWidth) + padX * 2;
}

/** The distinct characters that need a picture (whitespace needs none), in order of first use. */
export function glyphChars(strings: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const text of strings) {
    for (const char of Array.from(text)) {
      if (char.trim() !== '') seen.add(char);
    }
  }
  return [...seen];
}

/** The forms of a plural entry (`one=in {n} layer|other=in {n} layers`) with the `{n}` marks cut out. */
export function pluralFormTexts(entry: string): string[] {
  return entry.split('|').map((form) => {
    const split = form.indexOf('=');
    return (split > 0 ? form.slice(split + 1) : form).replace(/\{\w+\}/g, '');
  });
}

/** Texture key of one glyph of a style (`styleId` comes from `glyphStyleId`). */
export function glyphKey(styleId: string, char: string): string {
  return `ui_hud_glyph_${styleId}_${(char.codePointAt(0) ?? 0).toString(16)}`;
}
