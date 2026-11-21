import {
  STORE_CAPTION,
  STORE_CREATIVE,
  STORE_FEATURE,
  type StoreCreative,
  type StoreLang,
  type StoreRect,
} from '../../src/data/debug/store-shots';

/**
 * Pure layout of the store shots (no DOM): how a caption breaks into lines and how big it may be,
 * and the wavy top edge of the caption plate. The numbers come from `STORE_CAPTION` and
 * `STORE_PLATE` (`src/data/debug/store-shots.ts`).
 */

export interface CaptionLimits {
  /** Largest and smallest font size, px. */
  maxSize: number;
  minSize: number;
  /** Width and height the text block must fit, px. */
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  /** Line height as a share of the font size. */
  lineHeight: number;
  /** A word this short (a preposition, a conjunction, a number, `&`) never ends a line: it goes with the next word. */
  glueUpTo: number;
  /** Each line past the first counts the size times this, so a second line has to pay for itself. */
  moreLinesCost: number;
}

export interface CaptionFit {
  lines: string[];
  size: number;
}

/** Sizes closer than this count as equal, px. */
const SIZE_EPSILON = 0.5;

/** Words with each short one joined to the word after it (`И ПРОКАЧИВАЙ!`, `12 СПОСОБНОСТЕЙ!`, `& LEVEL`). */
export function glueShortWords(words: readonly string[], upTo: number): string[] {
  const out: string[] = [];
  let carry = '';
  for (const word of words) {
    const joined = carry ? `${carry} ${word}` : word;
    if (word.replace(/[^\p{L}\p{N}&]/gu, '').length <= upTo) carry = joined;
    else {
      out.push(joined);
      carry = '';
    }
  }
  if (carry) {
    if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]!} ${carry}`;
    else out.push(carry);
  }
  return out;
}

/** Every way to cut `words` into `count` lines between words, in order. */
function splits(words: readonly string[], count: number): string[][] {
  if (count === 1) return [[words.join(' ')]];
  const out: string[][] = [];
  for (let cut = 1; cut <= words.length - count + 1; cut++) {
    const head = words.slice(0, cut).join(' ');
    for (const rest of splits(words.slice(cut), count - 1)) out.push([head, ...rest]);
  }
  return out;
}

/**
 * The caption at the largest size that fits: one line, or more lines broken only between words
 * (never inside a word). `widthAt1` is the drawn width of a line at a font size of 1 px (the
 * width grows with the size); a second line has to make it larger by more than `moreLinesCost`
 * takes. A tie keeps fewer lines, then the more even ones. Null when even the smallest size does not fit.
 */
export function fitCaption(
  text: string,
  widthAt1: (line: string) => number,
  limits: CaptionLimits,
): CaptionFit | null {
  const words = glueShortWords(text.trim().split(/\s+/), limits.glueUpTo);
  let best: (CaptionFit & { widest: number; score: number }) | null = null;
  for (let count = 1; count <= Math.min(limits.maxLines, words.length); count++) {
    for (const lines of splits(words, count)) {
      const widest = Math.max(...lines.map(widthAt1));
      const size = Math.min(
        limits.maxSize,
        limits.maxWidth / widest,
        limits.maxHeight / (count * limits.lineHeight),
      );
      if (size < limits.minSize) continue;
      const score = size * limits.moreLinesCost ** (count - 1);
      const bigger = !best || score > best.score + SIZE_EPSILON;
      const evener =
        best !== null &&
        Math.abs(score - best.score) <= SIZE_EPSILON &&
        lines.length === best.lines.length &&
        widest < best.widest;
      if (bigger || evener) best = { lines, size, widest, score };
    }
  }
  return best && { lines: best.lines, size: best.size };
}

export type Rect = StoreRect;
export type Size = Pick<Rect, 'width' | 'height'>;

/** Shadow under the creatures and the hero of the poster, shares of the poster width. */
export const OVERLAY_SHADOW = { color: 'rgba(59, 42, 74, 0.35)', blur: 0.025, drop: 0.01 };

/** The largest rectangle of `aspect` (width / height) inside `box`, centred in it. */
export function fitAspect(aspect: number, box: Rect): Rect {
  const width = Math.min(box.width, box.height * aspect);
  const height = width / aspect;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

/** `box` with `share` of its smaller side taken off every edge. */
export function insetRect(box: Rect, share: number): Rect {
  const pad = Math.min(box.width, box.height) * share;
  return {
    x: box.x + pad,
    y: box.y + pad,
    width: box.width - 2 * pad,
    height: box.height - 2 * pad,
  };
}

/** Whether `inner` lies wholly inside `outer` (a tolerance of `slack` px for rounding). */
export function containsRect(outer: Rect, inner: Rect, slack = 1e-6): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.width <= outer.x + outer.width + slack &&
    inner.y + inner.height <= outer.y + outer.height + slack
  );
}

/**
 * The band of a portrait frame a landscape picture of `aspect` takes for its background: the
 * whole frame width, centred at `centreY` (a share of the frame height), kept inside the frame.
 */
export function backgroundBand(frame: Size, aspect: number, centreY: number): Rect {
  const height = Math.min(frame.height, frame.width / aspect);
  const y = Math.min(Math.max(0, frame.height * centreY - height / 2), frame.height - height);
  return { x: 0, y, width: frame.width, height };
}

/**
 * The poster of the store: a short tower of creatures with the hero on it at the left, the title
 * and the line under it at the right (the Google Play feature graphic, and the inside of the App
 * Store pictures). Every number is a share of the box the poster is laid out in.
 */
export interface PosterSpec {
  /** Centre `x`, the bottom of the lowest creature, the width of each, the step up, the shift of every other one. */
  tower: { x: number; bottom: number; width: number; step: number; shift: number };
  /** The hero's centre is `rise` of the height above the top creature's centre; `height` of the box height. */
  hero: { rise: number; height: number };
  /** The text block centred at `x`, `centreY`; lines fit `maxWidth`; `gap` (of the width) between the two parts. */
  text: { x: number; centreY: number; maxWidth: number; gap: number };
}

export interface PosterText {
  title: CaptionFit;
  subtitle: CaptionFit;
  /** Line height and the drop shadow below the letters, shares of the font size. */
  lineHeight: number;
  drop: number;
}

export interface PosterLayout {
  /** The creatures, bottom first. */
  tower: Rect[];
  hero: Rect;
  /** Room of the title and of the line under it: the widest line allowed, every line and the drop below. */
  title: Rect;
  subtitle: Rect;
}

/** The sizes of the poster's text, shares of the box width (the feature graphic's, or variant B's). */
export interface PosterTextSpec {
  text: { maxWidth: number };
  title: { maxSize: number; minSize: number; maxLines: number };
  subtitle: { maxSize: number; minSize: number; maxLines: number };
}

/**
 * The title of the poster and the line under it in `lang`, fitted to a box of the poster:
 * `widthAt1` is the drawn width of a line at a font size of 1 px.
 */
export function posterText(
  lang: StoreLang,
  box: Size,
  widthAt1: (line: string) => number,
  spec: PosterTextSpec = STORE_FEATURE,
): PosterText {
  const f = STORE_FEATURE;
  const c = STORE_CAPTION;
  const limits = (part: { maxSize: number; minSize: number; maxLines: number }) => ({
    maxSize: part.maxSize * box.width,
    minSize: part.minSize * box.width,
    maxWidth: spec.text.maxWidth * box.width,
    maxHeight: box.height,
    maxLines: part.maxLines,
    lineHeight: c.lineHeight,
    glueUpTo: c.glueUpTo,
    moreLinesCost: c.moreLinesCost,
  });
  const title = fitCaption(f.title.text, widthAt1, limits(spec.title));
  const subtitle = fitCaption(f.subtitle.text[lang], widthAt1, limits(spec.subtitle));
  if (!title || !subtitle) throw new Error('poster: text does not fit');
  return { title, subtitle, lineHeight: c.lineHeight, drop: c.drop };
}

/** Height of a caption block of `fit`. */
export function captionBlockHeight(fit: CaptionFit, lineHeight: number): number {
  return fit.lines.length * fit.size * lineHeight;
}

/** Where every part of the poster goes inside `box`, for pictures of these sizes and this text. */
export function posterLayout(
  box: Rect,
  spec: PosterSpec,
  pictures: { tower: readonly Size[]; hero: Size },
  text: PosterText,
): PosterLayout {
  const t = spec.tower;
  if (pictures.tower.length === 0) throw new Error('poster: no creatures for the tower');
  const tower: Rect[] = [];
  let topCentreY = 0;
  pictures.tower.forEach((picture, i) => {
    const width = t.width * box.width;
    const height = (width * picture.height) / picture.width;
    topCentreY = box.y + (t.bottom - i * t.step) * box.height - height / 2;
    const x = box.x + (t.x + (i % 2 === 0 ? -t.shift : t.shift)) * box.width;
    tower.push({ x: x - width / 2, y: topCentreY - height / 2, width, height });
  });
  const heroH = spec.hero.height * box.height;
  const heroW = (heroH * pictures.hero.width) / pictures.hero.height;
  const heroY = topCentreY - spec.hero.rise * box.height;
  const hero = {
    x: box.x + t.x * box.width - heroW / 2,
    y: heroY - heroH / 2,
    width: heroW,
    height: heroH,
  };
  const titleH = captionBlockHeight(text.title, text.lineHeight);
  const subtitleH = captionBlockHeight(text.subtitle, text.lineHeight);
  const gap = spec.text.gap * box.width;
  const top = box.y + spec.text.centreY * box.height - (titleH + gap + subtitleH) / 2;
  const textW = spec.text.maxWidth * box.width;
  const textX = box.x + spec.text.x * box.width - textW / 2;
  return {
    tower,
    hero,
    title: { x: textX, y: top, width: textW, height: titleH + text.title.size * text.drop },
    subtitle: {
      x: textX,
      y: top + titleH + gap,
      width: textW,
      height: subtitleH + text.subtitle.size * text.drop,
    },
  };
}

/** The bounds of rectangles. */
function boundsOf(rects: readonly Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Everything the poster puts on the picture (without its tower, when `withTower` is false: the
 * hero and the text only): the pictures with their shadow (`OVERLAY_SHADOW`,
 * blurred around them and moved down) and the text with its outline above and below the line
 * box (`outline`, a share of the font size; the drop is in the text rectangles already).
 */
export function posterInk(
  layout: PosterLayout,
  text: PosterText,
  boxWidth: number,
  outline: number,
  withTower = true,
): Rect {
  const blur = OVERLAY_SHADOW.blur * boxWidth;
  const drop = OVERLAY_SHADOW.drop * boxWidth;
  const shadowed = (r: Rect): Rect => {
    const top = Math.max(0, blur - drop);
    return {
      x: r.x - blur,
      y: r.y - top,
      width: r.width + 2 * blur,
      height: r.height + top + blur + drop,
    };
  };
  const outlined = (r: Rect, fit: CaptionFit): Rect => {
    const pad = fit.size * outline;
    return { ...r, y: r.y - pad, height: r.height + 2 * pad };
  };
  return boundsOf([
    ...(withTower ? layout.tower.map(shadowed) : []),
    shadowed(layout.hero),
    outlined(layout.title, text.title),
    outlined(layout.subtitle, text.subtitle),
  ]);
}

/** The box the poster takes in an App Store picture: its safe area less the inset, in the feature graphic's proportions. */
export function creativePosterBox(creative: StoreCreative): Rect {
  return fitAspect(
    STORE_FEATURE.width / STORE_FEATURE.height,
    insetRect(creative.safe, STORE_CREATIVE.inset),
  );
}

export interface WaveSpec {
  /** Width of the shot, px. */
  width: number;
  /** Mean y of the wavy edge, px. */
  top: number;
  amplitude: number;
  /** Length of one wave, px. */
  length: number;
  /** Where the first crest is, a share of a wave. */
  phase: number;
}

/** Points of the wavy edge from the left side to the right, one every `step` px (both ends included). */
export function wavePoints(spec: WaveSpec, step: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const count = Math.max(1, Math.ceil(spec.width / step));
  for (let i = 0; i <= count; i++) {
    const x = (spec.width * i) / count;
    const turn = (x / spec.length - spec.phase) * Math.PI * 2;
    points.push({ x, y: spec.top - spec.amplitude * Math.cos(turn) });
  }
  return points;
}
