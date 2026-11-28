import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { createLabelButton, createTextButton, type Button } from '../../common/button';
import { bakeTrophy, TROPHY_KEY } from '../../../fx/games/trophy-texture';

const cfg = MENU.gamesButton;

/**
 * Runs `action` on a tap, one at a time: while it runs (a sign-in may take a while) the button is
 * disabled and a second tap does nothing. The action gets the button, so a notice can stand on it.
 * Returns the tap handler.
 */
export function guardBusy(
  button: () => Button,
  action: (button: Button) => Promise<unknown>,
): () => void {
  let busy = false;
  return () => {
    if (busy) return;
    busy = true;
    button().setEnabled(false);
    void action(button()).finally(() => {
      busy = false;
      if (button().active) button().setEnabled(true);
    });
  };
}

/** A wide button of the game services: `width` wide, its centre at (0, `y`), its action one at a time (`guardBusy`). */
export function createGamesButton(
  scene: Phaser.Scene,
  label: string,
  width: number,
  y: number,
  action: (button: Button) => Promise<void>,
): Button {
  const button: Button = createTextButton(scene, {
    text: label,
    font: cfg.font,
    maxLabelWidth: width - cfg.padX * 2,
    fill: cfg.fill,
    layout: { width, height: cfg.height, radius: cfg.radius, shadowOffset: cfg.shadowOffset },
    keyPrefix: `ui_games_${width}`,
    y,
    onClick: guardBusy(() => button, action),
  }).button;
  return button;
}

/** A square button with the trophy (the daily leaderboard next to Play), its centre at (`x`, `y`). */
export function createTrophyButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  action: (button: Button) => Promise<void>,
): Button {
  const sq = cfg.square;
  bakeTrophy(scene);
  const icon = scene.add.image(0, 0, TROPHY_KEY).setDisplaySize(sq.icon, sq.icon);
  const button: Button = createLabelButton(
    scene,
    x,
    y,
    icon,
    cfg.fill,
    { width: sq.size, height: sq.size, radius: sq.radius, shadowOffset: sq.shadowOffset },
    'ui_games_square',
    guardBusy(() => button, action),
  );
  return button;
}
