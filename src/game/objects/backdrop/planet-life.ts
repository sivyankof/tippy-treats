import * as Phaser from 'phaser';
import { BACKDROP } from '../../../data/backdrop';
import type { HoverSpec } from '../../../data/backdrop-life';
import { PLANET_PLACE, planetIdOfKey, planetKey } from '../../../data/space-planets';
import { planetOfLap } from '../../../core/space-planet';
import { effectsMode } from '../../effects-mode';
import type { FrameCtx, Life } from './life';
import { hoverPose, newPose, type Pose } from './life-motion';
import { planetSize } from './dessert-planets';
import { planetSpot, type PlanetSpot } from './planet-placement';
import type { LapLife } from './zone-scenery';

/**
 * The dessert planet of the lap: one picture that hangs in the upper left of the screen. On the
 * full and lite levels it bobs and swings slowly; on the minimal level it stands still (docs/06,
 * section 9). A new lap fades the next planet in over the old one (the zone change time); on the
 * minimal level the planet is swapped at once. Both pictures are made once, with the zone; only
 * their texture changes, so a lap change creates no objects.
 */
export class PlanetLife implements Life, LapLife {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newPose();
  private readonly moving: HoverSpec;
  private readonly still: HoverSpec;
  private readonly shown: Phaser.GameObjects.Image;
  private readonly coming: Phaser.GameObjects.Image;
  private readonly shownSpot = new Spot();
  private readonly comingSpot = new Spot();
  private shownKey: string;
  /** Texture of the planet that is fading in, and how long it has faded; null when none is. */
  private comingKey: string | null = null;
  private fadedMs = 0;

  constructor(scene: Phaser.Scene, lap: number) {
    this.shownKey = planetKey(planetOfLap(lap));
    this.shown = new Phaser.GameObjects.Image(scene, 0, 0, this.shownKey);
    this.coming = new Phaser.GameObjects.Image(scene, 0, 0, this.shownKey).setVisible(false);
    this.objects = [this.shown, this.coming];
    this.shownSpot.lap = lap;
    this.still = { texture: this.shownKey, at: { x: 0, y: 0 }, scale: PLANET_PLACE.scale };
    this.moving = { ...this.still, ...PLANET_PLACE.drift };
  }

  setLap(lap: number): void {
    const key = planetKey(planetOfLap(lap));
    if (this.comingKey !== null) this.finish();
    if (key === this.shownKey && lap === this.shownSpot.lap) return;
    if (effectsMode.reduced) {
      this.shown.setTexture(key);
      this.shownKey = key;
      this.shownSpot.lap = lap;
      return;
    }
    this.comingKey = key;
    this.comingSpot.lap = lap;
    this.fadedMs = 0;
    this.coming.setTexture(key).setAlpha(0).setVisible(true);
  }

  update(ctx: FrameCtx): void {
    if (this.comingKey !== null) {
      this.fadedMs += ctx.deltaMs;
      if (this.fadedMs >= BACKDROP.fadeMs) this.finish();
      else this.coming.setAlpha(this.fadedMs / BACKDROP.fadeMs);
    }
    const spec = effectsMode.reduced ? this.still : this.moving;
    // The drift is the pose's offset from the spot: it is computed at the origin and added to each planet's spot.
    const pose = hoverPose(spec, 0, 0, ctx.timeMs, this.pose);
    this.place(this.shown, this.shownKey, this.shownSpot, ctx, pose);
    if (this.comingKey !== null && this.comingSpot.lap !== null) {
      this.place(this.coming, this.comingKey, this.comingSpot, ctx, pose);
    }
  }

  /** Puts one planet at the spot of its lap; hides it (no lane has room) or shows it. */
  private place(
    image: Phaser.GameObjects.Image,
    key: string,
    spot: Spot,
    ctx: FrameCtx,
    pose: Pose,
  ): void {
    const at = spot.at(key, ctx.width, ctx.height);
    image.setVisible(at !== null);
    if (!at) return;
    image.setPosition(at.x + pose.x, at.y + pose.y);
    image.setRotation(pose.rotation);
    image.setScale(pose.scaleX, pose.scaleY);
  }

  /** The fade is over (or cut short by the next lap): the new planet is the shown one. */
  private finish(): void {
    if (this.comingKey === null) return;
    this.shown.setTexture(this.comingKey);
    this.shownKey = this.comingKey;
    this.shownSpot.lap = this.comingSpot.lap;
    this.comingKey = null;
    this.comingSpot.lap = null;
    this.coming.setVisible(false);
  }
}

/** The cached spot of a planet for its lap on the current screen size (see `planetSpot`). */
class Spot {
  lap: number | null = null;
  private cachedLap: number | null = null;
  private cachedW = 0;
  private cachedH = 0;
  private spot: PlanetSpot | null = null;

  at(key: string, width: number, height: number): PlanetSpot | null {
    if (this.lap === null) return null;
    if (this.cachedLap !== this.lap || this.cachedW !== width || this.cachedH !== height) {
      this.cachedLap = this.lap;
      this.cachedW = width;
      this.cachedH = height;
      const size = planetSize(planetIdOfKey(key));
      this.spot = planetSpot(
        this.lap,
        width,
        height,
        size.width * PLANET_PLACE.scale,
        size.height * PLANET_PLACE.scale,
      );
    }
    return this.spot;
  }
}
