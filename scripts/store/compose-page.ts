import '../../src/style.css';
import { FONT_FAMILY } from '../../src/game/ui/common/fonts';
import {
  STORE_CAPTION,
  STORE_FEATURE,
  STORE_PLATE,
  type StoreLang,
} from '../../src/data/debug/store-shots';
import { fitCaption, wavePoints, type CaptionFit } from './layout';
import { storeSaveText } from './store-save';

/**
 * The page that lays out the store pictures (`compose.html`, opened by `store-shots.ts` from the
 * dev server): every call takes data URLs, draws on a canvas and gives the pixels back as base64
 * RGBA, which the script writes as PNG without alpha.
 */

export interface ComposeOverlay {
  image: string;
  /** Centre and width in pixels, turn in degrees. */
  x: number;
  y: number;
  width: number;
  angle: number;
}

export interface ShotSpec {
  frame: string;
  width: number;
  height: number;
  /** Null for a picture without a plate (the review shot of the shop). */
  caption: string | null;
  /** Height of the plate, a share of the width. */
  plateHeight: number;
  overlays: ComposeOverlay[];
}

export interface FeatureSpec {
  frame: string;
  hero: string;
  lang: StoreLang;
}

export interface Composed {
  width: number;
  height: number;
  /** RGBA pixels, base64. */
  rgba: string;
  /** The caption as laid out (lines and font size), for the report. */
  fit: CaptionFit | null;
}

const WAVE_STEP_PX = 4;
/** Shadow under the big creatures and the hero, shares of the width. */
const OVERLAY_SHADOW = { color: 'rgba(59, 42, 74, 0.35)', blur: 0.025, drop: 0.01 };
/** A slanted line is wider than its advance by about the cap height times the slant. */
const CAP_HEIGHT = 0.72;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image did not load'));
    image.src = src;
  });
}

function canvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return ctx;
}

function font(size: number): string {
  return `${String(STORE_CAPTION.weight)} ${String(size)}px ${FONT_FAMILY}`;
}

/** Drawn width of a slanted, outlined line at a font size of 1 px. */
function widthAt1(ctx: CanvasRenderingContext2D, line: string): number {
  const probe = 100;
  ctx.font = font(probe);
  const advance = ctx.measureText(line).width / probe;
  return advance + STORE_CAPTION.slant * CAP_HEIGHT + STORE_CAPTION.outlineWidth * 2;
}

