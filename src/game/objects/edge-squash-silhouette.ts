import * as Phaser from 'phaser';
import { BALANCE } from '../../data/tower/balance';
import { EDGE_SQUASH } from '../../data/tower/edge-squash';
import { ribReach, type ColumnEdge, type EdgeShape, type SideSquash } from './edge-squash';
import type { Columns } from './edge-squash-columns';
import type { BodyLook } from './edge-squash-look';
import { visibleEdge, type BodyFrame } from './edge-squash-marks';

/** Both sides, left then right; one array for every frame. */
const SIGNS = [-1, 1] as const;

/**
 * The outline of the crumpled part (docs/06, "Удар о край экрана"), drawn over the squashed
 * picture as one smooth curve: the round ribs (or, for a soft layer with a wavy top, one bubble)
 * on top of the wedge outline of the columns, a polygon filled with the glaze of the layer at the
 * top and its sponge at the bottom and outlined as thick and in the same colour as the layer
 * itself. The columns carry the body of the wedge, this gives the rounded silhouette that no
 * column row can.
 */
export class EdgeSilhouette {
  private readonly gfx: Phaser.GameObjects.Graphics;
  /** Scratch for the reach of the ribs at one point, so no frame allocates. */
  private readonly reach: ColumnEdge = { up: 0, down: 0 };

  constructor(scene: Phaser.Scene) {
    this.gfx = new Phaser.GameObjects.Graphics(scene);
    this.gfx.setVisible(false);
  }

  get part(): Phaser.GameObjects.GameObject {
    return this.gfx;
  }

  /** Draws the ribs of both sides for `shape` laid on `columns` (content px, `scale`: content units per shape unit). */
  draw(
    shape: Readonly<EdgeShape>,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
    look: Readonly<BodyLook>,
  ): void {
    const g = this.gfx;
    g.clear();
    let any = false;
    if (shape.ribbing && shape.ribs) {
      for (const sign of SIGNS) {
        const side = sign === -1 ? shape.left : shape.right;
        if (side.ribUp <= 0 || side.len <= 0) continue;
        this.row(g, shape, side, sign, scale, columns, frame, look, 1);
        this.row(g, shape, side, sign, scale, columns, frame, look, -1);
        any = true;
      }
    }
    g.setVisible(any);
  }

  hide(): void {
    this.gfx.clear().setVisible(false);
  }

  /**
   * One row of ribs of a side: the top one (`from` 1) over the glaze or the bottom one (-1) under
   * the sponge. The outline runs along the middle of the line it is drawn with, half a line inside
   * the edge of the body, so it covers the outline of the picture exactly.
   */
  private row(
    g: Phaser.GameObjects.Graphics,
    shape: Readonly<EdgeShape>,
    side: Readonly<SideSquash>,
    sign: -1 | 1,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
    look: Readonly<BodyLook>,
    from: 1 | -1,
  ): void {
    const cfg = EDGE_SQUASH.silhouette;
    const half = cfg.outlinePx / 2;
    const height = BALANCE.layer.height;
    const wall = sign === -1 ? shape.edgeLeft : shape.edgeRight;
    const steps = cfg.samples;
    const fill = from === 1 ? look.topFill : look.bottomFill;
    const line = from === 1 ? look.topLine : look.bottomLine;
    // The first point sits at the wall, half a line inside; the last one is where the ribs end.
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 0) g.fillStyle(fill, 1);
      else g.lineStyle(cfg.outlinePx, line, 1);
      g.beginPath();
      for (let k = 0; k <= steps; k++) {
        const d = (side.len * k) / steps;
        const x = (wall + shape.shift - sign * (d + half)) / scale;
        const base = edgeY(columns, frame, x, from);
        const reach = ribReach(shape, side, d, this.reach);
        const y = base - from * (from === 1 ? reach.up : reach.down) * height + from * half;
        if (k === 0) {
          // The wall of the body: a stroke starts inside the body, the fill closes along the same line.
          g.moveTo(x, base + from * (cfg.insetPx - half));
          g.lineTo(x, y);
        } else g.lineTo(x, y);
      }
      if (pass === 0) {
        // The fill closes back along the line the picture's own outline is covered down to.
        for (let k = steps; k >= 0; k--) {
          const x = (wall + shape.shift - sign * ((side.len * k) / steps + half)) / scale;
          g.lineTo(x, edgeY(columns, frame, x, from) + from * cfg.insetPx);
        }
        g.closePath();
        g.fillPath();
      } else g.strokePath();
    }
  }
}

/** The outline of the body at content x: the top (`from` 1) or the bottom (-1), between the two columns around it. */
function edgeY(
  columns: Readonly<Columns>,
  frame: Readonly<BodyFrame>,
  x: number,
  from: 1 | -1,
): number {
  const xs = columns.xs;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] ?? 0) <= x) lo = mid;
    else hi = mid;
  }
  const x0 = xs[lo] ?? 0;
  const x1 = xs[hi] ?? x0;
  const t = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 0;
  const y0 = visibleEdge(columns, lo, from, frame);
  const y1 = visibleEdge(columns, hi, from, frame);
  return y0 + (y1 - y0) * t;
}
