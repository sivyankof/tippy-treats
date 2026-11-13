import { ABILITY_ANIM } from '../../../data/ability-anim';
import { effectsMode } from '../../effects-mode';
import type { SignatureFx } from './kit';

const cfg = ABILITY_ANIM.jelly;

/**
 * A wobble runs through the layer and down the tower, weaker and later for every layer below.
 * The calmer sway comes from `AbilityFx.beforeSync`, which has to act before the new state shows.
 */
export const jellyFx: SignatureFx = ({ kit, view, index }) => {
  view?.faceView.react('joy', cfg.joyMs);
  const layers = effectsMode.reduced ? 1 : cfg.layers;
  for (let k = 0; k < layers; k++) {
    const strength = Math.pow(cfg.falloff, k);
    kit.tower
      .viewAt(index - k)
      ?.playLanding(
        1 + (cfg.scaleX - 1) * strength,
        1 - (1 - cfg.scaleY) * strength,
        k * cfg.delayMs,
      );
  }
};
