import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { shade } from '../../../util/color';
import { drawGlossMark, glossFromShares, OUTLINE_SHARE, outlineColor } from '../../fx/plain-style';

const cfg = MENU.shop.noAdsIcon;

/**
 * A crossed-out tile, `size` across, centred on (0, 0): the picture of the "No ads" product, drawn like
 * the plain layers: a warm outline, a flat shadow band, a gloss mark. On the tile is a small screen
 * with a "play" triangle, struck through by a diagonal bar. No letters.
 */
export function createNoAdsIcon(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const half = size / 2;
  const edge = size * OUTLINE_SHARE;
  const radius = size * cfg.radius;
  const lift = size * cfg.shadowShare;
  g.fillStyle(outlineColor(cfg.fill), 1).fillRoundedRect(-half, -half, size, size, radius);
  g.fillStyle(shade(cfg.fill, cfg.shadeAmount), 1).fillRoundedRect(
    -half + edge,
    -half + edge,
    size - edge * 2,
    size - edge * 2,
    radius - edge,
  );
  g.fillStyle(cfg.fill, 1).fillRoundedRect(
    -half + edge,
    -half + edge,
    size - edge * 2 - lift,
    size - edge * 2 - lift,
    radius - edge,
  );
  drawScreen(g, size, edge);
  const slash = size * cfg.slash;
  const reach = half * cfg.reach;
  g.lineStyle(slash + edge * 2, outlineColor(PALETTE.berry), 1);
  g.lineBetween(-reach, reach, reach, -reach);
  g.lineStyle(slash, PALETTE.berry, 1);
  g.lineBetween(-reach, reach, reach, -reach);
  drawGlossMark(
    g,
    glossFromShares(cfg.gloss, 0, 0, size, PALETTE.textLight, cfg.gloss.alpha, {
      x: size,
      y: size,
    }),
  );
  return scene.add.container(0, 0, [g]);
}

/** The screen with its stand and the "play" triangle, in the middle of the tile. */
function drawScreen(g: Phaser.GameObjects.Graphics, size: number, edge: number): void {
  const { screen, play, stand } = cfg;
  const w = size * screen.width;
  const h = size * screen.height;
  const cy = size * screen.y;
  const radius = size * screen.radius;
  const bottom = cy + h / 2;
  const neckH = size * stand.neckHeight;
  const footW = size * stand.footWidth;
  const footH = size * stand.footHeight;
  const line = outlineColor(cfg.fill);
  g.fillStyle(line, 1);
  g.fillRect(-(size * stand.neckWidth) / 2, bottom - edge, size * stand.neckWidth, neckH + edge);
  g.fillRoundedRect(-footW / 2, bottom + neckH - footH / 2, footW, footH, footH / 2);
  g.fillRoundedRect(-w / 2, cy - h / 2, w, h, radius);
  g.fillStyle(shade(screen.fill, cfg.shadeAmount), 1).fillRoundedRect(
    -w / 2 + edge,
    cy - h / 2 + edge,
    w - edge * 2,
    h - edge * 2,
    Math.max(0, radius - edge),
  );
  g.fillStyle(screen.fill, 1).fillRoundedRect(
    -w / 2 + edge,
    cy - h / 2 + edge,
    w - edge * 2,
    h - edge * 2 - size * cfg.shadowShare,
    Math.max(0, radius - edge),
  );
  // The triangle's centre of mass sits on the screen centre, so its tip reaches past it.
  const r = size * play.size;
  g.fillStyle(play.fill, 1).fillTriangle(-r * 0.5, cy - r, -r * 0.5, cy + r, r, cy);
}
