import { ABILITY_ANIM } from '../../../data/ability-anim';
import { DEPTH } from '../../depth';
import { ABILITY_TEXTURES, STRAND_SIZE } from './ability-textures';
import { HALF_LAYER, type SignatureFx } from './kit';
import { makeSpec } from './sprite-motion';

const cfg = ABILITY_ANIM.honey;

/** Honey threads hang from the layer to the one below, stretch and snap. */
export const honeyFx: SignatureFx = ({ kit, pose, view, colors }) => {
  for (let i = 0; i < cfg.strands; i++) {
    const x = pose.x + (i - (cfg.strands - 1) / 2) * pose.width * cfg.spread;
    kit.sprites.spawn(
      makeSpec({
        texture: ABILITY_TEXTURES.strand,
        tint: colors.body,
        depth: DEPTH.particles,
        originY: 0,
        x0: x,
        y0: pose.y + HALF_LAYER,
        scaleX0: cfg.thickness / STRAND_SIZE.width,
        scaleY0: 0,
        scaleY1: cfg.length / STRAND_SIZE.height,
        scaleShape: 'snap',
        delayMs: i * cfg.staggerMs,
        lifeMs: cfg.lifeMs,
      }),
    );
  }
  view?.faceView.react('joy', cfg.joyMs);
};
