import * as Phaser from 'phaser';
import { BACKDROP_FAR, type FarShape } from '../../../../data/backdrop/backdrop-far';
import { MOUNTAIN_FAR_ZONES } from '../../../../data/backdrop/backdrop-mountains';
import type { WeatherId } from '../../../../data/weather/weather';
import { ZONES, type ZoneId } from '../../../../data/zones/zones';
import { mixColor } from '../../../../util/color';
import { MS_PER_SECOND } from '../../../../util/math';
import { effectsMode } from '../../../effects-mode';
import { bakeTexture } from '../../../ui/bake-texture';
import { cloudShape, sparkle } from '../common/art-kit';
import type { FrameCtx } from '../life/life';
import { mountainRise } from './mountain-placement';
import { gradientColorAt } from '../common/sky-gradient';
import { farLightOf, skyStops, skySuffix } from '../weather/weather-palette';

const FAR = BACKDROP_FAR;

const farKey = (zone: ZoneId, weather: WeatherId): string =>
  `bd_far_${zone}${skySuffix(zone, weather)}`;

/** The flat colour of tone step `tone` of a zone: the sky colour leaning towards the zone's pale colour. */
function toneColor(zone: ZoneId, weather: WeatherId, tone: number): number {
  const base = gradientColorAt(skyStops(zone, weather), FAR.skyAt);
  const light = farLightOf(zone, weather) ?? FAR.light[zone];
  return mixColor(base, light, FAR.toneShares[tone] ?? 0);
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

/** Bakes the silhouette tile of a zone. */
export function bakeFarArt(scene: Phaser.Scene, zone: ZoneId, weather: WeatherId = 'clear'): void {
  bakeTexture(scene, farKey(zone, weather), FAR.tile, FAR.tile, (g) => {
    for (const shape of FAR.shapes[zone]) drawShape(g, shape, toneColor(zone, weather, shape.tone));
  });
}

/** Bakes the far plane of every zone (the art sheet shows them all). */
export function bakeAllFarArt(scene: Phaser.Scene): void {
  for (const zone of ZONES) bakeFarArt(scene, zone.id);
}

/**
 * The far plane of one zone: a pale silhouette tile that barely follows the camera. It sits in
 * the zone's container, so it fades with it.
 */
export class FarPlane {
  readonly objects: Phaser.GameObjects.GameObject[];
  private readonly tiles: Phaser.GameObjects.TileSprite;
  private readonly givesWayToPeaks: boolean;

  constructor(
    scene: Phaser.Scene,
    zone: ZoneId,
    width: number,
    height: number,
    weather: WeatherId = 'clear',
  ) {
    this.tiles = new Phaser.GameObjects.TileSprite(
      scene,
      0,
      0,
      width,
      height,
      farKey(zone, weather),
    )
      .setOrigin(0)
      .setAlpha(FAR.alpha);
    this.objects = [this.tiles];
    this.givesWayToPeaks = MOUNTAIN_FAR_ZONES.includes(zone);
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    this.tiles.setSize(width, height);
  }

  update(ctx: FrameCtx, scrollY: number): void {
    if (this.givesWayToPeaks) {
      // The mountain peaks replace the far plane while they stand: it fades out as they rise.
      const alpha = FAR.alpha * (1 - mountainRise(ctx.towerLayers));
      this.tiles.setAlpha(alpha).setVisible(alpha > 0);
    }
    // Lite and minimal effects: the far plane stands still.
    if (effectsMode.atMost('lite')) return;
    this.tiles.tilePositionY = scrollY * FAR.parallax;
    this.tiles.tilePositionX = (FAR.driftPxPerSec * ctx.timeMs) / MS_PER_SECOND;
  }
}
