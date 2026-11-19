import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { t } from '../../../i18n';
import { gameState } from '../../../state';
import { REWARD_TEXTURES, REWARD_TOWER_FIELD_SCALE } from '../../fx/economy/reward-pictures';
import { attachPressFeedback } from '../button';
import { createStrokedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
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
    .setDisplaySize(
      win.pictureSize * REWARD_TOWER_FIELD_SCALE,
      win.pictureSize * REWARD_TOWER_FIELD_SCALE,
    );
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

/**
 * The explainer line under the header, dark letters on a light plate of the kit so it reads over
 * the busy kitchen; a tap opens the explainer window again. The plate is as high as the wrapped
 * text needs (at least `minHeight`); a late web font that wraps it into more lines shrinks it.
 */
export class DailyIntroLine implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height: number;

  constructor(scene: Phaser.Scene, onTap: () => void) {
    const room = cfg.width - cfg.padX * 2;
    const text = createStrokedText(
      scene,
      0,
      faceOffsetY('card'),
      dailyExplainText(),
      cfg.font,
      PALETTE.textDark,
      PALETTE.panel,
      cfg.stroke,
    )
      .setAlign('center')
      .setWordWrapWidth(room, true);
    const height = Math.max(cfg.minHeight, text.height + cfg.padY * 2);
    this.height = height;
    fitText(text, room, height - cfg.padY * 2);
    const plate = new VolumePlate(scene, 'card', height, { fill: PALETTE.panel }).setBodyWidth(
      cfg.width,
    );
    // The press scales the plate around its middle; `root` keeps the top edge for the layout.
    const body = scene.add.container(0, height / 2, [plate, text]);
    body.setInteractive(
      new Phaser.Geom.Rectangle(-cfg.width / 2, -height / 2, cfg.width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    attachPressFeedback(body, { onTap });
    this.root = scene.add.container(0, 0, [body]);
  }
}
