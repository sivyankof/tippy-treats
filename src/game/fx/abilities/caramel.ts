import { ABILITY_ANIM } from '../../../data/ability-anim';
import { FX_TEXTURES } from '../fx-textures';
import type { SignatureFx } from './kit';

const cfg = ABILITY_ANIM.caramel;

/** A wink, and golden sparkles flare around the top of the tower. */
export const caramelFx: SignatureFx = ({ kit, pose, view, index }) => {
  view?.faceView.react('wink', cfg.winkMs);
  const { bursts, tower } = kit;
  bursts.edges(
    pose.x,
    pose.y,
    pose.width,
    cfg.sparkles.count,
    cfg.sparkles.style,
    FX_TEXTURES.star,
    cfg.tints,
  );
  for (let k = 1; k <= cfg.extraLayers; k++) {
    const below = tower.layerPose(index - k);
    if (!below) break;
    bursts.edges(
      below.x,
      below.y,
      below.width,
      cfg.extraCount,
      cfg.sparkles.style,
      FX_TEXTURES.star,
      cfg.tints,
    );
  }
};
