import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { MENU_BUTTON, TOGGLE_BUTTON } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { services } from '../../services';
import { createMenuButton, type Button } from './button';
import { createDimOverlay } from './dim-overlay';
import { createOutlinedText } from './outlined-text';
import { ToggleButton } from './toggle-button';

const OVERLAY_DEPTH = 500;
const TITLE_FONT = 120;
const COUNTDOWN_FONT = 320;
const TITLE_OFFSET = -300;
const CONTINUE_OFFSET = -20;
const RESTART_OFFSET = CONTINUE_OFFSET + MENU_BUTTON.height + 40;
const SOUND_OFFSET = RESTART_OFFSET + MENU_BUTTON.height + TOGGLE_BUTTON.gap;
const VIBRATION_OFFSET = SOUND_OFFSET + TOGGLE_BUTTON.height + TOGGLE_BUTTON.gap / 2;

export interface PauseHandlers {
  /** Called after the 3-2-1 countdown: the run may go on. */
  onResume: () => void;
  onRestart: () => void;
}

/** Pause window: Continue (with a countdown), Restart and the sound and vibration switches. Home arrives with its scene. */
export class PauseOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly continueButton: Button;
  private readonly restartButton: Button;
  private readonly soundToggle: ToggleButton;
  private readonly vibrationToggle: ToggleButton;
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
    this.soundToggle = new ToggleButton(
      scene,
      'run.sounds',
      () => services.audio.enabled,
      (on) => services.audio.setEnabled(on),
    );
    this.vibrationToggle = new ToggleButton(
      scene,
      'run.vibration',
      () => services.haptics.enabled,
      (on) => services.haptics.setEnabled(on),
    );
    this.root = scene.add
      .container(0, 0, [
        this.dim,
        this.title,
        this.countdown,
        this.continueButton,
        this.restartButton,
        this.soundToggle.button,
        this.vibrationToggle.button,
      ])
      .setDepth(OVERLAY_DEPTH)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.cancelCountdown();
    this.soundToggle.refresh();
    this.vibrationToggle.refresh();
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
    this.soundToggle.button.setPosition(cx, cy + SOUND_OFFSET);
    this.vibrationToggle.button.setPosition(cx, cy + VIBRATION_OFFSET);
  }

  private showMenu(menu: boolean): void {
    this.title.setVisible(menu);
    this.continueButton.setVisible(menu).setEnabled(menu);
    this.restartButton.setVisible(menu).setEnabled(menu);
    this.soundToggle.button.setVisible(menu).setEnabled(menu);
    this.vibrationToggle.button.setVisible(menu).setEnabled(menu);
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
