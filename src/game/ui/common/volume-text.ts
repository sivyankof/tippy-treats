import { VOLUME_TEXT, type VolumeFace } from '../../../data/common/volume-text-look';
import { cssColor } from '../../../util/color';
import { bandTop, glossOf, inkBox, type GlossGeometry } from './volume-text-layout';

/**
 * The look of the large flat texts (`VOLUME_TEXT`), painted on a Canvas2D. A glyph has two pictures:
 * the back (the dark contour and the step of shadow below it) and the face (the colour, the flat
 * shade band along the bottom and the gloss). A text draws every back before any face, so the
 * contour of a glyph never covers the face of its neighbour (see `glyph-text.ts`).
 */

/** A volume text: the face colour and the lettering the shade band is measured on. */
export interface VolumeSpec {
  face: VolumeFace;
  /** The characters whose ink height sets the band and the gloss (every glyph of a text shares it). */
  refText: string;
}

/** Short id of a spec, for texture keys. */
export function volumeSpecId(spec: VolumeSpec): string {
  const codes = Array.from(spec.refText, (c) => (c.codePointAt(0) ?? 0).toString(36)).join('');
  return `${spec.face}${codes}`;
}

/** Where the pen of the glyph sits in the picture. */
export interface Pen {
  x: number;
  baseline: number;
}

/** What a layer needs to know about the picture. */
export interface VolumeCanvas {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** CSS font of the lettering. */
  font: string;
}

function setUp(canvas: VolumeCanvas): void {
  const { context } = canvas;
  context.font = canvas.font;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = VOLUME_TEXT.contour;
}

/** The dark contour of a glyph and the step of shadow below it. */
export function paintVolumeBack(canvas: VolumeCanvas, char: string, pen: Pen): void {
  setUp(canvas);
  const { context } = canvas;
  const { contour, step, contourColor, stepColor } = VOLUME_TEXT;
  for (const [offset, color] of [
    [step, stepColor],
    [0, contourColor],
  ] as const) {
    context.fillStyle = cssColor(color);
    context.strokeStyle = cssColor(color);
    context.lineWidth = contour;
    context.strokeText(char, pen.x, pen.baseline + offset);
    context.fillText(char, pen.x, pen.baseline + offset);
  }
}

/** The stroke of the gloss and the dot after it, white. */
function paintGloss(context: CanvasRenderingContext2D, pen: Pen, gloss: GlossGeometry): void {
  const cx = pen.x + gloss.x;
  const cy = pen.baseline + gloss.y;
  context.fillStyle = `rgba(255, 255, 255, ${VOLUME_TEXT.gloss.alpha})`;
  context.beginPath();
  context.ellipse(cx, cy, gloss.length / 2, gloss.thick / 2, gloss.tilt, 0, Math.PI * 2);
  context.fill();
  const reach = gloss.length / 2 + gloss.dotGap;
  context.beginPath();
  context.arc(
    cx + Math.cos(gloss.tilt) * reach,
    cy + Math.sin(gloss.tilt) * reach,
    gloss.dotRadius,
    0,
    Math.PI * 2,
  );
  context.fill();
}

/** The face of a glyph: the colour, the band of the shade tone along the bottom and the gloss. */
export function paintVolumeFace(
  canvas: VolumeCanvas,
  char: string,
  pen: Pen,
  spec: VolumeSpec,
): void {
  setUp(canvas);
  const { context } = canvas;
  const face = VOLUME_TEXT.faces[spec.face];
  const ref = inkBox(context.measureText(spec.refText));
  const glyph = inkBox(context.measureText(char));
  context.fillStyle = cssColor(face.color);
  context.fillText(char, pen.x, pen.baseline);
  // Only where the face is: the band and the gloss never leave the glyph.
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = cssColor(face.shade);
  const top = pen.baseline + bandTop(ref, VOLUME_TEXT.bandShare);
  context.fillRect(0, top, canvas.width, canvas.height - top);
  paintGloss(context, pen, glossOf(glyph, ref, VOLUME_TEXT.gloss));
  context.globalCompositeOperation = 'source-over';
}
