import type * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { MASTER_ANIM } from '../../../data/master-anim';
import { effectsMode } from '../../effects-mode';
import { DEPTH } from '../../depth';
import { oscillate01 } from '../../../util/math';
import { ABILITY_TEXTURES } from './ability-textures';
import { fadeToward, isFadedIn } from './active-state';

const cfg = ABILITY_ANIM.active;

/** The lemon's sour yellow light along the screen edges. It pulses unless "fewer effects" is on. */
export class Vignette {
  private readonly image: Phaser.GameObjects.Image;
  private fade = 0;
  /** Time left of the flare of the lemon's master salute. */
  private flareMs = 0;

  constructor(scene: Phaser.Scene) {
    this.image = scene.add
      .image(0, 0, ABILITY_TEXTURES.vignette)
      .setOrigin(0, 0)
      .setTint(cfg.lemon.color)
      .setScrollFactor(0)
      .setDepth(DEPTH.vignette)
      .setVisible(false);
  }

  /** The light flares once, brighter than it ever pulses (not at the minimal level). */
  flare(): void {
    if (!effectsMode.reduced) this.flareMs = MASTER_ANIM.lemon.flashMs;
  }

  update(dtMs: number, timeMs: number, on: boolean, width: number, height: number): void {
    this.fade = fadeToward(this.fade, on, cfg.fadeLerp, dtMs);
    this.flareMs = Math.max(0, this.flareMs - dtMs);
    const flare = (this.flareMs / MASTER_ANIM.lemon.flashMs) * MASTER_ANIM.lemon.flashAlpha;
    const visible = isFadedIn(this.fade) || flare > 0;
    this.image.setVisible(visible);
    if (!visible) return;
    const [minAlpha, maxAlpha] = cfg.lemon.alpha;
    const alpha = effectsMode.reduced
      ? cfg.lemon.reducedAlpha
      : minAlpha + (maxAlpha - minAlpha) * oscillate01(timeMs, cfg.lemon.periodMs);
    this.image.setDisplaySize(width, height).setAlpha(Math.max(alpha * this.fade, flare));
  }
}
