import { ABILITY_ANIM } from '../../../data/ability-anim';
import { spawnClouds } from './clouds';
import { HALF_LAYER, type SignatureFx } from './kit';

const cfg = ABILITY_ANIM.puff;

/** The cheeks puff up, the layer swells from its old width with a clap, a cloud puffs out. */
export const puffFx: SignatureFx = ({ kit, pose, view, payload }) => {
  const widened = 'widened' in payload ? payload.widened : 0;
  const fromScaleX = Math.max(0.1, (pose.width - widened) / pose.width);
  view?.faceView.react('puffed', cfg.puffedMs);
  view?.rig.inflate(fromScaleX, cfg.startScaleY, cfg.peak, cfg.upMs, cfg.downMs, cfg.downEase);
  spawnClouds(kit.sprites, pose.x, pose.y - HALF_LAYER, {
    count: cfg.clouds,
    scale: cfg.cloudScale,
    rise: cfg.cloudRise,
    lifeMs: cfg.cloudMs,
    colors: cfg.cloudColors,
    width: pose.width * cfg.cloudWidthShare,
  });
};
