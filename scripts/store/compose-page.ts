import '../../src/style.css';
import { FONT_FAMILY } from '../../src/game/ui/common/fonts';
import {
  STORE_CAPTION,
  STORE_CREATIVE,
  STORE_CREATIVES,
  STORE_FEATURE,
  STORE_PLATE,
  type StoreCreativeId,
  type StoreLang,
} from '../../src/data/debug/store-shots';
import {
  backgroundBand,
  captionBlockHeight,
  containsRect,
  creativePosterBox,
  fitCaption,
  posterInk,
  OVERLAY_SHADOW,
  posterLayout,
  posterText,
  wavePoints,
  type CaptionFit,
  type PosterLayout,
  type PosterText,
  type Rect,
} from './layout';
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

/** The pictures and the language of the poster (the tower, the hero, the text). */
export interface PosterArt {
  hero: string;
  /** The creatures of `STORE_FEATURE.tower`, bottom first, as the game drew them. */
  tower: string[];
  lang: StoreLang;
}

export interface FeatureSpec extends PosterArt {
  frame: string;
}

export interface CreativeSpec extends PosterArt {
  id: StoreCreativeId;
  frame: string;
}

/** An App Store picture is read with `rows` afterwards: its pixels are too many for one answer. */
export interface CreativeResult {
  width: number;
  height: number;
  /** Where the poster went with its shadows and outlines (it lies inside the safe area), for the report. */
  bounds: Rect;
  title: CaptionFit;
  subtitle: CaptionFit;
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

function pixels(
  ctx: CanvasRenderingContext2D,
  area: Rect = { x: 0, y: 0, width: ctx.canvas.width, height: ctx.canvas.height },
): string {
  const data = ctx.getImageData(area.x, area.y, area.width, area.height).data;
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

/**
 * The poster of `STORE_FEATURE` (the tower of creatures with the hero on it, the title and the
 * line under it) inside `box`; returns where its parts went.
 */
async function drawPoster(
  ctx: CanvasRenderingContext2D,
  box: Rect,
  spec: PosterArt,
): Promise<{ layout: PosterLayout; text: PosterText }> {
  const tower = await Promise.all(spec.tower.map(load));
  const hero = await load(spec.hero);
  const text = posterText(spec.lang, box, (line) => widthAt1(ctx, line));
  const layout = posterLayout(box, STORE_FEATURE, { tower, hero }, text);
  const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width });
  const layers: ComposeOverlay[] = [
    ...layout.tower.map((r, i) => ({ image: spec.tower[i] ?? '', ...centre(r), angle: 0 })),
    { image: spec.hero, ...centre(layout.hero), angle: 0 },
  ];
  await drawOverlays(ctx, layers, box.width);
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
  return { layout, text };
}

async function feature(spec: FeatureSpec): Promise<Composed> {
  const f = STORE_FEATURE;
  const ctx = canvas2d(f.width, f.height);
  const frame = await load(spec.frame);
  const band = backgroundBand(frame, f.width / f.height, f.background.centreY);
  ctx.drawImage(frame, band.x, band.y, band.width, band.height, 0, 0, f.width, f.height);
  const { text } = await drawPoster(ctx, { x: 0, y: 0, width: f.width, height: f.height }, spec);
  return { width: f.width, height: f.height, rgba: pixels(ctx), fit: text.title };
}

/**
 * The background of an App Store picture: the band of the frame over the whole picture, out of
 * focus. The blurred copy goes over a sharp one a little larger than the picture, so its edges,
 * where the blur thins out, still lie on opaque pixels.
 */
function drawSoftBackground(
  ctx: CanvasRenderingContext2D,
  frame: HTMLImageElement,
  width: number,
  height: number,
): void {
  const bg = STORE_CREATIVE.background;
  const band = backgroundBand(frame, width / height, bg.centreY, bg.bottom);
  const blur = bg.blur * width;
  // Room for the blur at the edges, the same share of both sides, so the band keeps its proportions.
  const bleedY = blur * 3;
  const bleedX = (bleedY * width) / height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const draw = () =>
    ctx.drawImage(
      frame,
      band.x,
      band.y,
      band.width,
      band.height,
      -bleedX,
      -bleedY,
      width + 2 * bleedX,
      height + 2 * bleedY,
    );
  draw();
  ctx.save();
  ctx.filter = `blur(${String(blur)}px)`;
  draw();
  ctx.restore();
}

/** The canvas of the last App Store picture, read row by row (`rows`): it is too big for one call. */
let lastCreative: CanvasRenderingContext2D | null = null;

/** The poster inside the art safe area of an App Store picture (`STORE_CREATIVES`), the street behind it. */
async function creative(spec: CreativeSpec): Promise<CreativeResult> {
  const c = STORE_CREATIVES.find((x) => x.id === spec.id);
  if (!c) throw new Error(`no App Store picture ${spec.id}`);
  const ctx = canvas2d(c.width, c.height);
  drawSoftBackground(ctx, await load(spec.frame), c.width, c.height);
  const box = creativePosterBox(c);
  const { layout, text } = await drawPoster(ctx, box, spec);
  const bounds = posterInk(layout, text, box.width, STORE_CAPTION.outlineWidth);
  if (!containsRect(c.safe, bounds)) {
    throw new Error(`${c.id}: the poster leaves the safe area (${JSON.stringify(bounds)})`);
  }
  lastCreative = ctx;
  return {
    width: c.width,
    height: c.height,
    bounds,
    title: text.title,
    subtitle: text.subtitle,
  };
}

/** Rows `from` to `from + count` of the last App Store picture as base64 RGBA. */
function rows(from: number, count: number): string {
  if (!lastCreative) throw new Error('no App Store picture to read');
  const { width, height } = lastCreative.canvas;
  return pixels(lastCreative, { x: 0, y: from, width, height: Math.min(count, height - from) });
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

const api = { ready: fontsReady(), shot, feature, creative, rows, icon, saveText };
export type StoreCompose = typeof api;
(window as Window & { storeCompose?: StoreCompose }).storeCompose = api;
