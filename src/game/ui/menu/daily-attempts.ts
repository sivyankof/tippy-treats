import type * as Phaser from 'phaser';
import { DAILY } from '../../../data/daily';
import { MENU } from '../../../data/menu-layout';
import { REWARD_LOOK } from '../../../data/reward-look';
import { t } from '../../../i18n';
import { idleBob } from '../../fx/idle-bob';
import { REWARD_TEXTURES } from '../../fx/reward-pictures';
import { DailyAdButton } from './daily-ad-button';
import { createCaption, type DailySection } from './daily-section';

const cfg = MENU.daily.attempts;
const captionHeight = MENU.daily.caption.height;

/** What the attempts block and the Play slot show. */
export interface AttemptsView {
  left: number;
  canAddAttempt: boolean;
}

/**
 * The attempt tokens (used ones grey) under the "Attempts left: N" caption, and while attempts
 * are left the "+1 for an ad" button on the same row (with none left it moves to the Play slot).
 */
export class DailyAttempts implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = captionHeight + cfg.rowHeight;
  readonly ad: DailyAdButton;
  private readonly tokens: Phaser.GameObjects.Container;
  private readonly caption: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    onAd: () => void,
  ) {
    this.tokens = scene.add.container(0, 0);
    this.caption = scene.add.container(0, 0);
    this.ad = new DailyAdButton(
      scene,
      cfg.ad,
      cfg.adPadding,
      cfg.adDisabledAlpha,
      'ui_daily_ad',
      onAd,
    );
    this.ad.button.setPosition(cfg.width / 2 - cfg.ad.width / 2, captionHeight + cfg.rowHeight / 2);
    this.root = scene.add.container(0, 0, [this.caption, this.tokens, this.ad.button]);
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
    this.ad.refresh(view.canAddAttempt && view.left > 0, adReady);
  }
}
