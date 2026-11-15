import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { createOutlinedText } from '../outlined-text';

const cfg = MENU.shop.noAdsIcon;

/** A crossed-out "AD" tile, `size` across, centred on (0, 0): the picture of the "No ads" product. */
export function createNoAdsIcon(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const half = size / 2;
  g.fillStyle(PALETTE.textDark, 1).fillRoundedRect(-half, -half, size, size, size * cfg.radius);
  g.fillStyle(cfg.fill, 1).fillRoundedRect(
    -half + cfg.border,
    -half + cfg.border,
    size - cfg.border * 2,
    size - cfg.border * 2,
    size * cfg.radius - cfg.border,
  );
  const label = createOutlinedText(scene, 0, 0, 'AD', size * cfg.font);
  g.lineStyle(size * cfg.slash, PALETTE.berry, 1);
  g.lineBetween(-half * cfg.reach, half * cfg.reach, half * cfg.reach, -half * cfg.reach);
  return scene.add.container(0, 0, [g, label]);
}
