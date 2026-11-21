import '../../src/style.css';
import {
  STORE_CAPTION,
  STORE_CREATIVE,
  STORE_CREATIVES,
  STORE_FEATURE,
  STORE_PLATE,
  type StoreCreativeId,
  type StoreLang,
  type StoreVariant,
} from '../../src/data/debug/store-shots';
import {
  backgroundBand,
  containsRect,
  fitCaption,
  posterInk,
  posterLayout,
  posterText,
  wavePoints,
  type CaptionFit,
  type PosterLayout,
  type PosterText,
  type Rect,
} from './layout';
import { storeSaveText } from './store-save';
import {
  canvas2d,
  drawCaption,
  drawOverlays,
  drawPosterText,
  font,
  load,
  widthAt1,
  type ComposeOverlay,
} from './canvas-draw';
import { creativeLayout, posterTextBox } from './creative-layout';
import { drawScene } from './creative-scene';

export type { ComposeOverlay };

/**
 * The page that lays out the store pictures (`compose.html`, opened by `store-shots.ts` from the
 * dev server): every call takes data URLs, draws on a canvas and gives the pixels back as base64
 * RGBA, which the script writes as PNG without alpha.
 */

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

export interface CreativeSpec {
  id: StoreCreativeId;
  variant: StoreVariant;
  lang: StoreLang;
  hero: string;
  /** The game's pictures of `creativeCreatures(id, variant)`, in its order. */
  creatures: string[];
}

/** The picture itself, the safe area alone (1:1) and the whole picture made small. */
export type CreativePart = 'main' | 'safe' | 'full';

/** An App Store picture is read with `rows` afterwards: its pixels are too many for one answer. */
export interface CreativeResult {
  parts: Record<CreativePart, { width: number; height: number }>;
  /** Where the hero and the text went (all the poster in variant A) with shadows and outlines, for the report. */
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
  drawPosterText(ctx, layout, text);
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

/** The canvases of the last App Store picture, read row by row (`rows`): they are too big for one call. */
const lastCreative: Partial<Record<CreativePart, CanvasRenderingContext2D>> = {};

/** A part of `source` (`area`, scaled to `width` x `height`) on a canvas of its own. */
function copyOf(
  source: HTMLCanvasElement,
  area: Rect,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const ctx = canvas2d(width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return ctx;
}

/**
 * An App Store picture (`STORE_CREATIVES`) in a variant: the poster in the safe area, the
 * Showcase and the decor around it; then the check pictures of the safe area alone and of the
 * whole picture made small. Fails when the hero or the text leaves the safe area (in variant A,
 * any part of the poster).
 */
async function creative(spec: CreativeSpec): Promise<CreativeResult> {
  const c = STORE_CREATIVES.find((x) => x.id === spec.id);
  if (!c) throw new Error(`no App Store picture ${spec.id}`);
  const ctx = canvas2d(c.width, c.height);
  const hero = await load(spec.hero);
  // Plain sizes: the layout copies them, and an image keeps its size in getters.
  const pictures = (await Promise.all(spec.creatures.map(load))).map((p) => ({
    width: p.naturalWidth,
    height: p.naturalHeight,
  }));
  const { box, spec: textSpec } = posterTextBox(c, spec.variant);
  const text = posterText(spec.lang, box, (line) => widthAt1(ctx, line), textSpec);
  const heroSize = { width: hero.naturalWidth, height: hero.naturalHeight };
  const layout = creativeLayout(c, spec.variant, pictures, heroSize, text);
  const outline = STORE_CAPTION.outlineWidth;
  const bounds = posterInk(layout.poster, text, box.width, outline, spec.variant === 'a');
  if (!containsRect(c.safe, bounds)) {
    throw new Error(
      `${c.id} ${spec.variant}: the poster leaves the safe area (${JSON.stringify(bounds)})`,
    );
  }
  await drawScene(
    ctx,
    c,
    layout,
    { creatures: spec.creatures, hero: spec.hero, shadowUnit: box.width },
    () => drawPosterText(ctx, layout.poster, text),
  );
  const previewW = STORE_CREATIVE.previewWidth;
  const previewH = Math.round((previewW * c.height) / c.width);
  const whole = { x: 0, y: 0, width: c.width, height: c.height };
  lastCreative.main = ctx;
  lastCreative.safe = copyOf(ctx.canvas, c.safe, c.safe.width, c.safe.height);
  lastCreative.full = copyOf(ctx.canvas, whole, previewW, previewH);
  const size = (part: CreativePart) => {
    const canvas = lastCreative[part]!.canvas;
    return { width: canvas.width, height: canvas.height };
  };
  return {
    parts: { main: size('main'), safe: size('safe'), full: size('full') },
    bounds,
    title: text.title,
    subtitle: text.subtitle,
  };
}

/** Rows `from` to `from + count` of a part of the last App Store picture as base64 RGBA. */
function rows(part: CreativePart, from: number, count: number): string {
  const ctx = lastCreative[part];
  if (!ctx) throw new Error('no App Store picture to read');
  const { width, height } = ctx.canvas;
  return pixels(ctx, { x: 0, y: from, width, height: Math.min(count, height - from) });
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
