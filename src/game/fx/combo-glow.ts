import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { shade } from '../../util/color';
import { oscillate01 } from '../../util/math';
import { DEPTH } from '../depth';
import { FX_TEXTURES } from './fx-textures';

/** High-combo effects: a brief background flash and a soft halo around the tower. */
export class ComboGlow {
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  private readonly halo: Phaser.GameObjects.Image;
  /** Fade of the halo, 0..1; driven by a tween. */
  private fade = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const { haloColor, flashWhiteness } = ANIM.combo;
    this.flashRect = scene.add
      .rectangle(0, 0, 1, 1, shade(haloColor, flashWhiteness))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.flash)
      .setAlpha(0)
      .setVisible(false);
    this.halo = scene.add
      .image(0, 0, FX_TEXTURES.halo)
      .setTint(haloColor)
      .setScrollFactor(0)
      .setDepth(DEPTH.halo)
      .setAlpha(0)
      .setVisible(false);
    this.resize(scene.scale.width, scene.scale.height);
  }

  /** Full-screen flash fading out. */
  flash(): void {
    this.scene.tweens.killTweensOf(this.flashRect);
    this.flashRect.setAlpha(ANIM.combo.flashAlpha).setVisible(true);
    this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: ANIM.combo.flashMs,
      onComplete: () => this.flashRect.setVisible(false),
    });
  }

  /** Fades the halo in or out. */
  setActive(on: boolean): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      fade: on ? 1 : 0,
      duration: ANIM.combo.haloFadeMs,
    });
  }

  /**
   * Keeps the halo around the visible tower and pulses its alpha. All coordinates are
   * in screen pixels: `x`/`centerY` the middle of the visible tower, `height` its
   * visible height, `trayWidth` the width of the tray.
   */
  update(timeMs: number, x: number, centerY: number, height: number, trayWidth: number): void {
    this.halo.setVisible(this.fade > 0);
    if (!this.halo.visible) return;
    const [minAlpha, maxAlpha] = ANIM.combo.haloAlpha;
    const pulse = oscillate01(timeMs, ANIM.combo.haloPeriodMs);
    this.halo
      .setPosition(x, centerY)
      .setDisplaySize(trayWidth * ANIM.combo.haloWidthRatio, height * ANIM.combo.haloWidthRatio)
      .setAlpha((minAlpha + (maxAlpha - minAlpha) * pulse) * this.fade);
  }

  /** Covers the whole screen with the flash. */
  resize(width: number, height: number): void {
    this.flashRect.setSize(width, height);
  }
}
