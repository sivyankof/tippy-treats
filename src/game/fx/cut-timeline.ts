import { CUT_LOOK } from '../../data/cut-look';
import { clamp01, lerp, smoothstep } from '../../util/math';

/** Spin of a piece in degrees per second: fast when narrow, slow when big. */
export function cutSpinDegPerSec(width: number): number {
  const { narrowPx, widePx, narrowDegPerSec, wideDegPerSec } = CUT_LOOK.spin;
  return lerp(narrowDegPerSec, wideDegPerSec, clamp01((width - narrowPx) / (widePx - narrowPx)));
}

/** Opacity of a piece at `progress` of its life: solid, then fading out smoothly in the last part only. */
export function cutPieceAlpha(progress: number, fadeFrom: number): number {
  return 1 - smoothstep((progress - fadeFrom) / (1 - fadeFrom));
}

/** How far the anticipation pose has come (0 rest, 1 sagged), `ageMs` after the piece appeared. */
export function sagAmount(ageMs: number): number {
  const { anticipationMs, sagRecoverMs } = CUT_LOOK;
  if (ageMs < anticipationMs) return smoothstep(ageMs / anticipationMs);
  return 1 - smoothstep((ageMs - anticipationMs) / sagRecoverMs);
}
