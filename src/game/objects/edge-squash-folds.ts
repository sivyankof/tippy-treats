import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { smoothstep } from '../../util/math';
import { squashTall, squashX, type EdgeShape, type SideSquash } from './edge-squash';
import { HALF_LAYER } from './layer-art';

/** Both sides, left then right; one array for every frame. */
const SIGNS = [-1, 1] as const;

/** Top of the sponge (under the glaze) and the bottom of the layer body, content px. */
const SPONGE_TOP = -HALF_LAYER + ANIM.layer.glazeDepth * BALANCE.layer.height;
const SPONGE_BOTTOM = HALF_LAYER;

/**
 * Accordion folds on the squeezed sponge (docs/06, "Удар о край экрана"): a few short vertical
 * wrinkles next to the wall, fainter towards the middle of the layer. Drawn above the squashed
 * picture; a fold sits on the column of the squash, so it moves with the picture.
 */
export class EdgeFolds {
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = new Phaser.GameObjects.Graphics(scene);
    this.gfx.setVisible(false);
  }

  get part(): Phaser.GameObjects.GameObject {
    return this.gfx;
  }

  /** Draws the folds of both sides for `shape` (`scale`: content units per shape unit); `power` 0 shows none. */
  draw(shape: Readonly<EdgeShape>, scale: number, power: number): void {
    const g = this.gfx;
    g.clear();
    const cfg = EDGE_SQUASH.folds;
    let any = false;
    for (const sign of SIGNS) {
      const side = sign === -1 ? shape.left : shape.right;
      const grow = power > 0 ? power * foldGrowth(side) : 0;
      if (grow <= 0) continue;
      any = true;
      for (const item of cfg.items) {
        const alpha = grow * item.alpha;
        const u = sign * (shape.half - shape.half * 2 * item.at);
        const x = squashX(shape, u) / scale;
        const tall = squashTall(shape, u);
        const y0 = HALF_LAYER + (spongeY(item.from) - HALF_LAYER) * tall;
        const y1 = HALF_LAYER + (spongeY(item.to) - HALF_LAYER) * tall;
        // The crease bows away from the wall, its light edge faces the wall.
        const bow = -sign * cfg.bowPx;
        const light = x + sign * cfg.lightOffsetPx;
        crease(g, light, y0, y1, bow, cfg.lightWidthPx, cfg.lightColour, cfg.lightAlpha * alpha);
        crease(g, x, y0, y1, bow, cfg.widthPx, cfg.colour, cfg.alpha * alpha);
      }
    }
    g.setVisible(any);
  }

  hide(): void {
    this.gfx.clear().setVisible(false);
  }
}

/** The folds come in with the depth of the squeeze. */
function foldGrowth(side: Readonly<SideSquash>): number {
  const { fromDepthPx, fullDepthPx } = EDGE_SQUASH.folds;
  return smoothstep((side.depth - fromDepthPx) / (fullDepthPx - fromDepthPx));
}

function spongeY(share: number): number {
  return SPONGE_TOP + (SPONGE_BOTTOM - SPONGE_TOP) * share;
}

function crease(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y0: number,
  y1: number,
  bow: number,
  width: number,
  colour: number,
  alpha: number,
): void {
  g.lineStyle(width, colour, alpha);
  g.beginPath();
  g.moveTo(x, y0);
  g.lineTo(x + bow, (y0 + y1) / 2);
  g.lineTo(x, y1);
  g.strokePath();
}
