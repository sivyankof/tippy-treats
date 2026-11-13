import { CREATURE_IDS, type CreatureId } from '../../data/creatures';

/** Texture key of the icon of each creature; the key is the name of `assets/svg/icon_<id>.svg`. */
export const CREATURE_ICON_KEYS = Object.fromEntries(
  CREATURE_IDS.map((id) => [id, `icon_${id}`]),
) as Readonly<Record<CreatureId, string>>;
