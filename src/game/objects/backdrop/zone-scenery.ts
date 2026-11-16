import * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { BACKDROP_FAR } from '../../../data/backdrop-far';
import { BACKDROP } from '../../../data/backdrop';
import { ZONE_SKY } from '../../../data/backdrop-colors';
import type { ZoneId } from '../../../data/zones';
import { mixColor } from '../../../util/color';
import { MS_PER_SECOND, oscillate01, sineWave } from '../../../util/math';
import { markPerfPart } from '../../perf/perf-marks';
import { bakeTexture } from '../../ui/bake-texture';
import { bakeFarArt, FarPlane } from './far-plane';
import type { GuestSource } from './guest-source';
import type { FrameCtx, Life } from './life';
import { gradientBands } from './sky-gradient';

/** Something in a zone that follows the lap of Space. */
export interface LapLife {
  /** `lap` is 1-based; its picture is baked already. */
  setLap(lap: number): void;
}

/** Pictures of the four parallax layers (back to front) and the living elements between them. */
export interface SceneryDef {
  layers: readonly string[];
  /** `slot` is the parallax layer the element is drawn right above (0..3); -1 is behind them all. */
  lives: readonly { slot: number; life: Life }[];
  /** The creature of the zone that may leave for the tower, when there is one. */
  guest?: GuestSource;
  /** The living element that changes with the lap of Space (the planet), when the zone has one. */
  lapLife?: LapLife;
}

/** One zone's art: baking is separate so the next zone can be prepared ahead of the change. */
export interface ZoneArt {
  bake(scene: Phaser.Scene): void;
  /** Bakes what only one lap of the zone shows (the planet of a lap of Space); `lap` is 1-based. */
  bakeLap?(scene: Phaser.Scene, lap: number): void;
  /** `lap` is the 1-based lap of Space; only Space reads it. */
  build(scene: Phaser.Scene, lap?: number): SceneryDef;
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
 * One zone's backdrop: a sky gradient, the far plane, four parallax layers and the living elements,
 * all in screen space under one container so the whole zone can fade as one.
 */
export class ZoneScenery {
  readonly root: Phaser.GameObjects.Container;
  /** The creature that may leave for the tower. */
  readonly guest: GuestSource | null;
  private readonly lapLife: LapLife | null;
  private readonly sky: Phaser.GameObjects.Image;
  private readonly far: FarPlane;
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
    // Menu screens build the kitchen without the run backdrop, so the far plane bakes here too.
    bakeFarArt(scene, zone);
    this.drift = BACKDROP.drift[zone];
    this.tints = BACKDROP.layerTint[zone] ?? null;
    this.breathePhase = depth;
    this.sky = new Phaser.GameObjects.Image(scene, width / 2, height / 2, skyKey(zone));
    this.far = new FarPlane(scene, zone, width, height);
    this.layers = def.layers.map((key, i) =>
      new Phaser.GameObjects.TileSprite(scene, 0, 0, width, height, key)
        .setOrigin(0)
        .setAlpha(BACKDROP.layerAlpha[zone][i] ?? 1),
    );
    this.lives = def.lives.map(({ life }) => life);
    this.guest = def.guest ?? null;
    this.lapLife = def.lapLife ?? null;
    const children: Phaser.GameObjects.GameObject[] = [this.sky];
    const farSlot = BACKDROP_FAR.slot[zone];
    if (farSlot < 0) children.push(...this.far.objects);
    // Slot -1 is behind every parallax layer (above the far plane).
    for (const { slot, life } of def.lives) {
      if (slot < 0) children.push(...life.objects);
    }
    this.layers.forEach((layer, i) => {
      children.push(layer);
      if (i === farSlot) children.push(...this.far.objects);
      for (const { slot, life } of def.lives) {
        if (slot === i) children.push(...life.objects);
      }
    });
    for (const child of children)
      markPerfPart(child, this.far.objects.includes(child) ? 'far' : 'bg');
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, children);
    this.root.setScrollFactor(0).setDepth(depth);
    scene.add.existing(this.root);
    this.fitSky(width, height, 0);
  }

  /** A new lap of Space: the planet changes. */
  setLap(lap: number): void {
    this.lapLife?.setLap(lap);
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    for (const layer of this.layers) layer.setSize(width, height);
    this.sky.setPosition(width / 2, height / 2);
    this.far.resize(width, height);
  }

  /** Sets how visible the whole zone is; a zone that is fully faded out is not drawn at all. */
  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
    this.root.setVisible(alpha > 0);
  }

  update(ctx: FrameCtx, scrollY: number): void {
    this.fitSky(ctx.width, ctx.height, ctx.timeMs);
    this.far.update(ctx, scrollY);
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
