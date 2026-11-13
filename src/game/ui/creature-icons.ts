import type * as Phaser from 'phaser';
import { CREATURE_IDS, type CreatureId } from '../../data/creatures';
import { HUD_LAYOUT } from '../../data/hud-layout';

/** Texture key of the icon of each creature; the key is the name of `assets/svg/icon_<id>.svg`. */
export const CREATURE_ICON_KEYS = Object.fromEntries(
  CREATURE_IDS.map((id) => [id, `icon_${id}`]),
) as Readonly<Record<CreatureId, string>>;

/** Shows the icon of `id` at the size the HUD uses for creature icons. */
export function setCreatureIcon(image: Phaser.GameObjects.Image, id: CreatureId): void {
  const size = HUD_LAYOUT.badgeSize;
  image.setTexture(CREATURE_ICON_KEYS[id]).setDisplaySize(size, size);
}

/** A new HUD creature icon at (x, y); it shows `id` (the first creature until told otherwise). */
export function createCreatureIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: CreatureId = CREATURE_IDS[0],
): Phaser.GameObjects.Image {
  const icon = scene.add.image(x, y, CREATURE_ICON_KEYS[id]);
  setCreatureIcon(icon, id);
  return icon;
}
