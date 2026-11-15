import type * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { services } from '../../services';
import type { ContinueFlow } from '../continue-flow';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { RingTimer } from './style/ring-timer';

const { timer } = CONTINUE_ANIM;
const RING_LOOK = { ...timer, popEase: CONTINUE_ANIM.ease.pop };

/** The kit's ring timer with the time left of the offer; ticks through the last seconds. */
export class ContinueTimer {
  readonly root: RingTimer;
  private lastDigit = -1;
  private lastStep = -1;
  private lastUrgent: boolean | null = null;

  constructor(scene: Phaser.Scene, y: number) {
    this.root = new RingTimer(scene, 0, y, RING_LOOK);
  }

  /** A new offer: the next update redraws everything. */
  reset(): void {
    this.lastDigit = -1;
    this.lastStep = -1;
    this.lastUrgent = null;
  }

  update(flow: ContinueFlow): void {
    const left = flow.remainingMs;
    const urgent = left <= CONTINUE_ANIM.urgentFromMs;
    const color = urgent ? timer.urgentColor : timer.color;
    const step = Math.ceil(left / timer.redrawStepMs);
    if (step !== this.lastStep || urgent !== this.lastUrgent) {
      this.lastStep = step;
      this.lastUrgent = urgent;
      this.root.setShare(left / BALANCE.continues.offerMs, color);
    }
    const digit = Math.ceil(left / 1000);
    if (digit === this.lastDigit) return;
    if (this.lastDigit !== -1 && urgent) playCues(cuesForMoment('timerTick'), services);
    this.lastDigit = digit;
    this.root.setDigit(digit, color, true);
  }
}
