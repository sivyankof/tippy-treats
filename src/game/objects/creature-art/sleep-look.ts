import { CREATURE_SLEEP } from '../../../data/creatures/creature-style';
import type { ArtRecipe } from '../../../data/creatures/creature-looks';
import {
  CREATURES,
  type CreatureId,
  type CreaturePalette,
} from '../../../data/creatures/creatures';
import { cssColor, fromHsl, luminance, parseHex, toHsl } from '../../../util/color';
import { colorsOf, type CreatureColors } from './primitives';

/**
 * The palette of a sleeping creature: every colour of the real one becomes a muted, darker tone of
 * the creature's own hue (taken from its outline, which is always a saturated tone of its colour).
 * Two tones remain, the body and the glaze, so the shape and the glaze wave still read; the
 * pattern colours (accent, detail, sponge) take those same tones and the pattern disappears.
 */
export function mutedPalette(palette: CreaturePalette): CreaturePalette {
  const cfg = CREATURE_SLEEP.palette;
  const { h, s } = toHsl(parseHex(palette.outline));
  const realBody = parseHex(palette.body);
  const lightness = cfg.bodyLightness + (toHsl(realBody).l - 0.5) * cfg.keepLightness;
  const lighterGlaze = luminance(parseHex(palette.glaze)) > luminance(realBody);
  const body = cssColor(fromHsl({ h, s: s * cfg.saturation, l: lightness }));
  const glaze = cssColor(
    fromHsl({
      h,
      s: s * cfg.saturation,
      l: lightness + (lighterGlaze ? cfg.glazeStep : -cfg.glazeStep),
    }),
  );
  const outline = cssColor(fromHsl({ h, s: s * cfg.outlineSaturation, l: cfg.outlineLightness }));
  return { body, glaze, accent: body, detail: glaze, sponge: body, outline };
}

/** The recipe with its own colour lists (sprinkles, rainbow bands) replaced by the muted tones. */
export function mutedRecipe(recipe: ArtRecipe, muted: CreaturePalette): ArtRecipe {
  if (recipe.kind === 'sprinkle') {
    return { ...recipe, sprinkleColors: recipe.sprinkleColors.map(() => muted.glaze) };
  }
  if (recipe.kind === 'rainbow') {
    return { ...recipe, bands: recipe.bands.map(() => muted.body) };
  }
  return recipe;
}

/** What `drawCreatureLayer` draws a sleeping creature from. */
export interface SleepLook {
  colors: CreatureColors;
  recipe: ArtRecipe;
}

const cache = new Map<CreatureId, SleepLook>();

/** The muted colours and recipe of a creature, made once. */
export function sleepLook(id: CreatureId, recipe: ArtRecipe): SleepLook {
  let look = cache.get(id);
  if (!look) {
    const muted = mutedPalette(CREATURES[id].palette);
    look = { colors: colorsOf(muted), recipe: mutedRecipe(recipe, muted) };
    cache.set(id, look);
  }
  return look;
}
