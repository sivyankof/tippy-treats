import type * as Phaser from 'phaser';
import { IDLE_MOTION, IDLE_PHASE } from '../../data/idle-motion';
import { applyIdlePose, idlePose, type IdlePose } from './idle-motion';

type Text = Phaser.GameObjects.Text;

/**
 * The height and score numbers breathe and tilt a hair, so the top of the HUD is never still.
 * Only scale and angle are driven: the screen transition owns the position.
 */
export class HudNumbersIdle {
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };

  constructor(
    private readonly height: Text,
    private readonly score: Text,
  ) {}

  update(timeMs: number): void {
    const spec = IDLE_MOTION.hudNumber;
    applyIdlePose(this.height, idlePose(spec, timeMs, IDLE_PHASE.height, this.pose));
    applyIdlePose(this.score, idlePose(spec, timeMs, IDLE_PHASE.score, this.pose));
  }
}
