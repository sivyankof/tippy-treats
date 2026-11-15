import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import type { PileCurrency, PileSize } from '../../../data/treasure-piles';
import { pileSizeFor } from '../../fx/pile-size';
import { createTreasurePile } from '../../fx/treasure-pile';
import { createTextButton, type Button, type LabelButtonLayout } from '../button';
import { createOutlinedText } from '../outlined-text';
import { createPriceButton, type PriceButtonOptions } from '../style/price-button';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { createBodyText } from './detail-info';
import { createCaption, type DailySection } from './daily-section';
import { fitText } from './fit-text';

const cfg = MENU.shop;
const row = cfg.row;
const captionHeight = MENU.daily.caption.height;

/** A picture of the shop: a texture of the game shown `size` px across, centred on (0, 0). */
export function shopIcon(
  scene: Phaser.Scene,
  texture: string,
  size: number,
): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, texture).setDisplaySize(size, size);
}

/** A pile of coins or berries `size` px across; its size follows `amount` unless `step` is given. */
export function pileIcon(
  scene: Phaser.Scene,
  currency: PileCurrency,
  amount: number,
  size: number,
  step: PileSize = pileSizeFor(currency, amount),
): Phaser.GameObjects.Container {
  return createTreasurePile(scene, currency, step, size);
}

/** Which of the two button sizes of a row. */
export type RowButtonSize = 'normal' | 'wide';

/** The layout (and texture key prefix) of a row button. */
export function rowButtonLayout(
  size: RowButtonSize = 'normal',
): LabelButtonLayout & { font: number } {
  return size === 'wide' ? row.wideButton : row.button;
}

/** A row button with a money label (or any text) in one of the colours of the shop. */
export function rowTextButton(
  scene: Phaser.Scene,
  text: string,
  fill: number,
  size: RowButtonSize,
  onClick: () => void,
): Button {
  const layout = rowButtonLayout(size);
  return createTextButton(scene, {
    text,
    font: layout.font,
    maxLabelWidth: layout.width - row.buttonPad,
    fill,
    layout,
    keyPrefix: `ui_shop_${size}`,
    onClick,
  }).button;
}

/** A row button with a price in coins or berries: the kit's one, grey "Not enough N" when short. */
export function rowPriceButton(
  scene: Phaser.Scene,
  options: Pick<PriceButtonOptions, 'price' | 'have' | 'currency' | 'onPay' | 'onShort'>,
): Button {
  const layout = rowButtonLayout();
  return createPriceButton(scene, {
    ...options,
    template: '{price}',
    fill: PALETTE.accent,
    layout,
    font: layout.font,
    maxWidth: layout.width - row.buttonPad,
    keyPrefix: 'ui_shop_normal',
  });
}

export interface ShopRowOptions {
  /** Shown on the left, about `row.iconSize` across and centred on (0, 0). */
  icon: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
  title: string;
  /** A second line under the title (it wraps). */
  sub?: string;
  /** A red label instead of the second line ("Popular"). */
  badge?: string;
  button: Button;
  buttonSize?: RowButtonSize;
}

/** A red rounded label, centred on (x, y). */
function createBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
): Phaser.GameObjects.Container {
  const { height, font, padX, fill } = row.badge;
  const label = createOutlinedText(scene, 0, faceOffsetY('chip'), text, font);
  const plate = new VolumePlate(scene, 'chip', height, { fill }).setBodyWidth(
    label.width + padX * 2,
  );
  const holder = scene.add.container(x, y, [plate, label]);
  holder.setSize(plate.bodyWidth, height);
  return holder;
}

/**
 * One row of a shop block on a card: an icon, a title with a second line or a badge, and a
 * button on the right. The container sits at the middle of the top edge of the row.
 */
export function createShopRow(
  scene: Phaser.Scene,
  options: ShopRowOptions,
): Phaser.GameObjects.Container {
  const half = cfg.width / 2;
  const buttonWidth = rowButtonLayout(options.buttonSize).width;
  const plate = new VolumePlate(scene, 'card', row.height)
    .setBodyWidth(cfg.width)
    .setY(row.height / 2);
  const iconX = -half + row.padX + row.iconSize / 2;
  options.icon.setPosition(iconX, row.height / 2);
  const textX = iconX + row.iconSize / 2 + row.iconGap;
  const buttonX = half - row.padX - buttonWidth / 2;
  const room = buttonX - buttonWidth / 2 - row.iconGap - textX;
  const hasSecond = options.sub !== undefined || options.badge !== undefined;
  const lift = faceOffsetY('card');
  const title = fitText(createBodyText(scene, options.title, row.titleFont, false), room)
    .setOrigin(0, 0.5)
    .setPosition(textX, row.height * (hasSecond ? row.titleY : 0.5) + lift);
  const parts: Phaser.GameObjects.GameObject[] = [plate, options.icon, title];
  if (options.sub !== undefined) {
    const sub = fitText(createBodyText(scene, options.sub, row.subFont, true), room).setOrigin(
      0,
      0.5,
    );
    sub.setPosition(textX, row.height * row.subY + lift);
    parts.push(sub);
  }
  if (options.badge !== undefined) {
    const badge = createBadge(scene, textX, row.height * row.subY + lift, options.badge);
    badge.setX(textX + badge.width / 2);
    parts.push(badge);
  }
  options.button.setPosition(buttonX, row.height / 2);
  parts.push(options.button);
  return scene.add.container(0, 0, parts);
}

/** A caption and the rows under it, one block of the shop. */
export function createShopSection(
  scene: Phaser.Scene,
  caption: string,
  rows: readonly Phaser.GameObjects.Container[],
): DailySection {
  const parts: Phaser.GameObjects.GameObject[] = [createCaption(scene, caption)];
  rows.forEach((item, i) => {
    item.setY(captionHeight + i * (row.height + cfg.rowGap));
    parts.push(item);
  });
  const height = captionHeight + rows.length * row.height + (rows.length - 1) * cfg.rowGap;
  return { root: scene.add.container(0, 0, parts), height };
}
