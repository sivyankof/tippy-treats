import { FONT_FAMILY } from '../../src/game/ui/common/fonts';
import { STORE_CAPTION, STORE_PLATE } from '../../src/data/debug/store-shots';
import {
  OVERLAY_SHADOW,
  captionBlockHeight,
  type CaptionFit,
  type PosterLayout,
  type PosterText,
} from './layout';

/** Canvas helpers of the store pictures (compose page): pictures, captions, overlays with a shadow. */

export interface ComposeOverlay {
  image: string;
  /** Centre and width in pixels, turn in degrees. */
  x: number;
  y: number;
  width: number;
  angle: number;
}

/** A slanted line is wider than its advance by about the cap height times the slant. */
const CAP_HEIGHT = 0.72;

export function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image did not load'));
    image.src = src;
  });
}

export function canvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return ctx;
}

export function font(size: number): string {
  return `${String(STORE_CAPTION.weight)} ${String(size)}px ${FONT_FAMILY}`;
}

/** Drawn width of a slanted, outlined line at a font size of 1 px. */
export function widthAt1(ctx: CanvasRenderingContext2D, line: string): number {
  const probe = 100;
  ctx.font = font(probe);
  const advance = ctx.measureText(line).width / probe;
  return advance + STORE_CAPTION.slant * CAP_HEIGHT + STORE_CAPTION.outlineWidth * 2;
}

/** Slanted text with the dark outline and the dark-pink drop, the block centred at `x`, `y`. */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  fit: CaptionFit,
  x: number,
  y: number,
  colors: { fill: string; drop: string },
): void {
  const c = STORE_CAPTION;
  const step = fit.size * c.lineHeight;
  ctx.save();
  ctx.font = font(fit.size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  fit.lines.forEach((line, i) => {
    const ly = y + (i - (fit.lines.length - 1) / 2) * step;
    ctx.save();
    ctx.translate(x, ly);
    ctx.transform(1, 0, -c.slant, 1, 0, 0);
    ctx.lineWidth = fit.size * c.outlineWidth * 2;
    ctx.strokeStyle = c.outline;
    ctx.fillStyle = colors.drop;
    const drop = fit.size * c.drop;
    ctx.strokeText(line, 0, drop);
    ctx.fillText(line, 0, drop);
    ctx.strokeText(line, 0, 0);
    ctx.fillStyle = colors.fill;
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

export async function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: readonly ComposeOverlay[],
  width: number,
): Promise<void> {
  for (const overlay of overlays) {
    const image = await load(overlay.image);
    const h = (overlay.width * image.height) / image.width;
    ctx.save();
    ctx.translate(overlay.x, overlay.y);
    ctx.rotate((overlay.angle * Math.PI) / 180);
    ctx.shadowColor = OVERLAY_SHADOW.color;
    ctx.shadowBlur = OVERLAY_SHADOW.blur * width;
    ctx.shadowOffsetY = OVERLAY_SHADOW.drop * width;
    ctx.drawImage(image, -overlay.width / 2, -h / 2, overlay.width, h);
    ctx.restore();
  }
}

/** The poster's title and the line under it where `layout` put them. */
export function drawPosterText(
  ctx: CanvasRenderingContext2D,
  layout: PosterLayout,
  text: PosterText,
): void {
  const x = layout.title.x + layout.title.width / 2;
  const block = (fit: CaptionFit, top: number) =>
    top + captionBlockHeight(fit, STORE_CAPTION.lineHeight) / 2;
  drawCaption(ctx, text.title, x, block(text.title, layout.title.y), {
    fill: STORE_CAPTION.fill,
    drop: STORE_CAPTION.dropColor,
  });
  drawCaption(ctx, text.subtitle, x, block(text.subtitle, layout.subtitle.y), {
    fill: STORE_CAPTION.fill,
    drop: STORE_PLATE.color,
  });
}
