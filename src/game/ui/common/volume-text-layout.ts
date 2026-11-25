/**
 * Pure geometry of the volume text (`volume-text.ts`). Boxes are in pixels from the pen position
 * of a glyph, x to the right and y down from its baseline (so the top of a glyph is negative).
 */

/** The box of the ink of a glyph or a string. */
export interface InkBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The part of `TextMetrics` the ink box is made from. */
export interface InkMetrics {
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
}

export function inkBox(m: InkMetrics): InkBox {
  return {
    x0: -m.actualBoundingBoxLeft,
    x1: m.actualBoundingBoxRight,
    y0: -m.actualBoundingBoxAscent,
    y1: m.actualBoundingBoxDescent,
  };
}

/** Where the vertical blend of the face starts and ends, from the baseline. */
export interface BlendSpan {
  y0: number;
  y1: number;
}

/**
 * The blend of the face, measured on the lettering `ref` (so every glyph of a text shares it):
 * `from` and `to` are shares of its ink height counted from its top.
 */
export function blendSpan(ref: InkBox, blend: { from: number; to: number }): BlendSpan {
  const height = ref.y1 - ref.y0;
  return { y0: ref.y0 + height * blend.from, y1: ref.y0 + height * blend.to };
}

/** The shift of the copy that cuts the inner shade out of the glyph, in pixels. */
export function innerShadeShift(
  fontSize: number,
  look: { dx: number; dy: number },
): { x: number; y: number } {
  return { x: fontSize * look.dx, y: fontSize * look.dy };
}

/** The ellipse of the gloss of one glyph. */
export interface GlossSpot {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * The gloss of `glyph`: to the upper left of the middle of its ink, sized by the font size (so
 * every glyph of a text gets the same spot); the face cuts it to the glyph.
 */
export function glossSpot(
  glyph: InkBox,
  fontSize: number,
  look: { x: number; y: number; rx: number; ry: number },
): GlossSpot {
  return {
    x: (glyph.x0 + glyph.x1) / 2 + fontSize * look.x,
    y: fontSize * look.y,
    rx: fontSize * look.rx,
    ry: fontSize * look.ry,
  };
}
