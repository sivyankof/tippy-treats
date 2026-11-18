import * as Phaser from 'phaser';
import type { HoverSpec } from '../../../data/backdrop-life';
import { WALL_LOOK } from '../../../data/window-look';
import { applyPose, createImage, type FrameCtx, type Life } from './life';
import { hoverPose, newPose } from './life-motion';
import { rowMute } from './panorama-fit';
import {
  copyMirrored,
  onLayer,
  rideLayer,
  seriesRise,
  slotCopy,
  type Anchor,
  type LayerSeries,
} from './layer-anchor';

/** Where one pool slot stands now, for what rides on it (the glass items of a window). */
export interface LayerSpot {
  /** Centre of the first picture of the slot, screen px. */
  x: number;
  y: number;
  mirrored: boolean;
  /** 0 while the slot is off the screen. */
  alpha: number;
  /** Scale of the picture (1 unless the thing is fitted to the screen). */
  scale: number;
}

export interface LayerOptions {
  /** The parallax layer the thing stands on (0..3). */
  layer: number;
  /** How the thing repeats on the wall; absent: only the start copy stands, and it rides away with the wall. */
  series?: LayerSeries;
  /** Copies alternate sides of the tower (a flipped picture and a mirrored place). */
  mirror?: boolean;
  /** Half the height of the picture (px): it counts as on the screen while any part of it is. */
  halfH: number;
  /** Alpha factor (0..1) by how far (px) the layer has moved down; the picture is hidden at 0. Absent: no fade. */
  fadeDown?: (down: number) => number;
  /**
   * The start copy is fitted to the screen: its centre y and scale (the first spec's `at.y` and `offset.y` are ignored);
   * `null` hides the whole thing (the screen has no room for it).
   */
  fit?: (width: number, height: number) => LayerFit | null;
  /** True where the start copy (n = 0) of a series is left out on this screen (a bigger thing takes its place). */
  skipStart?: (width: number, height: number) => boolean;
  /** The thing is muted only while the incoming layer flies in front of it (`rowMute`), not by the HUD plates and the tall-tower row. */
  rowMute?: boolean;
}

/** Where a fitted thing stands on the start view. */
export interface LayerFit {
  y: number;
  scale: number;
}

function newSpot(): LayerSpot {
  return { x: 0, y: 0, mirrored: false, alpha: 0, scale: 1 };
}

/**
 * Pictures that ride with a parallax layer (the wall that carries the shelves, a roof): the same speed as the layer
 * (`ctx.layerDown`), the same sway, the same place in it on the start view as the `Hover` specs say. With a `series` the thing repeats up the wall from a pool made when the zone
 * is built, so nothing is created in a run. Each pool slot holds one picture per spec.
 */
export class LayerThing implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  /** One per pool slot. */
  readonly spots: LayerSpot[];
  private readonly pool: number;
  private readonly pose = newPose();
  readonly anchor: Anchor;

  constructor(
    scene: Phaser.Scene,
    private readonly specs: readonly HoverSpec[],
    private readonly options: LayerOptions,
  ) {
    this.anchor = onLayer(options.layer);
    this.pool = options.series?.pool ?? 1;
    this.spots = Array.from({ length: this.pool }, newSpot);
    this.objects = Array.from({ length: this.pool * specs.length }, (_, i) => {
      const spec = specs[i % specs.length];
      const image = createImage(scene, spec?.texture ?? '');
      if (spec?.origin) image.setOrigin(spec.origin[0], spec.origin[1]);
      if (spec?.tint !== undefined) image.setTint(spec.tint);
      return image.setVisible(false);
    });
  }

  update(ctx: FrameCtx): void {
    const { series, mirror, fadeDown, layer, fit, skipStart } = this.options;
    const down = ctx.layerDown[layer] ?? 0;
    const first = this.specs[0];
    if (!first) return;
    const fitted = fit ? fit(ctx.width, ctx.height) : null;
    const scale = fitted?.scale ?? 1;
    const halfH = this.options.halfH * scale;
    const specY = first.at.y * ctx.height + (first.offset?.y ?? 0);
    const y0 = fitted ? fitted.y : specY;
    const rowMuted = this.options.rowMute === true;
    const left = skipStart?.(ctx.width, ctx.height) === true;
    const count = this.specs.length;
    const fade = fadeDown ? fadeDown(down) : 1;
    for (let slot = 0; slot < this.pool; slot++) {
      const n = series ? slotCopy(slot, series, y0, down, ctx.height) : 0;
      const rise = series ? seriesRise(n, series, ctx.height) : 0;
      const spot = this.spots[slot];
      if (!spot) continue;
      // A copy far off the screen is only hidden: no pose is worked out for it.
      const centreY = y0 + down - rise;
      const reach = halfH + WALL_LOOK.offscreenSlackPx;
      if (
        fade <= 0 ||
        (fit && !fitted) ||
        (left && n === 0) ||
        centreY + reach < 0 ||
        centreY - reach > ctx.height
      ) {
        spot.alpha = 0;
        for (let k = 0; k < count; k++) this.objects[slot * count + k]?.setVisible(false);
        continue;
      }
      const mirrored = mirror === true && copyMirrored(n);
      for (let k = 0; k < count; k++) {
        const spec = this.specs[k];
        const image = this.objects[slot * count + k];
        if (!spec || !image) continue;
        const pose = hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose);
        if (mirrored) pose.x = ctx.width - pose.x;
        if (fitted) pose.y += y0 - specY;
        pose.alpha *= fade;
        pose.scaleX *= scale;
        pose.scaleY *= scale;
        const shown = rideLayer(pose, this.anchor, ctx, ctx.height, halfH, rise, !rowMuted);
        if (rowMuted) pose.alpha *= rowMute(pose.y, halfH, ctx.flightRow, WALL_LOOK.featherPx);
        applyPose(image, pose);
        image.setFlipX(mirrored);
        image.setVisible(shown);
        if (k === 0) {
          spot.x = pose.x;
          spot.y = pose.y;
          spot.mirrored = mirrored;
          spot.alpha = pose.alpha / (spec.alpha ?? 1);
          spot.scale = scale;
        }
      }
    }
  }
}
