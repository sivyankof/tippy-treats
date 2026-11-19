import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { gameState } from '../../../../state';
import type { Button } from '../../common/button';
import type { HomeStarterOffer } from './home-starter';
import type { StartRun } from '../../../checkpoint-start';
import { openStartChoice } from '../checkpoint/start-choice';
import { createStartFromButton } from '../checkpoint/start-from-button';

const cfg = MENU.home.startFrom;
const starterCfg = MENU.home.starter;

/** What Home needs to know of the starter pack offer to stand it above Play. */
type StarterSpot = Pick<HomeStarterOffer, 'button' | 'room'>;

/** The small "Choose start" button right above Play; it exists only once a checkpoint is open. */
export class HomeStartFrom {
  readonly button: Button | null;

  /**
   * `start` leaves Home into the run of a chosen start (the way Play does); `leaving`: Home is
   * already on its way out, so the "Where from?" window must not open.
   */
  constructor(scene: Phaser.Scene, start: StartRun, leaving: () => boolean) {
    this.button =
      gameState.checkpoints.length > 0
        ? createStartFromButton(scene, cfg, 'ui_home_start_from', () => {
            if (!leaving()) openStartChoice(scene, start);
          })
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

  /**
   * Stands this button and the starter offer (`starter`, when Home has one) above Play; returns
   * the room both take, which the hint bubble sits over.
   */
  layoutOffers(cx: number, playTop: number, starter: StarterSpot): number {
    const room = this.room;
    this.layout(cx, playTop);
    starter.button?.setPosition(cx, playTop - room - starterCfg.gap - starterCfg.height / 2);
    return (starter.room ? starterCfg.height + starterCfg.gap : 0) + room;
  }

  setEnabled(enabled: boolean): void {
    this.button?.setEnabled(enabled);
  }
}
