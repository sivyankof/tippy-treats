import { ABILITY_ANIM } from '../../../data/ability-anim';
import { FX_TEXTURES } from '../fx-textures';
import type { SignatureFx } from './kit';

const cfg = ABILITY_ANIM.lemon;

/** The lemon scrunches its face; the layer pinches in and juice drops fly off. */
export const lemonFx: SignatureFx = ({ kit, pose, view }) => {
  view?.faceView.react('scrunch', cfg.scrunchMs);
  view?.playLanding(cfg.squashX, cfg.squashY, 0, cfg.squashMs);
  kit.bursts.cone(
    pose.x,
    pose.y,
    0,
    cfg.drops.count,
    cfg.drops.style,
    FX_TEXTURES.drop,
    cfg.dropColors,
  );
};
