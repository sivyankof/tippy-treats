import { ART_SHEET } from '../../data/debug/art-sheet';
import { CREATURE_IDS } from '../../data/creatures/creatures';
import { MASTERY } from '../../data/creatures/mastery';
import { artTopPad } from '../objects/layer-art';
import { LayerView } from '../objects/layer-view';
import type { LivePicture } from './art-sheet-live';

/** A creature layer at a real width, in its usual or its grown look, with its face (drawn, so it is not a texture of the sheet). */
function creatureLayerPicture(id: (typeof CREATURE_IDS)[number], grown: boolean): LivePicture {
  return {
    name: grown
      ? `${id}_grown (layer ${ART_SHEET.grownLayerWidth})`
      : `${id} (layer ${ART_SHEET.grownLayerWidth})`,
    size: ART_SHEET.grownPictureSize,
    create: (scene, size) => {
      const view = new LayerView(scene)
        .setStageMode(grown ? 'grown' : 'base')
        .setLook({ kind: 'creature', creature: id, level: grown ? MASTERY.lookLevel : 1 })
        .setLayer(1, ART_SHEET.grownLayerWidth);
      const scale = size / ART_SHEET.grownLayerWidth;
      const stage = grown ? 'grown' : 'base';
      // The crown above the layer is taller than the shadow under it: shift the layer down to centre the picture.
      view.setScale(scale).setY((artTopPad(id, stage) * scale) / 2);
      return scene.add.container(0, 0, [view]);
    },
  };
}

/** Every creature in both looks, for `?artsheet=1`. */
export const GROWN_PICTURES: readonly LivePicture[] = CREATURE_IDS.flatMap((id) => [
  creatureLayerPicture(id, false),
  creatureLayerPicture(id, true),
]);
