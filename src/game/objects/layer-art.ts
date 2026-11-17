import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { zoneIndexOf } from '../../core/zones';
import { artRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import { BALANCE } from '../../data/balance';
import { GLOW_ZONES, GROWN_LOOKS, type CreatureStage } from '../../data/mastery-look';
import type { LayerColors } from '../../data/palette';
import { PLAIN_LAYER, PLAIN_PAIRS, SPONGES } from '../../data/plain-layers';
import { ZONES } from '../../data/zones';
import { TREASURE } from '../../data/treasure-anim';
import { shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';
import { drawCreatureLayer, finishCreatureLayer } from './creature-art';
import { creatureColors } from './creature-art/primitives';
import { DARK_OUTLINE, SHADOW_DROP } from './layer-draw';
import { drawPlainLayer, type PlainArt } from './plain-layer-draw';
import { GOLDEN_LOOK, lookOfCode, pairColors, plainLooks } from './plain-look';

/** The two colours a crumb or a glaze drip of a layer takes. */
export type CakeColors = Pick<LayerColors, 'cake' | 'glaze'>;

/** Empty pixels around the art so antialiased edges are not cut. */
const SIDE_PAD = 2;
/** Room each side of a grown creature's picture beyond the usual margin, for the looks whose art goes past it. */
function artSidePad(creature: CreatureId | null, stage: CreatureStage): number {
  if (!creature || stage === 'base') return 0;
  const look = GROWN_LOOKS[creature];
  return 'sidePad' in look ? look.sidePad : 0;
}

/** Width of the baked picture of a layer `width` wide: the layer, a margin and an even number of pixels. */
export function artTextureWidth(
  width: number,
  creature: CreatureId | null = null,
  stage: CreatureStage = 'base',
): number {
  return 2 * Math.ceil((width + (SIDE_PAD + artSidePad(creature, stage)) * 2) / 2);
}

/** Space under the layer for its shadow. */
const SHADOW_MARGIN = Math.ceil(SHADOW_DROP + ANIM.layer.shadowHeight / 2) + 1;

const GOLDEN_COLORS: LayerColors = {
  cake: TREASURE.colors.goldCake,
  glaze: TREASURE.colors.goldGlaze,
};

/** Pores and outline of the golden layer: its own cake colour, darker. */
const GOLDEN_PORE_SHADE = -0.3;
const GOLDEN_ART: PlainArt = {
  colors: GOLDEN_COLORS,
  sponge: {
    cake: GOLDEN_COLORS.cake,
    pore: shade(GOLDEN_COLORS.cake, GOLDEN_PORE_SHADE),
    outline: shade(GOLDEN_COLORS.cake, DARK_OUTLINE),
  },
  decor: null,
  pattern: null,
};

/** What the plain (or golden) layer with this look code is drawn from. */
export function plainArt(look: number): PlainArt {
  if (look === GOLDEN_LOOK) return GOLDEN_ART;
  const { pair, decor, pattern } = lookOfCode(look);
  const p = PLAIN_PAIRS[pair] ?? PLAIN_PAIRS[0]!;
  return { colors: pairColors(pair), sponge: SPONGES[p.sponge], decor, pattern };
}

/** Look code of a layer view: gold for a golden layer, the run's plain look otherwise. */
export function lookCodeFor(layerIndex: number, golden: boolean): number {
  return golden ? GOLDEN_LOOK : plainLooks.codeFor(layerIndex);
}

/** The creature a layer of the tower (placed, planned or flying) is made of, `null` for a cake layer. */
export function creatureOfLayer(
  layer: Readonly<{ kind: string; creature?: CreatureId | null }>,
): CreatureId | null {
  return layer.kind === 'creature' && layer.creature ? layer.creature : null;
}

/**
 * Cake and glaze colours of the layer with this 1-based number: the creature's own sponge and
 * glaze for a creature layer, gold for a golden one, the run's plain look otherwise.
 * Crumbs and drips take them.
 */
export function cakeColorsFor(
  creature: CreatureId | null,
  layerIndex: number,
  golden = false,
): CakeColors {
  if (golden) return GOLDEN_COLORS;
  if (creature) {
    const { sponge, glaze } = creatureColors(creature);
    return { cake: sponge, glaze };
  }
  return plainLooks.colorsFor(layerIndex);
}

/** Whole-pixel width the art is baked at. */
/** Half the height of a layer: the distance from its centre to its top or bottom edge. */
export const HALF_LAYER = BALANCE.layer.height / 2;

export function artWidth(width: number): number {
  return Math.max(1, Math.round(width));
}

const CUT_SUFFIX: Readonly<Record<CutSide | 'none', string>> = { none: 'n', left: 'l', right: 'r' };
const FACELESS_SUFFIX = '_f';
const STAGE_SUFFIX: Readonly<Record<CreatureStage, string>> = {
  base: '',
  grown: '_g',
  glow: '_gl',
};

/**
 * The picture stage of a layer: `base` for a plain layer or a creature that is not grown; for a
 * grown creature `grown`, and for the grown Ghost standing in a sky zone (Stars, Space) `glow`.
 * `index` is the 1-based number the layer has in the tower.
 */
export function creatureStage(
  creature: CreatureId | null,
  grown: boolean,
  index: number,
): CreatureStage {
  if (!creature || !grown) return 'base';
  const zone = ZONES[zoneIndexOf(index)];
  if (creature === 'ghost' && zone && GLOW_ZONES.includes(zone.id)) return 'glow';
  return 'grown';
}

/**
 * Texture key of a baked layer: `layer_<look>_<width>_<cut>` for a plain or golden layer (the
 * look code holds the pair and the decoration; `_f` is added for a faceless bitten-off piece)
 * and `layer_c_<creature>_<width>_<cut>` for a creature (its look does not depend on the plain
 * look or the face); the grown look adds `_g`, the lit grown Ghost `_gl`.
 */
export function layerArtKey(
  look: number,
  creature: CreatureId | null,
  width: number,
  cut: CutSide | null,
  faceless = false,
  stage: CreatureStage = 'base',
): string {
  const who = creature ? `c_${creature}` : String(look);
  const face = !creature && faceless ? FACELESS_SUFFIX : '';
  const grown = creature ? STAGE_SUFFIX[stage] : '';
  return `layer_${who}_${artWidth(width)}_${CUT_SUFFIX[cut ?? 'none']}${face}${grown}`;
}

/**
 * Pixels the picture reaches above the top edge of the layer (never less than the shadow
 * margin): the creature's detail, or the decorations of a plain layer.
 */
export function artTopPad(creature: CreatureId | null, stage: CreatureStage = 'base'): number {
  if (!creature) return Math.max(SHADOW_MARGIN, PLAIN_LAYER.decor.maxRise);
  const grown = stage === 'base' ? 0 : GROWN_LOOKS[creature].topPad;
  return Math.max(SHADOW_MARGIN, artRecipe(creature).topPad, grown);
}

/** Height of the baked picture: the room above the layer, the layer, the room for its shadow. */
export function artHeight(creature: CreatureId | null, stage: CreatureStage = 'base'): number {
  return artTopPad(creature, stage) + BALANCE.layer.height + SHADOW_MARGIN;
}

/** Origin y (0..1) of the baked picture: it puts the centre of the layer body on the image position. */
export function artOriginY(creature: CreatureId | null, stage: CreatureStage = 'base'): number {
  return (artTopPad(creature, stage) + BALANCE.layer.height / 2) / artHeight(creature, stage);
}

/** Opacity of the baked picture: 1 except for the see-through creatures (jelly, meringue). */
export function artAlpha(creature: CreatureId | null): number {
  if (!creature) return 1;
  const recipe = artRecipe(creature);
  return 'alpha' in recipe ? recipe.alpha : 1;
}

// Baked layer textures are shared by every view. A texture is kept while any view
// shows it; unused ones stay for a while (widths repeat after perfect landings) and
// the oldest are removed beyond ANIM.pool.idleLayerTextures. Map order is use order.
const refs = new Map<string, number>();

/** Whether the picture for this combination is baked now. */
export function layerArtBaked(
  scene: Phaser.Scene,
  look: number,
  width: number,
  cut: CutSide | null,
  creature: CreatureId | null = null,
  stage: CreatureStage = 'base',
): boolean {
  return scene.textures.exists(layerArtKey(look, creature, width, cut, false, stage));
}

/**
 * Bakes (or finds) the art for a plain look code (or a creature), width and cut side (`null`: an
 * intact layer), with or without room for a face, and counts one more user of it. The layer body
 * sits at `artOriginY(creature)` of the picture.
 */
export function acquireLayerArt(
  scene: Phaser.Scene,
  look: number,
  width: number,
  cut: CutSide | null,
  creature: CreatureId | null = null,
  faceless = false,
  stage: CreatureStage = 'base',
): string {
  const w = artWidth(width);
  const key = layerArtKey(look, creature, w, cut, faceless, stage);
  const top = artTopPad(creature, stage);
  const texW = artTextureWidth(w, creature, stage);
  const texH = artHeight(creature, stage);
  const centerY = top + BALANCE.layer.height / 2;
  bakeTexture(
    scene,
    key,
    texW,
    texH,
    (g) => {
      g.translateCanvas(texW / 2, centerY);
      if (creature) drawCreatureLayer(g, creature, w, cut, false, stage);
      else drawPlainLayer(g, w, plainArt(look), cut, faceless);
    },
    creature && stage !== 'base'
      ? (context) => finishCreatureLayer(context, creature, w, texW / 2, centerY)
      : undefined,
  );
  const users = refs.get(key) ?? 0;
  refs.delete(key);
  refs.set(key, users + 1);
  return key;
}

/**
 * Bakes the art ahead of its first use. No view holds it yet, so it stays idle (and the oldest
 * idle pictures go first) until a view takes it.
 */
export function prepareLayerArt(
  scene: Phaser.Scene,
  look: number,
  width: number,
  cut: CutSide | null,
  creature: CreatureId | null = null,
  faceless = false,
  stage: CreatureStage = 'base',
): void {
  releaseLayerArt(scene, acquireLayerArt(scene, look, width, cut, creature, faceless, stage));
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
