import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';

const cfg = MENU.home.badges.flicker;

/** Outline of the flame, a point list in -1..1 units, y down: the tip, the right side, the bottom, the left side. */
const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [0.08, -1],
  [0.3, -0.55],
  [0.62, -0.1],
  [0.7, 0.36],
  [0.46, 0.8],
  [0, 1],
  [-0.46, 0.8],
  [-0.7, 0.36],
  [-0.6, -0.05],
  [-0.38, -0.3],
  [-0.3, -0.05],
  [-0.2, -0.45],
];
const OUTER = 0xff7a2f;
const MIDDLE = 0xffb23c;
const CORE = 0xfff0a0;
const OUTLINE_COLOR = 0x8a2b12;
const SPLINE_POINTS = 10;

function drawShape(
  g: Phaser.GameObjects.Graphics,
  half: number,
  grow: number,
  lift: number,
  color: number,
): void {
  const points = OUTLINE.map(([x, y]) => new Phaser.Math.Vector2(x * grow, y * grow + lift));
  const spline = new Phaser.Curves.Spline(points);
  g.fillStyle(color, 1).fillPoints(
    spline.getPoints(SPLINE_POINTS).map((p) => new Phaser.Math.Vector2(p.x * half, p.y * half)),
    true,
  );
}

/** A flame drawn in code, about `size` high. It stretches and sways forever (docs/06 section 6). */
export class FlameIcon extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, size: number) {
    super(scene, x, y);
    const half = size / 2;
    const g = scene.add.graphics();
    drawShape(g, half * 1.08, 1, 0, OUTLINE_COLOR);
    drawShape(g, half, 1, 0, OUTER);
    drawShape(g, half, 0.62, 0.32, MIDDLE);
    drawShape(g, half, 0.3, 0.55, CORE);
    this.add(g);
    scene.tweens.add({
      targets: g,
      scaleY: cfg.scaleY,
      scaleX: cfg.scaleX,
      angle: cfg.swayDeg,
      duration: cfg.ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.add.existing(this);
  }
}
