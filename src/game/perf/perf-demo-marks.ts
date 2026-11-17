import type { PlacedLayer } from '../../core/sim-types';
import { SQUASH_TEXTURES, TOPPER_SQUASH } from '../../data/topper-squash';
import { faceHalfSpan } from '../fx/glaze-growth';
import { stainOrigin, stainPictureSize } from '../fx/squash-textures';
import { stainSpot } from '../fx/topper-squash-plan';
import { layerMarks } from '../objects/layer-marks';

/** The pictures the demo stains cycle through. */
const TEXTURES = [SQUASH_TEXTURES.stainCherry, SQUASH_TEXTURES.stainStrawberry] as const;

/**
 * `?perf=1&marks=1`: leaves a juice stain on every layer of the starting tower, so the benchmark
 * measures a tall tower whose layers all carry a trace (docs/08, section 9).
 */
export function leaveDemoMarks(layers: readonly PlacedLayer[]): void {
  const [width, height] = stainPictureSize();
  const [originX, originY] = stainOrigin();
  layers.forEach((layer, i) => {
    const spot = stainSpot(layer.width, faceHalfSpan(layer.width, null), i % 2 === 0 ? 1 : -1);
    if (!spot) return;
    layerMarks.addPress(i + 1, [
      {
        texture: TEXTURES[i % TEXTURES.length]!,
        dx: spot.dx,
        dy: spot.dy,
        originX,
        originY,
        width,
        height,
        angleDeg: spot.angleDeg,
        bornMs: 0,
        growMs: TOPPER_SQUASH.stain.growMs,
      },
    ]);
  });
}
