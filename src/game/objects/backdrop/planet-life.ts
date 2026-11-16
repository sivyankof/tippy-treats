import * as Phaser from 'phaser';
import type { HoverSpec } from '../../../data/backdrop-life';
import { PLANET_PLACE, planetKey, type SpacePlanetId } from '../../../data/space-planets';
import { effectsMode } from '../../effects-mode';
import type { FrameCtx, Life } from './life';
import { hoverPose, newPose } from './life-motion';

/**
 * The dessert planet of a lap: one picture that hangs in the upper part of the screen. On the full
 * and lite levels it bobs and swings slowly; on the minimal level it stands still (docs/06, section 9).
 */
export class PlanetLife implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly pose = newPose();
  private readonly moving: HoverSpec;
  private readonly still: HoverSpec;

  constructor(scene: Phaser.Scene, id: SpacePlanetId) {
    const texture = planetKey(id);
    this.objects = [new Phaser.GameObjects.Image(scene, 0, 0, texture)];
    this.still = { texture, at: PLANET_PLACE.at, scale: PLANET_PLACE.scale };
    this.moving = { ...this.still, ...PLANET_PLACE.drift };
  }

  update(ctx: FrameCtx): void {
    const image = this.objects[0];
    if (!image) return;
    const spec = effectsMode.reduced ? this.still : this.moving;
    const pose = hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose);
    image.setPosition(pose.x, pose.y);
    image.setRotation(pose.rotation);
  }
}
