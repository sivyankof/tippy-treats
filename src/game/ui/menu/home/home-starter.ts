import type * as Phaser from 'phaser';
import { starterPackContents } from '../../../../core/economy/shop';
import { ANIM } from '../../../../data/common/anim';
import type { CreatureId } from '../../../../data/creatures/creatures';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { buyProduct, loadPrices } from '../../../economy/purchases';
import { createTextButton, type Button } from '../../common/button';

const cfg = MENU.home.starter;

/** The gold starter pack button of Home; `price` is the store's price text. */
export function createStarterButton(
  scene: Phaser.Scene,
  price: string,
  onClick: () => void,
): Button {
  const { width, height, radius, shadowOffset, font, pad } = cfg;
  return createTextButton(scene, {
    text: t('home.starter', { price }),
    font,
    maxLabelWidth: width - pad,
    fill: PALETTE.gold,
    layout: { width, height, radius, shadowOffset },
    keyPrefix: 'ui_home_starter',
    onClick,
  }).button.breathe(false);
}

/**
 * The starter pack offer on Home: the button appears once the store has told its price (none, no
 * button) and buys the pack. `room` tells the scene to keep space above Play while the offer is on.
 */
export class HomeStarterOffer {
  button: Button | null = null;
  room: boolean;
  private buying = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hooks: {
      /** The scene is leaving: nothing starts or goes on. */
      leaving: () => boolean;
      /** The button or the room changed: lay the scene out again. */
      changed: () => void;
      /** The pack was bought; `creature` is the new one it gave, if any. */
      bought: (creature: CreatureId | null) => void;
    },
  ) {
    this.room = gameState.starterPackOnHome;
  }

  /** Shows the button when the store has a price for the pack. */
  async start(): Promise<void> {
    const price = (await loadPrices()).starter_pack;
    if (!this.scene.scene.isActive() || this.hooks.leaving() || this.button) return;
    if (price === undefined) {
      this.room = false;
      this.hooks.changed();
      return;
    }
    this.button = createStarterButton(this.scene, price, () => void this.buy());
    // The honest 7-day window starts with the first time the player sees the button.
    gameState.noteStarterPackShown();
    this.hooks.changed();
    this.button.setAlpha(0);
    this.scene.tweens.add({ targets: this.button, alpha: 1, duration: ANIM.ui.transition.inMs });
  }

  setEnabled(enabled: boolean): void {
    this.button?.setEnabled(enabled && !this.buying);
  }

  /** Buys the pack through the store. */
  private async buy(): Promise<void> {
    if (this.buying || this.hooks.leaving()) return;
    const creature = starterPackContents(gameState.data.creatures).creature;
    this.buying = true;
    this.button?.setEnabled(false);
    const outcome = await buyProduct('starter_pack');
    this.buying = false;
    if (!this.scene.scene.isActive()) return;
    if (outcome !== 'purchased') {
      this.button?.setEnabled(!this.hooks.leaving());
      return;
    }
    this.button?.destroy();
    this.button = null;
    this.room = false;
    this.hooks.changed();
    this.hooks.bought(creature);
  }
}
