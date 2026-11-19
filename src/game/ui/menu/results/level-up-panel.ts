import * as Phaser from 'phaser';
import type { Currency } from '../../../../core/economy/economy';
import { CREATURES } from '../../../../data/creatures/creatures';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { REWARD_LOOK } from '../../../../data/economy/reward-look';
import { formatNumber, t, tn } from '../../../../i18n';
import { services } from '../../../../services';
import type { LevelUp } from '../../../../state/game-state';
import { effectsMode } from '../../../app/effects-mode';
import { FX_TEXTURES } from '../../../fx/common/fx-textures';
import { idleBob } from '../../../fx/common/idle-bob';
import { pileSizeFor } from '../../../fx/economy/pile-size';
import { REWARD_TEXTURES, REWARD_TOWER_FIELD_SCALE } from '../../../fx/economy/reward-pictures';
import { createTreasurePile } from '../../../fx/economy/treasure-pile';
import { TREASURE_TEXTURES } from '../../../fx/economy/treasure-textures';
import { CreaturePortrait } from '../../../objects/creatures/creature-portrait';
import { CREATURE_ICON_KEYS } from '../../creatures/creature-icons';
import { createTextButton } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import { fitText } from '../widgets/fit-text';
import { PriceTag } from '../widgets/price-tag';
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
  /** The pictures of the rewards, in the order they pop in. */
  private readonly pops: Phaser.GameObjects.Container[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    levelUp: LevelUp,
    onClose: () => void,
  ) {
    this.popup = new PopupWindow(scene, {
      title: t('levelUp.title', { n: levelUp.level }),
      closable: false,
      layer: 1,
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
    this.playAppear();
  }

  /** The rows of one reward; a creature that was already owned adds a row for the refund. */
  private lineRows(line: RewardLine, inner: number): Row[] {
    switch (line.kind) {
      case 'creature':
        return this.creatureRows(line, inner);
      case 'gain':
        return [this.gainRow(line.currency, line.amount, inner)];
      case 'slot':
        return [this.pictureRow(this.image(REWARD_TEXTURES.slot, true), t('levelUp.slot'), inner)];
      case 'daily':
        return [
          this.pictureRow(
            this.image(REWARD_TEXTURES.tower, true, REWARD_TOWER_FIELD_SCALE),
            t('levelUp.daily'),
            inner,
          ),
        ];
      case 'shop':
        return [
          this.pictureRow(
            this.shopPicture(line.id),
            t('levelUp.shop', { name: t(CREATURES[line.id].nameKey) }),
            inner,
          ),
        ];
    }
  }

  /** A picture of the window at the reward size; `bob` makes it rise and fall gently. */
  private image(key: string, bob: boolean, fieldScale = 1): Phaser.GameObjects.Image {
    const size = cfg.pictureSize * fieldScale;
    const image = this.scene.add.image(0, 0, key).setDisplaySize(size, size);
    if (bob) idleBob(this.scene, image, cfg.appear.bob);
    return image;
  }

  /** The creature that went to the shop: its picture with a coin chip at the corner. */
  private shopPicture(
    id: Extract<RewardLine, { kind: 'shop' }>['id'],
  ): Phaser.GameObjects.Container {
    const size = cfg.pictureSize;
    const coin = REWARD_LOOK.shopCoin;
    const icon = this.image(CREATURE_ICON_KEYS[id], true);
    const chip = this.scene.add
      .image(coin.x * size, coin.y * size, TREASURE_TEXTURES.coin)
      .setDisplaySize(coin.size * size, coin.size * size);
    return this.scene.add.container(0, 0, [icon, chip]);
  }

  private gainRow(currency: Currency, amount: number, inner: number): Row {
    const pile = createTreasurePile(
      this.scene,
      currency,
      pileSizeFor(currency, amount),
      cfg.pictureSize,
    );
    const key = currency === 'coins' ? 'shop.coinsPlus' : 'shop.berriesPlus';
    return this.pictureRow(pile, tn(key, amount, { amount: formatNumber(amount) }), inner);
  }

  /** A row: the reward picture on the left (it pops in later), the text on its right. */
  private pictureRow(
    picture: Phaser.GameObjects.Container | Phaser.GameObjects.Image,
    text: string,
    inner: number,
  ): Row {
    const size = cfg.pictureSize;
    const holder = this.scene.add.container(-inner / 2 + size / 2, 0, [picture]);
    const left = -inner / 2 + size + cfg.portraitGap;
    const label = fitText(
      createOutlinedText(this.scene, left, 0, text, cfg.lineFont).setOrigin(0, 0.5),
      inner / 2 - left,
    );
    this.addPop(holder);
    return { obj: this.scene.add.container(0, 0, [holder, label]), height: cfg.pictureRowHeight };
  }

  private addPop(holder: Phaser.GameObjects.Container): void {
    holder.setScale(effectsMode.reduced ? 1 : 0).setAlpha(effectsMode.reduced ? 0 : 1);
    this.pops.push(holder);
  }

  /** The pictures pop in one after another with a small sparkle; with fewer effects they only fade in. */
  private playAppear(): void {
    const a = cfg.appear;
    this.pops.forEach((holder, i) => {
      const reduced = effectsMode.reduced;
      const tween = this.scene.tweens.add({
        targets: holder,
        ...(reduced ? { alpha: 1, duration: a.fadeMs } : { scale: 1, duration: a.popMs }),
        delay: a.startMs + i * a.staggerMs,
        ease: reduced ? 'Linear' : a.ease,
        onStart: () => {
          if (!reduced) this.sparkle(holder);
        },
      });
      holder.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
    });
  }

  private sparkle(holder: Phaser.GameObjects.Container): void {
    const size = cfg.pictureSize;
    const { sparkle } = cfg.appear;
    const star = this.scene.add
      .image(sparkle.x * size, sparkle.y * size, FX_TEXTURES.star)
      .setTint(sparkle.tint)
      .setScale(0);
    holder.add(star);
    const tween = this.scene.tweens.add({
      targets: star,
      scale: sparkle.scale,
      angle: sparkle.turnDeg,
      alpha: 0,
      duration: sparkle.ms,
      ease: 'Sine.easeOut',
      onComplete: () => star.destroy(),
    });
    star.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
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
    const holder = this.scene.add.container(-inner / 2 + cfg.portraitWidth / 2, 0, [portrait]);
    this.addPop(holder);
    const group = this.scene.add.container(0, 0, [holder, name]);
    name.setX(-inner / 2 + cfg.portraitWidth + cfg.portraitGap);
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

  private priceTag(text: string, amount: number, currency: Currency): PriceTag {
    return new PriceTag(this.scene, 0, 0, cfg.lineFont).show(text, amount, currency);
  }
}
