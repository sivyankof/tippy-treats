import {
  STORE_CAPTION,
  STORE_CREATIVE,
  STORE_FEATURE,
  type StoreCreative,
  type StoreLang,
} from '../../src/data/debug/store-shots';
import {
  OVERLAY_SHADOW,
  captionBlockHeight,
  fitCaption,
  insetRect,
  type CaptionFit,
  type PosterText,
  type Rect,
  type Size,
} from './layout';

/**
 * Variant C of the App Store pictures (pure, no DOM): the hero's drawn part as tall as the safe
 * area takes with its shadow, at the left, and the largest title that fits the width left at the
 * right. The tower and the scene around are laid out by `creative-layout.ts`.
 */

const C = STORE_CREATIVE.c;

/** The box variant C lays its poster in: the safe area less its small inset. */
export function boxC(c: StoreCreative): Rect {
  return insetRect(c.safe, C.inset);
}

/** How far the poster's shadow (`OVERLAY_SHADOW`) reaches past a picture, px. */
export function shadowReach(boxWidth: number): { side: number; top: number; bottom: number } {
  const blur = OVERLAY_SHADOW.blur * boxWidth;
  const drop = OVERLAY_SHADOW.drop * boxWidth;
  return { side: blur, top: Math.max(0, blur - drop), bottom: blur + drop };
}

/**
 * The hero of variant C: `rect` is where its render goes (with the empty margin), `ink` its drawn
 * part, which with the shadow fills the box from top to bottom at its left edge. The render is
 * never drawn larger than it is.
 */
export function heroC(c: StoreCreative, hero: Size): { rect: Rect; ink: Rect } {
  const box = boxC(c);
  const s = shadowReach(box.width);
  const ink = C.hero.ink;
  const inkShare = { h: ink.height / C.hero.height, w: ink.width / C.hero.width };
  const room = box.height - s.top - s.bottom;
  const height = Math.min(room / inkShare.h, hero.height);
  const width = (height * hero.width) / hero.height;
  const inkH = height * inkShare.h;
  const inkW = width * inkShare.w;
  const inkX = box.x + s.side;
  const inkY = box.y + s.top + (room - inkH) / 2;
  return {
    rect: {
      x: inkX - (ink.x / C.hero.width) * width,
      y: inkY - (ink.y / C.hero.height) * height,
      width,
      height,
    },
    ink: { x: inkX, y: inkY, width: inkW, height: inkH },
  };
}

/** The room of the text: right of the hero's shadow and the gap, to the box's right edge. */
export function textRoomC(c: StoreCreative, hero: Size): Rect {
  const box = boxC(c);
  const { ink } = heroC(c, hero);
  const x = ink.x + ink.width + shadowReach(box.width).side + C.textGap * box.width;
  return { x, y: box.y, width: box.x + box.width - x, height: box.height };
}

/** The gap between the title and the line under it, px. */
export function lineGapC(title: CaptionFit): number {
  return C.lineGap * title.size;
}

/** Height of the text with the outline above and below and the drop under the line: what must fit the room. */
export function textInkHeight(text: PosterText): number {
  const o = STORE_CAPTION.outlineWidth;
  return (
    o * text.title.size +
    captionBlockHeight(text.title, text.lineHeight) +
    lineGapC(text.title) +
    captionBlockHeight(text.subtitle, text.lineHeight) +
    (text.drop + o) * text.subtitle.size
  );
}

/** Steps of the search for the largest title. */
const SEARCH_STEPS = 40;

/**
 * The largest title (with the line under it at `subtitle.ratio` of its size at most) whose two
 * parts fit the room's width and, together, its height.
 */
export function creativeTextC(
  c: StoreCreative,
  lang: StoreLang,
  widthAt1: (line: string) => number,
  hero: Size,
): PosterText {
  const room = textRoomC(c, hero);
  const box = boxC(c);
  const cap = STORE_CAPTION;
  const limits = (maxSize: number, minSize: number, maxLines: number) => ({
    maxSize,
    minSize,
    maxWidth: room.width,
    maxHeight: room.height,
    maxLines,
    lineHeight: cap.lineHeight,
    glueUpTo: cap.glueUpTo,
    moreLinesCost: cap.moreLinesCost,
  });
  const fit = (titleMax: number): PosterText | null => {
    const title = fitCaption(
      STORE_FEATURE.title.text,
      widthAt1,
      limits(titleMax, C.title.minSize * box.width, C.title.maxLines),
    );
    if (!title) return null;
    const subtitle = fitCaption(
      STORE_FEATURE.subtitle.text[lang],
      widthAt1,
      limits(C.subtitle.ratio * title.size, C.subtitle.minSize * box.width, C.subtitle.maxLines),
    );
    if (!subtitle) return null;
    return { title, subtitle, lineHeight: cap.lineHeight, drop: cap.drop };
  };
  const fits = (t: PosterText | null): t is PosterText =>
    t !== null && textInkHeight(t) <= room.height;
  let lo = C.title.minSize * box.width;
  let hi = room.height;
  let best = fit(lo);
  if (!fits(best)) throw new Error(`${c.id} c: the text does not fit`);
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const t = fit(mid);
    if (fits(t)) {
      best = t;
      lo = mid;
    } else hi = mid;
  }
  return best;
}

/** The title and the line under it in the room, the block centred in its height. */
export function textRectsC(
  c: StoreCreative,
  hero: Size,
  text: PosterText,
): { title: Rect; subtitle: Rect } {
  const room = textRoomC(c, hero);
  const o = STORE_CAPTION.outlineWidth;
  const titleH = captionBlockHeight(text.title, text.lineHeight);
  const subtitleH = captionBlockHeight(text.subtitle, text.lineHeight);
  const top = room.y + (room.height - textInkHeight(text)) / 2 + o * text.title.size;
  return {
    title: {
      x: room.x,
      y: top,
      width: room.width,
      height: titleH + text.title.size * text.drop,
    },
    subtitle: {
      x: room.x,
      y: top + titleH + lineGapC(text.title),
      width: room.width,
      height: subtitleH + text.subtitle.size * text.drop,
    },
  };
}
