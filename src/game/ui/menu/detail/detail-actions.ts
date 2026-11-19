import * as Phaser from 'phaser';
import type { UnlockHint } from '../../../../core/progression/collection';
import type { Currency } from '../../../../core/economy/economy';
import type { CreatureId } from '../../../../data/creatures/creatures';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { Button, createTextButton, type LabelButtonLayout } from '../../common/button';
import { createPriceButton } from '../../style/price-button';
import { createIconButton } from '../widgets/icon-button';
import { createTextPlate } from './detail-info';
import { mainAction, type MainAction } from './detail-model';
import type { DetailPlan } from './detail-rows';
import { unlockText } from '../widgets/unlock-text';

const cfg = MENU.detail;
const { wideButton, smallButton } = MENU;

/** What the card knows about the player when the buttons are built. */
export interface ActionContext {
  id: CreatureId;
  /** Owned level, or `null` when the creature is locked. */
  level: number | null;
  bakerLevel: number;
  coins: number;
  berries: number;
  inTeam: boolean;
  teamFull: boolean;
  /** What a short screen leaves out. */
  plan: DetailPlan;
}

export interface ActionHandlers {
  upgrade(): void;
  buy(currency: Currency): void;
  tryIt(): void;
  toTeam(): void;
}

/** A text button; the label shrinks to fit in Russian. */
function textButton(
  scene: Phaser.Scene,
  text: string,
  fill: number,
  layout: LabelButtonLayout & { font: number },
  prefix: string,
  onClick: () => void,
): Button {
  return createTextButton(scene, {
    text,
    font: layout.font,
    maxLabelWidth: layout.width - cfg.buttonPadding * 2,
    fill,
    layout,
    keyPrefix: prefix,
    onClick,
  }).button;
}

/** A wide button whose label ends with the coin or berry icon; the kit's grey one when `price` is out of reach. */
function priceButton(
  scene: Phaser.Scene,
  template: string,
  price: number,
  currency: Currency,
  have: number,
  onClick: () => void,
): Button {
  return createPriceButton(scene, {
    template,
    price,
    have,
    currency,
    fill: PALETTE.accent,
    layout: wideButton,
    font: wideButton.font,
    shortFont: cfg.shortFont,
    maxWidth: wideButton.width - cfg.buttonPadding * 2,
    keyPrefix: 'ui_detail_wide',
    onPay: onClick,
  });
}

/** The main and the secondary buttons of a creature card, and where they stand. */
export class DetailActions {
  /** Top to bottom: price buttons, or one line of text for a creature that cannot be bought now. */
  readonly main: Array<Button | Phaser.GameObjects.Container> = [];
  readonly secondary: Button[] = [];

  constructor(scene: Phaser.Scene, ctx: ActionContext, handlers: ActionHandlers) {
    this.buildMain(scene, mainAction(ctx.id, ctx.level, ctx.bakerLevel), ctx, handlers);
    const small = (text: string, fill: number, onClick: () => void): Button =>
      textButton(scene, text, fill, smallButton, 'ui_detail_small', onClick);
    this.secondary.push(
      ctx.plan.tryButton === 'text'
        ? small(t('detail.try'), PALETTE.accentSecondary, handlers.tryIt)
        : createIconButton(
            scene,
            0,
            0,
            cfg.tryIcon.size,
            PALETTE.accentSecondary,
            'play',
            handlers.tryIt,
          ),
    );
    if (ctx.level === null) return;
    if (ctx.inTeam) {
      this.secondary.push(small(t('detail.inTeam'), cfg.disabledFill, () => {}).setEnabled(false));
    } else if (ctx.teamFull) {
      this.secondary.push(
        small(t('detail.teamFull'), cfg.disabledFill, () => {}).setEnabled(false),
      );
    } else {
      this.secondary.push(small(t('detail.toTeam'), PALETTE.success, handlers.toTeam));
    }
  }

