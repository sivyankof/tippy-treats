import { TOWER_WEATHER } from '../../data/tower-weather';
import { WEATHER_LOOK } from '../../data/weather-look';
import { smoothstep } from '../../util/math';

const DRIFT = TOWER_WEATHER.drift;

/** The open top of a layer on one side of the layer above it: where a drift lies (layer-local px). */
export interface Ledge {
  /** Width of the whole ledge (corner of the layer to the seam), 0 when the layer above covers it. */
  width: number;
  /** Centre of the drift on the ledge, from the centre of the layer. */
  centerX: number;
  /** Width the drift covers (the ledge less the inset at the corner and at the seam). */
  span: number;
}

/**
 * The ledge of a layer `width` wide on `side` (-1 left, 1 right) when the layer above it is `upperWidth`
 * wide and stands `upperDx` to the right of it. `out` is filled and returned; a ledge too narrow for a drift
 * (`DRIFT.minLedgePx`) or covered comes back with a zero width.
 */
export function ledgeOf(
  width: number,
  upperWidth: number,
  upperDx: number,
  side: -1 | 1,
  out: Ledge,
): Ledge {
  const edge = side * (width / 2);
  const seam = upperDx + side * (upperWidth / 2);
  const ledge = side * (edge - seam);
  const span = ledge - 2 * DRIFT.insetPx;
  if (ledge < DRIFT.minLedgePx || span <= 0) {
    out.width = 0;
    out.span = 0;
    out.centerX = 0;
    return out;
  }
  out.width = ledge;
  out.span = span;
  out.centerX = (edge + seam) / 2;
  return out;
}

/** Index of the baked picture closest to a drift `span` wide (the widths are in `DRIFT.pictureWidths`). */
export function driftPictureIndex(span: number): number {
  const widths = DRIFT.pictureWidths;
  let best = 0;
  for (let i = 1; i < widths.length; i++) {
    if (Math.abs(widths[i]! - span) < Math.abs(widths[best]! - span)) best = i;
  }
  return best;
}

/** Thickness of a drift `span` wide: proportional to it, at least `minThicknessPx`, at most a share of the snow cap. */
export function driftThickness(span: number): number {
  const most = DRIFT.maxShareOfCap * WEATHER_LOOK.cap.radius;
  return Math.min(most, Math.max(DRIFT.minThicknessPx, span * DRIFT.thicknessPerPx));
}

/**
 * How far a drift has grown (0..1): it builds up like the cap, over `WEATHER_LOOK.cap.growMs` on the same curve, and
 * squashes away over `DRIFT.squashMs` when its ledge is covered. `grow` is the state, `present` whether the ledge is
 * open, `instant` skips the build-up (the lite level, a layer back on screen).
 */
export function driftGrowStep(
  grow: number,
  present: boolean,
  dtMs: number,
  instant: boolean,
): number {
  if (present) {
    if (instant) return 1;
    return Math.min(1, grow + dtMs / WEATHER_LOOK.cap.growMs);
  }
  return Math.max(0, grow - dtMs / DRIFT.squashMs);
}

/** The shape of the build-up and of the squash for the state returned by `driftGrowStep`. */
export function driftShown(grow: number): number {
  return smoothstep(grow);
}
