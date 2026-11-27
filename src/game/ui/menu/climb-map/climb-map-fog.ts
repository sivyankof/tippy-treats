import * as Phaser from 'phaser';
import { CLIMB_LANDSCAPE } from '../../../../data/progression/climb-landscape';
import type { EffectLevel } from '../../../../data/app/effect-levels';
import { FOG_BACK_KEY, FOG_FRONT_KEY } from '../../../fx/climb-map/landscape-chunks';
import { climbStripWidth } from '../../../fx/climb-map/landscape-math';
import { visibleSlice, type Span } from './climb-map-layout';

const fog = CLIMB_LANDSCAPE.fog;

/** One row of puffs: a baked picture standing on the strip at `top`, cropped to the view. */
interface Row {
  image: Phaser.GameObjects.Image;
  top: number;
  height: number;
}

/**
 * The edge of the fog above the band of the record (docs/07, section 2.3): two baked pictures of
 * puffs, the back row lighter and higher. On the full level they slowly breathe (a tween of the
 * ready pictures: height and a little stretch, no redraw); on lite and minimal they stand still.
 */
export class ClimbFogEdge {
  private readonly rows: Row[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];

  /** `boundary` is the strip y of the top of the band of the record; the puffs hang `overlap` into it. */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly strip: Phaser.GameObjects.Container,
    boundary: number,
    private readonly level: EffectLevel,
  ) {
    const bottom = boundary + fog.overlap;
    for (const [key, rise] of [
      [FOG_BACK_KEY, fog.backRise],
      [FOG_FRONT_KEY, 0],
    ] as const) {
      const top = bottom - fog.edgeHeight - rise;
      const image = scene.add.image(0, top, key).setOrigin(0.5, 0);
      image.setDisplaySize(climbStripWidth(), fog.edgeHeight);
      strip.add(image);
      this.rows.push({ image, top, height: fog.edgeHeight });
    }
  }

  /** Puts the rows at the back of the strip, back row behind the front one (the caller then puts the pictures of the bands behind them). */
  sendToBack(): void {
    for (const { image } of [...this.rows].reverse()) this.strip.sendToBack(image);
  }

  /** Shows the part of each row inside the view. */
  refresh(view: Span): void {
    for (const { image, top, height } of this.rows) {
      const slice = visibleSlice({ top, bottom: top + height }, view);
      image.setVisible(slice !== null);
      if (slice) image.setCrop(0, slice.top - top, image.width, slice.bottom - slice.top);
    }
  }

  /** Starts the breathing (full level only): the rows move against each other. */
  start(): void {
    if (this.level !== 'full' || this.tweens.length > 0) return;
    const b = fog.breath;
    this.rows.forEach(({ image, top }, i) => {
      this.tweens.push(
        this.scene.tweens.add({
          targets: image,
          y: top - b.rise,
          scaleY: (image.displayHeight / image.height) * (1 + b.scale),
          duration: b.ms,
          ease: b.ease,
          yoyo: true,
          repeat: -1,
          delay: i === 0 ? 0 : b.ms * b.backPhase,
        }),
      );
    });
  }

  stop(): void {
    for (const tween of this.tweens) tween.remove();
    this.tweens = [];
  }
}
