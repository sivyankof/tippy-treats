import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import type { AttemptsView } from './daily-attempts';
import { DailyAdButton } from './daily-ad-button';
import type { DailySection } from './daily-section';
import { fitText } from './fit-text';
import { formatTimeLeft } from './time-text';

const cfg = MENU.daily;
const out = cfg.outOfAttempts;

/**
 * The bottom slot of the daily screen: the Play button while attempts are left; once they ran
 * out, the time to the next tower and, while it is unused, the "+1 attempt for an ad" button.
 */
export class DailyPlay implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = Math.max(cfg.play.height, out.height);
  readonly play: Button;
  readonly ad: DailyAdButton;
  private readonly timer: Phaser.GameObjects.Text;
  private shown = '';

  constructor(scene: Phaser.Scene, onPlay: () => void, onAd: () => void) {
    const { button } = createTextButton(scene, {
      text: t('daily.play'),
      font: cfg.play.font,
      maxLabelWidth: cfg.play.width - cfg.playPadding,
      fill: PALETTE.accent,
      layout: cfg.play,
      keyPrefix: 'ui_daily_play',
      onClick: onPlay,
      x: 0,
      y: this.height / 2,
    });
    this.play = button.breathe();
    this.timer = createOutlinedText(scene, 0, out.timerY, '', out.timerFont, out.timerColor);
    this.ad = new DailyAdButton(
      scene,
      out.ad,
      out.adPadding,
      cfg.attempts.adDisabledAlpha,
      'ui_daily_ad_out',
      onAd,
    );
    this.ad.button.setPosition(0, out.adY);
    this.root = scene.add.container(0, 0, [this.play, this.timer, this.ad.button]);
  }

  /** Play while attempts are left, otherwise the timer and the ad button. */
  refresh(view: AttemptsView, adReady: boolean, enabled: boolean): void {
    const canPlay = view.left > 0;
    this.play.setVisible(canPlay);
    this.play.setEnabled(canPlay && enabled);
    this.timer.setVisible(!canPlay);
    this.ad.refresh(!canPlay && view.canAddAttempt, adReady);
  }

  /** The time to the next tower; the text is rebuilt only when it changes. */
  update(msLeft: number): void {
    const text = t('daily.nextIn', { time: formatTimeLeft(msLeft) });
    if (text === this.shown) return;
    this.shown = text;
    this.timer.setText(text);
    fitText(this.timer, cfg.caption.width);
  }
}
