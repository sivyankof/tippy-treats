import { describe, expect, it } from 'vitest';
import { artRecipe } from '../../../data/creatures/creature-looks';
import { CREATURE_IDS, CREATURES } from '../../../data/creatures/creatures';
import { luminance, parseHex, toHsl } from '../../../util/color';
import { mutedPalette, mutedRecipe } from './sleep-look';

describe('mutedPalette', () => {
  it('keeps the hue of the creature and mutes it', () => {
    for (const id of CREATURE_IDS) {
      const real = CREATURES[id].palette;
      const muted = mutedPalette(real);
      const realOutline = toHsl(parseHex(real.outline));
      const body = toHsl(parseHex(muted.body));
      const hueGap = Math.abs(body.h - realOutline.h);
      expect(Math.min(hueGap, 1 - hueGap)).toBeLessThan(0.02);
      expect(body.s).toBeLessThan(realOutline.s);
      expect(luminance(parseHex(muted.outline))).toBeLessThan(luminance(parseHex(muted.body)));
    }
  });

  it('leaves two tones: the pattern colours take the body and glaze tones', () => {
    for (const id of CREATURE_IDS) {
      const muted = mutedPalette(CREATURES[id].palette);
      expect(muted.glaze).not.toBe(muted.body);
      expect([muted.accent, muted.sponge]).toEqual([muted.body, muted.body]);
      expect(muted.detail).toBe(muted.glaze);
    }
  });

  it('gives every creature its own body tone', () => {
    const bodies = new Set(CREATURE_IDS.map((id) => mutedPalette(CREATURES[id].palette).body));
    expect(bodies.size).toBe(CREATURE_IDS.length);
  });
});

describe('mutedRecipe', () => {
  it('turns the colourful lists of sprinkles and rainbow into the muted tones', () => {
    const sprinkle = mutedRecipe(artRecipe('sprinkle'), mutedPalette(CREATURES.sprinkle.palette));
    const rainbow = mutedRecipe(artRecipe('rainbow'), mutedPalette(CREATURES.rainbow.palette));
    if (sprinkle.kind !== 'sprinkle' || rainbow.kind !== 'rainbow') throw new Error('kind');
    expect(new Set(sprinkle.sprinkleColors).size).toBe(1);
    expect(new Set(rainbow.bands).size).toBe(1);
  });

  it('leaves other recipes as they are', () => {
    const recipe = artRecipe('honey');
    expect(mutedRecipe(recipe, mutedPalette(CREATURES.honey.palette))).toBe(recipe);
  });
});