/** Slanted text with the dark outline and the dark-pink drop, the block centred at `x`, `y`. */
function drawCaption(
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

async function drawOverlays(
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

/** The plate with its wavy top over the bottom of the picture; returns the y of the wave line. */
function drawPlate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  plateHeight: number,
): number {
  const p = STORE_PLATE;
  const top = height - plateHeight * width + p.waveAmplitude * width;
  const points = wavePoints(
    {
      width,
      top,
      amplitude: p.waveAmplitude * width,
      length: p.waveLength * width,
      phase: p.wavePhase,
    },
    WAVE_STEP_PX,
  );
  const outline = new Path2D();
  points.forEach((pt, i) => (i === 0 ? outline.moveTo(pt.x, pt.y) : outline.lineTo(pt.x, pt.y)));
  const plate = new Path2D(outline);
  plate.lineTo(width, height);
  plate.lineTo(0, height);
  plate.closePath();
  ctx.save();
  ctx.shadowColor = p.shadowColor;
  ctx.shadowBlur = p.shadowBlur * width;
  ctx.fillStyle = p.color;
  ctx.fill(plate);
  ctx.restore();
  ctx.save();
  ctx.clip(plate);
  ctx.strokeStyle = p.rimColor;
  ctx.lineWidth = p.rimWidth * width * 2;
  ctx.stroke(outline);
  ctx.restore();
  return top;
}

function pixels(ctx: CanvasRenderingContext2D): string {
  const data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    out += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(out);
}

async function shot(spec: ShotSpec): Promise<Composed> {
  const { width, height } = spec;
  const ctx = canvas2d(width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(await load(spec.frame), 0, 0, width, height);
  await drawOverlays(ctx, spec.overlays, width);
  let fit: CaptionFit | null = null;
  if (spec.caption !== null) {
    const top = drawPlate(ctx, width, height, spec.plateHeight);
    const c = STORE_CAPTION;
    const pad = c.padding * width;
    // From the lowest point of the waves to the bottom edge, less the padding on both sides.
    const roomTop = top + STORE_PLATE.waveAmplitude * width + pad;
    const room = height - pad - roomTop;
    fit = fitCaption(spec.caption, (line) => widthAt1(ctx, line), {
      maxSize: c.maxSize * width,
      minSize: c.minSize * width,
      maxWidth: c.maxWidth * width,
      maxHeight: room,
      maxLines: c.maxLines,
      lineHeight: c.lineHeight,
      glueUpTo: c.glueUpTo,
      moreLinesCost: c.moreLinesCost,
    });
    if (!fit) throw new Error(`caption does not fit: ${spec.caption}`);
    drawCaption(ctx, fit, width / 2, roomTop + room / 2, { fill: c.fill, drop: c.dropColor });
  }
  return { width, height, rgba: pixels(ctx), fit };
}

async function feature(spec: FeatureSpec): Promise<Composed> {
  const f = STORE_FEATURE;
  const ctx = canvas2d(f.width, f.height);
  const frame = await load(spec.frame);
  const scale = f.width / frame.width;
  const band = f.height / scale;
  const sy = Math.min(
    Math.max(0, frame.height * f.background.centreY - band / 2),
    frame.height - band,
  );
  ctx.drawImage(frame, 0, sy, frame.width, band, 0, 0, f.width, f.height);
  ctx.fillStyle = f.veil;
  ctx.fillRect(0, 0, f.width, f.height);
  const hero = await load(spec.hero);
  const heroH = f.hero.height * f.height;
  const heroW = (heroH * hero.width) / hero.height;
  await drawOverlays(
    ctx,
    [{ image: hero.src, x: f.hero.x * f.width, y: f.hero.y * f.height, width: heroW, angle: 0 }],
    f.width,
  );
  const limits = (part: { maxSize: number; minSize: number; maxLines: number }) => ({
    maxSize: part.maxSize * f.width,
    minSize: part.minSize * f.width,
    maxWidth: f.text.maxWidth * f.width,
    maxHeight: f.height,
    maxLines: part.maxLines,
    lineHeight: STORE_CAPTION.lineHeight,
    glueUpTo: STORE_CAPTION.glueUpTo,
    moreLinesCost: STORE_CAPTION.moreLinesCost,
  });
  const measure = (line: string) => widthAt1(ctx, line);
  const title = fitCaption(f.title.text, measure, limits(f.title));
  const subtitle = fitCaption(f.subtitle.text[spec.lang], measure, limits(f.subtitle));
  if (!title || !subtitle) throw new Error('feature graphic: text does not fit');
  const blockH = (fit: CaptionFit) => fit.lines.length * fit.size * STORE_CAPTION.lineHeight;
  const gap = f.text.gap * f.width;
  const total = blockH(title) + gap + blockH(subtitle);
  const x = f.text.x * f.width;
  const top = f.text.centreY * f.height - total / 2;
  const colors = { fill: STORE_CAPTION.fill, drop: STORE_CAPTION.dropColor };
  drawCaption(ctx, title, x, top + blockH(title) / 2, colors);
  drawCaption(ctx, subtitle, x, top + blockH(title) + gap + blockH(subtitle) / 2, {
    fill: STORE_CAPTION.fill,
    drop: STORE_PLATE.color,
  });
  return { width: f.width, height: f.height, rgba: pixels(ctx), fit: title };
}

/** The picture scaled to `size` square (the Google Play icon from the iOS one). */
async function icon(src: string, size: number): Promise<Composed> {
  const ctx = canvas2d(size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(await load(src), 0, 0, size, size);
  return { width: size, height: size, rgba: pixels(ctx), fit: null };
}

async function fontsReady(): Promise<void> {
  // Latin and Cyrillic live in separate files of the font: load both before measuring. A face that
  // does not load leaves an empty list, not an error, and the captions would get another font.
  for (const sample of ['A', 'Ж']) {
    const faces = await document.fonts.load(font(100), sample);
    if (faces.length === 0 || !document.fonts.check(font(100), sample)) {
      throw new Error(`the caption font did not load (${sample})`);
    }
  }
}

/** The save of the shots as text; built here, where the game modules run as they do in the game. */
function saveText(lang: StoreLang): string {
  return storeSaveText(lang);
}

const api = { ready: fontsReady(), shot, feature, icon, saveText };
export type StoreCompose = typeof api;
(window as Window & { storeCompose?: StoreCompose }).storeCompose = api;
