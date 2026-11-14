import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { DEG_TO_RAD, MS_PER_SECOND, TWO_PI } from '../../../util/math';

const cfg = MENU.newCreature;

/** Light rays that turn slowly behind the creature, tinted in its rarity colour. */
export class LightRays extends Phaser.GameObjects.Graphics {
  private turnDeg = 0;

  constructor(scene: Phaser.Scene, color: number) {
    super(scene);
    const step = TWO_PI / cfg.raysCount;
    const half = step / 4;
    this.fillStyle(color, 1);
    for (let i = 0; i < cfg.raysCount; i++) {
      const a = i * step;
      this.fillTriangle(
        0,
        0,
        Math.cos(a - half) * cfg.raysRadius,
        Math.sin(a - half) * cfg.raysRadius,
        Math.cos(a + half) * cfg.raysRadius,
        Math.sin(a + half) * cfg.raysRadius,
      );
    }
    this.setAlpha(0);
    scene.add.existing(this);
  }

  tick(dtMs: number): void {
    this.turnDeg += (dtMs / MS_PER_SECOND) * cfg.raysSpinDegPerSec;
    this.setRotation(this.turnDeg * DEG_TO_RAD);
  }
}
