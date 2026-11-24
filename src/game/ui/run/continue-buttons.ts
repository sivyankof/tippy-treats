import type * as Phaser from 'phaser';
import type { ContinueOffer } from '../../../core/run/continue-offer';
import { CONTINUE_ANIM } from '../../../data/run/continue-anim';
import { PALETTE } from '../../../data/common/palette';
import type { RewardedUnavailableReason } from '../../../services/rewarded-video/types';
import { adCaptionFor } from '../../economy/ad-caption';
import { t } from '../../../i18n';
import { createLabelButton, type Button } from '../common/button';
import { resetAdLabel, showAdCaption } from '../menu/widgets/ad-unavailable';
import { createOutlinedText } from '../common/outlined-text';
import { createPriceButton } from '../style/price-button';

const { window: win, button: btn } = CONTINUE_ANIM;
/** The ad caption stays clear of the rounded ends of the button. */
const adLabelWidth = btn.width - btn.radius * 2;

export interface ContinueButtonActions {
  onWatchAd: () => void;
  onPayBerries: () => void;
  /** A tap on the grey price button: it takes nothing. */
  onShort: () => void;
}

/**
 * The "For an ad" and "For N (berry)" buttons, one font size in every state. The ad button is
 * made once and only changes its caption (`setText`) as the ad state changes; the price button is
 * redone only when the price or the busy state changes.
 */
export class ContinueButtons {
  /** Both buttons, for the window to place. */
  readonly root: Phaser.GameObjects.Container;
  readonly ad: Button;
  private readonly adLabel: Phaser.GameObjects.Text;
  /** The price button: the kit's one, grey with "Not enough N" while berries are short. */
  private pay: Button | null = null;
  private key: string | null = null;
  private payKey: string | null = null;
  /** Last enabled state given to the ad button: `setEnabled` resets a press, so only changes are passed on. */
  private adEnabled: boolean | null = null;
  /** The buttons take taps (off for the first moments after the window opens). */
  private active = false;
  private adReady = false;
  private busy = false;

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
    resetAdLabel(this.adLabel, adLabelWidth);
    this.root = scene.add.container(0, 0, [this.ad]);
    this.disable();
  }

  /** Greys the buttons out (the window is closing or closed). */
  disable(): void {
    this.key = null;
    this.payKey = null;
    this.enableAd(false);
    this.pay?.setEnabled(false);
  }

  /**
   * Switches taps on or off for all buttons at once. Only the taps change: no button is redone,
   * moved or redrawn, so the window looks the same from its first frame.
   */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.applyEnabled();
  }

  private applyEnabled(): void {
    this.enableAd(this.adReady && !this.busy && this.active);
    this.pay?.setEnabled(!this.busy && this.active);
  }

  /**
   * Which buttons show, what they say and whether they react; `reason` is why the ad cannot be
   * shown now (its caption: "Loading…", "Ad unavailable", "No internet").
   */
  sync(
    offer: Readonly<ContinueOffer>,
    busy: boolean,
    reason: RewardedUnavailableReason | null = null,
  ): void {
    const key = `${offer.ad}|${reason}|${offer.berryCost}|${offer.berriesMissing}|${busy}`;
    if (key === this.key) return;
    this.key = key;
    this.busy = busy;
    this.adReady = offer.ad === 'ready';
    let row = 0;
    const step = win.berryButtonY - win.adButtonY;
    this.ad.setVisible(offer.ad !== null);
    if (offer.ad !== null) {
      const ready = offer.ad === 'ready';
      if (ready) {
        this.adLabel.setText(t('continue.watchAd'));
        resetAdLabel(this.adLabel, adLabelWidth);
      } else showAdCaption(this.adLabel, adLabelWidth, adCaptionFor(reason));
      this.ad.setPlateAlpha(ready ? 1 : btn.disabledAlpha);
      this.enableAd(ready && !busy && this.active);
      this.ad.setY(win.adButtonY + row++ * step);
    }
    const payKey = `${offer.berryCost}|${offer.berriesMissing}|${busy}`;
    if (payKey === this.payKey) return;
    this.payKey = payKey;
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
      template: t('continue.payFor'),
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
    pay.setEnabled(!busy && this.active);
    this.root.add(pay);
    this.pay = pay;
  }

  private enableAd(enabled: boolean): void {
    if (this.adEnabled === enabled) return;
    this.adEnabled = enabled;
    this.ad.setEnabled(enabled);
  }
}
