import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { t } from '../../../i18n';
import { gameState } from '../../../state';
import { REWARD_TEXTURES } from '../../fx/reward-pictures';
import { attachPressFeedback } from '../button';
import { createOutlinedText } from '../outlined-text';
import type { PopupWindow } from '../style/dialog-window';
import type { DailySection } from './daily-section';
import { dailyExplainText, dailyIntroText } from './daily-text';
import { openExplainerWindow } from './explainer-window';

const cfg = MENU.daily.intro;
const win = MENU.daily.introWindow;

/**
 * The explainer of the daily tower: the tower is the same for everyone and changes daily, the team
 * is given for the day, the attempts cannot be continued, the best one pays. It opens once by
 * itself (hint `dailyIntro`) and again on a tap on the line under the header.
 */
export function openDailyIntro(scene: Phaser.Scene): PopupWindow {
  gameState.markHint('dailyIntro');
  // The reward pictures are square.
  const picture = scene.add
    .image(0, 0, REWARD_TEXTURES.tower)
    .setDisplaySize(win.pictureSize, win.pictureSize);
  return openExplainerWindow(scene, {
    title: t('daily.title'),
    picture,
    text: dailyIntroText(),
    align: 'left',
    lineSpacing: win.lineSpacing,
    layout: win,
    keyPrefix: 'ui_daily_intro_ok',
  });
}

/** The one-line explainer under the header; a tap on it opens the explainer window again. */
export class DailyIntroLine implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onTap: () => void) {
    const text = createOutlinedText(scene, 0, 0, dailyExplainText(), cfg.font, cfg.color)
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setWordWrapWidth(cfg.width, true);
    this.text = text;
    text.setInteractive({ useHandCursor: true });
    attachPressFeedback(text, { onTap });
    this.root = scene.add.container(0, 0, [text]);
  }

  /** Measured on every layout: a late web font can wrap the line differently. */
  get height(): number {
    return this.text.height;
  }
}
