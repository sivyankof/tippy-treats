import type * as Phaser from 'phaser';
import type { ContinueOffer } from '../../core/continue-offer';
import { CONTINUE_ANIM } from '../../data/continue-anim';
import { PALETTE } from '../../data/palette';
import { formatNumber, t } from '../../i18n';
import { TREASURE_TEXTURES } from '../fx/treasure-textures';
import { Button, createLabelButton } from './button';
import { createOutlinedText } from './outlined-text';

const { window: win, button: btn } = CONTINUE_ANIM;
const BERRY_BUTTON_TEXTURE = 'ui_continue_berry_button';

export interface ContinueButtonActions {
  onWatchAd: () => void;
  onPayBerries: () => void;
}

/** The "Watch an ad" and berry price buttons; redone only when the offer or the busy state changes. */
export class ContinueButtons {
  readonly ad: Button;
  readonly berry: Button;
  private readonly adLabel: Phaser.GameObjects.Text;
  private readonly berryLabel: Phaser.GameObjects.Text;
  private key: string | null = null;
  /** Last enabled state given to a button: `setEnabled` resets a press, so only changes are passed on. */
  private readonly enabledNow = new Map<Button, boolean>();

  constructor(
    private readonly scene: Phaser.Scene,
    actions: ContinueButtonActions,
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
    this.berryLabel = createOutlinedText(scene, 0, 0, '', btn.font);
    this.berry = this.createBerryButton(actions.onPayBerries);
    this.disable();
  }

  /** Greys both buttons out (the window is closing or closed). */
  disable(): void {
    this.key = null;
    this.enable(this.ad, false);
    this.enable(this.berry, false);
  }

  /** Which buttons show, what they say and whether they react. */
  sync(offer: Readonly<ContinueOffer>, busy: boolean): void {
    const key = `${offer.ad}|${offer.berryCost}|${busy}`;
    if (key === this.key) return;
    this.key = key;
    let row = 0;
    const step = win.berryButtonY - win.adButtonY;
    this.ad.setVisible(offer.ad !== null);
    if (offer.ad !== null) {
      const ready = offer.ad === 'ready';
      this.adLabel.setText(t(ready ? 'continue.watchAd' : 'continue.adUnavailable'));
      this.ad.setAlpha(ready ? 1 : btn.disabledAlpha);
      this.enable(this.ad, ready && !busy);
      this.ad.setY(win.adButtonY + row++ * step);
    }
    this.berry.setVisible(offer.berryCost !== null);
    if (offer.berryCost !== null) {
      this.berryLabel.setText(formatNumber(offer.berryCost));
      this.enable(this.berry, !busy);
      this.berry.setY(win.adButtonY + row * step);
    } else {
      this.enable(this.berry, false);
    }
  }

  private enable(button: Button, enabled: boolean): void {
    if (this.enabledNow.get(button) === enabled) return;
    this.enabledNow.set(button, enabled);
    button.setEnabled(enabled);
  }

  /** Price on a button: the number and the drawn berry next to it. */
  private createBerryButton(onClick: () => void): Button {
    const icon = this.scene.add.image(0, 0, TREASURE_TEXTURES.berry);
    icon.setDisplaySize(btn.berryIconSize, btn.berryIconSize);
    const content = this.scene.add.container(0, 0, [this.berryLabel, icon]);
    // The label is a placeholder wide enough for two digits; the icon sits after the number.
    this.berryLabel.setText('30');
    const half = (this.berryLabel.width + btn.berryGap + btn.berryIconSize) / 2;
    this.berryLabel.setX(-half + this.berryLabel.width / 2);
    icon.setX(half - btn.berryIconSize / 2);
    return new Button(this.scene, {
      x: 0,
      y: win.berryButtonY,
      width: btn.width,
      height: btn.height,
      radius: btn.radius,
      fill: PALETTE.accentSecondary,
      shadowColor: PALETTE.textDark,
      shadowOffset: btn.shadowOffset,
      textureKey: BERRY_BUTTON_TEXTURE,
      content,
      onClick,
    }).breathe();
  }
}
