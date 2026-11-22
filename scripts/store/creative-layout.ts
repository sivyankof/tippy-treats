import { Rng, hashString } from '../../src/core/common/rng';
import { BALANCE } from '../../src/data/tower/balance';
import {
  STORE_CREATIVE,
  STORE_FEATURE,
  type StoreCreative,
  type StoreDecorCreature,
  type StoreLang,
  type StoreVariant,
} from '../../src/data/debug/store-shots';
import {
  captionBlockHeight,
  creativePosterBox,
  insetRect,
  posterLayout,
  posterText,
  type PosterLayout,
  type PosterText,
  type PosterTextSpec,
  type Rect,
  type Size,
} from './layout';
import { boxC, creativeTextC, heroC, textRectsC } from './creative-c';

/**
 * Pure layout of the App Store pictures (no DOM): where the game's background pictures, the
 * poster and the decor go for a picture and a variant. The numbers live in `STORE_CREATIVE`
 * (`src/data/debug/store-shots.ts`); the compose page draws what this lays out.
 */

const CR = STORE_CREATIVE;

export type DecorRole = 'poster' | 'stack' | 'flyer' | 'near';

/** A creature the game draws for a picture, `width` px wide. */
export interface PlannedCreature extends StoreDecorCreature {
  role: DecorRole;
  /** Width on the picture. */
  width: number;
  /** Width the game draws it at: `width`, or less for a picture enlarged on the compose page. */
  artWidth: number;
  level: number;
  /** The grown look of mastery (only where the poster of the feature graphic has it). */
  grown: boolean;
}

/** The poster's two creatures, as the feature graphic has them (Rainbow under Puff). */
const POSTER_TOP = STORE_FEATURE.tower.creatures;

/** A decor creature at the decor's level, in its usual look. */
const decor = (p: StoreDecorCreature) => ({ ...p, level: CR.level, grown: false });

/** A creature picture in place: the rectangle before the turn, the turn in degrees, the blur in px. */
export interface PlacedCreature {
  /** Index in the list of `creativeCreatures`. */
  art: number;
  role: DecorRole;
  rect: Rect;
  angle: number;
  blur: number;
  /** The game's picture is enlarged to `rect` (high-quality smoothing). */
  enlarged?: boolean;
}

export type ScatterKind = 'coin' | 'berry' | 'sprinkle';

export interface ScatterItem {
  kind: ScatterKind;
  rect: Rect;
  angle: number;
  /** Index of the sprinkle colour; 0 for coins and berries. */
  tone: number;
}

/** Where the game's background pictures go, in px of the picture. */
export interface Backdrop {
  /** Picture px per px of the game. */
  scale: number;
  /** Bottom of the awning's scallops. */
  awningBottom: number;
  /** Top of the garland wire picture. */
  garlandTop: number;
  /** The garland goes over the awning (variant C), not behind its scallops. */
  garlandOver: boolean;
  /** Top of the band of each shelf with treats (bottom first) and the shelf line in it. */
  shelves: Array<{ top: number; shelfTop: number }>;
}

/** A jar of sweets on the lowest shelf: the picture with its room, and which jar. */
export interface PlacedJar {
  jar: number;
  rect: Rect;
}

export interface CreativeLayout {
  backdrop: Backdrop;
  jars: PlacedJar[];
  /** The poster: its tower (the poster's creatures), the hero, the title and the line under it. */
  poster: PosterLayout;
  /** Every creature picture, back to front, the poster's included. */
  creatures: PlacedCreature[];
  scatter: ScatterItem[];
}

/** Picture px per px of the game for the background pictures (variant C draws them larger). */
export function backdropScale(creative: StoreCreative, variant: StoreVariant): number {
  return creative.width / (variant === 'c' ? CR.c.sceneWidth : CR.sceneWidth);
}

/** The widest a creature from the game may be drawn and stay sharp. */
export const SHARP_WIDTH = CR.sharpScale * CR.artLayerWidth;

/** The width of the gap at the side of the safe area (the pictures are symmetric about it). */
function sideGap(c: StoreCreative): number {
  return Math.min(c.safe.x, c.width - c.safe.x - c.safe.width);
}

