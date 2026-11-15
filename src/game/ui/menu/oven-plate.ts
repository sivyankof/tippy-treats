import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { OVEN } from '../../../data/progression';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t, tn } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { makeTappable } from './home-badges';
import { OVEN_TEXT_COLOR, OvenPicture } from './oven-picture';
import { drawProgressBar } from './progress-bar';
import { formatHoursMinutes } from './time-text';

const cfg = MENU.home.ovenPlate;

/** What the plate shows now: the lit oven with its layers left, or the spent one with the wait. */
interface OvenFacts {
  left: number;
  /** Time until the oven lights up again. */
  waitMs: number;
}

/**
 * The "fresh oven" plate of Home (docs/07 section 2): the oven character, "×6 XP per layer", the scale of the
 * bonus layers left and "N layers left today"; spent: a sleeping grey oven, "×1 regular XP" and the wait.
 * Centred on its origin. A tap runs `onTap` (the explainer).
 */
export class OvenPlate extends Phaser.GameObjects.Container {
  private picture: OvenPicture | null = null;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private bar: Phaser.GameObjects.Graphics | null = null;
  /** What is drawn now; the same facts again change nothing. */
  private shown: string | null = null;

  constructor(scene: Phaser.Scene, onTap: () => void) {
    super(scene, 0, 0);
    const plate = new VolumePlate(scene, 'card', cfg.height).setBodyWidth(cfg.width);
    this.add(plate);
    scene.add.existing(this);
    makeTappable(this, cfg.width, cfg.height, onTap);
  }

  /** Shows the oven for these facts; cheap to call often, it redraws only when the picture would change. */
  show(facts: OvenFacts): this {
    const lit = facts.left > 0;
    const key = lit ? `lit:${facts.left}` : `spent:${formatHoursMinutes(facts.waitMs)}`;
    if (key === this.shown) return this;
    const wasLit = this.shown?.startsWith('lit') ?? null;
    this.shown = key;
    if (wasLit !== lit) this.rebuild(lit);
    this.fill(lit, facts);
    return this;
  }

  private rebuild(lit: boolean): void {
    this.picture?.destroy();
    this.bar?.destroy();
    this.texts.splice(0).forEach((text) => text.destroy());
    const dy = faceOffsetY('card');
    this.picture = new OvenPicture(this.scene, -cfg.width / 2 + cfg.pictureX, dy, {
      state: lit ? 'lit' : 'spent',
      face: true,
      letters: !lit,
    }).setScale(cfg.pictureScale);
    this.add(this.picture);
    const left = -cfg.width / 2 + cfg.textLeft;
    const rows = lit
      ? [
          { y: cfg.lit.mainY, font: cfg.mainFont, color: OVEN_TEXT_COLOR.lit },
          { y: cfg.lit.subY, font: cfg.subFont, color: PALETTE.textLight },
        ]
      : [
          { y: cfg.spent.mainY, font: cfg.mainFont, color: OVEN_TEXT_COLOR.spent },
          { y: cfg.spent.subY, font: cfg.subFont, color: PALETTE.textLight },
        ];
    for (const row of rows) {
      const text = createOutlinedText(this.scene, left, row.y + dy, '', row.font, row.color);
      text.setOrigin(0, 0.5);
      this.texts.push(text);
      this.add(text);
    }
    if (lit) {
      this.bar = this.scene.add
        .graphics()
        .setPosition(left + this.textWidth / 2, cfg.lit.barY + dy);
      this.add(this.bar);
    }
  }

  private get textWidth(): number {
    return cfg.width - cfg.textLeft - cfg.textRight;
  }

  private fill(lit: boolean, facts: OvenFacts): void {
    const [main, sub] = this.texts;
    if (!main || !sub) return;
    main.setText(lit ? t('oven.bonus', { n: OVEN.layersPerXp }) : t('oven.plain')).setScale(1);
    sub
      .setText(
        lit
          ? tn('oven.left', facts.left, { amount: formatNumber(facts.left) })
          : t('oven.back', { time: formatHoursMinutes(facts.waitMs) }),
      )
      .setScale(1);
    fitText(main, this.textWidth);
    fitText(sub, this.textWidth);
    if (lit && this.bar) {
      drawProgressBar(
        this.bar,
        { width: this.textWidth, ...cfg.bar },
        facts.left / OVEN.freshLayers,
        PALETTE.gold,
      );
    }
  }
}
