import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { KITCHEN_COLORS } from '../../data/palette';
import { DEPTH } from '../depth';
import { bakeTexture } from '../ui/bake-texture';

const TRAY_TEXTURE = 'tray';
const TRAY_SHADOW_WIDTH_RATIO = 1.04;

/** Bakes the tray and its shadow and puts the picture where the tower stands. */
export function createTray(scene: Phaser.Scene, trayTopY: number): void {
  const { thickness, radius, outline, shadowHeight, shadowAlpha } = ANIM.tray;
  const w = BALANCE.tray.width;
  const texW = 2 * Math.ceil((w * TRAY_SHADOW_WIDTH_RATIO) / 2);
  const texH = thickness + shadowHeight;
  const left = (texW - w) / 2;
  bakeTexture(scene, TRAY_TEXTURE, texW, texH, (g) => {
    g.fillStyle(KITCHEN_COLORS.trayShadow, shadowAlpha);
    g.fillEllipse(texW / 2, thickness + shadowHeight / 3, texW, shadowHeight);
    g.fillStyle(KITCHEN_COLORS.trayShadow, 1);
    g.fillRoundedRect(left, 0, w, thickness, radius);
    g.fillStyle(KITCHEN_COLORS.tray, 1);
    g.fillRoundedRect(
      left + outline / 2,
      outline / 2,
      w - outline,
      thickness - outline * 1.5,
      radius - outline / 2,
    );
  });
  scene.add
    .image(BALANCE.tray.centerX, trayTopY, TRAY_TEXTURE)
    .setOrigin(0.5, 0)
    .setDepth(DEPTH.tray);
}
