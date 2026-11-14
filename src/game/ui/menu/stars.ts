import * as Phaser from 'phaser';
import { MAX_CREATURE_LEVEL } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';

const { size, gap, on, off } = MENU.stars;
const POINTS = 5;
const INNER = 0.45;
const OUTLINE_ALPHA = 0.6;

function starPoints(cx: number, cy: number, r: number): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < POINTS * 2; i++) {
    const radius = i % 2 === 0 ? r : r * INNER;
    const angle = -Math.PI / 2 + (i * Math.PI) / POINTS;
    points.push(
      new Phaser.Math.Vector2(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius),
    );
  }
  return points;
}

/** The level of a creature as five stars, the reached ones gold; (x, y) is the centre. */
export class LevelStars extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, x: number, y: number, level: number, scale = 1) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.setLevel(level, scale);
  }

  setLevel(level: number, scale = 1): this {
    this.clear();
    const r = (size * scale) / 2;
    const step = (size + gap) * scale;
    const left = -((MAX_CREATURE_LEVEL - 1) * step) / 2;
    for (let i = 0; i < MAX_CREATURE_LEVEL; i++) {
      const points = starPoints(left + i * step, 0, r);
      this.fillStyle(i < level ? on : off, 1).fillPoints(points, true);
      this.lineStyle(2 * scale, PALETTE.textDark, OUTLINE_ALPHA).strokePoints(points, true);
    }
    return this;
  }
}
