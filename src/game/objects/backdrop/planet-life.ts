import * as Phaser from 'phaser';
import { BACKDROP } from '../../../data/backdrop';
import type { HoverSpec } from '../../../data/backdrop-life';
import { HUD_LAYOUT } from '../../../data/hud-layout';
import { PLANET_PLACE, planetKey } from '../../../data/space-planets';
import { planetOfLap } from '../../../core/space-planet';
import { effectsMode } from '../../effects-mode';
import type { FrameCtx, Life } from './life';
import { hoverPose, newPose } from './life-motion';
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
  private shownKey: string;
  /** Texture of the planet that is fading in, and how long it has faded; null when none is. */
  private comingKey: string | null = null;
  private fadedMs = 0;

  constructor(scene: Phaser.Scene, lap: number) {
    this.shownKey = planetKey(planetOfLap(lap));
    this.shown = new Phaser.GameObjects.Image(scene, 0, 0, this.shownKey);
    this.coming = new Phaser.GameObjects.Image(scene, 0, 0, this.shownKey).setVisible(false);
    this.objects = [this.shown, this.coming];
    this.still = { texture: this.shownKey, at: PLANET_PLACE.at, scale: PLANET_PLACE.scale };
    this.moving = { ...this.still, ...PLANET_PLACE.drift };
  }

  setLap(lap: number): void {
    const key = planetKey(planetOfLap(lap));
    if (this.comingKey !== null) this.finish();
    if (key === this.shownKey) return;
    if (effectsMode.reduced) {
      this.shown.setTexture(key);
      this.shownKey = key;
      return;
    }
    this.comingKey = key;
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
    const pose = hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose);
    // On a short screen the planet would climb under the HUD: it stays below the HUD's lowest edge.
    const lowest = HUD_LAYOUT.bottomEdge + PLANET_PLACE.hudGap + this.shown.displayHeight / 2;
    const y = Math.max(pose.y, lowest);
    for (const image of this.objects) {
      image.setPosition(pose.x, y);
      image.setRotation(pose.rotation);
      image.setScale(pose.scaleX, pose.scaleY);
    }
  }

  /** The fade is over (or cut short by the next lap): the new planet is the shown one. */
  private finish(): void {
    if (this.comingKey === null) return;
    this.shown.setTexture(this.comingKey);
    this.shownKey = this.comingKey;
    this.comingKey = null;
    this.coming.setVisible(false);
  }
}
