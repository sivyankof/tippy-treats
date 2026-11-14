import * as Phaser from 'phaser';
import { TUTORIAL_ANIM } from '../../data/tutorial-anim';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { sineWave } from '../../util/math';
import { easeFn } from '../fx/ease';
import { createOutlinedText } from '../ui/outlined-text';
import { HintClock } from './timeline';

const cfg = TUTORIAL_ANIM.firstPerfect;
const popEase = easeFn('Back.easeOut');
const TOTAL_MS = cfg.popMs + cfg.holdMs + cfg.fadeMs;

/**
 * "Perfect!" big in the middle of the screen with a flash, for the first perfect drop of a
 * session. The flash is skipped in "fewer effects" mode. The ordinary perfect effects still play.
 */
export class PerfectHint {
  private readonly label: Phaser.GameObjects.Text;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly clock = new HintClock();
  private flashMs = 0;

  constructor(scene: Phaser.Scene) {
    // The flash sits under everything else of the HUD scene.
    this.flash = scene.add
      .rectangle(0, 0, 1, 1, PALETTE.textLight)
      .setOrigin(0)
      .setDepth(-1)
      .setVisible(false);
    this.label = createOutlinedText(
      scene,
      0,
      0,
      t('run.perfect'),
      cfg.fontSize,
      PALETTE.gold,
    ).setVisible(false);
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.flash.setSize(screenWidth, screenHeight);
    this.label.setPosition(screenWidth / 2, screenHeight * cfg.y);
  }

  show(reducedFx: boolean): void {
    this.clock.start(TOTAL_MS);
    this.flashMs = reducedFx ? 0 : cfg.flashMs;
    this.label.setText(t('run.perfect'));
  }

  /** `timeMs` is the scene clock (the sway), `deltaMs` the frame time. */
  update(timeMs: number, deltaMs: number): void {
    this.clock.tick(deltaMs);
    const active = this.clock.active;
    this.label.setVisible(active);
    if (active) {
      const pop = Math.min(1, this.clock.elapsed / cfg.popMs);
      const scale = cfg.popFromScale + (1 - cfg.popFromScale) * popEase(pop);
      const fadeFrom = cfg.popMs + cfg.holdMs;
      const fade = Math.max(0, (this.clock.elapsed - fadeFrom) / cfg.fadeMs);
      this.label
        .setScale(scale)
        .setAlpha(1 - fade)
        .setAngle(cfg.swayDeg * sineWave(timeMs, cfg.swayMs));
    }
    this.updateFlash(deltaMs);
  }

  private updateFlash(deltaMs: number): void {
    if (this.flashMs <= 0 || !this.clock.active) {
      this.flash.setVisible(false);
      return;
    }
    this.flashMs = Math.max(0, this.flashMs - deltaMs);
    this.flash.setVisible(this.flashMs > 0).setAlpha(cfg.flashAlpha * (this.flashMs / cfg.flashMs));
  }
}
