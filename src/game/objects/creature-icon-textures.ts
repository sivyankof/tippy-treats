import type * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { CREATURE_ICON } from '../../data/creature-style';
import { CREATURE_IDS, type CreatureId } from '../../data/creatures';
import { offList } from '../ui/bake-texture';
import { CREATURE_ICON_KEYS } from '../ui/creature-icons';
import { artTopPad } from './layer-art';
import { iconPlacement } from './creature-icon-fit';
import { LayerView } from './layer-view';

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

function bakeIcon(scene: Phaser.Scene, view: LayerView, id: CreatureId): void {
  const key = CREATURE_ICON_KEYS[id];
  if (scene.textures.exists(key)) return;
  const half = BALANCE.layer.height / 2;
  const { size, marginShare } = CREATURE_ICON;
  const layerWidth = iconLayerWidth(id);
  const place = iconPlacement(layerWidth, half + artTopPad(id), half, size, marginShare);
  const icon = scene.textures.addDynamicTexture(key, size, size);
  if (!icon) throw new Error(`creature icon: no texture for ${id}`);
  view
    .resetAnim()
    .setScale(place.scale)
    .setLook({ kind: 'creature', creature: id, level: CREATURE_ICON.level })
    .setLayer(1, layerWidth, null)
    .setArtOpaque();
  // A draw command reads the view when the texture renders (docs/08, journal 2026-11-15).
  icon.draw(view, place.x, place.y).render();
}
