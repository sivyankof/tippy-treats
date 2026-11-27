import type * as Phaser from 'phaser';
import {
  JOURNAL_ART,
  JOURNAL_CHEVRON,
  JOURNAL_DISHES,
  JOURNAL_ICONS,
  JOURNAL_ICON_IDS,
  type JournalPart,
} from '../../../data/progression/journal-art';
import { FIELD_PAD } from '../../../data/common/picture-fields';
import { shade } from '../../../util/color';
import { bakePadded } from '../../ui/common/bake-texture';
import { starPoints } from '../../objects/creatures/creature-art/rainbow-geometry';
import { rotatePoints } from '../../objects/creatures/creature-art/rainbow-idle-geometry';
import {
  ellipsePoints,
  fillOutlinedPolygon,
  fillPolygon,
  outlineColor,
  roundRectPoints,
  type Pt,
} from '../common/plain-style';

const art = JOURNAL_ART;

export type JournalIconId = (typeof JOURNAL_ICON_IDS)[number];

export const journalIconKey = (id: JournalIconId): string => `journal_icon_${id}`;
export const journalDishKey = (index: number): string => `journal_dish_${index}`;
export const JOURNAL_CHEVRON_KEY = 'journal_chevron';

/** A star `tips` points round, stretched to `rx` by `ry` (the shared outline is a circle of radius 1). */
function ellipseStar(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tips: number,
  inner: number,
): Pt[] {
  return starPoints(0, 0, 1, inner, tips).map((p) => ({ x: cx + p.x * rx, y: cy + p.y * ry }));
}

/** `points` turned `deg` degrees about (`cx`, `cy`). */
function rotate(points: Pt[], cx: number, cy: number, deg: number): Pt[] {
  return deg === 0 ? points : rotatePoints(points, cx, cy, (deg * Math.PI) / 180);
}

/** The outline of a part for a picture `size` wide; `grow` fattens it, `lit` makes the smaller lit copy. */
function outlineOf(part: JournalPart, size: number, grow: number, lit: number): Pt[] {
  const { shape } = part;
  const cx = part.x * size - part.rx * size * lit;
  const cy = part.y * size - part.ry * size * lit;
  const rx = part.rx * size * (1 - lit) + grow;
  const ry = part.ry * size * (1 - lit) + grow;
  const turn = part.tilt ?? 0;
  switch (shape.kind) {
    case 'round':
      return rotate(roundRectPoints(cx, cy, rx, ry, Math.min(rx, ry) * shape.radius), cx, cy, turn);
    case 'ellipse':
      return ellipsePoints(cx, cy, rx, ry, (turn * Math.PI) / 180);
    case 'star':
      return rotate(ellipseStar(cx, cy, rx, ry, shape.tips, shape.inner), cx, cy, turn);
    case 'poly': {
      // Scaled about the middle of the points; the lit copy also slides up and to the left.
      const mid = { x: part.x * size, y: part.y * size };
      const k = 1 - lit;
      const slide = lit * Math.min(part.rx, part.ry) * size;
      return shape.points.map(([px, py]) => ({
        x: mid.x + (px * size - mid.x) * k - slide,
        y: mid.y + (py * size - mid.y) * k - slide,
      }));
    }
  }
}

function drawPart(g: Phaser.GameObjects.Graphics, part: JournalPart, size: number): void {
  // A tiny part (a wing) keeps a thinner outline, or the outline would swallow it.
  const grow = Math.min(
    size * art.outlineShare,
    Math.min(part.rx, part.ry) * size * art.smallOutline,
  );
  const shadow = part.shadow ?? shade(part.fill, art.shadowShade);
  if (part.flat) {
    g.fillStyle(part.fill, part.alpha ?? 1);
    fillPolygon(g, outlineOf(part, size, 0, 0));
    return;
  }
  if (part.shape.kind === 'poly') {
    fillOutlinedPolygon(g, outlineOf(part, size, 0, 0), shadow, outlineColor(part.fill), grow);
  } else {
    g.fillStyle(outlineColor(part.fill), 1);
    fillPolygon(g, outlineOf(part, size, grow, 0));
    g.fillStyle(shadow, 1);
    fillPolygon(g, outlineOf(part, size, 0, 0));
  }
  g.fillStyle(part.fill, part.alpha ?? 1);
  fillPolygon(g, outlineOf(part, size, 0, art.band));
}

function bake(scene: Phaser.Scene, key: string, size: number, parts: readonly JournalPart[]): void {
  bakePadded(scene, key, size, size, FIELD_PAD.journal, (g) => {
    for (const part of parts) drawPart(g, part, size);
  });
}

/** The icons of the fly bar and of the five rows (lazy: only what is missing is drawn). */
export function bakeJournalIcons(scene: Phaser.Scene): void {
  for (const id of JOURNAL_ICON_IDS)
    bake(scene, journalIconKey(id), art.iconSize, JOURNAL_ICONS[id]);
  const size = art.chevronSize;
  bakePadded(scene, JOURNAL_CHEVRON_KEY, size, size, FIELD_PAD.journal, (g) => {
    const points = JOURNAL_CHEVRON.map(([x, y]) => ({ x: x * size, y: y * size }));
    fillOutlinedPolygon(
      g,
      points,
      art.colors.chevron,
      outlineColor(art.colors.chevron),
      size * art.outlineShare,
    );
  });
}

/** The picture of one dish, 1..5 (glass, jar, pot, bucket, bathtub). */
export function bakeJournalDish(scene: Phaser.Scene, index: number): void {
  const parts = JOURNAL_DISHES[index];
  if (parts) bake(scene, journalDishKey(index), art.dishSize, parts);
}

/** All five dishes (for the art sheet). */
export function bakeJournalDishes(scene: Phaser.Scene): void {
  for (let i = 1; i < JOURNAL_DISHES.length; i++) bakeJournalDish(scene, i);
}
