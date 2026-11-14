import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { PALETTE } from '../../data/palette';
import { cssColor } from '../../util/color';
import { services } from '../../services';
import type { ContinueFlow } from '../continue-flow';
import { cuesForMoment } from '../fx/moment-cues';
import { playCues } from '../fx/run-cues';
import { bakeTexture } from './bake-texture';
import { createOutlinedText } from './outlined-text';

const { timer } = CONTINUE_ANIM;
const TRACK_TEXTURE = 'ui_continue_timer_track';
const FULL_TURN = Math.PI * 2;
const START_ANGLE = -Math.PI / 2;

/** The ring of the remaining time with the seconds in its middle. */
export class ContinueTimer {
  readonly root: Phaser.GameObjects.Container;
  private readonly arc: Phaser.GameObjects.Graphics;
  private readonly digit: Phaser.GameObjects.Text;
  private lastDigit = -1;
  private lastStep = -1;
  private lastUrgent: boolean | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    y: number,
  ) {
    const size = Math.ceil((timer.radius + timer.ringWidth) * 2);
    bakeTexture(scene, TRACK_TEXTURE, size, size, (g) => {
      g.lineStyle(timer.ringWidth, PALETTE.panelShadow, timer.trackAlpha);
      g.beginPath()
        .arc(size / 2, size / 2, timer.radius, 0, FULL_TURN)
        .strokePath();
    });
    this.arc = scene.add.graphics();
    this.digit = createOutlinedText(scene, 0, 0, '', timer.digitFont);
    this.root = scene.add.container(0, y, [
      scene.add.image(0, 0, TRACK_TEXTURE),
      this.arc,
      this.digit,
    ]);
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
      this.drawArc(Math.min(1, left / BALANCE.continues.offerMs), color);
    }
    const digit = Math.ceil(left / 1000);
    if (digit === this.lastDigit) return;
    if (this.lastDigit !== -1 && urgent) playCues(cuesForMoment('timerTick'), services);
    this.lastDigit = digit;
    this.digit.setText(String(digit)).setColor(cssColor(color));
    this.scene.tweens.add({
      targets: this.digit,
      scale: { from: timer.popScale, to: 1 },
      duration: timer.popMs,
      ease: CONTINUE_ANIM.ease.pop,
    });
  }

  private drawArc(share: number, color: number): void {
    const g = this.arc.clear();
    if (share <= 0) return;
    g.lineStyle(timer.ringWidth, color, 1);
    g.beginPath()
      .arc(0, 0, timer.radius, START_ANGLE, START_ANGLE + FULL_TURN * share)
      .strokePath();
  }
}
