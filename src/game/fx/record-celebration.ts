import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';
import { createOutlinedText } from '../ui/outlined-text';
import { easeFn } from './ease';
import { ParticleFx } from './particle-fx';
import { Particles } from './particles';

const ribbon = ANIM.record.ribbon;
const inEase = easeFn(ribbon.inEase);
const RIBBON_TEXTURE = 'fx_record_ribbon';
const RIBBON_DARKEN = -0.3;

/**
 * Confetti over the whole screen and a "New record!" ribbon, for the results scene.
 * Everything is pinned to the screen. Call `update` every frame.
 */
export class RecordCelebration {
  private readonly particles: Particles;
  private readonly fx: ParticleFx;
  private readonly banner: Phaser.GameObjects.Container;
  private ageMs = -1;

  constructor(scene: Phaser.Scene) {
    this.particles = new Particles(scene);
    this.fx = new ParticleFx(this.particles);
    bakeTexture(scene, RIBBON_TEXTURE, ribbon.width, ribbon.height, (g) => {
      const outline = ANIM.layer.outline;
      g.fillStyle(shade(PALETTE.accent, RIBBON_DARKEN), 1);
      g.fillRoundedRect(0, 0, ribbon.width, ribbon.height, ribbon.radius);
      g.fillStyle(PALETTE.accent, 1);
      g.fillRoundedRect(
        outline,
        outline,
        ribbon.width - outline * 2,
        ribbon.height - outline * 2,
        ribbon.radius - outline,
      );
    });
    this.banner = scene.add
      .container(0, 0, [
        scene.add.image(0, 0, RIBBON_TEXTURE),
        createOutlinedText(scene, 0, 0, t('run.newRecord'), ribbon.fontSize),
      ])
      .setScrollFactor(0)
      .setAngle(ribbon.tiltDeg)
      .setVisible(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroy();
    });
  }

  /** Starts the celebration on a screen of `width` x `height`. */
  play(width: number, height: number): void {
    this.fx.confetti(width, height);
    this.banner.setPosition(width / 2, height * ribbon.y);
    this.ageMs = 0;
    this.applyBanner();
  }

  update(dtMs: number): void {
    this.particles.update(dtMs);
    if (this.ageMs < 0) return;
    this.ageMs += dtMs;
    this.applyBanner();
  }

  /** Removes everything; also runs when the scene shuts down. */
  destroy(): void {
    this.ageMs = -1;
    this.particles.clear();
    if (this.banner.scene) this.banner.destroy();
  }

  private applyBanner(): void {
    if (!this.banner.active) return;
    const total = ANIM.record.durationMs;
    if (this.ageMs >= total) {
      this.ageMs = -1;
      this.banner.setVisible(false);
      return;
    }
    const popIn = inEase(Math.min(1, this.ageMs / ribbon.inMs));
    const leave = Math.max(0, (this.ageMs - (total - ribbon.outMs)) / ribbon.outMs);
    const scale = (ribbon.fromScale + (1 - ribbon.fromScale) * popIn) * (1 - leave);
    this.banner
      .setScale(scale)
      .setAlpha(1 - leave)
      .setVisible(true);
  }
}
