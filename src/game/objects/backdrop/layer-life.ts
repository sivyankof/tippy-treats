import * as Phaser from 'phaser';
import type { HoverSpec } from '../../../data/backdrop/backdrop-life';
import { PANORAMA, WALL_LOOK } from '../../../data/weather/window-look';
import { applyPose, createImage, type FrameCtx, type Life } from './life';
import { hoverPose, newPose } from './life-motion';
import { mixColor } from '../../../util/color';
import { EasedValue } from '../../../util/eased-value';
import { coverFade, muteShare, rowMute } from './panorama-fit';

const WHITE = 0xffffff;
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
  /** `rowMute` things: the tint the mute by the flight row gives them now (white when clear). */
  tint: number;
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
  /**
   * With `rowMute`: mute by tint (multiply towards this tone at the full mute) and not by alpha, so pictures that overlap a
   * little (`seamPx`) never show the overlap through a translucent picture.
   */
  muteTone?: number;
  /**
   * A fitted picture made of pieces: every piece is drawn this many px wider and taller (from its centre), so the pieces overlap
   * a little and no wall shows through the line between them at a fractional position or scale.
   */
  seamPx?: number;
}

/** Where a fitted thing stands on the start view. */
export interface LayerFit {
  y: number;
  scale: number;
}

function newSpot(): LayerSpot {
  return { x: 0, y: 0, mirrored: false, alpha: 0, scale: 1, tint: WHITE };
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

  /** Set when a fitted thing is covered for good (`rowMute` things): its pictures are destroyed, so their texture can go. */
  private retired = false;
  /** Time (ms) the thing has been covered without a break; -1 while it is not. */
  private coveredSince = -1;
  /**
   * `rowMute` things: the cover fade and the mute share shown now. They follow their targets over time (the tower top
   * and the flight row jump by a layer when one lands); the first frame takes the targets as they are.
   */
  private readonly cover = new EasedValue(PANORAMA.cover.easeMs);
  private readonly muted = new EasedValue(PANORAMA.rowEaseMs);

  /** Moves the shown cover and mute towards this frame's targets for the picture centred at `centre`. */
  private followCover(centre: number, halfH: number, ctx: FrameCtx): void {
    this.cover.follow(coverFade(centre, halfH, ctx.flightRow.towerTop), ctx.deltaMs);
    this.muted.follow(
      muteShare(rowMute(centre, halfH, ctx.flightRow, PANORAMA.rowFeatherPx)),
      ctx.deltaMs,
    );
  }

  update(ctx: FrameCtx): void {
    if (this.retired) return;
    const { series, mirror, fadeDown, layer, fit, skipStart, seamPx, muteTone } = this.options;
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
    let covered = false;
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
        let tint = WHITE;
        const pose = hoverPose(spec, ctx.width, ctx.height, ctx.timeMs, this.pose);
        if (mirrored) pose.x = ctx.width - pose.x;
        // A fitted picture may be made of several specs (pieces): their offsets from its centre scale with it.
        if (fitted) {
          pose.y = y0 + pose.y * scale;
          pose.x = first.at.x * ctx.width + (pose.x - first.at.x * ctx.width) * scale;
        }
        pose.alpha *= fade;
        pose.scaleX *= scale;
        pose.scaleY *= scale;
        const shown = rideLayer(pose, this.anchor, ctx, ctx.height, halfH, rise, !rowMuted);
        if (rowMuted) {
          // The mute and the cover are the picture's as a whole: every piece takes them from the picture's centre.
          if (k === 0)
            this.followCover(fitted ? pose.y - (spec.offset?.y ?? 0) * scale : pose.y, halfH, ctx);
          const muted = this.muted.value;
          if (muteTone === undefined) pose.alpha *= 1 - (1 - PANORAMA.rowMuted) * muted;
          else tint = mixColor(WHITE, muteTone, muted);
          pose.alpha *= this.cover.value;
          covered = this.cover.value <= 0;
        }
        applyPose(image, pose);
        if (muteTone !== undefined) image.setTint(tint);
        if (seamPx && fitted && pose.alpha >= 1) {
          image.setScale(
            image.scaleX * (1 + seamPx / image.displayWidth),
            image.scaleY * (1 + seamPx / image.displayHeight),
          );
        }
        image.setFlipX(mirrored);
        image.setVisible(shown);
        if (k === 0) {
          spot.x = fitted ? pose.x - (spec.offset?.x ?? 0) * scale : pose.x;
          spot.y = fitted ? pose.y - (spec.offset?.y ?? 0) * scale : pose.y;
          spot.mirrored = mirrored;
          spot.alpha = pose.alpha / (spec.alpha ?? 1);
          spot.scale = scale;
          spot.tint = tint;
        }
      }
    }
    // The tower only grows in a run: a window it has covered completely never comes back, so it gives its pictures up.
    // The camera of the run intro passes over the start view first, so it must stay covered for a while.
    if (!covered || !fitted) this.coveredSince = -1;
    else if (this.coveredSince < 0) this.coveredSince = ctx.timeMs;
    else if (ctx.timeMs - this.coveredSince >= WALL_LOOK.retireAfterMs) this.retire();
  }

  private retire(): void {
    this.retired = true;
    for (const spot of this.spots) spot.alpha = 0;
    for (const image of this.objects) image.destroy();
  }
}
