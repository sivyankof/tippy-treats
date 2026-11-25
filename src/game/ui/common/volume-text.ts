import { VOLUME_TEXT, type VolumeFace } from '../../../data/common/volume-text-look';
import { cssColor } from '../../../util/color';
import { blendSpan, glossSpot, inkBox, innerShadeShift } from './volume-text-layout';

/**
 * The look of the large flat texts (`VOLUME_TEXT`), painted on a Canvas2D. A glyph has two pictures:
 * the back (the dark contour and the step of shadow below it) and the face (the blended colour, the
 * inner shade and the gloss). A text draws every back before any face, so the
 * contour of a glyph never covers the face of its neighbour (see `glyph-text.ts`).
 */

/** A volume text: the face colour and the lettering the blend of the face is measured on. */
export interface VolumeSpec {
  face: VolumeFace;
  /** The characters whose ink height sets the blend (every glyph of a text shares it). */
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
  /** Its size in pixels: the inner shade and the gloss are measured on it. */
  fontSize: number;
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

/** The face of a glyph: the blended colour, the inner shade along the lower right edge and the gloss. */
export function paintVolumeFace(
  canvas: VolumeCanvas,
  char: string,
  pen: Pen,
  spec: VolumeSpec,
): void {
  setUp(canvas);
  const { context, fontSize } = canvas;
  const face = VOLUME_TEXT.faces[spec.face];
  const ref = inkBox(context.measureText(spec.refText));
  const span = blendSpan(ref, VOLUME_TEXT.blend);
  const blend = context.createLinearGradient(0, pen.baseline + span.y0, 0, pen.baseline + span.y1);
  blend.addColorStop(0, cssColor(face.color));
  blend.addColorStop(1, cssColor(face.bottom));
  context.fillStyle = blend;
  context.fillText(char, pen.x, pen.baseline);
  // Only where the face is: the shade and the gloss never leave the glyph.
  context.globalCompositeOperation = 'source-atop';
  // The whole face takes the inner tone, then a copy moved up and to the left gives the blend back:
  // the tone stays only in a thin crescent along the lower right edge.
  context.globalAlpha = VOLUME_TEXT.innerShade.alpha;
  context.fillStyle = cssColor(face.inner);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 1;
  const shift = innerShadeShift(fontSize, VOLUME_TEXT.innerShade);
  context.fillStyle = blend;
  context.fillText(char, pen.x + shift.x, pen.baseline + shift.y);
  if (face.glossAlpha > 0) {
    const spot = glossSpot(inkBox(context.measureText(char)), fontSize, VOLUME_TEXT.gloss);
    context.fillStyle = `rgba(255, 255, 255, ${String(face.glossAlpha)})`;
    context.beginPath();
    context.ellipse(pen.x + spot.x, pen.baseline + spot.y, spot.rx, spot.ry, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = 'source-over';
}
