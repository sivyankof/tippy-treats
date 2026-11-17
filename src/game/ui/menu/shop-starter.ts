import * as Phaser from 'phaser';
import { starterPackContents } from '../../../core/shop';
import { CREATURES } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { PRODUCTS } from '../../../data/shop';
import { formatNumber, t, tn } from '../../../i18n';
import { gameState } from '../../../state';
import { cssColor } from '../../../util/color';
import { createTextButton, type Button } from '../button';
import { CREATURE_ICON_KEYS } from '../creature-icons';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import type { DailySection } from './daily-section';
import { fitText } from './fit-text';
import { formatTimeLeft } from './time-text';
import { pileIcon, shopIcon } from './shop-row';

const cfg = MENU.shop.starter;
const width = MENU.shop.width;
const creatureId = PRODUCTS.starter_pack.grant.creature;

/** One line of the contents: a picture and a text. */
interface Line {
  icon: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  text: string;
}

/**
 * The starter pack: its contents (the creature, or its coins when it is owned already), a real
 * countdown and the buy button. `price` is what the store asks; null while it is unknown.
 */
export class ShopStarter implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = cfg.height;
  readonly button: Button;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly timerRoom: number;
  private readonly portrait: CreaturePortrait | null;
  private lastText = '';

  constructor(scene: Phaser.Scene, price: string | null, onBuy: () => void) {
    const half = width / 2;
    const lift = faceOffsetY('card');
    const plate = new VolumePlate(scene, 'card', cfg.height, {
      fill: PALETTE.accentSecondary,
      rim: cfg.rim,
    })
      .setBodyWidth(width)
      .setY(cfg.height / 2);
    const title = createOutlinedText(
      scene,
      -half + cfg.padX,
      cfg.titleY + lift,
      t('shop.starter.title'),
      cfg.titleFont,
    ).setOrigin(0, 0.5);
    this.timer = createOutlinedText(
      scene,
      half - cfg.padX,
      cfg.titleY + lift,
      '',
      cfg.timerFont,
      cfg.timerColor,
    ).setOrigin(1, 0.5);
    fitText(title, width * cfg.titleShare);
    this.timerRoom = width - cfg.padX * 2 - title.displayWidth - cfg.titleGap;
    const parts: Phaser.GameObjects.GameObject[] = [plate, title, this.timer];

    const contents = starterPackContents(gameState.data.creatures);
    // Crumb himself, or a big pile of coins when he is owned already.
    this.portrait =
      creatureId && contents.creature !== null
        ? new CreaturePortrait(
            scene,
            0,
            0,
            creatureId,
            1,
            cfg.portraitLayerWidth,
            cfg.iconSize / cfg.portraitLayerWidth,
          )
        : null;
    const art =
      this.portrait ?? pileIcon(scene, 'coins', contents.coins, cfg.iconSize, cfg.ownedPileStep);
    art.setPosition(-half + cfg.iconX, cfg.iconY);
    parts.push(art);
    const lines: Line[] = [];
    if (creatureId && contents.creature !== null) {
      lines.push({
        icon: shopIcon(scene, CREATURE_ICON_KEYS[creatureId], cfg.lineIcon),
        text: t(CREATURES[creatureId].nameKey),
      });
    }
    lines.push(
      {
        icon: pileIcon(scene, 'coins', contents.coins, cfg.lineIcon, cfg.linePileStep),
        text: tn('shop.coinsN', contents.coins, { amount: formatNumber(contents.coins) }),
      },
      {
        icon: pileIcon(scene, 'berries', contents.berries, cfg.lineIcon, cfg.linePileStep),
        text: tn('shop.berriesN', contents.berries, { amount: formatNumber(contents.berries) }),
      },
    );
    const roomX = half - cfg.padX - (-half + cfg.lineX + cfg.lineIcon + cfg.lineGap);
    lines.forEach((line, i) => {
      const y = cfg.linesY + i * cfg.lineStep;
      line.icon.setPosition(-half + cfg.lineX + cfg.lineIcon / 2, y);
      const label = fitText(
        createOutlinedText(scene, 0, y + lift, line.text, cfg.lineFont),
        roomX,
      ).setOrigin(0, 0.5);
      label.setX(-half + cfg.lineX + cfg.lineIcon + cfg.lineGap);
      parts.push(line.icon, label);
    });

    const duplicate = PRODUCTS.starter_pack.grant.duplicateCoins ?? 0;
    const name = creatureId ? t(CREATURES[creatureId].nameKey) : '';
    const note = createOutlinedText(
      scene,
      0,
      cfg.noteY + lift,
      t(contents.creature === null ? 'shop.starter.noteOwned' : 'shop.starter.note', {
        name,
        coins: tn('shop.coinsN', duplicate, { amount: formatNumber(duplicate) }),
      }),
      cfg.noteFont,
      PALETTE.textLight,
    )
      .setWordWrapWidth(cfg.noteWrap)
      .setAlign('center');
    parts.push(note);

    const available = price !== null;
    this.button = createTextButton(scene, {
      text: available ? t('shop.buyFor', { price }) : t('shop.unavailable'),
      font: cfg.button.font,
      maxLabelWidth: cfg.button.width - MENU.shop.row.buttonPad,
      fill: available ? PALETTE.success : MENU.style.shortFill,
      layout: cfg.button,
      keyPrefix: 'ui_shop_starter',
      x: 0,
      y: cfg.buttonY,
      onClick: onBuy,
    }).button;
    if (!available) this.button.setEnabled(false).setAlpha(MENU.shop.unavailableAlpha);
    parts.push(this.button);
    this.root = scene.add.container(0, 0, parts);
    this.refreshTimer();
  }

  /** The creature blinks and breathes. */
  tick(dtMs: number): void {
    this.portrait?.tick(dtMs);
  }

  /** The countdown follows the clock; there is none before the window has started. */
  refreshTimer(): void {
    const left = gameState.starterPackMsLeft;
    const text = left === null ? '' : t('shop.starter.left', { time: formatTimeLeft(left) });
    if (text === this.lastText) return;
    this.lastText = text;
    this.timer.setText(text).setColor(cssColor(cfg.timerColor));
    fitText(this.timer, this.timerRoom);
  }
}
