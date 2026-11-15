import type * as Phaser from 'phaser';
import type { ContinueOffer } from '../../core/continue-offer';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { createLabelButton, type Button } from './button';
import { createOutlinedText } from './outlined-text';
import { createPriceButton } from './style/price-button';

const { window: win, button: btn } = CONTINUE_ANIM;

export interface ContinueButtonActions {
  onWatchAd: () => void;
  onPayBerries: () => void;
  /** A tap on the grey price button: it takes nothing. */
  onShort: () => void;
}

/** The "Watch an ad" and berry price buttons; redone only when the offer or the busy state changes. */
export class ContinueButtons {
  /** Both buttons, for the window to place. */
  readonly root: Phaser.GameObjects.Container;
  readonly ad: Button;
  private readonly adLabel: Phaser.GameObjects.Text;
  /** The price button: the kit's one, grey with "Not enough N" while berries are short. */
  private pay: Button | null = null;
  private key: string | null = null;
  /** Last enabled state given to the ad button: `setEnabled` resets a press, so only changes are passed on. */
  private adEnabled: boolean | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actions: ContinueButtonActions,
  ) {
    this.adLabel = createOutlinedText(scene, 0, 0, t('continue.watchAd'), btn.font);
    this.ad = createLabelButton(
      scene,
      0,
      win.adButtonY,
      this.adLabel,
      PALETTE.accent,
      btn,
      'ui_continue_button',
      actions.onWatchAd,
    ).breathe();
    this.root = scene.add.container(0, 0, [this.ad]);
    this.disable();
  }

  /** Greys the buttons out (the window is closing or closed). */
  disable(): void {
    this.key = null;
    this.enableAd(false);
    this.pay?.setEnabled(false);
  }

  /** Which buttons show, what they say and whether they react. */
  sync(offer: Readonly<ContinueOffer>, busy: boolean): void {
    const key = `${offer.ad}|${offer.berryCost}|${offer.berriesMissing}|${busy}`;
    if (key === this.key) return;
    this.key = key;
    let row = 0;
    const step = win.berryButtonY - win.adButtonY;
    this.ad.setVisible(offer.ad !== null);
    if (offer.ad !== null) {
      const ready = offer.ad === 'ready';
      this.adLabel.setText(t(ready ? 'continue.watchAd' : 'continue.adUnavailable'));
      this.ad.setAlpha(ready ? 1 : btn.disabledAlpha);
      this.enableAd(ready && !busy);
      this.ad.setY(win.adButtonY + row++ * step);
    }
    this.rebuildPay(offer, win.adButtonY + row * step, busy);
  }

  /** The button that shows now, where the berries fly to. */
  get payButton(): Button {
    return this.pay ?? this.ad;
  }

  private rebuildPay(offer: Readonly<ContinueOffer>, y: number, busy: boolean): void {
    this.pay?.destroy();
    const short = offer.berriesMissing > 0;
    const pay = createPriceButton(this.scene, {
      template: '{price}',
      price: offer.berryCost,
      have: offer.berryCost - offer.berriesMissing,
      currency: 'berries',
      fill: PALETTE.accentSecondary,
      layout: btn,
      font: btn.font,
      keyPrefix: 'ui_continue_berry_button',
      onPay: this.actions.onPayBerries,
      onShort: this.actions.onShort,
    }).setY(y);
    if (!short) pay.breathe();
    pay.setEnabled(!busy);
    this.root.add(pay);
    this.pay = pay;
  }

  private enableAd(enabled: boolean): void {
    if (this.adEnabled === enabled) return;
    this.adEnabled = enabled;
    this.ad.setEnabled(enabled);
  }
}
