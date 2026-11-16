import type * as Phaser from 'phaser';
import { OFFLINE_LOOK } from '../../data/offline-look';
import { DEG_TO_RAD } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';
import { drawGlossMark, fillPolygon, roundRectPoints } from './plain-style';

const { textureSize: size, colors, puffs, belly, slash, bandShare, gloss } = OFFLINE_LOOK;

export const OFFLINE_ICON_KEY = 'icon_offline';

/** The cloud as one flat shape in `color`, grown by `grow` and moved by (dx, dy). */
function paintCloud(g: Phaser.GameObjects.Graphics, color: number, grow: number, d: number): void {
  g.fillStyle(color, 1);
  for (const p of puffs) g.fillCircle((p.x + d) * size, (p.y + d) * size, p.r * size + grow);
  fillPolygon(
    g,
    roundRectPoints(
      (belly.x + d) * size,
      (belly.y + d) * size,
      belly.rx * size + grow,
      belly.ry * size + grow,
      belly.radius * size + grow,
    ),
  );
}

/** The stroke as a row of circles along its line. */
function paintSlash(g: Phaser.GameObjects.Graphics, color: number, grow: number, d: number): void {
  g.fillStyle(color, 1);
  for (let i = 0; i <= slash.steps; i++) {
    const u = i / slash.steps;
    const x = slash.fromX + (slash.toX - slash.fromX) * u + d;
    const y = slash.fromY + (slash.toY - slash.fromY) * u + d;
    g.fillCircle(x * size, y * size, slash.halfThick * size + grow);
  }
}

function drawIcon(g: Phaser.GameObjects.Graphics): void {
  const grow = size * OFFLINE_LOOK.outlineShare;
  const d = -bandShare;
  paintCloud(g, colors.outline, grow, 0);
  paintCloud(g, colors.cloudShadow, 0, 0);
  paintCloud(g, colors.cloud, 0, d);
  // The cloud is cut by a thin outline of the stroke, then the stroke itself in two tones.
  paintSlash(g, colors.outline, grow, 0);
  paintSlash(g, colors.slashShadow, 0, 0);
  paintSlash(g, colors.slash, 0, d);
  drawGlossMark(g, {
    x: gloss.x * size,
    y: gloss.y * size,
    length: gloss.length * size,
    thick: gloss.thick * size,
    tilt: gloss.tiltDeg * DEG_TO_RAD,
    dotGap: gloss.dotGap * size,
    dotRadius: gloss.dotRadius * size,
    color: colors.gloss,
    alpha: OFFLINE_LOOK.glossAlpha,
  });
}

/** Bakes the "no internet" icon once; safe to call again. */
export function bakeOfflineIcon(scene: Phaser.Scene): void {
  bakeTexture(scene, OFFLINE_ICON_KEY, size, size, drawIcon);
}