/** The box variant B lays its poster in: the safe area less the inset. */
function boxB(c: StoreCreative): Rect {
  return insetRect(c.safe, CR.inset);
}

/**
 * Height of a creature picture of `width` before its real picture is known: the game's are about
 * 0.62 of the width; the tower of variant B counts with flatter ones, so it reaches the bottom edge
 * whatever they are (a creature more goes off the picture).
 */
const FLATTEST_ASPECT = 0.5;

/** Width of the tower creatures of variant B. */
function widthB(c: StoreCreative): number {
  return Math.round(Math.min(CR.b.width * boxB(c).height, SHARP_WIDTH));
}

/** The hero of variant B: its height and the centre of the top creature it stands on. */
function heroB(c: StoreCreative, hero: Size): { rect: Rect; topCentreY: number } {
  const box = boxB(c);
  const height = CR.b.hero.height * box.height;
  const width = (height * hero.width) / hero.height;
  const x = box.x + CR.b.towerX * box.width;
  const top = box.y + CR.b.hero.top * box.height;
  const rect = { x: x - width / 2, y: top, width, height };
  return { rect, topCentreY: top + height - CR.b.hero.sink * height };
}

/**
 * How far up the next creature of a tower stands, px: as in the game's tower, the bottoms of the
 * pictures are one layer height apart (every picture keeps the same room for the shadow under the
 * layer), so the bodies touch and the detail above a body goes behind the one above it.
 */
function layerStep(width: number): number {
  return BALANCE.layer.height * (width / CR.artLayerWidth);
}

/** The hero render as variant C counts with it (the compose page checks the real one against it). */
const HERO_C: Size = { width: CR.c.hero.width, height: CR.c.hero.height };

/** How many times the hero's drawn part variant C's tower is as wide in a picture where it is enlarged, else null. */
function enlargedC(c: StoreCreative): number | null {
  return CR.c.towerEnlarged[c.id] ?? null;
}

/**
 * Width of the tower creatures of variant C: as wide as the hero's drawn part asks, while they
 * stay sharp; as wide as `towerEnlarged` asks where they are enlarged.
 */
function widthC(c: StoreCreative): number {
  const ink = heroC(c, HERO_C).ink.width;
  const enlarged = enlargedC(c);
  if (enlarged !== null) return Math.round(enlarged * ink);
  return Math.round(Math.min(CR.c.towerWidth * ink, SHARP_WIDTH));
}

/** The centre of the top creature of variant C's tower: under the hero, as in B. */
function topCentreC(c: StoreCreative, hero: Size): number {
  const { rect } = heroC(c, hero);
  return rect.y + rect.height - CR.c.heroSink * rect.height;
}

/** The creatures of a tower that goes below the bottom edge (B, C), bottom first: as many as reach past it. */
function towerDown(
  c: StoreCreative,
  w: number,
  topCentreY: number,
): Array<StoreDecorCreature & { level: number; grown: boolean }> {
  const h = w * FLATTEST_ASPECT;
  let bottom = topCentreY + h / 2 + (POSTER_TOP.length - 1) * layerStep(w);
  const below: StoreDecorCreature[] = [];
  for (let i = 0; bottom < c.height; i++) {
    const next = CR.b.below[i % CR.b.below.length];
    if (!next) break;
    below.push(next);
    bottom += layerStep(w);
  }
  return [...below.reverse().map(decor), ...POSTER_TOP];
}

/** Width of the poster's tower creatures in a variant. */
function posterCreatureWidth(c: StoreCreative, variant: StoreVariant): number {
  if (variant === 'a') return Math.round(STORE_FEATURE.tower.width * creativePosterBox(c).width);
  return variant === 'b' ? widthB(c) : widthC(c);
}

/** The poster's creatures in a variant, bottom first. */
function posterCreatures(c: StoreCreative, variant: StoreVariant) {
  if (variant === 'a') return POSTER_TOP;
  return variant === 'b'
    ? towerDown(c, widthB(c), heroB(c, { width: 1, height: 1 }).topCentreY)
    : towerDown(c, widthC(c), topCentreC(c, HERO_C));
}

