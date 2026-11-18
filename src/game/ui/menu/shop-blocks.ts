import type * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { markAdUnavailable, resetAdLabel } from './ad-unavailable';
import { productOwned } from '../../../core/shop';
import { BERRY_PACKS } from '../../../data/economy';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { BERRY_PRODUCTS, PRODUCTS, SHOP, type ProductKey } from '../../../data/shop';
import { formatNumber, t, tn } from '../../../i18n';
import { gameState } from '../../../state';
import type { Prices } from '../../purchases';
import { createTextButton, type Button } from '../button';
import { CREATURE_ICON_KEYS } from '../creature-icons';
import type { DailySection } from './daily-section';
import { createBodyText } from './detail-info';
import { createNoAdsIcon } from './shop-premium-icon';
import {
  createShopRow,
  createShopSection,
  rowPriceButton,
  pileIcon,
  rowTextButton,
  rowTextParts,
  shopIcon,
} from './shop-row';

const cfg = MENU.shop;
const row = cfg.row;

/** What a tap in the shop does; the scene implements it (and guards it against drags). */
export interface ShopActions {
  buyCreature(id: CreatureId): void;
  watchAd(): void;
  exchange(berries: number): void;
  buy(key: ProductKey): void;
  restore(): void;
  /** A grey price button was tapped: shake the counter of the missing currency. */
  refuse(currency: Currency): void;
}

/** A button of a money product: the store price, "Bought" or "Unavailable". */
function productButton(
  scene: Phaser.Scene,
  key: ProductKey,
  prices: Prices,
  a: ShopActions,
): Button {
  const price = prices[key];
  if (productOwned(gameState.data, key)) {
    return rowTextButton(scene, t('shop.owned'), row.ownedFill, 'normal', () => {}).setEnabled(
      false,
    );
  }
  if (price === undefined) {
    return rowTextButton(scene, t('shop.unavailable'), MENU.style.shortFill, 'normal', () => {})
      .setEnabled(false)
      .setAlpha(cfg.unavailableAlpha);
  }
  return rowTextButton(scene, price, PALETTE.success, 'normal', () => a.buy(key));
}

/** The creatures the baker level opens, for coins. Null when there is nothing to sell. */
export function creaturesSection(scene: Phaser.Scene, a: ShopActions): DailySection | null {
  const entries = gameState.shopCreatures;
  if (entries.length === 0) return null;
  const rows = entries.map(({ id, price }) => {
    const def = CREATURES[id];
    const button = rowPriceButton(scene, {
      price,
      have: gameState.coins,
      currency: 'coins',
      onPay: () => a.buyCreature(id),
      onShort: () => a.refuse('coins'),
    });
    return createShopRow(scene, {
      icon: shopIcon(scene, CREATURE_ICON_KEYS[id], row.iconSize),
      title: t(def.nameKey),
      sub: t(`rarity.${def.rarity}`),
      button,
    });
  });
  return createShopSection(scene, t('shop.section.creatures'), rows);
}

/** Free coins for a rewarded ad: how many are left today and whether an ad is ready. */
export function freeSection(scene: Phaser.Scene, a: ShopActions, adReady: boolean): DailySection {
  const left = gameState.freeCoinsLeft;
  const { amount, perDay } = SHOP.freeCoins;
  let button: Button;
  if (left <= 0) {
    button = rowTextButton(scene, t('shop.free.done'), MENU.style.shortFill, 'wide', () => {});
    button.setEnabled(false);
  } else if (!adReady) {
    const parts = rowTextParts(scene, t('shop.free.watch'), MENU.style.shortFill, 'wide', () => {});
    markAdUnavailable(parts.button, parts.label, parts.labelWidth, 1);
    button = parts.button;
  } else {
    const parts = rowTextParts(scene, t('shop.free.watch'), PALETTE.accent, 'wide', () =>
      a.watchAd(),
    );
    resetAdLabel(parts.label, parts.labelWidth);
    button = parts.button;
  }
  const item = createShopRow(scene, {
    icon: pileIcon(scene, 'coins', amount, row.iconSize),
    title: tn('shop.coinsPlus', amount, { amount: formatNumber(amount) }),
    sub: t('shop.free.left', { left, total: perDay }),
    button,
    buttonSize: 'wide',
  });
  return createShopSection(scene, t('shop.section.free'), [item]);
}

/** The four berry packs for money. */
export function berriesSection(scene: Phaser.Scene, a: ShopActions, prices: Prices): DailySection {
  const rows = BERRY_PRODUCTS.map((key) => {
    const { berries = 0 } = PRODUCTS[key].grant;
    const badge = PRODUCTS[key].badge;
    return createShopRow(scene, {
      icon: pileIcon(scene, 'berries', berries, row.iconSize),
      title: tn('shop.berriesN', berries, { amount: formatNumber(berries) }),
      badge:
        badge === undefined
          ? undefined
          : t(badge === 'popular' ? 'shop.badge.popular' : 'shop.badge.bestValue'),
      button: productButton(scene, key, prices, a),
    });
  });
  return createShopSection(scene, t('shop.section.berries'), rows);
}

/** Berries for coins, in the three packs of `BERRY_PACKS`. */
export function exchangeSection(scene: Phaser.Scene, a: ShopActions): DailySection {
  const rows = BERRY_PACKS.map((pack) =>
    createShopRow(scene, {
      icon: pileIcon(scene, 'coins', pack.coins, row.iconSize),
      title: tn('shop.coinsPlus', pack.coins, { amount: formatNumber(pack.coins) }),
      button: rowPriceButton(scene, {
        price: pack.berries,
        have: gameState.berries,
        currency: 'berries',
        onPay: () => a.exchange(pack.berries),
        onShort: () => a.refuse('berries'),
      }),
    }),
  );
  return createShopSection(scene, t('shop.section.exchange'), rows);
}

/** "No ads": one product. */
export function noAdsSection(scene: Phaser.Scene, a: ShopActions, prices: Prices): DailySection {
  const item = createShopRow(scene, {
    icon: createNoAdsIcon(scene, row.iconSize),
    title: t('shop.noAds.title'),
    button: productButton(scene, 'remove_ads', prices, a),
  });
  const section = createShopSection(scene, t('shop.section.noAds'), [item]);
  // The description is long: it gets the whole width of the card under the row.
  const { font, wrap, gap } = MENU.shop.noAdsNote;
  const note = createBodyText(scene, t('shop.noAds.desc'), font, true).setWordWrapWidth(wrap);
  note.setPosition(0, section.height + gap + note.height / 2);
  section.root.add(note);
  return { root: section.root, height: section.height + gap + note.height };
}

/** The small "Restore purchases" button at the end of the list. */
export function restoreBlock(scene: Phaser.Scene, a: ShopActions): DailySection {
  const { width, height, radius, shadowOffset, font, fill } = cfg.restore;
  const button = createTextButton(scene, {
    text: t('shop.restore'),
    font,
    maxLabelWidth: width - row.buttonPad,
    fill,
    layout: { width, height, radius, shadowOffset },
    keyPrefix: 'ui_shop_restore',
    x: 0,
    y: height / 2,
    onClick: () => a.restore(),
  }).button;
  return { root: scene.add.container(0, 0, [button]), height };
}
