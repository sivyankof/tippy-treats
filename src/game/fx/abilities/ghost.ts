import { ABILITY_ANIM } from '../../../data/ability-anim';
import { DEPTH } from '../../depth';
import { ABILITY_TEXTURES, DASH_SIZE } from './ability-textures';
import { HALF_LAYER, type SignatureFx } from './kit';
import { makeSpec } from './sprite-motion';

const cfg = ABILITY_ANIM.ghost;

/** The ghost turns see-through and "draws" dashed lines up from the corners of its layer. */
export const ghostFx: SignatureFx = ({ kit, pose, view }) => {
  view?.faceView.react('joy', cfg.joyMs);
  view?.rig.fade(cfg.fadeAlpha, cfg.fadeMs, cfg.holdMs);
  for (const side of [-1, 1] as const) {
    kit.sprites.spawn(
      makeSpec({
        texture: ABILITY_TEXTURES.dash,
        tint: cfg.color,
        depth: DEPTH.particles,
        originY: 1,
        x0: pose.x + (side * pose.width) / 2,
        y0: pose.y - HALF_LAYER,
        scaleY0: 0,
        scaleY1: cfg.drawLength / DASH_SIZE.height,
        alpha0: cfg.drawAlpha,
        alpha1: 0,
        lifeMs: cfg.drawMs,
      }),
    );
  }
};
