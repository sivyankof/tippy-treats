import { ABILITY_ANIM } from '../../../data/ability-anim';
import { FX_TEXTURES } from '../fx-textures';
import { spawnClouds } from './clouds';
import { mouthPoint, UP_DEG, type SignatureFx } from './kit';

const cfg = ABILITY_ANIM.frosty;

/** The creature blows out a breath of frost: a pale cloud and a spray of ice flakes. */
export const frostyFx: SignatureFx = ({ kit, pose, view }) => {
  view?.faceView.react('blow', cfg.blowMs);
  const mouth = mouthPoint(pose);
  spawnClouds(kit.sprites, mouth.x, mouth.y, {
    count: cfg.clouds,
    scale: cfg.cloudScale,
    rise: cfg.cloudRise,
    lifeMs: cfg.cloudMs,
    colors: cfg.cloudColors,
    width: pose.width * cfg.cloudWidthShare,
  });
  kit.bursts.cone(
    mouth.x,
    mouth.y,
    UP_DEG,
    cfg.flakes.count,
    cfg.flakes.style,
    FX_TEXTURES.star,
    cfg.flakeColors,
  );
};
