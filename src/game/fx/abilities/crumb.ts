import { ABILITY_ANIM } from '../../../data/ability-anim';
import { TWO_PI } from '../../../util/math';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import { easeFn } from '../ease';
import { FX_TEXTURES } from '../fx-textures';
import { mouthPoint, type SignatureFx } from './kit';
import { makeSpec } from './sprite-motion';

const cfg = ABILITY_ANIM.crumb;
const pull = easeFn(cfg.pullEase);

/** The mouth opens wide and the crumbs around the layer are sucked into it. */
export const crumbFx: SignatureFx = ({ kit, pose, view, colors }) => {
  view?.faceView.react('gape', cfg.gapeMs);
  const mouth = mouthPoint(pose);
  const count = effectsMode.particleCount(cfg.crumbs);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TWO_PI;
    const reach = (pose.width / 2) * cfg.ringShare;
    kit.sprites.spawn(
      makeSpec({
        texture: FX_TEXTURES.crumb,
        tint: colors.body,
        depth: DEPTH.particles,
        x0: mouth.x + Math.cos(angle) * reach * cfg.ringStretchX,
        y0: mouth.y + Math.sin(angle) * reach,
        x1: mouth.x,
        y1: mouth.y,
        move: pull,
        scaleX0: cfg.scaleFrom,
        scaleX1: cfg.scaleTo,
        alpha0: 1,
        alpha1: cfg.endAlpha,
        delayMs: i * cfg.staggerMs,
        lifeMs: cfg.flightMs,
      }),
    );
  }
};
