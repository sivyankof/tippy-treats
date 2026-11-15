import type * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { CREATURES } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { services } from '../../../services';
import type { LevelUp } from '../../../state/game-state';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { createTextButton } from '../button';
import { createOutlinedText } from '../outlined-text';
import { PopupWindow } from '../style/popup-window';
import { fitText } from './fit-text';
import { PriceTag } from './price-tag';
import { rewardLines, type RewardLine } from './results-text';
import { stackRows, type Row } from './results-layout';

const cfg = MENU.results.levelUp;

/**
 * The window that pops up for every baker level a run reached: a `PopupWindow` of the kit titled
 * "Level 4!" with what the level paid. `onClose` runs once the player closed it and it is gone.
 */
export class LevelUpPanel {
  private readonly popup: PopupWindow;
  private readonly portraits: CreaturePortrait[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    levelUp: LevelUp,
    onClose: () => void,
  ) {
    this.popup = new PopupWindow(scene, {
      title: t('levelUp.title', { n: levelUp.level }),
      closable: false,
      closeOnVeil: false,
      onClosed: onClose,
    });
    this.build(levelUp);
    services.audio.record();
    services.haptics.play('triple');
  }

  tick(dtMs: number): void {
    for (const portrait of this.portraits) portrait.tick(dtMs);
  }

  private build(levelUp: LevelUp): void {
    const inner = this.popup.innerWidth;
    const rows: Row[] = [];
    for (const line of rewardLines(levelUp)) rows.push(...this.lineRows(line, inner));
    const { button: ok } = createTextButton(this.scene, {
      text: t('levelUp.ok'),
      font: cfg.okButton.font,
      maxLabelWidth: cfg.okButton.width - cfg.labelPad,
      fill: PALETTE.success,
      layout: cfg.okButton,
      keyPrefix: 'ui_level_up_ok',
      onClick: () => {
        ok.setEnabled(false);
        this.popup.close();
      },
    });
    rows.push({ obj: ok, height: cfg.okButton.height });

    // The rows stack around the origin of `body`; the content of the window starts at its top.
    const body = this.scene.add.container(0, 0);
    const total = stackRows(body, rows, cfg.gap);
    body.setY(total / 2);
    this.popup.content.add(body);
    this.popup.setContentHeight(total);
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
}
