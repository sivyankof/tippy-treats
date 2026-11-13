import { ABILITY_ANIM } from '../../../data/ability-anim';
import { FX_TEXTURES } from '../fx-textures';
import { HALF_LAYER, UP_DEG, type SignatureFx } from './kit';

const cfg = ABILITY_ANIM.sprinkle;

/** A shot of sprinkles flies up out of the layer like confetti. */
export const sprinkleFx: SignatureFx = ({ kit, pose, view }) => {
  view?.faceView.react('joy', cfg.joyMs);
  kit.bursts.cone(
    pose.x,
    pose.y - HALF_LAYER,
    UP_DEG,
    cfg.shot.count,
    cfg.shot.style,
    FX_TEXTURES.confetti,
    cfg.colors,
  );
};
