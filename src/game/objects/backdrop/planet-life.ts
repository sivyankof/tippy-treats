import * as Phaser from 'phaser';
import type { HoverSpec } from '../../../data/backdrop-life';
import { PLANET_PLACE, planetKey, type SpacePlanetId } from '../../../data/space-planets';
import { lapProgress } from '../../../core/space-laps';
import { planetOfLap, planetPassOf } from '../../../core/space-planet';
import { effectsMode } from '../../effects-mode';
import type { FrameCtx, Life } from './life';
import { inSky } from './layer-anchor';
import { hoverPose, newPose } from './life-motion';
import { planetSize } from './dessert-planets';
import { planetFade, planetFit, planetY, type PlanetFit } from './planet-placement';
import type { LapLife } from './zone-scenery';

/**
 * The dessert planet of the lap: one picture that floats down with the background. The progress of the tower through
 * its lap (the camera scroll, `FrameCtx.towerLayers`) carries it from above the top of the screen to below the bottom;
 * the next lap's planet enters at the top as the last one leaves at the bottom, so one picture serves all laps and
 * only its texture changes while it is out of view. The side alternates lap by lap. On the full and lite levels it
 * also bobs and swings slowly on top of the scroll; on the minimal level it only scrolls (docs/06, section 9).
 */
export class PlanetLife implements Life, LapLife {
  readonly anchor = inSky('planet');
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;
  private readonly pose = newPose();
  private readonly moving: HoverSpec;
  private readonly still: HoverSpec;
  private readonly spot = new Spot();
  /** Tower top width when lap 1 began (its corridor); the other laps follow the dashed cap. */
  private lapOneTopWidth: number | undefined;
  /** What the seed gives for the lap on screen: asked once per lap, not every frame. */
  private cached: { lap: number; id: SpacePlanetId; key: string; enter: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly planetSeed: number,
    lap: number,
    topWidth?: number,
  ) {
    const id = planetOfLap(planetSeed, lap);
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, planetKey(id)).setVisible(false);
    this.objects = [this.image];
    this.still = { texture: planetKey(id), at: { x: 0, y: 0 }, scale: 1 };
    this.moving = { ...this.still, ...PLANET_PLACE.drift };
    this.setLap(lap, topWidth);
  }

  setLap(lap: number, topWidth?: number): void {
    if (lap === 1) this.lapOneTopWidth = topWidth;
  }

  private ofLap(lap: number): { id: SpacePlanetId; key: string; enter: number } {
    if (this.cached?.lap !== lap) {
      const id = planetOfLap(this.planetSeed, lap);
      this.cached = {
        lap,
        id,
        key: planetKey(id),
        enter: planetPassOf(this.planetSeed, lap).enter,
      };
    }
    return this.cached;
  }

  update(ctx: FrameCtx): void {
    const { lap, progress } = lapProgress(ctx.towerLayers);
    if (lap === 0) {
      this.image.setVisible(false);
      return;
    }
    const { id, key, enter } = this.ofLap(lap);
    // The planet is out of view at the ends of a lap, where its texture changes.
    if (this.scene.textures.exists(key) && this.image.texture.key !== key)
      this.image.setTexture(key);
    const fit = this.spot.at(
      id,
      lap,
      this.planetSeed,
      ctx.width,
      lap === 1 ? this.lapOneTopWidth : undefined,
    );
    if (!fit || !this.scene.textures.exists(key) || this.image.texture.key !== key) {
      this.image.setVisible(false);
      return;
    }
    const spec = effectsMode.reduced ? this.still : this.moving;
    // The drift is the pose's offset from the scroll position: it is computed at the origin.
    const pose = hoverPose(spec, 0, 0, ctx.timeMs, this.pose);
    const size = planetSize(id);
    const halfH =
      (size.height * fit.scale) / 2 + (effectsMode.reduced ? 0 : PLANET_PLACE.drift.bob.px);
    const halfW = (size.width * fit.scale) / 2;
    const y = planetY(progress, ctx.height, halfH, enter);
    const alpha = planetFade(fit.x, y, halfH, Math.max(halfW, halfH), ctx.height);
    this.image.setVisible(alpha > 0);
    if (alpha <= 0) return;
    this.image.setPosition(fit.x + pose.x, y + pose.y);
    this.image.setAlpha(alpha);
    this.image.setRotation(pose.rotation);
    // The pose carries the drift's breathing around 1; the lane gives the size the planet fits at.
    this.image.setScale(pose.scaleX * fit.scale, pose.scaleY * fit.scale);
  }
}

/** The lane and scale of the planet of the lap on the current screen width, cached until the lap or the width changes. */
class Spot {
  private lap = 0;
  private width = 0;
  private topWidth: number | undefined;
  private fit: PlanetFit | null = null;

  at(
    id: SpacePlanetId,
    lap: number,
    planetSeed: number,
    width: number,
    topWidth: number | undefined,
  ): PlanetFit | null {
    if (this.lap !== lap || this.width !== width || this.topWidth !== topWidth) {
      this.lap = lap;
      this.width = width;
      this.topWidth = topWidth;
      const size = planetSize(id);
      this.fit = planetFit(lap, width, size.width, planetPassOf(planetSeed, lap).side, topWidth);
    }
    return this.fit;
  }
}
