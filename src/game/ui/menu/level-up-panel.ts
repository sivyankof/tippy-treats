import * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { ANIM } from '../../../data/anim';
import { CREATURES } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { services } from '../../../services';
import type { LevelUp } from '../../../state/game-state';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { createTextButton } from '../button';
import { createDimOverlay } from '../dim-overlay';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { openPopup } from '../transition';
import { fitText } from './fit-text';
import { PriceTag } from './price-tag';
import { rewardLines, type RewardLine } from './results-text';
import { stackRows, type Row } from './results-layout';

const cfg = MENU.results.levelUp;

/**
 * The window that pops up for every baker level a run reached: "Level 4!" and what the level
 * paid. `onClose` runs when the player closes it; the window then removes itself.
 */
export class LevelUpPanel {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly portraits: CreaturePortrait[] = [];
  private closing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    levelUp: LevelUp,
    private readonly onClose: () => void,
  ) {
    const { width, height } = scene.scale.gameSize;
    this.dim = createDimOverlay(scene, cfg.dimAlpha, width, height)
      .setInteractive()
      .setDepth(cfg.depth);
    this.panel = scene.add.container(width / 2, height / 2).setDepth(cfg.depth + 1);
    this.build(levelUp);
    openPopup(scene, this.dim, this.panel);
    services.audio.record();
    services.haptics.play('triple');
  }

  tick(dtMs: number): void {
    for (const portrait of this.portraits) portrait.tick(dtMs);
  }

  layout(width: number, height: number): void {
    this.dim.setSize(width, height);
    this.panel.setPosition(width / 2, height / 2);
  }

  private build(levelUp: LevelUp): void {
    const inner = cfg.width - cfg.padding * 2;
    const title = createOutlinedText(
      this.scene,
      0,
      0,
      t('levelUp.title', { n: levelUp.level }),
      cfg.titleFont,
      PALETTE.gold,
    );
    fitText(title, inner);
    const rows: Row[] = [{ obj: title, height: cfg.titleFont * cfg.lineHeight }];
    for (const line of rewardLines(levelUp)) rows.push(...this.lineRows(line, inner));
    const { button: ok } = createTextButton(this.scene, {
      text: t('levelUp.ok'),
      font: cfg.okButton.font,
      maxLabelWidth: cfg.okButton.width - cfg.padding,
      fill: PALETTE.success,
      layout: cfg.okButton,
      keyPrefix: 'ui_level_up_ok',
      onClick: () => this.close(),
    });
    rows.push({ obj: ok, height: cfg.okButton.height });

    // The background is sized from the rows, so stack them into a scratch container first.
    const body = this.scene.add.container(0, 0);
    const total = stackRows(body, rows, cfg.gap);
    const w = cfg.width;
    const h = total + cfg.padding * 2;
    const plate = new VolumePlate(this.scene, 'window', h, { fill: cfg.fill }).setBodyWidth(w);
    body.setY(faceOffsetY('window'));
    this.panel.add([plate, body]);
  }

  /** The rows of one reward; a creature that was already owned adds a row for the refund. */
  private lineRows(line: RewardLine, inner: number): Row[] {
    switch (line.kind) {
      case 'creature':
        return this.creatureRows(line, inner);
      case 'gain':
        return [
          { obj: this.priceTag('+{price}', line.amount, line.currency), height: cfg.rowHeight },
        ];
      case 'slot':
        return [this.textRow(t('levelUp.slot'), inner)];
      case 'daily':
        return [this.textRow(t('levelUp.daily'), inner)];
      case 'shop':
        return [this.textRow(t('levelUp.shop', { name: t(CREATURES[line.id].nameKey) }), inner)];
    }
  }

  private creatureRows(line: Extract<RewardLine, { kind: 'creature' }>, inner: number): Row[] {
    const owned = line.instead.length > 0;
    const textWidth = inner - cfg.portraitWidth - cfg.portraitGap;
    const portrait = new CreaturePortrait(this.scene, 0, 0, line.id, 1, cfg.portraitWidth);
    this.portraits.push(portrait);
    const name = createOutlinedText(
      this.scene,
      0,
      owned ? -cfg.lineFont * 0.5 : 0,
      t(CREATURES[line.id].nameKey),
      cfg.lineFont,
    ).setOrigin(0, 0.5);
    fitText(name, textWidth);
    const group = this.scene.add.container(0, 0, [portrait, name]);
    portrait.setX(-inner / 2 + cfg.portraitWidth / 2);
    name.setX(portrait.x + cfg.portraitWidth / 2 + cfg.portraitGap);
    if (owned) {
      const tag = createOutlinedText(
        this.scene,
        name.x,
        cfg.lineFont * 0.6,
        t('levelUp.owned'),
        cfg.lineFont * 0.8,
        PALETTE.gold,
      ).setOrigin(0, 0.5);
      group.add(tag);
      fitText(tag, textWidth);
    }
    const rows: Row[] = [{ obj: group, height: cfg.creatureRowHeight }];
    for (const part of line.instead) {
      const tag = this.priceTag(`${t('levelUp.instead')} {price}`, part.amount, part.currency);
      rows.push({ obj: tag, height: cfg.duplicateRowHeight });
    }
    return rows;
  }

  private textRow(text: string, maxWidth: number): Row {
    return {
      obj: fitText(createOutlinedText(this.scene, 0, 0, text, cfg.lineFont), maxWidth),
      height: cfg.rowHeight,
    };
  }

  private priceTag(text: string, amount: number, currency: Currency): PriceTag {
    return new PriceTag(this.scene, 0, 0, cfg.lineFont).show(text, amount, currency);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.tweens.add({
      targets: [this.panel, this.dim],
      alpha: 0,
      duration: ANIM.ui.popup.dimMs,
      onComplete: () => {
        this.panel.destroy();
        this.dim.destroy();
        this.onClose();
      },
    });
  }
}
