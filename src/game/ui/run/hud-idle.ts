import { IDLE_MOTION, IDLE_PHASE } from '../../../data/common/idle-motion';
import { applyIdlePose, idlePose, type IdlePose, type Swayable } from '../common/idle-motion';

/**
 * The height and score numbers breathe and tilt a hair, so the top of the HUD is never still.
 * Only scale and angle are driven: the screen transition owns the position.
 */
export class HudNumbersIdle {
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };

  constructor(
    private readonly height: Swayable,
    private readonly score: Swayable,
  ) {}

  update(timeMs: number): void {
    const spec = IDLE_MOTION.hudNumber;
    applyIdlePose(this.height, idlePose(spec, timeMs, IDLE_PHASE.height, this.pose));
    applyIdlePose(this.score, idlePose(spec, timeMs, IDLE_PHASE.score, this.pose));
  }
}
