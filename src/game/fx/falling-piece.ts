import type * as Phaser from 'phaser';
import { DEPTH } from '../depth';
import { LayerView } from '../objects/layer-view';

export interface PieceStyle {
  spinDegPerSec: number;
  gravity: number;
  lifeMs: number;
  driftSpeed: number;
}

interface Piece {
  view: LayerView;
  vx: number;
  vy: number;
  spin: number;
  ageMs: number;
  lifeMs: number;
  gravity: number;
}

/** Pooled debris: the bitten-off overhang and whole missed layers. */
export class FallingPieces {
  private readonly live: Piece[] = [];
  private readonly free: LayerView[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Spawns a piece that looks like a layer of `width`. `side` (-1 left, 1 right)
   * sets the drift direction. Cosmetic randomness only, so Math.random is fine.
   */
  spawn(
    layerIndex: number,
    x: number,
    y: number,
    width: number,
    side: -1 | 1,
    style: PieceStyle,
  ): void {
    const view = this.free.pop() ?? new LayerView(this.scene).setFaceEnabled(false);
    view
      .setDepth(DEPTH.pieces)
      .setLayer(layerIndex, width)
      .setPosition(x, y)
      .setAngle(0)
      .setAlpha(1)
      .setVisible(true);
    const spinSign = Math.random() < 0.5 ? -1 : 1;
    this.live.push({
      view,
      vx: side * style.driftSpeed,
      vy: 0,
      spin: spinSign * style.spinDegPerSec,
      ageMs: 0,
      lifeMs: style.lifeMs,
      gravity: style.gravity,
    });
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const piece = this.live[i];
      if (!piece) continue;
      piece.ageMs += dtMs;
      if (piece.ageMs >= piece.lifeMs) {
        this.recycle(piece);
        this.live.splice(i, 1);
        continue;
      }
      piece.vy += piece.gravity * dt;
      piece.view.x += piece.vx * dt;
      piece.view.y += piece.vy * dt;
      piece.view.angle += piece.spin * dt;
      piece.view.setAlpha(1 - piece.ageMs / piece.lifeMs);
    }
  }

  private recycle(piece: Piece): void {
    piece.view.setVisible(false);
    this.free.push(piece.view);
  }
}
