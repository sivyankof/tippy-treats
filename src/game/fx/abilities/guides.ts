import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { MASTER_ANIM } from '../../../data/master-anim';
import { effectsMode } from '../../effects-mode';
import { MS_PER_SECOND, oscillate01 } from '../../../util/math';
import { DEPTH } from '../../depth';
import { ABILITY_TEXTURES } from './ability-textures';
import { fadeToward, isFadedIn } from './active-state';

const cfg = ABILITY_ANIM.active;
const markCfg = MASTER_ANIM.centreMark;

/** The ghost's dashed lines up from both edges of the top layer; the dashes run upwards. */
export class Guides {
  private readonly lines: Phaser.GameObjects.TileSprite[];
  /** The diamond on the middle of the top edge (ghost level 2+). */
  private readonly mark: Phaser.GameObjects.Image;
  private fade = 0;
  private height = -1;

  constructor(scene: Phaser.Scene) {
    this.lines = [0, 1].map(() =>
      scene.add
        .tileSprite(0, 0, cfg.ghost.guideWidth, 1, ABILITY_TEXTURES.dash)
        .setOrigin(0.5, 1)
        .setTint(cfg.ghost.color)
        .setDepth(DEPTH.guides)
        .setVisible(false),
    );
    this.mark = scene.add
      .image(0, 0, ABILITY_TEXTURES.diamond)
      .setTint(cfg.ghost.color)
      .setDepth(DEPTH.guides)
      .setVisible(false);
  }

  /**
   * `span` is the horizontal extent of the top layer, `surfaceY` the world y of its top edge.
   * The lines rise to `endY`, the world y of the lower edge of the HUD, and no further.
   * `markX` is the centre of the top layer when the centre mark shows (level 2+), else `null`;
   * the diamond pulses once a second, and stays still at the minimal level.
   */
  update(
    dtMs: number,
    on: boolean,
    span: Readonly<{ left: number; right: number }>,
    surfaceY: number,
    endY: number,
    markX: number | null,
    timeMs: number,
  ): void {
    this.fade = fadeToward(this.fade, on, cfg.fadeLerp, dtMs);
    const visible = isFadedIn(this.fade);
    const run = (cfg.ghost.guideSpeed * dtMs) / MS_PER_SECOND;
    const height = Math.max(1, Math.round(surfaceY - endY));
    const alpha = cfg.ghost.guideAlpha * this.fade;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;
      line.setVisible(visible);
      if (!visible) continue;
      if (this.height !== height) line.setSize(cfg.ghost.guideWidth, height);
      line.setPosition(i === 0 ? span.left : span.right, surfaceY).setAlpha(alpha);
      line.tilePositionY += run;
    }
    if (visible) this.height = height;
    const showMark = visible && markX !== null;
    this.mark.setVisible(showMark);
    if (showMark) {
      const [from, to] = markCfg.pulse;
      const scale = effectsMode.reduced
        ? 1
        : from + (to - from) * oscillate01(timeMs, markCfg.periodMs);
      this.mark
        .setPosition(markX, surfaceY)
        .setScale(scale)
        .setAlpha(markCfg.alpha * this.fade);
    }
  }
}
