import * as Phaser from 'phaser';
import type { HoverSpec } from '../../../data/backdrop-life';
import { WALL_LOOK } from '../../../data/window-look';
import { flightClearBand, hudKeepOutFade } from '../../camera-layout';
import { applyPose, createImage, type FrameCtx, type Life } from './life';
import { hoverPose, newPose } from './life-motion';
import { copyMirrored, seriesRise, slotCopy, wallDriftX, type WallSeries } from './wall-anchor';

/** Where one pool slot stands now, for what rides on it (the glass items of a window). */
export interface WallSpot {
  /** Centre of the first picture of the slot, screen px. */
  x: number;
  y: number;
  mirrored: boolean;
  /** 0 while the slot is off the screen. */
  alpha: number;
}

export interface WallOptions {
  /** How the thing repeats on the wall; absent: only the start copy stands, and it rides away with the wall. */
  series?: WallSeries;
  /** Copies alternate sides of the tower (a flipped picture and a mirrored place). */
  mirror?: boolean;
  /** Half the height of the picture (px): it counts as on the screen while any part of it is. */
  halfH: number;
  /** The start copy is drawn by something else (the awning's full-width start strip); only the repeats show. */
  skipStart?: boolean;
  /** Shows only this many px of the picture's left edge (a narrow strip of the awning). */
  cropW?: number;
}

function newSpot(): WallSpot {
  return { x: 0, y: 0, mirrored: false, alpha: 0 };
}

/**
 * Alpha factor of a wall thing at (`x`, `y`) with its picture `halfH` px tall to each side: things that pass under a HUD plate or
 * through the row of the flying layer keep `WALL_LOOK.muted` of their alpha, coming back over `featherPx`. `moved` (0..1) is how
 * far the wall has scrolled: the start view, where the things stand, is not muted.
 */
export function wallMute(
  x: number,
  y: number,
  halfH: number,
  band: { top: number; bottom: number },
  moved: number,
): number {
  if (moved === 0) return 1;
  const { muted, featherPx } = WALL_LOOK;
  const plate = hudKeepOutFade(x, y, halfH * 0.5, featherPx);
  const row = Math.min(1, Math.max(band.top - (y + halfH), y - halfH - band.bottom, 0) / featherPx);
  return 1 - (1 - Math.min(plate, row)) * (1 - muted) * moved;
}

/**
 * Pictures that ride with the wall that carries the shelves: the same speed as the wall (`ctx.wallDown`), the same place in
 * it on the start view as the `Hover` specs say. With a `series` the thing repeats up the wall from a pool made when the zone
 * is built, so nothing is created in a run. Each pool slot holds one picture per spec.
 */
export class WallThing implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  /** One per pool slot. */
  readonly spots: WallSpot[];
  private readonly pool: number;
  private readonly pose = newPose();
  private readonly band = { top: 0, bottom: 0 };
  private bandHeight = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly specs: readonly HoverSpec[],
    private readonly options: WallOptions,
  ) {
    this.pool = options.series?.pool ?? 1;
    this.spots = Array.from({ length: this.pool }, newSpot);
    this.objects = Array.from({ length: this.pool * specs.length }, (_, i) => {
      const spec = specs[i % specs.length];
      const image = createImage(scene, spec?.texture ?? '');
      if (spec?.origin) image.setOrigin(spec.origin[0], spec.origin[1]);
      if (spec?.tint !== undefined) image.setTint(spec.tint);
      if (options.cropW !== undefined) image.setCrop(0, 0, options.cropW, image.height);
      return image.setVisible(false);
    });
  }

  update(ctx: FrameCtx): void {
    if (ctx.height !== this.bandHeight) {
      this.bandHeight = ctx.height;
      Object.assign(this.band, flightClearBand(ctx.height));
    }
    const { series, mirror, halfH, skipStart } = this.options;
    const first = this.specs[0];
    if (!first) return;
    const y0 = first.at.y * ctx.height + (first.offset?.y ?? 0);
    const moved = Math.min(1, Math.abs(ctx.wallDown) / WALL_LOOK.muteRampPx);
    const driftX = wallDriftX(ctx.timeMs);
    for (let slot = 0; slot < this.pool; slot++) {
      const n = series ? slotCopy(slot, series, y0, ctx.wallDown, ctx.height) : 0;
      const rise = series ? seriesRise(n, series, ctx.height) : 0;
      const mirrored = mirror === true && copyMirrored(n);
      const spot = this.spots[slot];
      let on = false;
      this.specs.forEach((spec, k) => {
        const image = this.objects[slot * this.specs.length + k];
        if (!image) return;
        const pose = hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose);
        pose.x = (mirrored ? ctx.width - pose.x : pose.x) + driftX;
        pose.y += ctx.wallDown - rise;
        const shown =
          pose.y + halfH > 0 && pose.y - halfH < ctx.height && !(skipStart === true && n === 0);
        pose.alpha *= wallMute(pose.x, pose.y, halfH, this.band, moved);
        applyPose(image, pose);
        image.setFlipX(mirrored);
        image.setVisible(shown);
        if (k === 0 && spot) {
          on = shown;
          spot.x = pose.x;
          spot.y = pose.y;
          spot.mirrored = mirrored;
          spot.alpha = shown ? pose.alpha / (spec.alpha ?? 1) : 0;
        }
      });
      if (spot && !on) spot.alpha = 0;
    }
  }
}
