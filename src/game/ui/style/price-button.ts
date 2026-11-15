import type * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { MENU } from '../../../data/menu-layout';
import { t } from '../../../i18n';
import { createLabelButton, type Button, type LabelButtonLayout } from '../button';
import { missingAmount } from '../menu/detail-model';
import { PriceTag } from '../menu/price-tag';

export interface PriceButtonOptions {
  /** Label with `{price}`; the currency icon follows it, e.g. "Buy for {price} (icon)". */
  template: string;
  price: number;
  /** What the player holds now; below `price` the button turns grey and shows what is missing. */
  have: number;
  currency: Currency;
  /** Fill of the button while the price is affordable. */
  fill: number;
  layout: LabelButtonLayout;
  font: number;
  /** Font of the "Not enough N" caption (default: `font`). */
  shortFont?: number;
  /** The label shrinks to fit this width. */
  maxWidth?: number;
  keyPrefix: string;
  onPay: () => void;
  /**
   * A tap on the grey button; it takes nothing (shake the balance here). Without it the grey
   * button is disabled.
   */
  onShort?: () => void;
}

/**
 * A button with a price of the kit: the price and the currency icon on the face. When the player
 * cannot pay it turns the one grey of the kit (`MENU.style.shortFill`) and says "Not enough N
 * (icon)"; it never hides, so the player always sees what to collect.
 */
export function createPriceButton(scene: Phaser.Scene, options: PriceButtonOptions): Button {
  const missing = missingAmount(options.price, options.have);
  const short = missing > 0;
  const tag = new PriceTag(scene, 0, 0, short ? (options.shortFont ?? options.font) : options.font);
  tag.show(
    short ? t('detail.short', { price: '{price}' }) : options.template,
    short ? missing : options.price,
    options.currency,
  );
  if (options.maxWidth !== undefined) {
    tag.setScale(Math.min(1, options.maxWidth / tag.contentWidth));
  }
  const onTap = short ? (options.onShort ?? (() => {})) : options.onPay;
  const button = createLabelButton(
    scene,
    0,
    0,
    tag,
    short ? MENU.style.shortFill : options.fill,
    options.layout,
    options.keyPrefix,
    onTap,
  );
  return short && !options.onShort ? button.setEnabled(false) : button;
}
