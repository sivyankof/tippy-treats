import type * as Phaser from 'phaser';
import { DAILY } from '../../../data/daily';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button } from '../button';
import { createCaption, type DailySection } from './daily-section';

const cfg = MENU.daily.attempts;
const captionHeight = MENU.daily.caption.height;

/** An attempt token: a round badge with a play triangle, coloured when free and grey when used. */
function drawToken(g: Phaser.GameObjects.Graphics, x: number, y: number, free: boolean): void {
  const r = cfg.iconSize / 2;
  g.fillStyle(PALETTE.textDark, 1).fillCircle(x, y + r * 0.1, r);
  g.fillStyle(free ? cfg.freeColor : cfg.usedColor, 1).fillCircle(x, y, r * 0.9);
  g.fillStyle(PALETTE.textLight, free ? 1 : 0.7);
  g.fillTriangle(x - r * 0.25, y - r * 0.4, x - r * 0.25, y + r * 0.4, x + r * 0.45, y);
}

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
  private readonly tokens: Phaser.GameObjects.Graphics;
  private readonly caption: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    onAd: () => void,
  ) {
    this.tokens = scene.add.graphics();
    this.caption = scene.add.container(0, 0);
    const { button } = createTextButton(scene, {
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
    this.root = scene.add.container(0, 0, [this.caption, this.tokens, button]);
  }

  /** The tokens, the count in the caption and the ad button follow the attempts of the day. */
  refresh(view: AttemptsView, adReady: boolean): void {
    const total = DAILY.attempts + (view.canAddAttempt ? 0 : DAILY.extraAttempts);
    const y = captionHeight + cfg.rowHeight / 2;
    const step = cfg.iconSize + cfg.iconGap;
    this.tokens.clear();
    for (let i = 0; i < total; i++) {
      drawToken(this.tokens, -cfg.width / 2 + cfg.iconSize / 2 + i * step, y, i < view.left);
    }
    this.caption.removeAll(true);
    this.caption.add(createCaption(this.scene, t('daily.attempts', { n: view.left })));
    this.adButton.setVisible(view.canAddAttempt);
    this.adButton.setEnabled(view.canAddAttempt && adReady);
    this.adButton.setAlpha(adReady ? 1 : cfg.adDisabledAlpha);
  }
}
