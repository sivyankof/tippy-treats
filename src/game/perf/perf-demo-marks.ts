import type { PlacedLayer } from '../../core/sim-types';
import { SQUASH_TEXTURES, TOPPER_SQUASH } from '../../data/topper-squash';
import { faceHalfSpan } from '../fx/glaze-growth';
import { stainOrigin, stainPictureSize } from '../fx/squash-textures';
import { stainSpot } from '../fx/topper-squash-plan';
import { layerMarks } from '../objects/layer-marks';

/** Colours the demo stains cycle through. */
const TINTS = [0xe8344c, 0xf2465c] as const;

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
        texture: SQUASH_TEXTURES.stain,
        dx: spot.dx,
        dy: spot.dy,
        originX,
        originY,
        width,
        height,
        tint: TINTS[i % TINTS.length],
        angleDeg: spot.angleDeg,
        bornMs: 0,
        growMs: TOPPER_SQUASH.stain.growMs,
      },
    ]);
  });
}