/** Width of the side towers' creatures: C's are larger than a game picture stays sharp (and out of focus). */
function stackWidth(c: StoreCreative, variant: StoreVariant): number {
  const b = Math.min(CR.stacks.width * sideGap(c), SHARP_WIDTH);
  return Math.round(variant === 'c' ? CR.c.stacks.scale * b : b);
}

/** Every creature the game draws for a picture of a variant, in the order `creativeLayout` takes their sizes. */
export function creativeCreatures(c: StoreCreative, variant: StoreVariant): PlannedCreature[] {
  const posterWidth = posterCreatureWidth(c, variant);
  const posterArt = variant === 'c' && enlargedC(c) !== null ? CR.artLayerWidth : posterWidth;
  const sideWidth = stackWidth(c, variant);
  const near = variant === 'c' ? [] : CR.near;
  const flyers = variant === 'c' && !CR.c.flyer ? [] : [CR.flyer];
  return [
    ...posterCreatures(c, variant).map((p) => ({
      ...p,
      role: 'poster' as const,
      width: posterWidth,
      artWidth: posterArt,
    })),
    ...[...CR.stacks.left, ...CR.stacks.right].map((p) => ({
      ...decor(p),
      role: 'stack' as const,
      width: sideWidth,
      artWidth: sideWidth,
    })),
    ...flyers.map((f) => ({
      ...decor({ creature: f.creature, face: f.face }),
      role: 'flyer' as const,
      width: posterWidth,
      artWidth: posterWidth,
    })),
    ...near.map((n) => ({
      ...decor({ creature: n.creature, face: n.face }),
      role: 'near' as const,
      width: Math.round(n.width * c.height),
      artWidth: Math.round(n.width * c.height),
    })),
  ];
}

function backdropOf(c: StoreCreative, variant: StoreVariant): Backdrop {
  const k = backdropScale(c, variant);
  const bd = CR.backdrop;
  const awningBottom = bd.awningRows[1] * k;
  const band = (bd.treatsRows[1] - bd.treatsRows[0]) * k;
  const shelfIn = (bd.shelfTop - bd.treatsRows[0]) * k;
  const lowest = c.height * (1 - bd.bottomGap) - band;
  const clearY = c.safe.y + c.safe.height + bd.shelfClear * c.height;
  const shelves: Backdrop['shelves'] = [];
  for (let top = lowest; shelves.length === 0 || top >= clearY; top -= band * bd.shelfSpacing) {
    shelves.push({ top, shelfTop: top + shelfIn });
  }
  // The garland hangs under the awning, but never into the safe area: on a low picture its ends go
  // up behind the awning's scallops.
  const garlandTop = Math.min(
    awningBottom + bd.garlandGap * c.height,
    c.safe.y - bd.garlandClear * c.height - bd.garlandDepth * k,
  );
  const garlandOver = variant === 'c' && CR.c.garlandOverAwning;
  return { scale: k, awningBottom, garlandTop, garlandOver, shelves };
}

/**
 * The jars on the lowest shelf at each side: in a row from the safe area outwards, at most `most`
 * a side, as many as stand clear of the side tower (`towerEdge`: how far the towers reach in from
 * the outer edges).
 */
function jarsOf(
  c: StoreCreative,
  backdrop: Backdrop,
  towerEdge: number,
  row: { most: number; first: number },
): PlacedJar[] {
  const J = CR.jars;
  const k = backdrop.scale;
  const size = { width: (J.width + 2 * J.pad) * k, height: (J.height + 2 * J.pad) * k };
  const shelf = backdrop.shelves[0]?.shelfTop ?? c.height;
  const gap = sideGap(c);
  const jars: PlacedJar[] = [];
  for (let n = 0; n < row.most; n++) {
    // The distance of the jar's centre from the outer edge.
    const from = gap - size.width * (row.first + n * J.spacing);
    if (from - size.width / 2 < towerEdge) break;
    for (const side of [0, 1]) {
      const x = side === 0 ? from : c.width - from;
      jars.push({ jar: n * 2 + side, rect: standing(size, x, shelf + J.pad * k) });
    }
  }
  return jars;
}

