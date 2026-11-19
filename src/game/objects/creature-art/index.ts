import type * as Phaser from 'phaser';
import type { CutSide } from '../../../core/drop';
import { artRecipe, type ArtRecipe } from '../../../data/creatures/creature-looks';
import type { CreatureId } from '../../../data/creatures/creatures';
import type { CreatureStage } from '../../../data/creatures/mastery-look';
import { layerBox } from '../layer-draw';
import { drawBrownie, drawCrumb, drawHoney, drawSprinkle } from './baked';
import { drawCaramel, drawGhost, drawLemon, drawPuff } from './creamy';
import { drawGrownLook, finishGrownLook } from './grown';
import { drawFrosty, drawJelly, drawTwins } from './layered';
import { drawRainbow } from './rainbow';
import { creatureColors, type ArtContext } from './primitives';
import { sleepFaceRect } from '../sleep-eyes';
import { sleepLook } from './sleep-look';

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
 * glaze and the detail above the top edge, then the cut sponge and gloss. `sleeping` draws the muted
 * sleeping silhouette of the creature instead (`sleep-look.ts`). `stage` other than `base` adds
 * the details of the grown look (`grown.ts`) over the finished picture.
 */
export function drawCreatureLayer(
  g: Phaser.GameObjects.Graphics,
  creature: CreatureId,
  width: number,
  cut: CutSide | null,
  sleeping = false,
  stage: CreatureStage = 'base',
): void {
  const real = artRecipe(creature);
  const look = sleeping ? sleepLook(creature, real) : null;
  const recipe = look?.recipe ?? real;
  const ctx: ArtContext = {
    g,
    box: layerBox(width),
    colors: look?.colors ?? creatureColors(creature),
    cut,
    sleeping,
    ...(sleeping ? { face: sleepFaceRect(creature, width) } : {}),
  };
  // The table is keyed by `recipe.kind`, which the type system cannot follow through a lookup.
  (DRAWERS[recipe.kind] as (ctx: ArtContext, recipe: ArtRecipe) => void)(ctx, recipe);
  if (stage !== 'base' && !sleeping) drawGrownLook(ctx, creature, stage);
}

/** Edits the finished canvas of a grown creature picture (the Crumb's bite is cut out of it). */
export const finishCreatureLayer = finishGrownLook;
