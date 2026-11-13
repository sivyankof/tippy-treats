import { ABILITY_ANIM } from '../../../data/ability-anim';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import { easeFn } from '../ease';
import { FX_TEXTURES } from '../fx-textures';
import { ABILITY_TEXTURES, COAT_SIZE } from './ability-textures';
import { HALF_LAYER, type SignatureFx } from './kit';
import { makeSpec } from './sprite-motion';

const cfg = ABILITY_ANIM.rainbow;
const sweep = easeFn(cfg.waveEase);

/**
 * A wave of rainbow stripes sweeps across the whole screen (left out with "fewer effects":
 * a screen-wide wave is decoration), and rainbow sparks fly from the edges of the layer.
 */
export const rainbowFx: SignatureFx = ({ kit, pose, view, screenWidth, screenHeight }) => {
  view?.faceView.react('joy', cfg.joyMs);
  kit.bursts.edges(
    pose.x,
    pose.y - HALF_LAYER / 2,
    pose.width,
    cfg.sparks.count,
    cfg.sparks.style,
    FX_TEXTURES.star,
    cfg.stripes,
  );
  if (effectsMode.reduced) return;
  cfg.stripes.forEach((tint, i) => {
    kit.sprites.spawn(
      makeSpec({
        texture: ABILITY_TEXTURES.coat,
        tint,
        depth: DEPTH.wave,
        screen: true,
        x0: -cfg.stripeWidth - i * cfg.stripeGapPx,
        x1: screenWidth + cfg.stripeWidth,
        y0: screenHeight / 2,
        move: sweep,
        scaleX0: cfg.stripeWidth / COAT_SIZE.width,
        scaleY0: (screenHeight * cfg.heightShare) / COAT_SIZE.height,
        angle0: cfg.tiltDeg,
        angle1: cfg.tiltDeg,
        alpha0: 0,
        alpha1: cfg.waveAlpha,
        alphaShape: 'bump',
        lifeMs: cfg.waveMs,
      }),
    );
  });
};
