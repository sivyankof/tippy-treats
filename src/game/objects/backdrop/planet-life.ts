import * as Phaser from 'phaser';
import { BACKDROP } from '../../../data/backdrop';
import type { HoverSpec } from '../../../data/backdrop-life';
import {
  PLANET_PLACE,
  planetKey,
  SPACE_PLANET_IDS,
  type SpacePlanetId,
} from '../../../data/space-planets';
import { planetOfLap } from '../../../core/space-planet';
import { effectsMode } from '../../effects-mode';
import type { FrameCtx, Life } from './life';
import { inSky } from './layer-anchor';
import { hoverPose, newPose, type Pose } from './life-motion';
import { planetSize } from './dessert-planets';
import { planetFit, type PlanetFit } from './planet-placement';
import type { LapLife } from './zone-scenery';

/**
 * The dessert planet of the lap: one picture that hangs in the upper left of the screen. On the
 * full and lite levels it bobs and swings slowly; on the minimal level it stands still (docs/06,
 * section 9). A new lap fades the next planet in over the old one (the zone change time); on the
 * minimal level the planet is swapped at once. Both pictures are made once, with the zone; only
 * their texture changes, so a lap change creates no objects.
 */
export class PlanetLife implements Life, LapLife {
  readonly anchor = inSky('planet');
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newPose();
  private readonly moving: HoverSpec;
  private readonly still: HoverSpec;
  private readonly shown: Phaser.GameObjects.Image;
  private readonly coming: Phaser.GameObjects.Image;
  private readonly shownSpot = new Spot();
  private readonly comingSpot = new Spot();
  /** The planet that is fading in (with its spot), and how long it has faded; null when none is. */
  private comingId: SpacePlanetId | null = null;
  private fadedMs = 0;

  constructor(scene: Phaser.Scene, lap: number, topWidth?: number) {
    const id = planetOfLap(lap);
    this.shown = new Phaser.GameObjects.Image(scene, 0, 0, planetKey(id));
    this.coming = new Phaser.GameObjects.Image(scene, 0, 0, planetKey(id)).setVisible(false);
    this.objects = [this.shown, this.coming];
    this.shownSpot.set(id, lap, topWidth);
    this.still = { texture: planetKey(id), at: { x: 0, y: 0 }, scale: 1 };
    this.moving = { ...this.still, ...PLANET_PLACE.drift };
  }

  setLap(lap: number, topWidth?: number): void {
    const id = planetOfLap(lap);
    if (this.comingId !== null) this.finish();
    if (id === this.shownSpot.id && lap === this.shownSpot.lap) {
      // Space built ahead of its first lap takes the tower top width of the moment the lap begins.
      if (topWidth !== this.shownSpot.topWidth) this.shownSpot.set(id, lap, topWidth);
      return;
    }
    if (effectsMode.reduced) {
      this.shown.setTexture(planetKey(id));
      this.shownSpot.set(id, lap, topWidth);
      return;
    }
    this.comingId = id;
    this.comingSpot.set(id, lap, topWidth);
    this.fadedMs = 0;
    this.coming.setTexture(planetKey(id)).setAlpha(0).setVisible(true);
  }

  update(ctx: FrameCtx): void {
    if (this.comingId !== null) {
      this.fadedMs += ctx.deltaMs;
      if (this.fadedMs >= BACKDROP.fadeMs) this.finish();
      else {
        const t = this.fadedMs / BACKDROP.fadeMs;
        // Crossfade: the old planet fades out as the new one fades in, so neither pops.
        this.coming.setAlpha(t);
        this.shown.setAlpha(1 - t);
      }
    }
    const spec = effectsMode.reduced ? this.still : this.moving;
    // The drift is the pose's offset from the spot: it is computed at the origin and added to each planet's spot.
    const pose = hoverPose(spec, 0, 0, ctx.timeMs, this.pose);
    this.place(this.shown, this.shownSpot, ctx, pose);
    if (this.comingId !== null) this.place(this.coming, this.comingSpot, ctx, pose);
  }

  /** Puts one planet at the spot of its lap; hides it (no lane has room) or shows it. */
  private place(image: Phaser.GameObjects.Image, spot: Spot, ctx: FrameCtx, pose: Pose): void {
    const at = spot.at(ctx.width, ctx.height);
    image.setVisible(at !== null);
    if (!at) return;
    image.setPosition(at.x + pose.x, at.y + pose.y);
    image.setRotation(pose.rotation);
    // The pose carries the drift's breathing around 1; the spot gives the size the planet fits at.
    image.setScale(pose.scaleX * at.scale, pose.scaleY * at.scale);
  }

  /** The fade is over (or cut short by the next lap): the new planet is the shown one. */
  private finish(): void {
    if (this.comingId === null) return;
    this.shown.setTexture(planetKey(this.comingId)).setAlpha(1);
    this.shownSpot.set(this.comingId, this.comingSpot.lap, this.comingSpot.topWidth);
    this.comingId = null;
    this.comingSpot.clear();
    this.coming.setVisible(false);
  }
}

/** The planet of one lap and its cached spot and scale on the current screen size (see `planetFit`). */
class Spot {
  id: SpacePlanetId = SPACE_PLANET_IDS[0];
  lap: number | null = null;
  /** Tower top width captured when the lap began; fixed for the lap (see `corridorHalf`). */
  topWidth: number | undefined;
  private cachedLap: number | null = null;
  private cachedW = 0;
  private cachedH = 0;
  private spot: PlanetFit | null = null;

  set(id: SpacePlanetId, lap: number | null, topWidth?: number): void {
    this.id = id;
    this.lap = lap;
    this.topWidth = topWidth;
    this.cachedLap = null;
  }

  clear(): void {
    this.lap = null;
    this.cachedLap = null;
  }

  at(width: number, height: number): PlanetFit | null {
    if (this.lap === null) return null;
    if (this.cachedLap !== this.lap || this.cachedW !== width || this.cachedH !== height) {
      this.cachedLap = this.lap;
      this.cachedW = width;
      this.cachedH = height;
      const size = planetSize(this.id);
      this.spot = planetFit(this.lap, width, height, size.width, size.height, this.topWidth);
    }
    return this.spot;
  }
}
