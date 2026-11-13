import type * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { PALETTE } from '../../data/palette';
import { TWO_PI } from '../../util/math';
import { DEPTH } from '../depth';
import { LayerView } from './layer-view';
import type { TowerView } from './tower-view';

/** The layer that sweeps over the tower, driven by `state.flying`. */
export class FlyingLayerView {
  private readonly view: LayerView;
  private readonly hint: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
  ) {
    this.view = new LayerView(scene).setDepth(DEPTH.flying).setVisible(false);
    this.hint = scene.add
      .rectangle(0, 0, 1, ANIM.flying.hintHeight, PALETTE.textDark, ANIM.flying.hintShadowAlpha)
      .setOrigin(0, 0)
      .setDepth(DEPTH.hint)
      .setVisible(false);
  }

  sync(state: Readonly<TowerState>, nowMs: number): void {
    const flying = state.flying;
    if (!flying) {
      this.view.setVisible(false);
      this.hint.setVisible(false);
      return;
    }
    const half = BALANCE.layer.height / 2;
    const surface = this.tower.topY();
    const hoverY = surface - BALANCE.layer.gapAboveTower - half;
    const landY = surface - half;
    const bob = Math.sin((nowMs / ANIM.flying.bobPeriodMs) * TWO_PI) * ANIM.flying.bobAmplitude;

    let y = hoverY + bob;
    if (state.phase === 'falling') {
      const t = Math.min(1, state.phaseMs / BALANCE.layer.fallMs);
      y = hoverY + (landY - hoverY) * t * t + bob * (1 - t);
    }

    this.view.setLayer(flying.index, flying.width);
    this.view.setMouth(state.phase === 'falling' ? 'o' : 'smile');
    this.view.setPosition(flying.x, y).setVisible(true);
    this.view.lookAt(this.tower.topViewX() - flying.x, surface - y);

    this.placeHint(flying.x, flying.width, surface, state.phase === 'flying');
  }

  /** Shadow of the flying layer on the top layer of the tower (or on the tray). */
  private placeHint(x: number, width: number, surface: number, show: boolean): void {
    const span = this.tower.topSpan();
    const inset = Math.min(ANIM.layer.cornerRadius / 2, (span.right - span.left) / 4);
    const left = Math.max(x - width / 2, span.left + inset);
    const right = Math.min(x + width / 2, span.right - inset);
    if (!show || right <= left) {
      this.hint.setVisible(false);
      return;
    }
    this.hint
      .setPosition(left, surface + ANIM.layer.outline)
      .setSize(right - left, ANIM.flying.hintHeight)
      .setVisible(true);
  }
}