/** How far down the awning and the garland reach, px. */
function garlandBottom(backdrop: Backdrop): number {
  return Math.max(
    backdrop.awningBottom,
    backdrop.garlandTop + CR.backdrop.garlandDepth * backdrop.scale,
  );
}

/** A rectangle of `size` with its bottom centre at (`x`, `bottom`). */
function standing(size: Size, x: number, bottom: number): Rect {
  return { x: x - size.width / 2, y: bottom - size.height, width: size.width, height: size.height };
}

/** The four corners of `rect` turned by `angle` degrees about its centre, as their bounds. */
export function turnedBounds(rect: Rect, angle: number): Rect {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rad = (angle * Math.PI) / 180;
  const w = Math.abs(rect.width * Math.cos(rad)) + Math.abs(rect.height * Math.sin(rad));
  const h = Math.abs(rect.width * Math.sin(rad)) + Math.abs(rect.height * Math.cos(rad));
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + 2 * by, height: r.height + 2 * by };
}

/** A tower under the hero (B, C), bottom first: the top one centred at `topCentreY`, each next one a layer lower. */
function towerUnder(sizes: readonly Size[], x: number, topCentreY: number): Rect[] {
  const tower: Rect[] = [];
  let bottom = 0;
  for (let i = sizes.length - 1; i >= 0; i--) {
    const size = sizes[i]!;
    const shift = (i % 2 === 0 ? -1 : 1) * CR.b.shift * size.width;
    bottom = i === sizes.length - 1 ? topCentreY + size.height / 2 : bottom + layerStep(size.width);
    tower[i] = standing(size, x + shift, bottom);
  }
  return tower;
}

/** The poster of variant C: the hero's drawn part as tall as the safe area takes, the title right of it. */
function posterC(
  c: StoreCreative,
  sizes: readonly Size[],
  hero: Size,
  text: PosterText,
): PosterLayout {
  const { rect, ink } = heroC(c, hero);
  const tower = towerUnder(sizes, ink.x + ink.width / 2, topCentreC(c, hero));
  return { tower, hero: rect, heroInk: ink, ...textRectsC(c, hero, text) };
}

/** The poster of variant B: the tower on which the hero stands, going on below the bottom edge. */
function posterB(
  c: StoreCreative,
  sizes: readonly Size[],
  hero: Size,
  text: PosterText,
): PosterLayout {
  const box = boxB(c);
  const { rect: heroRect, topCentreY } = heroB(c, hero);
  const tower = towerUnder(sizes, box.x + CR.b.towerX * box.width, topCentreY);
  const t = CR.b.text;
  const titleH = captionBlockHeight(text.title, text.lineHeight);
  const subtitleH = captionBlockHeight(text.subtitle, text.lineHeight);
  const gap = t.gap * box.width;
  const top = box.y + t.centreY * box.height - (titleH + gap + subtitleH) / 2;
  const textW = t.maxWidth * box.width;
  // The text stays right of the hero's picture whatever the box: a narrow box moves it right.
  const textX = Math.max(box.x + t.x * box.width - textW / 2, heroRect.x + heroRect.width);
  return {
    tower,
    hero: heroRect,
    title: { x: textX, y: top, width: textW, height: titleH + text.title.size * text.drop },
    subtitle: {
      x: textX,
      y: top + titleH + gap,
      width: textW,
      height: subtitleH + text.subtitle.size * text.drop,
    },
  };
}

/** The box and the text shares the poster's text is fitted to in variants A and B. */
function posterTextBox(c: StoreCreative, variant: 'a' | 'b'): { box: Rect; spec: PosterTextSpec } {
  return variant === 'a'
    ? { box: creativePosterBox(c), spec: STORE_FEATURE }
    : { box: boxB(c), spec: CR.b };
}

/** The box the poster of a variant is laid out in: its width is the unit of the poster's shadow. */
export function creativeBox(c: StoreCreative, variant: StoreVariant): Rect {
  return variant === 'c' ? boxC(c) : posterTextBox(c, variant).box;
}

