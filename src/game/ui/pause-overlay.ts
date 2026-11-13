import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { MENU_BUTTON } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { createMenuButton, type Button } from './button';
import { createDimOverlay } from './dim-overlay';
import { createOutlinedText } from './outlined-text';

const OVERLAY_DEPTH = 500;
const TITLE_FONT = 120;
const COUNTDOWN_FONT = 320;
const TITLE_OFFSET = -300;
const CONTINUE_OFFSET = -20;
const RESTART_OFFSET = CONTINUE_OFFSET + MENU_BUTTON.height + 40;

export interface PauseHandlers {
  /** Called after the 3-2-1 countdown: the run may go on. */
  onResume: () => void;
  onRestart: () => void;
}

/** Pause window: Continue (with a countdown) and Restart. Home and sound arrive with their scenes. */
export class PauseOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly continueButton: Button;
  private readonly restartButton: Button;
  private countdownTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {
    this.dim = createDimOverlay(scene, ANIM.hud.pauseOverlayAlpha, 1, 1);
    this.title = createOutlinedText(scene, 0, 0, t('run.paused'), TITLE_FONT);
    this.countdown = createOutlinedText(scene, 0, 0, '', COUNTDOWN_FONT, PALETTE.gold).setVisible(
      false,
    );
    this.continueButton = createMenuButton(scene, 0, 0, t('run.resume'), PALETTE.accent, () =>
      this.beginCountdown(),
    );
    this.restartButton = createMenuButton(
      scene,
      0,
      0,
      t('run.restart'),
      PALETTE.accentSecondary,
      () => this.handlers.onRestart(),
    );
    this.root = scene.add
      .container(0, 0, [
        this.dim,
        this.title,
        this.countdown,
        this.continueButton,
        this.restartButton,
      ])
      .setDepth(OVERLAY_DEPTH)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.cancelCountdown();
    this.showMenu(true);
    this.root.setVisible(true);
    this.dim.setInteractive();
  }

  hide(): void {
    this.cancelCountdown();
    this.root.setVisible(false);
    this.dim.disableInteractive();
  }

  layout(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    this.dim.setSize(width, height);
    this.title.setPosition(cx, cy + TITLE_OFFSET);
    this.countdown.setPosition(cx, cy);
    this.continueButton.setPosition(cx, cy + CONTINUE_OFFSET);
    this.restartButton.setPosition(cx, cy + RESTART_OFFSET);
  }

  private showMenu(menu: boolean): void {
    this.title.setVisible(menu);
    this.continueButton.setVisible(menu).setEnabled(menu);
    this.restartButton.setVisible(menu).setEnabled(menu);
    this.countdown.setVisible(!menu);
  }

  private beginCountdown(): void {
    this.showMenu(false);
    this.tick(ANIM.hud.countdownSteps);
  }

  private tick(remaining: number): void {
    if (remaining === 0) {
      this.hide();
      this.handlers.onResume();
      return;
    }
    this.countdown.setText(String(remaining));
    this.countdownTimer = this.scene.time.delayedCall(ANIM.hud.countdownStepMs, () =>
      this.tick(remaining - 1),
    );
  }

  private cancelCountdown(): void {
    this.countdownTimer?.remove(false);
    this.countdownTimer = null;
  }
}
