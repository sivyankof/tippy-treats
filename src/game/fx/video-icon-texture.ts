import type * as Phaser from 'phaser';
import { FIELD_PAD } from '../../data/common/picture-fields';
import { VIDEO_ICON_LOOK } from '../../data/economy/video-icon-look';
import { paddedScale } from '../../util/field-pad';
import { DEG_TO_RAD } from '../../util/math';
import { bakePadded } from '../ui/bake-texture';
import { drawGlossMark, fillPolygon } from './plain-style';

const { textureSize: size, colors, disc, triangle, gloss } = VIDEO_ICON_LOOK;

export const VIDEO_ICON_KEY = 'icon_video';

/** How many times bigger the picture is than the drawn icon; show it this much bigger to keep the drawing at its size. */
export const VIDEO_ICON_FIELD_SCALE = paddedScale(size, FIELD_PAD.videoIcon);

function paintDisc(g: Phaser.GameObjects.Graphics, color: number, grow: number, d: number): void {
  g.fillStyle(color, 1).fillCircle((disc.x + d) * size, (disc.y + d) * size, disc.r * size + grow);
}

/** The play triangle, scaled about its centre by `scale` and moved by `d` (shares of the picture). */
function paintTriangle(
  g: Phaser.GameObjects.Graphics,
  color: number,
  scale: number,
  d: number,
): void {
  const cx = (triangle.left + triangle.right * 2) / 3;
  const cy = disc.y;
  const at = (x: number, y: number): { x: number; y: number } => ({
    x: (cx + (x - cx) * scale + d) * size,
    y: (cy + (y - cy) * scale + d) * size,
  });
  g.fillStyle(color, 1);
  fillPolygon(g, [
    at(triangle.left, cy - triangle.halfHeight),
    at(triangle.right, cy),
    at(triangle.left, cy + triangle.halfHeight),
  ]);
}

function drawIcon(g: Phaser.GameObjects.Graphics): void {
  const grow = size * VIDEO_ICON_LOOK.outlineShare;
  const d = -VIDEO_ICON_LOOK.bandShare;
  paintDisc(g, colors.outline, grow, 0);
  paintDisc(g, colors.discShadow, 0, 0);
  paintDisc(g, colors.disc, 0, d * 0.6);
  paintTriangle(g, colors.outline, triangle.outlineScale, 0);
  paintTriangle(g, colors.triangleShadow, 1, 0);
  paintTriangle(g, colors.triangle, triangle.lightScale, d * 0.4);
  drawGlossMark(g, {
    x: gloss.x * size,
    y: gloss.y * size,
    length: gloss.length * size,
    thick: gloss.thick * size,
    tilt: gloss.tiltDeg * DEG_TO_RAD,
    dotGap: gloss.dotGap * size,
    dotRadius: gloss.dotRadius * size,
    color: colors.gloss,
    alpha: VIDEO_ICON_LOOK.glossAlpha,
  });
}

/** Bakes the video icon once; safe to call again. */
export function bakeVideoIcon(scene: Phaser.Scene): void {
  bakePadded(scene, VIDEO_ICON_KEY, size, size, FIELD_PAD.videoIcon, drawIcon);
}
