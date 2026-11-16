import type * as Phaser from 'phaser';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button } from '../button';
import { markAdUnavailable, resetAdLabel } from './ad-unavailable';

type Layout = { width: number; height: number; radius: number; shadowOffset: number; font: number };

/** The "+1 attempt for an ad" button of the daily screen; it follows the ad and the day. */
export class DailyAdButton {
  readonly button: Button;
  private readonly label: Phaser.GameObjects.Text;
  private readonly labelWidth: number;

  constructor(
    scene: Phaser.Scene,
    private readonly layout: Layout,
    padding: number,
    private readonly disabledAlpha: number,
    keyPrefix: string,
    onClick: () => void,
  ) {
    this.labelWidth = layout.width - padding;
    const { button, label } = createTextButton(scene, {
      text: t('daily.extraAttempt'),
      font: layout.font,
      maxLabelWidth: this.labelWidth,
      fill: PALETTE.accentSecondary,
      layout,
      keyPrefix,
      onClick,
    });
    this.button = button;
    this.label = label;
  }

  get width(): number {
    return this.layout.width;
  }

  /** Shown while the extra attempt of the day is unused; grey "Ad unavailable" while no ad is ready. */
  refresh(shown: boolean, adReady: boolean): void {
    this.button.setVisible(shown);
    if (adReady) {
      this.label.setText(t('daily.extraAttempt'));
      resetAdLabel(this.label, this.labelWidth);
      this.button.setEnabled(shown);
      this.button.setPlateAlpha(1);
    } else {
      markAdUnavailable(this.button, this.label, this.labelWidth, this.disabledAlpha);
    }
  }
}
