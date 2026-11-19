import type * as Phaser from 'phaser';
import { PALETTE } from '../../../../data/common/palette';
import { fillRibbon, type Pt } from '../../common/plain-style';

/** A point of a curve with the unit normal that points to the outer (upper) edge. */
export type CurvePoint = Pt & { nx: number; ny: number };

export interface BandStyle {
  /** The colours of the bands, outer first. */
  colors: readonly number[];
  bandPx: number;
  /** One dark outline drawn once around the whole band, this thick, in this colour. */
  outline: number;
  outlinePx: number;
  /** The white gloss strip along the outer edge: how far in (share of a band) and its opacity. */
  glossShare: number;
  glossAlpha: number;
  alpha: number;
  /** Width multiplier at position `u` (0..1) along the curve (a swell); 1 when absent. */
  widthAt?: (u: number) => number;
}

/** The thickness of the gloss line, as a share of a band. */
const GLOSS_THICK = 0.25;

/**
 * Paints a fat cartoon rainbow along `curve`: one outline around the whole band, equal colour
 * slices of its width and a white gloss strip on the outer edge.
 */
export function paintBand(
  g: Phaser.GameObjects.Graphics,
  curve: readonly CurvePoint[],
  style: BandStyle,
): void {
  const bands = style.colors.length;
  const last = Math.max(1, curve.length - 1);
  const half = (u: number): number => (bands * style.bandPx * (style.widthAt?.(u) ?? 1)) / 2;
  const edge = (reach: (u: number) => number): Pt[] =>
    curve.map((p, i) => {
      const o = reach(i / last);
      return { x: p.x + p.nx * o, y: p.y + p.ny * o };
    });
  const strip = (from: number, to: number, color: number, extra = 0): void => {
    g.fillStyle(color, style.alpha);
    fillRibbon(
      g,
      edge((u) => half(u) * from + extra),
      edge((u) => half(u) * to - extra),
    );
  };
  strip(1, -1, style.outline, style.outlinePx);
  style.colors.forEach((color, i) => strip(1 - (2 * i) / bands, 1 - (2 * (i + 1)) / bands, color));
  const gloss = edge((u) => half(u) - style.bandPx * style.glossShare);
  g.lineStyle(style.bandPx * GLOSS_THICK, PALETTE.textLight, style.glossAlpha).beginPath();
  gloss.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  g.strokePath();
}
