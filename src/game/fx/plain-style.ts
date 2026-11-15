import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { TWO_PI } from '../../util/math';
import { shade } from '../../util/color';
import { DARK_OUTLINE } from '../objects/layer-draw';

/** Outline thickness of the plain layers as a share of their height; icons use the same share of theirs. */
export const OUTLINE_SHARE = ANIM.layer.outline / BALANCE.layer.height;

/** The warm dark outline of a body filled with `fill`, the tone the layers use. */
export function outlineColor(fill: number): number {
  return shade(fill, DARK_OUTLINE);
}

export interface Pt {
  x: number;
  y: number;
}

/** Fills a closed outline of points with one path. */
export function fillPolygon(g: Phaser.GameObjects.Graphics, points: readonly Pt[]): void {
  const [first, ...rest] = points;
  if (!first) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const p of rest) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
}

const ELLIPSE_STEPS = 20;

/** A rotated ellipse as points. */
export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, rad: number): Pt[] {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points: Pt[] = [];
  for (let i = 0; i < ELLIPSE_STEPS; i++) {
    const a = (TWO_PI * i) / ELLIPSE_STEPS;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    points.push({ x: cx + ex * cos - ey * sin, y: cy + ex * sin + ey * cos });
  }
  return points;
}

export interface GlossMark {
  /** Centre of the short stroke. */
  x: number;
  y: number;
  length: number;
  thick: number;
  /** Tilt of the stroke, radians. */
  tilt: number;
  /** Gap between the stroke and the dot after it, and the dot radius. */
  dotGap: number;
  dotRadius: number;
  color: number;
  alpha: number;
}

/** The highlight of the glaze: a short white stroke and a dot next to it, no blur. */
export function drawGlossMark(g: Phaser.GameObjects.Graphics, m: GlossMark): void {
  g.fillStyle(m.color, m.alpha);
  fillPolygon(g, ellipsePoints(m.x, m.y, m.length / 2, m.thick / 2, m.tilt));
  const reach = m.length / 2 + m.dotGap;
  g.fillCircle(m.x + Math.cos(m.tilt) * reach, m.y + Math.sin(m.tilt) * reach, m.dotRadius);
}
