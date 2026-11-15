/** Room a Text canvas needs on each side so that nothing painted outside the glyph box is cut off. */
export interface TextPadding {
  x: number;
  y: number;
}

/**
 * Phaser sizes a Text canvas from the font metrics only. A stroke spreads half its width outside the
 * glyph box on every side (more at sharp corners) and a hard shadow lands `offset` pixels further, so
 * descenders, the shadow and the stroke ends are cut at the canvas edge unless the canvas is padded.
 * The padding is the same on both sides, so the text stays centred on its origin.
 */
export function textPadding(strokeWidth: number, shadowX: number, shadowY: number): TextPadding {
  const reach = Math.ceil(strokeWidth / 2);
  return { x: reach + Math.ceil(Math.abs(shadowX)), y: reach + Math.ceil(Math.abs(shadowY)) };
}
