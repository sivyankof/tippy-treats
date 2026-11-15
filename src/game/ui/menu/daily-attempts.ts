import type * as Phaser from 'phaser';
import { DAILY } from '../../../data/daily';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { REWARD_LOOK } from '../../../data/reward-look';
import { t } from '../../../i18n';
import { idleBob } from '../../fx/idle-bob';
import { REWARD_TEXTURES } from '../../fx/reward-pictures';
import { createTextButton, type Button } from '../button';
import { markAdUnavailable } from './ad-unavailable';
import { fitText } from './fit-text';
import { createCaption, type DailySection } from './daily-section';

const cfg = MENU.daily.attempts;
const captionHeight = MENU.daily.caption.height;

/** What the attempts block shows. */
export interface AttemptsView {
  left: number;
  canAddAttempt: boolean;
}

/** The attempt tokens (used ones grey) and the "+1 for an ad" button on one row. */
export class DailyAttempts implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = captionHeight + cfg.rowHeight;
  readonly adButton: Button;
  private readonly adLabel: Phaser.GameObjects.Text;
  private readonly tokens: Phaser.GameObjects.Container;
  private readonly caption: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    onAd: () => void,
  ) {
    this.tokens = scene.add.container(0, 0);
    this.caption = scene.add.container(0, 0);
    const { button, label } = createTextButton(scene, {
      text: t('daily.extraAttempt'),
      font: cfg.ad.font,
      maxLabelWidth: cfg.ad.width - cfg.adPadding,
      fill: PALETTE.accentSecondary,
      layout: cfg.ad,
      keyPrefix: 'ui_daily_ad',
      onClick: onAd,
      x: cfg.width / 2 - cfg.ad.width / 2,
      y: captionHeight + cfg.rowHeight / 2,
    });
    this.adButton = button;
    this.adLabel = label;
    this.root = scene.add.container(0, 0, [this.caption, this.tokens, button]);
  }

  /** The tokens, the count in the caption and the ad button follow the attempts of the day. */
  refresh(view: AttemptsView, adReady: boolean): void {
    const total = DAILY.attempts + (view.canAddAttempt ? 0 : DAILY.extraAttempts);
    const y = captionHeight + cfg.rowHeight / 2;
    const step = cfg.iconSize + cfg.iconGap;
    this.tokens.removeAll(true);
    const { width, height } = REWARD_LOOK.ticket;
    const ticketWidth = cfg.iconSize;
    for (let i = 0; i < total; i++) {
      const free = i < view.left;
      const ticket = this.scene.add
        .image(
          -cfg.width / 2 + ticketWidth / 2 + i * step,
          y,
          free ? REWARD_TEXTURES.ticketFree : REWARD_TEXTURES.ticketUsed,
        )
        .setDisplaySize(ticketWidth, (ticketWidth * height) / width);
      this.tokens.add(ticket);
      if (free) idleBob(this.scene, ticket, REWARD_LOOK.ticket.idle);
    }
    this.caption.removeAll(true);
    this.caption.add(createCaption(this.scene, t('daily.attempts', { n: view.left })));
    this.adButton.setVisible(view.canAddAttempt);
    const labelWidth = cfg.ad.width - cfg.adPadding;
    if (adReady) {
      this.adLabel.setText(t('daily.extraAttempt'));
      fitText(this.adLabel, labelWidth);
      this.adButton.setEnabled(view.canAddAttempt);
      this.adButton.setAlpha(1);
    } else {
      markAdUnavailable(this.adButton, this.adLabel, labelWidth, cfg.adDisabledAlpha);
    }
  }
}
