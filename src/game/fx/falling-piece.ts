import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { DEPTH } from '../depth';
import type { Reaction } from '../objects/face-state';
import { LayerView } from '../objects/layer-view';
import type { PieceMotion } from './anim-curves';
import { TimedPool, type PoolEntry } from './timed-pool';

export interface PieceSpawn extends PieceMotion {
  /** 1-based layer number: picks the colours. */
  layerIndex: number;
  x: number;
  y: number;
  width: number;
  /** Bitten edge (sponge); `null` for an intact piece. */
  cut: CutSide | null;
  /** Held expression of the piece's face; `null` for a faceless piece. */
  face: Reaction | null;
  /** Starting rotation in degrees. */
  angle?: number;
}

interface Piece extends PoolEntry<LayerView> {
  vx: number;
  vy: number;
  spin: number;
  gravity: number;
}

/**
 * Pooled debris: the bitten-off overhang, whole missed layers and collapsing layers.
 * At most `ANIM.pool.maxLivePieces` are alive; a pooled piece lets go of its baked art.
 */
export class FallingPieces {
  private readonly pool: TimedPool<LayerView, Piece>;

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => new LayerView(scene),
      (view) => {
        view.setVisible(false).releaseArt();
      },
      ANIM.pool.maxLivePieces,
    );
  }

  /** Spawns a piece that looks like a layer. Returns its view so callers can follow it. */
  spawn(opts: PieceSpawn): LayerView {
    const view = this.pool.take();
    view
      .resetAnim()
      .setFaceEnabled(opts.face !== null)
      .setDepth(DEPTH.pieces)
      .setLayer(opts.layerIndex, opts.width, opts.cut)
      .setPosition(opts.x, opts.y)
      .setAngle(opts.angle ?? 0)
      .setAlpha(1)
      .setVisible(true);
    if (opts.face) view.faceView.react(opts.face, Infinity);
    this.pool.add({
      item: view,
      vx: opts.vx,
      vy: opts.vy,
      spin: opts.spin,
      ageMs: 0,
      lifeMs: opts.lifeMs,
      gravity: opts.gravity,
    });
    return view;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.pool.update(dtMs, (piece, progress) => {
      const view = piece.item;
      piece.vy += piece.gravity * dt;
      view.x += piece.vx * dt;
      view.y += piece.vy * dt;
      view.angle += piece.spin * dt;
      view.setAlpha(1 - progress);
      view.tick(dtMs);
    });
  }
}
