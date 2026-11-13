import type * as Phaser from 'phaser';
import type { CutSide } from '../../../core/drop';
import { artRecipe, type ArtRecipe } from '../../../data/creature-looks';
import type { CreatureId } from '../../../data/creatures';
import { layerBox } from '../layer-draw';
import { drawBrownie, drawCrumb, drawHoney, drawSprinkle } from './baked';
import { drawCaramel, drawGhost, drawLemon, drawPuff } from './creamy';
import { drawFrosty, drawJelly, drawRainbow, drawTwins } from './layered';
import { creatureColors, type ArtContext } from './primitives';

type Drawers = {
  [K in ArtRecipe['kind']]: (ctx: ArtContext, recipe: Extract<ArtRecipe, { kind: K }>) => void;
};

const DRAWERS: Drawers = {
  honey: drawHoney,
  puff: drawPuff,
  jelly: drawJelly,
  caramel: drawCaramel,
  frosty: drawFrosty,
  brownie: drawBrownie,
  sprinkle: drawSprinkle,
  crumb: drawCrumb,
  ghost: drawGhost,
  twins: drawTwins,
  lemon: drawLemon,
  rainbow: drawRainbow,
};

/**
 * Draws one creature layer of `width` around the origin of `g`: shadow, body, pattern,
 * glaze and the detail above the top edge, then the cut sponge and gloss.
 */
export function drawCreatureLayer(
  g: Phaser.GameObjects.Graphics,
  creature: CreatureId,
  width: number,
  cut: CutSide | null,
): void {
  const recipe = artRecipe(creature);
  const ctx: ArtContext = { g, box: layerBox(width), colors: creatureColors(creature), cut };
  // The table is keyed by `recipe.kind`, which the type system cannot follow through a lookup.
  (DRAWERS[recipe.kind] as (ctx: ArtContext, recipe: ArtRecipe) => void)(ctx, recipe);
}
