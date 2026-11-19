import type * as Phaser from 'phaser';
import type { CutSide } from '../../../core/tower/drop';
import type { LayerPlan } from '../../../core/tower/sim-types';
import { ANIM } from '../../../data/common/anim';
import { lerp, smoothstep } from '../../../util/math';
import { DEPTH } from '../../depth';
import type { Reaction } from '../../objects/creatures/face-state';
import { LayerView } from '../../objects/tower/layer-view';
import type { PieceMotion } from '../common/anim-curves';
import { cutPieceAlpha, sagAmount } from '../cuts/cut-timeline';
import { TimedPool, type PoolEntry } from '../common/timed-pool';

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
  /** What the layer is; plain when left out. */
  look?: LayerPlan;
  /** The piece carries the big topper of its plain layer and drops it with it (off when left out). */
  topper?: boolean;
  /** The piece is a layer of the tower and keeps its marks (a drop, a stain, a cream roll; off when left out). */
  marks?: boolean;
  /**
   * The layer may come back with the same picture (a missed layer flies again after "Continue?"): when the piece is
   * done its picture stays among the idle layer pictures instead of being removed at once (off when left out).
   */
  mayReturn?: boolean;
  /** The piece stays and sags first, and fades only late in its life (the cut of a piece with character). */
  cutPose?: CutPose;
}

/** How a cut piece holds still before it lets go, and when it starts to fade. */
export interface CutPose {
  holdMs: number;
  sagPx: number;
  tiltDeg: number;
  /** Widening and lowering of the sag (0.03: 3%). */
  squash: number;
  /** Share of the life after which the piece fades. */
  fadeFrom: number;
  /** After the let-go the spin and the gravity grow to full over these times; gravity starts at `gravityStart` of full. */
  spinDelayMs: number;
  spinRampMs: number;
  gravityStart: number;
  gravityMs: number;
}

const PLAIN_LOOK: LayerPlan = { kind: 'plain' };

interface Piece extends PoolEntry<LayerView> {
  vx: number;
  vy: number;
  spin: number;
  gravity: number;
  pose: CutPose | null;
  baseY: number;
  baseAngle: number;
}

/**
 * Pooled debris: the bitten-off overhang, whole missed layers and collapsing layers.
 * At most `ANIM.pool.maxLivePieces` are alive; a pooled piece lets go of its baked art.
 */
export class FallingPieces {
  private readonly pool: TimedPool<LayerView, Piece>;
  /** Live pieces whose layer may come back (`PieceSpawn.mayReturn`). */
  private readonly returning = new WeakSet<LayerView>();

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => new LayerView(scene).setStageMode('level'),
      // A piece that is done showed a layer that has left the game (an overhang, a collapsing layer): its picture
      // is not kept among the idle layer pictures, so the collapse does not fill the atlas page. A missed layer
      // may fly again after "Continue?", so its picture stays.
      (view) => {
        view.setVisible(false).releaseArt(!this.returning.has(view));
        this.returning.delete(view);
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
      .setLook(opts.look ?? PLAIN_LOOK)
      .setTopperAllowed(opts.topper ?? false)
      .setMarksAllowed(opts.marks ?? false)
      .setLayer(opts.layerIndex, opts.width, opts.cut)
      .setPosition(opts.x, opts.y)
      .setAngle(opts.angle ?? 0)
      .setAlpha(1)
      .setVisible(true);
    if (opts.face) view.faceView.react(opts.face, Infinity);
    if (opts.mayReturn) this.returning.add(view);
    else this.returning.delete(view);
    this.pool.add({
      item: view,
      vx: opts.vx,
      vy: opts.vy,
      spin: opts.spin,
      ageMs: 0,
      lifeMs: opts.lifeMs,
      gravity: opts.gravity,
      pose: opts.cutPose ?? null,
      baseY: opts.y,
      baseAngle: opts.angle ?? 0,
    });
    return view;
  }

  /** Which piece the view is showing: changes when the pool hands the view to another piece. */
  generationOf(view: LayerView): number {
    return this.pool.generationOf(view);
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (piece, progress) => {
      const view = piece.item;
      const { pose } = piece;
      let moveMs = dtMs;
      if (pose) {
        const sag = sagAmount(piece.ageMs);
        view.setSquash(1 + pose.squash * sag, 1 - pose.squash * sag);
        // Until the let-go the piece only sags and tilts; the motion starts from there.
        moveMs = Math.min(dtMs, Math.max(0, piece.ageMs - pose.holdMs));
        if (moveMs === 0) {
          view.y = piece.baseY + pose.sagPx * sag;
          view.angle = piece.baseAngle + pose.tiltDeg * sag * Math.sign(piece.spin);
        }
      }
      const dt = moveMs / 1000;
      const sinceLetGo = pose ? piece.ageMs - pose.holdMs : 0;
      const gravity = pose
        ? piece.gravity * lerp(pose.gravityStart, 1, smoothstep(sinceLetGo / pose.gravityMs))
        : piece.gravity;
      const spin = pose
        ? piece.spin * smoothstep((sinceLetGo - pose.spinDelayMs) / pose.spinRampMs)
        : piece.spin;
      piece.vy += gravity * dt;
      view.x += piece.vx * dt;
      view.y += piece.vy * dt;
      view.angle += spin * dt;
      view.setAlpha(pose ? cutPieceAlpha(progress, pose.fadeFrom) : 1 - progress);
      view.tick(dtMs);
    });
  }
}
