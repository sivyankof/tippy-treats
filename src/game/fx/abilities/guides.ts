import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { MS_PER_SECOND } from '../../../util/math';
import { DEPTH } from '../../depth';
import { ABILITY_TEXTURES } from './ability-textures';
import { fadeToward, isFadedIn } from './active-state';

const cfg = ABILITY_ANIM.active;

/** The ghost's dashed lines up from both edges of the top layer; the dashes run upwards. */
export class Guides {
  private readonly lines: Phaser.GameObjects.TileSprite[];
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
  }

  /**
   * `span` is the horizontal extent of the top layer, `surfaceY` the world y of its top edge.
   * The lines rise to `endY`, the world y of the lower edge of the HUD, and no further.
   */
  update(
    dtMs: number,
    on: boolean,
    span: Readonly<{ left: number; right: number }>,
    surfaceY: number,
    endY: number,
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
  }
}
