import * as Phaser from 'phaser';
import { BACKDROP_FAR, type FarShape } from '../../../data/backdrop-far';
import { ZONE_SKY } from '../../../data/backdrop-colors';
import { ZONES, type ZoneId } from '../../../data/zones';
import { BALANCE } from '../../../data/balance';
import { mixColor } from '../../../util/color';
import { DEG_TO_RAD, MS_PER_SECOND, TWO_PI } from '../../../util/math';
import { effectsMode } from '../../effects-mode';
import { bakeTexture } from '../../ui/bake-texture';
import { cloudShape, sparkle } from './art-kit';
import type { FrameCtx } from './life';
import { gradientColorAt } from './sky-gradient';

const FAR = BACKDROP_FAR;
const RAYS = FAR.rays;
const WHITE = 0xffffff;

const farKey = (zone: ZoneId): string => `bd_far_${zone}`;

/** The flat colour of tone step `tone` of a zone: the sky colour leaning towards the zone's pale colour. */
function toneColor(zone: ZoneId, tone: number): number {
  const base = gradientColorAt(ZONE_SKY[zone], FAR.skyAt);
  return mixColor(base, FAR.light[zone], FAR.toneShares[tone] ?? 0);
}

function drawShape(g: Phaser.GameObjects.Graphics, shape: FarShape, color: number): void {
  g.fillStyle(color, 1);
  switch (shape.kind) {
    case 'rect':
      g.fillRect(shape.x, shape.y, shape.w, shape.h);
      break;
    case 'round':
      g.fillRoundedRect(shape.x, shape.y, shape.w, shape.h, Math.min(shape.w, shape.h) / 4);
      break;
    case 'roof':
      g.fillTriangle(
        shape.x,
        shape.y + shape.h,
        shape.x + shape.w,
        shape.y + shape.h,
        shape.x + shape.w / 2,
        shape.y,
      );
      break;
    case 'circle':
      g.fillCircle(shape.x, shape.y, shape.r);
      break;
    case 'star':
      sparkle(g, shape.x, shape.y, shape.r, color);
      break;
    case 'cloud':
      cloudShape(g, shape.x, shape.y, shape.scale, color, 1);
      break;
  }
}

/** One wedge of light: a triangle from the centre. */
function drawWedge(
  g: Phaser.GameObjects.Graphics,
  size: number,
  centerDeg: number,
  halfDeg: number,
  length: number,
): void {
  const c = size / 2;
  const at = (deg: number): [number, number] => [
    c + Math.cos(deg * DEG_TO_RAD) * length,
    c + Math.sin(deg * DEG_TO_RAD) * length,
  ];
  const [ax, ay] = at(centerDeg - halfDeg);
  const [bx, by] = at(centerDeg + halfDeg);
  g.fillTriangle(c, c, ax, ay, bx, by);
}

/** Bakes the silhouette tile of a zone and the shared rays picture. */
export function bakeFarArt(scene: Phaser.Scene, zone: ZoneId): void {
  bakeTexture(scene, farKey(zone), FAR.tile, FAR.tile, (g) => {
    for (const shape of FAR.shapes[zone]) drawShape(g, shape, toneColor(zone, shape.tone));
  });
  bakeTexture(scene, RAYS.texture, RAYS.size, RAYS.size, (g) => {
    const reach = RAYS.size / 2;
    for (let i = 0; i < RAYS.wedges; i++) {
      for (const [angle, length, alpha] of RAYS.steps) {
        g.fillStyle(WHITE, alpha);
        drawWedge(
          g,
          RAYS.size,
          (360 / RAYS.wedges) * i,
          (RAYS.wedgeDeg * angle) / 2,
          reach * length,
        );
      }
    }
  });
}

/** Bakes the far plane of every zone (the art sheet shows them all). */
export function bakeAllFarArt(scene: Phaser.Scene): void {
  for (const zone of ZONES) bakeFarArt(scene, zone.id);
}

/**
 * The far plane of one zone: a pale silhouette tile that barely follows the camera and the
 * light rays turning behind the tower. It sits in the zone's container, so it fades with it.
 */
export class FarPlane {
  readonly objects: Phaser.GameObjects.GameObject[];
  private readonly tiles: Phaser.GameObjects.TileSprite;
  private readonly rays: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, zone: ZoneId, width: number, height: number) {
    this.tiles = new Phaser.GameObjects.TileSprite(scene, 0, 0, width, height, farKey(zone))
      .setOrigin(0)
      .setAlpha(FAR.alpha);
    this.rays = new Phaser.GameObjects.Image(scene, BALANCE.tray.centerX, 0, RAYS.texture)
      .setTint(FAR.light[zone])
      .setAlpha(RAYS.alpha);
    this.objects = [this.tiles, this.rays];
    this.resize(width, height);
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    this.tiles.setSize(width, height);
    this.rays.setY(height * RAYS.centerY);
    this.rays.setScale((2 * Math.hypot(width, height) * RAYS.reach) / RAYS.size);
  }

  update(ctx: FrameCtx, scrollY: number): void {
    // Lite and minimal effects: the far plane stands still; the minimal level also hides the rays.
    if (effectsMode.atMost('lite')) {
      this.rays.setVisible(!effectsMode.reduced);
      return;
    }
    this.tiles.tilePositionY = scrollY * FAR.parallax;
    this.tiles.tilePositionX = (FAR.driftPxPerSec * ctx.timeMs) / MS_PER_SECOND;
    const showRays = !effectsMode.reduced;
    this.rays.setVisible(showRays);
    if (showRays) this.rays.setRotation((ctx.timeMs / RAYS.periodMs) * TWO_PI);
  }
}
