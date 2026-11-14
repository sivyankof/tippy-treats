import type * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { HINT_PULSE } from '../../data/idle-motion';
import { PALETTE } from '../../data/palette';
import { oscillate01, sineWave } from '../../util/math';
import { DEPTH } from '../depth';
import { easeFn } from '../fx/ease';
import { isCovered } from '../fx/rule-state';
import { aimMouth, type Reaction } from './face-state';
import { LayerView } from './layer-view';
import type { TowerView } from './tower-view';

const fallEase = easeFn(ANIM.fall.ease);

/** The layer that sweeps over the tower, driven by `state.flying`. */
export class FlyingLayerView {
  private readonly view: LayerView;
  private readonly hint: Phaser.GameObjects.Rectangle;
  private shownIndex = -1;
  private squinting = false;
  /** Reused every frame; `hasPos` tells whether it holds a layer. */
  private readonly pos = { x: 0, y: 0 };
  private hasPos = false;
  private stretched = false;

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

  /** World position of the layer centre, `null` while no layer flies. The object is reused: read it at once. */
  position(): Readonly<{ x: number; y: number }> | null {
    return this.hasPos ? this.pos : null;
  }

  /** A white band runs over the flying layer (the rainbow's sheen). */
  sweepGloss(): void {
    this.view.playGlossSweep();
  }

  /**
   * Shifts the picture for this frame (a pull-back, a jolt): call it after `sync`, which puts it
   * back. `position()` moves with it, so what is laid around the layer stays on the picture.
   */
  nudge(dx: number, dy: number): void {
    this.view.x += dx;
    this.view.y += dy;
    this.pos.x += dx;
    this.pos.y += dy;
  }

  /** Squeezes or swells the whole picture around its centre for this frame; `sync` puts it back. */
  stretch(scaleX: number, scaleY: number): void {
    this.view.setScale(scaleX, scaleY);
    this.stretched = true;
  }

  /** The face of the flying layer makes a short face. */
  react(reaction: Reaction, ms: number): void {
    this.view.faceView.react(reaction, ms);
  }

  sync(state: Readonly<TowerState>, nowMs: number, dtMs: number): void {
    if (this.stretched) {
      this.view.setScale(1);
      this.stretched = false;
    }
    const flying = state.flying;
    if (!flying) {
      this.view.setVisible(false);
      this.hint.setVisible(false);
      this.shownIndex = -1;
      this.hasPos = false;
      return;
    }
    const half = BALANCE.layer.height / 2;
    const surface = this.tower.topY();
    const hoverY = surface - BALANCE.layer.gapAboveTower - half;
    const landY = surface - half;
    const bob = sineWave(nowMs, ANIM.flying.bobPeriodMs) * ANIM.flying.bobAmplitude;
    const falling = state.phase === 'falling';

    let y = hoverY + bob;
    let stretch = 0;
    if (falling) {
      const t = Math.min(1, state.phaseMs / BALANCE.layer.fallMs);
      stretch = fallEase(t);
      y = hoverY + (landY - hoverY) * stretch + bob * (1 - t);
    }

    const face = this.view.faceView;
    if (this.shownIndex !== flying.index) {
      // A fresh layer: clean state, then it flies in squeezed wide.
      this.shownIndex = flying.index;
      this.squinting = false;
      this.view.resetAnim();
      this.view.playAppear();
    }
    // The colour follows the number the layer will have in the tower (twins add height, not layers).
    this.view.setLook(flying).setLayer(state.layers.length + 1, flying.width);
    this.view.setSquash(1 + (ANIM.fall.scaleX - 1) * stretch, 1 + (ANIM.fall.scaleY - 1) * stretch);
    if (falling !== this.squinting) {
      this.squinting = falling;
      if (falling) face.react('squint', Infinity);
      else face.clearReaction();
    }
    face.setMouthHint(aimMouth(flying.x - this.tower.topViewX(), flying.width));
    face.lookAt(this.tower.topViewX() - flying.x, surface - y);
    this.view.setPosition(flying.x, y).setVisible(true);
    this.view.tick(dtMs);
    this.pos.x = flying.x;
    this.pos.y = y;
    this.hasPos = true;

    // A cloud over the layer hides its shadow as well.
    this.placeHint(
      flying.x,
      flying.width,
      surface,
      state.phase === 'flying' && !isCovered(flying, state.phase),
      nowMs,
    );
  }

  /** Shadow of the flying layer on the top layer of the tower (or on the tray). */
  private placeHint(x: number, width: number, surface: number, show: boolean, nowMs: number): void {
    const span = this.tower.topSpan();
    const inset = Math.min(ANIM.layer.cornerRadius / 2, (span.right - span.left) / 4);
    const left = Math.max(x - width / 2, span.left + inset);
    const right = Math.min(x + width / 2, span.right - inset);
    if (!show || right <= left) {
      this.hint.setVisible(false);
      return;
    }
    // The shadow breathes, so it never stands still even when the layer holds still (a wind-up).
    const pulse = 1 - HINT_PULSE.amount * oscillate01(nowMs, HINT_PULSE.periodMs);
    this.hint
      .setPosition(left, surface + ANIM.layer.outline)
      .setSize(right - left, ANIM.flying.hintHeight)
      .setAlpha(pulse)
      .setVisible(true);
  }
}