/** The poster's title and the line under it in `lang`, fitted to the poster of a variant. */
export function creativeText(
  c: StoreCreative,
  variant: StoreVariant,
  lang: StoreLang,
  widthAt1: (line: string) => number,
  hero: Size,
): PosterText {
  if (variant === 'c') return creativeTextC(c, lang, widthAt1, hero);
  const { box, spec } = posterTextBox(c, variant);
  return posterText(lang, box, widthAt1, spec);
}

/**
 * A short tower of the decor at one side: on the lowest shelf (A, B), or in front of it, nearer,
 * larger and out of focus, its lowest one going off the bottom edge (C).
 */
function stack(
  c: StoreCreative,
  variant: StoreVariant,
  side: 'left' | 'right',
  sizes: readonly Size[],
  shelfTop: number,
  first: number,
): PlacedCreature[] {
  const s = CR.stacks;
  const near = variant === 'c' ? CR.c.stacks : null;
  const out = side === 'left' ? -1 : 1;
  const w = sizes[0]?.width ?? 0;
  const edge = near ? near.edge : s.edge;
  const x0 = side === 'left' ? edge * w : c.width - edge * w;
  const blur = near ? near.blur * c.width : 0;
  const placed: PlacedCreature[] = [];
  const lowest = sizes[0]?.height ?? 0;
  // The lowest one's shadow hangs over the shelf (in C its centre is low on the picture); each
  // next one stands a layer higher.
  let bottom = near ? near.base * c.height + lowest / 2 : shelfTop + s.sink * lowest;
  sizes.forEach((size, i) => {
    if (i > 0) bottom -= layerStep(sizes[i - 1]!.width);
    // Leaning out: every one a little further out than the one below.
    const x = x0 + out * i * Math.sin((s.lean * Math.PI) / 180) * size.height;
    placed.push({
      art: first + i,
      role: 'stack',
      rect: standing(size, x, bottom),
      angle: out * s.lean * i,
      blur,
    });
  });
  return placed;
}

/**
 * Coins, berries and sprinkles outside the safe area and off every creature, from the seeded
 * stream: the same picture every run.
 */
function scatter(c: StoreCreative, variant: StoreVariant, avoid: readonly Rect[]): ScatterItem[] {
  const sc = CR.scatter;
  const few = variant === 'c' ? CR.c.scatter : null;
  const rng = new Rng(hashString(`${sc.seed}:${c.id}`));
  const room = (c.width * c.height - c.safe.width * c.safe.height) / 1e6;
  const safe = grow(c.safe, sc.clear * c.height);
  const items: ScatterItem[] = [];
  const kinds: ScatterKind[] = ['coin', 'berry', 'sprinkle'];
  for (const kind of kinds) {
    const count = few ? few.count[kind] : Math.round(sc.perMegapixel[kind] * room);
    const size = (few ? few.size : sc.size)[kind] * c.height;
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < sc.tries; attempt++) {
        const x = rng.range(0, c.width - size);
        const y = rng.range(0, c.height - size);
        const rect = { x, y, width: size, height: kind === 'sprinkle' ? size * 0.42 : size };
        const angle = rng.range(-35, 35) + (kind === 'sprinkle' ? rng.range(0, 180) : 0);
        const reach = turnedBounds(rect, angle);
        const clash =
          intersects(reach, safe) ||
          avoid.some((r) => intersects(reach, r)) ||
          items.some((o) => {
            const d = Math.hypot(
              o.rect.x + o.rect.width / 2 - (x + size / 2),
              o.rect.y + o.rect.height / 2 - (y + rect.height / 2),
            );
            return d < (sc.spacing * (o.rect.width + size)) / 2;
          });
        if (clash) continue;
        items.push({ kind, rect, angle, tone: kind === 'sprinkle' ? rng.int(0, 4) : 0 });
        break;
      }
    }
  }
  return items;
}

/**
 * The whole picture: `sizes` are the real sizes of `creativeCreatures(c, variant)` as the game
 * drew them (at `artWidth`; one drawn smaller is laid out enlarged to `width`), `hero` the hero render's, `text` the poster's text (`creativeText`).
 */
