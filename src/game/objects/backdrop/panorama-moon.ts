import * as Phaser from 'phaser';
import { PANORAMA, WALL_LOOK } from '../../../data/window-look';
import { stepToward } from '../../../util/math';
import type { FrameCtx, Life } from './life';
import { onLayer } from './layer-anchor';
import type { LayerSpot } from './layer-life';
import { panoramaMoonOffset } from './panorama-art';
import { moonAlpha, muteShare, rowMute } from './panorama-fit';

/**
 * The moon of the night panoramic window, drawn right after the pieces of the window from the same atlas page (no extra
 * draw call). It rides with the window, takes its mute tint, and leaves before it: while the window fades behind the
 * tower and while the flight row passes in front of the moon itself (`moonAlpha`). The row jumps by a layer when one
 * lands, so the moon's mute follows it over time, as the window's does.
 */
export class PanoramaMoon implements Life {
  readonly anchor = onLayer(WALL_LOOK.layer);
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;
  private readonly offset = panoramaMoonOffset();
  /** Share of the full mute shown now; -1 until the first frame, which takes it as it is. */
  private muted = -1;

  constructor(
    scene: Phaser.Scene,
    texture: string,
    private readonly spot: LayerSpot,
  ) {
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, texture).setVisible(false);
    this.objects = [this.image];
  }

  update(ctx: FrameCtx): void {
    const spot = this.spot;
    const { x, y, r } = this.offset;
    const cy = spot.y + y * spot.scale;
    const target = muteShare(rowMute(cy, r * spot.scale, ctx.flightRow, PANORAMA.rowFeatherPx));
    this.muted =
      this.muted < 0 ? target : stepToward(this.muted, target, ctx.deltaMs / PANORAMA.rowEaseMs);
    const alpha = spot.alpha > 0 ? moonAlpha(spot.alpha, this.muted) : 0;
    this.image.setVisible(alpha > 0);
    if (alpha <= 0) return;
    this.image
      .setPosition(spot.x + x * spot.scale, cy)
      .setScale(spot.scale / PANORAMA.bakeScale)
      .setAlpha(alpha)
      .setTint(spot.tint);
  }
}
