import * as Phaser from 'phaser';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { DEG_TO_RAD, lerp, smoothstep } from '../../util/math';
import { UP_DEG } from '../fx/abilities/kit';
import { BALANCE } from '../../data/balance';
import { hollowAt, type RibRow } from './edge-squash-ribs';
import type { Columns } from './edge-squash-columns';
import { ribReach, type ColumnEdge, type EdgeShape, type SideSquash } from './edge-squash';

/** Both sides, left then right; one array for every frame. */
const SIGNS = [-1, 1] as const;

/**
 * The little marks on the squashed layer (docs/06, "Удар о край экрана"): short curved notches in
 * the hollows between the ribs, inside the sponge only (just below the glaze line and at the bottom
 * edge) and shorter and paler the
 * further from the wall, and the short strokes of the impact that fan up from the wedge for a
 * moment. Drawn above the squashed picture; both sit on the columns of the squash, so they move
 * with the picture.
 */
export class EdgeMarks {
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

  /**
   * Draws the marks of both sides for `shape` laid on `columns` (content px, `scale`: content
   * units per shape unit). `frame` tells where the body is in the picture: the empty rows above
   * and below it, and the height of the picture.
   */
  draw(
    shape: Readonly<EdgeShape>,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
  ): void {
    const g = this.gfx;
    g.clear();
    let any = false;
    for (const sign of SIGNS) {
      const side = sign === -1 ? shape.left : shape.right;
      any = this.notches(g, shape, side, sign, scale, columns, frame) || any;
      any = this.strokes(g, shape, side, sign, scale, columns, frame) || any;
    }
    g.setVisible(any);
  }

  hide(): void {
    this.gfx.clear().setVisible(false);
  }

  private notches(
    g: Phaser.GameObjects.Graphics,
    shape: Readonly<EdgeShape>,
    side: Readonly<SideSquash>,
    sign: -1 | 1,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
  ): boolean {
    const ribs = shape.ribbing ? shape.ribs : null;
    const cfg = EDGE_SQUASH.notches;
    const grow = smoothstep((side.depth - cfg.fromDepthPx) / (cfg.fullDepthPx - cfg.fromDepthPx));
    if (!ribs || side.ribUp <= 0 || grow <= 0 || side.len <= 0) return false;
    this.notchRow(g, shape, side, sign, scale, columns, frame, ribs.top, 1, shape.lastRib, grow);
    this.notchRow(
      g,
      shape,
      side,
      sign,
      scale,
      columns,
      frame,
      ribs.bottom,
      -1,
      shape.lastBottomRib,
      grow,
    );
    return true;
  }

  /** The notches in the hollows of one row of ribs (`from` 1: the top row, -1: the bottom one). */
  private notchRow(
    g: Phaser.GameObjects.Graphics,
    shape: Readonly<EdgeShape>,
    side: Readonly<SideSquash>,
    sign: -1 | 1,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
    row: Readonly<RibRow>,
    from: 1 | -1,
    last: number,
    grow: number,
  ): void {
    const cfg = EDGE_SQUASH.notches;
    const hollows = row.start.length - 1;
    for (let i = 0; i < hollows; i++) {
      // The hollow before the farthest rib is only there as far as that rib is.
      const reveal = i === hollows - 1 ? last : 1;
      const fall = 1 - cfg.shrink * i;
      const alpha = cfg.alpha * grow * reveal * fall;
      if (alpha <= 0.01) continue;
      this.notch(
        g,
        shape,
        side,
        sign,
        scale,
        columns,
        frame,
        hollowAt(row, i),
        from,
        cfg.lengthPx * fall,
        alpha,
      );
    }
  }

