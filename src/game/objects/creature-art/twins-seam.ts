import type { Recipe } from './primitives';
import type { LayerBox } from '../layer-draw';

/** The cream strip of the macaron, as y coordinates around the layer centre. */
export interface TwinsSeam {
  top: number;
  bottom: number;
  /** Middle of the strip: where the layer comes apart. */
  mid: number;
}

/** Where the cream strip of a twins layer lies in `box`. */
export function twinsSeam(box: LayerBox, recipe: Recipe<'twins'>): TwinsSeam {
  const top = box.innerTop + box.innerH * recipe.topShare;
  const bottom = top + box.innerH * recipe.creamShare;
  return { top, bottom, mid: (top + bottom) / 2 };
}
