import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { createTextButton, type Button } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import type { AttemptsView } from './daily-attempts';
import { DailyAdButton } from './daily-ad-button';
import type { DailySection } from './daily-section';
import { fitText } from '../widgets/fit-text';
import { formatTimeLeft } from '../widgets/time-text';
import { createTrophyButton } from '../widgets/games-button';

const cfg = MENU.daily;
const out = cfg.outOfAttempts;

/**
 * The bottom slot of the daily screen: the Play button while attempts are left; once they ran
 * out, the time to the next tower and, while it is unused, the "+1 attempt for an ad" button.
 * With `board` (the game services are there) a square trophy button for the daily leaderboard
 * stands at the right edge of the slot and the rest moves left to make room for it.
 */
export class DailyPlay implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = Math.max(cfg.play.height, out.height);
  readonly play: Button;
  readonly ad: DailyAdButton;
  private readonly timer: Phaser.GameObjects.Text;
  private shown = '';

  constructor(
    scene: Phaser.Scene,
    onPlay: () => void,
    onAd: () => void,
    board?: () => Promise<void>,
  ) {
    const sq = MENU.gamesButton.square;
    // The trophy takes its side and a gap at the right edge; the rest stands centred in what is left.
    const shift = board ? -(sq.size + sq.gap) / 2 : 0;
    const { button } = createTextButton(scene, {
      text: t('daily.play'),
      font: cfg.play.font,
      maxLabelWidth: cfg.play.width - cfg.playPadding,
      fill: PALETTE.accent,
      layout: cfg.play,
      keyPrefix: 'ui_daily_play',
      onClick: onPlay,
      x: shift,
      y: this.height / 2,
    });
    this.play = button.breathe();
    this.timer = createOutlinedText(scene, shift, out.timerY, '', out.timerFont, out.timerColor);
    this.ad = new DailyAdButton(
      scene,
      out.ad,
      cfg.attempts.adDisabledAlpha,
      'ui_daily_ad_out',
      onAd,
    );
    this.ad.button.setPosition(shift, out.adY);
    this.root = scene.add.container(0, 0, [this.play, this.timer, this.ad.button]);
    if (board) {
      const x = cfg.caption.width / 2 - sq.size / 2;
      this.root.add(createTrophyButton(scene, x, this.height / 2, board));
    }
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
    fitText(this.timer, cfg.caption.width + this.timer.x * 2);
  }
}
