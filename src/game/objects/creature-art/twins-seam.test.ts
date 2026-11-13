import { describe, expect, it } from 'vitest';
import { CREATURE_LOOKS } from '../../../data/creature-looks';
import { layerBox } from '../layer-draw';
import { twinsSeam } from './twins-seam';

describe('twinsSeam', () => {
  const recipe = CREATURE_LOOKS.twins.art;
  if (recipe.kind !== 'twins') throw new Error('twins recipe expected');

  it('puts the cream strip in the middle of the layer', () => {
    const box = layerBox(400);
    const seam = twinsSeam(box, recipe);
    expect(Math.abs(seam.mid)).toBeLessThan(box.innerH * 0.1);
    expect(seam.bottom - seam.top).toBeCloseTo(box.innerH * recipe.creamShare, 10);
  });

  it('keeps the strip inside the body and the middle between its edges', () => {
    const box = layerBox(250);
    const seam = twinsSeam(box, recipe);
    expect(seam.top).toBeGreaterThan(box.innerTop);
    expect(seam.bottom).toBeLessThan(box.innerBottom);
    expect(seam.mid).toBeCloseTo((seam.top + seam.bottom) / 2, 10);
  });

  it('does not depend on the width of the layer', () => {
    expect(twinsSeam(layerBox(200), recipe)).toEqual(twinsSeam(layerBox(500), recipe));
  });
});
