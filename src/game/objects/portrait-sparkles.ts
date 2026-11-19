import * as Phaser from 'phaser';
import { MENU } from '../../data/common/menu-layout';
import type { CreatureMaterial } from '../../data/creatures/creature-materials';
import { parseHex } from '../../util/color';
import { bump } from '../fx/common/anim-curves';
import { FX_TEXTURES } from '../fx/common/fx-textures';
import { ringPoint, sparkleDelay } from '../fx/tower/layer-sparkle';
import { effectsMode } from '../effects-mode';

const cfg = MENU.portrait.sparkle;

interface Star {
  image: Phaser.GameObjects.Image;
  ageMs: number;
}

/**
 * The twinkling stars around a menu creature that has sparkles (`CreatureMaterial.sparkle`): a
 * few star images inside `parent`, each swelling and fading at a random point of a ring around
 * the layer. None with "fewer effects".
 */
export class PortraitSparkles {
  private readonly stars: Star[] = [];
  private readonly tints: number[];
  private untilNextMs: number;
  private count = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly parent: Phaser.GameObjects.Container,
    private readonly spec: NonNullable<CreatureMaterial['sparkle']>,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.tints = spec.tints.map(parseHex);
    this.untilNextMs = sparkleDelay(spec.everyMs);
    for (let i = 0; i < cfg.maxLive; i++) {
      const image = scene.add.image(0, 0, FX_TEXTURES.star).setVisible(false);
      parent.add(image);
      this.stars.push({ image, ageMs: cfg.lifeMs });
    }
  }

  tick(dtMs: number): void {
    const reduced = effectsMode.reduced;
    for (const star of this.stars) {
      if (star.ageMs >= cfg.lifeMs) continue;
      star.ageMs += dtMs;
      const t = Math.min(1, star.ageMs / cfg.lifeMs);
      star.image
        .setVisible(!reduced && t < 1)
        .setScale(cfg.size * bump(t))
        .setAngle(cfg.spinDeg * t);
    }
    if (reduced) return;
    this.untilNextMs -= dtMs;
    if (this.untilNextMs > 0) return;
    this.untilNextMs = sparkleDelay(this.spec.everyMs);
    const star = this.stars.find((s) => s.ageMs >= cfg.lifeMs);
    if (!star) return;
    const at = ringPoint(Math.random(), this.width, this.height, this.spec.margin);
    star.ageMs = 0;
    star.image
      .setPosition(at.x, at.y)
      .setTint(this.tints[this.count++ % this.tints.length] ?? 0xffffff)
      .setVisible(true);
    this.parent.bringToTop(star.image);
  }
}
