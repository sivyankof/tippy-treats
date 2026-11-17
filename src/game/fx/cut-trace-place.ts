import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { CUT_LOOK } from '../../data/cut-look';
import { cutStripWidth, glazeWave, waveY } from '../objects/glaze-wave';
import { layerBox } from '../objects/layer-draw';
import { faceHalfSpan } from './glaze-growth';

/** Where the drop that stays on a cut hangs: its top middle, from the layer centre. */
export interface TraceSpot {
  dx: number;
  dy: number;
}

/**
 * The drop that stays on the cut edge of a layer `width` wide (the cut on `side`, 1 right): a
 * picture `outer` px across hanging from the glaze edge just inside the sponge of the cut, so it
 * never covers the side outline or the sponge strip. A plain layer has a wavy glaze edge (the drop
 * hangs from it where it is lowest under the drop); any other one a straight glaze bottom.
 */
export function traceSpot(width: number, side: 1 | -1, outer: number, plain: boolean): TraceSpot {
  const { trace } = CUT_LOOK.strands;
  const box = layerBox(width);
  const r = outer / 2;
  const strip = cutStripWidth(box);
  const wave = plain
    ? glazeWave(box, side === 1 ? 'right' : 'left', faceHalfSpan(width, null))
    : null;
  // The glaze ends where the sponge of the cut begins.
  const glazeEnd = wave ? (side === 1 ? wave.right : wave.left) : side * (box.innerRight - strip);
  // Never past the middle of a very narrow layer.
  const reach = Math.max(0, side * glazeEnd - trace.gapPx - r);
  const dx = side * reach;
  const edge = wave
    ? Math.max(waveY(wave, dx - r), waveY(wave, dx), waveY(wave, dx + r))
    : -BALANCE.layer.height / 2 + BALANCE.layer.height * ANIM.layer.glazeDepth;
  return { dx, dy: edge - outer * trace.aboveShare };
}

/**
 * Y of a point `upPx` above the bottom edge of a layer whose bottom edge is at `bottomY` and that
 * is squashed to `scaleY` around it (the landing squash): a drop that runs down a cut edge rides
 * the layer's squash, so it never hangs in the air above a squashed layer.
 */
export function squashedY(bottomY: number, upPx: number, scaleY: number): number {
  return bottomY - upPx * scaleY;
}
