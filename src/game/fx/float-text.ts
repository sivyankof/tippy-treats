import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { cssColor } from '../../util/color';
import { DEPTH } from '../depth';
import { createOutlinedText } from '../ui/outlined-text';
import { comboTextScale } from './anim-curves';
import { easeFn } from './ease';
import { hideItem, TimedPool, type PoolEntry } from './timed-pool';

const text = ANIM.perfect.text;
const appearEase = easeFn(text.appearEase);
const riseEase = easeFn(text.riseEase);
const appearShare = text.appearMs / text.lifeMs;
const fadeStart = 1 - text.fadeMs / text.lifeMs;

interface FloatingText extends PoolEntry<Phaser.GameObjects.Text> {
  startY: number;
  /** Final scale of the line (grows with the combo). */
  scale: number;
}

/** Pooled "Perfect!" / "x3" texts that pop in at a world point, rise and fade. */
export class FloatText {
  private readonly pool: TimedPool<Phaser.GameObjects.Text, FloatingText>;

  constructor(scene: Phaser.Scene) {
    this.pool = new TimedPool(
      () => createOutlinedText(scene, 0, 0, '', text.fontSize).setDepth(DEPTH.floatText),
      hideItem,
      text.maxLive,
    );
  }

  /** Shows "Perfect!" above (x, y) and, from combo 2, a "x{combo}" line under it. */
  showPerfect(x: number, y: number, combo: number): void {
    const scale = comboTextScale(combo);
    this.spawn(x, y, t('run.perfect'), text.fontSize, scale, PALETTE.textLight);
    if (combo >= 2) {
      const gap = text.fontSize * text.lineGapRatio * scale;
      this.spawn(x, y + gap, t('run.combo', { n: combo }), text.comboFontSize, scale, PALETTE.gold);
    }
  }

  update(dtMs: number): void {
    this.pool.update(dtMs, (entry, progress) => {
      const appear = Math.min(1, progress / appearShare);
      const scale = text.fromScale + (1 - text.fromScale) * appearEase(appear);
      const fade = progress > fadeStart ? (progress - fadeStart) / (1 - fadeStart) : 0;
      entry.item
        .setScale(entry.scale * scale)
        .setY(entry.startY - text.rise * riseEase(progress))
        .setAlpha(1 - fade);
    });
  }

  private spawn(
    x: number,
    y: number,
    content: string,
    fontSize: number,
    scale: number,
    color: number,
  ): void {
    const item = this.pool.take();
    item
      .setText(content)
      .setFontSize(fontSize)
      .setColor(cssColor(color))
      .setPosition(x, y)
      .setScale(scale * text.fromScale)
      .setAlpha(1)
      .setVisible(true);
    this.pool.add({ item, startY: y, scale, ageMs: 0, lifeMs: text.lifeMs });
  }
}
