import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { artRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import { BALANCE } from '../../data/balance';
import { LAYER_COLORS, type LayerColors } from '../../data/palette';
import { bakeTexture } from '../ui/bake-texture';
import { drawCreatureLayer } from './creature-art';
import {
  drawBody,
  drawGloss,
  drawGlaze,
  drawShadow,
  drawSponge,
  layerBox,
  SHADOW_DROP,
} from './layer-draw';

/** Empty pixels around the art so antialiased edges are not cut. */
const SIDE_PAD = 2;
/** Space under the layer for its shadow. */
const SHADOW_MARGIN = Math.ceil(SHADOW_DROP + ANIM.layer.shadowHeight / 2) + 1;

/** Index into the colour table for a 1-based layer number. */
export function colorIndexFor(layerIndex: number): number {
  const n = LAYER_COLORS.length;
  return (((layerIndex - 1) % n) + n) % n;
}

/** Colours of the layers with this colour-table index (see `colorIndexFor`). */
export function layerColors(colorIndex: number): LayerColors {
  return LAYER_COLORS[colorIndex] ?? LAYER_COLORS[0]!;
}

/** Whole-pixel width the art is baked at. */
export function artWidth(width: number): number {
  return Math.max(1, Math.round(width));
}

const CUT_SUFFIX: Readonly<Record<CutSide | 'none', string>> = { none: 'n', left: 'l', right: 'r' };

/**
 * Texture key of a baked layer: `layer_<colour>_<width>_<cut>` for a plain layer and
 * `layer_c_<creature>_<width>_<cut>` for a creature (its look does not depend on the colour table).
 */
export function layerArtKey(
  colorIndex: number,
  creature: CreatureId | null,
  width: number,
  cut: CutSide | null,
): string {
  const who = creature ? `c_${creature}` : String(colorIndex);
  return `layer_${who}_${artWidth(width)}_${CUT_SUFFIX[cut ?? 'none']}`;
}

/** Pixels the picture reaches above the top edge of the layer (never less than the shadow margin). */
export function artTopPad(creature: CreatureId | null): number {
  return Math.max(SHADOW_MARGIN, creature ? artRecipe(creature).topPad : 0);
}

/** Height of the baked picture: the room above the layer, the layer, the room for its shadow. */
export function artHeight(creature: CreatureId | null): number {
  return artTopPad(creature) + BALANCE.layer.height + SHADOW_MARGIN;
}

/** Origin y (0..1) of the baked picture: it puts the centre of the layer body on the image position. */
export function artOriginY(creature: CreatureId | null): number {
  return (artTopPad(creature) + BALANCE.layer.height / 2) / artHeight(creature);
}

/** Opacity of the baked picture: 1 except for the see-through creatures (jelly, meringue). */
export function artAlpha(creature: CreatureId | null): number {
  if (!creature) return 1;
  const recipe = artRecipe(creature);
  return 'alpha' in recipe ? recipe.alpha : 1;
}

/** Shadow, body, glaze with drips, cut sponge and gloss around the origin of `g`. */
function drawPlainLayer(
  g: Phaser.GameObjects.Graphics,
  width: number,
  colors: LayerColors,
  cut: CutSide | null,
): void {
  const box = layerBox(width);
  drawShadow(g, box);
  drawBody(g, box, colors.cake);
  drawGlaze(g, box, colors.glaze);
  if (cut) drawSponge(g, cut, colors.cake, box);
  drawGloss(g, box);
}

// Baked layer textures are shared by every view. A texture is kept while any view
// shows it; unused ones stay for a while (widths repeat after perfect landings) and
// the oldest are removed beyond ANIM.pool.idleLayerTextures. Map order is use order.
const refs = new Map<string, number>();

/**
 * Bakes (or finds) the art for a colour (or a creature), width and cut side (`null`: an intact
 * layer) and counts one more user of it. The layer body sits at `artOriginY(creature)` of the picture.
 */
export function acquireLayerArt(
  scene: Phaser.Scene,
  colorIndex: number,
  width: number,
  cut: CutSide | null,
  creature: CreatureId | null = null,
): string {
  const w = artWidth(width);
  const key = layerArtKey(colorIndex, creature, w, cut);
  const top = artTopPad(creature);
  const texW = 2 * Math.ceil((w + SIDE_PAD * 2) / 2);
  const texH = artHeight(creature);
  bakeTexture(scene, key, texW, texH, (g) => {
    g.translateCanvas(texW / 2, top + BALANCE.layer.height / 2);
    if (creature) drawCreatureLayer(g, creature, w, cut);
    else drawPlainLayer(g, w, layerColors(colorIndex), cut);
  });
  const users = refs.get(key) ?? 0;
  refs.delete(key);
  refs.set(key, users + 1);
  return key;
}

/** Gives a texture back; unused textures beyond the idle limit are removed. */
export function releaseLayerArt(scene: Phaser.Scene, key: string): void {
  const users = refs.get(key);
  if (users === undefined) return;
  refs.set(key, users - 1);
  let idle = [...refs].filter(([, count]) => count <= 0);
  for (const [oldKey] of idle) {
    if (idle.length <= ANIM.pool.idleLayerTextures) break;
    refs.delete(oldKey);
    scene.textures.remove(oldKey);
    idle = idle.filter(([k]) => k !== oldKey);
  }
}
