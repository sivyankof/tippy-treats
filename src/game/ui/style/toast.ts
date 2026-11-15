import type * as Phaser from 'phaser';
import { PALETTE } from '../../../data/palette';
import { MENU } from '../../../data/menu-layout';
import { fitText } from '../menu/fit-text';
import { createOutlinedText } from '../outlined-text';
import { createPlate } from './volume';

const cfg = MENU.style.toast;

/**
 * A short notice on a plate of the kit: it slides up from the bottom edge, stays for a moment
 * and goes away. It draws above whatever the scene shows.
 */
export function showToast(scene: Phaser.Scene, text: string): void {
  const { width, height } = scene.scale.gameSize;
  const plate = createPlate(scene, 'card', 0, 0, cfg.width, cfg.height, {
    fill: PALETTE.gold,
  });
  const label = fitText(
    createOutlinedText(scene, 0, 0, text, cfg.font),
    cfg.width - cfg.textPadding,
  );
  const y = height - cfg.bottom;
  const toast = scene.add
    .container(width / 2, y + cfg.height, [plate, label])
    .setDepth(cfg.depth)
    .setAlpha(0);
  scene.tweens.add({ targets: toast, y, alpha: 1, duration: cfg.inMs, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: toast,
    alpha: 0,
    delay: cfg.inMs + cfg.holdMs,
    duration: cfg.outMs,
    onComplete: () => toast.destroy(),
  });
}
