import { describe, expect, it } from 'vitest';
import { CREATURE_STYLE } from '../../../data/creature-style';
import { layerBox } from '../layer-draw';
import { glossMarkFor } from './flat-draw';
import { twinsGlossSpot } from './layered';

describe('glossMarkFor', () => {
  it('keeps the stroke and the dot inside a wide layer', () => {
    const box = layerBox(500);
    const mark = glossMarkFor(box);
    expect(mark).not.toBeNull();
    const end = mark!.x + mark!.length / 2 + mark!.dotGap + mark!.dotRadius * 2;
    expect(mark!.x - mark!.length / 2).toBeGreaterThanOrEqual(box.left);
    expect(end).toBeLessThan(box.right);
    expect(mark!.length).toBe(CREATURE_STYLE.gloss.length);
  });

  it('shrinks on a narrow layer and keeps the same proportions', () => {
    const box = layerBox(120);
    const mark = glossMarkFor(box)!;
    expect(mark.length).toBeLessThan(CREATURE_STYLE.gloss.length);
    expect(mark.thick / mark.length).toBeCloseTo(
      CREATURE_STYLE.gloss.thick / CREATURE_STYLE.gloss.length,
    );
  });

  it('draws nothing when the layer is too small', () => {
    expect(glossMarkFor(layerBox(30))).toBeNull();
  });

  it('is bigger with a scale', () => {
    const box = layerBox(500);
    expect(glossMarkFor(box, 2)!.length).toBeGreaterThan(glossMarkFor(box)!.length);
  });

  it('ends before a face when asked to clear it', () => {
    const box = layerBox(500);
    const clearTo = -120;
    const mark = glossMarkFor(box, 1, { clearTo })!;
    expect(mark.x + mark.length / 2 + mark.dotGap + mark.dotRadius * 2).toBeLessThanOrEqual(
      clearTo,
    );
    expect(glossMarkFor(box, 1, { clearTo: box.left + 20 })).toBeNull();
  });

  it('can sit lower than the default spot', () => {
    const box = layerBox(500);
    expect(glossMarkFor(box, 1, { y: 40 })!.y).toBe(box.top + 40);
  });
});

describe('twinsGlossSpot', () => {
  it('always leaves the Twins a gloss, at the usual width or lower down', () => {
    for (const width of [180, 300, 420]) {
      const box = layerBox(width);
      expect(glossMarkFor(box, 1, twinsGlossSpot(width))).not.toBeNull();
    }
  });
});
