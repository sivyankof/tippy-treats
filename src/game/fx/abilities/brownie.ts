import { ABILITY_ANIM } from '../../../data/ability-anim';
import { FX_TEXTURES } from '../fx-textures';
import { HALF_LAYER, UP_DEG, type SignatureFx } from './kit';

const cfg = ABILITY_ANIM.brownie;

/** The brownie flexes: a squash, a hop up, a spray of chocolate chips. */
export const brownieFx: SignatureFx = ({ kit, pose, view }) => {
  view?.faceView.react('strain', cfg.strainMs);
  view?.playLanding(cfg.squashX, cfg.squashY);
  view?.rig.hop(cfg.hopPx, cfg.hopMs);
  kit.bursts.cone(
    pose.x,
    pose.y - HALF_LAYER,
    UP_DEG,
    cfg.chips.count,
    cfg.chips.style,
    FX_TEXTURES.crumb,
    cfg.chipColors,
  );
};
