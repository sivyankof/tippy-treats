import type * as Phaser from 'phaser';
import { BALANCE } from '../../../data/tower/balance';
import { CREATURE_ICON } from '../../../data/creatures/creature-style';
import { CREATURE_IDS, type CreatureId } from '../../../data/creatures/creatures';
import { offList } from '../../ui/bake-texture';
import { CREATURE_GROWN_ICON_KEYS, CREATURE_ICON_KEYS } from '../../ui/creature-icons';
import { artTopPad } from '../tower/layer-art';
import { iconPlacement } from './creature-icon-fit';
import { LayerView } from '../tower/layer-view';

/** Width of the layer a creature's icon is drawn from. */
export function iconLayerWidth(id: CreatureId): number {
  return CREATURE_ICON.layerWidthById[id] ?? CREATURE_ICON.layerWidth;
}

/**
 * Bakes the icons of all creatures (texture `icon_<id>`): the real layer picture with its face,
 * drawn narrow so the face shrinks, in a square with a transparent background. Call it once,
 * after the face and fx textures exist.
 */
export function createCreatureIconTextures(scene: Phaser.Scene): void {
  const view = offList(new LayerView(scene));
  try {
    for (const id of CREATURE_IDS) bakeIcon(scene, view, id);
  } finally {
    view.destroy();
  }
}

/**
 * The key of the icon of `id`, in its grown look when `grown`; the grown icon is baked here on
 * first use (call it before the screen that shows it opens, not during a run).
 */
export function creatureIconTexture(scene: Phaser.Scene, id: CreatureId, grown = false): string {
  if (!grown) return CREATURE_ICON_KEYS[id];
  const key = CREATURE_GROWN_ICON_KEYS[id];
  if (scene.textures.exists(key)) return key;
  const view = offList(new LayerView(scene));
  try {
    bakeIcon(scene, view, id, true);
  } finally {
    view.destroy();
  }
  return key;
}

/** Bakes the grown icons of all creatures (`icon_<id>_grown`); the art sheet shows them. */
export function createGrownCreatureIconTextures(scene: Phaser.Scene): void {
  for (const id of CREATURE_IDS) creatureIconTexture(scene, id, true);
}

function bakeIcon(scene: Phaser.Scene, view: LayerView, id: CreatureId, grown = false): void {
  const key = grown ? CREATURE_GROWN_ICON_KEYS[id] : CREATURE_ICON_KEYS[id];
  if (scene.textures.exists(key)) return;
  const stage = grown ? 'grown' : 'base';
  const half = BALANCE.layer.height / 2;
  const { size, marginShare } = CREATURE_ICON;
  const layerWidth = iconLayerWidth(id);
  const place = iconPlacement(layerWidth, half + artTopPad(id, stage), half, size, marginShare);
  const icon = scene.textures.addDynamicTexture(key, size, size);
  if (!icon) throw new Error(`creature icon: no texture for ${id}`);
  view
    .resetAnim()
    .setStageMode(stage)
    .setScale(place.scale)
    .setLook({ kind: 'creature', creature: id, level: CREATURE_ICON.level })
    .setLayer(1, layerWidth, null)
    .setArtOpaque();
  // A draw command reads the view when the texture renders (docs/08, journal 2026-11-15).
  icon.draw(view, place.x, place.y).render();
}
