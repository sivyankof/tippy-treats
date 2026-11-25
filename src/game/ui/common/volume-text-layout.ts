import { DEG_TO_RAD } from '../../../util/math';

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

/** Top of the shade band: `share` of the height of `ref`, counted from its bottom. */
export function bandTop(ref: InkBox, share: number): number {
  return ref.y1 - (ref.y1 - ref.y0) * share;
}

/** Where the gloss of one glyph goes and how big it is. */
export interface GlossGeometry {
  x: number;
  y: number;
  length: number;
  thick: number;
  /** Radians. */
  tilt: number;
  dotGap: number;
  dotRadius: number;
}

/** The numbers of the gloss, shares as in `VOLUME_TEXT.gloss`. */
export interface GlossShares {
  x: number;
  y: number;
  length: number;
  thick: number;
  tiltDeg: number;
  dotGap: number;
  dotRadius: number;
  maxWidthShare: number;
}

/**
 * The gloss of `glyph`: near its upper left, sized by the height of the lettering `ref` (so every
 * glyph of a text gets the same stroke) and never longer than a share of the glyph's own width.
 */
export function glossOf(glyph: InkBox, ref: InkBox, look: GlossShares): GlossGeometry {
  const height = ref.y1 - ref.y0;
  const width = glyph.x1 - glyph.x0;
  return {
    x: glyph.x0 + width * look.x,
    y: ref.y0 + height * look.y,
    length: Math.min(height * look.length, width * look.maxWidthShare),
    thick: height * look.thick,
    tilt: look.tiltDeg * DEG_TO_RAD,
    dotGap: height * look.dotGap,
    dotRadius: height * look.dotRadius,
  };
}
