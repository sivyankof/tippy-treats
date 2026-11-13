import { ABILITY_ANIM } from '../../../data/ability-anim';
import type { SignatureFx } from './kit';

const cfg = ABILITY_ANIM.twins;

/** The top shell lifts, cream flashes in the gap, the shell settles back; both faces argue. */
export const twinsFx: SignatureFx = ({ view, pose }) => {
  if (!view) return;
  view.faceView.react('strain', cfg.argueMs);
  view.rig.splitApart({
    width: pose.width,
    liftPx: cfg.liftPx,
    liftMs: cfg.liftMs,
    holdMs: cfg.holdMs,
    ease: cfg.liftEase,
    creamColor: cfg.creamColor,
    creamAlpha: cfg.creamAlpha,
  });
};
