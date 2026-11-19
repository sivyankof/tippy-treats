import * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { cssColor } from '../../../util/color';
import { TWO_PI } from '../../../util/math';
import { createOutlinedText } from '../outlined-text';
import { createVolumeImage, faceOffsetY, lookOf } from './volume';
import { drawRingArc } from './volume-bar';

/** Size and motion of a ring timer. */
export interface RingTimerLook {
  /** Radius of the middle of the ring. */
  radius: number;
  ringWidth: number;
  /** Opacity of the empty ring behind the arc. */
  trackAlpha: number;
  digitFont: number;
  /** The digit pops from this scale when it changes. */
  popScale: number;
  popMs: number;
  popEase: string;
}

/**
 * A countdown of the style kit: a glossy disc with a groove ring, the arc of the time left in it
 * and the seconds in the middle. It only draws; the owner says what to show.
 *
 *   const ring = new RingTimer(scene, 0, y, CONTINUE_ANIM.timer);
 *   ring.setShare(0.6, PALETTE.success);
 *   ring.setDigit(3, PALETTE.success, true);
 */
export class RingTimer extends Phaser.GameObjects.Container {
  private readonly arc: Phaser.GameObjects.Graphics;
  private readonly digit: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly look: RingTimerLook,
  ) {
    super(scene, x, y);
    const { radius, ringWidth, trackAlpha } = look;
    const disc = Math.ceil((radius + ringWidth) * 2);
    // The face of the disc is centred on the ring: the bevel hangs under it.
    const discLook = lookOf('chip', disc / 2);
    const face = createVolumeImage(
      scene,
      `ui_ring_timer_${radius}_${ringWidth}`,
      disc,
      disc + discLook.bevel,
      discLook,
      {},
      (g) => {
        g.lineStyle(ringWidth, PALETTE.panelShadow, trackAlpha);
        g.beginPath()
          .arc(disc / 2, disc / 2, radius, 0, TWO_PI)
          .strokePath();
      },
    ).setY(-faceOffsetY('chip'));
    this.arc = new Phaser.GameObjects.Graphics(scene);
    this.digit = createOutlinedText(scene, 0, 0, '', look.digitFont);
    this.add([face, this.arc, this.digit]);
    scene.add.existing(this);
  }

  /** Draws the arc of the time left, `share` of a full turn (0 hides it), with volume (`volume-bar.ts`). */
  setShare(share: number, color: number): void {
    const g = this.arc.clear();
    drawRingArc(
      g,
      { cx: 0, cy: 0, radius: this.look.radius, ringWidth: this.look.ringWidth },
      share,
      color,
    );
  }

  /** Shows `value` in the middle; `pop` makes it jump in. */
  setDigit(value: number, color: number, pop: boolean): void {
    this.digit.setText(String(value)).setColor(cssColor(color));
    if (!pop) return;
    this.scene.tweens.killTweensOf(this.digit);
    this.scene.tweens.add({
      targets: this.digit,
      scale: { from: this.look.popScale, to: 1 },
      duration: this.look.popMs,
      ease: this.look.popEase,
    });
  }
}