  private buildMain(
    scene: Phaser.Scene,
    action: MainAction,
    ctx: ActionContext,
    h: ActionHandlers,
  ): void {
    switch (action.kind) {
      case 'upgrade':
        this.main.push(
          priceButton(
            scene,
            t('detail.upgrade', { price: '{price}' }),
            action.price,
            'coins',
            ctx.coins,
            h.upgrade,
          ),
        );
        return;
      case 'upgradeFrom':
        this.main.push(
          this.infoLine(scene, t('detail.upgradeFrom', { n: formatNumber(action.minBakerLevel) })),
        );
        return;
      case 'maxLevel':
        this.main.push(
          textButton(
            scene,
            t('detail.maxLevel'),
            cfg.disabledFill,
            wideButton,
            'ui_detail_wide',
            () => {},
          ).setEnabled(false),
        );
        return;
      case 'buy':
        for (const { currency, price } of action.options) {
          const have = currency === 'coins' ? ctx.coins : ctx.berries;
          this.main.push(
            priceButton(scene, t('detail.buy', { price: '{price}' }), price, currency, have, () =>
              h.buy(currency),
            ),
          );
        }
        this.addOtherWays(scene, action.otherWays, ctx);
        return;
      case 'shopFrom': {
        const key = action.currency === 'coins' ? 'detail.shopFromCoins' : 'detail.shopFromBerries';
        this.main.push(
          this.infoLine(
            scene,
            t(key, { n: formatNumber(action.minBakerLevel), price: formatNumber(action.price) }),
          ),
        );
        this.addOtherWays(scene, action.otherWays, ctx);
        return;
      }
      case 'howTo':
        this.main.push(
          this.infoLine(
            scene,
            t('detail.howTo', { way: unlockText(action.hint, ctx.bakerLevel) ?? '' }),
          ),
        );
    }
  }

  /** One line per free way to get the creature besides the shop ("Or: Record 75"). */
  private addOtherWays(scene: Phaser.Scene, ways: UnlockHint[], ctx: ActionContext): void {
    for (const hint of ways) {
      const way = unlockText(hint, ctx.bakerLevel);
      if (way !== null && ctx.plan.otherWays) {
        this.main.push(this.infoLine(scene, t('detail.orWay', { way })));
      }
    }
  }

  private infoLine(scene: Phaser.Scene, text: string): Phaser.GameObjects.Container {
    return createTextPlate(scene, text, wideButton.height);
  }

  /** Everything the screen slides in. */
  get parts(): Array<Button | Phaser.GameObjects.Container> {
    return [...this.main, ...this.secondary];
  }

  setEnabled(enabled: boolean): void {
    for (const button of [...this.main, ...this.secondary]) {
      if (button instanceof Button) button.setEnabled(enabled);
    }
  }

  /** Top edge of the button stack on a screen of this height. */
  topY(height: number): number {
    const rowY = height - cfg.buttonsBottom - smallButton.height / 2;
    const baseY = rowY - smallButton.height / 2 - cfg.buttonGap - wideButton.height / 2;
    return (
      baseY - (this.main.length - 1) * (wideButton.height + cfg.buttonGap) - wideButton.height / 2
    );
  }

  /** Stands the buttons from the bottom of the screen up. */
  layout(width: number, height: number): void {
    const cx = width / 2;
    const rowY = height - cfg.buttonsBottom - smallButton.height / 2;
    // The row is centred as a whole: the buttons have different widths when "Try" is an icon.
    const widths = this.secondary.map((button) => button.width);
    let left =
      cx - (widths.reduce((sum, w) => sum + w, 0) + cfg.buttonGap * (widths.length - 1)) / 2;
    this.secondary.forEach((button, i) => {
      const w = widths[i] ?? 0;
      button.setPosition(left + w / 2, rowY);
      left += w + cfg.buttonGap;
    });
    const baseY = rowY - smallButton.height / 2 - cfg.buttonGap - wideButton.height / 2;
    this.main.forEach((item, i) => {
      item.setPosition(
        cx,
        baseY - (this.main.length - 1 - i) * (wideButton.height + cfg.buttonGap),
      );
    });
  }
}
