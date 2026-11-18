import type * as Phaser from 'phaser';
import { FIELD_PAD } from '../../data/picture-fields';
import { VIDEO_ICON_LOOK } from '../../data/video-icon-look';
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

/** The play triangle as a rounded wedge: a few small circles at the corners joined by a polygon. */
function paintTriangle(
  g: Phaser.GameObjects.Graphics,
  color: number,
  grow: number,
  d: number,
): void {
  const r = triangle.cornerR * size + grow;
  const l = (triangle.left + d) * size + r;
  const rt = (triangle.right + d) * size - r;
  const cy = (disc.y + d) * size;
  const hh = triangle.halfHeight * size - r;
  g.fillStyle(color, 1);
  fillPolygon(g, [
    { x: l, y: cy - hh },
    { x: rt, y: cy },
    { x: l, y: cy + hh },
  ]);
  for (const p of [
    { x: l, y: cy - hh },
    { x: rt, y: cy },
    { x: l, y: cy + hh },
  ])
    g.fillCircle(p.x, p.y, r);
}

function drawIcon(g: Phaser.GameObjects.Graphics): void {
  const grow = size * VIDEO_ICON_LOOK.outlineShare;
  const d = -VIDEO_ICON_LOOK.bandShare;
  paintDisc(g, colors.outline, grow, 0);
  paintDisc(g, colors.discShadow, 0, 0);
  paintDisc(g, colors.disc, 0, d * 0.6);
  paintTriangle(g, colors.outline, size * 0.02, 0);
  paintTriangle(g, colors.triangleShadow, 0, 0);
  paintTriangle(g, colors.triangle, 0, d * 0.4);
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
