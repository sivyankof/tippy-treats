import type * as Phaser from 'phaser';
import { spaceLap } from '../../../core/zones/space-laps';
import type { TowerState } from '../../../core/tower/tower-sim';
import { BALANCE } from '../../../data/tower/balance';
import { LAP_EDGE, LAP_EDGE_HEIGHT } from '../../../data/zones/lap-edge';
import { effectsMode } from '../../app/effects-mode';
import type { TowerView } from '../../objects/tower/tower-view';
import { bakeTexture } from '../../ui/common/bake-texture';
import { FLYING_FX_DEPTH } from '../tower/flying-fx-depth';
import { EdgeTween, edgeAlpha, edgeX } from './lap-edge-math';

/** Bakes the dashed strip of one edge: a vertical dashed line, dashes counted up from its bottom (the tower top). */
export function bakeLapEdge(scene: Phaser.Scene): void {
  const stroke = LAP_EDGE.strokePx;
  const period = BALANCE.layer.height / LAP_EDGE.dashesPerLayer;
  const dash = period * LAP_EDGE.dashShare;
  bakeTexture(scene, LAP_EDGE.texture, stroke, LAP_EDGE_HEIGHT, (g) => {
    g.fillStyle(LAP_EDGE.color, 1);
    for (let y = LAP_EDGE_HEIGHT; y > 0; y -= period) {
      const top = Math.max(0, y - dash);
      g.fillRoundedRect(0, top, stroke, y - top, stroke / 2);
    }
  });
}

/**
 * Two thin dashed lines beside the top of the tower at half the width cap of the lap, from the
 * tower top up past the flying row. Two images of one baked picture, made at load; nothing is
 * redrawn per frame. Shown from lap 2 of Space.
 */
export class LapEdges {
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;
  private readonly tween = new EdgeTween();
  private shownIndex = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
  ) {
    bakeLapEdge(scene);
    const make = (): Phaser.GameObjects.Image =>
      scene.add
        .image(0, 0, LAP_EDGE.texture)
        .setOrigin(0.5, 1)
        .setDepth(FLYING_FX_DEPTH.behind)
        .setVisible(false);
    this.left = make();
    this.right = make();
  }

  update(dtMs: number, timeMs: number, state: Readonly<TowerState>): void {
    const flying = state.flying;
    // Between a landing and the next spawn there is no flying layer: the edges stay as they were.
    if (flying && flying.index !== this.shownIndex) {
      this.shownIndex = flying.index;
      this.tween.setTarget(spaceLap(flying.index), state.widthCap);
    }
    const tween = this.tween;
    tween.step(dtMs);
    const on = tween.shown;
    this.left.setVisible(on);
    this.right.setVisible(on);
    if (!on) return;
    const alpha = edgeAlpha(timeMs, effectsMode.reduced) * tween.fade;
    const x = this.tower.topViewX();
    const y = this.tower.topY();
    this.left.setPosition(edgeX(x, tween.half, -1), y).setAlpha(alpha);
    this.right.setPosition(edgeX(x, tween.half, 1), y).setAlpha(alpha);
  }
}
