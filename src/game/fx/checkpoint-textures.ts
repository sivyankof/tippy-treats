import type * as Phaser from 'phaser';
import {
  CHECKPOINT_LOOK,
  ZONE_EMBLEMS,
  zoneBadgeColor,
  type EmblemPart,
  type EmblemShape,
} from '../../data/checkpoint-look';
import { ZONES, type ZoneId } from '../../data/zones';
import { TWO_PI } from '../../util/math';
import { shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';
import {
  OUTLINE_SHARE,
  drawGlossMark,
  drawTwoToneBody,
  ellipsePoints,
  fillPolygon,
  glossFromShares,
  outlineColor,
  roundRectPoints,
  type BodyShape,
  type Pt,
} from './plain-style';

const look = CHECKPOINT_LOOK;

/** Key of the picture of a zone in the "Where from?" window. */
export function checkpointZoneTexture(zone: ZoneId): string {
  return `checkpoint_zone_${zone}`;
}

/** The outline function of an emblem shape. */
function shapeOf(shape: EmblemShape): BodyShape {
  switch (shape.kind) {
    case 'round':
      return (cx, cy, rx, ry) => roundRectPoints(cx, cy, rx, ry, shape.radius * look.textureSize);
    case 'ellipse':
      return (cx, cy, rx, ry) => ellipsePoints(cx, cy, rx, ry, 0);
    case 'triangle':
      return (cx, cy, rx, ry) => [
        { x: cx, y: cy - ry },
        { x: cx + rx, y: cy + ry },
        { x: cx - rx, y: cy + ry },
      ];
    case 'star':
      return (cx, cy, rx, ry) => {
        const points: Pt[] = [];
        const tips = 5;
        for (let i = 0; i < tips * 2; i++) {
          const reach = i % 2 === 0 ? 1 : shape.inner;
          const a = (TWO_PI * i) / (tips * 2) - Math.PI / 2;
          points.push({ x: cx + Math.cos(a) * rx * reach, y: cy + Math.sin(a) * ry * reach });
        }
        return points;
      };
  }
}

/** One group of parts as one silhouette: all outlines, then all shadow tones, then the lit tones. */
function drawGroup(
  g: Phaser.GameObjects.Graphics,
  group: readonly EmblemPart[],
  size: number,
): void {
  const grow = size * OUTLINE_SHARE * look.emblemOutline;
  const band = look.emblemBand;
  for (const part of group) {
    g.fillStyle(outlineColor(part.fill), 1);
    fillPolygon(
      g,
      shapeOf(part.shape)(
        part.x * size,
        part.y * size,
        part.rx * size + grow,
        part.ry * size + grow,
      ),
    );
  }
  for (const part of group) {
    g.fillStyle(part.shadow ?? shade(part.fill, look.shadowShade), 1);
    fillPolygon(
      g,
      shapeOf(part.shape)(part.x * size, part.y * size, part.rx * size, part.ry * size),
    );
  }
  for (const part of group) {
    const rx = part.rx * size;
    const ry = part.ry * size;
    g.fillStyle(part.fill, 1);
    fillPolygon(
      g,
      shapeOf(part.shape)(
        part.x * size - rx * band,
        part.y * size - ry * band,
        rx * (1 - band),
        ry * (1 - band),
      ),
    );
  }
}

function bakeZone(scene: Phaser.Scene, zone: ZoneId): void {
  const size = look.textureSize;
  const base = zoneBadgeColor(zone);
  const grow = size * OUTLINE_SHARE;
  const half = size / 2 - grow;
  bakeTexture(scene, checkpointZoneTexture(zone), size, size, (g) => {
    drawTwoToneBody(
      g,
      (cx, cy, rx, ry) => roundRectPoints(cx, cy, rx, ry, look.badge.radius * half),
      size / 2,
      size / 2,
      half,
      half,
      { base, shadow: shade(base, look.shadowShade), grow, band: look.badge.band },
    );
    for (const group of ZONE_EMBLEMS[zone]) drawGroup(g, group, size);
    drawGlossMark(
      g,
      glossFromShares(look.gloss, size / 2, size / 2, size, 0xffffff, look.gloss.alpha, {
        x: half,
        y: half,
      }),
    );
  });
}

/** Bakes the six zone pictures of the "Where from?" window (lazy: only the first call draws). */
export function bakeCheckpointTextures(scene: Phaser.Scene): void {
  for (const zone of ZONES) bakeZone(scene, zone.id);
}