export function creativeLayout(
  c: StoreCreative,
  variant: StoreVariant,
  drawn: readonly Size[],
  hero: Size,
  text: PosterText,
): CreativeLayout {
  const plan = creativeCreatures(c, variant);
  if (drawn.length !== plan.length) throw new Error('creativeLayout: wrong number of creatures');
  // A picture the game drew smaller than it is shown is laid out at its shown width; every other
  // one at the size the game drew it.
  const sizes = drawn.map((size, i) => {
    const { width, artWidth } = plan[i]!;
    if (artWidth >= width) return size;
    return { width, height: (size.height * width) / size.width };
  });
  const backdrop = backdropOf(c, variant);
  const roles = (role: DecorRole) =>
    plan.map((p, i) => ({ p, i })).filter(({ p }) => p.role === role);
  const posterIdx = roles('poster').map(({ i }) => i);
  const posterSizes = posterIdx.map((i) => sizes[i]!);
  const poster =
    variant === 'a'
      ? posterLayout(creativePosterBox(c), STORE_FEATURE, { tower: posterSizes, hero }, text)
      : variant === 'b'
        ? posterB(c, posterSizes, hero, text)
        : posterC(c, posterSizes, hero, text);
  const shelfTop = backdrop.shelves[0]?.shelfTop ?? c.height;
  const stackIdx = roles('stack').map(({ i }) => i);
  const left = stackIdx.slice(0, CR.stacks.left.length);
  const right = stackIdx.slice(CR.stacks.left.length);
  const stacks = [
    ...stack(
      c,
      variant,
      'left',
      left.map((i) => sizes[i]!),
      shelfTop,
      left[0] ?? 0,
    ),
    ...stack(
      c,
      variant,
      'right',
      right.map((i) => sizes[i]!),
      shelfTop,
      right[0] ?? 0,
    ),
  ];
  const heroInk = poster.heroInk ?? poster.hero;
  const towerX = heroInk.x + heroInk.width / 2;
  const flyers = roles('flyer').map(({ i }): PlacedCreature => {
    const size = sizes[i]!;
    // Turned, it reaches lower than its rectangle: the turned bounds stay above the safe area.
    const rect = standing(size, towerX, c.safe.y - CR.flyer.gap * size.height);
    const reach = turnedBounds(rect, CR.flyer.angle);
    return {
      art: i,
      role: 'flyer',
      rect: { ...rect, y: rect.y - (reach.height - rect.height) / 2 },
      angle: CR.flyer.angle,
      blur: 0,
    };
  });
  const near = roles('near').map(({ i }, n) => {
    const spec = CR.near[n]!;
    const size = sizes[i]!;
    const corner = n % 2 === 0 ? 0 : c.width;
    const sign = n % 2 === 0 ? 1 : -1;
    const cx = corner + sign * spec.x * size.width;
    const cy = spec.y * size.height;
    return {
      art: i,
      role: 'near' as const,
      rect: {
        x: cx - size.width / 2,
        y: cy - size.height / 2,
        width: size.width,
        height: size.height,
      },
      angle: spec.angle,
      blur: CR.blur.near * c.width,
    };
  });
  const posterCreatures = posterIdx.map((i, n) => ({
    art: i,
    role: 'poster' as const,
    rect: poster.tower[n]!,
    angle: 0,
    blur: 0,
    enlarged: plan[i]!.artWidth < plan[i]!.width,
  }));
  const creatures = [...stacks, ...posterCreatures, ...flyers, ...near];
  const towerEdge = Math.max(
    0,
    ...stacks.map((p) => {
      const r = turnedBounds(p.rect, p.angle);
      return Math.min(r.x + r.width, c.width - r.x);
    }),
  );
  const jars = jarsOf(c, backdrop, towerEdge, variant === 'c' ? CR.c.jars : CR.jars);
  // Variant C keeps its few pieces off the awning and the garland hanging over it.
  const top =
    variant === 'c' ? [{ x: 0, y: 0, width: c.width, height: garlandBottom(backdrop) }] : [];
  const avoid = [
    ...creatures.map((p) => turnedBounds(p.rect, p.angle)),
    ...jars.map((j) => j.rect),
    poster.title,
    ...top,
  ];
  return { backdrop, jars, poster, creatures, scatter: scatter(c, variant, avoid) };
}
