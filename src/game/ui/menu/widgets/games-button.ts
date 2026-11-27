import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { createTextButton, type Button } from '../../common/button';

const cfg = MENU.gamesButton;

/**
 * A wide button of the game services: `width` wide, its centre at (0, `y`). While its action runs
 * (a sign-in may take a while) it stays pressed-out, so a second tap does nothing.
 */
export function createGamesButton(
  scene: Phaser.Scene,
  label: string,
  width: number,
  y: number,
  action: () => Promise<void>,
): Button {
  let busy = false;
  const button: Button = createTextButton(scene, {
    text: label,
    font: cfg.font,
    maxLabelWidth: width - cfg.padX * 2,
    fill: cfg.fill,
    layout: { width, height: cfg.height, radius: cfg.radius, shadowOffset: cfg.shadowOffset },
    keyPrefix: `ui_games_${width}`,
    y,
    onClick: () => {
      if (busy) return;
      busy = true;
      button.setEnabled(false);
      void action().finally(() => {
        busy = false;
        if (button.active) button.setEnabled(true);
      });
    },
  }).button;
  return button;
}
