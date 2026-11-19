import { ABILITY_ANIM } from '../../../../data/creatures/ability-anim';
import { effectsMode } from '../../../app/effects-mode';
import { HALF_LAYER, type SignatureFx } from '../kit';

const cfg = ABILITY_ANIM.rainbow;

/**
 * A cream cloud puffs up on the Rainbow layer and a rainbow arc grows out of it towards the next
 * flying layer (`RainbowArc` follows that layer). "Fewer effects" leaves only the rim on the layer.
 */
export const rainbowFx: SignatureFx = ({ kit, pose, view }) => {
  view?.faceView.react('joy', cfg.joyMs);
  if (effectsMode.reduced) return;
  kit.arc.start(pose.x, pose.y - HALF_LAYER);
};
