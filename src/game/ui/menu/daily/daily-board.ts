import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { t } from '../../../../i18n';
import { openBoard } from '../../../games/games-actions';
import { createGamesButton } from '../widgets/games-button';
import type { DailySection } from './daily-section';

/** "Daily leaderboard": the Game Center board of today's tower, the last block of the daily screen. */
export class DailyBoard implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = MENU.gamesButton.height;

  /** `leaving`: the screen is going; a tap then does nothing. */
  constructor(scene: Phaser.Scene, leaving: () => boolean) {
    const button = createGamesButton(
      scene,
      t('games.dailyBoard'),
      MENU.daily.caption.width,
      this.height / 2,
      () => (leaving() ? Promise.resolve() : openBoard(scene, 'daily_height')),
    );
    this.root = scene.add.container(0, 0, [button]);
  }
}
