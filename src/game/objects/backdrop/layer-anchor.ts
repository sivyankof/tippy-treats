import { ANIM } from '../../../data/anim';
import { BACKDROP } from '../../../data/backdrop';
import { WALL_LOOK } from '../../../data/window-look';
import type { ZoneId } from '../../../data/zones';
import { TWO_PI } from '../../../util/math';
import { flightClearBand, hudKeepOutFade } from '../../camera-layout';
import type { Pose } from './life-motion';

/**
 * Why a life of the scenery stands in screen space and does not scroll: only what flies or is far away, never a thing that
 * hangs on a wall or stands on a roof. The unit test of the zones lists which life classes may take which reason.
 */
export type SkyKind =
  'traveler' | 'twinkles' | 'moon' | 'planet' | 'visitor' | 'mountains' | 'weather';

/**
 * Where a life of a zone stands: on one of the four parallax layers (it scrolls with it and sways with it), in the sky (it
 * crosses the screen or is far away), or fixed on the screen (the counter with the mug; no zone life is).
 */
export type Anchor =
  | { readonly kind: 'layer'; readonly layer: number }
  | { readonly kind: 'sky'; readonly why: SkyKind }
  | { readonly kind: 'fixed' };

export const onLayer = (layer: number): Anchor => ({ kind: 'layer', layer });
/** The counter with the mug: the only thing that stands still on the screen. */
export const FIXED: Anchor = { kind: 'fixed' };
export const inSky = (why: SkyKind): Anchor => ({ kind: 'sky', why });

/** What a frame says about the four parallax layers of the zone being drawn. */
export interface LayerFrame {
  /** Px each layer has moved down since the zone's start view (0 there and in the menus). */
  layerDown: number[];
  /** Sideways position of each layer's texture (px): what a swaying layer's `tilePositionX` is; 0 for the others. */
  layerSwayX: number[];
}

export function newLayerFrame(): LayerFrame {
  return { layerDown: [0, 0, 0, 0], layerSwayX: [0, 0, 0, 0] };
}

/** How far (px) layer `layer` has moved down since the start view, for the camera at `scrollY` (the start view had `originScrollY`). */
export function layerDownAt(layer: number, scrollY: number, originScrollY: number): number {
  return (originScrollY - scrollY) * (ANIM.parallax[layer] ?? 1);
}

/** Sideways position of the texture of a swaying layer (px) at `timeMs`; `null` when the layer drifts instead. */
export function layerSwayAt(zone: ZoneId, layer: number, timeMs: number): number | null {
  const sway = BACKDROP.sway[zone][layer];
  return sway ? sway.px * Math.sin((TWO_PI * timeMs) / sway.periodMs) : null;
}

/** Fills `frame` for a zone at the camera `scrollY` and `timeMs`. */
export function fillLayerFrame(
  frame: LayerFrame,
  zone: ZoneId,
  scrollY: number,
  originScrollY: number,
  timeMs: number,
): void {
  for (let layer = 0; layer < frame.layerDown.length; layer++) {
    frame.layerDown[layer] = layerDownAt(layer, scrollY, originScrollY);
    frame.layerSwayX[layer] = layerSwayAt(zone, layer, timeMs) ?? 0;
  }
}

/** Sideways shift (px) of a thing standing on layer `layer`: the texture moves by its sway, so the things on it move the other way. */
export function layerDriftX(frame: LayerFrame, layer: number): number {
  return -(frame.layerSwayX[layer] ?? 0);
}

/** Where a point of layer `layer` stands on the screen: `anchor` is its place on the start view. Same as a point of the layer's texture. */
export function layerPoint(
  anchorX: number,
  anchorY: number,
  frame: LayerFrame,
  layer: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = anchorX + layerDriftX(frame, layer);
  out.y = anchorY + (frame.layerDown[layer] ?? 0);
  return out;
}

let bandHeight = -1;
const band = { top: 0, bottom: 0 };

/**
 * Alpha factor of a thing on a layer at (`x`, `y`) with its picture `halfH` px tall to each side: things that pass under a HUD
 * plate or through the row of the flying layer keep `WALL_LOOK.muted` of their alpha, coming back over `featherPx`. `moved`
 * (0..1) is how far the layer has scrolled: the start view, where the things stand, is not muted.
 */
export function layerMute(
  x: number,
  y: number,
  halfH: number,
  screenH: number,
  moved: number,
): number {
  if (moved === 0) return 1;
  if (screenH !== bandHeight) {
    bandHeight = screenH;
    Object.assign(band, flightClearBand(screenH));
  }
  const { muted, featherPx } = WALL_LOOK;
  const plate = hudKeepOutFade(x, y, halfH * 0.5, featherPx);
  const row = Math.min(1, Math.max(band.top - (y + halfH), y - halfH - band.bottom, 0) / featherPx);
  return 1 - (1 - Math.min(plate, row)) * (1 - muted) * moved;
}

/**
 * Moves a pose of a life by what its anchor says: on a layer, down with the layer and sideways with its sway, and muted
 * under the HUD. `rise` (px) lifts a repeat of a series up the layer; it is not part of the layer's scroll, so the mute
 * ramp ignores it. Returns whether any part of the picture (`halfH` px tall to each side, HALF its height) is on the
 * screen. Other anchors leave the pose alone.
 */
export function rideLayer(
  pose: Pose,
  anchor: Anchor,
  frame: LayerFrame,
  screenH: number,
  halfH: number,
  rise = 0,
): boolean {
  if (anchor.kind !== 'layer') return true;
  const down = frame.layerDown[anchor.layer] ?? 0;
  pose.x += layerDriftX(frame, anchor.layer);
  pose.y += down - rise;
  pose.alpha *= layerMute(
    pose.x,
    pose.y,
    halfH,
    screenH,
    Math.min(1, Math.abs(down) / WALL_LOOK.muteRampPx),
  );
  return pose.y + halfH > 0 && pose.y - halfH < screenH;
}

/** How often a thing repeats on its layer: the screens from the start copy to the second copy, then between copies. */
export interface LayerSeries {
  firstGap: number;
  spacing: number;
  pool: number;
}

/** Px above the start copy at which copy `n` of a series stands on a screen `height` tall. */
export function seriesRise(n: number, series: LayerSeries, height: number): number {
  return n <= 0 ? 0 : (series.firstGap + (n - 1) * series.spacing) * height;
}

/**
 * The copy that pool slot `slot` shows now: of the copies with `n % pool === slot` the one nearest the middle of the
 * screen, so a slot always has the same side and a copy leaving at the bottom is replaced by the next one above.
 * `y0` is the start copy's centre on the start view.
 */
export function slotCopy(
  slot: number,
  series: LayerSeries,
  y0: number,
  down: number,
  height: number,
): number {
  const rise = y0 + down - height / 2;
  const star = 1 + (rise / height - series.firstGap) / series.spacing;
  const m = Math.max(0, Math.round((star - slot) / series.pool));
  return slot + m * series.pool;
}

/** Odd copies stand on the other side of the tower. */
export function copyMirrored(n: number): boolean {
  return n % 2 === 1;
}
