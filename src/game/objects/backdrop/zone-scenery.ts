import * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { BACKDROP } from '../../../data/backdrop';
import { ZONE_SKY } from '../../../data/backdrop-colors';
import type { ZoneId } from '../../../data/zones';
import { mixColor } from '../../../util/color';
import { MS_PER_SECOND, oscillate01, sineWave } from '../../../util/math';
import { bakeTexture } from '../../ui/bake-texture';
import type { FrameCtx, Life } from './life';
import { gradientBands } from './sky-gradient';

/** Pictures of the four parallax layers (back to front) and the living elements between them. */
export interface SceneryDef {
  layers: readonly string[];
  /** `slot` is the parallax layer the element is drawn right above (0..3). */
  lives: readonly { slot: number; life: Life }[];
}

/** One zone's art: baking is separate so the next zone can be prepared ahead of the change. */
export interface ZoneArt {
  bake(scene: Phaser.Scene): void;
  build(scene: Phaser.Scene): SceneryDef;
}

const skyKey = (zone: ZoneId): string => `bd_sky_${zone}`;

function bakeSky(scene: Phaser.Scene, zone: ZoneId): void {
  const { skyBands, skyBandHeight, skyWidth } = BACKDROP;
  const colors = gradientBands(ZONE_SKY[zone], skyBands);
  bakeTexture(scene, skyKey(zone), skyWidth, skyBands * skyBandHeight, (g) => {
    colors.forEach((color, i) => {
      g.fillStyle(color, 1);
      g.fillRect(0, i * skyBandHeight, skyWidth, skyBandHeight);
    });
  });
}

/**
 * One zone's backdrop: a sky gradient, four parallax layers and the living elements,
 * all in screen space under one container so the whole zone can fade as one.
 */
export class ZoneScenery {
  readonly root: Phaser.GameObjects.Container;
  private readonly sky: Phaser.GameObjects.Image;
  private readonly layers: Phaser.GameObjects.TileSprite[];
  private readonly lives: Life[];
  private readonly drift: readonly number[];
  private readonly tints: NonNullable<(typeof BACKDROP.layerTint)[ZoneId]> | null;
  private readonly breathePhase: number;

  constructor(
    scene: Phaser.Scene,
    zone: ZoneId,
    depth: number,
    def: SceneryDef,
    width: number,
    height: number,
  ) {
    bakeSky(scene, zone);
    this.drift = BACKDROP.drift[zone];
    this.tints = BACKDROP.layerTint[zone] ?? null;
    this.breathePhase = depth;
    this.sky = new Phaser.GameObjects.Image(scene, width / 2, height / 2, skyKey(zone));
    this.layers = def.layers.map((key, i) =>
      new Phaser.GameObjects.TileSprite(scene, 0, 0, width, height, key)
        .setOrigin(0)
        .setAlpha(BACKDROP.layerAlpha[zone][i] ?? 1),
    );
    this.lives = def.lives.map(({ life }) => life);
    const children: Phaser.GameObjects.GameObject[] = [this.sky];
    this.layers.forEach((layer, i) => {
      children.push(layer);
      for (const { slot, life } of def.lives) {
        if (slot === i) children.push(...life.objects);
      }
    });
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, children);
    this.root.setScrollFactor(0).setDepth(depth);
    scene.add.existing(this.root);
    this.fitSky(width, height, 0);
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    for (const layer of this.layers) layer.setSize(width, height);
    this.sky.setPosition(width / 2, height / 2);
  }

  /** Sets how visible the whole zone is; a zone that is fully faded out is not drawn at all. */
  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
    this.root.setVisible(alpha > 0);
  }

  update(ctx: FrameCtx, scrollY: number): void {
    this.fitSky(ctx.width, ctx.height, ctx.timeMs);
    this.layers.forEach((layer, i) => {
      layer.tilePositionY = scrollY * (ANIM.parallax[i] ?? 1);
      layer.tilePositionX = ((this.drift[i] ?? 0) * ctx.timeMs) / MS_PER_SECOND;
      const tint = this.tints?.[i];
      if (tint) layer.setTint(mixColor(tint.from, tint.to, oscillate01(ctx.timeMs, tint.ms)));
    });
    for (const life of this.lives) life.update(ctx);
  }

  /** The sky is slightly larger than the screen and breathes, so the gradient is never still. */
  private fitSky(width: number, height: number, timeMs: number): void {
    const { skyOverscan, skyBreathe, skyBands, skyBandHeight, skyWidth } = BACKDROP;
    const breathe =
      1 + skyBreathe.amount * sineWave(timeMs, skyBreathe.periodMs, this.breathePhase);
    this.sky.setScale(
      ((width * skyOverscan) / skyWidth) * breathe,
      ((height * skyOverscan) / (skyBands * skyBandHeight)) * breathe,
    );
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
