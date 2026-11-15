import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';

const cfg = MENU.shop.noAdsIcon;

/**
 * A crossed-out tile, `size` across, centred on (0, 0): the picture of the "No ads" product. On
 * the tile is a small screen with a "play" triangle, struck through by a diagonal bar. No letters.
 */
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
  drawScreen(g, size);
  g.lineStyle(size * cfg.slash, PALETTE.berry, 1);
  g.lineBetween(-half * cfg.reach, half * cfg.reach, half * cfg.reach, -half * cfg.reach);
  return scene.add.container(0, 0, [g]);
}

/** The screen with its stand and the "play" triangle, in the middle of the tile. */
function drawScreen(g: Phaser.GameObjects.Graphics, size: number): void {
  const { screen, play, stand } = cfg;
  const w = size * screen.width;
  const h = size * screen.height;
  const cy = size * screen.y;
  const edge = size * screen.border;
  const radius = size * screen.radius;
  const bottom = cy + h / 2;
  const neckH = size * stand.neckHeight;
  const footW = size * stand.footWidth;
  const footH = size * stand.footHeight;
  g.fillStyle(PALETTE.textDark, 1);
  g.fillRect(-(size * stand.neckWidth) / 2, bottom - edge, size * stand.neckWidth, neckH + edge);
  g.fillRoundedRect(-footW / 2, bottom + neckH - footH / 2, footW, footH, footH / 2);
  g.fillRoundedRect(-w / 2, cy - h / 2, w, h, radius);
  g.fillStyle(screen.fill, 1).fillRoundedRect(
    -w / 2 + edge,
    cy - h / 2 + edge,
    w - edge * 2,
    h - edge * 2,
    Math.max(0, radius - edge),
  );
  // The triangle's centre of mass sits on the screen centre, so its tip reaches past it.
  const r = size * play.size;
  g.fillStyle(play.fill, 1).fillTriangle(-r * 0.5, cy - r, -r * 0.5, cy + r, r, cy);
}
