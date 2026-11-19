import * as Phaser from 'phaser';
import type { HoverSpec } from '../../../../data/backdrop/backdrop-life';
import {
  PLANET_PLACE,
  planetDimKey,
  planetKey,
  type SpacePlanetId,
} from '../../../../data/zones/space-planets';
import { lapProgress } from '../../../../core/zones/space-laps';
import { planetPassOf } from '../../../../core/zones/space-planet';
import { effectsMode } from '../../../effects-mode';
import type { FrameCtx, Life } from '../life/life';
import { inSky } from '../life/layer-anchor';
import { hoverPose, newPose } from '../life/life-motion';
import { planetSize } from './dessert-planets';
import { lapPlanet, planetMute, planetPlace, planetY, type PlanetFit } from './planet-placement';

/** What the seed gives for a lap. */
interface LapPlanet {
  id: SpacePlanetId;
  key: string;
  dimKey: string;
  enter: number;
}

/**
 * The dessert planet of the lap, the far background: it floats down with the background and stays visible the whole
 * way (the flying layer and the HUD are drawn over it). The progress of the tower through its lap (the camera scroll,
 * `FrameCtx.towerLayers`) carries it from above the top of the screen to below the bottom; the next lap's planet
 * enters at the top as the last one leaves at the bottom, so one pair of pictures serves all laps and only their
 * textures change while they are out of view. The side alternates lap by lap. While the planet overlaps the flight
 * stripe its muted copy is shown instead, blended over it near the stripe (only then are both drawn).
 * On the full and lite levels it also bobs and swings slowly on top of the scroll; on the minimal level it only
 * scrolls; the muting is the same on every level (docs/06, section 9).
 */
export class PlanetLife implements Life {
  readonly anchor = inSky('planet');
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;
  private readonly dim: Phaser.GameObjects.Image;
  private readonly pose = newPose();
  private readonly moving: HoverSpec;
  private readonly still: HoverSpec;
  private readonly spot = new Spot();
  /** What the seed gives for the lap on screen: asked once per lap, not every frame. */
  private cached: { lap: number; planet: LapPlanet } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly planetSeed: number,
    lap: number,
  ) {
    const id = lapPlanet(planetSeed, lap);
    const key = planetKey(id);
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, key).setVisible(false);
    this.dim = new Phaser.GameObjects.Image(scene, 0, 0, planetDimKey(id)).setVisible(false);
    // Back to front: the muted copy over the planet.
    this.objects = [this.image, this.dim];
    this.still = { texture: key, at: { x: 0, y: 0 }, scale: 1 };
    this.moving = { ...this.still, ...PLANET_PLACE.drift };
  }

  /** The planet of the lap. */
  private ofLap(lap: number): LapPlanet {
    if (this.cached?.lap !== lap) {
      const id = lapPlanet(this.planetSeed, lap);
      this.cached = {
        lap,
        planet: {
          id,
          key: planetKey(id),
          dimKey: planetDimKey(id),
          enter: planetPassOf(this.planetSeed, lap).enter,
        },
      };
    }
    return this.cached.planet;
  }

  private hide(): void {
    this.image.setVisible(false);
    this.dim.setVisible(false);
  }

  /** Puts the two pictures on the lap's planet and its muted copy once both are baked; false while they are not. */
  private wear({ key, dimKey }: LapPlanet): boolean {
    if (this.image.texture.key === key && this.dim.texture.key === dimKey) return true;
    const { textures } = this.scene;
    if (!textures.exists(key) || !textures.exists(dimKey)) return false;
    // The planet is out of view at the ends of a lap, where its texture changes.
    this.image.setTexture(key);
    this.dim.setTexture(dimKey);
    return true;
  }

  update(ctx: FrameCtx): void {
    const { lap, progress } = lapProgress(ctx.towerLayers);
    if (lap === 0) return this.hide();
    const planet = this.ofLap(lap);
    if (!this.wear(planet)) return this.hide();
    const { id, enter } = planet;
    const fit = this.spot.at(id, lap, this.planetSeed, ctx.width);
    const spec = effectsMode.reduced ? this.still : this.moving;
    // The drift is the pose's offset from the scroll position: it is computed at the origin.
    const pose = hoverPose(spec, 0, 0, ctx.timeMs, this.pose);
    const size = planetSize(id);
    const halfH =
      (size.height * fit.scale) / 2 + (effectsMode.reduced ? 0 : PLANET_PLACE.drift.bob.px);
    const y = planetY(progress, ctx.height, halfH, enter);
    const mute = planetMute(y, halfH, ctx.height);
    // Only what shows is drawn: the planet, its muted copy, or both while the copy blends in.
    this.image.setVisible(mute < 1);
    this.dim.setVisible(mute > 0);
    this.dim.setAlpha(mute);
    // A hidden picture is not placed; it is placed in the frame it shows again, before it is drawn.
    for (const picture of this.objects) {
      if (!picture.visible) continue;
      picture.setPosition(fit.x + pose.x, y + pose.y);
      picture.setRotation(pose.rotation);
      // The pose carries the drift's breathing around 1; the lane gives the size the planet fits at.
      picture.setScale(pose.scaleX * fit.scale, pose.scaleY * fit.scale);
    }
  }
}

/** The lane and scale of the planet of the lap on the current screen width, cached until the lap or the width changes. */
class Spot {
  private lap = 0;
  private width = 0;
  private fit: PlanetFit = { x: 0, scale: 1 };

  at(id: SpacePlanetId, lap: number, planetSeed: number, width: number): PlanetFit {
    if (this.lap !== lap || this.width !== width) {
      this.lap = lap;
      this.width = width;
      this.fit = planetPlace(lap, width, planetSize(id).width, planetPassOf(planetSeed, lap).side);
    }
    return this.fit;
  }
}
