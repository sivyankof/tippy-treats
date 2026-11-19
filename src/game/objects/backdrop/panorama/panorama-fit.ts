import { ANIM } from '../../../../data/common/anim';
import { BALANCE } from '../../../../data/tower/balance';
import { PANORAMA } from '../../../../data/weather/window-look';
import { rampBetween, smoothstep } from '../../../../util/math';
import { safeBand } from '../../../app/safe-area';
import { FLYING_REACH, hudFloor } from '../../../run/camera-layout';

/** Where the panoramic window stands on the start view of a screen: its centre y and the scale of its picture. */
export interface PanoramaFit {
  y: number;
  scale: number;
}

/** Screen y the flying layer's reach starts at on the start view (its top when it bobs highest above the tower). */
export function startViewFlightTop(screenH: number): number {
  const L = PANORAMA.layout;
  const towerTop =
    screenH -
    safeBand().bottom -
    ANIM.camera.trayBottomOffset -
    L.towerLayers * BALANCE.layer.height;
  // The layer's outline, its sway and the tray's own height reach a little higher than the nominal reach.
  return towerTop - FLYING_REACH - L.reachExtraPx;
}

/**
 * The panoramic window between the lowest HUD plate (plus the gap) and the flying layer of the start view, centred in that
 * room, at full size when it fits; smaller on a short screen. `null` when it would be smaller than `minScale` (or the
 * screen is too narrow): the small window stays then.
 */
export function panoramaFit(screenW: number, screenH: number): PanoramaFit | null {
  const L = PANORAMA.layout;
  const top = hudFloor();
  const bottom = startViewFlightTop(screenH) - L.flightGapPx;
  const room = bottom - top;
  const scale = Math.min(1, room / PANORAMA.height, (screenW * 0.6) / PANORAMA.width);
  if (scale < L.minScale) return null;
  const height = PANORAMA.height * scale;
  return { y: top + (room - height) * L.centreShare + height / 2, scale };
}

let cachedW = -1;
let cachedH = -1;
let cached: PanoramaFit | null = null;

/** `panoramaFit`, kept for the last screen size so the per-frame call allocates nothing. */
export function panoramaFitCached(screenW: number, screenH: number): PanoramaFit | null {
  if (screenW !== cachedW || screenH !== cachedH) {
    cachedW = screenW;
    cachedH = screenH;
    cached = panoramaFit(screenW, screenH);
  }
  return cached;
}

/**
 * Fills `out` with the row the incoming layer flies in: its highest reach above the tower top (`FLYING_REACH`) down to the
 * lowest point of its bob. `traySurfaceY` is where the tray top stands on the screen now, `layers` the layers placed.
 */
export function flightRowAt(
  out: { top: number; bottom: number; towerTop: number },
  traySurfaceY: number,
  layers: number,
): { top: number; bottom: number; towerTop: number } {
  const towerTop = traySurfaceY - layers * BALANCE.layer.height;
  out.towerTop = towerTop;
  out.top = towerTop - FLYING_REACH;
  out.bottom = towerTop - BALANCE.layer.gapAboveTower + ANIM.flying.bobAmplitude;
  return out;
}

/**
 * Alpha factor of the panoramic window while the incoming layer flies in front of it: 1 when the window (centre `y`, half
 * height `halfH`) is `feather` px or more clear of the row, `PANORAMA.rowMuted` where they overlap, between over the feather.
 */
export function rowMute(
  y: number,
  halfH: number,
  row: { top: number; bottom: number },
  feather: number,
): number {
  const away = Math.max(row.top - (y + halfH), y - halfH - row.bottom, 0);
  const near = 1 - Math.min(1, away / feather);
  return 1 - (1 - PANORAMA.rowMuted) * near;
}

/**
 * Alpha factor of the panoramic window as the tower covers it: 1 while at least `cover.fullAt` of its height (from the
 * top) stands above the tower top, falling smoothly to 0 at `cover.goneAt`, so a window the tower almost hides is gone
 * and does not sit on the top layer like a cap.
 */
export function coverFade(y: number, halfH: number, towerTop: number): number {
  const { fullAt, goneAt } = PANORAMA.cover;
  const visible = Math.min(1, Math.max(0, (towerTop - (y - halfH)) / (2 * halfH)));
  return smoothstep((visible - goneAt) / (fullAt - goneAt));
}

/** Share (0..1) of the full mute in a `rowMute` alpha factor: 0 clear of the row, 1 where the row overlaps the window. */
export function muteShare(mute: number): number {
  return (1 - mute) / (1 - PANORAMA.rowMuted);
}

/**
 * Alpha of the moon of the night window: it goes before the window does (gone while the window still has
 * `moon.goneAt` of its alpha) and keeps `moon.mutedAlpha` of it while the window is fully muted (`muted` 0..1).
 */
export function moonAlpha(windowAlpha: number, muted: number): number {
  const { goneAt, mutedAlpha } = PANORAMA.moon;
  return windowAlpha * rampBetween(windowAlpha, goneAt, 1) * (1 - (1 - mutedAlpha) * muted);
}

/**
 * Alpha share of the bolt in the window flash at flash `strength` (0..1): all or nothing, so it never shows half
 * see-through. On the rise (`rising`) it is whole once the light has `bolt.riseAt` of its peak; on the fall it goes out
 * once the light drops below `bolt.fallAt`, well before the light does.
 */
export function boltShare(strength: number, rising: boolean): number {
  const { riseAt, fallAt } = PANORAMA.flash.bolt;
  return strength >= (rising ? riseAt : fallAt) ? 1 : 0;
}
