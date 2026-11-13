import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { pickInt } from '../../util/math';
import { cakeColorsFor } from '../objects/layer-art';
import type { LayerView } from '../objects/layer-view';
import type { TowerView } from '../objects/tower-view';
import { driftMotion } from './anim-curves';
import { FallingPieces } from './falling-piece';
import { GlazeDrip } from './glaze-drip';
import type { LandingFx } from './landing-fx';
import type { FlyingMemo } from './run-fx';

type LandEvent = Extract<SimEvent, { type: 'land' }>;

/**
 * Bits that come off the tower: the bitten-off overhang with its crumbs and glaze drops, the
 * crumbs of a sneeze and the layer that missed. Owns the pooled falling pieces.
 */
export class DebrisFx {
  readonly pieces: FallingPieces;
  private readonly drips: GlazeDrip;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly landing: LandingFx,
  ) {
    this.pieces = new FallingPieces(scene);
    this.drips = new GlazeDrip(scene);
  }

  update(dtMs: number): void {
    this.pieces.update(dtMs);
    this.drips.update(dtMs);
  }

  /** Crumbs fly out of both sides of the top layer. */
  sneeze(state: Readonly<TowerState>): void {
    const index = state.layers.length - 1;
    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const colors = cakeColorsFor(state.layers[index]?.creature ?? null, index + 1);
    this.landing.sneezed(pose, colors.cake);
  }

  /**
   * The layer that missed falls past the tower. It would have been the next layer: twins do
   * not shift it. Returns the piece so the miss reaction can look at it.
   */
  dropMissed(memo: FlyingMemo, state: Readonly<TowerState>): LayerView {
    const side = memo.x >= this.tower.topViewX() ? 1 : -1;
    return this.pieces.spawn({
      layerIndex: state.layers.length + 1,
      x: memo.x,
      y: this.tower.layerCenterY(state.layers.length),
      width: memo.width,
      cut: null,
      ...driftMotion(ANIM.miss, side),
      face: 'horror',
      look: memo,
    });
  }

  /** The bitten-off part falls away, a glaze drop runs down the cut edge. */
  biteOff(event: LandEvent, cutSide: 'left' | 'right', memo: FlyingMemo, index: number): void {
    const side = cutSide === 'right' ? 1 : -1;
    const y = this.tower.layerCenterY(index);
    this.pieces.spawn({
      layerIndex: index + 1,
      x: memo.x + side * (memo.width / 2 - event.cutWidth / 2),
      y,
      width: event.cutWidth,
      // The sponge faces the tower, which is the opposite side of the cut.
      cut: side === 1 ? 'left' : 'right',
      ...driftMotion(ANIM.bite, side),
      face: null,
      look: memo,
    });

    const pose = this.tower.layerPose(index);
    if (!pose) return;
    const edgeX = pose.x + side * (pose.width / 2);
    const colors = cakeColorsFor(memo.creature ?? null, index + 1);
    this.landing.bitten(edgeX, y, side, colors.cake);
    const { dripSize, drips } = ANIM.bite;
    const startY = y - BALANCE.layer.height / 2 + BALANCE.layer.height * ANIM.layer.glazeDepth;
    const count = pickInt(drips);
    for (let k = 0; k < count; k++) {
      const inset = Math.min(ANIM.layer.outline + dripSize / 2 + k * dripSize * 2, pose.width / 2);
      this.drips.spawn(edgeX - side * inset, startY - dripSize, colors.glaze);
    }
  }
}
