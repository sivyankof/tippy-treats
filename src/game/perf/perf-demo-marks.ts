import type { PlacedLayer } from '../../core/sim-types';
import { PERF_STEPS } from '../../data/perf';
import { SQUASH_TEXTURES, TOPPER_SQUASH } from '../../data/topper-squash';
import { stainOrigin, stainPictureSize } from '../fx/squash-textures';
import { layerStainSpot } from '../fx/topper-squash-fx';
import { layerMarks } from '../objects/layer-marks';
import { currentSegment, perfSession } from './perf-session';

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
    const spot = layerStainSpot(layer.width, null, i, i % 2 === 0 ? 1 : -1);
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

/**
 * Steps the starting tower of a `steps` segment in place: layers narrow in steps and stand off-centre to alternate sides, so
 * the ledges on both sides are wide enough for snow drifts. The top layers stay as they are.
 */
export function stepTower(layers: PlacedLayer[]): void {
  const { period, narrowing, shiftShare, untouchedTop } = PERF_STEPS;
  layers.slice(0, Math.max(0, layers.length - untouchedTop)).forEach((layer, i) => {
    const phase = i % period;
    const width = layer.width;
    layer.width = Math.round(width * (1 - narrowing * phase));
    layer.x += (phase % 2 === 0 ? -1 : 1) * width * shiftShare;
  });
}

/** What the benchmark does to the starting tower of the run about to begin: demo stains (`&marks=1` or a `marks` segment) and steps. */
export function prepareStartTower(layers: PlacedLayer[]): void {
  const def = currentSegment();
  // Steps first: the stains are placed by the width of each layer as it stands.
  if (def?.steps) stepTower(layers);
  if (perfSession()?.params.marks || def?.marks) leaveDemoMarks(layers);
}