  /**
   * One notch into the sponge at `t` along the wedge: from just below the glaze line down
   * (`from` 1) or from the bottom edge up (-1). It never touches the glaze.
   */
  private notch(
    g: Phaser.GameObjects.Graphics,
    shape: Readonly<EdgeShape>,
    side: Readonly<SideSquash>,
    sign: -1 | 1,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
    t: number,
    from: 1 | -1,
    length: number,
    alpha: number,
  ): void {
    const cfg = EDGE_SQUASH.notches;
    const j = columnAt(shape, sign, scale, columns, t * side.len);
    const x = columns.xs[j] ?? 0;
    const edge = visibleEdge(columns, j, from, frame);
    // The glaze line is a share of the body height of this column (it stretches with it).
    const below = from === 1 ? cfg.glazeLineShare * (visibleEdge(columns, j, -1, frame) - edge) : 0;
    const y0 = edge + from * (below + cfg.insetPx);
    const bow = sign * cfg.bowPx;
    g.lineStyle(cfg.widthPx, cfg.colour, alpha);
    g.beginPath();
    g.moveTo(x, y0);
    for (const [along, across] of cfg.curve) {
      g.lineTo(x + bow * across, y0 + from * length * along);
    }
    g.lineTo(x, y0 + from * length);
    g.strokePath();
  }

  private strokes(
    g: Phaser.GameObjects.Graphics,
    shape: Readonly<EdgeShape>,
    side: Readonly<SideSquash>,
    sign: -1 | 1,
    scale: number,
    columns: Readonly<Columns>,
    frame: Readonly<BodyFrame>,
  ): boolean {
    const cfg = EDGE_SQUASH.strokes;
    const p = side.hit;
    const gain = side.hitGain;
    if (p < 0 || p >= 1 || side.len <= 0 || gain <= 0) return false;
    const j = columnAt(shape, sign, scale, columns, cfg.crestShare * side.len);
    const x = columns.xs[j] ?? 0;
    // The strokes fan up from the top of the rib there.
    const rib = ribReach(shape, side, cfg.crestShare * side.len, this.reach);
    const y = visibleEdge(columns, j, 1, frame) - rib.up * BALANCE.layer.height;
    const alpha = cfg.alpha * gain * Math.pow(1 - p, cfg.fadePow);
    const size = lerp(EDGE_SQUASH.byPower.strokes.size, 1, gain);
    const gap = lerp(cfg.gapPx[0], cfg.gapPx[1], p) * size;
    const length = lerp(cfg.lengthPx[0], cfg.lengthPx[1], p) * size;
    g.lineStyle(cfg.widthPx, cfg.colour, alpha);
    const steps = cfg.count - 1;
    for (let i = 0; i < cfg.count; i++) {
      const spread = steps > 0 ? (i - steps / 2) / steps : 0;
      const angle = (UP_DEG + spread * cfg.fanDeg - sign * cfg.tiltDeg) * DEG_TO_RAD;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      g.beginPath();
      g.moveTo(x + dx * gap, y + dy * gap);
      g.lineTo(x + dx * (gap + length), y + dy * (gap + length));
      g.strokePath();
    }
    return true;
  }
}

/** Where the body sits in the picture, content px. */
export interface BodyFrame {
  /** Empty rows above the body and below it (they stretch with the picture). */
  pad: number;
  /** Empty rows below the body (the room of its shadow). */
  padBottom: number;
  /** Height of the picture. */
  height: number;
}

/** The outline of the body at column `j`: the top (`from` 1) or the bottom (-1). */
export function visibleEdge(
  columns: Readonly<Columns>,
  j: number,
  from: 1 | -1,
  frame: Readonly<BodyFrame>,
): number {
  const top = columns.tops[j] ?? 0;
  const bottom = columns.bottoms[j] ?? 0;
  const cut = columns.cuts[j] ?? 0;
  const k = frame.height > cut ? (bottom - top) / (frame.height - cut) : 1;
  return from === 1 ? top + (frame.pad - cut) * k : bottom - frame.padBottom * k;
}

/** The column nearest to the point `d` shape px from the wall of the side `sign` (-1 left, 1 right). */
function columnAt(
  shape: Readonly<EdgeShape>,
  sign: -1 | 1,
  scale: number,
  columns: Readonly<Columns>,
  d: number,
): number {
  const n = columns.xs.length;
  const wall = sign === -1 ? shape.edgeLeft : shape.edgeRight;
  const target = (wall + shape.shift + sign * -d) / scale;
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < n; i++) {
    const gap = Math.abs((columns.xs[i] ?? 0) - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}
