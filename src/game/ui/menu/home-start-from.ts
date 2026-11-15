import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { gameState } from '../../../state';
import type { Button } from '../button';
import { createStartFromButton } from './start-from-button';

const cfg = MENU.home.startFrom;

/** The small "Start from ▸" button right above Play; it exists only once a checkpoint is open. */
export class HomeStartFrom {
  readonly button: Button | null;

  constructor(scene: Phaser.Scene, onClick: () => void) {
    this.button =
      gameState.checkpoints.length > 0
        ? createStartFromButton(scene, cfg, 'ui_home_start_from', onClick)
        : null;
  }

  /** Room it takes above Play (the button and the gap over it), 0 without the button. */
  get room(): number {
    return this.button ? cfg.height + cfg.gap : 0;
  }

  /** Stands on the top edge of Play (`playTop`). */
  layout(cx: number, playTop: number): void {
    this.button?.setPosition(cx, playTop - cfg.gap - cfg.height / 2);
  }

  setEnabled(enabled: boolean): void {
    this.button?.setEnabled(enabled);
  }
}
