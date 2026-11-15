import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { DEG_TO_RAD, MS_PER_SECOND, TWO_PI } from '../../../util/math';

const cfg = MENU.newCreature;

/** How many rays and how far they reach. */
export interface RaysShape {
  count: number;
  radius: number;
}

/** Light rays that turn slowly behind the creature, tinted in its rarity colour. */
export class LightRays extends Phaser.GameObjects.Graphics {
  private turnDeg = 0;

  constructor(
    scene: Phaser.Scene,
    color: number,
    shape: RaysShape = { count: cfg.raysCount, radius: cfg.raysRadius },
  ) {
    super(scene);
    const step = TWO_PI / shape.count;
    const half = step / 4;
    this.fillStyle(color, 1);
    for (let i = 0; i < shape.count; i++) {
      const a = i * step;
      this.fillTriangle(
        0,
        0,
        Math.cos(a - half) * shape.radius,
        Math.sin(a - half) * shape.radius,
        Math.cos(a + half) * shape.radius,
        Math.sin(a + half) * shape.radius,
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
