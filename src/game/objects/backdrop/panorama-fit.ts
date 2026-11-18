import { ANIM } from '../../../data/anim';
import { BALANCE } from '../../../data/balance';
import { PANORAMA } from '../../../data/window-look';
import { FLYING_REACH, hudFloor } from '../../camera-layout';

/** Where the panoramic window stands on the start view of a screen: its centre y and the scale of its picture. */
export interface PanoramaFit {
  y: number;
  scale: number;
}

/** Screen y the flying layer's reach starts at on the start view (its top when it bobs highest above the tower). */
export function startViewFlightTop(screenH: number): number {
  const L = PANORAMA.layout;
  const towerTop = screenH - ANIM.camera.trayBottomOffset - L.towerLayers * BALANCE.layer.height;
  return towerTop - FLYING_REACH;
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
  out: { top: number; bottom: number },
  traySurfaceY: number,
  layers: number,
): { top: number; bottom: number } {
  const towerTop = traySurfaceY - layers * BALANCE.layer.height;
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
